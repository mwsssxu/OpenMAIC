"""
成就系统路由 - 用户学习成就和激励
"""

from fastapi import APIRouter, HTTPException, Depends
from app.db.database import get_db
from app.middleware.auth import get_current_user_id
from app.models.achievement import Achievement, UserAchievement, AchievementProgress
import asyncpg
import uuid
from datetime import datetime, timedelta

router = APIRouter()


# ==================== 成就定义 ====================

ACHIEVEMENTS = {
    # 学习时长类
    "first_lesson": {
        "name": "初学者",
        "description": "完成第一个课程",
        "icon": "🎓",
        "category": "learning",
        "points": 10,
    },
    "five_lessons": {
        "name": "探索者",
        "description": "完成 5 个课程",
        "icon": "🗺️",
        "category": "learning",
        "points": 30,
    },
    "ten_lessons": {
        "name": "学者",
        "description": "完成 10 个课程",
        "icon": "📚",
        "category": "learning",
        "points": 50,
    },
    "learning_streak_7": {
        "name": "连续学习者",
        "description": "连续 7 天学习",
        "icon": "🔥",
        "category": "streak",
        "points": 25,
    },
    "learning_streak_30": {
        "name": "学习达人",
        "description": "连续 30 天学习",
        "icon": "⭐",
        "category": "streak",
        "points": 100,
    },

    # 创作类
    "first_create": {
        "name": "创作者",
        "description": "创建第一个课程",
        "icon": "✨",
        "category": "creation",
        "points": 15,
    },
    "five_creates": {
        "name": "内容大师",
        "description": "创建 5 个课程",
        "icon": "🏆",
        "category": "creation",
        "points": 40,
    },
    "share_first": {
        "name": "分享者",
        "description": "首次分享课程",
        "icon": "📤",
        "category": "social",
        "points": 20,
    },

    # 互动类
    "quiz_master": {
        "name": "测验达人",
        "description": "测验正确率达到 90%",
        "icon": "💯",
        "category": "quiz",
        "points": 35,
    },
    "chat_active": {
        "name": "互动达人",
        "description": "与 Agent 互动超过 100 次",
        "icon": "💬",
        "category": "interaction",
        "points": 25,
    },
    "whiteboard_artist": {
        "name": "白板艺术家",
        "description": "在白板上绘制超过 50 个元素",
        "icon": "🎨",
        "category": "interaction",
        "points": 30,
    },

    # 特殊成就
    "early_bird": {
        "name": "早起鸟",
        "description": "在早上 6-8 点学习",
        "icon": "🌅",
        "category": "special",
        "points": 15,
    },
    "night_owl": {
        "name": "夜猫子",
        "description": "在晚上 22-24 点学习",
        "icon": "🌙",
        "category": "special",
        "points": 15,
    },
    "ai_explorer": {
        "name": "AI 探索者",
        "description": "尝试 5 种不同的 Agent 配置",
        "icon": "🤖",
        "category": "special",
        "points": 40,
    },
}


@router.get("")
async def list_achievements():
    """获取所有成就定义"""
    return [
        {
            "id": id_,
            "name": data["name"],
            "description": data["description"],
            "icon": data["icon"],
            "category": data["category"],
            "points": data["points"],
        }
        for id_, data in ACHIEVEMENTS.items()
    ]


@router.get("/me")
async def get_user_achievements(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取用户已获得的成就"""
    rows = await db.fetch(
        """
        SELECT achievement_id, earned_at, progress
        FROM user_achievements
        WHERE user_id = $1
        ORDER BY earned_at DESC
        """,
        uuid.UUID(current_user_id)
    )

    earned = []
    for row in rows:
        ach_data = ACHIEVEMENTS.get(row["achievement_id"])
        if ach_data:
            earned.append({
                "id": row["achievement_id"],
                "name": ach_data["name"],
                "description": ach_data["description"],
                "icon": ach_data["icon"],
                "points": ach_data["points"],
                "earned_at": row["earned_at"].isoformat(),
                "progress": row["progress"],
            })

    # 计算总积分
    total_points = sum(a["points"] for a in earned)

    return {
        "earned_achievements": earned,
        "total_points": total_points,
        "achievement_count": len(earned),
    }


@router.get("/me/progress")
async def get_achievement_progress(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取成就进度（未完成的成就）"""
    user_uuid = uuid.UUID(current_user_id)

    # 获取用户统计数据
    stats = await get_user_stats(db, user_uuid)

    progress = []
    for ach_id, ach_data in ACHIEVEMENTS.items():
        # 检查是否已获得
        earned = await db.fetchrow(
            "SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2",
            user_uuid, ach_id
        )

        if earned:
            continue  # 已获得，跳过

        # 计算进度
        current, target = calculate_progress(ach_id, stats)
        if target > 0:
            progress.append({
                "id": ach_id,
                "name": ach_data["name"],
                "description": ach_data["description"],
                "icon": ach_data["icon"],
                "category": ach_data["category"],
                "current": current,
                "target": target,
                "percentage": min(100, int(current / target * 100)),
            })

    return {"progress": progress}


@router.post("/check")
async def check_and_award_achievements(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """检查并授予成就（学习完成后调用）"""
    user_uuid = uuid.UUID(current_user_id)
    stats = await get_user_stats(db, user_uuid)

    newly_earned = []

    for ach_id, ach_data in ACHIEVEMENTS.items():
        # 检查是否已获得
        already_earned = await db.fetchrow(
            "SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2",
            user_uuid, ach_id
        )

        if already_earned:
            continue

        # 检查是否满足条件
        current, target = calculate_progress(ach_id, stats)
        if current >= target:
            # 授予成就
            await db.execute(
                """
                INSERT INTO user_achievements (id, user_id, achievement_id, progress, earned_at)
                VALUES ($1, $2, $3, $4, $5)
                """,
                uuid.uuid4(), user_uuid, ach_id, current, datetime.utcnow()
            )
            newly_earned.append({
                "id": ach_id,
                "name": ach_data["name"],
                "icon": ach_data["icon"],
                "points": ach_data["points"],
            })

    return {
        "newly_earned": newly_earned,
        "message": f"恭喜获得 {len(newly_earned)} 个新成就！" if newly_earned else "暂无新成就"
    }


# ==================== 辅助函数 ====================

async def get_user_stats(db: asyncpg.Connection, user_uuid) -> dict:
    """获取用户学习统计"""
    # 课程完成数（假设有 completed_at 字段）
    completed_count = await db.fetchval(
        "SELECT COUNT(*) FROM stages WHERE user_id = $1",
        user_uuid
    ) or 0

    # 创建数
    created_count = completed_count  # 目前相同

    # 学习天数（过去 30 天）
    learning_days = await db.fetchval(
        """
        SELECT COUNT(DISTINCT DATE(created_at)) FROM stages
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
        """,
        user_uuid
    ) or 0

    # 连续学习天数
    streak = await calculate_streak(db, user_uuid)

    return {
        "completed_count": completed_count,
        "created_count": created_count,
        "learning_days": learning_days,
        "streak": streak,
        "quiz_accuracy": 0.85,  # TODO: 实际计算
        "chat_count": 0,  # TODO: 实际计算
        "whiteboard_count": 0,  # TODO: 实际计算
    }


async def calculate_streak(db: asyncpg.Connection, user_uuid) -> int:
    """计算连续学习天数"""
    # 获取最近学习日期
    dates = await db.fetch(
        """
        SELECT DISTINCT DATE(created_at) as date
        FROM stages WHERE user_id = $1
        ORDER BY date DESC LIMIT 30
        """,
        user_uuid
    )

    if not dates:
        return 0

    streak = 0
    today = datetime.utcnow().date()

    for i, row in enumerate(dates):
        expected_date = today - timedelta(days=i)
        if row["date"] == expected_date:
            streak += 1
        else:
            break

    return streak


def calculate_progress(ach_id: str, stats: dict) -> tuple[int, int]:
    """计算成就进度"""
    if ach_id == "first_lesson":
        return (stats["completed_count"], 1)
    elif ach_id == "five_lessons":
        return (stats["completed_count"], 5)
    elif ach_id == "ten_lessons":
        return (stats["completed_count"], 10)
    elif ach_id == "first_create":
        return (stats["created_count"], 1)
    elif ach_id == "five_creates":
        return (stats["created_count"], 5)
    elif ach_id == "learning_streak_7":
        return (stats["streak"], 7)
    elif ach_id == "learning_streak_30":
        return (stats["streak"], 30)
    elif ach_id == "quiz_master":
        return (int(stats["quiz_accuracy"] * 100), 90)
    elif ach_id == "chat_active":
        return (stats["chat_count"], 100)
    elif ach_id == "whiteboard_artist":
        return (stats["whiteboard_count"], 50)
    else:
        return (0, 1)