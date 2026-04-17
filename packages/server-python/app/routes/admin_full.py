"""
Admin API routes - Full implementation with permission checks
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta
import asyncpg
from app.db.database import get_db
from app.routes.admin_auth import get_current_admin, check_permission, get_admin_permissions

router = APIRouter(prefix="/admin", tags=["admin"])


# ============ Dashboard Stats ============

@router.get("/stats")
async def get_dashboard_stats(
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get dashboard overview statistics. Requires any admin permission."""
    today = datetime.now().date()

    total_users = await db.fetchval("SELECT COUNT(*) FROM users")
    new_today = await db.fetchval("SELECT COUNT(*) FROM users WHERE DATE(created_at) = $1", today)
    active_today = await db.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM token_transactions WHERE DATE(created_at) = $1",
        today
    ) or 0

    total_courses = await db.fetchval("SELECT COUNT(*) FROM classrooms")
    generated_today = await db.fetchval("SELECT COUNT(*) FROM classrooms WHERE DATE(created_at) = $1", today) or 0

    revenue_today = await db.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM token_transactions WHERE transaction_type = 'purchase' AND DATE(created_at) = $1",
        today
    ) or 0
    tokens_purchased = await db.fetchval(
        "SELECT COALESCE(SUM(tokens), 0) FROM token_transactions WHERE transaction_type = 'purchase' AND DATE(created_at) = $1",
        today
    ) or 0
    points_earned = await db.fetchval(
        "SELECT COALESCE(SUM(points), 0) FROM point_transactions WHERE transaction_type = 'earn' AND DATE(created_at) = $1",
        today
    ) or 0

    return {
        "users": {"total": total_users or 0, "new_today": new_today or 0, "active_today": active_today},
        "courses": {"total": total_courses or 0, "generated_today": generated_today},
        "economy": {"revenue_today": revenue_today, "tokens_purchased": tokens_purchased, "points_earned": points_earned}
    }


# ============ User Management ============

@router.get("/users")
async def list_users(
    search: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """List users with search and filter. Requires users.list permission."""
    conditions = ["1=1"]
    params = []
    param_idx = 1

    if search:
        conditions.append(f"(email ILIKE ${param_idx} OR nickname ILIKE ${param_idx})")
        params.append(f"%{search}%")
        param_idx += 1

    if tier:
        conditions.append(f"subscription_tier = ${param_idx}")
        params.append(tier)
        param_idx += 1

    if status:
        if status == "active":
            conditions.append("is_active = true")
        elif status == "inactive":
            conditions.append("is_active = false")

    params.extend([limit, offset])

    where_clause = " AND ".join(conditions)

    users = await db.fetch(
        f"""
        SELECT id, email, nickname, avatar_url, token_balance, point_balance,
               subscription_tier, created_at, is_active
        FROM users
        WHERE {where_clause}
        ORDER BY created_at DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """,
        *params
    )

    total = await db.fetchval(f"SELECT COUNT(*) FROM users WHERE {where_clause}", *params[:-2])

    return {"users": [dict(u) for u in users], "total": total}


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get detailed user info. Requires users.view permission."""
    user = await db.fetchrow(
        """
        SELECT u.id, u.email, u.nickname, u.avatar_url, u.token_balance, u.point_balance,
               u.subscription_tier, u.league_tier, u.created_at, u.is_active,
               (SELECT COUNT(*) FROM stages WHERE user_id = u.id) as courses_count,
               (SELECT COUNT(*) FROM daily_checkins WHERE user_id = u.id) as checkins_count
        FROM users u WHERE u.id = $1
        """,
        user_id
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get recent activity
    recent_transactions = await db.fetch(
        """
        SELECT transaction_type, amount, created_at FROM token_transactions
        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10
        """,
        user_id
    )

    return {
        "user": dict(user),
        "recent_activity": [dict(t) for t in recent_transactions]
    }


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    reason: str = "管理员禁用",
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Ban a user account. Requires users.ban permission."""
    await db.execute("UPDATE users SET is_active = false WHERE id = $1", user_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'user_ban', $2, $3, $4)
        """,
        admin["id"], user_id, f"禁用用户: {reason}", datetime.utcnow()
    )

    return {"success": True, "action": "banned", "reason": reason}


@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: str,
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Unban a user account. Requires users.ban permission."""
    await db.execute("UPDATE users SET is_active = true WHERE id = $1", user_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'user_unban', $2, '启用用户', $3)
        """,
        admin["id"], user_id, datetime.utcnow()
    )

    return {"success": True, "action": "unbanned"}


@router.post("/users/{user_id}/gift-tokens")
async def gift_tokens_to_user(
    user_id: str,
    amount: int,
    reason: str = "管理员赠送",
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Gift tokens to user. Requires users.gift permission."""
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    await db.execute(
        "UPDATE users SET token_balance = token_balance + $1 WHERE id = $2",
        amount, user_id
    )

    await db.execute(
        """
        INSERT INTO token_transactions (user_id, tokens, transaction_type, description, created_at)
        VALUES ($1, $2, 'gift', $3, $4)
        """,
        user_id, amount, reason, datetime.utcnow()
    )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'gift_tokens', $2, $3, $4)
        """,
        admin["id"], user_id, f"赠送{amount}Token: {reason}", datetime.utcnow()
    )

    return {"success": True, "tokens_added": amount}


@router.post("/users/{user_id}/gift-points")
async def gift_points_to_user(
    user_id: str,
    amount: int,
    reason: str = "管理员赠送",
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Gift points to user. Requires users.gift permission."""
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    await db.execute(
        "UPDATE users SET point_balance = point_balance + $1 WHERE id = $2",
        amount, user_id
    )

    await db.execute(
        """
        INSERT INTO point_transactions (user_id, points, transaction_type, description, created_at)
        VALUES ($1, $2, 'gift', $3, $4)
        """,
        user_id, amount, reason, datetime.utcnow()
    )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'gift_points', $2, $3, $4)
        """,
        admin["id"], user_id, f"赠送{amount}积分: {reason}", datetime.utcnow()
    )

    return {"success": True, "points_added": amount}


# ============ Content Review ============

@router.get("/content/questions")
async def list_questions_review(
    status: str = Query("pending"),
    limit: int = Query(50, le=100),
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """List questions for content review. Requires content.list permission."""
    questions = await db.fetch(
        """
        SELECT q.id, q.title, q.content, q.classroom_id, q.review_status,
               u.nickname, u.email, q.created_at
        FROM questions q
        JOIN users u ON q.user_id = u.id
        WHERE q.review_status = $1
        ORDER BY q.created_at DESC
        LIMIT $2
        """,
        status, limit
    )

    return {"questions": [dict(q) for q in questions]}


@router.post("/content/questions/{question_id}/approve")
async def approve_question(
    question_id: str,
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Approve a question. Requires content.approve permission."""
    await db.execute("UPDATE questions SET review_status = 'approved' WHERE id = $1", question_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_approve', $2, '审核通过问题', $3)
        """,
        admin["id"], question_id, datetime.utcnow()
    )

    return {"success": True}


@router.post("/content/questions/{question_id}/reject")
async def reject_question(
    question_id: str,
    reason: str = "不符合内容规范",
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Reject a question. Requires content.reject permission."""
    await db.execute("UPDATE questions SET review_status = 'rejected' WHERE id = $1", question_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_reject', $2, $3, $4)
        """,
        admin["id"], question_id, f"审核拒绝问题: {reason}", datetime.utcnow()
    )

    return {"success": True}


@router.get("/content/answers")
async def list_answers_review(
    status: str = Query("pending"),
    limit: int = Query(50, le=100),
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """List answers for review. Requires content.list permission."""
    answers = await db.fetch(
        """
        SELECT a.id, a.content, a.question_id, a.review_status,
               u.nickname, q.title as question_title, a.created_at
        FROM answers a
        JOIN users u ON a.user_id = u.id
        JOIN questions q ON a.question_id = q.id
        WHERE a.review_status = $1
        ORDER BY a.created_at DESC
        LIMIT $2
        """,
        status, limit
    )

    return {"answers": [dict(a) for a in answers]}


@router.post("/content/answers/{answer_id}/approve")
async def approve_answer(
    answer_id: str,
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Approve an answer. Requires content.approve permission."""
    await db.execute("UPDATE answers SET review_status = 'approved' WHERE id = $1", answer_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_approve', $2, '审核通过回答', $3)
        """,
        admin["id"], answer_id, datetime.utcnow()
    )

    return {"success": True}


@router.post("/content/answers/{answer_id}/reject")
async def reject_answer(
    answer_id: str,
    reason: str = "不符合内容规范",
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Reject an answer. Requires content.reject permission."""
    await db.execute("UPDATE answers SET review_status = 'rejected' WHERE id = $1", answer_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_reject', $2, $3, $4)
        """,
        admin["id"], answer_id, f"审核拒绝回答: {reason}", datetime.utcnow()
    )

    return {"success": True}


@router.get("/content/notes")
async def list_notes_review(
    status: str = Query("pending"),
    limit: int = Query(50, le=100),
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """List notes for review. Requires content.list permission."""
    notes = await db.fetch(
        """
        SELECT n.id, n.title, n.content, n.classroom_id, n.likes, n.review_status,
               u.nickname, n.created_at
        FROM notes n
        JOIN users u ON n.user_id = u.id
        WHERE n.review_status = $1
        ORDER BY n.created_at DESC
        LIMIT $2
        """,
        status, limit
    )

    return {"notes": [dict(n) for n in notes]}


@router.post("/content/notes/{note_id}/approve")
async def approve_note(
    note_id: str,
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Approve a note. Requires content.approve permission."""
    await db.execute("UPDATE notes SET review_status = 'approved' WHERE id = $1", note_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_approve', $2, '审核通过笔记', $3)
        """,
        admin["id"], note_id, datetime.utcnow()
    )

    return {"success": True}


@router.post("/content/notes/{note_id}/reject")
async def reject_note(
    note_id: str,
    reason: str = "不符合内容规范",
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Reject a note. Requires content.reject permission."""
    await db.execute("UPDATE notes SET review_status = 'rejected' WHERE id = $1", note_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_reject', $2, $3, $4)
        """,
        admin["id"], note_id, f"审核拒绝笔记: {reason}", datetime.utcnow()
    )

    return {"success": True}


# ============ Statistics ============

@router.get("/statistics/users")
async def get_user_stats(
    days: int = Query(7, le=30),
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user statistics. Requires finance.view permission."""
    start_date = datetime.utcnow().date() - timedelta(days=days)

    total = await db.fetchval("SELECT COUNT(*) FROM users")
    new_today = await db.fetchval("SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURRENT_DATE")
    active_today = await db.fetchval("SELECT COUNT(DISTINCT user_id) FROM token_transactions WHERE DATE(created_at) = CURRENT_DATE") or 0

    tiers = await db.fetch("SELECT subscription_tier, COUNT(*) as count FROM users GROUP BY subscription_tier")

    growth = await db.fetch(
        """
        SELECT DATE(created_at) as date, COUNT(*) as new_users
        FROM users WHERE DATE(created_at) >= $1 GROUP BY DATE(created_at) ORDER BY date
        """,
        start_date
    )

    return {
        "total": total,
        "new_today": new_today,
        "active_today": active_today,
        "tier_distribution": [dict(t) for t in tiers],
        "growth": [{"date": str(g["date"]), "new_users": g["new_users"]} for g in growth]
    }


@router.get("/statistics/economy")
async def get_economy_stats(
    days: int = Query(7, le=30),
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get economy statistics. Requires finance.view permission."""
    start_date = datetime.utcnow().date() - timedelta(days=days)

    revenue_today = await db.fetchval("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE DATE(created_at) = CURRENT_DATE AND status = 'completed'") or 0
    revenue_month = await db.fetchval("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE DATE(created_at) >= DATE_TRUNC('month', CURRENT_DATE) AND status = 'completed'") or 0

    tokens_today = await db.fetchval("SELECT COALESCE(SUM(tokens), 0) FROM token_transactions WHERE DATE(created_at) = CURRENT_DATE AND transaction_type = 'purchase'") or 0
    points_earned = await db.fetchval("SELECT COALESCE(SUM(points), 0) FROM point_transactions WHERE DATE(created_at) = CURRENT_DATE AND transaction_type = 'earn'") or 0

    revenue_trend = await db.fetch(
        """
        SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as revenue
        FROM payments WHERE DATE(created_at) >= $1 AND status = 'completed'
        GROUP BY DATE(created_at) ORDER BY date
        """,
        start_date
    )

    return {
        "revenue_today": revenue_today,
        "revenue_month": revenue_month,
        "tokens_purchased_today": tokens_today,
        "points_earned_today": points_earned,
        "revenue_trend": [{"date": str(r["date"]), "revenue": r["revenue"]} for r in revenue_trend]
    }


# ============ Settings ============

@router.get("/settings/llm")
async def get_llm_settings(
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get LLM settings. Requires settings.view permission."""
    configs = await db.fetch("SELECT provider, model, temperature, max_tokens, top_p FROM llm_configs ORDER BY provider")
    return {"configs": [dict(c) for c in configs]}


@router.put("/settings/llm")
async def update_llm_settings(
    configs: List[dict],
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Update LLM settings. Requires settings.edit permission."""
    for config in configs:
        await db.execute(
            """
            UPDATE llm_configs SET model = $2, temperature = $3, max_tokens = $4, top_p = $5, updated_at = $6
            WHERE provider = $1
            """,
            config["provider"], config["model"], config["temperature"], config["max_tokens"], config["top_p"], datetime.utcnow()
        )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'settings_update', 'llm_config', '更新LLM配置', $2)
        """,
        admin["id"], datetime.utcnow()
    )

    return {"success": True}


@router.get("/settings/pricing")
async def get_pricing_settings(
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get pricing settings. Requires settings.view permission."""
    pricing = await db.fetch("SELECT type, name, price, tokens, description FROM pricing_configs ORDER BY type, price")
    return {"pricing": [dict(p) for p in pricing]}


@router.put("/settings/pricing")
async def update_pricing_settings(
    pricing: List[dict],
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Update pricing settings. Requires settings.edit permission."""
    for p in pricing:
        await db.execute(
            """
            UPDATE pricing_configs SET price = $3, tokens = $4, description = $5, updated_at = $6
            WHERE type = $1 AND name = $2
            """,
            p["type"], p["name"], p["price"], p["tokens"], p["description"], datetime.utcnow()
        )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'pricing_update', 'pricing_config', '更新价格配置', $2)
        """,
        admin["id"], datetime.utcnow()
    )

    return {"success": True}


@router.get("/settings/rules")
async def get_rules_settings(
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get reward rules. Requires settings.view permission."""
    rewards = await db.fetch("SELECT action, points, description, enabled FROM reward_rules ORDER BY action")

    daily_bonus = await db.fetchval("SELECT value FROM system_settings WHERE key = 'daily_task_bonus'") or "50"
    streak_mult = await db.fetchval("SELECT value FROM system_settings WHERE key = 'streak_multiplier'") or "1.5"

    return {
        "rewards": [dict(r) for r in rewards],
        "daily_task_bonus": int(daily_bonus),
        "streak_multiplier": float(streak_mult)
    }


@router.put("/settings/rules")
async def update_rules_settings(
    config: dict,
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Update reward rules. Requires settings.edit permission."""
    for r in config.get("rewards", []):
        await db.execute(
            "UPDATE reward_rules SET points = $2, enabled = $3 WHERE action = $1",
            r["action"], r["points"], r["enabled"]
        )

    await db.execute("UPDATE system_settings SET value = $2 WHERE key = 'daily_task_bonus'", str(config.get("daily_task_bonus", 50)))
    await db.execute("UPDATE system_settings SET value = $2 WHERE key = 'streak_multiplier'", str(config.get("streak_multiplier", 1.5)))

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'settings_update', 'rules_config', '更新规则配置', $2)
        """,
        admin["id"], datetime.utcnow()
    )

    return {"success": True}


# ============ Logs ============

@router.get("/logs")
async def get_admin_logs(
    action: Optional[str] = Query(None),
    limit: int = Query(100, le=200),
    admin: dict = Depends(check_permission),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get admin operation logs. Requires logs.view permission."""
    conditions = ["1=1"]
    params = []
    param_idx = 1

    if action:
        conditions.append(f"action = ${param_idx}")
        params.append(action)
        param_idx += 1

    params.append(limit)

    where_clause = " AND ".join(conditions)

    logs = await db.fetch(
        f"""
        SELECT l.id, l.admin_id, l.action, l.target, l.details, l.created_at,
               a.nickname as admin_name
        FROM admin_logs l
        JOIN admins a ON l.admin_id = a.id
        WHERE {where_clause}
        ORDER BY l.created_at DESC
        LIMIT ${param_idx}
        """,
        *params
    )

    return {"logs": [dict(l) for l in logs]}