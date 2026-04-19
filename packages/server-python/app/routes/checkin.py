"""
学习打卡路由 - 连续学习天数和打卡记录
"""

from fastapi import APIRouter, HTTPException, Depends
from app.db.database import get_db
from app.middleware.auth import get_current_user_id
import asyncpg
import uuid
from datetime import datetime, timedelta
from app.core.time_utils import utcnow

router = APIRouter()


@router.post("/checkin")
async def daily_checkin(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """每日打卡"""
    user_uuid = uuid.UUID(current_user_id)
    today = utcnow().date()

    # 检查今天是否已打卡
    existing = await db.fetchrow(
        """
        SELECT id FROM daily_checkins
        WHERE user_id = $1 AND checkin_date = $2
        """,
        user_uuid, today
    )

    if existing:
        return {
            "message": "今日已打卡",
            "already_checked": True,
        }

    # 获取昨日打卡记录，计算连续天数
    yesterday = today - timedelta(days=1)
    yesterday_checkin = await db.fetchrow(
        """
        SELECT streak_count FROM daily_checkins
        WHERE user_id = $1 AND checkin_date = $2
        """,
        user_uuid, yesterday
    )

    new_streak = (yesterday_checkin["streak_count"] or 0) + 1 if yesterday_checkin else 1

    # 创建今日打卡记录
    await db.execute(
        """
        INSERT INTO daily_checkins (id, user_id, checkin_date, streak_count, created_at)
        VALUES ($1, $2, $3, $4, $5)
        """,
        uuid.uuid4(), user_uuid, today, new_streak, utcnow()
    )

    # 更新用户最大连续天数
    max_streak = await db.fetchval(
        "SELECT MAX(streak_count) FROM daily_checkins WHERE user_id = $1",
        user_uuid
    )
    await db.execute(
        "UPDATE users SET current_streak = $1, max_streak = $2 WHERE id = $3",
        new_streak, max_streak, user_uuid
    )

    # 打卡奖励
    reward_points = 5 if new_streak < 7 else (10 if new_streak < 30 else 20)

    return {
        "message": "打卡成功！",
        "already_checked": False,
        "streak": new_streak,
        "max_streak": max_streak,
        "reward_points": reward_points,
        "streak_bonus": new_streak >= 7 or new_streak >= 30,
    }


@router.get("/me")
async def get_checkin_status(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取打卡状态"""
    user_uuid = uuid.UUID(current_user_id)
    today = utcnow().date()

    # 今日是否打卡
    today_checkin = await db.fetchrow(
        """
        SELECT streak_count FROM daily_checkins
        WHERE user_id = $1 AND checkin_date = $2
        """,
        user_uuid, today
    )

    # 当前连续天数
    current_streak = today_checkin["streak_count"] if today_checkin else 0

    # 如果今日未打卡，检查昨日是否有记录
    if not today_checkin:
        yesterday = today - timedelta(days=1)
        yesterday_checkin = await db.fetchrow(
            "SELECT streak_count FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2",
            user_uuid, yesterday
        )
        current_streak = yesterday_checkin["streak_count"] if yesterday_checkin else 0

    # 最大连续天数
    max_streak = await db.fetchval(
        "SELECT MAX(streak_count) FROM daily_checkins WHERE user_id = $1",
        user_uuid
    ) or 0

    # 最近 7 天打卡记录
    recent_checkins = await db.fetch(
        """
        SELECT checkin_date, streak_count FROM daily_checkins
        WHERE user_id = $1 AND checkin_date >= $2
        ORDER BY checkin_date DESC
        """,
        user_uuid, today - timedelta(days=7)
    )

    # 本月打卡天数
    month_start = today.replace(day=1)
    month_checkins = await db.fetchval(
        """
        SELECT COUNT(*) FROM daily_checkins
        WHERE user_id = $1 AND checkin_date >= $2
        """,
        user_uuid, month_start
    ) or 0

    return {
        "today_checked": bool(today_checkin),
        "current_streak": current_streak,
        "max_streak": max_streak,
        "month_checkins": month_checkins,
        "recent_dates": [c["checkin_date"].isoformat() for c in recent_checkins],
        "streak_level": get_streak_level(current_streak),
    }


@router.get("/leaderboard")
async def get_streak_leaderboard(
    db: asyncpg.Connection = Depends(get_db)
):
    """获取连续学习排行榜"""
    rows = await db.fetch(
        """
        SELECT u.id, u.nickname, u.current_streak, u.max_streak
        FROM users u
        WHERE u.current_streak > 0
        ORDER BY u.current_streak DESC, u.max_streak DESC
        LIMIT 20
        """
    )

    return {
        "leaderboard": [
            {
                "rank": i + 1,
                "user_id": str(row["id"]),
                "nickname": row["nickname"] or "匿名用户",
                "current_streak": row["current_streak"],
                "max_streak": row["max_streak"],
            }
            for i, row in enumerate(rows)
        ],
        "updated_at": utcnow().isoformat(),
    }


def get_streak_level(streak: int) -> str:
    """根据连续天数返回等级"""
    if streak >= 30:
        return "传奇"
    elif streak >= 21:
        return "大师"
    elif streak >= 14:
        return "专家"
    elif streak >= 7:
        return "学徒"
    elif streak >= 3:
        return "新手"
    else:
        return "起步"