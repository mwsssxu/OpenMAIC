"""
游戏化增强路由 - 每日任务、联赛等级、奖励递增
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.core.redis import invalidate_balance_cache
import asyncpg
import uuid
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter()


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
    },
    "learn_30min": {
        "name": "学习30分钟",
        "description": "累计学习时长达到30分钟",
        "reward_points": 10,
        "type": "time",
        "target": 30,
    },
    "complete_quiz": {
        "name": "完成测验",
        "description": "完成任意课程的测验",
        "reward_points": 15,
        "type": "quiz",
        "target": 1,
    },
    "interact_agent": {
        "name": "与AI互动",
        "description": "与智能体进行至少5次互动",
        "reward_points": 10,
        "type": "interaction",
        "target": 5,
    },
    "share_note": {
        "name": "分享笔记",
        "description": "发布一条共享笔记",
        "reward_points": 20,
        "type": "note",
        "target": 1,
    },
    "answer_question": {
        "name": "回答问题",
        "description": "在问答区回答一个问题",
        "reward_points": 15,
        "type": "qanda",
        "target": 1,
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
        SELECT COALESCE(SUM(p.amount), 0) as total_points
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
        "updated_at": datetime.utcnow().isoformat(),
    }


# ==================== 每日任务 ====================

@router.get("/tasks")
async def get_daily_tasks(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取今日任务列表"""
    user_uuid = uuid.UUID(current_user_id)
    today = datetime.utcnow().date()

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
    today = datetime.utcnow().date()

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
            datetime.utcnow() if is_completed else None,
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
            datetime.utcnow() if is_completed else None,
            datetime.utcnow()
        )

    # 如果任务完成且之前未完成，发放奖励
    reward_issued = False
    if is_completed and (not existing or not existing["completed"]):
        reward_points = task_data["reward_points"]

        # 发放积分
        point_account = await db.fetchrow(
            "SELECT balance FROM point_accounts WHERE user_id = $1",
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
                (id, user_id, source, amount, balance_after, reference_id, created_at)
                VALUES ($1, $2, 'daily_task', $3, $4, $5, $6)
                """,
                uuid.uuid4(), user_uuid, reward_points, new_balance,
                uuid.UUID(task_id) if len(task_id) == 36 else None,
                datetime.utcnow()
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
    today = datetime.utcnow().date()

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
            datetime.utcnow(), existing["id"]
        )
    else:
        await db.execute(
            """
            INSERT INTO daily_task_progress
            (id, user_id, task_id, task_date, progress, completed, completed_at, created_at)
            VALUES ($1, $2, 'checkin', $3, 1, TRUE, $4, $5)
            """,
            uuid.uuid4(), user_uuid, today, datetime.utcnow(), datetime.utcnow()
        )

    # 发放积分奖励
    reward_points = task_data["reward_points"]
    point_account = await db.fetchrow(
        "SELECT balance FROM point_accounts WHERE user_id = $1",
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
            uuid.uuid4(), user_uuid, reward_points, new_balance, datetime.utcnow()
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
        today = datetime.utcnow().date()
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
            "is_cycle_end": ((day - 1) % 7) == 0,
        })

    return {
        "current_streak": streak,
        "current_reward": current_reward,
        "next_reward_info": next_reward_info,
        "reward_preview": preview,
    }