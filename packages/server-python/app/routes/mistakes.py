"""Mistake review API — 错题复习

GET  /mistakes/today          → 今日待复习（默认 10 题，移动端一屏一题轮播）
POST /mistakes/{id}/answer    → 提交一次答题，自动更新 streak / 触发奖励
GET  /mistakes/stats          → 统计（total / mastered / due）
GET  /mistakes/list           → 完整错题列表（管理后台/全部错题页）
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import asyncpg
import uuid

from app.db.database import get_db
from app.middleware.auth import get_current_user_id
from app.services import mistake_service

router = APIRouter(prefix="/mistakes", tags=["mistakes"])


class AnswerRequest(BaseModel):
    answer: str


@router.get("/today")
async def today_mistakes(
    limit: int = Query(10, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    """获取今日待复习的错题。"""
    user_uuid = uuid.UUID(user_id)
    items = await mistake_service.fetch_due_mistakes(db, user_uuid, limit=limit)
    stats = await mistake_service.get_review_stats(db, user_uuid)
    return {
        "items": items,
        "stats": stats,
    }


@router.get("/stats")
async def stats_mistakes(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    """获取错题本统计（用于首页 Banner 决定是否显示）。"""
    user_uuid = uuid.UUID(user_id)
    return await mistake_service.get_review_stats(db, user_uuid)


@router.post("/{mistake_id}/answer")
async def answer_mistake(
    mistake_id: str,
    request: AnswerRequest,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    """复习时提交一次答题。

    - 答对：streak +1，连续 2 次答对即标记掌握
    - 答错：streak 清零，记入 wrong_count
    - 复习答对触发 1 积分奖励（轻度激励，避免刷）
    """
    user_uuid = uuid.UUID(user_id)
    try:
        mistake_uuid = uuid.UUID(mistake_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid mistake id")

    try:
        result = await mistake_service.submit_review_answer(
            db, user_uuid, mistake_uuid, request.answer
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="mistake not found")

    # 答对 → 触发轻度积分（与一次性 assessment 大额积分区分）
    earned_points = 0
    new_balance: Optional[int] = None
    if result["is_correct"]:
        from app.services.gamification_events import grant_points
        earned_points = 2 if result["mastered"] else 1
        new_balance = await grant_points(
            db, user_uuid, earned_points,
            source="mistake_review",
            context={"mistake_id": mistake_id, "mastered": result["mastered"]},
        )

    return {
        **result,
        "earned_points": earned_points,
        "new_balance": new_balance,
    }


@router.get("/list")
async def list_mistakes(
    course_id: Optional[str] = None,
    only_unmastered: bool = True,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    """完整错题列表（带过滤）。"""
    user_uuid = uuid.UUID(user_id)

    # 动态条件
    conditions = ["user_id = $1"]
    params: list = [user_uuid]
    if only_unmastered:
        conditions.append("mastered = FALSE")
    if course_id:
        try:
            conditions.append(f"course_id = ${len(params) + 1}")
            params.append(uuid.UUID(course_id))
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid course_id")

    params.extend([limit, offset])
    where_clause = " AND ".join(conditions)
    rows = await db.fetch(
        f"""
        SELECT id, course_id, question_id, question_snapshot,
               attempt_count, wrong_count, correct_streak, mastered,
               next_review_at, last_reviewed_at, first_wrong_at
        FROM mistake_records
        WHERE {where_clause}
        ORDER BY mastered ASC, next_review_at ASC
        LIMIT ${len(params) - 1} OFFSET ${len(params)}
        """,
        *params,
    )
    import json as _json
    out = []
    for r in rows:
        snapshot = r["question_snapshot"]
        if isinstance(snapshot, str):
            snapshot = _json.loads(snapshot)
        out.append({
            "id": str(r["id"]),
            "course_id": str(r["course_id"]) if r["course_id"] else None,
            "question_id": r["question_id"],
            "question": snapshot,
            "attempt_count": r["attempt_count"],
            "wrong_count": r["wrong_count"],
            "correct_streak": r["correct_streak"],
            "mastered": r["mastered"],
            "next_review_at": r["next_review_at"].isoformat() if r["next_review_at"] else None,
            "last_reviewed_at": r["last_reviewed_at"].isoformat() if r["last_reviewed_at"] else None,
            "first_wrong_at": r["first_wrong_at"].isoformat() if r["first_wrong_at"] else None,
        })
    return {"items": out}
