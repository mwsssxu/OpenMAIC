"""
成长体系事件系统 - 学习行为统一入口
自动打卡 + 任务进度 + 搭子默契 + 成就检查 + 积分发放
"""

import uuid
import asyncpg
from datetime import datetime, timedelta
from app.core.time_utils import utcnow
from typing import Optional, Dict, Any

# 导入 gamification.py 中的配置
from app.routes.gamification import (
    DAILY_TASKS, 
    calculate_streak_reward,
    get_user_league,
)


async def record_learning_activity(
    db: asyncpg.Connection,
    user_uuid: uuid.UUID,
    activity_type: str,  # learn / quiz / chat / share / answer / course_complete
    value: int = 1,
    user_id: str = "",
    context: Optional[dict] = None,
) -> dict:
    """统一记录学习行为，返回所有激励结果"""
    results = {
        "checkin": None,
        "tasks_completed": [],
        "buddy_synergy": None,
        "points_earned": 0,
    }
    
    # 1. 自动打卡（幂等）
    results["checkin"] = await auto_checkin(db, user_uuid)
    
    # 2. 更新任务进度
    task_mappings = {
        "learn": [("checkin", 1), ("learn_30min", value)],
        "quiz": [("checkin", 1), ("complete_quiz", 1)],
        "chat": [("checkin", 1), ("interact_agent", 1)],
        "share": [("checkin", 1), ("share_note", 1)],
        "answer": [("checkin", 1), ("answer_question", 1)],
        "course_complete": [("checkin", 1)],
    }
    
    for task_id, progress in task_mappings.get(activity_type, []):
        task_result = await update_task_progress_internal(
            db, user_uuid, task_id, progress
        )
        if task_result.get("completed") and task_result.get("reward_issued"):
            results["tasks_completed"].append({
                "task_id": task_id,
                "reward_points": task_result.get("reward_points", 0),
            })
            results["points_earned"] += task_result.get("reward_points", 0)
    
    # 3. 搭子默契检查
    results["buddy_synergy"] = await check_buddy_synergy(db, user_uuid)
    
    # 4. 课程完成额外积分
    if activity_type == "course_complete":
        course_points = 50
        await grant_points(db, user_uuid, course_points, "course_complete", context)
        results["points_earned"] += course_points
    
    return results


async def auto_checkin(
    db: asyncpg.Connection, 
    user_uuid: uuid.UUID
) -> dict:
    """自动打卡（学习行为触发，幂等）"""
    today = utcnow().date()
    
    # 已打卡则直接返回
    existing = await db.fetchrow(
        "SELECT id FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2",
        user_uuid, today
    )
    if existing:
        return {"already_checked": True}
    
    # 计算连续天数
    yesterday = today - timedelta(days=1)
    yesterday_checkin = await db.fetchrow(
        "SELECT streak_count FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2",
        user_uuid, yesterday
    )
    new_streak = (yesterday_checkin["streak_count"] + 1) if yesterday_checkin else 1
    
    # 写入打卡记录
    await db.execute(
        """INSERT INTO daily_checkins (id, user_id, checkin_date, streak_count, created_at)
           VALUES ($1, $2, $3, $4, $5)""",
        uuid.uuid4(), user_uuid, today, new_streak, utcnow()
    )
    
    # 更新用户表
    max_streak = await db.fetchval(
        "SELECT MAX(streak_count) FROM daily_checkins WHERE user_id = $1", user_uuid
    )
    await db.execute(
        "UPDATE users SET current_streak = $1, max_streak = $2 WHERE id = $3",
        new_streak, max_streak, user_uuid
    )
    
    # 发放打卡积分奖励
    streak_reward = calculate_streak_reward(new_streak)
    await grant_points(db, user_uuid, streak_reward, "streak_checkin", new_streak)
    
    return {
        "already_checked": False,
        "streak": new_streak,
        "reward_points": streak_reward,
    }


async def update_task_progress_internal(
    db: asyncpg.Connection,
    user_uuid: uuid.UUID,
    task_id: str,
    progress: int,
) -> dict:
    """内部任务进度更新"""
    today = utcnow().date()
    
    if task_id not in DAILY_TASKS:
        return {"skipped": True}
    
    task_data = DAILY_TASKS[task_id]
    target = task_data.get("target", 1)
    
    # 查询当前进度
    existing = await db.fetchrow(
        """SELECT id, progress, completed FROM daily_task_progress
           WHERE user_id = $1 AND task_id = $2 AND task_date = $3""",
        user_uuid, task_id, today
    )
    
    if existing and existing["completed"]:
        return {"already_completed": True}
    
    new_progress = (existing["progress"] + progress) if existing else progress
    is_completed = new_progress >= target
    
    # 写入/更新进度
    if existing:
        await db.execute(
            """UPDATE daily_task_progress
               SET progress = $1, completed = $2, completed_at = $3
               WHERE id = $4""",
            new_progress, is_completed, utcnow() if is_completed else None, existing["id"]
        )
    else:
        await db.execute(
            """INSERT INTO daily_task_progress
               (id, user_id, task_id, task_date, progress, completed, completed_at, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
            uuid.uuid4(), user_uuid, task_id, today,
            new_progress, is_completed, utcnow() if is_completed else None, utcnow()
        )
    
    # 首次完成时发放奖励
    reward_issued = False
    if is_completed and (not existing or not existing["completed"]):
        reward_points = task_data["reward_points"]
        point_account = await db.fetchrow(
            "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE", user_uuid
        )
        if point_account:
            new_balance = point_account["balance"] + reward_points
            await db.execute(
                "UPDATE point_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
                new_balance, utcnow(), user_uuid
            )
            await db.execute(
                """INSERT INTO point_transactions
                   (id, user_id, source, amount, balance_after, created_at)
                   VALUES ($1, $2, 'daily_task', $3, $4, $5)""",
                uuid.uuid4(), user_uuid, reward_points, new_balance, utcnow()
            )
            reward_issued = True
    
    return {
        "task_id": task_id,
        "progress": new_progress,
        "target": target,
        "completed": is_completed,
        "reward_issued": reward_issued,
        "reward_points": task_data["reward_points"] if reward_issued else 0,
    }


async def check_buddy_synergy(
    db: asyncpg.Connection,
    user_uuid: uuid.UUID,
) -> dict:
    """检查搭子默契度"""
    buddy_config = await db.fetchrow(
        """SELECT buddy_user_id FROM buddy_configs 
           WHERE user_id = $1 AND active = TRUE""",
        user_uuid
    )
    if not buddy_config:
        return {"has_buddy": False}
    
    buddy_uuid = buddy_config["buddy_user_id"]
    today = utcnow().date()
    
    buddy_today = await db.fetchrow(
        "SELECT id FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2",
        buddy_uuid, today
    )
    
    if buddy_today:
        synergy_points = 2
        
        both_streak = await calculate_buddy_synergy_streak(
            db, user_uuid, buddy_uuid
        )
        
        if both_streak >= 7:
            synergy_points = 15
        
        await grant_points(db, user_uuid, synergy_points, "buddy_synergy", both_streak)
        
        return {
            "has_buddy": True,
            "buddy_also_learning": True,
            "synergy_points": synergy_points,
            "both_streak": both_streak,
        }
    
    return {"has_buddy": True, "buddy_also_learning": False}


async def calculate_buddy_synergy_streak(
    db: asyncpg.Connection,
    user_uuid: uuid.UUID,
    buddy_uuid: uuid.UUID,
) -> int:
    """计算连续一起学习天数"""
    today = utcnow().date()
    streak = 0
    
    for i in range(30):
        check_date = today - timedelta(days=i)
        both_learning = await db.fetchrow(
            """SELECT 1 FROM daily_checkins 
               WHERE user_id = $1 AND checkin_date = $2
               INTERSECT
               SELECT 1 FROM daily_checkins 
               WHERE user_id = $3 AND checkin_date = $4""",
            user_uuid, check_date, buddy_uuid, check_date
        )
        if both_learning:
            streak += 1
        else:
            break
    
    return streak


async def grant_points(
    db: asyncpg.Connection,
    user_uuid: uuid.UUID,
    amount: int,
    source: str,
    context: Optional[dict] = None,
):
    """发放积分"""
    point_account = await db.fetchrow(
        "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE", user_uuid
    )
    
    if point_account:
        new_balance = point_account["balance"] + amount
        await db.execute(
            "UPDATE point_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
            new_balance, utcnow(), user_uuid
        )
        await db.execute(
            """INSERT INTO point_transactions 
               (id, user_id, source, amount, balance_after, created_at)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            uuid.uuid4(), user_uuid, source, amount, new_balance, utcnow()
        )
