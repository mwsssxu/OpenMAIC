"""
用户学习资料路由 - 个人资料页所需的学习统计、周学习数据、成就徽章等
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
import asyncpg
import uuid
from datetime import datetime, timedelta
from app.core.time_utils import utcnow
from typing import Optional, List

router = APIRouter()


# ==================== 成就徽章定义 ====================

ACHIEVEMENT_DEFINITIONS = [
    {"id": "streak_7", "name": "连续7天", "icon": "flame", "color": "coral", "description": "连续学习7天"},
    {"id": "streak_30", "name": "连续30天", "icon": "fire", "color": "coral", "description": "连续学习30天"},
    {"id": "streak_100", "name": "百日传奇", "icon": "crown", "color": "gold", "description": "连续学习100天"},
    {"id": "courses_5", "name": "完成5课", "icon": "book", "color": "mint", "description": "完成5门课程"},
    {"id": "courses_10", "name": "完成10课", "icon": "library", "color": "mint", "description": "完成10门课程"},
    {"id": "notes_50", "name": "笔记达人", "icon": "star", "color": "gold", "description": "创建50条笔记"},
    {"id": "hours_100", "name": "百小时", "icon": "time", "color": "blue", "description": "累计学习100小时"},
    {"id": "hours_500", "name": "五百小时", "icon": "rocket", "color": "blue", "description": "累计学习500小时"},
    {"id": "quiz_80", "name": "测验高手", "icon": "checkmark-circle", "color": "purple", "description": "测验平均分超过80"},
]


# ==================== 学习统计总览 ====================

@router.get("/overview")
async def get_profile_overview(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取用户学习资料总览（首页/个人资料页）"""
    user_uuid = uuid.UUID(current_user_id)

    # 获取用户信息
    user = await db.fetchrow(
        "SELECT id, nickname, avatar_url, email FROM users WHERE id = $1",
        user_uuid
    )

    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 获取连续打卡天数
    today = utcnow().date()
    today_checkin = await db.fetchrow(
        """
        SELECT streak_count FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2
        """,
        user_uuid, today
    )

    streak = today_checkin["streak_count"] if today_checkin else 0
    if streak == 0:
        # 检查昨天是否有打卡
        yesterday = today - timedelta(days=1)
        yesterday_checkin = await db.fetchrow(
            """
            SELECT streak_count FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2
            """,
            user_uuid, yesterday
        )
        streak = yesterday_checkin["streak_count"] if yesterday_checkin else 0

    # 获取在学课程数
    active_courses = await db.fetchval(
        """
        SELECT COUNT(DISTINCT course_id) FROM course_completions
        WHERE user_id = $1 AND completion_status != 'completed'
        """,
        user_uuid
    ) or 0

    # 获取总学习时长（分钟）
    total_minutes = await db.fetchval(
        """
        SELECT COALESCE(SUM(time_spent_minutes), 0) FROM course_completions WHERE user_id = $1
        """,
        user_uuid
    ) or 0

    total_hours = total_minutes / 60

    # 获取本周学习时长
    week_start = today - timedelta(days=today.weekday())
    weekly_minutes = await db.fetchval(
        """
        SELECT COALESCE(SUM(time_spent_minutes), 0) FROM course_completions
        WHERE user_id = $1 AND completed_at >= $2
        """,
        user_uuid, week_start
    ) or 0

    weekly_hours = weekly_minutes / 60

    # 获取周学习数据（每天）
    weekly_data = []
    for i in range(7):
        day = week_start + timedelta(days=i)
        day_minutes = await db.fetchval(
            """
            SELECT COALESCE(SUM(time_spent_minutes), 0) FROM course_completions
            WHERE user_id = $1 AND completed_at >= $2 AND completed_at < $3
            """,
            user_uuid, day, day + timedelta(days=1)
        ) or 0
        weekly_data.append({
            "day": ["一", "二", "三", "四", "五", "六", "日"][i],
            "hours": round(day_minutes / 60, 1),
            "active": day_minutes > 0,
            "today": day == today,
        })

    # 获取成就徽章
    achievements = await get_user_achievements(user_uuid, db, streak, active_courses, total_hours, total_minutes)

    # 获取用户等级（基于总学习时长）
    level = calculate_user_level(total_hours)

    return {
        "user": {
            "nickname": user["nickname"] or user["email"].split("@")[0],
            "avatar_url": user["avatar_url"],
            "email": user["email"],
        },
        "stats": {
            "streak_days": streak,
            "active_courses": active_courses,
            "total_hours": round(total_hours, 1),
        },
        "level": {
            "level": level["level"],
            "title": level["title"],
            "icon": "⭐",
        },
        "weekly_study": {
            "total_hours": round(weekly_hours, 1),
            "daily_data": weekly_data,
        },
        "achievements": achievements,
    }


def calculate_user_level(total_hours: float) -> dict:
    """计算用户等级"""
    if total_hours >= 500:
        return {"level": 20, "title": "学习大师"}
    elif total_hours >= 300:
        return {"level": 15, "title": "学习专家"}
    elif total_hours >= 200:
        return {"level": 12, "title": "学习达人"}
    elif total_hours >= 100:
        return {"level": 10, "title": "学霸"}
    elif total_hours >= 50:
        return {"level": 8, "title": "学霸预备"}
    elif total_hours >= 20:
        return {"level": 5, "title": "学习新星"}
    elif total_hours >= 10:
        return {"level": 3, "title": "入门学徒"}
    else:
        return {"level": 1, "title": "初学者"}


async def get_user_achievements(
    user_uuid: uuid.UUID,
    db: asyncpg.Connection,
    streak: int,
    active_courses: int,
    total_hours: float,
    total_notes: int = 0
) -> List[dict]:
    """获取用户成就徽章（包含已获得和未获得）"""
    # 获取已获得的成就
    earned_rows = await db.fetch(
        """
        SELECT achievement_id FROM user_achievements WHERE user_id = $1
        """,
        user_uuid
    )
    earned_ids = {row["achievement_id"] for row in earned_rows}

    achievements = []
    for ach in ACHIEVEMENT_DEFINITIONS:
        earned = ach["id"] in earned_ids

        # 根据用户实际数据判断是否应该获得
        should_earn = False
        if ach["id"] == "streak_7" and streak >= 7:
            should_earn = True
        elif ach["id"] == "streak_30" and streak >= 30:
            should_earn = True
        elif ach["id"] == "streak_100" and streak >= 100:
            should_earn = True
        elif ach["id"] == "courses_5" and active_courses >= 5:
            should_earn = True
        elif ach["id"] == "courses_10" and active_courses >= 10:
            should_earn = True
        elif ach["id"] == "hours_100" and total_hours >= 100:
            should_earn = True
        elif ach["id"] == "hours_500" and total_hours >= 500:
            should_earn = True

        # 如果应该获得但还没记录，自动添加
        if should_earn and not earned:
            await db.execute(
                """
                INSERT INTO user_achievements (id, user_id, achievement_id, progress, earned_at)
                VALUES ($1, $2, $3, 100, $4)
                ON CONFLICT DO NOTHING
                """,
                uuid.uuid4(), user_uuid, ach["id"], utcnow()
            )
            earned = True

        achievements.append({
            "id": ach["id"],
            "name": ach["name"],
            "icon": ach["icon"],
            "color": ach["color"] if earned else "muted",
            "earned": earned,
            "description": ach["description"],
        })

    return achievements


# ==================== 周学习数据 ====================

@router.get("/weekly-study")
async def get_weekly_study(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取本周学习数据（柱状图）"""
    user_uuid = uuid.UUID(current_user_id)
    today = utcnow().date()
    week_start = today - timedelta(days=today.weekday())

    daily_data = []
    total_hours = 0

    for i in range(7):
        day = week_start + timedelta(days=i)
        day_minutes = await db.fetchval(
            """
            SELECT COALESCE(SUM(time_spent_minutes), 0) FROM course_completions
            WHERE user_id = $1 AND completed_at >= $2 AND completed_at < $3
            """,
            user_uuid, day, day + timedelta(days=1)
        ) or 0

        hours = round(day_minutes / 60, 1)
        total_hours += hours

        daily_data.append({
            "day": ["一", "二", "三", "四", "五", "六", "日"][i],
            "hours": hours,
            "active": day_minutes > 0,
            "today": day == today,
        })

    return {
        "week_start": week_start.isoformat(),
        "total_hours": round(total_hours, 1),
        "daily_data": daily_data,
    }


# ==================== 成就徽章 ====================

@router.get("/achievements")
async def get_profile_achievements(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取用户成就徽章列表"""
    user_uuid = uuid.UUID(current_user_id)

    # 获取用户数据用于判断成就
    today = utcnow().date()
    today_checkin = await db.fetchrow(
        """
        SELECT streak_count FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2
        """,
        user_uuid, today
    )
    streak = today_checkin["streak_count"] if today_checkin else 0

    total_minutes = await db.fetchval(
        """
        SELECT COALESCE(SUM(time_spent_minutes), 0) FROM course_completions WHERE user_id = $1
        """,
        user_uuid
    ) or 0
    total_hours = total_minutes / 60

    completed_courses = await db.fetchval(
        """
        SELECT COUNT(*) FROM course_completions WHERE user_id = $1 AND completion_status = 'completed'
        """,
        user_uuid
    ) or 0

    achievements = await get_user_achievements(user_uuid, db, streak, completed_courses, total_hours, 0)

    # 计算进度
    earned_count = len([a for a in achievements if a["earned"]])

    return {
        "achievements": achievements,
        "earned_count": earned_count,
        "total_count": len(achievements),
        "progress_percentage": round(earned_count / len(achievements) * 100, 1),
    }


# ==================== 学习统计 ====================

@router.get("/learning-stats")
async def get_learning_stats(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取学习统计（连续天数、课程数、时长）"""
    user_uuid = uuid.UUID(current_user_id)
    today = utcnow().date()

    # 连续打卡天数
    today_checkin = await db.fetchrow(
        """
        SELECT streak_count FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2
        """,
        user_uuid, today
    )
    streak = today_checkin["streak_count"] if today_checkin else 0

    if streak == 0:
        yesterday = today - timedelta(days=1)
        yesterday_checkin = await db.fetchrow(
            """
            SELECT streak_count FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2
            """,
            user_uuid, yesterday
        )
        streak = yesterday_checkin["streak_count"] if yesterday_checkin else 0

    # 在学课程数（进行中）
    active_courses = await db.fetchval(
        """
        SELECT COUNT(DISTINCT course_id) FROM course_completions
        WHERE user_id = $1 AND completion_status != 'completed'
        """,
        user_uuid
    ) or 0

    # 总学习时长
    total_minutes = await db.fetchval(
        """
        SELECT COALESCE(SUM(time_spent_minutes), 0) FROM course_completions WHERE user_id = $1
        """,
        user_uuid
    ) or 0

    return {
        "streak_days": streak,
        "active_courses": active_courses,
        "total_hours": round(total_minutes / 60, 1),
        "total_minutes": total_minutes,
    }


# ==================== 设置列表 ====================

@router.get("/settings-options")
async def get_settings_options(
    current_user_id: str = Depends(get_current_user_id),
):
    """获取设置选项列表（静态数据，前端展示用）"""
    return {
        "items": [
            {"id": "profile", "title": "编辑个人资料", "icon": "person", "color": "coral"},
            {"id": "notifications", "title": "通知设置", "icon": "notifications", "color": "mint"},
            {"id": "preferences", "title": "学习偏好", "icon": "settings", "color": "gold"},
            {"id": "darkmode", "title": "深色模式", "icon": "moon", "color": "blue"},
            {"id": "language", "title": "语言设置", "icon": "globe", "color": "purple"},
            {"id": "help", "title": "帮助与反馈", "icon": "help-circle", "color": "purple"},
            {"id": "logout", "title": "退出登录", "icon": "log-out", "color": "coral"},
        ],
    }