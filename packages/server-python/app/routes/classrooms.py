"""
课程路由 - CRUD 操作（用户隔离）
"""

from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, Field
from typing import Optional
from app.middleware.auth import get_current_user_id, get_optional_user_id
from app.db.database import get_db
from app.services.scene_service import (
    create_stage_record,
    create_all_scenes,
    validate_language,
    validate_scene_count,
    SUPPORTED_LANGUAGES,
    SUPPORTED_SCENE_TYPES,
    MAX_SCENES_PER_REQUEST,
)
from app.core.time_utils import utcnow
from app.routes.subscriptions import check_and_deduct_tokens_for_action
import asyncpg
import uuid
import logging
import json
import time
import asyncio

from fastapi.responses import StreamingResponse
from app.core.redis import get_redis

router = APIRouter()
logger = logging.getLogger(__name__)


class CreateAllScenesRequest(BaseModel):
    """创建所有场景请求体"""
    outlines: list = Field(..., min_length=1, max_length=20, description="场景大纲列表（1-20项）")
    language: str = Field(default='zh-CN', description="语言设置")
    agents: list | None = Field(default=None, description="智能体列表（可选）")


def validate_uuid(id_str: str, field_name: str = "ID") -> uuid.UUID:
    """验证 UUID 格式"""
    try:
        return uuid.UUID(id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field_name}格式无效")


@router.get("")
async def list_classrooms(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取用户课程列表"""
    user_uuid = validate_uuid(current_user_id, "用户ID")

    rows = await db.fetch(
        """
        SELECT 
            s.id, s.name, s.description, s.language_directive, s.created_at, s.updated_at,
            COALESCE(cc.scenes_completed, 0) AS scenes_completed,
            COALESCE(sc.total_scenes, 0) AS total_scenes,
            cc.completion_status
        FROM stages s
        LEFT JOIN course_completions cc ON cc.course_id = s.id AND cc.user_id = $1
        LEFT JOIN (
            SELECT stage_id, COUNT(*) AS total_scenes
            FROM scenes
            GROUP BY stage_id
        ) sc ON sc.stage_id = s.id
        WHERE s.user_id = $1
        ORDER BY s.updated_at DESC
        """,
        user_uuid
    )
    return [
        {
            "id": str(row["id"]),
            "name": row["name"],
            "description": row["description"],
            "language_directive": row["language_directive"],
            "tags": [],
            "created_at": row["created_at"].isoformat(),
            "updated_at": row["updated_at"].isoformat(),
            "progress": {
                "scenes_completed": row["scenes_completed"],
                "total_scenes": row["total_scenes"],
                "percentage": round(row["scenes_completed"] / row["total_scenes"] * 100) if row["total_scenes"] > 0 else 0,
                "status": row["completion_status"] if row["completion_status"] and row["completion_status"] == "completed" else ("in-progress" if row["scenes_completed"] > 0 else "not-started"),
            },
        }
        for row in rows
    ]


@router.post("")
async def create_classroom(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """创建课程"""
    user_uuid = validate_uuid(current_user_id, "用户ID")

    stage_id = uuid.uuid4()
    name = body.get("name", "新课程")
    description = body.get("description")
    language = validate_language(body.get("language_directive", "zh-CN"))
    agent_ids = body.get("agent_ids", [])

    from app.core.time_utils import utcnow
    now = utcnow()

    await create_stage_record(
        stage_id=stage_id,
        user_uuid=user_uuid,
        name=name,
        description=description,
        language=language,
        agent_ids=agent_ids,
        db=db
    )

    return {
        "id": str(stage_id),
        "name": name,
        "created_at": now.isoformat()
    }


@router.get("/{classroom_id}")
async def get_classroom(
    classroom_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取课程详情（包含场景）"""
    classroom_uuid = validate_uuid(classroom_id, "课程ID")
    user_uuid = validate_uuid(current_user_id, "用户ID")

    # 查询课程（不限制用户所有权，支持查看他人公开课程）
    stage = await db.fetchrow(
        """
        SELECT s.id, s.name, s.description, s.language_directive, s.style, s.agent_ids, 
               s.generated_agent_configs, s.pending_outlines, s.created_at, s.updated_at, s.user_id
        FROM stages s
        WHERE s.id = $1
        """,
        classroom_uuid
    )

    if stage is None:
        raise HTTPException(status_code=404, detail="Classroom not found")

    is_owner = str(stage["user_id"]) == current_user_id

    # 非所有者只能查看公开分享的课程
    if not is_owner:
        share = await db.fetchrow(
            "SELECT id FROM shared_classrooms WHERE stage_id = $1 AND is_public = TRUE",
            classroom_uuid
        )
        if not share:
            raise HTTPException(status_code=403, detail="该课程未公开")

    # 查询分享状态（is_public）
    share_info = await db.fetchrow(
        "SELECT is_public, share_code, like_count FROM shared_classrooms WHERE stage_id = $1",
        classroom_uuid
    )

    # 查询当前用户是否已收藏
    liked = False
    if share_info:
        like_row = await db.fetchrow(
            "SELECT id FROM classroom_likes WHERE shared_classroom_id = $1 AND user_id = $2",
            share_info["id"], user_uuid
        )
        liked = like_row is not None

    # 获取场景
    scenes = await db.fetch(
        """
        SELECT id, type, title, order_index, content, actions, whiteboards
        FROM scenes
        WHERE stage_id = $1
        ORDER BY order_index
        """,
        classroom_uuid
    )

    # 解析 generated_agent_configs 并映射 voiceConfig 格式
    generated_agent_configs = None
    if stage["generated_agent_configs"]:
        if isinstance(stage["generated_agent_configs"], str):
            generated_agent_configs = json.loads(stage["generated_agent_configs"])
        else:
            generated_agent_configs = stage["generated_agent_configs"]
        # 映射 snake_case voice 字段为前端期望的 voiceConfig 嵌套对象
        if isinstance(generated_agent_configs, list):
            for agent in generated_agent_configs:
                if isinstance(agent, dict) and "voiceConfig" not in agent:
                    vp = agent.pop("voice_provider", None)
                    vi = agent.pop("voice_id", None)
                    vs = agent.pop("voice_speed", None)
                    if vp or vi:
                        vc = {"providerId": vp or "qwen", "voiceId": vi or "longwanlong"}
                        if vs:
                            vc["speed"] = vs
                        agent["voiceConfig"] = vc

    # 解析 pending_outlines（待创建的场景大纲）
    pending_outlines = None
    if stage["pending_outlines"]:
        if isinstance(stage["pending_outlines"], str):
            pending_outlines = json.loads(stage["pending_outlines"])
        else:
            pending_outlines = stage["pending_outlines"]

    # 查询用户学习进度（已完成的场景数）
    completion = await db.fetchrow(
        "SELECT scenes_completed, total_scenes FROM course_completions WHERE user_id = $1 AND course_id = $2",
        user_uuid, classroom_uuid
    )
    scenes_completed = completion["scenes_completed"] if completion else 0

    return {
        "stage": {
            "id": str(stage["id"]),
            "name": stage["name"],
            "description": stage["description"],
            "language_directive": stage["language_directive"],
            "style": stage["style"],
            "tags": [],  # 课程标签
            "agent_ids": stage["agent_ids"],
            "generatedAgentConfigs": generated_agent_configs,
            "pendingOutlines": pending_outlines,  # 返回待创建的大纲
            "created_at": stage["created_at"].isoformat(),
            "updated_at": stage["updated_at"].isoformat()
        },
        "is_owner": is_owner,
        "is_public": share_info["is_public"] if share_info else False,
        "share_code": share_info["share_code"] if share_info else None,
        "liked": liked,
        "like_count": share_info["like_count"] if share_info else 0,
        "scenes_completed": scenes_completed,
        "scenes": [
            {
                "id": str(s["id"]),
                "type": s["type"],
                "title": s["title"],
                "order_index": s["order_index"],
                # 解析 JSON 字符串为对象
                "content": json.loads(s["content"]) if s["content"] and isinstance(s["content"], str) else s["content"],
                "actions": json.loads(s["actions"]) if s["actions"] and isinstance(s["actions"], str) else s["actions"],
                "whiteboards": json.loads(s["whiteboards"]) if s["whiteboards"] and isinstance(s["whiteboards"], str) else s["whiteboards"]
            }
            for s in scenes
        ]
    }


@router.patch("/{classroom_id}/visibility")
async def toggle_classroom_visibility(
    classroom_id: str,
    body: dict = Body(...),
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """切换课程公开/私有状态"""
    classroom_uuid = validate_uuid(classroom_id, "课程ID")
    user_uuid = validate_uuid(current_user_id, "用户ID")
    is_public = body.get("is_public", True)

    # 验证所有权
    stage = await db.fetchrow(
        "SELECT id FROM stages WHERE id = $1 AND user_id = $2",
        classroom_uuid, user_uuid
    )
    if not stage:
        raise HTTPException(status_code=404, detail="课程不存在")

    # 更新或创建分享记录
    existing = await db.fetchrow(
        "SELECT id, share_code FROM shared_classrooms WHERE stage_id = $1 AND user_id = $2",
        classroom_uuid, user_uuid
    )
    if existing:
        await db.execute(
            "UPDATE shared_classrooms SET is_public = $1, updated_at = $2 WHERE id = $3",
            is_public, utcnow(), existing["id"]
        )
        share_code = existing["share_code"]
    else:
        import random, string
        share_code = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        await db.execute(
            """INSERT INTO shared_classrooms 
               (id, stage_id, user_id, share_code, is_public, title, description, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, '', '', $6, $6)""",
            uuid.uuid4(), classroom_uuid, user_uuid, share_code, is_public, utcnow()
        )

    return {"is_public": is_public, "share_code": share_code}


@router.post("/{classroom_id}/like")
async def toggle_classroom_like(
    classroom_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """收藏/取消收藏课程"""
    classroom_uuid = validate_uuid(classroom_id, "课程ID")
    user_uuid = validate_uuid(current_user_id, "用户ID")

    # 确认课程存在
    stage = await db.fetchrow("SELECT id, name, description FROM stages WHERE id = $1", classroom_uuid)
    if not stage:
        raise HTTPException(status_code=404, detail="课程不存在")

    # 查找或创建分享记录（收藏需要 shared_classrooms 记录）
    share = await db.fetchrow(
        "SELECT id FROM shared_classrooms WHERE stage_id = $1",
        classroom_uuid
    )
    if not share:
        # 自动创建私有分享记录，使收藏功能可用
        import random, string
        share_code = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        share_id = uuid.uuid4()
        await db.execute(
            """INSERT INTO shared_classrooms
               (id, stage_id, user_id, share_code, is_public, title, description, created_at, updated_at)
               VALUES ($1, $2, $3, $4, FALSE, $5, $6, $7, $7)""",
            share_id, classroom_uuid, user_uuid, share_code,
            stage["name"] or "", stage["description"] or "", utcnow()
        )
        share = {"id": share_id}

    existing_like = await db.fetchrow(
        "SELECT id FROM classroom_likes WHERE shared_classroom_id = $1 AND user_id = $2",
        share["id"], user_uuid
    )

    if existing_like:
        await db.execute("DELETE FROM classroom_likes WHERE id = $1", existing_like["id"])
        await db.execute("UPDATE shared_classrooms SET like_count = like_count - 1 WHERE id = $1", share["id"])
        return {"liked": False, "message": "已取消收藏"}
    else:
        await db.execute(
            "INSERT INTO classroom_likes (id, shared_classroom_id, user_id, created_at) VALUES ($1, $2, $3, $4)",
            uuid.uuid4(), share["id"], user_uuid, utcnow()
        )
        await db.execute("UPDATE shared_classrooms SET like_count = like_count + 1 WHERE id = $1", share["id"])
        return {"liked": True, "message": "收藏成功"}


@router.delete("/{classroom_id}")
async def delete_classroom(
    classroom_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """删除课程"""
    classroom_uuid = validate_uuid(classroom_id, "课程ID")
    user_uuid = validate_uuid(current_user_id, "用户ID")

    # 先删除关联的场景
    await db.execute(
        """
        DELETE FROM scenes
        WHERE stage_id = $1 AND user_id = $2
        """,
        classroom_uuid,
        user_uuid
    )

    # 删除课程
    result = await db.execute(
        """
        DELETE FROM stages
        WHERE id = $1 AND user_id = $2
        """,
        classroom_uuid,
        user_uuid
    )

    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Classroom not found")

    return {"message": "Classroom deleted"}


@router.post("/create-full")
async def create_full_classroom(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """
    创建课程记录（不生成场景）

    请求体参数:
    - name: 课程名称
    - description: 课程描述
    - language: 语言设置 (zh-CN, en-US, ja-JP, ko-KR)
    - agent_ids: 智能体 ID 列表
    - agent_configs: 智能体完整配置列表（可选，包含name/role/color/persona等）
    - outlines: 大纲列表（用于返回，不立即生成）

    返回课程 ID，前端应逐个调用 /scenes/create 来生成场景
    """
    start_time = time.time()

    user_uuid = validate_uuid(current_user_id, "用户ID")

    # 验证语言参数
    language = validate_language(body.get("language", "zh-CN"))

    # 提取参数
    name = body.get("name", "新课程")
    description = body.get("description")
    agent_ids = body.get("agent_ids", [])
    agent_configs = body.get("agent_configs")
    outlines = body.get("outlines", [])

    # 验证大纲数量
    if outlines:
        scene_count = validate_scene_count(len(outlines))
        if scene_count != len(outlines):
            outlines = outlines[:scene_count]

    logger.info(f"[Create] 创建课程记录 - name={name}, outlines={len(outlines)}, lang={language}")

    stage_id = uuid.uuid4()

    # 创建课程记录（保存大纲用于后续场景创建）
    await create_stage_record(
        stage_id=stage_id,
        user_uuid=user_uuid,
        name=name,
        description=description,
        language=language,
        agent_ids=agent_ids,
        generated_agent_configs=agent_configs,
        pending_outlines=outlines,  # 保存大纲数据
        db=db
    )

    total_elapsed = time.time() - start_time
    logger.info(f"[Create] 课程记录创建完成 (耗时: {total_elapsed:.2f}s)")

    return {
        "id": str(stage_id),
        "name": name,
        "outlines_count": len(outlines),
        "language": language,
        "elapsed_seconds": round(total_elapsed, 2)
    }


@router.post("/{classroom_id}/scenes/create")
async def create_scene_for_classroom(
    classroom_id: str,
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """
    为课程创建单个场景

    请求体参数:
    - outline: 场景大纲 (title, type, description, key_points)
    - order_index: 场景顺序
    - language: 语言设置
    - agents: 智能体列表（可选，如不提供则从课程配置获取）
    """
    logger.info(f"[SceneCreate] 收到请求 - classroom_id={classroom_id}, outline_title={body.get('outline', {}).get('title')}, order_index={body.get('order_index')}")
    start_time = time.time()

    classroom_uuid = validate_uuid(classroom_id, "课程ID")
    user_uuid = validate_uuid(current_user_id, "用户ID")

    # 验证课程所有权，并获取智能体配置
    stage = await db.fetchrow(
        "SELECT id, name, language_directive, generated_agent_configs FROM stages WHERE id = $1 AND user_id = $2",
        classroom_uuid,
        user_uuid
    )
    if stage is None:
        raise HTTPException(status_code=404, detail="课程不存在")

    # 提取参数
    outline = body.get("outline", {})
    order_index = body.get("order_index", 1)
    language = validate_language(body.get("language", stage["language_directive"] or "zh-CN"))

    # 获取智能体配置（优先使用请求体，否则从课程配置获取）
    agents = body.get("agents")
    if not agents and stage["generated_agent_configs"]:
        try:
            if isinstance(stage["generated_agent_configs"], str):
                agents = json.loads(stage["generated_agent_configs"])
            else:
                agents = stage["generated_agent_configs"]
            logger.info(f"[Scene] 从课程配置获取 {len(agents)} 个智能体")
        except Exception as e:
            logger.warning(f"[Scene] 解析智能体配置失败: {e}")
            agents = None

    if not outline:
        raise HTTPException(status_code=400, detail="场景大纲不能为空")

    logger.info(f"[Scene] 创建场景 - classroom={classroom_id}, title={outline.get('title')}, order={order_index}, agents={len(agents) if agents else 0}")

    # 创建单个场景（使用事务确保原子性）
    from app.services.scene_service import create_single_scene, create_fallback_scene

    async with db.transaction():
        try:
            scene = await create_single_scene(
                outline=outline,
                stage_id=classroom_uuid,
                user_uuid=user_uuid,
                order_index=order_index,
                db=db,
                language=language,
                agents=agents,
            )
        except Exception as e:
            logger.warning(f"[Scene] 创建失败，使用降级场景: {e}")
            scene = await create_fallback_scene(
                outline=outline,
                stage_id=classroom_uuid,
                user_uuid=user_uuid,
                order_index=order_index,
                db=db
            )

    total_elapsed = time.time() - start_time
    logger.info(f"[Scene] 场景创建完成 (耗时: {total_elapsed:.2f}s)")

    # 从 pending_outlines 中移除已创建的大纲（基于 title 匹配）
    pending_outlines_data = await db.fetchval(
        "SELECT pending_outlines FROM stages WHERE id = $1", classroom_uuid
    )
    if pending_outlines_data:
        try:
            pending_list = json.loads(pending_outlines_data) if isinstance(pending_outlines_data, str) else pending_outlines_data
            # 移除匹配的大纲（按 title 匹配）
            remaining_outlines = [o for o in pending_list if o.get("title") != outline.get("title")]

            if len(remaining_outlines) == 0:
                # 所有大纲都已创建，清除 pending_outlines
                logger.info(f"[Scene] 所有场景已创建完成，清除 pending_outlines")
                await db.execute(
                    "UPDATE stages SET pending_outlines = NULL WHERE id = $1", classroom_uuid
                )
            elif len(remaining_outlines) < len(pending_list):
                # 更新剩余大纲
                logger.info(f"[Scene] 更新 pending_outlines，剩余 {len(remaining_outlines)} 个")
                await db.execute(
                    "UPDATE stages SET pending_outlines = $1 WHERE id = $2",
                    json.dumps(remaining_outlines),
                    classroom_uuid
                )
        except Exception as e:
            logger.warning(f"[Scene] 更新pending_outlines失败: {e}")

    return {
        "id": scene["id"],
        "title": scene["title"],
        "type": scene["type"],
        "order_index": scene["order_index"],
        "elapsed_seconds": round(total_elapsed, 2)
    }


@router.post("/{classroom_id}/scenes/{scene_id}/regenerate-quiz")
async def regenerate_quiz_questions(
    classroom_id: str,
    scene_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """
    为缺少 questions 的 quiz 场景补充生成题目。
    前端检测到 quiz 场景无 questions 时调用此 API。
    """
    classroom_uuid = validate_uuid(classroom_id, "课程ID")
    scene_uuid = validate_uuid(scene_id, "场景ID")
    user_uuid = validate_uuid(current_user_id, "用户ID")

    # 验证场景所有权
    scene = await db.fetchrow(
        "SELECT id, type, title, content, stage_id FROM scenes WHERE id = $1 AND stage_id = $2",
        scene_uuid, classroom_uuid
    )
    if not scene:
        raise HTTPException(status_code=404, detail="场景不存在")

    if scene["type"] != "quiz":
        raise HTTPException(status_code=400, detail="仅 quiz 类型场景支持补充生成")

    # 解析现有 content
    content = json.loads(scene["content"]) if isinstance(scene["content"], str) else scene["content"]
    if content.get("questions"):
        return {"success": True, "message": "题目已存在，无需补充", "questions": content["questions"]}

    # 获取课程信息
    stage = await db.fetchrow(
        "SELECT name, description, language_directive FROM stages WHERE id = $1",
        classroom_uuid
    )
    language = validate_language(stage["language_directive"] or "zh-CN") if stage else "zh-CN"

    # 从前一个 slide 场景获取知识上下文
    prev_slides = await db.fetch(
        """SELECT title, content FROM scenes
           WHERE stage_id = $1 AND type = 'slide' AND order_index < (
               SELECT order_index FROM scenes WHERE id = $2
           )
           ORDER BY order_index DESC LIMIT 3""",
        classroom_uuid, scene_uuid
    )
    context_points = []
    for ps in prev_slides:
        ps_content = json.loads(ps["content"]) if isinstance(ps["content"], str) else ps["content"]
        elements = ps_content.get("canvas", {}).get("elements", [])
        for el in elements[:3]:
            if el.get("content"):
                context_points.append(el["content"])

    # 生成 quiz 题目
    from app.services.generation.scene_generator import generate_scene_content, SceneOutline
    outline = SceneOutline(
        id=str(scene_uuid),
        type="quiz",
        title=scene["title"] or "知识检测",
        description=stage["description"] if stage else "",
        order=0,
        key_points=context_points[:5],
    )

    try:
        new_content = await generate_scene_content(outline, language=language)
        questions = new_content.get("questions", [])
        if not questions:
            raise HTTPException(status_code=500, detail="题目生成失败，请稍后重试")

        # 合并到现有 content（保留 canvas）
        if "canvas" in content:
            new_content["canvas"] = content["canvas"]

        # 更新数据库
        await db.execute(
            "UPDATE scenes SET content = $1 WHERE id = $2",
            json.dumps(new_content, ensure_ascii=False),
            scene_uuid
        )

        logger.info(f"[QuizRegen] Scene {scene_id}: generated {len(questions)} questions")
        return {"success": True, "questions": questions}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[QuizRegen] Failed for scene {scene_id}: {e}")
        raise HTTPException(status_code=500, detail=f"题目生成失败: {str(e)}")


@router.get("/{classroom_id}/scenes/progress")
async def scene_creation_progress(
    classroom_id: str,
    # SSE 不支持自定义 header，使用可选认证（无 token 时不拒绝，只返回 None）
    current_user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    SSE 端点：实时推送场景创建进度
    客户端通过 EventSource 连接，接收 {completed, total, title, status} 事件
    """
    from app.routes.classrooms import validate_uuid
    classroom_uuid = validate_uuid(classroom_id, "课程ID")
    # 用户认证可选（SSE 不支持自定义 header）
    if current_user_id:
        validate_uuid(current_user_id, "用户ID")

    channel = f"scene_progress:{classroom_uuid}"

    async def event_generator():
        r = get_redis()
        if not r:
            yield f"data: {json.dumps({'error': 'Redis unavailable'})}\n\n"
            return
        pubsub = r.pubsub()
        try:
            await pubsub.subscribe(channel)
            # 发送初始连接确认
            yield f"data: {json.dumps({'status': 'connected'})}\n\n"
            # 监听 10 分钟超时
            timeout = 600
            last_time = time.time()
            while time.time() - last_time < timeout:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if message and message["type"] == "message":
                    last_time = time.time()
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    yield f"data: {data}\n\n"
                    # 如果所有场景都完成了，发送 done 事件并关闭
                    try:
                        parsed = json.loads(data)
                        if parsed.get("completed", 0) >= parsed.get("total", 0):
                            yield f"data: {json.dumps({'status': 'done'})}\n\n"
                            break
                    except Exception:
                        pass
            else:
                yield f"data: {json.dumps({'status': 'timeout'})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{classroom_id}/scenes/create-all")
async def create_all_scenes_for_classroom(
    classroom_id: str,
    body: CreateAllScenesRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """
    并行创建所有场景（替代前端逐个调用 /scenes/create）

    请求体参数:
    - outlines: 场景大纲列表 [{title, type, description, key_points}, ...]（最多20项）
    - language: 语言设置
    - agents: 智能体列表（可选，如不提供则从课程配置获取）
    """
    start_time = time.time()

    # 先验证参数和资源存在性（Token 扣减必须在验证之后）
    classroom_uuid = validate_uuid(classroom_id, "课程ID")
    user_uuid = validate_uuid(current_user_id, "用户ID")

    stage = await db.fetchrow(
        "SELECT id, name, language_directive, generated_agent_configs FROM stages WHERE id = $1 AND user_id = $2",
        classroom_uuid,
        user_uuid
    )
    if stage is None:
        raise HTTPException(status_code=404, detail="课程不存在")

    # Token 消耗检查：课程场景生成 = course_generation_base + 场景数
    outlines = body.outlines
    try:
        token_result = await check_and_deduct_tokens_for_action(
            current_user_id, "course_generation_base", db,
            extra_count=len(outlines)
        )
        logger.info(f"[SceneCreateAll] Token check: deducted={token_result['deducted']}, free_quota={token_result['free_quota_used']}, scenes={len(outlines)}")
    except HTTPException as e:
        logger.warning(f"[SceneCreateAll] Token check failed: {e.detail}")
        raise

    language = validate_language(body.language or stage["language_directive"] or "zh-CN")
    agents = body.agents
    if not agents and stage["generated_agent_configs"]:
        try:
            if isinstance(stage["generated_agent_configs"], str):
                agents = json.loads(stage["generated_agent_configs"])
            else:
                agents = stage["generated_agent_configs"]
            logger.info(f"[SceneCreateAll] 从课程配置获取 {len(agents)} 个智能体")
        except Exception as e:
            logger.warning(f"[SceneCreateAll] 解析智能体配置失败: {e}")
            agents = None

    logger.info(f"[SceneCreateAll] 并行创建 {len(outlines)} 个场景 - classroom={classroom_id}")

    # 幂等保护：立即清空 pending_outlines，防止刷新导致重复创建
    await db.execute(
        "UPDATE stages SET pending_outlines = NULL WHERE id = $1", classroom_uuid
    )

    existing_scenes = await db.fetch(
        "SELECT order_index FROM scenes WHERE stage_id = $1 ORDER BY order_index DESC LIMIT 1",
        classroom_uuid
    )
    existing_count = existing_scenes[0]["order_index"] if existing_scenes else 0

    scenes = await create_all_scenes(
        outlines=outlines,
        stage_id=classroom_uuid,
        user_uuid=user_uuid,
        db=db,
        language=language,
        start_order_index=existing_count,
        agents=agents,
    )

    total_elapsed = time.time() - start_time
    logger.info(f"[SceneCreateAll] 全部场景创建完成 (耗时: {total_elapsed:.2f}s)")

    # 自动缓存课程（供后续语义匹配复用）
    try:
        from app.services.course_cache import cache_course
        await cache_course(
            requirement=stage["name"],
            stage_id=classroom_uuid,
            outlines=[o.model_dump() if hasattr(o, "model_dump") else o for o in outlines],
            scenes=scenes,
            db=db,
            language=language,
        )
        logger.info(f"[SceneCreateAll] 课程已自动缓存: {classroom_id}")
    except Exception as e:
        logger.warning(f"[SceneCreateAll] 缓存课程失败（不影响主流程）: {e}")

    return {
        "scenes": scenes,
        "elapsed_seconds": round(total_elapsed, 2)
    }


@router.post("/clone-from-cache")
async def clone_course_from_cache(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """
    从缓存源课程直接复制为新课程（一步完成：复制 stage + scenes，user_id 为当前用户）
    - source_stage_id: 缓存源课程的 stage_id
    - name: 新课程名称（可选，默认复用源课程名）
    - 整个课程内容直接复制，无需LLM生成，零Token消耗
    """
    source_stage_id = body.get("source_stage_id")
    if not source_stage_id:
        raise HTTPException(status_code=400, detail="source_stage_id is required")

    new_name = body.get("name")
    user_uuid = validate_uuid(current_user_id, "用户ID")
    source_uuid = validate_uuid(source_stage_id, "源课程ID")

    # 验证源课程在缓存表中
    cache_row = await db.fetchrow(
        "SELECT id FROM course_cache WHERE source_stage_id = $1", source_uuid
    )
    if not cache_row:
        raise HTTPException(status_code=403, detail="该课程不在缓存中，无法复制")

    # 读取源课程
    source_stage = await db.fetchrow(
        "SELECT * FROM stages WHERE id = $1", source_uuid
    )
    if not source_stage:
        raise HTTPException(status_code=404, detail="源课程不存在")

    # 1. 复制 stage（换 id 和 user_id）
    new_stage_id = uuid.uuid4()
    await db.execute(
        """INSERT INTO stages (id, user_id, name, description, language_directive, style,
           pending_outlines, generated_agent_configs, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8)""",
        new_stage_id, user_uuid,
        new_name or source_stage["name"],
        source_stage["description"],
        source_stage["language_directive"] or "zh-CN",
        source_stage["style"],
        source_stage["generated_agent_configs"],
        utcnow(),
    )

    # 2. 复制所有 scenes
    source_scenes = await db.fetch(
        """SELECT type, title, content, actions, whiteboards
           FROM scenes WHERE stage_id = $1 ORDER BY order_index""",
        source_uuid,
    )

    created_scenes = []
    for i, src in enumerate(source_scenes):
        scene_id = uuid.uuid4()
        await db.execute(
            """INSERT INTO scenes (id, stage_id, user_id, type, title, content, actions, whiteboards, order_index, created_at)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)""",
            scene_id, new_stage_id, user_uuid, src["type"], src["title"],
            src["content"], src["actions"], src["whiteboards"],
            i, utcnow(),
        )
        created_scenes.append({
            "id": str(scene_id),
            "type": src["type"],
            "title": src["title"],
        })

    logger.info(f"[CloneCourse] 从缓存复制课程 {source_stage_id} -> {new_stage_id}，共 {len(created_scenes)} 个场景")

    return {
        "id": str(new_stage_id),
        "name": new_name or source_stage["name"],
        "cloned_count": len(created_scenes),
        "scenes": created_scenes,
    }


@router.get("/supported-languages")
async def get_supported_languages():
    """获取支持的语言列表"""
    return {"languages": SUPPORTED_LANGUAGES}


@router.get("/supported-scene-types")
async def get_supported_scene_types():
    """获取支持的场景类型列表"""
    return {"scene_types": SUPPORTED_SCENE_TYPES}


@router.get("/limits")
async def get_limits():
    """获取系统限制配置"""
    return {
        "max_scenes_per_request": MAX_SCENES_PER_REQUEST,
        "supported_languages": SUPPORTED_LANGUAGES,
        "supported_scene_types": SUPPORTED_SCENE_TYPES,
    }


@router.get("/{classroom_id}/export-pdf")
async def export_classroom_pdf(
    classroom_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """导出课程为 PDF（含课程内容 + 个人笔记）"""
    from fastapi.responses import Response
    from app.services.pdf_export import generate_course_pdf

    classroom_uuid = validate_uuid(classroom_id, "课程ID")
    user_uuid = validate_uuid(current_user_id, "用户ID")

    # ── 复用 get_classroom 的数据查询逻辑 ──
    stage = await db.fetchrow(
        """
        SELECT s.id, s.name, s.description, s.language_directive, s.style, s.agent_ids,
               s.generated_agent_configs, s.pending_outlines, s.created_at, s.updated_at, s.user_id
        FROM stages s
        WHERE s.id = $1
        """,
        classroom_uuid
    )
    if stage is None:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # 权限检查
    is_owner = str(stage["user_id"]) == current_user_id
    if not is_owner:
        share = await db.fetchrow(
            "SELECT id FROM shared_classrooms WHERE stage_id = $1 AND is_public = TRUE",
            classroom_uuid
        )
        if not share:
            raise HTTPException(status_code=403, detail="该课程未公开")

    # 获取场景
    scenes = await db.fetch(
        """
        SELECT id, type, title, order_index, content, actions, whiteboards
        FROM scenes WHERE stage_id = $1 ORDER BY order_index
        """,
        classroom_uuid
    )

    # 学习进度
    completion = await db.fetchrow(
        "SELECT scenes_completed, total_scenes FROM course_completions WHERE user_id = $1 AND course_id = $2",
        user_uuid, classroom_uuid
    )
    scenes_completed = completion["scenes_completed"] if completion else 0

    # 解析 agent configs
    generated_agent_configs = None
    if stage["generated_agent_configs"]:
        if isinstance(stage["generated_agent_configs"], str):
            generated_agent_configs = json.loads(stage["generated_agent_configs"])
        else:
            generated_agent_configs = stage["generated_agent_configs"]

    # 组装 classroom 数据
    agents = []
    if generated_agent_configs:
        agents = generated_agent_configs

    classroom_data = {
        "stage": {
            "id": str(stage["id"]),
            "name": stage["name"],
            "description": stage["description"],
            "tags": [],
        },
        "scenes_completed": scenes_completed,
        "scenes": [
            {
                "id": str(s["id"]),
                "type": s["type"],
                "title": s["title"],
                "order_index": s["order_index"],
                "content": json.loads(s["content"]) if s["content"] and isinstance(s["content"], str) else s["content"],
            }
            for s in scenes
        ],
        "agents": agents,
    }

    # ── 查询关联笔记 ──
    note_rows = await db.fetch(
        """
        SELECT id, title, content, category, starred, color, tags, created_at
        FROM shared_notes
        WHERE course_id = $1 AND user_id = $2 AND is_personal = TRUE
        ORDER BY created_at DESC
        """,
        classroom_uuid, user_uuid
    )
    notes = []
    for r in note_rows:
        notes.append({
            "id": str(r["id"]),
            "title": r["title"],
            "content": r["content"],
            "category": r["category"] or "学习笔记",
            "starred": r["starred"] or False,
            "color": r["color"] or "coral",
            "tags": r["tags"].split(",") if r["tags"] else [],
            "created_at": r["created_at"].strftime("%Y-%m-%d %H:%M"),
        })

    # ── 生成 PDF ──
    pdf_bytes = await generate_course_pdf(classroom_data, notes)

    # 文件名安全化 + URL编码
    from urllib.parse import quote
    safe_name = stage["name"].replace(" ", "_")[:40] if stage["name"] else "course"
    filename = f"{safe_name}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"
        }
    )