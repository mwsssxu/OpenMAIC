"""
课程路由 - CRUD 操作（用户隔离）
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.services.generation.scene_generator import generate_full_scene
from app.services.generation.outline_generator import SceneOutline
import asyncpg
import uuid
from datetime import datetime
from app.core.time_utils import utcnow
from app.core.config import settings
import logging
import json
import time

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("")
async def list_classrooms(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取用户课程列表"""
    rows = await db.fetch(
        """
        SELECT id, name, description, language_directive, created_at, updated_at
        FROM stages
        WHERE user_id = $1
        ORDER BY updated_at DESC
        """,
        uuid.UUID(current_user_id)
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
    stage_id = uuid.uuid4()
    now = utcnow()

    # agent_ids 是 JSONB 字段，需要转换为 JSON 字符串
    agent_ids = body.get("agent_ids")
    agent_ids_json = json.dumps(agent_ids) if agent_ids else None

    await db.execute(
        """
        INSERT INTO stages (id, user_id, name, description, language_directive, style, agent_ids, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        stage_id,
        uuid.UUID(current_user_id),
        body.get("name", "新课程"),
        body.get("description"),
        body.get("language_directive"),
        body.get("style"),
        agent_ids_json,
        now,
        now
    )

    return {
        "id": str(stage_id),
        "name": body.get("name", "新课程"),
        "created_at": now.isoformat()
    }


@router.get("/{classroom_id}")
async def get_classroom(
    classroom_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取课程详情（包含场景）"""
    # 验证用户所有权
    stage = await db.fetchrow(
        """
        SELECT id, name, description, language_directive, style, agent_ids, created_at, updated_at
        FROM stages
        WHERE id = $1 AND user_id = $2
        """,
        uuid.UUID(classroom_id),
        uuid.UUID(current_user_id)
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
        uuid.UUID(classroom_id)
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
    # 验证用户所有权
    result = await db.execute(
        """
        DELETE FROM stages
        WHERE id = $1 AND user_id = $2
        """,
        uuid.UUID(classroom_id),
        uuid.UUID(current_user_id)
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
    """创建完整课程（包含大纲生成幻灯片内容）"""
    start_time = time.time()

    # 参数验证
    outlines = body.get("outlines", [])
    if not outlines:
        raise HTTPException(status_code=400, detail="大纲列表不能为空")

    # 验证 user_id 格式
    try:
        user_uuid = uuid.UUID(current_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="用户ID格式无效")

    stage_id = uuid.uuid4()
    now = utcnow()

    name = body.get("name", "新课程")
    description = body.get("description")
    language = body.get("language", "zh-CN")
    agent_ids = body.get("agent_ids", [])

    logger.info(f"[Create] 开始创建课程 - name={name}, outlines={len(outlines)}")

    # 1. 创建课程
    agent_ids_json = json.dumps(agent_ids) if agent_ids else None

    await db.execute(
        """
        INSERT INTO stages (id, user_id, name, description, language_directive, style, agent_ids, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        stage_id,
        uuid.UUID(current_user_id),
        name,
        description,
        language,
        None,
        agent_ids_json,
        now,
        now
    )

    # 2. 根据大纲生成幻灯片内容
    scenes = []
    for i, outline in enumerate(outlines):
        scene_start = time.time()
        try:
            scene_id = uuid.uuid4()

            scene_type = outline.get("type", "slide")
            scene_title = outline.get("title", f"场景 {i+1}")
            scene_desc = outline.get("description", "")
            key_points = outline.get("key_points", [])

            # 如果没有 key_points，根据标题生成上下文相关要点
            if not key_points:
                # 使用场景标题和描述生成相关要点
                base_topic = scene_title.replace("课程", "").replace("学习", "").strip()
                if scene_type == "quiz":
                    key_points = [f"{base_topic}基础测试", f"{base_topic}进阶挑战", "学习效果评估"]
                elif scene_type == "interactive":
                    key_points = [f"{base_topic}互动讨论", f"{base_topic}案例分析", "答疑解惑"]
                elif scene_type == "pbl":
                    key_points = [f"{base_topic}项目任务", f"{base_topic}实践操作", "成果展示"]
                else:  # slide
                    key_points = [f"{base_topic}概述", f"{base_topic}核心内容", f"{base_topic}要点总结"]

            # 构建幻灯片内容
            content = {
                "type": scene_type,
                "canvas": {
                    "width": 1000,
                    "height": 562,
                    "background": "#ffffff",
                    "elements": [
                        {
                            "id": "title",
                            "type": "text",
                            "content": scene_title,
                            "position": {"left": 50, "top": 30, "width": 900, "height": 60},
                            "style": {"fontSize": 36, "fontWeight": "bold", "color": "#333333"}
                        },
                        {
                            "id": "desc",
                            "type": "text",
                            "content": scene_desc,
                            "position": {"left": 50, "top": 100, "width": 900, "height": 80},
                            "style": {"fontSize": 18, "color": "#666666"}
                        }
                    ]
                }
            }

            # 添加要点元素
            for j, point in enumerate(key_points[:5]):
                content["canvas"]["elements"].append({
                    "id": f"point_{j}",
                    "type": "text",
                    "content": f"• {point}",
                    "position": {"left": 50, "top": 200 + j * 50, "width": 900, "height": 40},
                    "style": {"fontSize": 16, "color": "#444444"}
                })

            # 讲解行为
            actions = [
                {
                    "id": "action_1",
                    "type": "speech",
                    "data": {"text": f"现在我们来学习{scene_title}。{scene_desc}"}
                }
            ]

            content_json = json.dumps(content)
            actions_json = json.dumps(actions)

            await db.execute(
                """
                INSERT INTO scenes (id, stage_id, user_id, type, title, order_index, content, actions, whiteboards)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """,
                scene_id,
                stage_id,
                user_uuid,
                scene_type,
                scene_title,
                i + 1,
                content_json,
                actions_json,
                None
            )

            scene_elapsed = time.time() - scene_start
            logger.info(f"[Create] 幻灯片 #{i+1}: {scene_title} (耗时: {scene_elapsed:.2f}s)")

            scenes.append({
                "id": str(scene_id),
                "type": scene_type,
                "title": scene_title,
                "order_index": i + 1,
                "content": content,
                "actions": actions,
            })

        except Exception as e:
            logger.warning(f"[Create] 幻灯片 #{i+1} 失败: {e}")
            # 失败时创建空白幻灯片
            scene_id = uuid.uuid4()
            content_json = json.dumps({"type": "slide", "canvas": {"elements": []}})
            actions_json = json.dumps([])

            await db.execute(
                """
                INSERT INTO scenes (id, stage_id, user_id, type, title, order_index, content, actions, whiteboards)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """,
                scene_id,
                stage_id,
                user_uuid,
                outline.get("type", "slide"),
                outline.get("title", f"场景 {i+1}"),
                i + 1,
                content_json,
                actions_json,
                None
            )

            scenes.append({
                "id": str(scene_id),
                "type": outline.get("type", "slide"),
                "title": outline.get("title", f"场景 {i+1}"),
                "order_index": i + 1,
                "content": {"type": "slide", "canvas": {"elements": []}},
                "actions": [],
            })

    total_elapsed = time.time() - start_time
    logger.info(f"[Create] 课程创建完成 - {len(scenes)} 个幻灯片 (总耗时: {total_elapsed:.2f}s)")

    return {
        "id": str(stage_id),
        "name": name,
        "scenes_count": len(scenes),
        "created_at": now.isoformat(),
        "elapsed_seconds": round(total_elapsed, 2)
    }