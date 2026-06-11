"""
课程缓存服务 — 基于语义匹配复用已有课程，节省 Token 消耗

匹配流程：
1. 用户输入需求 → 生成 embedding 向量
2. 与缓存中的课程 embedding 做余弦相似度匹配
3. 相似度 >= 阈值 → 返回命中课程的大纲 + scenes
4. 命中时支持微调（追加/删除大纲项）
5. 未命中 → 正常生成，生成完写入缓存

存储：
- course_cache 表存 embedding (JSONB) + outlines + scenes 快照
- Redis 缓存全量向量用于快速检索
"""

import logging
import math
import json
import uuid
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

import asyncpg
import dashscope
from dashscope import TextEmbedding

from app.core.config import settings

logger = logging.getLogger(__name__)

# 匹配阈值
SIMILARITY_THRESHOLD = 0.83  # 余弦相似度 >= 0.83 视为匹配
# embedding 维度
EMBEDDING_DIMENSION = 1024
# 缓存最大条数
MAX_CACHE_ENTRIES = 1000


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """计算两个向量的余弦相似度"""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def _validate_source_completeness(
    stage_id: uuid.UUID,
    db: asyncpg.Connection,
) -> tuple[bool, str]:
    """
    校验源课程完整性：
    1. 必须有 scenes
    2. quiz 场景必须有 questions（非空数组）
    3. slide 场景必须有 canvas.elements

    Returns:
        (is_complete, detail_message)
    """
    rows = await db.fetch(
        "SELECT id, type, content FROM scenes WHERE stage_id = $1 ORDER BY order_index",
        stage_id,
    )
    if not rows:
        return False, "no scenes"

    issues = []
    quiz_missing_questions = 0
    empty_slide_count = 0
    total_slide_count = 0

    for row in rows:
        content = row["content"]
        if isinstance(content, str):
            content = json.loads(content)
        if not content:
            continue

        scene_type = row["type"]
        if scene_type == "quiz":
            questions = content.get("questions")
            if not questions or not isinstance(questions, list) or len(questions) == 0:
                quiz_missing_questions += 1
        elif scene_type == "slide":
            total_slide_count += 1
            canvas = content.get("canvas", {})
            elements = canvas.get("elements", []) if isinstance(canvas, dict) else []
            if not elements:
                empty_slide_count += 1

    # quiz 缺 questions 是硬性不完整
    if quiz_missing_questions > 0:
        issues.append(f"{quiz_missing_questions} quiz scene(s) missing questions")

    # 所有 slide 都空才标记不完整（个别空 slide 可以接受）
    if total_slide_count > 0 and empty_slide_count == total_slide_count:
        issues.append("all slide scenes have empty canvas")

    if issues:
        return False, "; ".join(issues[:5])
    return True, "ok"


async def _find_next_best(
    rows: list,
    query_embedding: List[float],
    skipped_ids: set,
    language: str,
) -> tuple[Optional[Any], float]:
    """在跳过某些条目后找次优匹配"""
    best_match = None
    best_similarity = 0.0
    for row in rows:
        if row["id"] in skipped_ids:
            continue
        cached_emb = row["embedding"]
        if not cached_emb:
            continue
        if isinstance(cached_emb, str):
            cached_emb = json.loads(cached_emb)
        similarity = _cosine_similarity(query_embedding, cached_emb)
        if similarity > best_similarity:
            best_similarity = similarity
            best_match = row
    return best_match, best_similarity


async def get_embedding(text: str) -> List[float]:
    """调用 dashscope text-embedding-v3 生成向量"""
    if not dashscope.api_key:
        dashscope.api_key = settings.OPENAI_API_KEY

    resp = TextEmbedding.call(
        model="text-embedding-v3",
        input=text[:2048],  # 限制输入长度
        dimension=EMBEDDING_DIMENSION,
    )
    if resp.status_code == 200:
        return resp.output["embeddings"][0]["embedding"]
    else:
        raise RuntimeError(f"Embedding API error: {resp.status_code} {resp.message}")


async def find_matching_course(
    requirement: str,
    db: asyncpg.Connection,
    language: str = "zh-CN",
) -> Optional[Dict[str, Any]]:
    """
    查找与用户需求语义匹配的已缓存课程
    
    Returns:
        匹配结果，包含 { cache_id, source_stage_id, similarity, outlines, scenes_summary }
        或 None（无匹配）
    """
    try:
        # 1. 生成需求 embedding
        query_embedding = await get_embedding(requirement)

        # 2. 从数据库加载所有缓存条目的 embedding（仅查完整课程）
        rows = await db.fetch(
            """SELECT id, source_stage_id, requirement_text, embedding, outlines, scenes_summary, language
               FROM course_cache
               WHERE language = $1 AND (is_complete IS NULL OR is_complete = true)
               ORDER BY created_at DESC
               LIMIT $2""",
            language, MAX_CACHE_ENTRIES,
        )

        if not rows:
            logger.info("[CourseCache] No cached courses found")
            return None

        # 3. 计算相似度，找最佳匹配
        best_match = None
        best_similarity = 0.0

        for row in rows:
            cached_emb = row["embedding"]
            if not cached_emb:
                continue
            # JSONB 读出可能是 str，需要解析
            if isinstance(cached_emb, str):
                cached_emb = json.loads(cached_emb)
            similarity = _cosine_similarity(query_embedding, cached_emb)
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = row

        # 4. 检查是否达到阈值
        if best_match and best_similarity >= SIMILARITY_THRESHOLD:
            # 5. 校验源课程完整性（quiz 场景必须有 questions，scenes 不能全空）
            is_complete, completeness_detail = await _validate_source_completeness(
                best_match["source_stage_id"], db
            )
            if not is_complete:
                logger.warning(
                    f"[CourseCache] Match found (sim={best_similarity:.4f}) but source course incomplete: "
                    f"{completeness_detail}. Skipping."
                )
                # 从候选中移除此条目，尝试次优匹配
                skipped_ids = {best_match["id"]}
                best_match, best_similarity = await _find_next_best(
                    rows, query_embedding, skipped_ids, language
                )
                if not (best_match and best_similarity >= SIMILARITY_THRESHOLD):
                    return None

            logger.info(
                f"[CourseCache] Match found: similarity={best_similarity:.4f}, "
                f"requirement='{best_match['requirement_text'][:50]}'"
            )
            return {
                "cache_id": str(best_match["id"]),
                "source_stage_id": str(best_match["source_stage_id"]),
                "similarity": round(best_similarity, 4),
                "requirement": best_match["requirement_text"],
                "outlines": best_match["outlines"],
                "scenes_summary": best_match["scenes_summary"],
                "language": best_match["language"],
            }

        logger.info(
            f"[CourseCache] No match above threshold {SIMILARITY_THRESHOLD}. "
            f"Best: {best_similarity:.4f}" if best_match else "No candidates"
        )
        return None

    except Exception as e:
        logger.error(f"[CourseCache] Match failed: {e}")
        return None


async def cache_course(
    requirement: str,
    stage_id: uuid.UUID,
    outlines: List[Dict[str, Any]],
    scenes: List[Dict[str, Any]],
    db: asyncpg.Connection,
    language: str = "zh-CN",
) -> Optional[str]:
    """
    将已生成的课程写入缓存
    
    Args:
        requirement: 用户原始需求
        stage_id: 课程 stage_id
        outlines: 大纲列表
        scenes: 场景列表
        db: 数据库连接
        language: 语言
    
    Returns:
        cache_id 或 None
    """
    try:
        # 1. 生成 embedding
        embedding = await get_embedding(requirement)

        # 2. 构建 scenes 摘要（只存类型+标题，不存完整content）
        scenes_summary = []
        for s in scenes:
            scenes_summary.append({
                "type": s.get("type", "slide"),
                "title": s.get("title", ""),
            })

        # 3. 校验课程完整性
        is_complete, detail = await _validate_source_completeness(stage_id, db)
        if not is_complete:
            logger.warning(
                f"[CourseCache] Course stage {stage_id} incomplete: {detail}. "
                f"Still caching but marking as incomplete."
            )

        # 3. 检查是否已有相似缓存（避免重复）
        existing = await db.fetchrow(
            "SELECT id FROM course_cache WHERE source_stage_id = $1",
            stage_id,
        )
        if existing:
            # 更新已有缓存
            await db.execute(
                """UPDATE course_cache 
                   SET requirement_text = $1, embedding = $2, outlines = $3, 
                       scenes_summary = $4, is_complete = $5, updated_at = $6
                   WHERE id = $7""",
                requirement, json.dumps(embedding), json.dumps(outlines),
                json.dumps(scenes_summary), is_complete, datetime.utcnow(), existing["id"],
            )
            logger.info(f"[CourseCache] Updated cache for stage {stage_id}")
            return str(existing["id"])

        # 4. 插入新缓存
        cache_id = uuid.uuid4()
        await db.execute(
            """INSERT INTO course_cache 
               (id, source_stage_id, requirement_text, embedding, outlines, scenes_summary, language, is_complete, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
            cache_id, stage_id, requirement, json.dumps(embedding),
            json.dumps(outlines), json.dumps(scenes_summary), language,
            is_complete, datetime.utcnow(),
        )
        logger.info(f"[CourseCache] Cached course for stage {stage_id}, cache_id={cache_id}")
        return str(cache_id)

    except Exception as e:
        logger.error(f"[CourseCache] Cache write failed: {e}")
        return None


async def load_cached_course_scenes(
    stage_id: uuid.UUID,
    db: asyncpg.Connection,
) -> List[Dict[str, Any]]:
    """
    从源课程加载完整 scenes 数据（用于复用）
    """
    rows = await db.fetch(
        """SELECT type, title, content, actions, whiteboards, order_index
           FROM scenes 
           WHERE stage_id = $1 
           ORDER BY order_index""",
        stage_id,
    )
    return [dict(r) for r in rows]
