"""
媒体路由 - 上传/获取媒体文件
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
import asyncpg
import uuid

router = APIRouter()


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    stage_id: str = None,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """上传媒体文件到 OSS"""
    # TODO: 实现阿里云 OSS 上传
    file_id = uuid.uuid4()

    # 模拟 OSS URL
    oss_key = f"{current_user_id}/{file_id}"

    # 保存记录
    await db.execute(
        """
        INSERT INTO media_files (id, user_id, stage_id, type, oss_key, mime_type, size)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        file_id,
        uuid.UUID(current_user_id),
        uuid.UUID(stage_id) if stage_id else None,
        file.content_type.split("/")[0],  # 'image', 'video', 'audio'
        oss_key,
        file.content_type,
        file.size
    )

    return {
        "id": str(file_id),
        "url": f"https://oss.example.com/{oss_key}",
        "mime_type": file.content_type,
        "size": file.size
    }


@router.get("/{media_id}")
async def get_media(
    media_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取媒体文件信息"""
    row = await db.fetchrow(
        """
        SELECT id, user_id, oss_key, mime_type, size
        FROM media_files
        WHERE id = $1 AND user_id = $2
        """,
        uuid.UUID(media_id),
        uuid.UUID(current_user_id)
    )

    if row is None:
        raise HTTPException(status_code=404, detail="Media not found")

    return {
        "id": str(row["id"]),
        "url": f"https://oss.example.com/{row['oss_key']}",
        "mime_type": row["mime_type"],
        "size": row["size"]
    }