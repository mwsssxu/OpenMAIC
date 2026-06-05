"""
Admin API routes for OpenMAIC business platform.
Provides endpoints for admin dashboard operations.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta
import asyncpg
from app.db.database import get_db
from app.routes.admin_auth import get_current_admin, check_permission

router = APIRouter(prefix="/admin", tags=["admin"])


# ============ Dashboard Stats ============

@router.get("/stats")
async def get_dashboard_stats(
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get dashboard overview statistics."""
    today = datetime.now().date()

    # Get user stats
    total_users = await db.fetchval("SELECT COUNT(*) FROM users")
    new_today = await db.fetchval(
        "SELECT COUNT(*) FROM users WHERE DATE(created_at) = $1", today
    )
    # Active users (users who logged in today - would need a sessions table)
    active_today = await db.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM token_transactions WHERE DATE(created_at) = $1",
        today
    ) or 0

    # Get course stats (table name is 'stages' not 'classrooms')
    total_courses = await db.fetchval("SELECT COUNT(*) FROM stages")
    generated_today = await db.fetchval(
        "SELECT COUNT(*) FROM stages WHERE DATE(created_at) = $1", today
    ) or 0

    # Get economy stats (field name is 'type' not 'transaction_type')
    revenue_today = await db.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM token_transactions "
        "WHERE type = 'purchase' AND DATE(created_at) = $1",
        today
    ) or 0
    tokens_purchased = await db.fetchval(
        "SELECT COALESCE(SUM(tokens), 0) FROM token_transactions "
        "WHERE type = 'purchase' AND DATE(created_at) = $1",
        today
    ) or 0
    points_earned = await db.fetchval(
        "SELECT COALESCE(SUM(points), 0) FROM point_transactions "
        "WHERE type = 'earn' AND DATE(created_at) = $1",
        today
    ) or 0

    return {
        "users": {
            "total": total_users or 0,
            "new_today": new_today or 0,
            "active_today": active_today
        },
        "courses": {
            "total": total_courses or 0,
            "generated_today": generated_today
        },
        "economy": {
            "revenue_today": revenue_today,
            "tokens_purchased": tokens_purchased,
            "points_earned": points_earned
        }
    }


# ============ User Management ============

@router.get("/users")
async def list_users(
    search: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """List users with search and filter."""
    # SECURITY: Field names in conditions are hardcoded (not user input)
    # When adding new filter fields, ensure they are from ALLOWED_FILTER_FIELDS
    ALLOWED_FILTER_FIELDS = {"email", "nickname", "subscription_tier", "is_active"}
    conditions = []
    params = []

    if search:
        conditions.append("(email ILIKE $1 OR nickname ILIKE $1)")
        params.append(f"%{search}%")

    if tier:
        conditions.append("subscription_tier = $" + str(len(params) + 1))
        params.append(tier)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    params.extend([limit, offset])

    users = await db.fetch(
        f"""
        SELECT id, email, nickname, avatar_url, total_points,
               created_at, is_active
        FROM users
        WHERE {where_clause}
        ORDER BY created_at DESC
        LIMIT ${len(params) - 1} OFFSET ${len(params)}
        """,
        *params
    )

    return {
        "data": [dict(u) for u in users],
        "total": len(users)
    }


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get single user by ID."""
    user = await db.fetchrow(
        """
        SELECT id, email, nickname, avatar_url, total_points,
               created_at, is_active
        FROM users
        WHERE id = $1
        """,
        user_id
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Convert to dict and handle datetime serialization
    user_dict = dict(user)
    if user_dict.get("created_at"):
        user_dict["created_at"] = user_dict["created_at"].isoformat()

    return {"data": user_dict}


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Ban a user account."""
    await db.execute(
        "UPDATE users SET is_active = false WHERE id = $1", user_id
    )

    # Log action
    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'user_ban', $2, '禁用用户账号', $3)
        """,
        admin["id"], user_id, datetime.now()
    )

    return {"success": True}


@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: str,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Unban a user account."""
    await db.execute(
        "UPDATE users SET is_active = true WHERE id = $1", user_id
    )

    # Log action
    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'user_unban', $2, '启用用户账号', $3)
        """,
        admin["id"], user_id, datetime.now()
    )

    return {"success": True}


@router.post("/users/{user_id}/gift-tokens")
async def gift_tokens(
    user_id: str,
    amount: int,
    reason: str = "管理员赠送",
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Gift tokens to a user."""
    await db.execute(
        "UPDATE users SET token_balance = token_balance + $1 WHERE id = $2",
        amount, user_id
    )

    # Log transaction
    await db.execute(
        """
        INSERT INTO token_transactions (user_id, tokens, transaction_type, description, created_at)
        VALUES ($1, $2, 'gift', $3, $4)
        """,
        user_id, amount, reason, datetime.now()
    )

    # Log admin action
    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'gift_tokens', $2, $3, $4)
        """,
        admin["id"], user_id, f"赠送{amount}Token", datetime.now()
    )

    return {"success": True}


@router.post("/users/{user_id}/gift-points")
async def gift_points(
    user_id: str,
    amount: int,
    reason: str = "管理员赠送",
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Gift points to a user."""
    await db.execute(
        "UPDATE users SET point_balance = point_balance + $1 WHERE id = $2",
        amount, user_id
    )

    # Log transaction
    await db.execute(
        """
        INSERT INTO point_transactions (user_id, points, transaction_type, description, created_at)
        VALUES ($1, $2, 'gift', $3, $4)
        """,
        user_id, amount, reason, datetime.now()
    )

    # Log admin action
    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'gift_points', $2, $3, $4)
        """,
        admin["id"], user_id, f"赠送{amount}积分", datetime.now()
    )

    return {"success": True}


# ============ Course Management ============

@router.get("/courses")
async def list_courses(
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """List courses (stages) for admin."""
    conditions = []
    params = []

    if search:
        conditions.append("name ILIKE $" + str(len(params) + 1))
        params.append(f"%{search}%")

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    params.extend([limit, offset])

    courses = await db.fetch(
        f"""
        SELECT s.id, s.name as title, s.description, s.user_id as creator_id,
               s.created_at, s.updated_at
        FROM stages s
        WHERE {where_clause}
        ORDER BY s.created_at DESC
        LIMIT ${len(params) - 1} OFFSET ${len(params)}
        """,
        *params
    )

    # Convert to list of dicts
    course_list = []
    for c in courses:
        course_dict = dict(c)
        course_dict["chapters_count"] = 0  # Placeholder
        if course_dict.get("created_at"):
            course_dict["created_at"] = course_dict["created_at"].isoformat()
        if course_dict.get("updated_at"):
            course_dict["updated_at"] = course_dict["updated_at"].isoformat()
        course_list.append(course_dict)

    return {
        "data": course_list,
        "total": len(course_list)
    }


@router.get("/courses/{course_id}")
async def get_course(
    course_id: str,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get single course (stage) by ID."""
    course = await db.fetchrow(
        """
        SELECT s.id, s.name as title, s.description, s.user_id as creator_id,
               s.created_at, s.updated_at
        FROM stages s
        WHERE s.id = $1
        """,
        course_id
    )

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course_dict = dict(course)
    course_dict["chapters_count"] = 0
    course_dict["total_duration"] = 0
    if course_dict.get("created_at"):
        course_dict["created_at"] = course_dict["created_at"].isoformat()
    if course_dict.get("updated_at"):
        course_dict["updated_at"] = course_dict["updated_at"].isoformat()

    return {"data": course_dict}


# ============ Content Review ============

@router.get("/content/questions")
async def list_questions_for_review(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """List questions for content review."""
    conditions = []
    params = []

    if search:
        conditions.append("title ILIKE $" + str(len(params) + 1))
        params.append(f"%{search}%")

    if status:
        conditions.append("review_status = $" + str(len(params) + 1))
        params.append(status)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    params.extend([limit, offset])

    questions = await db.fetch(
        f"""
        SELECT q.id, q.title, q.content, q.classroom_id, q.review_status,
               u.nickname, u.email, q.created_at
        FROM questions q
        JOIN users u ON q.user_id = u.id
        WHERE {where_clause}
        ORDER BY q.created_at DESC
        LIMIT ${len(params) - 1} OFFSET ${len(params)}
        """,
        *params
    )

    return {
        "questions": [
            {
                "id": q["id"],
                "title": q["title"],
                "content": q["content"],
                "classroom_id": q["classroom_id"],
                "status": q["review_status"],
                "author": {"nickname": q["nickname"], "email": q["email"]},
                "created_at": q["created_at"].isoformat()
            }
            for q in questions
        ]
    }


@router.post("/content/questions/{question_id}/approve")
async def approve_question(
    question_id: str,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Approve a question."""
    await db.execute(
        "UPDATE questions SET review_status = 'approved' WHERE id = $1",
        question_id
    )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_approve', $2, '审核通过问题', $3)
        """,
        admin["id"], question_id, datetime.now()
    )

    return {"success": True}


@router.post("/content/questions/{question_id}/reject")
async def reject_question(
    question_id: str,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Reject a question."""
    await db.execute(
        "UPDATE questions SET review_status = 'rejected' WHERE id = $1",
        question_id
    )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_reject', $2, '审核拒绝问题', $3)
        """,
        admin["id"], question_id, datetime.now()
    )

    return {"success": True}


@router.get("/content/answers")
async def list_answers_for_review(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """List answers for content review."""
    conditions = []
    params = []

    if search:
        conditions.append("content ILIKE $" + str(len(params) + 1))
        params.append(f"%{search}%")

    if status:
        conditions.append("review_status = $" + str(len(params) + 1))
        params.append(status)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    params.append(limit)

    answers = await db.fetch(
        f"""
        SELECT a.id, a.content, a.question_id, a.review_status,
               u.nickname, u.email, q.title as question_title, a.created_at
        FROM answers a
        JOIN users u ON a.user_id = u.id
        JOIN questions q ON a.question_id = q.id
        WHERE {where_clause}
        ORDER BY a.created_at DESC
        LIMIT ${len(params)}
        """,
        *params
    )

    return {
        "answers": [
            {
                "id": a["id"],
                "content": a["content"],
                "question_id": a["question_id"],
                "question_title": a["question_title"],
                "status": a["review_status"],
                "author": {"nickname": a["nickname"], "email": a["email"]},
                "created_at": a["created_at"].isoformat()
            }
            for a in answers
        ]
    }


@router.post("/content/answers/{answer_id}/approve")
async def approve_answer(
    answer_id: str,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Approve an answer."""
    await db.execute(
        "UPDATE answers SET review_status = 'approved' WHERE id = $1",
        answer_id
    )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_approve', $2, '审核通过回答', $3)
        """,
        admin["id"], answer_id, datetime.now()
    )

    return {"success": True}


@router.post("/content/answers/{answer_id}/reject")
async def reject_answer(
    answer_id: str,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Reject an answer."""
    await db.execute(
        "UPDATE answers SET review_status = 'rejected' WHERE id = $1",
        answer_id
    )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_reject', $2, '审核拒绝回答', $3)
        """,
        admin["id"], answer_id, datetime.now()
    )

    return {"success": True}


@router.get("/content/notes")
async def list_notes_for_review(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """List notes for content review."""
    conditions = []
    params = []

    if search:
        conditions.append("title ILIKE $" + str(len(params) + 1))
        params.append(f"%{search}%")

    if status:
        conditions.append("review_status = $" + str(len(params) + 1))
        params.append(status)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    params.append(limit)

    notes = await db.fetch(
        f"""
        SELECT n.id, n.title, n.content, n.classroom_id, n.likes, n.review_status,
               u.nickname, u.email, n.created_at
        FROM notes n
        JOIN users u ON n.user_id = u.id
        WHERE {where_clause}
        ORDER BY n.created_at DESC
        LIMIT ${len(params)}
        """,
        *params
    )

    return {
        "notes": [
            {
                "id": n["id"],
                "title": n["title"],
                "content": n["content"],
                "classroom_id": n["classroom_id"],
                "likes": n["likes"],
                "status": n["review_status"],
                "author": {"nickname": n["nickname"], "email": n["email"]},
                "created_at": n["created_at"].isoformat()
            }
            for n in notes
        ]
    }


@router.post("/content/notes/{note_id}/approve")
async def approve_note(
    note_id: str,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Approve a note."""
    await db.execute(
        "UPDATE notes SET review_status = 'approved' WHERE id = $1",
        note_id
    )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_approve', $2, '审核通过笔记', $3)
        """,
        admin["id"], note_id, datetime.now()
    )

    return {"success": True}


@router.post("/content/notes/{note_id}/reject")
async def reject_note(
    note_id: str,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Reject a note."""
    await db.execute(
        "UPDATE notes SET review_status = 'rejected' WHERE id = $1",
        note_id
    )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_reject', $2, '审核拒绝笔记', $3)
        """,
        admin["id"], note_id, datetime.now()
    )

    return {"success": True}


# ============ Statistics ============

@router.get("/statistics/users")
async def get_user_statistics(
    days: int = Query(7, le=30),
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user statistics."""
    today = datetime.now().date()
    start_date = today - timedelta(days=days)

    # Total users
    total = await db.fetchval("SELECT COUNT(*) FROM users")

    # New today
    new_today = await db.fetchval(
        "SELECT COUNT(*) FROM users WHERE DATE(created_at) = $1", today
    )

    # Active today
    active_today = await db.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM token_transactions WHERE DATE(created_at) = $1",
        today
    ) or 0

    # Tier distribution
    tiers = await db.fetch(
        """
        SELECT subscription_tier, COUNT(*) as count
        FROM users
        GROUP BY subscription_tier
        ORDER BY count DESC
        """
    )

    # Growth trend
    growth = await db.fetch(
        """
        SELECT DATE(created_at) as date,
               COUNT(*) as new_users
        FROM users
        WHERE DATE(created_at) >= $1
        GROUP BY DATE(created_at)
        ORDER BY date
        """,
        start_date
    )

    # Get active users per day
    active_per_day = await db.fetch(
        """
        SELECT DATE(created_at) as date,
               COUNT(DISTINCT user_id) as active_users
        FROM token_transactions
        WHERE DATE(created_at) >= $1
        GROUP BY DATE(created_at)
        ORDER BY date
        """,
        start_date
    )

    # Merge growth and active data
    growth_data = []
    for g in growth:
        date_str = g["date"].isoformat()
        active = next((a["active_users"] for a in active_per_day if a["date"] == g["date"]), 0)
        growth_data.append({
            "date": date_str,
            "new_users": g["new_users"],
            "active_users": active
        })

    return {
        "total": total or 0,
        "new_today": new_today or 0,
        "active_today": active_today,
        "tier_distribution": [
            {"tier": t["subscription_tier"] or "free", "count": t["count"]}
            for t in tiers
        ],
        "growth": growth_data
    }


@router.get("/statistics/courses")
async def get_course_statistics(
    days: int = Query(7, le=30),
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get course statistics."""
    today = datetime.now().date()
    start_date = today - timedelta(days=days)

    # Total courses (stages table)
    total_courses = await db.fetchval("SELECT COUNT(*) FROM stages")

    # Generated today
    generated_today = await db.fetchval(
        "SELECT COUNT(*) FROM stages WHERE DATE(created_at) = $1", today
    ) or 0

    # Generation trend
    trend = await db.fetch(
        """
        SELECT DATE(created_at) as date,
               COUNT(*) as courses
        FROM stages
        WHERE DATE(created_at) >= $1
        GROUP BY DATE(created_at)
        ORDER BY date
        """,
        start_date
    )

    # Completion trend (from course_completions)
    completions = await db.fetch(
        """
        SELECT DATE(created_at) as date,
               COUNT(*) as completions
        FROM course_completions
        WHERE DATE(created_at) >= $1
        GROUP BY DATE(created_at)
        ORDER BY date
        """,
        start_date
    )

    # Merge trend data
    trend_data = []
    for t in trend:
        date_str = t["date"].isoformat()
        comp = next((c["completions"] for c in completions if c["date"] == t["date"]), 0)
        trend_data.append({
            "date": date_str,
            "courses": t["courses"],
            "completions": comp
        })

    return {
        "total_courses": total_courses or 0,
        "generated_today": generated_today,
        "generation_trend": trend_data
    }


@router.get("/statistics/economy")
async def get_economy_statistics(
    days: int = Query(7, le=30),
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get economy statistics."""
    today = datetime.now().date()
    start_date = today - timedelta(days=days)
    month_start = today.replace(day=1)

    # Revenue today
    revenue_today = await db.fetchval(
        """
        SELECT COALESCE(SUM(amount), 0)
        FROM payments
        WHERE DATE(created_at) = $1 AND status = 'completed'
        """,
        today
    ) or 0

    # Revenue this month
    revenue_month = await db.fetchval(
        """
        SELECT COALESCE(SUM(amount), 0)
        FROM payments
        WHERE DATE(created_at) >= $1 AND status = 'completed'
        """,
        month_start
    ) or 0

    # Tokens purchased today
    tokens_purchased = await db.fetchval(
        """
        SELECT COALESCE(SUM(tokens), 0)
        FROM token_transactions
        WHERE DATE(created_at) = $1 AND transaction_type = 'purchase'
        """,
        today
    ) or 0

    # Points earned today
    points_earned = await db.fetchval(
        """
        SELECT COALESCE(SUM(points), 0)
        FROM point_transactions
        WHERE DATE(created_at) = $1 AND transaction_type = 'earn'
        """,
        today
    ) or 0

    # Points spent today
    points_spent = await db.fetchval(
        """
        SELECT COALESCE(SUM(points), 0)
        FROM point_transactions
        WHERE DATE(created_at) = $1 AND transaction_type = 'spend'
        """,
        today
    ) or 0

    # Revenue trend
    revenue_trend = await db.fetch(
        """
        SELECT DATE(created_at) as date,
               COALESCE(SUM(amount), 0) as revenue
        FROM payments
        WHERE DATE(created_at) >= $1 AND status = 'completed'
        GROUP BY DATE(created_at)
        ORDER BY date
        """,
        start_date
    )

    # Token purchase trend
    token_trend = await db.fetch(
        """
        SELECT DATE(created_at) as date,
               COALESCE(SUM(tokens), 0) as tokens
        FROM token_transactions
        WHERE DATE(created_at) >= $1 AND transaction_type = 'purchase'
        GROUP BY DATE(created_at)
        ORDER BY date
        """,
        start_date
    )

    # Merge trends
    trend_data = []
    for r in revenue_trend:
        date_str = r["date"].isoformat()
        tokens = next((t["tokens"] for t in token_trend if t["date"] == r["date"]), 0)
        trend_data.append({
            "date": date_str,
            "revenue": r["revenue"],
            "tokens": tokens
        })

    # Top transactions
    top_transactions = await db.fetch(
        """
        SELECT u.nickname, t.transaction_type, t.tokens as amount, t.created_at
        FROM token_transactions t
        JOIN users u ON t.user_id = u.id
        WHERE DATE(t.created_at) = $1
        ORDER BY t.tokens DESC
        LIMIT 10
        """,
        today
    )

    return {
        "revenue_today": revenue_today,
        "revenue_month": revenue_month,
        "tokens_purchased": tokens_purchased,
        "points_earned": points_earned,
        "points_spent": points_spent,
        "revenue_trend": trend_data,
        "top_transactions": [
            {
                "user": t["nickname"],
                "type": t["transaction_type"],
                "amount": t["amount"],
                "time": t["created_at"].isoformat()
            }
            for t in top_transactions
        ]
    }


# ============ Settings ============

@router.get("/settings/llm")
async def get_llm_settings(
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get LLM configuration settings."""
    configs = await db.fetch(
        """
        SELECT provider, model, api_key, temperature, max_tokens, top_p
        FROM llm_configs
        ORDER BY provider
        """
    )

    return {
        "configs": [dict(c) for c in configs]
    }


@router.put("/settings/llm")
async def update_llm_settings(
    configs: List[dict],
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Update LLM configuration settings."""
    for config in configs:
        await db.execute(
            """
            UPDATE llm_configs
            SET model = $2, api_key = $3, temperature = $4, max_tokens = $5, top_p = $6
            WHERE provider = $1
            """,
            config["provider"],
            config["model"],
            config["api_key"],
            config["temperature"],
            config["max_tokens"],
            config["top_p"]
        )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'settings_update', 'llm_config', '更新LLM配置', $2)
        """,
        admin["id"], datetime.now()
    )

    return {"success": True}


@router.get("/settings/pricing")
async def get_pricing_settings(
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get pricing settings."""
    pricing = await db.fetch(
        """
        SELECT type, name, price, tokens, description
        FROM pricing_configs
        ORDER BY type, price
        """
    )

    return {"pricing": [dict(p) for p in pricing]}


@router.put("/settings/pricing")
async def update_pricing_settings(
    pricing: List[dict],
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Update pricing settings."""
    for p in pricing:
        await db.execute(
            """
            UPDATE pricing_configs
            SET name = $3, price = $4, tokens = $5, description = $6
            WHERE type = $1 AND name = $2
            """,
            p["type"], p["name"], p["name"], p["price"], p["tokens"], p["description"]
        )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'pricing_update', 'pricing_config', '更新价格配置', $2)
        """,
        admin["id"], datetime.now()
    )

    return {"success": True}


@router.get("/settings/rules")
async def get_rules_settings(
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get reward rules settings."""
    rewards = await db.fetch(
        """
        SELECT action, points, description, enabled
        FROM reward_rules
        ORDER BY action
        """
    )

    daily_bonus = await db.fetchval(
        "SELECT value FROM system_settings WHERE key = 'daily_task_bonus'"
    ) or 50

    streak_multiplier = await db.fetchval(
        "SELECT value FROM system_settings WHERE key = 'streak_multiplier'"
    ) or 1.5

    review_points = await db.fetch(
        """
        SELECT review_type, points
        FROM review_reward_configs
        ORDER BY review_type
        """
    )

    return {
        "rewards": [dict(r) for r in rewards],
        "daily_task_bonus": int(daily_bonus),
        "streak_multiplier": float(streak_multiplier),
        "review_points": [dict(r) for r in review_points]
    }


@router.put("/settings/rules")
async def update_rules_settings(
    config: dict,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Update reward rules settings."""
    # Update rewards
    for r in config.get("rewards", []):
        await db.execute(
            """
            UPDATE reward_rules
            SET points = $3, description = $4, enabled = $5
            WHERE action = $2
            """,
            r["action"], r["points"], r["description"], r["enabled"]
        )

    # Update daily bonus
    await db.execute(
        """
        UPDATE system_settings SET value = $2
        WHERE key = 'daily_task_bonus'
        """,
        str(config.get("daily_task_bonus", 50))
    )

    # Update streak multiplier
    await db.execute(
        """
        UPDATE system_settings SET value = $2
        WHERE key = 'streak_multiplier'
        """,
        str(config.get("streak_multiplier", 1.5))
    )

    # Update review points
    for r in config.get("review_points", []):
        await db.execute(
            """
            UPDATE review_reward_configs SET points = $2
            WHERE review_type = $1
            """,
            r["type"], r["points"]
        )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'settings_update', 'rules_config', '更新规则配置', $2)
        """,
        admin["id"], datetime.now()
    )

    return {"success": True}


# ============ Logs ============

@router.get("/logs")
async def get_admin_logs(
    search: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    limit: int = Query(100, le=200),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get admin operation logs."""
    conditions = []
    params = []

    if search:
        conditions.append("(details ILIKE $1 OR target ILIKE $1)")
        params.append(f"%{search}%")

    if action:
        conditions.append("action = $" + str(len(params) + 1))
        params.append(action)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    params.extend([limit, offset])

    logs = await db.fetch(
        f"""
        SELECT l.id, l.admin_id, l.action, l.target, l.details, l.created_at,
               u.nickname as admin_name
        FROM admin_logs l
        JOIN users u ON l.admin_id = u.id
        WHERE {where_clause}
        ORDER BY l.created_at DESC
        LIMIT ${len(params) - 1} OFFSET ${len(params)}
        """,
        *params
    )

    return {
        "logs": [
            {
                "id": str(l["id"]),
                "admin_id": str(l["admin_id"]),
                "admin_name": l["admin_name"],
                "action": l["action"],
                "target": l["target"],
                "details": l["details"],
                "created_at": l["created_at"].isoformat()
            }
            for l in logs
        ],
        "total": len(logs)
    }