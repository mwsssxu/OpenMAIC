"""
间隔重复复习路由 - 艾宾浩斯遗忘曲线复习系统
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.core.redis import invalidate_balance_cache
import asyncpg
import uuid
from datetime import datetime, timedelta
from typing import Optional, List

router = APIRouter()


# ==================== 艾宾浩斯复习时间表 ====================

REVIEW_SCHEDULE = [
    {"day": 1, "duration_minutes": 5, "type": "quick_recall", "priority": 5},
    {"day": 3, "duration_minutes": 3, "type": "key_points", "priority": 4},
    {"day": 7, "duration_minutes": 10, "type": "deep_review", "priority": 3},
    {"day": 14, "duration_minutes": 5, "type": "quick_recall", "priority": 2},
    {"day": 30, "duration_minutes": 15, "type": "comprehensive", "priority": 1},
]

REVIEW_TYPES = {
    "quick_recall": {
        "name": "快速回顾",
        "description": "5分钟快速回顾核心概念",
        "reward_points": 3,
    },
    "key_points": {
        "name": "要点复习",
        "description": "重点知识点卡片复习",
        "reward_points": 5,
    },
    "deep_review": {
        "name": "深度复习",
        "description": "重新播放核心场景+互动测验",
        "reward_points": 10,
    },
    "comprehensive": {
        "name": "综合复习",
        "description": "综合测验+总结报告",
        "reward_points": 15,
    },
}


# ==================== 复习计划创建 ====================

@router.post("/create/{course_id}")
async def create_review_schedule(
    course_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """创建课程复习计划"""
    user_uuid = uuid.UUID(current_user_id)
    course_uuid = uuid.UUID(course_id)

    # 检查课程完成状态
    completion = await db.fetchrow(
        """
        SELECT id, completed_at FROM course_completions
        WHERE user_id = $1 AND course_id = $2
        """,
        user_uuid, course_uuid
    )

    if not completion:
        raise HTTPException(status_code=400, detail="课程未完成，无法创建复习计划")

    # 获取课程信息
    course = await db.fetchrow(
        "SELECT id, name FROM stages WHERE id = $1",
        course_uuid
    )

    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")

    # 检查是否已有复习计划
    existing = await db.fetchrow(
        """
        SELECT id FROM review_schedules
        WHERE user_id = $1 AND course_id = $2 AND status = 'pending'
        """,
        user_uuid, course_uuid
    )

    if existing:
        return {
            "message": "已有待复习计划",
            "course_id": str(course_uuid),
        }

    # 创建复习计划
    base_time = completion["completed_at"]
    schedules_created = []

    for point in REVIEW_SCHEDULE:
        trigger_at = base_time + timedelta(days=point["day"])
        schedule_id = uuid.uuid4()

        await db.execute(
            """
            INSERT INTO review_schedules
            (id, user_id, course_id, review_type, trigger_at, duration_minutes,
             status, priority, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
            """,
            schedule_id, user_uuid, course_uuid, point["type"],
            trigger_at, point["duration_minutes"], point["priority"],
            datetime.utcnow()
        )

        schedules_created.append({
            "id": str(schedule_id),
            "type": point["type"],
            "type_name": REVIEW_TYPES[point["type"]]["name"],
            "trigger_at": trigger_at.isoformat(),
            "duration_minutes": point["duration_minutes"],
        })

    return {
        "course_id": str(course_uuid),
        "course_name": course["name"],
        "schedules": schedules_created,
        "total_schedules": len(schedules_created),
        "message": f"已创建 {len(schedules_created)} 个复习节点",
    }


@router.get("/pending")
async def get_pending_reviews(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取待复习列表"""
    user_uuid = uuid.UUID(current_user_id)
    now = datetime.utcnow()

    # 获取今天及过期的待复习
    rows = await db.fetch(
        """
        SELECT rs.id, rs.course_id, rs.review_type, rs.trigger_at,
               rs.duration_minutes, rs.priority, rs.status,
               s.name as course_name
        FROM review_schedules rs
        JOIN stages s ON s.id = rs.course_id
        WHERE rs.user_id = $1 AND rs.status = 'pending'
        AND rs.trigger_at <= $2
        ORDER BY rs.priority DESC, rs.trigger_at ASC
        """,
        user_uuid, now + timedelta(hours=12)  # 包含12小时内即将到期的
    )

    # 获取即将到来的复习（未来7天）
    upcoming = await db.fetch(
        """
        SELECT rs.id, rs.course_id, rs.review_type, rs.trigger_at,
               rs.duration_minutes, rs.priority,
               s.name as course_name
        FROM review_schedules rs
        JOIN stages s ON s.id = rs.course_id
        WHERE rs.user_id = $1 AND rs.status = 'pending'
        AND rs.trigger_at > $2 AND rs.trigger_at <= $3
        ORDER BY rs.trigger_at ASC
        """,
        user_uuid, now + timedelta(hours=12), now + timedelta(days=7)
    )

    return {
        "today_reviews": [
            {
                "id": str(row["id"]),
                "course_id": str(row["course_id"]),
                "course_name": row["course_name"],
                "type": row["review_type"],
                "type_name": REVIEW_TYPES.get(row["review_type"], {}).get("name", "复习"),
                "trigger_at": row["trigger_at"].isoformat(),
                "duration_minutes": row["duration_minutes"],
                "priority": row["priority"],
                "is_expired": row["trigger_at"] < now,
            }
            for row in rows
        ],
        "upcoming_reviews": [
            {
                "id": str(row["id"]),
                "course_id": str(row["course_id"]),
                "course_name": row["course_name"],
                "type": row["review_type"],
                "type_name": REVIEW_TYPES.get(row["review_type"], {}).get("name", "复习"),
                "trigger_at": row["trigger_at"].isoformat(),
                "duration_minutes": row["duration_minutes"],
            }
            for row in upcoming
        ],
        "today_count": len(rows),
        "upcoming_count": len(upcoming),
    }


# ==================== 复习执行 ====================

@router.post("/{schedule_id}/start")
async def start_review(
    schedule_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """开始复习"""
    user_uuid = uuid.UUID(current_user_id)
    schedule_uuid = uuid.UUID(schedule_id)

    schedule = await db.fetchrow(
        """
        SELECT id, course_id, review_type, duration_minutes, status
        FROM review_schedules WHERE id = $1 AND user_id = $2
        """,
        schedule_uuid, user_uuid
    )

    if not schedule:
        raise HTTPException(status_code=404, detail="复习计划不存在")

    if schedule["status"] != "pending":
        raise HTTPException(status_code=400, detail="复习已完成或已过期")

    # 创建复习记录
    record_id = uuid.uuid4()
    now = datetime.utcnow()

    await db.execute(
        """
        INSERT INTO review_records
        (id, user_id, schedule_id, course_id, review_type, started_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        record_id, user_uuid, schedule_uuid, schedule["course_id"],
        schedule["review_type"], now, now
    )

    # 获取课程内容预览
    course = await db.fetchrow(
        "SELECT name FROM stages WHERE id = $1",
        schedule["course_id"]
    )

    return {
        "record_id": str(record_id),
        "schedule_id": str(schedule_uuid),
        "course_id": str(schedule["course_id"]),
        "course_name": course["name"] if course else None,
        "review_type": schedule["review_type"],
        "type_name": REVIEW_TYPES.get(schedule["review_type"], {}).get("name", "复习"),
        "duration_minutes": schedule["duration_minutes"],
        "started_at": now.isoformat(),
        "message": "复习开始",
    }


@router.post("/{schedule_id}/complete")
async def complete_review(
    schedule_id: str,
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """完成复习"""
    user_uuid = uuid.UUID(current_user_id)
    schedule_uuid = uuid.UUID(schedule_id)

    schedule = await db.fetchrow(
        """
        SELECT id, course_id, review_type, duration_minutes
        FROM review_schedules WHERE id = $1 AND user_id = $2
        """,
        schedule_uuid, user_uuid
    )

    if not schedule:
        raise HTTPException(status_code=404, detail="复习计划不存在")

    # 获取复习记录
    record = await db.fetchrow(
        """
        SELECT id, started_at FROM review_records
        WHERE schedule_id = $1 AND user_id = $2 AND completed_at IS NULL
        """,
        schedule_uuid, user_uuid
    )

    if not record:
        raise HTTPException(status_code=400, detail="复习未开始或已完成")

    now = datetime.utcnow()
    time_spent = body.get("time_spent_minutes", 0)
    effectiveness = body.get("effectiveness_rating", 3)
    quiz_score = body.get("quiz_score")
    notes = body.get("notes")
    next_review_days = body.get("next_review_days")  # 用户可调整下次复习时间

    # 更新复习记录
    await db.execute(
        """
        UPDATE review_records
        SET completed_at = $1, time_spent_minutes = $2,
            effectiveness_rating = $3, quiz_score = $4, notes = $5
        WHERE id = $6
        """,
        now, time_spent, effectiveness, quiz_score, notes, record["id"]
    )

    # 更新复习计划状态
    await db.execute(
        """
        UPDATE review_schedules
        SET status = 'completed', completed_at = $1
        WHERE id = $2
        """,
        now, schedule_uuid
    )

    # 发放复习奖励
    review_type = schedule["review_type"]
    base_reward = REVIEW_TYPES.get(review_type, {}).get("reward_points", 5)
    bonus = effectiveness * 2  # 效果评分奖励
    total_reward = base_reward + bonus

    point_account = await db.fetchrow(
        "SELECT balance FROM point_accounts WHERE user_id = $1",
        user_uuid
    )

    if point_account:
        new_balance = point_account["balance"] + total_reward
        await db.execute(
            "UPDATE point_accounts SET balance = $1 WHERE user_id = $2",
            new_balance, user_uuid
        )
        await db.execute(
            """
            INSERT INTO point_transactions
            (id, user_id, source, amount, balance_after, reference_id, created_at)
            VALUES ($1, $2, 'review', $3, $4, $5, $6)
            """,
            uuid.uuid4(), user_uuid, total_reward, new_balance, schedule_uuid, now
        )
        await invalidate_balance_cache(current_user_id)

    # 如果用户选择调整下次复习时间，创建新的复习计划
    if next_review_days and next_review_days > 0:
        new_trigger = now + timedelta(days=next_review_days)
        await db.execute(
            """
            INSERT INTO review_schedules
            (id, user_id, course_id, review_type, trigger_at, duration_minutes, status, priority, created_at)
            VALUES ($1, $2, $3, 'deep_review', $4, 10, 'pending', 2, $5)
            """,
            uuid.uuid4(), user_uuid, schedule["course_id"], new_trigger, now
        )

    return {
        "schedule_id": str(schedule_uuid),
        "review_type": review_type,
        "time_spent_minutes": time_spent,
        "effectiveness_rating": effectiveness,
        "reward_points": total_reward,
        "next_review_created": next_review_days is not None and next_review_days > 0,
        "message": f"复习完成，获得 {total_reward} 积分",
    }


@router.post("/{schedule_id}/skip")
async def skip_review(
    schedule_id: str,
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """跳过复习"""
    user_uuid = uuid.UUID(current_user_id)
    schedule_uuid = uuid.UUID(schedule_id)

    reason = body.get("reason", "用户选择跳过")

    # 更新状态为跳过
    await db.execute(
        """
        UPDATE review_schedules
        SET status = 'skipped', completed_at = $1
        WHERE id = $2 AND user_id = $3
        """,
        datetime.utcnow(), schedule_uuid, user_uuid
    )

    # 创建延期复习（3天后）
    schedule = await db.fetchrow(
        "SELECT course_id, review_type FROM review_schedules WHERE id = $1",
        schedule_uuid
    )

    if schedule:
        new_trigger = datetime.utcnow() + timedelta(days=3)
        await db.execute(
            """
            INSERT INTO review_schedules
            (id, user_id, course_id, review_type, trigger_at, duration_minutes, status, priority, created_at)
            VALUES ($1, $2, $3, $4, $5, 5, 'pending', 1, $6)
            """,
            uuid.uuid4(), user_uuid, schedule["course_id"], schedule["review_type"],
            new_trigger, datetime.utcnow()
        )

    return {
        "schedule_id": str(schedule_uuid),
        "rescheduled_at": new_trigger.isoformat() if schedule else None,
        "message": "复习已跳过，将在3天后再次提醒",
    }


# ==================== 复习统计 ====================

@router.get("/stats")
async def get_review_stats(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取复习统计"""
    user_uuid = uuid.UUID(current_user_id)

    # 复习完成数
    completed = await db.fetchval(
        """
        SELECT COUNT(*) FROM review_schedules
        WHERE user_id = $1 AND status = 'completed'
        """,
        user_uuid
    )

    # 复习跳过数
    skipped = await db.fetchval(
        """
        SELECT COUNT(*) FROM review_schedules
        WHERE user_id = $1 AND status = 'skipped'
        """,
        user_uuid
    )

    # 总复习时长
    total_time = await db.fetchval(
        """
        SELECT COALESCE(SUM(time_spent_minutes), 0) FROM review_records
        WHERE user_id = $1 AND completed_at IS NOT NULL
        """,
        user_uuid
    )

    # 平均效果评分
    avg_effectiveness = await db.fetchval(
        """
        SELECT AVG(effectiveness_rating) FROM review_records
        WHERE user_id = $1 AND effectiveness_rating IS NOT NULL
        """,
        user_uuid
    ) or 0

    # 复习奖励积分
    review_points = await db.fetchval(
        """
        SELECT COALESCE(SUM(amount), 0) FROM point_transactions
        WHERE user_id = $1 AND source = 'review'
        """,
        user_uuid
    )

    # 复习完成率
    total_pending = await db.fetchval(
        """
        SELECT COUNT(*) FROM review_schedules
        WHERE user_id = $1 AND status IN ('pending', 'expired')
        """,
        user_uuid
    )

    total_created = await db.fetchval(
        """
        SELECT COUNT(*) FROM review_schedules WHERE user_id = $1
        """,
        user_uuid
    )

    completion_rate = (completed / total_created * 100) if total_created > 0 else 0

    return {
        "completed_reviews": completed or 0,
        "skipped_reviews": skipped or 0,
        "pending_reviews": total_pending or 0,
        "total_time_minutes": total_time or 0,
        "avg_effectiveness": float(avg_effectiveness),
        "review_points_earned": review_points or 0,
        "completion_rate": completion_rate,
    }