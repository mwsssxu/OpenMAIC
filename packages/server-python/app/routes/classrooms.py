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

    # 验证用户所有权
    stage = await db.fetchrow(
        """
        SELECT id, name, description, language_directive, style, agent_ids, created_at, updated_at
        FROM stages
        WHERE id = $1 AND user_id = $2
        """,
        classroom_uuid,
        user_uuid
    )

    if stage is None:
        raise HTTPException(status_code=404, detail="Classroom not found")

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

    return {
        "stage": {
            "id": str(stage["id"]),
            "name": stage["name"],
            "description": stage["description"],
            "language_directive": stage["language_directive"],
            "style": stage["style"],
            "agent_ids": stage["agent_ids"],
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
    创建完整课程（包含大纲生成幻灯片内容）

    请求体参数:
    - outlines: 大纲列表（必填）
    - name: 课程名称
    - description: 课程描述
    - language: 语言设置 (zh-CN, en-US, ja-JP, ko-KR)
    - agent_ids: 智能体 ID 列表
    - tts_provider: TTS 提供商 (openai, minimax)
    - tts_voice: TTS 语音 ID
    """
    start_time = time.time()

    # 1. 参数验证
    outlines = body.get("outlines", [])
    if not outlines:
        raise HTTPException(status_code=400, detail="大纲列表不能为空")

    # 验证大纲数量
    scene_count = validate_scene_count(len(outlines))
    if scene_count != len(outlines):
        logger.warning(f"[Create] 大纲数量限制: {len(outlines)} -> {scene_count}")
        outlines = outlines[:scene_count]

    user_uuid = validate_uuid(current_user_id, "用户ID")

    # 验证语言参数
    language = validate_language(body.get("language", "zh-CN"))

    # 提取其他参数
    name = body.get("name", "新课程")
    description = body.get("description")
    agent_ids = body.get("agent_ids", [])
    tts_provider = body.get("tts_provider", "openai")
    tts_voice = body.get("tts_voice", "alloy")

    logger.info(f"[Create] 开始创建课程 - name={name}, scenes={len(outlines)}, lang={language}")

    stage_id = uuid.uuid4()

    # 2. 使用事务创建课程和场景
    async with db.transaction():
        # 创建课程记录
        await create_stage_record(
            stage_id=stage_id,
            user_uuid=user_uuid,
            name=name,
            description=description,
            language=language,
            agent_ids=agent_ids,
            db=db
        )

        # 批量创建场景
        scenes = await create_all_scenes(
            outlines=outlines,
            stage_id=stage_id,
            user_uuid=user_uuid,
            db=db,
            language=language,
            tts_provider=tts_provider,
            tts_voice=tts_voice
        )

    total_elapsed = time.time() - start_time
    logger.info(f"[Create] 课程创建完成 - {len(scenes)} 个场景 (总耗时: {total_elapsed:.2f}s)")

    return {
        "id": str(stage_id),
        "name": name,
        "scenes_count": len(scenes),
        "language": language,
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