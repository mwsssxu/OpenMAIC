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
        SELECT id, name, description, language_directive, created_at, updated_at
        FROM stages
        WHERE user_id = $1
        ORDER BY updated_at DESC
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
            "updated_at": row["updated_at"].isoformat()
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

    # 解析 generated_agent_configs
    generated_agent_configs = None
    if stage["generated_agent_configs"]:
        if isinstance(stage["generated_agent_configs"], str):
            generated_agent_configs = json.loads(stage["generated_agent_configs"])
        else:
            generated_agent_configs = stage["generated_agent_configs"]

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

    # 查找分享记录
    share = await db.fetchrow(
        "SELECT id FROM shared_classrooms WHERE stage_id = $1",
        classroom_uuid
    )
    if not share:
        raise HTTPException(status_code=404, detail="课程未分享")

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

    classroom_uuid = validate_uuid(classroom_id, "课程ID")
    user_uuid = validate_uuid(current_user_id, "用户ID")

    stage = await db.fetchrow(
        "SELECT id, name, language_directive, generated_agent_configs FROM stages WHERE id = $1 AND user_id = $2",
        classroom_uuid,
        user_uuid
    )
    if stage is None:
        raise HTTPException(status_code=404, detail="课程不存在")

    outlines = body.outlines
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
    )

    total_elapsed = time.time() - start_time
    logger.info(f"[SceneCreateAll] 全部场景创建完成 (耗时: {total_elapsed:.2f}s)")

    await db.execute(
        "UPDATE stages SET pending_outlines = NULL WHERE id = $1", classroom_uuid
    )

    return {
        "scenes": scenes,
        "elapsed_seconds": round(total_elapsed, 2)
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