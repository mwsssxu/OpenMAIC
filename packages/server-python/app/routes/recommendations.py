"""
课程推荐路由 - 课程后续路径推荐、学习路径管理
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
import asyncpg
import uuid
from datetime import datetime, timedelta
from typing import Optional, List

router = APIRouter()


# ==================== 推荐类型定义 ====================

RECOMMENDATION_TYPES = {
    "advanced": {
        "name": "进阶课程",
        "description": "同主题的更高级课程",
        "priority": 1,
    },
    "related": {
        "name": "相关课程",
        "description": "相关技能领域的课程",
        "priority": 2,
    },
    "project": {
        "name": "实战项目",
        "description": "综合实战项目课程",
        "priority": 3,
    },
    "review": {
        "name": "复习推荐",
        "description": "需要复习的相关课程",
        "priority": 4,
    },
}


# ==================== 课程完成 ====================

@router.post("/completions/{course_id}")
async def mark_course_completed(
    course_id: str,
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """标记课程完成"""
    user_uuid = uuid.UUID(current_user_id)
    course_uuid = uuid.UUID(course_id)

    # 检查课程是否属于用户
    course = await db.fetchrow(
        "SELECT id, name FROM stages WHERE id = $1 AND user_id = $2",
        course_uuid, user_uuid
    )

    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")

    # 检查是否已有完成记录
    existing = await db.fetchrow(
        "SELECT id FROM course_completions WHERE user_id = $1 AND course_id = $2",
        user_uuid, course_uuid
    )

    completion_status = body.get("status", "completed")
    rating = body.get("rating")
    notes = body.get("notes")
    scenes_completed = body.get("scenes_completed", 0)
    total_scenes = body.get("total_scenes", 0)
    time_spent = body.get("time_spent_minutes", 0)

    now = datetime.utcnow()

    if existing:
        await db.execute(
            """
            UPDATE course_completions
            SET completed_at = $1, completion_status = $2, rating = $3,
                notes = $4, scenes_completed = $5, total_scenes = $6,
                time_spent_minutes = $7
            WHERE id = $8
            """,
            now, completion_status, rating, notes,
            scenes_completed, total_scenes, time_spent,
            existing["id"]
        )
        completion_id = existing["id"]
    else:
        completion_id = uuid.uuid4()
        await db.execute(
            """
            INSERT INTO course_completions
            (id, user_id, course_id, completed_at, completion_status, rating, notes,
             scenes_completed, total_scenes, time_spent_minutes, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """,
            completion_id, user_uuid, course_uuid, now, completion_status,
            rating, notes, scenes_completed, total_scenes, time_spent, now
        )

    # 发放完成奖励积分
    reward_points = 20 + (rating or 0) * 5  # 基础20分 + 评分奖励

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
            VALUES ($1, $2, 'course_completion', $3, $4, $5, $6)
            """,
            uuid.uuid4(), user_uuid, reward_points, new_balance, course_uuid, now
        )

    # 触发笔记提醒
    note_reminder_triggered = await trigger_note_reminder_if_needed(db, user_uuid, course_uuid)

    # 触发推荐生成
    recommendations = await generate_recommendations(db, user_uuid, course_uuid)

    return {
        "completion_id": str(completion_id),
        "course_id": str(course_uuid),
        "course_name": course["name"],
        "status": completion_status,
        "reward_points": reward_points,
        "recommendations": recommendations,
        "note_reminder": note_reminder_triggered,
        "message": "课程已完成，获得 {} 积分奖励{}".format(
            reward_points,
            "，建议记录学习笔记" if note_reminder_triggered else ""
        ),
    }


async def trigger_note_reminder_if_needed(
    db: asyncpg.Connection,
    user_uuid: uuid.UUID,
    course_uuid: uuid.UUID
) -> Optional[dict]:
    """Check if note reminder should be triggered."""
    # Check if already has note
    existing_note = await db.fetchrow(
        "SELECT id FROM notes WHERE user_id = $1 AND classroom_id = $2",
        user_uuid, course_uuid
    )

    if existing_note:
        return None

    # Check if reminder already exists
    existing_reminder = await db.fetchrow(
        """
        SELECT id FROM note_reminders
        WHERE user_id = $1 AND course_id = $2 AND status = 'pending'
        """,
        user_uuid, course_uuid
    )

    if existing_reminder:
        return {"reminder_id": str(existing_reminder["id"]), "status": "already_exists"}

    # Create reminder
    from datetime import timedelta
    import json

    template_sections = [
        {"title": "核心知识点", "hint": "列出这门课程最重要的3-5个概念"},
        {"title": "我的理解", "hint": "用自己的话解释这些概念"},
        {"title": "实际应用", "hint": "这些知识可以应用在哪些场景"},
    ]

    deadline = datetime.utcnow() + timedelta(days=7)
    reminder_id = uuid.uuid4()

    await db.execute(
        """
        INSERT INTO note_reminders
        (id, user_id, course_id, template_type, template_sections, reward_points, deadline, status, created_at)
        VALUES ($1, $2, $3, 'general', $4, 25, $5, 'pending', $6)
        """,
        reminder_id, user_uuid, course_uuid,
        json.dumps(template_sections), deadline, datetime.utcnow()
    )

    return {
        "reminder_id": str(reminder_id),
        "status": "created",
        "reward_points": 25,
        "deadline": deadline.isoformat()
    }


@router.get("/completions")
async def get_my_completions(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取我的课程完成记录"""
    user_uuid = uuid.UUID(current_user_id)

    rows = await db.fetch(
        """
        SELECT cc.id, cc.course_id, s.name as course_name, cc.completed_at,
               cc.completion_status, cc.rating, cc.scenes_completed, cc.total_scenes,
               cc.time_spent_minutes
        FROM course_completions cc
        JOIN stages s ON s.id = cc.course_id
        WHERE cc.user_id = $1
        ORDER BY cc.completed_at DESC
        """,
        user_uuid
    )

    return {
        "completions": [
            {
                "id": str(row["id"]),
                "course_id": str(row["course_id"]),
                "course_name": row["course_name"],
                "completed_at": row["completed_at"].isoformat(),
                "status": row["completion_status"],
                "rating": row["rating"],
                "scenes_completed": row["scenes_completed"],
                "total_scenes": row["total_scenes"],
                "time_spent_minutes": row["time_spent_minutes"],
            }
            for row in rows
        ],
        "total_courses": len(rows),
        "total_time": sum(row["time_spent_minutes"] or 0 for row in rows),
    }


# ==================== 推荐生成 ====================

async def generate_recommendations(
    db: asyncpg.Connection,
    user_uuid: uuid.UUID,
    course_uuid: uuid.UUID
) -> List[dict]:
    """生成课程后续推荐"""
    # 获取当前课程信息
    course = await db.fetchrow(
        "SELECT id, name, description, tags FROM stages WHERE id = $1",
        course_uuid
    )

    if not course:
        return []

    # 解析课程标签（假设有tags字段，如果没有则从name/description推断）
    course_tags = []
    if course.get("tags"):
        course_tags = course["tags"].split(",")

    # 获取用户已完成的其他课程
    completed_courses = await db.fetch(
        """
        SELECT course_id FROM course_completions
        WHERE user_id = $1 AND course_id != $2
        """,
        user_uuid, course_uuid
    )
    completed_ids = {str(row["course_id"]) for row in completed_courses}

    # 查找可推荐课程
    recommendations = []

    # 1. 同标签的其他课程（进阶）
    if course_tags:
        similar_courses = await db.fetch(
            """
            SELECT id, name, description, tags FROM stages
            WHERE id != $1 AND user_id != $2
            AND (tags LIKE '%' || $3 || '%' OR name LIKE '%' || $4 || '%')
            LIMIT 5
            """,
            course_uuid, user_uuid, course_tags[0], course["name"].split()[0] if course["name"] else ""
        )

        for sim in similar_courses:
            if str(sim["id"]) not in completed_ids:
                rec_id = uuid.uuid4()
                await db.execute(
                    """
                    INSERT INTO course_recommendations
                    (id, source_course_id, target_course_id, recommendation_type, weight, reason, created_at)
                    VALUES ($1, $2, $3, 'advanced', 0.8, '同主题进阶', $4)
                    """,
                    rec_id, course_uuid, sim["id"], datetime.utcnow()
                )
                recommendations.append({
                    "id": str(rec_id),
                    "course_id": str(sim["id"]),
                    "course_name": sim["name"],
                    "type": "advanced",
                    "type_name": "进阶课程",
                    "weight": 0.8,
                })

    # 2. 相关主题课程
    related_courses = await db.fetch(
        """
        SELECT id, name, description FROM stages
        WHERE id != $1 AND user_id != $2
        AND created_at > NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC
        LIMIT 3
        """,
        course_uuid, user_uuid
    )

    for rel in related_courses:
        if str(rel["id"]) not in completed_ids:
            rec_id = uuid.uuid4()
            await db.execute(
                """
                INSERT INTO course_recommendations
                (id, source_course_id, target_course_id, recommendation_type, weight, reason, created_at)
                VALUES ($1, $2, $3, 'related', 0.6, '热门课程', $4)
                """,
                rec_id, course_uuid, rel["id"], datetime.utcnow()
            )
            recommendations.append({
                "id": str(rec_id),
                "course_id": str(rel["id"]),
                "course_name": rel["name"],
                "type": "related",
                "type_name": "相关课程",
                "weight": 0.6,
            })

    return recommendations[:5]


@router.get("/{course_id}/recommendations")
async def get_course_recommendations(
    course_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取课程后续推荐"""
    user_uuid = uuid.UUID(current_user_id)
    course_uuid = uuid.UUID(course_id)

    # 检查课程是否属于用户
    course = await db.fetchrow(
        "SELECT id, name FROM stages WHERE id = $1 AND user_id = $2",
        course_uuid, user_uuid
    )

    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")

    # 获取已存储的推荐
    stored_recs = await db.fetch(
        """
        SELECT cr.id, cr.target_course_id, cr.recommendation_type, cr.weight,
               s.name as target_name, s.description as target_desc
        FROM course_recommendations cr
        JOIN stages s ON s.id = cr.target_course_id
        WHERE cr.source_course_id = $1
        ORDER BY cr.weight DESC
        """,
        course_uuid
    )

    if stored_recs:
        recommendations = [
            {
                "id": str(row["id"]),
                "course_id": str(row["target_course_id"]),
                "course_name": row["target_name"],
                "description": row["target_desc"],
                "type": row["recommendation_type"],
                "type_name": RECOMMENDATION_TYPES.get(row["recommendation_type"], {}).get("name", "推荐"),
                "weight": row["weight"],
            }
            for row in stored_recs
        ]
    else:
        # 动态生成推荐
        recommendations = await generate_recommendations(db, user_uuid, course_uuid)

    # 获取用户已完成的课程
    completed = await db.fetch(
        "SELECT course_id FROM course_completions WHERE user_id = $1",
        user_uuid
    )
    completed_ids = {str(row["course_id"]) for row in completed}

    # 标记推荐状态
    for rec in recommendations:
        rec["is_completed"] = rec["course_id"] in completed_ids

    return {
        "source_course": {
            "id": str(course_uuid),
            "name": course["name"],
        },
        "recommendations": recommendations,
        "total": len(recommendations),
        "available": len([r for r in recommendations if not r["is_completed"]]),
    }


# ==================== 学习路径 ====================

@router.get("/paths")
async def get_my_learning_paths(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取我的学习路径"""
    user_uuid = uuid.UUID(current_user_id)

    paths = await db.fetch(
        """
        SELECT id, path_name, description, course_ids, status, progress, created_at, updated_at
        FROM learning_paths WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        user_uuid
    )

    result = []
    for path in paths:
        course_ids = path["course_ids"].split(",") if path["course_ids"] else []

        # 获取课程详情
        courses = []
        for cid in course_ids:
            course = await db.fetchrow(
                "SELECT id, name FROM stages WHERE id = $1",
                uuid.UUID(cid)
            )
            if course:
                # 检查完成状态
                completion = await db.fetchrow(
                    "SELECT completion_status FROM course_completions WHERE user_id = $1 AND course_id = $2",
                    user_uuid, uuid.UUID(cid)
                )
                courses.append({
                    "id": str(course["id"]),
                    "name": course["name"],
                    "completed": completion is not None,
                })

        result.append({
            "id": str(path["id"]),
            "name": path["path_name"],
            "description": path["description"],
            "courses": courses,
            "status": path["status"],
            "progress": path["progress"],
            "created_at": path["created_at"].isoformat(),
        })

    return {"paths": result}


@router.post("/paths")
async def create_learning_path(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """创建学习路径"""
    user_uuid = uuid.UUID(current_user_id)

    path_name = body.get("name", "我的学习路径")
    description = body.get("description")
    course_ids = body.get("course_ids", [])

    if not course_ids:
        raise HTTPException(status_code=400, detail="课程列表不能为空")

    # 验证课程存在
    for cid in course_ids:
        course = await db.fetchrow(
            "SELECT id FROM stages WHERE id = $1",
            uuid.UUID(cid)
        )
        if not course:
            raise HTTPException(status_code=400, detail=f"课程 {cid} 不存在")

    path_id = uuid.uuid4()
    await db.execute(
        """
        INSERT INTO learning_paths
        (id, user_id, path_name, description, course_ids, status, progress, created_at)
        VALUES ($1, $2, $3, $4, $5, 'active', 0, $6)
        """,
        path_id, user_uuid, path_name, description, ",".join(course_ids), datetime.utcnow()
    )

    return {
        "id": str(path_id),
        "name": path_name,
        "course_ids": course_ids,
        "message": "学习路径已创建",
    }


@router.put("/paths/{path_id}/progress")
async def update_path_progress(
    path_id: str,
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """更新学习路径进度"""
    user_uuid = uuid.UUID(current_user_id)
    path_uuid = uuid.UUID(path_id)

    path = await db.fetchrow(
        "SELECT id, course_ids FROM learning_paths WHERE id = $1 AND user_id = $2",
        path_uuid, user_uuid
    )

    if not path:
        raise HTTPException(status_code=404, detail="学习路径不存在")

    course_ids = path["course_ids"].split(",") if path["course_ids"] else []
    completed_count = 0

    for cid in course_ids:
        completion = await db.fetchrow(
            "SELECT id FROM course_completions WHERE user_id = $1 AND course_id = $2",
            user_uuid, uuid.UUID(cid)
        )
        if completion:
            completed_count += 1

    progress = int(completed_count / len(course_ids) * 100) if course_ids else 0
    status = "completed" if progress >= 100 else "active"

    await db.execute(
        """
        UPDATE learning_paths SET progress = $1, status = $2, updated_at = $3 WHERE id = $4
        """,
        progress, status, datetime.utcnow(), path_uuid
    )

    # 完成路径奖励
    if status == "completed":
        reward_points = 50
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

    return {
        "path_id": str(path_uuid),
        "progress": progress,
        "status": status,
        "completed_courses": completed_count,
        "total_courses": len(course_ids),
    }