"""Note Citations - 笔记引用课程内容

断裂点5修复：笔记与课程内容建立关联，形成学习闭环

功能：
1. 笔记可引用课程场景内容片段
2. 显示引用来源场景信息
3. 引用追踪统计（场景被引用次数）
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.time_utils import utcnow
import asyncpg
import uuid
import json
from app.db.database import get_db
from app.middleware.auth import get_current_user_id

router = APIRouter(tags=["note-citations"])


# ============ Models ============

class CitationCreate(BaseModel):
    note_id: str
    scene_id: str
    content_snippet: str  # 引用的内容片段
    citation_type: str = "direct"  # direct, paraphrase, summary
    position_start: Optional[int] = None  # 笔记内容中的位置
    position_end: Optional[int] = None
    context: Optional[str] = None  # 引用上下文说明


class CitationResponse(BaseModel):
    citation_id: str
    note_id: str
    scene_id: str
    scene_title: str
    course_id: str
    course_name: str
    content_snippet: str
    citation_type: str
    created_at: str


# ============ Routes ============

@router.post("/notes/{note_id}/citations")
async def add_citation(
    note_id: str,
    request: CitationCreate,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """为笔记添加引用"""
    user_uuid = uuid.UUID(user_id)
    note_uuid = uuid.UUID(note_id)
    scene_uuid = uuid.UUID(request.scene_id)

    # 验证笔记所有权
    note = await db.fetchrow(
        """
        SELECT id, user_id, content FROM shared_notes WHERE id = $1
        """,
        note_uuid
    )

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    if note["user_id"] != user_uuid:
        raise HTTPException(status_code=403, detail="只能为自己的笔记添加引用")

    # 验证场景存在
    scene = await db.fetchrow(
        """
        SELECT s.id, s.title, s.stage_id, st.name as course_name
        FROM scenes s
        JOIN stages st ON st.id = s.stage_id
        WHERE s.id = $1
        """,
        scene_uuid
    )

    if not scene:
        raise HTTPException(status_code=404, detail="场景不存在")

    # 检查是否已有相同引用
    existing = await db.fetchrow(
        """
        SELECT id FROM note_citations
        WHERE note_id = $1 AND scene_id = $2
        """,
        note_uuid, scene_uuid
    )

    if existing:
        raise HTTPException(status_code=400, detail="已引用此场景")

    # 创建引用记录
    citation_id = uuid.uuid4()

    await db.execute(
        """
        INSERT INTO note_citations
        (id, note_id, scene_id, course_id, content_snippet, citation_type,
         position_start, position_end, context, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """,
        citation_id, note_uuid, scene_uuid, scene["stage_id"],
        request.content_snippet, request.citation_type,
        request.position_start, request.position_end,
        request.context, utcnow()
    )

    # 更新场景引用计数
    await db.execute(
        """
        UPDATE scenes SET citation_count = COALESCE(citation_count, 0) + 1
        WHERE id = $1
        """,
        scene_uuid
    )

    return {
        "citation_id": str(citation_id),
        "note_id": str(note_uuid),
        "scene_id": str(scene_uuid),
        "scene_title": scene["title"],
        "course_name": scene["course_name"],
        "citation_type": request.citation_type,
        "message": "引用已添加"
    }


@router.get("/notes/{note_id}/citations")
async def get_note_citations(
    note_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取笔记的所有引用"""
    note_uuid = uuid.UUID(note_id)

    # 验证笔记存在
    note = await db.fetchrow(
        """
        SELECT id, user_id, visibility FROM shared_notes WHERE id = $1
        """,
        note_uuid
    )

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    # 获取引用列表
    citations = await db.fetch(
        """
        SELECT c.id, c.note_id, c.scene_id, c.course_id, c.content_snippet,
               c.citation_type, c.position_start, c.position_end, c.context,
               c.created_at, s.title as scene_title, st.name as course_name
        FROM note_citations c
        JOIN scenes s ON s.id = c.scene_id
        JOIN stages st ON st.id = c.course_id
        WHERE c.note_id = $1
        ORDER BY c.position_start ASC, c.created_at ASC
        """,
        note_uuid
    )

    return {
        "note_id": str(note_uuid),
        "citations": [
            {
                "citation_id": str(c["id"]),
                "scene_id": str(c["scene_id"]),
                "scene_title": c["scene_title"],
                "course_id": str(c["course_id"]),
                "course_name": c["course_name"],
                "content_snippet": c["content_snippet"],
                "citation_type": c["citation_type"],
                "position_start": c["position_start"],
                "position_end": c["position_end"],
                "context": c["context"],
                "created_at": c["created_at"].isoformat()
            }
            for c in citations
        ],
        "total_citations": len(citations)
    }


@router.get("/scenes/{scene_id}/citations")
async def get_scene_citations(
    scene_id: str,
    page: int = 1,
    limit: int = 20,
    db: asyncpg.Connection = Depends(get_db)
):
    """获取场景被引用的笔记列表"""
    scene_uuid = uuid.UUID(scene_id)
    offset = (page - 1) * limit

    # 验证场景存在
    scene = await db.fetchrow(
        """
        SELECT id, title, citation_count FROM scenes WHERE id = $1
        """,
        scene_uuid
    )

    if not scene:
        raise HTTPException(status_code=404, detail="场景不存在")

    # 获取引用此场景的笔记
    citations = await db.fetch(
        """
        SELECT c.id, c.note_id, c.content_snippet, c.citation_type, c.created_at,
               n.title as note_title, n.visibility, u.nickname as author_name
        FROM note_citations c
        JOIN shared_notes n ON n.id = c.note_id
        JOIN users u ON u.id = n.user_id
        WHERE c.scene_id = $1 AND n.status = 'published'
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3
        """,
        scene_uuid, limit, offset
    )

    return {
        "scene_id": str(scene_uuid),
        "scene_title": scene["title"],
        "citation_count": scene["citation_count"] or 0,
        "citations": [
            {
                "citation_id": str(c["id"]),
                "note_id": str(c["note_id"]),
                "note_title": c["note_title"],
                "author_name": c["author_name"],
                "visibility": c["visibility"],
                "content_snippet": c["content_snippet"],
                "citation_type": c["citation_type"],
                "created_at": c["created_at"].isoformat()
            }
            for c in citations
        ],
        "pagination": {
            "page": page,
            "limit": limit
        }
    }


@router.get("/courses/{course_id}/citation-stats")
async def get_course_citation_stats(
    course_id: str,
    db: asyncpg.Connection = Depends(get_db)
):
    """获取课程内容被引用统计"""
    course_uuid = uuid.UUID(course_id)

    # 获取课程的场景引用统计
    stats = await db.fetch(
        """
        SELECT s.id, s.title, s.order_index, s.citation_count
        FROM scenes s
        WHERE s.stage_id = $1
        ORDER BY s.citation_count DESC NULLS LAST, s.order_index ASC
        """,
        course_uuid
    )

    # 总引用数
    total_citations = await db.fetchval(
        """
        SELECT COUNT(*) FROM note_citations WHERE course_id = $1
        """,
        course_uuid
    )

    # 引用最多的场景
    top_scene = stats[0] if stats else None

    return {
        "course_id": str(course_uuid),
        "total_citations": total_citations or 0,
        "scenes": [
            {
                "scene_id": str(s["id"]),
                "scene_title": s["title"],
                "order_index": s["order_index"],
                "citation_count": s["citation_count"] or 0
            }
            for s in stats
        ],
        "top_cited_scene": {
            "scene_id": str(top_scene["id"]),
            "scene_title": top_scene["title"],
            "citation_count": top_scene["citation_count"] or 0
        } if top_scene else None
    }


@router.delete("/notes/{note_id}/citations/{citation_id}")
async def delete_citation(
    note_id: str,
    citation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """删除引用"""
    user_uuid = uuid.UUID(user_id)
    note_uuid = uuid.UUID(note_id)
    citation_uuid = uuid.UUID(citation_id)

    # 验证引用存在且属于用户
    citation = await db.fetchrow(
        """
        SELECT c.id, c.note_id, c.scene_id, n.user_id
        FROM note_citations c
        JOIN shared_notes n ON n.id = c.note_id
        WHERE c.id = $1 AND c.note_id = $2
        """,
        citation_uuid, note_uuid
    )

    if not citation:
        raise HTTPException(status_code=404, detail="引用不存在")

    if citation["user_id"] != user_uuid:
        raise HTTPException(status_code=403, detail="只能删除自己笔记的引用")

    # 删除引用
    await db.execute(
        """
        DELETE FROM note_citations WHERE id = $1
        """,
        citation_uuid
    )

    # 更新场景引用计数
    await db.execute(
        """
        UPDATE scenes SET citation_count = GREATEST(0, COALESCE(citation_count, 1) - 1)
        WHERE id = $1
        """,
        citation["scene_id"]
    )

    return {
        "citation_id": str(citation_uuid),
        "message": "引用已删除"
    }