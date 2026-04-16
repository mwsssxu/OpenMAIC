"""
生成路由 - 大纲/场景/异步作业
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.services.generation.outline_generator import generate_outlines, stream_outlines
from app.services.generation.scene_generator import generate_full_scene
from app.core.config import settings
import asyncpg
import uuid
import json
import asyncio

router = APIRouter()


@router.post("/outlines")
async def generate_outlines_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """生成大纲（返回 JSON）"""
    requirement = body.get("requirement", "")
    pdf_content = body.get("pdf_content")
    language = body.get("language", "zh-CN")
    model = body.get("model", settings.DEFAULT_MODEL)

    outlines = await generate_outlines(
        requirement=requirement,
        pdf_content=pdf_content,
        language=language,
        model=model,
    )

    return {"outlines": [o.model_dump() for o in outlines]}


@router.post("/outlines-stream")
async def generate_outlines_stream_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """生成大纲（SSE 流式）"""
    requirement = body.get("requirement", "")
    pdf_content = body.get("pdf_content")
    language = body.get("language", "zh-CN")
    model = body.get("model", settings.DEFAULT_MODEL)

    async def event_stream():
        index = 0
        for outline in await stream_outlines(
            requirement=requirement,
            pdf_content=pdf_content,
            language=language,
            model=model,
        ):
            index += 1
            yield f"event: outline\ndata: {json.dumps(outline.model_dump())}\n\n"
            await asyncio.sleep(0.1)

        yield f"event: done\ndata: {json.dumps({'count': index})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )


@router.post("/scenes")
async def generate_scenes_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """生成场景内容"""
    outlines = body.get("outlines", [])
    language = body.get("language", "zh-CN")
    model = body.get("model", settings.DEFAULT_MODEL)

    scenes = []
    for outline in outlines:
        scene = await generate_full_scene(
            outline=outline,
            language=language,
            model=model,
        )
        scenes.append(scene)

    return {"scenes": scenes}


@router.post("/classroom")
async def generate_classroom_async(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """异步生成课程"""
    job_id = uuid.uuid4()

    # 创建作业记录
    await db.execute(
        """
        INSERT INTO generation_jobs (id, user_id, status, step, progress, message, input_summary)
        VALUES ($1, $2, 'queued', 'queued', 0, '作业已创建', $3)
        """,
        job_id,
        uuid.UUID(current_user_id),
        json.dumps({
            "requirement_preview": body.get("requirement", "")[:200],
            "language": body.get("language", "zh-CN")
        })
    )

    return {
        "job_id": str(job_id),
        "status": "queued",
        "poll_url": f"/generate/classroom/{job_id}"
    }


@router.get("/classroom/{job_id}")
async def get_generation_job(
    job_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """查询生成作业状态"""
    row = await db.fetchrow(
        """
        SELECT id, user_id, status, step, progress, message, result, error
        FROM generation_jobs
        WHERE id = $1 AND user_id = $2
        """,
        uuid.UUID(job_id),
        uuid.UUID(current_user_id)
    )

    if row is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": str(row["id"]),
        "status": row["status"],
        "step": row["step"],
        "progress": row["progress"],
        "message": row["message"],
        "result": row["result"],
        "error": row["error"]
    }