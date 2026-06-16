"""
学习记录路由 - 课程学习进度、时长追踪、完成记录
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi import Body
from pydantic import BaseModel
from typing import List, Optional
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
import asyncpg
import uuid
from datetime import datetime, timedelta
from app.core.time_utils import utcnow
from typing import Optional

router = APIRouter()


# ==================== Pydantic 模型 ====================

class StartLearningRequest(BaseModel):
    course_id: str


class UpdateTimeRequest(BaseModel):
    course_id: str
    minutes: int
    scenes_completed: Optional[int] = None


class CompleteLearningRequest(BaseModel):
    course_id: str
    total_minutes: int
    scenes_completed: int
    total_scenes: int
    quiz_score: Optional[float] = None
    quiz_answers: Optional[List[dict]] = None  # [{question_id, correct, user_answer, question: {id, type, content, options, correct_answer, explanation, difficulty, points}}]


# ==================== API 端点 ====================

@router.post("/start")
async def start_learning(
    request: StartLearningRequest = Body(...),
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """开始学习课程 - 创建或更新课程进度记录"""
    course_id = request.course_id
    user_uuid = uuid.UUID(current_user_id)
    course_uuid = uuid.UUID(course_id)

    # 检查课程是否存在
    course = await db.fetchrow(
        "SELECT id, name FROM stages WHERE id = $1",
        course_uuid
    )
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")

    # 检查是否已有学习记录
    existing = await db.fetchrow(
        """
        SELECT id, time_spent_minutes, scenes_completed
        FROM course_completions
        WHERE user_id = $1 AND course_id = $2
        """,
        user_uuid, course_uuid
    )

    if existing:
        # 更新最后访问时间
        await db.execute(
            """
            UPDATE course_completions
            SET completed_at = $2, completion_status = 'in_progress'
            WHERE id = $1
            """,
            existing["id"], utcnow()
        )
        return {
            "message": "继续学习",
            "time_spent": existing["time_spent_minutes"],
            "scenes_completed": existing["scenes_completed"],
        }

    # 创建新的学习记录
    await db.execute(
        """
        INSERT INTO course_completions
        (id, user_id, course_id, completed_at, completion_status, time_spent_minutes, scenes_completed, total_scenes)
        VALUES ($1, $2, $3, $4, 'in_progress', 0, 0, 0)
        """,
        uuid.uuid4(), user_uuid, course_uuid, utcnow()
    )

    return {
        "message": "开始学习",
        "time_spent": 0,
        "scenes_completed": 0,
    }


@router.post("/update-time")
async def update_learning_time(
    request: UpdateTimeRequest = Body(...),
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """更新学习时长和进度"""
    course_id = request.course_id
    minutes = request.minutes
    scenes_completed = request.scenes_completed

    user_uuid = uuid.UUID(current_user_id)
    course_uuid = uuid.UUID(course_id)

    # 查找学习记录
    record = await db.fetchrow(
        """
        SELECT id FROM course_completions
        WHERE user_id = $1 AND course_id = $2
        """,
        user_uuid, course_uuid
    )

    if not record:
        # 如果没有记录，先验证 course_id 是否存在（防止外键违规）
        course_exists = await db.fetchval(
            "SELECT 1 FROM stages WHERE id = $1",
            course_uuid
        )
        if not course_exists:
            raise HTTPException(status_code=404, detail="课程不存在")

        # 自动创建学习记录
        await db.execute(
            """
            INSERT INTO course_completions
            (id, user_id, course_id, completed_at, completion_status, time_spent_minutes, scenes_completed, total_scenes)
            VALUES ($1, $2, $3, $4, 'in_progress', $5, $6, 0)
            """,
            uuid.uuid4(), user_uuid, course_uuid, utcnow(), minutes, scenes_completed or 0
        )
    else:
        # 更现时长和进度
        update_fields = ["time_spent_minutes = $2", "completed_at = $3"]
        params = [record["id"], minutes, utcnow()]

        if scenes_completed is not None:
            update_fields.append("scenes_completed = $4")
            params.append(scenes_completed)

        await db.execute(
            f"""
            UPDATE course_completions
            SET {', '.join(update_fields)}
            WHERE id = $1
            """,
            *params
        )

    return {
        "message": "更新成功",
        "time_spent": minutes,
        "scenes_completed": scenes_completed or 0,
    }


@router.post("/complete")
async def complete_learning(
    request: CompleteLearningRequest = Body(...),
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """完成课程学习"""
    course_id = request.course_id
    total_minutes = request.total_minutes
    scenes_completed = request.scenes_completed
    total_scenes = request.total_scenes
    quiz_score = request.quiz_score

    user_uuid = uuid.UUID(current_user_id)
    course_uuid = uuid.UUID(course_id)

    # 检查课程是否存在
    course = await db.fetchrow(
        "SELECT id, name FROM stages WHERE id = $1",
        course_uuid
    )
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")

    # 查找或创建学习记录
    record = await db.fetchrow(
        """
        SELECT id FROM course_completions
        WHERE user_id = $1 AND course_id = $2
        """,
        user_uuid, course_uuid
    )

    now = utcnow()

    if record:
        # 更新为已完成状态
        await db.execute(
            """
            UPDATE course_completions
            SET completion_status = 'completed',
                time_spent_minutes = $2,
                scenes_completed = $3,
                total_scenes = $4,
                completed_at = $5
            WHERE id = $1
            """,
            record["id"], total_minutes, scenes_completed, total_scenes, now
        )
    else:
        # 创建已完成记录
        await db.execute(
            """
            INSERT INTO course_completions
            (id, user_id, course_id, completion_status, time_spent_minutes, scenes_completed, total_scenes, completed_at)
            VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7)
            """,
            uuid.uuid4(), user_uuid, course_uuid, total_minutes, scenes_completed, total_scenes, now
        )

    # 触发成长体系事件（自动打卡+任务进度+搭子默契+积分）
    from app.services.gamification_events import record_learning_activity
    gamification_result = await record_learning_activity(
        db, user_uuid, "course_complete",
        value=total_minutes, user_id=current_user_id,
        context={"course_id": course_id}
    )
    streak_bonus = gamification_result.get("checkin", {}).get("reward_points", 0)

    # 记录错题到错题本（从 quiz_answers 提取错题）
    mistakes_recorded = 0
    if request.quiz_answers:
        wrong_items = [qa for qa in request.quiz_answers if not qa.get("correct")]
        if wrong_items:
            from app.services.mistake_service import record_mistakes_from_assessment
            questions = [qa.get("question", {}) for qa in wrong_items]
            answers = [
                {"question_id": qa.get("question_id"), "answer": qa.get("user_answer")}
                for qa in wrong_items
            ]
            mistakes_recorded = await record_mistakes_from_assessment(
                db, user_uuid, course_uuid,
                assessment_id=record["id"] if record else uuid.uuid4(),
                questions=questions,
                answers=answers,
            )

    # 返回结果
    return {
        "message": "课程完成",
        "course_name": course["name"],
        "time_spent_minutes": total_minutes,
        "scenes_completed": scenes_completed,
        "total_scenes": total_scenes,
        "completion_rate": round(scenes_completed / total_scenes * 100, 1) if total_scenes > 0 else 0,
        "streak_bonus": streak_bonus,
        "gamification": gamification_result,
        "quiz_score": quiz_score,
        "mistakes_recorded": mistakes_recorded,
    }


@router.get("/stats")
async def get_learning_stats(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取学习统计"""
    user_uuid = uuid.UUID(current_user_id)

    # 总学习时长
    total_minutes = await db.fetchval(
        """
        SELECT COALESCE(SUM(time_spent_minutes), 0) FROM course_completions WHERE user_id = $1
        """,
        user_uuid
    ) or 0

    # 已完成课程数
    completed_courses = await db.fetchval(
        """
        SELECT COUNT(*) FROM course_completions
        WHERE user_id = $1 AND completion_status = 'completed'
        """,
        user_uuid
    ) or 0

    # 在学课程数
    active_courses = await db.fetchval(
        """
        SELECT COUNT(*) FROM course_completions
        WHERE user_id = $1 AND completion_status = 'in_progress'
        """,
        user_uuid
    ) or 0

    # 本周学习时长
    today = utcnow().date()
    week_start = today - timedelta(days=today.weekday())
    weekly_minutes = await db.fetchval(
        """
        SELECT COALESCE(SUM(time_spent_minutes), 0) FROM course_completions
        WHERE user_id = $1 AND completed_at >= $2
        """,
        user_uuid, week_start
    ) or 0

    return {
        "total_hours": round(total_minutes / 60, 1),
        "completed_courses": completed_courses,
        "active_courses": active_courses,
        "weekly_hours": round(weekly_minutes / 60, 1),
    }