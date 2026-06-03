"""
知识库路由 - 个人知识卡片管理、搜索、统计

功能：
1. 创建/编辑/删除知识卡片
2. AI从课程场景提取知识点
3. 知识卡片搜索
4. 知识掌握度统计
5. 知识关联管理
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
from app.core.time_utils import utcnow
import asyncpg
import uuid
import json
from app.db.database import get_db
from app.middleware.auth import get_current_user_id

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


# ============ 技能类别定义（与 passport.py 保持一致） ============

SKILL_CATEGORIES = {
    "programming": {"name": "编程开发", "icon": "💻", "color": "#5b9bd5"},
    "data": {"name": "数据分析", "icon": "📊", "color": "#4CAF50"},
    "business": {"name": "商业策略", "icon": "📈", "color": "#FF9800"},
    "language": {"name": "语言学习", "icon": "🌐", "color": "#9C27B0"},
    "design": {"name": "设计创作", "icon": "🎨", "color": "#E91E63"},
    "math": {"name": "数学逻辑", "icon": "🔢", "color": "#3F51B5"},
    "science": {"name": "科学知识", "icon": "🔬", "color": "#00BCD4"},
    "general": {"name": "通用知识", "icon": "📚", "color": "#607D8B"},
}

LEVEL_NAMES = {
    1: "初学",
    2: "了解",
    3: "熟悉",
    4: "掌握",
    5: "精通",
}

# 白名单防止 SQL 注入
ORDER_BY_OPTIONS = {
    "recent": "created_at DESC",
    "mastery": "mastery_level DESC, created_at DESC",
    "reviewed": "last_reviewed_at DESC NULLS LAST, created_at DESC",
}

VALID_RELATION_TYPES = {"prerequisite", "related", "extends"}
VALID_SOURCE_TYPES = {"manual", "course", "note"}


def safe_uuid(value: str, field_name: str = "ID") -> uuid.UUID:
    """安全解析 UUID，无效时抛出 400 错误"""
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"无效的{field_name}格式")


# ============ Models ============

class KnowledgeCardCreate(BaseModel):
    title: str
    content: str
    summary: Optional[str] = None
    key_points: Optional[List[str]] = None
    source_type: Optional[str] = "manual"  # manual, course, note
    source_id: Optional[str] = None
    scene_id: Optional[str] = None
    skill_category: Optional[str] = "general"
    tags: Optional[List[str]] = None


class KnowledgeCardUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    key_points: Optional[List[str]] = None
    skill_category: Optional[str] = None
    tags: Optional[List[str]] = None
    mastery_level: Optional[int] = None


class KnowledgeRelationCreate(BaseModel):
    to_card_id: str
    relation_type: str = "related"  # prerequisite, related, extends

    @field_validator('relation_type')
    @classmethod
    def validate_relation_type(cls, v: str) -> str:
        if v not in VALID_RELATION_TYPES:
            raise ValueError(f"无效的关联类型: {v}")
        return v


class KnowledgeSearchQuery(BaseModel):
    query: str
    skill_category: Optional[str] = None
    tags: Optional[List[str]] = None
    mastery_level_min: Optional[int] = None
    mastery_level_max: Optional[int] = None


class ExtractRequest(BaseModel):
    scene_id: str
    auto_create: bool = True


# ============ Routes ============

@router.post("/cards")
async def create_knowledge_card(
    request: KnowledgeCardCreate,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """创建知识卡片"""
    user_uuid = safe_uuid(user_id, "用户ID")

    if not request.title.strip():
        raise HTTPException(status_code=400, detail="标题不能为空")

    if request.skill_category not in SKILL_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"无效的技能类别: {request.skill_category}")

    if request.source_type and request.source_type not in VALID_SOURCE_TYPES:
        raise HTTPException(status_code=400, detail=f"无效的来源类型: {request.source_type}")

    card_id = uuid.uuid4()
    now = utcnow()

    # 转换 tags 为字符串存储
    tags_str = ",".join(request.tags) if request.tags else None
    key_points_json = json.dumps(request.key_points) if request.key_points else None

    await db.execute(
        """
        INSERT INTO knowledge_cards
        (id, user_id, title, content, summary, key_points, source_type,
         source_id, scene_id, skill_category, tags, mastery_level,
         review_count, last_reviewed_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, 0, NULL, $12, $12)
        """,
        card_id, user_uuid, request.title.strip(), request.content.strip(),
        request.summary, key_points_json, request.source_type,
        safe_uuid(request.source_id, "来源ID") if request.source_id else None,
        safe_uuid(request.scene_id, "场景ID") if request.scene_id else None,
        request.skill_category, tags_str, now
    )

    return {
        "id": str(card_id),
        "title": request.title,
        "skill_category": request.skill_category,
        "skill_name": SKILL_CATEGORIES[request.skill_category]["name"],
        "mastery_level": 1,
        "mastery_name": LEVEL_NAMES[1],
        "message": "知识卡片已创建",
    }


@router.get("/cards")
async def get_knowledge_cards(
    skill_category: Optional[str] = None,
    mastery_level: Optional[int] = None,
    sort: str = "recent",  # recent, mastery, reviewed
    page: int = 1,
    limit: int = 20,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取用户知识卡片列表"""
    user_uuid = safe_uuid(user_id, "用户ID")
    offset = (page - 1) * limit

    # 构建查询条件
    conditions = ["user_id = $1"]
    params = [user_uuid]
    param_idx = 2

    if skill_category and skill_category in SKILL_CATEGORIES:
        conditions.append(f"skill_category = ${param_idx}")
        params.append(skill_category)
        param_idx += 1

    if mastery_level and 1 <= mastery_level <= 5:
        conditions.append(f"mastery_level = ${param_idx}")
        params.append(mastery_level)
        param_idx += 1

    where_clause = "WHERE " + " AND ".join(conditions)

    # 排序 - 使用白名单防止 SQL 注入
    order_clause = f"ORDER BY {ORDER_BY_OPTIONS.get(sort, ORDER_BY_OPTIONS['recent'])}"

    rows = await db.fetch(
        f"""
        SELECT id, title, content, summary, key_points, source_type, source_id,
               scene_id, skill_category, tags, mastery_level, review_count,
               last_reviewed_at, created_at, updated_at
        FROM knowledge_cards {where_clause} {order_clause}
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """,
        *params, limit, offset
    )

    # 统计总数
    total = await db.fetchval(
        f"SELECT COUNT(*) FROM knowledge_cards {where_clause}",
        *params  # 只传递条件参数，不包含limit和offset
    )

    return {
        "cards": [
            {
                "id": str(row["id"]),
                "title": row["title"],
                "content": row["content"],
                "summary": row["summary"],
                "key_points": json.loads(row["key_points"]) if row["key_points"] else [],
                "source_type": row["source_type"],
                "skill_category": row["skill_category"],
                "skill_name": SKILL_CATEGORIES.get(row["skill_category"], {}).get("name", "通用知识"),
                "skill_icon": SKILL_CATEGORIES.get(row["skill_category"], {}).get("icon", "📚"),
                "tags": row["tags"].split(",") if row["tags"] else [],
                "mastery_level": row["mastery_level"],
                "mastery_name": LEVEL_NAMES.get(row["mastery_level"], "初学"),
                "review_count": row["review_count"],
                "last_reviewed_at": row["last_reviewed_at"].isoformat() if row["last_reviewed_at"] else None,
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/cards/{card_id}")
async def get_knowledge_card(
    card_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取知识卡片详情"""
    user_uuid = safe_uuid(user_id, "用户ID")
    card_uuid = safe_uuid(card_id, "卡片ID")

    card = await db.fetchrow(
        """
        SELECT kc.id, kc.user_id, kc.title, kc.content, kc.summary, kc.key_points, kc.source_type,
               kc.source_id, kc.scene_id, kc.skill_category, kc.tags, kc.mastery_level,
               kc.review_count, kc.last_reviewed_at, kc.created_at, kc.updated_at,
               CASE
                   WHEN kc.source_type = 'course' AND kc.source_id IS NOT NULL THEN
                       (SELECT name FROM stages WHERE id = kc.source_id)
                   WHEN kc.source_type = 'course' AND kc.scene_id IS NOT NULL THEN
                       (SELECT st.name FROM stages st JOIN scenes s ON s.stage_id = st.id WHERE s.id = kc.scene_id)
                   ELSE NULL
               END as source_name
        FROM knowledge_cards kc WHERE kc.id = $1
        """,
        card_uuid
    )

    if not card:
        raise HTTPException(status_code=404, detail="知识卡片不存在")

    if card["user_id"] != user_uuid:
        raise HTTPException(status_code=403, detail="只能查看自己的知识卡片")

    # 获取关联的知识卡片
    relations = await db.fetch(
        """
        SELECT r.id, r.to_card_id, r.relation_type, c.title, c.skill_category
        FROM knowledge_relations r
        JOIN knowledge_cards c ON c.id = r.to_card_id
        WHERE r.from_card_id = $1 AND r.user_id = $2
        """,
        card_uuid, user_uuid
    )

    return {
        "id": str(card["id"]),
        "title": card["title"],
        "content": card["content"],
        "summary": card["summary"],
        "key_points": json.loads(card["key_points"]) if card["key_points"] else [],
        "source_type": card["source_type"],
        "source_id": str(card["source_id"]) if card["source_id"] else None,
        "scene_id": str(card["scene_id"]) if card["scene_id"] else None,
        "source_name": card["source_name"],  # 来源课程名称
        "skill_category": card["skill_category"],
        "skill_name": SKILL_CATEGORIES.get(card["skill_category"], {}).get("name", "通用知识"),
        "tags": card["tags"].split(",") if card["tags"] else [],
        "mastery_level": card["mastery_level"],
        "mastery_name": LEVEL_NAMES.get(card["mastery_level"], "初学"),
        "review_count": card["review_count"],
        "last_reviewed_at": card["last_reviewed_at"].isoformat() if card["last_reviewed_at"] else None,
        "created_at": card["created_at"].isoformat(),
        "relations": [
            {
                "relation_id": str(r["id"]),
                "to_card_id": str(r["to_card_id"]),
                "to_card_title": r["title"],
                "relation_type": r["relation_type"],
                "skill_category": r["skill_category"],
            }
            for r in relations
        ],
    }


@router.put("/cards/{card_id}")
async def update_knowledge_card(
    card_id: str,
    request: KnowledgeCardUpdate,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """更新知识卡片"""
    user_uuid = safe_uuid(user_id, "用户ID")
    card_uuid = safe_uuid(card_id, "卡片ID")

    # 验证所有权
    card = await db.fetchrow(
        "SELECT id, user_id FROM knowledge_cards WHERE id = $1",
        card_uuid
    )

    if not card:
        raise HTTPException(status_code=404, detail="知识卡片不存在")

    if card["user_id"] != user_uuid:
        raise HTTPException(status_code=403, detail="只能编辑自己的知识卡片")

    now = utcnow()

    # 更新字段
    update_fields = []
    update_values = []
    param_idx = 1

    if request.title:
        update_fields.append(f"title = ${param_idx}")
        update_values.append(request.title.strip())
        param_idx += 1

    if request.content:
        update_fields.append(f"content = ${param_idx}")
        update_values.append(request.content.strip())
        param_idx += 1

    if request.summary:
        update_fields.append(f"summary = ${param_idx}")
        update_values.append(request.summary)
        param_idx += 1

    if request.key_points:
        update_fields.append(f"key_points = ${param_idx}")
        update_values.append(json.dumps(request.key_points))
        param_idx += 1

    if request.skill_category and request.skill_category in SKILL_CATEGORIES:
        update_fields.append(f"skill_category = ${param_idx}")
        update_values.append(request.skill_category)
        param_idx += 1

    if request.tags:
        update_fields.append(f"tags = ${param_idx}")
        update_values.append(",".join(request.tags))
        param_idx += 1

    if request.mastery_level and 1 <= request.mastery_level <= 5:
        update_fields.append(f"mastery_level = ${param_idx}")
        update_values.append(request.mastery_level)
        param_idx += 1

    if not update_fields:
        raise HTTPException(status_code=400, detail="没有需要更新的字段")

    update_fields.append(f"updated_at = ${param_idx}")
    update_values.append(now)
    param_idx += 1

    update_values.append(card_uuid)

    await db.execute(
        f"UPDATE knowledge_cards SET {', '.join(update_fields)} WHERE id = ${param_idx}",
        *update_values
    )

    return {
        "id": str(card_uuid),
        "message": "知识卡片已更新",
    }


@router.delete("/cards/{card_id}")
async def delete_knowledge_card(
    card_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """删除知识卡片"""
    user_uuid = safe_uuid(user_id, "用户ID")
    card_uuid = safe_uuid(card_id, "卡片ID")

    # 验证所有权
    card = await db.fetchrow(
        "SELECT id, user_id FROM knowledge_cards WHERE id = $1",
        card_uuid
    )

    if not card:
        raise HTTPException(status_code=404, detail="知识卡片不存在")

    if card["user_id"] != user_uuid:
        raise HTTPException(status_code=403, detail="只能删除自己的知识卡片")

    # 删除关联关系
    await db.execute(
        "DELETE FROM knowledge_relations WHERE from_card_id = $1 OR to_card_id = $1",
        card_uuid
    )

    # 删除卡片
    await db.execute(
        "DELETE FROM knowledge_cards WHERE id = $1",
        card_uuid
    )

    return {
        "id": str(card_uuid),
        "message": "知识卡片已删除",
    }


@router.post("/cards/{card_id}/relate")
async def create_knowledge_relation(
    card_id: str,
    request: KnowledgeRelationCreate,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """创建知识卡片关联"""
    user_uuid = safe_uuid(user_id, "用户ID")
    from_uuid = safe_uuid(card_id, "卡片ID")
    to_uuid = safe_uuid(request.to_card_id, "目标卡片ID")

    # 验证两个卡片都属于用户
    cards = await db.fetch(
        "SELECT id, user_id FROM knowledge_cards WHERE id IN ($1, $2)",
        from_uuid, to_uuid
    )

    if len(cards) != 2:
        raise HTTPException(status_code=404, detail="知识卡片不存在")

    for card in cards:
        if card["user_id"] != user_uuid:
            raise HTTPException(status_code=403, detail="只能关联自己的知识卡片")

    # 检查是否已关联
    existing = await db.fetchrow(
        """
        SELECT id FROM knowledge_relations
        WHERE from_card_id = $1 AND to_card_id = $2 AND user_id = $3
        """,
        from_uuid, to_uuid, user_uuid
    )

    if existing:
        raise HTTPException(status_code=400, detail="已存在关联")

    # 检查反向关联是否存在，防止双向重复
    reverse = await db.fetchrow(
        """
        SELECT id FROM knowledge_relations
        WHERE from_card_id = $1 AND to_card_id = $2 AND user_id = $3
        """,
        to_uuid, from_uuid, user_uuid
    )

    if reverse:
        raise HTTPException(status_code=400, detail="反向关联已存在，请勿重复创建")

    # 创建关联
    relation_id = uuid.uuid4()
    now = utcnow()

    await db.execute(
        """
        INSERT INTO knowledge_relations (id, user_id, from_card_id, to_card_id, relation_type, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        relation_id, user_uuid, from_uuid, to_uuid, request.relation_type, now
    )

    return {
        "relation_id": str(relation_id),
        "from_card_id": str(from_uuid),
        "to_card_id": str(to_uuid),
        "relation_type": request.relation_type,
        "message": "关联已创建",
    }


@router.delete("/cards/{card_id}/relations/{relation_id}")
async def delete_knowledge_relation(
    card_id: str,
    relation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """删除知识卡片关联"""
    user_uuid = safe_uuid(user_id, "用户ID")
    relation_uuid = safe_uuid(relation_id, "关联ID")

    # 验证关联属于用户
    relation = await db.fetchrow(
        """
        SELECT id, user_id, from_card_id FROM knowledge_relations WHERE id = $1
        """,
        relation_uuid
    )

    if not relation:
        raise HTTPException(status_code=404, detail="关联不存在")

    if relation["user_id"] != user_uuid:
        raise HTTPException(status_code=403, detail="只能删除自己的关联")

    await db.execute(
        "DELETE FROM knowledge_relations WHERE id = $1",
        relation_uuid
    )

    return {
        "relation_id": str(relation_uuid),
        "message": "关联已删除",
    }


@router.get("/search")
async def search_knowledge_cards(
    q: str,
    skill_category: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """搜索知识卡片"""
    user_uuid = safe_uuid(user_id, "用户ID")
    offset = (page - 1) * limit

    if not q.strip():
        raise HTTPException(status_code=400, detail="搜索关键词不能为空")

    # 搜索标题、内容、标签
    conditions = ["user_id = $1", "(title ILIKE $2 OR content ILIKE $2 OR tags ILIKE $2)"]
    params = [user_uuid, f"%{q.strip()}%"]
    param_idx = 3

    if skill_category and skill_category in SKILL_CATEGORIES:
        conditions.append(f"skill_category = ${param_idx}")
        params.append(skill_category)
        param_idx += 1

    where_clause = "WHERE " + " AND ".join(conditions)

    rows = await db.fetch(
        f"""
        SELECT id, title, content, summary, skill_category, tags, mastery_level, created_at
        FROM knowledge_cards {where_clause}
        ORDER BY created_at DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """,
        *params, limit, offset
    )

    return {
        "query": q,
        "results": [
            {
                "id": str(row["id"]),
                "title": row["title"],
                "summary": row["summary"],
                "skill_category": row["skill_category"],
                "skill_name": SKILL_CATEGORIES.get(row["skill_category"], {}).get("name", "通用知识"),
                "tags": row["tags"].split(",") if row["tags"] else [],
                "mastery_level": row["mastery_level"],
            }
            for row in rows
        ],
        "page": page,
        "limit": limit,
    }


@router.get("/stats")
async def get_knowledge_stats(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取知识掌握度统计"""
    user_uuid = safe_uuid(user_id, "用户ID")

    # 各技能类别的卡片数量和平均掌握度
    stats = await db.fetch(
        """
        SELECT skill_category, COUNT(*) as card_count,
               AVG(mastery_level) as avg_mastery,
               SUM(review_count) as total_reviews
        FROM knowledge_cards WHERE user_id = $1
        GROUP BY skill_category
        """,
        user_uuid
    )

    # 总计
    total = await db.fetchrow(
        """
        SELECT COUNT(*) as total_cards,
               AVG(mastery_level) as avg_mastery,
               SUM(review_count) as total_reviews
        FROM knowledge_cards WHERE user_id = $1
        """,
        user_uuid
    )

    # 构建雷达图数据
    radar_data = {}
    for cat_id, cat_info in SKILL_CATEGORIES.items():
        cat_stat = next((s for s in stats if s["skill_category"] == cat_id), None)
        if cat_stat:
            avg_mastery = float(cat_stat["avg_mastery"]) if cat_stat["avg_mastery"] else 1
            radar_data[cat_id] = {
                "name": cat_info["name"],
                "value": avg_mastery * 20,  # 转换为百分比
                "level": round(avg_mastery, 1),
                "card_count": cat_stat["card_count"],
            }
        else:
            radar_data[cat_id] = {
                "name": cat_info["name"],
                "value": 0,
                "level": 0,
                "card_count": 0,
            }

    return {
        "total_cards": total["total_cards"] or 0,
        "avg_mastery": round(float(total["avg_mastery"]) if total["avg_mastery"] else 1, 1),
        "total_reviews": total["total_reviews"] or 0,
        "by_category": [
            {
                "category": s["skill_category"],
                "category_name": SKILL_CATEGORIES.get(s["skill_category"], {}).get("name", "通用知识"),
                "card_count": s["card_count"],
                "avg_mastery": round(float(s["avg_mastery"]) if s["avg_mastery"] else 1, 1),
                "total_reviews": s["total_reviews"],
            }
            for s in stats
        ],
        "radar_chart": radar_data,
    }


@router.post("/extract")
async def extract_knowledge_from_scene(
    request: ExtractRequest,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """AI从课程场景提取知识点"""
    user_uuid = safe_uuid(user_id, "用户ID")
    scene_uuid = safe_uuid(request.scene_id, "场景ID")

    # 获取场景内容
    scene = await db.fetchrow(
        """
        SELECT s.id, s.title, s.content, s.stage_id, st.name as course_name
        FROM scenes s
        JOIN stages st ON st.id = s.stage_id
        WHERE s.id = $1
        """,
        scene_uuid
    )

    if not scene:
        raise HTTPException(status_code=404, detail="场景不存在")

    # 解析场景内容（确保是字典类型）
    scene_content = scene["content"]
    if isinstance(scene_content, str):
        try:
            scene_content = json.loads(scene_content)
        except json.JSONDecodeError:
            scene_content = {}

    # 调用 AI 提取服务
    from app.services.knowledge.extractor import extract_knowledge_points

    try:
        knowledge_points = await extract_knowledge_points(
            scene_title=scene["title"],
            scene_content=scene_content,
            course_name=scene["course_name"],
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Knowledge extraction failed for scene {scene_uuid}: {e}")
        raise HTTPException(status_code=500, detail="AI提取服务暂时不可用，请稍后重试")

    # 如果 auto_create=True，自动创建知识卡片（去重）
    created_cards = []
    skipped_cards = []  # 已存在，跳过创建

    if request.auto_create and knowledge_points:
        now = utcnow()

        for kp in knowledge_points:
            # 检查是否已存在相同的知识卡片（同一用户、同一场景、相似标题）
            existing = await db.fetchrow(
                """
                SELECT id FROM knowledge_cards
                WHERE user_id = $1 AND scene_id = $2 AND title = $3
                """,
                user_uuid, scene_uuid, kp["title"]
            )

            if existing:
                # 已存在，跳过创建
                skipped_cards.append({
                    "id": str(existing["id"]),
                    "title": kp["title"],
                    "skill_category": kp.get("skill_category", "general"),
                    "reason": "已存在"
                })
                continue

            # 创建新卡片
            card_id = uuid.uuid4()

            await db.execute(
                """
                INSERT INTO knowledge_cards
                (id, user_id, title, content, summary, key_points, source_type,
                 source_id, scene_id, skill_category, mastery_level, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, 'course', $7, $8, $9, 1, $10, $10)
                """,
                card_id, user_uuid, kp["title"], kp["content"],
                kp["summary"], json.dumps(kp.get("key_points", [])),
                scene["stage_id"], scene_uuid,
                kp.get("skill_category", "general"),
                now
            )

            created_cards.append({
                "id": str(card_id),
                "title": kp["title"],
                "skill_category": kp.get("skill_category", "general"),
            })

    return {
        "scene_id": str(scene_uuid),
        "scene_title": scene["title"],
        "extracted_points": knowledge_points,
        "created_cards": created_cards,
        "skipped_cards": skipped_cards,
        "message": f"提取了 {len(knowledge_points)} 个知识点，新创建 {len(created_cards)} 张，跳过 {len(skipped_cards)} 张已存在卡片",
    }


@router.post("/cards/{card_id}/review")
async def mark_card_reviewed(
    card_id: str,
    mastery_change: int = 0,  # 正数表示提升，负数表示下降
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """标记知识卡片已复习，更新掌握度"""
    user_uuid = safe_uuid(user_id, "用户ID")
    card_uuid = safe_uuid(card_id, "卡片ID")

    # 验证所有权
    card = await db.fetchrow(
        "SELECT id, user_id, mastery_level, review_count FROM knowledge_cards WHERE id = $1",
        card_uuid
    )

    if not card:
        raise HTTPException(status_code=404, detail="知识卡片不存在")

    if card["user_id"] != user_uuid:
        raise HTTPException(status_code=403, detail="只能复习自己的知识卡片")

    now = utcnow()

    # 计算新的掌握度（1-5范围）
    new_mastery = card["mastery_level"] + mastery_change
    new_mastery = max(1, min(5, new_mastery))

    # 更新卡片
    await db.execute(
        """
        UPDATE knowledge_cards
        SET mastery_level = $1, review_count = $2, last_reviewed_at = $3, updated_at = $3
        WHERE id = $4
        """,
        new_mastery, card["review_count"] + 1, now, card_uuid
    )

    return {
        "card_id": str(card_uuid),
        "old_mastery": card["mastery_level"],
        "new_mastery": new_mastery,
        "new_mastery_name": LEVEL_NAMES.get(new_mastery, "初学"),
        "review_count": card["review_count"] + 1,
        "message": "复习记录已更新",
    }