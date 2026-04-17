"""Note Reminder System - Trigger notes after course completion

Implements断裂点6修复: 课程完成后触发笔记提醒，形成学习闭环

Workflow:
1. Course completion triggers note reminder check
2. If no existing note, create reminder with template
3. User can follow template to write note
4. Completion earns extra reward points
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import asyncpg
import uuid
from app.db.database import get_db
from app.middleware.auth import get_current_user_id

router = APIRouter(prefix="/note-reminders", tags=["note-reminders"])


# ============ Note Templates ============

NOTE_TEMPLATES = {
    "general": {
        "name": "通用学习笔记",
        "sections": [
            {"title": "核心知识点", "hint": "列出这门课程最重要的3-5个概念"},
            {"title": "我的理解", "hint": "用自己的话解释这些概念"},
            {"title": "实际应用", "hint": "这些知识可以应用在哪些场景"},
            {"title": "延伸思考", "hint": "还想深入学习哪些相关内容"},
        ],
        "min_length": 100,
        "reward_points": 25
    },
    "programming": {
        "name": "编程学习笔记",
        "sections": [
            {"title": "代码要点", "hint": "记录关键的代码语法和用法"},
            {"title": "调试经验", "hint": "遇到的问题和解决方法"},
            {"title": "最佳实践", "hint": "总结值得记住的编程习惯"},
            {"title": "下一步", "hint": "计划练习的项目或题目"},
        ],
        "min_length": 150,
        "reward_points": 30
    },
    "math": {
        "name": "数学学习笔记",
        "sections": [
            {"title": "公式推导", "hint": "记录重要公式的推导过程"},
            {"title": "例题解析", "hint": "典型例题的解题思路"},
            {"title": "易错点", "hint": "容易犯错的地方和注意事项"},
            {"title": "练习计划", "hint": "后续要练习的题型"},
        ],
        "min_length": 120,
        "reward_points": 28
    }
}


# ============ Models ============

class NoteReminder(BaseModel):
    course_id: str
    course_name: str
    template_type: str
    template_sections: List[dict]
    reward_points: int
    deadline: Optional[datetime]
    created_at: datetime


class SubmitNoteFromReminder(BaseModel):
    reminder_id: str
    title: str
    content: str
    sections: Optional[List[dict]]  # Filled template sections
    tags: Optional[List[str]]


# ============ Routes ============

@router.post("/trigger/{course_id}")
async def trigger_note_reminder(
    course_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Trigger note reminder after course completion."""
    user_uuid = uuid.UUID(user_id)
    course_uuid = uuid.UUID(course_id)

    # Check if course was completed
    completion = await db.fetchrow(
        """
        SELECT id, completed_at FROM course_completions
        WHERE user_id = $1 AND course_id = $2
        """,
        user_uuid, course_uuid
    )

    if not completion:
        raise HTTPException(status_code=400, detail="Course not completed yet")

    # Check if already has a note for this course
    existing_note = await db.fetchrow(
        """
        SELECT id FROM notes WHERE user_id = $1 AND classroom_id = $2
        """,
        user_uuid, course_uuid
    )

    if existing_note:
        return {
            "reminder_created": False,
            "reason": "已有学习笔记",
            "existing_note_id": str(existing_note["id"])
        }

    # Check if reminder already exists
    existing_reminder = await db.fetchrow(
        """
        SELECT id FROM note_reminders
        WHERE user_id = $1 AND course_id = $2 AND status = 'pending'
        """,
        user_uuid, course_uuid
    )

    if existing_reminder:
        return {
            "reminder_created": False,
            "reason": "已有待处理的笔记提醒",
            "reminder_id": str(existing_reminder["id"])
        }

    # Get course info for template selection
    course = await db.fetchrow(
        """
        SELECT id, name, description FROM stages WHERE id = $1
        """,
        course_uuid
    )

    # Select appropriate template
    template_type = "general"
    course_name_lower = (course["name"] or "").lower()

    if any(kw in course_name_lower for kw in ["python", "编程", "代码", "javascript", "java", "开发"]):
        template_type = "programming"
    elif any(kw in course_name_lower for kw in ["数学", "算法", "统计", "概率", "线性代数"]):
        template_type = "math"

    template = NOTE_TEMPLATES[template_type]

    # Create reminder
    reminder_id = uuid.uuid4()
    deadline = datetime.utcnow() + timedelta(days=7)  # 7 days to write note

    await db.execute(
        """
        INSERT INTO note_reminders
        (id, user_id, course_id, template_type, template_sections,
         reward_points, deadline, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
        """,
        reminder_id, user_uuid, course_uuid, template_type,
        json.dumps(template["sections"]), template["reward_points"],
        deadline, datetime.utcnow()
    )

    return {
        "reminder_created": True,
        "reminder_id": str(reminder_id),
        "course_id": course_id,
        "course_name": course["name"],
        "template_type": template_type,
        "template": template,
        "deadline": deadline.isoformat(),
        "reward_points": template["reward_points"],
        "message": f"建议记录学习笔记，完成后可获得{template['reward_points']}积分奖励"
    }


@router.get("/pending")
async def get_pending_reminders(
    limit: int = Query(10, le=20),
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user's pending note reminders."""
    reminders = await db.fetch(
        """
        SELECT nr.id, nr.course_id, nr.template_type, nr.template_sections,
               nr.reward_points, nr.deadline, nr.created_at, nr.status,
               s.name as course_name
        FROM note_reminders nr
        JOIN stages s ON nr.course_id = s.id
        WHERE nr.user_id = $1 AND nr.status = 'pending'
        ORDER BY nr.deadline ASC
        LIMIT $2
        """,
        uuid.UUID(user_id),
        limit
    )

    return {
        "reminders": [
            {
                "reminder_id": str(r["id"]),
                "course_id": str(r["course_id"]),
                "course_name": r["course_name"],
                "template_type": r["template_type"],
                "template_sections": json.loads(r["template_sections"]),
                "reward_points": r["reward_points"],
                "deadline": r["deadline"].isoformat(),
                "created_at": r["created_at"].isoformat(),
                "days_left": max(0, (r["deadline"] - datetime.utcnow()).days),
                "status": r["status"]
            }
            for r in reminders
        ]
    }


@router.get("/{reminder_id}")
async def get_reminder_detail(
    reminder_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get detailed reminder info with template."""
    reminder = await db.fetchrow(
        """
        SELECT nr.id, nr.user_id, nr.course_id, nr.template_type, nr.template_sections,
               nr.reward_points, nr.deadline, nr.created_at, nr.status,
               s.name as course_name, s.description as course_description
        FROM note_reminders nr
        JOIN stages s ON nr.course_id = s.id
        WHERE nr.id = $1
        """,
        uuid.UUID(reminder_id)
    )

    if not reminder or str(reminder["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Reminder not found")

    template = NOTE_TEMPLATES[reminder["template_type"]]

    return {
        "reminder_id": str(reminder["id"]),
        "course_id": str(reminder["course_id"]),
        "course_name": reminder["course_name"],
        "course_description": reminder["course_description"],
        "template": {
            "type": reminder["template_type"],
            "name": template["name"],
            "sections": json.loads(reminder["template_sections"]),
            "min_length": template["min_length"]
        },
        "reward_points": reminder["reward_points"],
        "deadline": reminder["deadline"].isoformat(),
        "status": reminder["status"]
    }


@router.post("/submit")
async def submit_note_from_reminder(
    request: SubmitNoteFromReminder,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Submit note from reminder and earn bonus points."""
    reminder = await db.fetchrow(
        """
        SELECT id, user_id, course_id, reward_points, status, deadline
        FROM note_reminders WHERE id = $1
        """,
        uuid.UUID(request.reminder_id)
    )

    if not reminder or str(reminder["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Reminder not found")

    if reminder["status"] != "pending":
        raise HTTPException(status_code=400, detail="Reminder already processed")

    # Check deadline for bonus
    is_before_deadline = datetime.utcnow() < reminder["deadline"]
    bonus_multiplier = 1.5 if is_before_deadline else 1.0

    # Create the note
    note_id = await db.fetchval(
        """
        INSERT INTO notes
        (user_id, classroom_id, title, content, tags, likes, created_at)
        VALUES ($1, $2, $3, $4, $5, 0, $6)
        RETURNING id
        """,
        uuid.UUID(user_id),
        reminder["course_id"],
        request.title,
        request.content,
        json.dumps(request.tags or []),
        datetime.utcnow()
    )

    # Calculate and award points
    base_points = reminder["reward_points"]
    earned_points = int(base_points * bonus_multiplier)

    await db.execute(
        """
        UPDATE users SET point_balance = point_balance + $2 WHERE id = $1
        """,
        uuid.UUID(user_id),
        earned_points
    )

    # Log point transaction
    await db.execute(
        """
        INSERT INTO point_transactions
        (user_id, points, transaction_type, description, created_at)
        VALUES ($1, $2, 'earn', $3, $4)
        """,
        uuid.UUID(user_id),
        earned_points,
        f"完成课程笔记{'(提前奖励)' if is_before_deadline else ''}",
        datetime.utcnow()
    )

    # Mark reminder as completed
    await db.execute(
        """
        UPDATE note_reminders SET status = 'completed', completed_at = $2, note_id = $3
        WHERE id = $1
        """,
        reminder["id"],
        datetime.utcnow(),
        note_id
    )

    return {
        "success": True,
        "note_id": str(note_id),
        "earned_points": earned_points,
        "bonus_applied": bonus_multiplier > 1.0,
        "message": f"笔记已发布，获得{earned_points}积分{'(含提前奖励)' if is_before_deadline else ''}"
    }


@router.post("/skip/{reminder_id}")
async def skip_reminder(
    reminder_id: str,
    reason: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Skip a note reminder (no reward)."""
    reminder = await db.fetchrow(
        """
        SELECT id, user_id, status FROM note_reminders WHERE id = $1
        """,
        uuid.UUID(reminder_id)
    )

    if not reminder or str(reminder["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Reminder not found")

    if reminder["status"] != "pending":
        raise HTTPException(status_code=400, detail="Reminder already processed")

    await db.execute(
        """
        UPDATE note_reminders SET status = 'skipped', skipped_at = $2, skip_reason = $3
        WHERE id = $1
        """,
        reminder["id"],
        datetime.utcnow(),
        reason
    )

    return {"success": True, "message": "提醒已跳过"}


@router.get("/stats")
async def get_reminder_stats(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user's note reminder statistics."""
    stats = await db.fetchrow(
        """
        SELECT
            COUNT(*) as total_reminders,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
            COUNT(*) FILTER (WHERE status = 'pending' AND deadline < NOW()) as overdue,
            COUNT(*) FILTER (WHERE status = 'pending' AND deadline >= NOW()) as pending
        FROM note_reminders WHERE user_id = $1
        """,
        uuid.UUID(user_id)
    )

    # Calculate completion rate
    total = stats["total_reminders"] or 0
    completed = stats["completed"] or 0
    rate = (completed / total * 100) if total > 0 else 0

    return {
        "total_reminders": total,
        "completed": completed,
        "skipped": stats["skipped"] or 0,
        "pending": stats["pending"] or 0,
        "overdue": stats["overdue"] or 0,
        "completion_rate": round(rate, 1)
    }


@router.get("/templates")
async def get_available_templates():
    """Get all available note templates."""
    return {
        "templates": [
            {
                "type": k,
                "name": v["name"],
                "sections": v["sections"],
                "min_length": v["min_length"],
                "reward_points": v["reward_points"]
            }
            for k, v in NOTE_TEMPLATES.items()
        ]
    }


import json