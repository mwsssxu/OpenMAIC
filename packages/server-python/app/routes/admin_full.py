"""
Admin API routes - Full implementation with permission checks
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta
from app.core.time_utils import utcnow
import asyncpg
import uuid
from app.db.database import get_db
from app.routes.admin_auth import get_current_admin, check_permission, get_admin_permissions

router = APIRouter(prefix="/admin", tags=["admin"])


# ============ Permission Dependencies ============

def _perm(code: str):
    """Create a FastAPI dependency that checks a specific permission code."""
    async def _check(admin: dict = Depends(get_current_admin), db: asyncpg.Connection = Depends(get_db)):
        return await check_permission(code, admin, db)
    return _check

require_dashboard = _perm("dashboard.view")
require_users_list = _perm("users.list")
require_users_detail = _perm("users.detail")
require_users_ban = _perm("users.ban")
require_users_gift = _perm("users.gift")
require_courses_view = _perm("courses.view")
require_content_review = _perm("content.review")
require_statistics_view = _perm("statistics.view")
require_finance_view = _perm("finance.view")
require_settings_manage = _perm("settings.manage")
require_logs_view = _perm("logs.view")


# ============ Dashboard Stats ============

@router.get("/stats")
async def get_dashboard_stats(
    admin: dict = Depends(require_dashboard),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get dashboard overview statistics. Requires any admin permission.
    
    Returns real change percentages by comparing current period vs previous period:
    - users.change:   new users this week vs last week
    - courses.change: courses generated this week vs last week
    - economy.change: revenue this week vs last week
    - active.change:  active users this week vs last week
    """
    today = datetime.now().date()
    week_ago = today - timedelta(days=7)
    two_weeks_ago = today - timedelta(days=14)

    # ---- User stats ----
    total_users = await db.fetchval("SELECT COUNT(*) FROM users") or 0
    new_today = await db.fetchval("SELECT COUNT(*) FROM users WHERE DATE(created_at) = $1", today) or 0
    active_today = await db.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM token_transactions WHERE DATE(created_at) = $1",
        today
    ) or 0

    # Users: new this week vs last week
    new_this_week = await db.fetchval(
        "SELECT COUNT(*) FROM users WHERE DATE(created_at) >= $1", week_ago
    ) or 0
    new_last_week = await db.fetchval(
        "SELECT COUNT(*) FROM users WHERE DATE(created_at) >= $1 AND DATE(created_at) < $2",
        two_weeks_ago, week_ago
    ) or 0
    user_change = round((new_this_week - new_last_week) / new_last_week * 100, 1) if new_last_week > 0 else (100.0 if new_this_week > 0 else 0.0)

    # ---- Course stats ----
    total_courses = await db.fetchval("SELECT COUNT(*) FROM stages") or 0
    generated_today = await db.fetchval("SELECT COUNT(*) FROM stages WHERE DATE(created_at) = $1", today) or 0

    # Courses: generated this week vs last week
    courses_this_week = await db.fetchval(
        "SELECT COUNT(*) FROM stages WHERE DATE(created_at) >= $1", week_ago
    ) or 0
    courses_last_week = await db.fetchval(
        "SELECT COUNT(*) FROM stages WHERE DATE(created_at) >= $1 AND DATE(created_at) < $2",
        two_weeks_ago, week_ago
    ) or 0
    course_change = round((courses_this_week - courses_last_week) / courses_last_week * 100, 1) if courses_last_week > 0 else (100.0 if courses_this_week > 0 else 0.0)

    # ---- Economy stats ----
    revenue_today = await db.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status = 'paid' AND DATE(created_at) = $1",
        today
    ) or 0
    tokens_purchased = await db.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM token_transactions WHERE type = 'purchase' AND DATE(created_at) = $1",
        today
    ) or 0
    points_earned = await db.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM point_transactions WHERE source = 'earn' AND DATE(created_at) = $1",
        today
    ) or 0

    # Revenue: this week vs last week
    revenue_this_week = await db.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status = 'paid' AND DATE(created_at) >= $1",
        week_ago
    ) or 0
    revenue_last_week = await db.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status = 'paid' AND DATE(created_at) >= $1 AND DATE(created_at) < $2",
        two_weeks_ago, week_ago
    ) or 0
    revenue_change = round((revenue_this_week - revenue_last_week) / revenue_last_week * 100, 1) if revenue_last_week > 0 else (100.0 if revenue_this_week > 0 else 0.0)

    # Active users: this week vs last week
    active_this_week = await db.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM token_transactions WHERE DATE(created_at) >= $1",
        week_ago
    ) or 0
    active_last_week = await db.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM token_transactions WHERE DATE(created_at) >= $1 AND DATE(created_at) < $2",
        two_weeks_ago, week_ago
    ) or 0
    active_change = round((active_this_week - active_last_week) / active_last_week * 100, 1) if active_last_week > 0 else (100.0 if active_this_week > 0 else 0.0)

    return {
        "users": {
            "total": total_users,
            "new_today": new_today,
            "active_today": active_today,
            "change": user_change,
        },
        "courses": {
            "total": total_courses,
            "generated_today": generated_today,
            "change": course_change,
        },
        "economy": {
            "revenue_today": revenue_today,
            "tokens_purchased": tokens_purchased,
            "points_earned": points_earned,
            "change": revenue_change,
        },
        "active": {
            "active_this_week": active_this_week,
            "active_last_week": active_last_week,
            "change": active_change,
        },
    }


@router.get("/stats/token-consumption")
async def get_token_consumption_stats(
    days: int = Query(7, ge=1, le=30),
    admin: dict = Depends(require_statistics_view),
    db: asyncpg.Connection = Depends(get_db)
):
    """Token消耗统计 - 按天/按功能/趋势"""
    # 今日消耗
    spent_today = await db.fetchval(
        "SELECT COALESCE(SUM(ABS(amount)), 0) FROM token_transactions WHERE type = 'spend' AND DATE(created_at) = CURRENT_DATE"
    ) or 0

    # 7天/30天消耗趋势
    consumption_trend = await db.fetch(
        """
        SELECT DATE(created_at) as date, COALESCE(SUM(ABS(amount)), 0) as consumed
        FROM token_transactions
        WHERE type = 'spend' AND created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY DATE(created_at) ORDER BY date
        """,
        days,
    )

    # 按功能分类消耗（从description字段提取）
    # 注意：description 格式如 "课程生成", "AI问答", "学习搭子"
    feature_breakdown = await db.fetch(
        """
        SELECT
            CASE
                WHEN description LIKE '%课程%' THEN 'course_generation'
                WHEN description LIKE '%问答%' OR description LIKE '%AI交互%' THEN 'ai_interaction'
                WHEN description LIKE '%搭子%' OR description LIKE '%buddy%' THEN 'buddy_chat'
                WHEN description LIKE '%讨论%' THEN 'discussion'
                WHEN description LIKE '%报告%' THEN 'report'
                WHEN description LIKE '%图片%' THEN 'image'
                ELSE 'other'
            END as feature,
            COUNT(*) as call_count,
            COALESCE(SUM(ABS(amount)), 0) as total_consumed
        FROM token_transactions
        WHERE type = 'spend' AND DATE(created_at) = CURRENT_DATE
        GROUP BY feature
        ORDER BY total_consumed DESC
        """
    )

    return {
        "spent_today": spent_today,
        "trend": [{"date": str(r["date"]), "consumed": r["consumed"]} for r in consumption_trend],
        "feature_breakdown": [
            {"feature": r["feature"], "call_count": r["call_count"], "total_consumed": r["total_consumed"]}
            for r in feature_breakdown
        ],
    }


@router.get("/stats/cost-revenue")
async def get_cost_revenue_stats(
    days: int = Query(7, ge=1, le=30),
    admin: dict = Depends(require_finance_view),
    db: asyncpg.Connection = Depends(get_db)
):
    """成本 vs 收入统计 - 利润分析"""
    # 今日收入
    revenue_today = await db.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status = 'paid' AND DATE(created_at) = CURRENT_DATE"
    ) or 0

    # 今日API成本
    cost_today = await db.fetchval(
        "SELECT COALESCE(SUM(cost_yuan), 0) FROM llm_usage_logs WHERE DATE(created_at) = CURRENT_DATE AND status = 'success'"
    ) or 0

    # 今日调用次数
    calls_today = await db.fetchval(
        "SELECT COUNT(*) FROM llm_usage_logs WHERE DATE(created_at) = CURRENT_DATE"
    ) or 0

    # 今日成功调用
    success_today = await db.fetchval(
        "SELECT COUNT(*) FROM llm_usage_logs WHERE DATE(created_at) = CURRENT_DATE AND status = 'success'"
    ) or 0

    # 今日失败调用
    error_today = await db.fetchval(
        "SELECT COUNT(*) FROM llm_usage_logs WHERE DATE(created_at) = CURRENT_DATE AND status = 'error'"
    ) or 0

    # 收入趋势
    revenue_trend = await db.fetch(
        """
        SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as revenue
        FROM orders WHERE status = 'paid' AND created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY DATE(created_at) ORDER BY date
        """,
        days,
    )

    # 成本趋势
    cost_trend = await db.fetch(
        """
        SELECT DATE(created_at) as date, COALESCE(SUM(cost_yuan), 0) as cost, COUNT(*) as calls
        FROM llm_usage_logs WHERE status = 'success' AND created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY DATE(created_at) ORDER BY date
        """,
        days,
    )

    # 模型使用量排行
    model_usage = await db.fetch(
        """
        SELECT model, COUNT(*) as calls,
               COALESCE(SUM(cost_yuan), 0) as total_cost,
               COALESCE(SUM(total_tokens), 0) as total_tokens
        FROM llm_usage_logs
        WHERE DATE(created_at) = CURRENT_DATE AND status = 'success'
        GROUP BY model ORDER BY total_cost DESC
        """
    )

    # 用户利润排行（Top 10 按利润降序）— JOIN users 表带出 email/nickname 便于识别
    user_profit = await db.fetch(
        """
        WITH user_revenue AS (
            SELECT user_id, COALESCE(SUM(amount), 0) as revenue
            FROM orders WHERE status = 'paid' AND created_at >= NOW() - ($1 || ' days')::interval
            GROUP BY user_id
        ),
        user_cost AS (
            SELECT user_id, COALESCE(SUM(cost_yuan), 0) as cost,
                   COUNT(*) as calls
            FROM llm_usage_logs
            WHERE status = 'success' AND user_id IS NOT NULL
              AND created_at >= NOW() - ($2 || ' days')::interval
            GROUP BY user_id
        )
        SELECT
            COALESCE(ur.user_id, uc.user_id) as user_id,
            u.email,
            u.nickname,
            COALESCE(ur.revenue, 0) as revenue,
            COALESCE(uc.cost, 0) as cost,
            COALESCE(uc.calls, 0) as calls,
            COALESCE(ur.revenue, 0) / 100.0 - COALESCE(uc.cost, 0) as profit
        FROM user_revenue ur
        FULL OUTER JOIN user_cost uc ON ur.user_id = uc.user_id
        LEFT JOIN users u ON u.id = COALESCE(ur.user_id, uc.user_id)
        ORDER BY profit DESC LIMIT 10
        """,
        days, days,
    )

    # 高成本未付费用户（潜在转化目标）— 烧 LLM 但 0 订单
    cost_only_users = await db.fetch(
        """
        SELECT
            l.user_id,
            u.email,
            u.nickname,
            COALESCE(SUM(l.cost_yuan), 0) as cost,
            COUNT(*) as calls,
            MAX(l.created_at) as last_active
        FROM llm_usage_logs l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.status = 'success' AND l.user_id IS NOT NULL
          AND l.created_at >= NOW() - ($1 || ' days')::interval
          AND NOT EXISTS (
              SELECT 1 FROM orders o
              WHERE o.user_id = l.user_id AND o.status = 'paid'
          )
        GROUP BY l.user_id, u.email, u.nickname
        ORDER BY cost DESC
        LIMIT 10
        """,
        days,
    )

    return {
        "today": {
            "revenue": revenue_today / 100,  # 分转元
            "cost": cost_today,
            "profit": (revenue_today / 100) - cost_today,
            "calls": calls_today,
            "success": success_today,
            "errors": error_today,
            "cost_per_call": cost_today / success_today if success_today > 0 else 0,
        },
        "revenue_trend": [{"date": str(r["date"]), "revenue": r["revenue"] / 100} for r in revenue_trend],
        "cost_trend": [{"date": str(r["date"]), "cost": r["cost"], "calls": r["calls"]} for r in cost_trend],
        "model_usage": [
            {"model": r["model"], "calls": r["calls"], "total_cost": r["total_cost"], "total_tokens": r["total_tokens"]}
            for r in model_usage
        ],
        "user_profit": [
            {
                "user_id": str(r["user_id"]),
                "email": r["email"],
                "nickname": r["nickname"],
                "revenue": (r["revenue"] or 0) / 100,
                "cost": float(r["cost"] or 0),
                "calls": r["calls"],
                "profit": float(r["profit"] or 0),
            }
            for r in user_profit
        ],
        "cost_only_users": [
            {
                "user_id": str(r["user_id"]),
                "email": r["email"],
                "nickname": r["nickname"],
                "cost": float(r["cost"] or 0),
                "calls": r["calls"],
                "last_active": r["last_active"].isoformat() if r["last_active"] else None,
            }
            for r in cost_only_users
        ],
    }


# ============ User Management ============

@router.get("/users")
async def list_users(
    search: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(require_users_list),
    db: asyncpg.Connection = Depends(get_db)
):
    """List users with search and filter. Requires users.list permission."""
    conditions = ["1=1"]
    params = []
    param_idx = 1

    if search:
        conditions.append(f"(u.email ILIKE ${param_idx} OR u.nickname ILIKE ${param_idx})")
        params.append(f"%{search}%")
        param_idx += 1

    if tier:
        conditions.append(f"u.subscription_tier = ${param_idx}")
        params.append(tier)
        param_idx += 1

    if status:
        if status == "active":
            conditions.append("u.is_active = true")
        elif status == "inactive":
            conditions.append("u.is_active = false")

    params.extend([limit, offset])

    where_clause = " AND ".join(conditions)

    users = await db.fetch(
        f"""
        SELECT u.id, u.email, u.nickname, u.avatar_url,
               COALESCE(ta.balance, 0) as token_balance,
               COALESCE(pa.balance, 0) as point_balance,
               u.subscription_tier, u.created_at, u.is_active
        FROM users u
        LEFT JOIN token_accounts ta ON ta.user_id = u.id
        LEFT JOIN point_accounts pa ON pa.user_id = u.id
        WHERE {where_clause}
        ORDER BY u.created_at DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """,
        *params
    )

    total = await db.fetchval(
        f"SELECT COUNT(*) FROM users u WHERE {where_clause}",
        *params[:-2]
    )

    return {"users": [dict(u) for u in users], "total": total}


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    admin: dict = Depends(require_users_detail),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get detailed user info. Requires users.view permission."""
    # Note: league_tier field removed as it doesn't exist in users table
    # Token/point balances live in token_accounts/point_accounts (see token-ledger-schema.md)
    user = await db.fetchrow(
        """
        SELECT u.id, u.email, u.nickname, u.avatar_url,
               COALESCE(ta.balance, 0) as token_balance,
               COALESCE(pa.balance, 0) as point_balance,
               u.subscription_tier, u.created_at, u.is_active,
               (SELECT COUNT(*) FROM stages WHERE user_id = u.id) as courses_count,
               (SELECT COUNT(*) FROM daily_checkins WHERE user_id = u.id) as checkins_count
        FROM users u
        LEFT JOIN token_accounts ta ON ta.user_id = u.id
        LEFT JOIN point_accounts pa ON pa.user_id = u.id
        WHERE u.id = $1
        """,
        uuid.UUID(user_id) if isinstance(user_id, str) else user_id
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get recent activity - fix: field name is 'type' not 'transaction_type'
    user_uuid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
    recent_transactions = await db.fetch(
        """
        SELECT type, amount, created_at FROM token_transactions
        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10
        """,
        user_uuid
    )

    return {
        "user": dict(user),
        "recent_activity": [dict(t) for t in recent_transactions]
    }


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    reason: str = "管理员禁用",
    admin: dict = Depends(require_users_ban),
    db: asyncpg.Connection = Depends(get_db)
):
    """Ban a user account. Requires users.ban permission."""
    await db.execute("UPDATE users SET is_active = false WHERE id = $1", user_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'user_ban', $2, $3, $4)
        """,
        admin["id"], user_id, f"禁用用户: {reason}", utcnow()
    )

    return {"success": True, "action": "banned", "reason": reason}


@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: str,
    admin: dict = Depends(require_users_ban),
    db: asyncpg.Connection = Depends(get_db)
):
    """Unban a user account. Requires users.ban permission."""
    await db.execute("UPDATE users SET is_active = true WHERE id = $1", user_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'user_unban', $2, '启用用户', $3)
        """,
        admin["id"], user_id, utcnow()
    )

    return {"success": True, "action": "unbanned"}


@router.post("/users/{user_id}/gift-tokens")
async def gift_tokens_to_user(
    user_id: str,
    amount: int,
    reason: str = "管理员赠送",
    admin: dict = Depends(require_users_gift),
    db: asyncpg.Connection = Depends(get_db)
):
    """Gift tokens to user. Requires users.gift permission.

    Token balance lives in token_accounts (not users). If the user has no
    account row yet (e.g. early signup before first transaction), we
    create one — admin gifts must always succeed for active users.
    """
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    # 验证用户存在
    user_exists = await db.fetchval("SELECT 1 FROM users WHERE id = $1", uuid.UUID(user_id))
    if not user_exists:
        raise HTTPException(status_code=404, detail="User not found")

    async with db.transaction():
        # 确保用户有 token_account（首次赠送时可能没有）
        # token_accounts.id 没数据库默认值，应用侧生成
        new_balance = await db.fetchval(
            """
            INSERT INTO token_accounts (id, user_id, balance, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $4)
            ON CONFLICT (user_id) DO UPDATE SET
                balance = token_accounts.balance + EXCLUDED.balance,
                updated_at = EXCLUDED.updated_at
            RETURNING balance
            """,
            uuid.uuid4(), uuid.UUID(user_id), amount, utcnow()
        )

        await db.execute(
            """
            INSERT INTO token_transactions (id, user_id, type, amount, balance_after, description, created_at)
            VALUES ($1, $2, 'gift', $3, $4, $5, $6)
            """,
            uuid.uuid4(), uuid.UUID(user_id), amount, new_balance, reason, utcnow()
        )

        await db.execute(
            """
            INSERT INTO admin_logs (admin_id, action, target, details, created_at)
            VALUES ($1, 'gift_tokens', $2, $3, $4)
            """,
            uuid.UUID(admin["id"]) if isinstance(admin["id"], str) else admin["id"],
            user_id, f"赠送{amount}Token: {reason}", utcnow()
        )

    return {"success": True, "tokens_added": amount, "new_balance": new_balance}


@router.post("/users/{user_id}/gift-points")
async def gift_points_to_user(
    user_id: str,
    amount: int,
    reason: str = "管理员赠送",
    admin: dict = Depends(require_users_gift),
    db: asyncpg.Connection = Depends(get_db)
):
    """Gift points to user. Requires users.gift permission.

    Points balance lives in point_accounts (not users). Same shape as
    gift_tokens_to_user — UPSERT to handle first-time gifts where the
    point_accounts row doesn't exist yet.

    Note: point_transactions uses `source` (not `type`) and has no
    `description` column — reason goes into admin_logs.details only.
    """
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    user_exists = await db.fetchval("SELECT 1 FROM users WHERE id = $1", uuid.UUID(user_id))
    if not user_exists:
        raise HTTPException(status_code=404, detail="User not found")

    async with db.transaction():
        # UPSERT point_accounts; id has no DB default, generate in app code
        new_balance = await db.fetchval(
            """
            INSERT INTO point_accounts (id, user_id, balance, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $4)
            ON CONFLICT (user_id) DO UPDATE SET
                balance = COALESCE(point_accounts.balance, 0) + EXCLUDED.balance,
                updated_at = EXCLUDED.updated_at
            RETURNING balance
            """,
            uuid.uuid4(), uuid.UUID(user_id), amount, utcnow()
        )

        await db.execute(
            """
            INSERT INTO point_transactions (id, user_id, source, amount, balance_after, created_at)
            VALUES ($1, $2, 'gift', $3, $4, $5)
            """,
            uuid.uuid4(), uuid.UUID(user_id), amount, new_balance, utcnow()
        )

        await db.execute(
            """
            INSERT INTO admin_logs (admin_id, action, target, details, created_at)
            VALUES ($1, 'gift_points', $2, $3, $4)
            """,
            uuid.UUID(admin["id"]) if isinstance(admin["id"], str) else admin["id"],
            user_id, f"赠送{amount}积分: {reason}", utcnow()
        )

    return {"success": True, "points_added": amount, "new_balance": new_balance}


# ============ Course Management ============

@router.get("/courses")
async def list_courses(
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(require_courses_view),
    db: asyncpg.Connection = Depends(get_db)
):
    """List courses (stages) for admin. Requires courses.view permission."""
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

    course_list = []
    for c in courses:
        course_dict = dict(c)
        course_dict["chapters_count"] = 0
        if course_dict.get("created_at"):
            course_dict["created_at"] = course_dict["created_at"].isoformat()
        if course_dict.get("updated_at"):
            course_dict["updated_at"] = course_dict["updated_at"].isoformat()
        course_list.append(course_dict)

    return {"data": course_list, "total": len(course_list)}


@router.get("/courses/{course_id}")
async def get_course(
    course_id: str,
    admin: dict = Depends(require_courses_view),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get single course (stage) by ID. Requires courses.view permission."""
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
async def list_questions_review(
    status: str = Query("pending"),
    limit: int = Query(50, le=100),
    admin: dict = Depends(require_content_review),
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
    admin: dict = Depends(require_content_review),
    db: asyncpg.Connection = Depends(get_db)
):
    """Approve a question. Requires content.approve permission."""
    await db.execute("UPDATE questions SET review_status = 'approved' WHERE id = $1", question_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_approve', $2, '审核通过问题', $3)
        """,
        admin["id"], question_id, utcnow()
    )

    return {"success": True}


@router.post("/content/questions/{question_id}/reject")
async def reject_question(
    question_id: str,
    reason: str = "不符合内容规范",
    admin: dict = Depends(require_content_review),
    db: asyncpg.Connection = Depends(get_db)
):
    """Reject a question. Requires content.reject permission."""
    await db.execute("UPDATE questions SET review_status = 'rejected' WHERE id = $1", question_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_reject', $2, $3, $4)
        """,
        admin["id"], question_id, f"审核拒绝问题: {reason}", utcnow()
    )

    return {"success": True}


@router.get("/content/answers")
async def list_answers_review(
    status: str = Query("pending"),
    limit: int = Query(50, le=100),
    admin: dict = Depends(require_content_review),
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
    admin: dict = Depends(require_content_review),
    db: asyncpg.Connection = Depends(get_db)
):
    """Approve an answer. Requires content.approve permission."""
    await db.execute("UPDATE answers SET review_status = 'approved' WHERE id = $1", answer_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_approve', $2, '审核通过回答', $3)
        """,
        admin["id"], answer_id, utcnow()
    )

    return {"success": True}


@router.post("/content/answers/{answer_id}/reject")
async def reject_answer(
    answer_id: str,
    reason: str = "不符合内容规范",
    admin: dict = Depends(require_content_review),
    db: asyncpg.Connection = Depends(get_db)
):
    """Reject an answer. Requires content.reject permission."""
    await db.execute("UPDATE answers SET review_status = 'rejected' WHERE id = $1", answer_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_reject', $2, $3, $4)
        """,
        admin["id"], answer_id, f"审核拒绝回答: {reason}", utcnow()
    )

    return {"success": True}


@router.get("/content/notes")
async def list_notes_review(
    status: str = Query("pending"),
    limit: int = Query(50, le=100),
    admin: dict = Depends(require_content_review),
    db: asyncpg.Connection = Depends(get_db)
):
    """List notes for review. Requires content.list permission."""
    notes = await db.fetch(
        """
        SELECT n.id, n.title, n.content, n.course_id, n.rating_count as likes, n.status as review_status,
               u.nickname, n.created_at
        FROM shared_notes n
        JOIN users u ON n.user_id = u.id
        WHERE n.status = $1
        ORDER BY n.created_at DESC
        LIMIT $2
        """,
        status, limit
    )

    return {"notes": [dict(n) for n in notes]}


@router.post("/content/notes/{note_id}/approve")
async def approve_note(
    note_id: str,
    admin: dict = Depends(require_content_review),
    db: asyncpg.Connection = Depends(get_db)
):
    """Approve a note. Requires content.approve permission."""
    await db.execute("UPDATE shared_notes SET status = 'approved' WHERE id = $1", note_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_approve', $2, '审核通过笔记', $3)
        """,
        admin["id"], note_id, utcnow()
    )

    return {"success": True}


@router.post("/content/notes/{note_id}/reject")
async def reject_note(
    note_id: str,
    reason: str = "不符合内容规范",
    admin: dict = Depends(require_content_review),
    db: asyncpg.Connection = Depends(get_db)
):
    """Reject a note. Requires content.reject permission."""
    await db.execute("UPDATE shared_notes SET status = 'rejected' WHERE id = $1", note_id)

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'content_reject', $2, $3, $4)
        """,
        admin["id"], note_id, f"审核拒绝笔记: {reason}", utcnow()
    )

    return {"success": True}


# ============ Statistics ============

@router.get("/statistics/users")
async def get_user_stats(
    days: int = Query(7, le=30),
    admin: dict = Depends(require_statistics_view),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user statistics. Requires finance.view permission."""
    start_date = utcnow().date() - timedelta(days=days)

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
    admin: dict = Depends(require_finance_view),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get economy statistics. Requires finance.view permission."""
    start_date = utcnow().date() - timedelta(days=days)

    revenue_today = await db.fetchval("SELECT COALESCE(SUM(amount), 0) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND status = 'paid'") or 0
    revenue_month = await db.fetchval("SELECT COALESCE(SUM(amount), 0) FROM orders WHERE DATE(created_at) >= DATE_TRUNC('month', CURRENT_DATE) AND status = 'paid'") or 0

    tokens_today = await db.fetchval("SELECT COALESCE(SUM(amount), 0) FROM token_transactions WHERE DATE(created_at) = CURRENT_DATE AND type = 'purchase'") or 0
    points_earned = await db.fetchval("SELECT COALESCE(SUM(amount), 0) FROM point_transactions WHERE DATE(created_at) = CURRENT_DATE AND source = 'earn'") or 0

    revenue_trend = await db.fetch(
        """
        SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as revenue
        FROM orders WHERE DATE(created_at) >= $1 AND status = 'paid'
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


@router.get("/statistics/courses")
async def get_course_statistics(
    days: int = Query(7, le=30),
    admin: dict = Depends(require_statistics_view),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get course statistics. Requires statistics.view permission."""
    today = datetime.now().date()
    start_date = today - timedelta(days=days)

    total_courses = await db.fetchval("SELECT COUNT(*) FROM stages")
    generated_today = await db.fetchval(
        "SELECT COUNT(*) FROM stages WHERE DATE(created_at) = $1", today
    ) or 0

    trend = await db.fetch(
        """
        SELECT DATE(created_at) as date, COUNT(*) as courses
        FROM stages WHERE DATE(created_at) >= $1
        GROUP BY DATE(created_at) ORDER BY date
        """,
        start_date
    )

    completions = await db.fetch(
        """
        SELECT DATE(created_at) as date, COUNT(*) as completions
        FROM course_completions WHERE DATE(created_at) >= $1
        GROUP BY DATE(created_at) ORDER BY date
        """,
        start_date
    )

    trend_data = []
    for t in trend:
        date_str = t["date"].isoformat()
        comp = next((c["completions"] for c in completions if c["date"] == t["date"]), 0)
        trend_data.append({"date": date_str, "courses": t["courses"], "completions": comp})

    return {
        "total_courses": total_courses or 0,
        "generated_today": generated_today,
        "generation_trend": trend_data
    }


# ============ Settings ============

@router.get("/settings/llm")
async def get_llm_settings(
    admin: dict = Depends(require_settings_manage),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get LLM settings. Requires settings.view permission."""
    configs = await db.fetch("SELECT provider, model, temperature, max_tokens, top_p FROM llm_configs ORDER BY provider")
    return {"configs": [dict(c) for c in configs]}


@router.put("/settings/llm")
async def update_llm_settings(
    configs: List[dict],
    admin: dict = Depends(require_settings_manage),
    db: asyncpg.Connection = Depends(get_db)
):
    """Update LLM settings. Requires settings.edit permission."""
    for config in configs:
        await db.execute(
            """
            UPDATE llm_configs SET model = $2, temperature = $3, max_tokens = $4, top_p = $5, updated_at = $6
            WHERE provider = $1
            """,
            config["provider"], config["model"], config["temperature"], config["max_tokens"], config["top_p"], utcnow()
        )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'settings_update', 'llm_config', '更新LLM配置', $2)
        """,
        admin["id"], utcnow()
    )

    return {"success": True}


@router.get("/settings/pricing")
async def get_pricing_settings(
    admin: dict = Depends(require_settings_manage),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get pricing settings. Requires settings.view permission."""
    # 兼容旧 pricing_configs 表
    pricing = await db.fetch("SELECT type, name, price, tokens, description FROM pricing_configs ORDER BY type, price")
    # 新增：订阅计划 + Token 包（列名匹配实际表结构）
    subscription_plans = await db.fetch("""SELECT id, name, price_monthly, price_yearly, days_monthly, days_yearly, monthly_token_grant, features, active FROM subscription_plans ORDER BY sort_order""")
    token_packages = await db.fetch("""SELECT id, name, price, tokens, bonus, active FROM token_packages ORDER BY sort_order""")
    return {
        "pricing": [dict(p) for p in pricing],
        "subscription_plans": [
            {
                "id": p["id"],
                "name": p["name"],
                "price_monthly": p["price_monthly"] / 100 if p["price_monthly"] else 0,
                "price_yearly": p["price_yearly"] / 100 if p["price_yearly"] else 0,
                "days_monthly": p["days_monthly"],
                "days_yearly": p["days_yearly"],
                "monthly_token_grant": p["monthly_token_grant"],
                "features": p["features"] or [],
                "is_active": p["active"],
            }
            for p in subscription_plans
        ],
        "token_packages": [
            {
                "id": p["id"],
                "name": p["name"],
                "price": p["price"] / 100 if p["price"] else 0,
                "tokens": p["tokens"],
                "bonus": p["bonus"],
                "is_active": p["active"],
            }
            for p in token_packages
        ],
    }


@router.put("/settings/pricing")
async def update_pricing_settings(
    body: dict,
    admin: dict = Depends(require_settings_manage),
    db: asyncpg.Connection = Depends(get_db)
):
    """Update pricing settings. Requires settings.edit permission."""
    # 更新旧 pricing_configs
    pricing = body.get("pricing", [])
    for p in pricing:
        await db.execute(
            """
            UPDATE pricing_configs SET price = $3, tokens = $4, description = $5, updated_at = $6
            WHERE type = $1 AND name = $2
            """,
            p["type"], p["name"], p["price"], p["tokens"], p["description"], utcnow()
        )

    # 更新 subscription_plans（列名匹配实际表结构）
    for sp in body.get("subscription_plans", []):
        await db.execute(
            """
            UPDATE subscription_plans SET price_monthly = $2, price_yearly = $3, monthly_token_grant = $4, active = $5, updated_at = $6
            WHERE id = $1
            """,
            sp["id"], int(sp.get("price_monthly", 0) * 100), int(sp.get("price_yearly", 0) * 100),
            sp.get("monthly_token_grant", 0), sp.get("is_active", True), utcnow()
        )

    # 更新 token_packages（列名匹配实际表结构）
    for tp in body.get("token_packages", []):
        await db.execute(
            """
            UPDATE token_packages SET price = $2, tokens = $3, bonus = $4, active = $5, updated_at = $6
            WHERE id = $1
            """,
            tp["id"], int(tp.get("price", 0) * 100), tp.get("tokens", 0), tp.get("bonus", 0), tp.get("is_active", True), utcnow()
        )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'pricing_update', 'pricing_config', '更新价格配置', $2)
        """,
        admin["id"], utcnow()
    )

    return {"success": True}


@router.get("/settings/rules")
async def get_rules_settings(
    admin: dict = Depends(require_settings_manage),
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
    admin: dict = Depends(require_settings_manage),
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
        admin["id"], utcnow()
    )

    return {"success": True}


# ============ Logs ============

@router.get("/logs")
async def get_admin_logs(
    action: Optional[str] = Query(None),
    limit: int = Query(100, le=200),
    admin: dict = Depends(require_logs_view),
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


# ==================== 订单管理 ====================

@router.get("/orders")
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    order_type: Optional[str] = None,
    user_id: Optional[str] = None,
    admin: dict = Depends(require_finance_view),
    db: asyncpg.Connection = Depends(get_db)
):
    """订单列表。支持按状态/类型/用户筛选。"""
    conditions = ["1=1"]
    params = []
    idx = 1

    if status:
        conditions.append(f"o.status = ${idx}")
        params.append(status)
        idx += 1
    if order_type:
        conditions.append(f"o.order_type = ${idx}")
        params.append(order_type)
        idx += 1
    if user_id:
        try:
            conditions.append(f"o.user_id = ${idx}")
            params.append(uuid.UUID(user_id))
            idx += 1
        except ValueError:
            pass

    where = " AND ".join(conditions)

    total = await db.fetchval(
        f"SELECT COUNT(*) FROM orders o WHERE {where}",
        *params
    )

    params.append(limit)
    idx += 1
    params.append((page - 1) * limit)
    idx += 1

    rows = await db.fetch(
        f"""
        SELECT o.id, o.user_id, o.amount, o.token_amount, o.payment_method,
               o.status, o.order_type, o.subscription_days, o.subscription_plan,
               o.transaction_id, o.paid_at, o.created_at,
               u.email as user_email, u.nickname as user_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE {where}
        ORDER BY o.created_at DESC
        LIMIT ${idx-1} OFFSET ${idx}
        """,
        *params
    )

    return {
        "orders": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/orders/{order_id}")
async def get_order_detail(
    order_id: str,
    admin: dict = Depends(require_finance_view),
    db: asyncpg.Connection = Depends(get_db)
):
    """订单详情"""
    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(400, "无效的订单ID")

    order = await db.fetchrow(
        """
        SELECT o.id, o.user_id, o.amount, o.token_amount, o.payment_method,
               o.status, o.order_type, o.subscription_days, o.subscription_plan,
               o.transaction_id, o.paid_at, o.created_at, o.updated_at,
               u.email as user_email, u.nickname as user_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = $1
        """,
        oid
    )
    if not order:
        raise HTTPException(404, "订单不存在")

    callbacks = await db.fetch(
        "SELECT id, order_id, provider, transaction_id, amount, status, processed, created_at FROM payment_callbacks WHERE order_id = $1 ORDER BY created_at DESC",
        oid
    )

    result = dict(order)
    result["callbacks"] = [dict(c) for c in callbacks]
    return result


# ==================== 订阅管理 ====================

@router.get("/subscriptions")
async def list_subscriptions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    plan_type: Optional[str] = None,
    admin: dict = Depends(require_finance_view),
    db: asyncpg.Connection = Depends(get_db)
):
    """订阅列表"""
    conditions = ["1=1"]
    params = []
    idx = 1

    if status:
        conditions.append(f"s.status = ${idx}")
        params.append(status)
        idx += 1
    if plan_type:
        conditions.append(f"s.plan_type = ${idx}")
        params.append(plan_type)
        idx += 1

    where = " AND ".join(conditions)

    total = await db.fetchval(
        f"SELECT COUNT(*) FROM subscriptions s WHERE {where}",
        *params
    )

    params.append(limit)
    idx += 1
    params.append((page - 1) * limit)

    rows = await db.fetch(
        f"""
        SELECT s.id, s.user_id, s.plan_type, s.status, s.started_at, s.expires_at, s.auto_renew,
               u.email as user_email, u.nickname as user_name
        FROM subscriptions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE {where}
        ORDER BY s.created_at DESC
        LIMIT ${idx-1} OFFSET ${idx}
        """,
        *params
    )

    return {
        "subscriptions": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ==================== LLM 用量明细 ====================

@router.get("/llm-usage")
async def list_llm_usage(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    provider: Optional[str] = None,
    model: Optional[str] = None,
    scene_type: Optional[str] = None,
    user_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    admin: dict = Depends(require_statistics_view),
    db: asyncpg.Connection = Depends(get_db)
):
    """LLM 调用明细列表"""
    conditions = ["1=1"]
    params = []
    idx = 1

    if provider:
        conditions.append(f"provider = ${idx}")
        params.append(provider)
        idx += 1
    if model:
        conditions.append(f"model = ${idx}")
        params.append(model)
        idx += 1
    if scene_type:
        conditions.append(f"scene_type = ${idx}")
        params.append(scene_type)
        idx += 1
    if user_id:
        try:
            conditions.append(f"user_id = ${idx}")
            params.append(uuid.UUID(user_id))
            idx += 1
        except ValueError:
            pass
    if date_from:
        conditions.append(f"created_at >= ${idx}")
        params.append(date_from)
        idx += 1
    if date_to:
        conditions.append(f"created_at <= ${idx}")
        params.append(date_to)
        idx += 1

    where = " AND ".join(conditions)

    total = await db.fetchval(
        f"SELECT COUNT(*) FROM llm_usage_logs WHERE {where}",
        *params
    )

    params.append(limit)
    idx += 1
    params.append((page - 1) * limit)

    rows = await db.fetch(
        f"""
        SELECT id, user_id, provider, model, scene_type,
               prompt_tokens, completion_tokens, total_tokens,
               cost_yuan, duration_ms, status, error_message, created_at
        FROM llm_usage_logs
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT ${idx-1} OFFSET ${idx}
        """,
        *params
    )

    # 汇总统计
    summary = await db.fetchrow(
        f"""
        SELECT COUNT(*) as total_calls,
               COALESCE(SUM(total_tokens), 0) as total_tokens,
               COALESCE(SUM(cost_yuan), 0) as total_cost,
               COALESCE(AVG(duration_ms), 0) as avg_duration
        FROM llm_usage_logs
        WHERE {where}
        """,
        *params[:idx-2]
    )

    return {
        "records": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
        "summary": dict(summary) if summary else {},
    }