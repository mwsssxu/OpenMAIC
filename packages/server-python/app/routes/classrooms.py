"""
课程路由 - CRUD 操作（用户隔离）
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
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
import asyncpg
import uuid
import logging
import json
import time

router = APIRouter()
logger = logging.getLogger(__name__)


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
        SELECT id, name, description, language_directive, tags, created_at, updated_at
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
            "tags": row["tags"] if row["tags"] else [],
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
    tags = body.get("tags", [])  # 课程标签

    from app.core.time_utils import utcnow
    now = utcnow()

    await create_stage_record(
        stage_id=stage_id,
        user_uuid=user_uuid,
        name=name,
        description=description,
        language=language,
        agent_ids=agent_ids,
        tags=tags,
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

    # 验证用户所有权
    stage = await db.fetchrow(
        """
        SELECT id, name, description, language_directive, style, agent_ids, tags, generated_agent_configs, pending_outlines, created_at, updated_at
        FROM stages
        WHERE id = $1 AND user_id = $2
        """,
        classroom_uuid,
        user_uuid
    )

    if stage is None:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # 解析 tags
    tags = []
    if stage["tags"]:
        if isinstance(stage["tags"], str):
            tags = json.loads(stage["tags"])
        else:
            tags = stage["tags"]

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

    return {
        "stage": {
            "id": str(stage["id"]),
            "name": stage["name"],
            "description": stage["description"],
            "language_directive": stage["language_directive"],
            "style": stage["style"],
            "tags": tags,  # 课程标签
            "agent_ids": stage["agent_ids"],
            "generatedAgentConfigs": generated_agent_configs,
            "pendingOutlines": pending_outlines,  # 返回待创建的大纲
            "created_at": stage["created_at"].isoformat(),
            "updated_at": stage["updated_at"].isoformat()
        },
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
    tags = body.get("tags", [])  # 课程标签

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
        tags=tags,
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