"""
学习匹配路由 - 匹配偏好设置、智能匹配算法
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
import asyncpg
import uuid
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter()


# ==================== 匹配配置 ====================

MATCH_EXPIRE_DAYS = 7  # 匹配邀请有效期
MAX_MATCH_PER_DAY = 5  # 每日最大匹配数


# ==================== 匹配偏好 ====================

@router.get("/preferences")
async def get_matching_preferences(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取我的匹配偏好"""
    user_uuid = uuid.UUID(current_user_id)

    prefs = await db.fetchrow(
        """
        SELECT goal_tags, course_ids, progress_level, schedule_preference, match_mode, active
        FROM matching_preferences WHERE user_id = $1
        """,
        user_uuid
    )

    if not prefs:
        return {
            "goal_tags": [],
            "course_ids": [],
            "progress_level": "beginner",
            "schedule_preference": "flexible",
            "match_mode": "auto",
            "active": True,
            "is_default": True,
        }

    return {
        "goal_tags": prefs["goal_tags"].split(",") if prefs["goal_tags"] else [],
        "course_ids": prefs["course_ids"].split(",") if prefs["course_ids"] else [],
        "progress_level": prefs["progress_level"] or "beginner",
        "schedule_preference": prefs["schedule_preference"] or "flexible",
        "match_mode": prefs["match_mode"] or "auto",
        "active": prefs["active"],
        "is_default": False,
    }


@router.post("/preferences")
async def set_matching_preferences(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """设置匹配偏好"""
    user_uuid = uuid.UUID(current_user_id)

    goal_tags = body.get("goal_tags", [])
    course_ids = body.get("course_ids", [])
    progress_level = body.get("progress_level", "beginner")
    schedule_preference = body.get("schedule_preference", "flexible")
    match_mode = body.get("match_mode", "auto")

    if progress_level not in ["beginner", "intermediate", "advanced"]:
        raise HTTPException(status_code=400, detail="无效的进度等级")

    if schedule_preference not in ["morning", "afternoon", "evening", "flexible"]:
        raise HTTPException(status_code=400, detail="无效的时间偏好")

    # 检查是否已有偏好
    existing = await db.fetchrow(
        "SELECT id FROM matching_preferences WHERE user_id = $1",
        user_uuid
    )

    tags_str = ",".join(goal_tags) if goal_tags else None
    courses_str = ",".join(course_ids) if course_ids else None

    if existing:
        await db.execute(
            """
            UPDATE matching_preferences
            SET goal_tags = $1, course_ids = $2, progress_level = $3,
                schedule_preference = $4, match_mode = $5, active = TRUE, updated_at = $6
            WHERE user_id = $7
            """,
            tags_str, courses_str, progress_level, schedule_preference, match_mode,
            datetime.utcnow(), user_uuid
        )
    else:
        await db.execute(
            """
            INSERT INTO matching_preferences
            (id, user_id, goal_tags, course_ids, progress_level, schedule_preference, match_mode, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            uuid.uuid4(), user_uuid, tags_str, courses_str, progress_level,
            schedule_preference, match_mode, datetime.utcnow()
        )

    return {
        "goal_tags": goal_tags,
        "course_ids": course_ids,
        "progress_level": progress_level,
        "schedule_preference": schedule_preference,
        "message": "匹配偏好已更新",
    }


# ==================== 匹配算法 ====================

async def calculate_match_score(
    db: asyncpg.Connection,
    user_uuid: uuid.UUID,
    candidate_uuid: uuid.UUID
) -> dict:
    """计算匹配度分数"""
    # 获取两个用户的偏好
    user_prefs = await db.fetchrow(
        """
        SELECT goal_tags, course_ids, progress_level, schedule_preference
        FROM matching_preferences WHERE user_id = $1
        """,
        user_uuid
    )
    candidate_prefs = await db.fetchrow(
        """
        SELECT goal_tags, course_ids, progress_level, schedule_preference
        FROM matching_preferences WHERE user_id = $1
        """,
        candidate_uuid
    )

    if not user_prefs or not candidate_prefs:
        return {"score": 0, "common_courses": [], "common_tags": []}

    # 计算共同课程
    user_courses = set(user_prefs["course_ids"].split(",")) if user_prefs["course_ids"] else set()
    candidate_courses = set(candidate_prefs["course_ids"].split(",")) if candidate_prefs["course_ids"] else set()
    common_courses = list(user_courses & candidate_courses)

    # 计算共同学习目标标签
    user_tags = set(user_prefs["goal_tags"].split(",")) if user_prefs["goal_tags"] else set()
    candidate_tags = set(candidate_prefs["goal_tags"].split(",")) if candidate_prefs["goal_tags"] else set()
    common_tags = list(user_tags & candidate_tags)

    # 计算分数
    course_score = len(common_courses) * 25
    tag_score = len(common_tags) * 15

    # 进度等级匹配加分
    if user_prefs["progress_level"] == candidate_prefs["progress_level"]:
        tag_score += 20

    # 时间偏好匹配加分
    if user_prefs["schedule_preference"] == candidate_prefs["schedule_preference"]:
        tag_score += 10
    elif user_prefs["schedule_preference"] == "flexible" or candidate_prefs["schedule_preference"] == "flexible":
        tag_score += 5

    total_score = course_score + tag_score

    return {
        "score": min(total_score, 100),
        "common_courses": common_courses,
        "common_tags": common_tags,
    }


# ==================== 匹配操作 ====================

@router.post("/search")
async def search_matches(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """搜索匹配"""
    user_uuid = uuid.UUID(current_user_id)

    # 检查是否已有待处理匹配
    pending_count = await db.fetchval(
        """
        SELECT COUNT(*) FROM learning_matches
        WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'pending'
        """,
        user_uuid
    )
    if pending_count >= MAX_MATCH_PER_DAY:
        raise HTTPException(status_code=400, detail="待处理匹配已达上限")

    # 获取用户偏好
    prefs = await db.fetchrow(
        """
        SELECT goal_tags, course_ids, progress_level, active
        FROM matching_preferences WHERE user_id = $1
        """,
        user_uuid
    )
    if not prefs or not prefs["active"]:
        raise HTTPException(status_code=400, detail="请先设置匹配偏好并激活")

    # 寻找候选用户
    candidates = await db.fetch(
        """
        SELECT user_id FROM matching_preferences
        WHERE user_id != $1 AND active = TRUE
        AND (
            course_ids LIKE '%' || $2 || '%'
            OR goal_tags LIKE '%' || $3 || '%'
            OR progress_level = $4
        )
        LIMIT 20
        """,
        user_uuid,
        prefs["course_ids"] or "",
        prefs["goal_tags"] or "",
        prefs["progress_level"] or "beginner"
    )

    matches_found = []
    for candidate in candidates:
        candidate_uuid = candidate["user_id"]

        # 检查是否已有匹配记录
        existing = await db.fetchrow(
            """
            SELECT id FROM learning_matches
            WHERE (user_id_1 = $1 AND user_id_2 = $2)
               OR (user_id_1 = $2 AND user_id_2 = $1)
            """,
            user_uuid, candidate_uuid
        )
        if existing:
            continue

        # 计算匹配分数
        match_result = await calculate_match_score(db, user_uuid, candidate_uuid)

        if match_result["score"] >= 30:  # 最低匹配阈值
            match_id = uuid.uuid4()
            await db.execute(
                """
                INSERT INTO learning_matches
                (id, user_id_1, user_id_2, match_type, match_score, common_courses,
                 common_tags, status, expires_at, created_at)
                VALUES ($1, $2, $3, 'study', $4, $5, $6, 'pending', $7, $8)
                """,
                match_id, user_uuid, candidate_uuid, match_result["score"],
                ",".join(match_result["common_courses"]) if match_result["common_courses"] else None,
                ",".join(match_result["common_tags"]) if match_result["common_tags"] else None,
                datetime.utcnow() + timedelta(days=MATCH_EXPIRE_DAYS),
                datetime.utcnow()
            )

            # 获取候选人信息
            candidate_user = await db.fetchrow(
                "SELECT nickname, avatar_url FROM users WHERE id = $1",
                candidate_uuid
            )

            matches_found.append({
                "match_id": str(match_id),
                "user_id": str(candidate_uuid),
                "nickname": candidate_user["nickname"],
                "avatar_url": candidate_user["avatar_url"],
                "score": match_result["score"],
                "common_courses": match_result["common_courses"],
                "common_tags": match_result["common_tags"],
            })

    return {
        "matches": matches_found[:MAX_MATCH_PER_DAY],
        "message": f"找到 {len(matches_found)} 个匹配",
    }


@router.get("/pending")
async def get_pending_matches(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取待处理匹配"""
    user_uuid = uuid.UUID(current_user_id)

    rows = await db.fetch(
        """
        SELECT lm.id, lm.user_id_1, lm.user_id_2, lm.match_score, lm.common_courses,
               lm.common_tags, lm.created_at, lm.expires_at,
               u.nickname, u.avatar_url
        FROM learning_matches lm
        JOIN users u ON u.id = CASE
            WHEN lm.user_id_1 = $1 THEN lm.user_id_2
            ELSE lm.user_id_1
        END
        WHERE (lm.user_id_1 = $1 OR lm.user_id_2 = $1) AND lm.status = 'pending'
        ORDER BY lm.match_score DESC
        """,
        user_uuid
    )

    return {
        "matches": [
            {
                "match_id": str(row["id"]),
                "user_id": str(row["user_id_2"] if row["user_id_1"] == user_uuid else row["user_id_1"]),
                "nickname": row["nickname"],
                "avatar_url": row["avatar_url"],
                "score": row["match_score"],
                "common_courses": row["common_courses"].split(",") if row["common_courses"] else [],
                "common_tags": row["common_tags"].split(",") if row["common_tags"] else [],
                "expires_at": row["expires_at"].isoformat(),
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ],
    }


@router.post("/{match_id}/accept")
async def accept_match(
    match_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """接受匹配"""
    user_uuid = uuid.UUID(current_user_id)
    m_uuid = uuid.UUID(match_id)

    match = await db.fetchrow(
        """
        SELECT id, user_id_1, user_id_2, status FROM learning_matches WHERE id = $1
        """,
        m_uuid
    )

    if not match:
        raise HTTPException(status_code=404, detail="匹配不存在")

    if match["user_id_1"] != user_uuid and match["user_id_2"] != user_uuid:
        raise HTTPException(status_code=403, detail="无权操作此匹配")

    if match["status"] != "pending":
        raise HTTPException(status_code=400, detail="匹配状态已变更")

    await db.execute(
        """
        UPDATE learning_matches SET status = 'accepted', updated_at = $1 WHERE id = $2
        """,
        datetime.utcnow(), m_uuid
    )

    return {"match_id": str(m_uuid), "status": "accepted", "message": "匹配已接受"}


@router.post("/{match_id}/reject")
async def reject_match(
    match_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """拒绝匹配"""
    user_uuid = uuid.UUID(current_user_id)
    m_uuid = uuid.UUID(match_id)

    match = await db.fetchrow(
        """
        SELECT id, user_id_1, user_id_2, status FROM learning_matches WHERE id = $1
        """,
        m_uuid
    )

    if not match:
        raise HTTPException(status_code=404, detail="匹配不存在")

    if match["user_id_1"] != user_uuid and match["user_id_2"] != user_uuid:
        raise HTTPException(status_code=403, detail="无权操作此匹配")

    if match["status"] != "pending":
        raise HTTPException(status_code=400, detail="匹配状态已变更")

    await db.execute(
        """
        UPDATE learning_matches SET status = 'rejected', updated_at = $1 WHERE id = $2
        """,
        datetime.utcnow(), m_uuid
    )

    return {"match_id": str(m_uuid), "status": "rejected", "message": "匹配已拒绝"}


@router.get("/accepted")
async def get_accepted_matches(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取已接受的匹配（学习伙伴）"""
    user_uuid = uuid.UUID(current_user_id)

    rows = await db.fetch(
        """
        SELECT lm.id, lm.user_id_1, lm.user_id_2, lm.common_courses, lm.common_tags,
               u.nickname, u.avatar_url
        FROM learning_matches lm
        JOIN users u ON u.id = CASE
            WHEN lm.user_id_1 = $1 THEN lm.user_id_2
            ELSE lm.user_id_1
        END
        WHERE (lm.user_id_1 = $1 OR lm.user_id_2 = $1) AND lm.status = 'accepted'
        ORDER BY lm.updated_at DESC
        """,
        user_uuid
    )

    return {
        "partners": [
            {
                "match_id": str(row["id"]),
                "user_id": str(row["user_id_2"] if row["user_id_1"] == user_uuid else row["user_id_1"]),
                "nickname": row["nickname"],
                "avatar_url": row["avatar_url"],
                "common_courses": row["common_courses"].split(",") if row["common_courses"] else [],
                "common_tags": row["common_tags"].split(",") if row["common_tags"] else [],
            }
            for row in rows
        ],
    }