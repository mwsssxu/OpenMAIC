"""
课程路由 - CRUD 操作（用户隔离）
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
import asyncpg
import uuid
from datetime import datetime

router = APIRouter()


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
        body.get("agent_ids"),
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
                "content": s["content"],
                "actions": s["actions"],
                "whiteboards": s["whiteboards"]
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