"""
游戏化增强路由 - 每日任务、联赛等级、奖励递增、成就系统、庆典效果
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.core.redis import invalidate_balance_cache
import asyncpg
import uuid
from datetime import datetime, timedelta
from app.core.time_utils import utcnow
from typing import Optional, Dict, Any, List
import random

router = APIRouter()


# ==================== 庆典效果配置 ====================

CELEBRATION_EFFECTS = {
    # 任务完成效果
    "task_complete": {
        "animation": "confetti",
        "duration": 1.5,
        "sound": "ding",
        "vibration": "short",
        "message_template": "完成任务！获得 {points} 积分",
        "color": "#4CAF50",
    },
    # 成就解锁效果
    "achievement_unlock": {
        "animation": "fireworks",
        "duration": 2.0,
        "sound": "trumpet",
        "vibration": "medium",
        "message_template": "解锁成就「{name}」！",
        "color": "#FFD700",
    },
    # 连续打卡里程碑
    "streak_milestone": {
        "animation": "sparkle",
        "duration": 2.5,
        "sound": "applause",
        "vibration": "long",
        "message_template": "连续打卡 {days} 天！奖励 {reward} 积分",
        "color": "#9C27B0",
    },
    # 联赛升级
    "league_upgrade": {
        "animation": "cascade",
        "duration": 3.0,
        "sound": "fanfare",
        "vibration": "pattern",
        "message_template": "晋级至 {league}！",
        "color": "#E91E63",
    },
    # 隐藏成就（惊喜）
    "hidden_achievement": {
        "animation": "mystery",
        "duration": 2.5,
        "sound": "magic",
        "vibration": "double",
        "message_template": "惊喜解锁！隐藏成就「{name}」",
        "color": "#673AB7",
    },
}


# ==================== 稀有度等级 ====================

RARITY_LEVELS = {
    "common": {"name": "普通", "color": "#9E9E9E", "glow": False, "chance": 0.6},
    "rare": {"name": "稀有", "color": "#2196F3", "glow": True, "chance": 0.25},
    "epic": {"name": "史诗", "color": "#9C27B0", "glow": True, "chance": 0.12},
    "legendary": {"name": "传说", "color": "#FFD700", "glow": True, "chance": 0.03},
}


# ==================== 增量奖励配置 ====================

# 打卡奖励递增逻辑
STREAK_REWARDS = {
    1: 5,    # 第1天
    2: 10,   # 第2天+5
    3: 15,   # 第3天+5
    4: 20,   # 第4天+5
    5: 25,   # 第5天+5
    6: 30,   # 第6天+5
    7: 60,   # 第7天+30 (周奖励)
    # 循环周期，每7天重置递增
}

# 联赛等级划分
LEAGUE_TIERS = {
    "bronze": {"name": "铜牌", "min_points": 0, "max_points": 100, "icon": "🥉"},
    "silver": {"name": "银牌", "min_points": 101, "max_points": 300, "icon": "🥈"},
    "gold": {"name": "金牌", "min_points": 301, "max_points": 600, "icon": "🥇"},
    "platinum": {"name": "铂金", "min_points": 601, "max_points": 1000, "icon": "💎"},
    "diamond": {"name": "钻石", "min_points": 1001, "max_points": 1500, "icon": "💠"},
    "master": {"name": "大师", "min_points": 1501, "max_points": 2500, "icon": "🏅"},
    "champion": {"name": "冠军", "min_points": 2501, "max_points": None, "icon": "👑"},
}

# 每日任务配置
DAILY_TASKS = {
    "checkin": {
        "name": "每日打卡",
        "description": "完成每日学习打卡",
        "reward_points": 5,
        "type": "checkin",
        "icon": "📅",
        "animation": "pulse",
    },
    "learn_30min": {
        "name": "学习30分钟",
        "description": "累计学习时长达到30分钟",
        "reward_points": 10,
        "type": "time",
        "target": 30,
        "icon": "⏰",
        "animation": "slideIn",
    },
    "complete_quiz": {
        "name": "完成测验",
        "description": "完成任意课程的测验",
        "reward_points": 15,
        "type": "quiz",
        "target": 1,
        "icon": "📝",
        "animation": "bounce",
    },
    "interact_agent": {
        "name": "与AI互动",
        "description": "与智能体进行至少5次互动",
        "reward_points": 10,
        "type": "interaction",
        "target": 5,
        "icon": "🤖",
        "animation": "fadeIn",
    },
    "share_note": {
        "name": "分享笔记",
        "description": "发布一条共享笔记",
        "reward_points": 20,
        "type": "note",
        "target": 1,
        "icon": "📤",
        "animation": "scaleUp",
    },
    "answer_question": {
        "name": "回答问题",
        "description": "在问答区回答一个问题",
        "reward_points": 15,
        "type": "qanda",
        "target": 1,
        "icon": "💡",
        "animation": "glow",
    },
}


# ==================== 隐藏成就配置 ====================

HIDDEN_ACHIEVEMENTS = {
    # 惊喜类（随机触发）
    "lucky_checkin": {
        "name": "幸运打卡",
        "description": "打卡时触发幸运奖励",
        "icon": "🍀",
        "rarity": "rare",
        "trigger": "random",
        "trigger_chance": 0.05,  # 5%概率
        "reward_points": 50,
    },
    "night_scholar": {
        "name": "深夜学者",
        "description": "在午夜（23:00-01:00）学习",
        "icon": "🌙",
        "rarity": "rare",
        "trigger": "time",
        "trigger_hours": [23, 0],
        "reward_points": 30,
    },
    "speed_master": {
        "name": "闪电快手",
        "description": "5分钟内完成测验且正确率>80%",
        "icon": "⚡",
        "rarity": "epic",
        "trigger": "quiz_speed",
        "reward_points": 100,
    },
    # 里程碑类
    "week_warrior": {
        "name": "周战士",
        "description": "连续学习满7天",
        "icon": "🔥",
        "rarity": "common",
        "trigger": "streak",
        "streak_target": 7,
        "reward_points": 60,
    },
    "month_master": {
        "name": "月度大师",
        "description": "连续学习满30天",
        "icon": "🏆",
        "rarity": "epic",
        "trigger": "streak",
        "streak_target": 30,
        "reward_points": 200,
    },
    "legend_100": {
        "name": "百日传奇",
        "description": "连续学习满100天",
        "icon": "👑",
        "rarity": "legendary",
        "trigger": "streak",
        "streak_target": 100,
        "reward_points": 1000,
    },
    # 特殊类
    "first_friend": {
        "name": "社交先锋",
        "description": "首次邀请好友成功",
        "icon": "👋",
        "rarity": "rare",
        "trigger": "invitation",
        "reward_points": 50,
    },
    "helper_star": {
        "name": "帮助之星",
        "description": "回答被采纳超过10次",
        "icon": "⭐",
        "rarity": "epic",
        "trigger": "answers_adopted",
        "target": 10,
        "reward_points": 150,
    },
}


# ==================== 增量奖励计算 ====================

def calculate_streak_reward(streak: int) -> int:
    """计算连续打卡奖励（递增逻辑）"""
    if streak <= 0:
        return 0

    # 7天周期奖励
    cycle_base = ((streak - 1) // 7) * 60  # 每完成一周加60

    # 当前周期内天数奖励
    day_in_cycle = ((streak - 1) % 7) + 1

    # 递增奖励: 5 + (day-1)*5 = 5,10,15,20,25,30
    day_reward = 5 + (day_in_cycle - 1) * 5

    # 第7天额外加30（已在STREAK_REWARDS中）
    if day_in_cycle == 7:
        day_reward = 60

    return cycle_base + day_reward


def get_next_reward(streak: int) -> dict:
    """获取下一个奖励信息"""
    day_in_cycle = ((streak - 1) % 7) + 1 if streak > 0 else 0
    next_day = streak + 1
    next_reward = calculate_streak_reward(next_day)
    current_reward = calculate_streak_reward(streak)

    return {
        "next_day": next_day,
        "next_reward": next_reward,
        "reward_increase": next_reward - current_reward,
        "is_cycle_end": day_in_cycle == 7,
        "cycle_progress": day_in_cycle,
    }


# ==================== 联赛等级 ====================

def get_user_league(total_points: int) -> dict:
    """根据积分获取联赛等级"""
    for tier_id, tier_data in LEAGUE_TIERS.items():
        min_p = tier_data["min_points"]
        max_p = tier_data["max_points"]

        if max_p is None:
            if total_points >= min_p:
                return {
                    "tier": tier_id,
                    "name": tier_data["name"],
                    "icon": tier_data["icon"],
                    "current_points": total_points,
                    "next_tier": None,
                    "points_to_next": None,
                }
        else:
            if min_p <= total_points <= max_p:
                # 找下一个等级
                next_tier = None
                next_min = None
                tiers_list = list(LEAGUE_TIERS.items())
                for i, (tid, tdata) in enumerate(tiers_list):
                    if tid == tier_id and i + 1 < len(tiers_list):
                        next_tier = tiers_list[i + 1][0]
                        next_min = tiers_list[i + 1][1]["min_points"]

                return {
                    "tier": tier_id,
                    "name": tier_data["name"],
                    "icon": tier_data["icon"],
                    "current_points": total_points,
                    "next_tier": next_tier,
                    "points_to_next": next_min - total_points if next_min else None,
                }

    return {
        "tier": "bronze",
        "name": "铜牌",
        "icon": "🥉",
        "current_points": total_points,
        "next_tier": "silver",
        "points_to_next": 101 - total_points,
    }


@router.get("/league")
async def get_my_league(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取我的联赛等级"""
    user_uuid = uuid.UUID(current_user_id)

    # 获取用户总积分
    total_points = await db.fetchval(
        """
        SELECT COALESCE(SUM(amount), 0) as total_points
        FROM point_transactions WHERE user_id = $1
        """,
        user_uuid
    ) or 0

    league = get_user_league(total_points)

    # 获取联赛排行榜位置
    rank = await db.fetchval(
        """
        SELECT COUNT(*) + 1 FROM (
            SELECT user_id, SUM(amount) as total
            FROM point_transactions
            GROUP BY user_id
            HAVING SUM(amount) > $1
        ) subq
        """,
        total_points
    ) or 1

    league["rank"] = rank

    return league


@router.get("/league/leaderboard")
async def get_league_leaderboard(
    tier: str = None,
    db: asyncpg.Connection = Depends(get_db)
):
    """获取联赛排行榜"""
    # 获取所有用户积分排名
    rows = await db.fetch(
        """
        SELECT pt.user_id, SUM(pt.amount) as total_points, u.nickname, u.avatar_url
        FROM point_transactions pt
        JOIN users u ON u.id = pt.user_id
        GROUP BY pt.user_id, u.nickname, u.avatar_url
        ORDER BY total_points DESC
        LIMIT 50
        """
    )

    leaderboard = []
    for i, row in enumerate(rows):
        league_info = get_user_league(row["total_points"])

        if tier and league_info["tier"] != tier:
            continue

        leaderboard.append({
            "rank": i + 1,
            "user_id": str(row["user_id"]),
            "nickname": row["nickname"],
            "avatar_url": row["avatar_url"],
            "total_points": row["total_points"],
            "tier": league_info["tier"],
            "tier_name": league_info["name"],
            "tier_icon": league_info["icon"],
        })

    return {
        "leaderboard": leaderboard[:20] if tier else leaderboard,
        "updated_at": utcnow().isoformat(),
    }


# ==================== 每日任务 ====================

@router.get("/tasks")
async def get_daily_tasks(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取今日任务列表"""
    user_uuid = uuid.UUID(current_user_id)
    today = utcnow().date()

    # 获取今日任务完成状态
    completed_tasks = await db.fetch(
        """
        SELECT task_id, completed, progress, completed_at
        FROM daily_task_progress
        WHERE user_id = $1 AND task_date = $2
        """,
        user_uuid, today
    )

    completed_dict = {row["task_id"]: row for row in completed_tasks}

    tasks = []
    total_reward = 0
    completed_reward = 0

    for task_id, task_data in DAILY_TASKS.items():
        progress_row = completed_dict.get(task_id)

        is_completed = progress_row and progress_row["completed"]
        progress = progress_row["progress"] if progress_row else 0
        target = task_data.get("target", 1)

        task_info = {
            "id": task_id,
            "name": task_data["name"],
            "description": task_data["description"],
            "reward_points": task_data["reward_points"],
            "type": task_data["type"],
            "completed": is_completed,
            "progress": progress,
            "target": target,
            "percentage": min(100, int(progress / target * 100)) if target > 0 else 0,
        }

        tasks.append(task_info)
        total_reward += task_data["reward_points"]
        if is_completed:
            completed_reward += task_data["reward_points"]

    return {
        "tasks": tasks,
        "total_tasks": len(tasks),
        "completed_tasks": len([t for t in tasks if t["completed"]]),
        "total_reward": total_reward,
        "completed_reward": completed_reward,
        "task_date": today.isoformat(),
    }


@router.post("/tasks/{task_id}/progress")
async def update_task_progress(
    task_id: str,
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """更新任务进度"""
    user_uuid = uuid.UUID(current_user_id)
    today = utcnow().date()

    if task_id not in DAILY_TASKS:
        raise HTTPException(status_code=404, detail="任务不存在")

    progress = body.get("progress", 1)
    task_data = DAILY_TASKS[task_id]
    target = task_data.get("target", 1)

    # 检查今日任务记录
    existing = await db.fetchrow(
        """
        SELECT id, progress, completed FROM daily_task_progress
        WHERE user_id = $1 AND task_id = $2 AND task_date = $3
        """,
        user_uuid, task_id, today
    )

    is_completed = False
    new_progress = progress

    if existing:
        new_progress = existing["progress"] + progress
        is_completed = new_progress >= target

        await db.execute(
            """
            UPDATE daily_task_progress
            SET progress = $1, completed = $2, completed_at = $3
            WHERE id = $4
            """,
            new_progress, is_completed,
            utcnow() if is_completed else None,
            existing["id"]
        )
    else:
        is_completed = progress >= target
        await db.execute(
            """
            INSERT INTO daily_task_progress
            (id, user_id, task_id, task_date, progress, completed, completed_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            uuid.uuid4(), user_uuid, task_id, today,
            new_progress, is_completed,
            utcnow() if is_completed else None,
            utcnow()
        )

    # 如果任务完成且之前未完成，发放奖励
    reward_issued = False
    if is_completed and (not existing or not existing["completed"]):
        reward_points = task_data["reward_points"]

        # 发放积分 - 使用FOR UPDATE锁防止并发
        point_account = await db.fetchrow(
            "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
            user_uuid
        )

        if point_account:
            new_balance = point_account["balance"] + reward_points
            await db.execute(
                "UPDATE point_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
                new_balance, utcnow(), user_uuid
            )
            await db.execute(
                """
                INSERT INTO point_transactions
                (id, user_id, source, amount, balance_after, reference_id, created_at)
                VALUES ($1, $2, 'daily_task', $3, $4, $5, $6)
                """,
                uuid.uuid4(), user_uuid, reward_points, new_balance,
                uuid.UUID(task_id) if len(task_id) == 36 else None,
                utcnow()
            )
            await invalidate_balance_cache(current_user_id)
            reward_issued = True

    return {
        "task_id": task_id,
        "progress": new_progress,
        "target": target,
        "completed": is_completed,
        "reward_issued": reward_issued,
        "reward_points": task_data["reward_points"] if reward_issued else 0,
    }


@router.post("/tasks/checkin-complete")
async def complete_checkin_task(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """完成打卡任务（打卡后调用）"""
    user_uuid = uuid.UUID(current_user_id)
    today = utcnow().date()

    # 检查打卡任务是否已完成
    existing = await db.fetchrow(
        """
        SELECT id, completed FROM daily_task_progress
        WHERE user_id = $1 AND task_id = 'checkin' AND task_date = $2
        """,
        user_uuid, today
    )

    if existing and existing["completed"]:
        return {"task_id": "checkin", "already_completed": True}

    # 标记完成并发放奖励
    task_data = DAILY_TASKS["checkin"]

    if existing:
        await db.execute(
            """
            UPDATE daily_task_progress
            SET progress = 1, completed = TRUE, completed_at = $1
            WHERE id = $2
            """,
            utcnow(), existing["id"]
        )
    else:
        await db.execute(
            """
            INSERT INTO daily_task_progress
            (id, user_id, task_id, task_date, progress, completed, completed_at, created_at)
            VALUES ($1, $2, 'checkin', $3, 1, TRUE, $4, $5)
            """,
            uuid.uuid4(), user_uuid, today, utcnow(), utcnow()
        )

    # 发放积分奖励
    reward_points = task_data["reward_points"]
    point_account = await db.fetchrow(
        "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
        user_uuid
    )

    if point_account:
        new_balance = point_account["balance"] + reward_points
        await db.execute(
            "UPDATE point_accounts SET balance = $1 WHERE user_id = $2",
            new_balance, user_uuid
        )
        await db.execute(
            """
            INSERT INTO point_transactions
            (id, user_id, source, amount, balance_after, created_at)
            VALUES ($1, $2, 'daily_task', $3, $4, $5)
            """,
            uuid.uuid4(), user_uuid, reward_points, new_balance, utcnow()
        )
        await invalidate_balance_cache(current_user_id)

    return {
        "task_id": "checkin",
        "completed": True,
        "reward_points": reward_points,
        "message": f"完成任务「{task_data['name']}」，获得 {reward_points} 积分",
    }


# ==================== 增量奖励信息 ====================

@router.get("/streak-rewards")
async def get_streak_reward_info(
    streak: int = 0,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取打卡奖励递增信息"""
    user_uuid = uuid.UUID(current_user_id)

    # 如果未传 streak 参数，获取用户当前连续天数
    if streak == 0:
        today = utcnow().date()
        today_checkin = await db.fetchrow(
            """
            SELECT streak_count FROM daily_checkins
            WHERE user_id = $1 AND checkin_date = $2
            """,
            user_uuid, today
        )

        if today_checkin:
            streak = today_checkin["streak_count"]
        else:
            yesterday = today - timedelta(days=1)
            yesterday_checkin = await db.fetchrow(
                """
                SELECT streak_count FROM daily_checkins
                WHERE user_id = $1 AND checkin_date = $2
                """,
                user_uuid, yesterday
            )
            streak = yesterday_checkin["streak_count"] if yesterday_checkin else 0

    current_reward = calculate_streak_reward(streak)
    next_reward_info = get_next_reward(streak)

    # 展示未来7天奖励预览
    preview = []
    for day in range(streak + 1, streak + 8):
        preview.append({
            "day": day,
            "reward": calculate_streak_reward(day),
            "is_cycle_end": (day % 7) == 0,
        })

    return {
        "current_streak": streak,
        "current_reward": current_reward,
        "next_reward_info": next_reward_info,
        "reward_preview": preview,
    }


# ==================== 庆典效果API ====================

@router.get("/celebration/{event_type}")
async def get_celebration_effect(
    event_type: str,
    points: int = 0,
    name: str = "",
    days: int = 0,
    league: str = "",
):
    """获取庆典效果配置（前端渲染用）"""
    effect = CELEBRATION_EFFECTS.get(event_type)
    if not effect:
        raise HTTPException(status_code=404, detail=f"庆典效果 '{event_type}' 不存在")

    # 生成动态消息
    message = effect["message_template"].format(
        points=points, name=name, days=days, league=league, reward=points
    )

    return {
        "event_type": event_type,
        "animation": effect["animation"],
        "duration": effect["duration"],
        "sound": effect["sound"],
        "vibration": effect["vibration"],
        "message": message,
        "color": effect["color"],
        "particles": get_particle_config(effect["animation"]),
    }


def get_particle_config(animation_type: str) -> Dict:
    """根据动画类型返回粒子配置"""
    configs = {
        "confetti": {
            "count": 50,
            "colors": ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3"],
            "spread": 70,
            "origin": {"y": 0.7},
        },
        "fireworks": {
            "count": 30,
            "colors": ["#FFD700", "#FF6B6B", "#9C27B0", "#2196F3"],
            "spread": 180,
            "origin": {"y": 0.5},
        },
        "sparkle": {
            "count": 20,
            "colors": ["#9C27B0", "#E91E63", "#FFD700"],
            "spread": 50,
            "origin": {"y": 0.3},
        },
        "cascade": {
            "count": 100,
            "colors": ["#E91E63", "#FF6B6B", "#FFE66D"],
            "spread": 90,
            "origin": {"y": 1},
        },
        "mystery": {
            "count": 40,
            "colors": ["#673AB7", "#9C27B0", "#E91E63", "#FFD700"],
            "spread": 360,
            "origin": {"y": 0.5},
        },
    }
    return configs.get(animation_type, configs["confetti"])


# ==================== 隐藏成就触发 ====================

@router.post("/check-hidden-achievements")
async def check_hidden_achievements(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """检查隐藏成就触发条件"""
    user_uuid = uuid.UUID(current_user_id)
    trigger_type = body.get("trigger_type", "")
    context = body.get("context", {})

    unlocked = []

    for ach_id, ach_data in HIDDEN_ACHIEVEMENTS.items():
        # 检查是否已获得
        already_earned = await db.fetchrow(
            "SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2",
            user_uuid, ach_id
        )
        if already_earned:
            continue

        # 检查触发条件
        if should_unlock_hidden(ach_data, trigger_type, context):
            # 授予隐藏成就
            await db.execute(
                """
                INSERT INTO user_achievements (id, user_id, achievement_id, progress, earned_at)
                VALUES ($1, $2, $3, $4, $5)
                """,
                uuid.uuid4(), user_uuid, ach_id, 100, utcnow()
            )

            # 发放奖励积分
            reward_points = ach_data["reward_points"]
            await grant_reward_points(db, user_uuid, reward_points, ach_id)

            rarity_info = RARITY_LEVELS[ach_data["rarity"]]
            unlocked.append({
                "id": ach_id,
                "name": ach_data["name"],
                "description": ach_data["description"],
                "icon": ach_data["icon"],
                "rarity": ach_data["rarity"],
                "rarity_name": rarity_info["name"],
                "rarity_color": rarity_info["color"],
                "reward_points": reward_points,
                "celebration": get_celebration_effect_internal("hidden_achievement", reward_points, ach_data["name"]),
            })

    return {
        "unlocked_count": len(unlocked),
        "unlocked_achievements": unlocked,
        "message": f"惊喜解锁 {len(unlocked)} 个隐藏成就！" if unlocked else "",
    }


def should_unlock_hidden(ach_data: dict, trigger_type: str, context: dict) -> bool:
    """判断是否应该解锁隐藏成就"""
    trigger = ach_data.get("trigger")

    if trigger == "random":
        # 随机触发
        if trigger_type == "checkin":
            return random.random() < ach_data.get("trigger_chance", 0.05)

    elif trigger == "time":
        # 时间触发
        current_hour = context.get("hour", utcnow().hour)
        trigger_hours = ach_data.get("trigger_hours", [])
        return current_hour in trigger_hours

    elif trigger == "streak":
        # 连续天数触发
        streak = context.get("streak", 0)
        return streak >= ach_data.get("streak_target", 999)

    elif trigger == "quiz_speed":
        # 测验速度触发
        duration = context.get("duration", 999)
        accuracy = context.get("accuracy", 0)
        return duration <= 5 and accuracy > 0.8

    elif trigger == "invitation":
        # 邀请触发
        return trigger_type == "invitation_success"

    elif trigger == "answers_adopted":
        # 回答采纳触发
        adopted_count = context.get("adopted_count", 0)
        return adopted_count >= ach_data.get("target", 999)

    return False


async def grant_reward_points(db: asyncpg.Connection, user_uuid: uuid.UUID, amount: int, source: str):
    """发放奖励积分"""
    point_account = await db.fetchrow(
        "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
        user_uuid
    )

    if point_account:
        new_balance = point_account["balance"] + amount
        await db.execute(
            "UPDATE point_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
            new_balance, utcnow(), user_uuid
        )
        await db.execute(
            """
            INSERT INTO point_transactions (id, user_id, source, amount, balance_after, created_at)
            VALUES ($1, $2, 'hidden_achievement', $3, $4, $5)
            """,
            uuid.uuid4(), user_uuid, amount, new_balance, utcnow()
        )


def get_celebration_effect_internal(event_type: str, points: int = 0, name: str = "") -> dict:
    """内部函数：获取庆典效果"""
    effect = CELEBRATION_EFFECTS.get(event_type, CELEBRATION_EFFECTS["task_complete"])
    message = effect["message_template"].format(points=points, name=name, days=0, league="", reward=points)
    return {
        "animation": effect["animation"],
        "duration": effect["duration"],
        "sound": effect["sound"],
        "vibration": effect["vibration"],
        "message": message,
        "color": effect["color"],
    }


# ==================== 增强任务完成（带庆典效果） ====================

@router.post("/tasks/{task_id}/complete-with-celebration")
async def complete_task_with_celebration(
    task_id: str,
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """完成任务并返回庆典效果数据"""
    # 先调用原有的进度更新逻辑
    result = await update_task_progress(task_id, body, current_user_id, db)

    if result.get("reward_issued"):
        task_data = DAILY_TASKS.get(task_id, {})
        # 返回庆典效果
        result["celebration"] = get_celebration_effect_internal(
            "task_complete",
            result["reward_points"]
        )
        result["task_icon"] = task_data.get("icon", "✅")
        result["task_animation"] = task_data.get("animation", "fadeIn")

    return result


# ==================== 稀有度信息 ====================

@router.get("/rarity-levels")
async def get_rarity_levels():
    """获取稀有度等级配置"""
    return [
        {
            "id": id_,
            "name": data["name"],
            "color": data["color"],
            "glow": data["glow"],
            "chance": data["chance"],
        }
        for id_, data in RARITY_LEVELS.items()
    ]


# ==================== 用户激励总览 ====================

@router.get("/overview")
async def get_gamification_overview(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取用户激励系统总览（一页展示所有激励信息）"""
    user_uuid = uuid.UUID(current_user_id)

    # 获取联赛信息
    total_points = await db.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM point_transactions WHERE user_id = $1",
        user_uuid
    ) or 0
    league = get_user_league(total_points)

    # 获取打卡状态
    today = utcnow().date()
    today_checkin = await db.fetchrow(
        "SELECT streak_count FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2",
        user_uuid, today
    )
    streak = today_checkin["streak_count"] if today_checkin else 0

    # 获取今日学习分钟数
    today_minutes = await db.fetchval(
        """SELECT COALESCE(SUM(duration_seconds), 0) / 60
           FROM learning_records
           WHERE user_id = $1 AND DATE(created_at) = $2""",
        user_uuid, today
    ) or 0

    # 获取近7天打卡日期
    recent_dates_rows = await db.fetch(
        """SELECT checkin_date FROM daily_checkins
           WHERE user_id = $1 AND checkin_date >= $2
           ORDER BY checkin_date DESC""",
        user_uuid, today - timedelta(days=7)
    )
    recent_dates = [r["checkin_date"].isoformat() for r in recent_dates_rows]

    # 获取任务完成情况
    tasks_result = await get_daily_tasks(current_user_id, db)

    # 获取成就信息
    achievements_rows = await db.fetch(
        """SELECT achievement_id, earned_at, progress
           FROM user_achievements WHERE user_id = $1
           ORDER BY earned_at DESC""",
        user_uuid
    )
    
    # 导入成就配置
    from app.routes.achievements import ACHIEVEMENTS
    
    earned_achievements = []
    for row in achievements_rows:
        ach_data = ACHIEVEMENTS.get(row["achievement_id"])
        if ach_data:
            earned_achievements.append({
                "id": row["achievement_id"],
                "name": ach_data["name"],
                "icon": ach_data["icon"],
                "description": ach_data["description"],
                "category": ach_data.get("category", "learning"),
                "points": ach_data.get("points", 0),
                "earned_at": row["earned_at"].isoformat(),
            })
    
    # 获取成就进度（未获得的）
    progress_rows = await db.fetch(
        """SELECT achievement_id, progress FROM user_achievements
           WHERE user_id = $1 AND progress < 100
           ORDER BY progress DESC LIMIT 3""",
        user_uuid
    )
    
    next_achievements = []
    for row in progress_rows:
        ach_data = ACHIEVEMENTS.get(row["achievement_id"])
        if ach_data:
            next_achievements.append({
                "id": row["achievement_id"],
                "name": ach_data["name"],
                "icon": ach_data["icon"],
                "description": ach_data["description"],
                "current": row["progress"],
                "target": ach_data.get("target", 1),
                "percentage": min(100, int(row["progress"] / max(ach_data.get("target", 1), 1) * 100)),
            })

    # 获取搭子信息
    buddy_config = await db.fetchrow(
        """SELECT buddy_name, active
           FROM buddy_configs
           WHERE user_id = $1 AND active = TRUE""",
        user_uuid
    )
    
    buddy_info = {"has_buddy": False}
    if buddy_config:
        buddy_info = {
            "has_buddy": True,
            "buddy_name": buddy_config["buddy_name"] or "学习搭子",
        }

    # 获取积分统计
    today_points = await db.fetchval(
        """SELECT COALESCE(SUM(amount), 0) FROM point_transactions
           WHERE user_id = $1 AND DATE(created_at) = $2""",
        user_uuid, today
    ) or 0
    
    week_points = await db.fetchval(
        """SELECT COALESCE(SUM(amount), 0) FROM point_transactions
           WHERE user_id = $1 AND created_at >= $2""",
        user_uuid, today - timedelta(days=7)
    ) or 0
    
    current_balance = await db.fetchval(
        "SELECT balance FROM point_accounts WHERE user_id = $1", user_uuid
    ) or 0

    # 检查隐藏成就里程碑
    hidden_unlocked = []
    for ach_id, ach_data in HIDDEN_ACHIEVEMENTS.items():
        if ach_data.get("trigger") == "streak":
            streak_target = ach_data.get("streak_target", 999)
            if streak >= streak_target:
                already_earned = await db.fetchrow(
                    "SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2",
                    user_uuid, ach_id
                )
                if not already_earned:
                    hidden_unlocked.append({
                        "id": ach_id,
                        "name": ach_data["name"],
                        "icon": ach_data["icon"],
                        "rarity": ach_data["rarity"],
                        "streak_target": streak_target,
                    })

    return {
        "league": league,
        "streak": {
            "current": streak,
            "today_checked": bool(today_checkin),
            "today_learning_minutes": int(today_minutes),
            "reward_preview": calculate_streak_reward(streak + 1) if not today_checkin else 0,
            "streak_level": get_streak_level(streak),
            "recent_dates": recent_dates,
        },
        "tasks": {
            "total": tasks_result["total_tasks"],
            "completed": tasks_result["completed_tasks"],
            "total_reward_available": tasks_result["total_reward"],
            "reward_earned": tasks_result["completed_reward"],
            "items": tasks_result.get("tasks", []),
        },
        "achievements": {
            "earned": len(earned_achievements),
            "total": len(ACHIEVEMENTS),
            "items": earned_achievements[:10],
            "next_achievements": next_achievements,
        },
        "buddy": buddy_info,
        "points": {
            "current_balance": current_balance,
            "today_earned": today_points,
            "this_week_earned": week_points,
        },
        "pending_milestones": hidden_unlocked,
        "motivation_message": get_motivation_message(streak, tasks_result["completed_tasks"], len(earned_achievements)),
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


def get_motivation_message(streak: int, tasks_completed: int, achievements: int) -> str:
    """生成激励消息"""
    if streak >= 30:
        return "你是学习传奇！继续保持！"
    elif streak >= 7:
        return "连续学习一周！太棒了！"
    elif tasks_completed >= 5:
        return "今日任务达人！继续加油！"
    elif achievements >= 5:
        return "成就收集者！更多成就等你解锁！"
    elif streak == 0:
        return "开始你的学习之旅吧！"
    else:
        return f"已连续学习{streak}天，继续保持！"


# ==================== 学习时长上报 ====================

@router.post("/report-learning-time")
async def report_learning_time(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """前端定时上报学习时长"""
    minutes = min(body.get("minutes", 0), 30)  # 单次上限30分钟防刷
    user_uuid = uuid.UUID(current_user_id)
    
    from app.services.gamification_events import record_learning_activity
    result = await record_learning_activity(
        db, user_uuid, "learn", value=minutes, user_id=current_user_id,
        context={"stage_id": body.get("stage_id")}
    )
    
    return {
        "recorded_minutes": minutes,
        "message": f"已记录 {minutes} 分钟学习时长",
        "gamification": result,
    }


# ==================== 学习档案 ====================

@router.get("/learning-profile")
async def get_learning_profile(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取用户学习档案"""
    user_uuid = uuid.UUID(current_user_id)
    
    # 总学习天数
    total_days = await db.fetchval(
        "SELECT COUNT(DISTINCT checkin_date) FROM daily_checkins WHERE user_id = $1",
        user_uuid
    ) or 0
    
    # 总课程完成
    total_courses = await db.fetchval(
        "SELECT COUNT(*) FROM course_completions WHERE user_id = $1 AND completion_status = 'completed'",
        user_uuid
    ) or 0
    
    # 当前连续天数
    current_streak = await db.fetchval(
        "SELECT current_streak FROM users WHERE id = $1", user_uuid
    ) or 0
    
    # 最大连续天数
    max_streak = await db.fetchval(
        "SELECT max_streak FROM users WHERE id = $1", user_uuid
    ) or 0
    
    # 加入日期
    join_date = await db.fetchval(
        "SELECT created_at FROM users WHERE id = $1", user_uuid
    )
    
    # 成就统计
    achievement_count = await db.fetchval(
        "SELECT COUNT(*) FROM user_achievements WHERE user_id = $1", user_uuid
    ) or 0
    
    # 总积分
    total_points = await db.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM point_transactions WHERE user_id = $1",
        user_uuid
    ) or 0
    
    league = get_user_league(total_points)
    
    return {
        "total_days": total_days,
        "total_courses": total_courses,
        "current_streak": current_streak,
        "max_streak": max_streak,
        "join_date": join_date.isoformat() if join_date else None,
        "achievement_count": achievement_count,
        "total_points": total_points,
        "league": league,
    }