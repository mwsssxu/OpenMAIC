"""
课程分享路由 - 用户课程分享和发现
"""

from fastapi import APIRouter, HTTPException, status, Depends, Body
from app.db.database import get_db
from app.middleware.auth import get_current_user_id, get_current_user
import asyncpg
import uuid
from datetime import datetime
from app.core.time_utils import utcnow
from typing import Optional

router = APIRouter()


@router.post("/{classroom_id}/share")
async def share_classroom(
    classroom_id: str,
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """分享课程"""
    user_uuid = uuid.UUID(current_user_id)
    classroom_uuid = uuid.UUID(classroom_id)

    # 验证所有权
    stage = await db.fetchrow(
        "SELECT id, name, description FROM stages WHERE id = $1 AND user_id = $2",
        classroom_uuid, user_uuid
    )

    if not stage:
        raise HTTPException(status_code=404, detail="课程不存在")

    # 检查是否已分享
    existing_share = await db.fetchrow(
        "SELECT id, share_code FROM shared_classrooms WHERE stage_id = $1 AND user_id = $2",
        classroom_uuid, user_uuid
    )

    if existing_share:
        # 更新分享信息
        await db.execute(
            """
            UPDATE shared_classrooms
            SET is_public = $1, title = $2, description = $3, updated_at = $4
            WHERE id = $5
            """,
            body.get("is_public", True),
            body.get("title", stage["name"]),
            body.get("description", stage["description"]),
            utcnow(),
            existing_share["id"]
        )
        share_code = existing_share["share_code"]
    else:
        # 创建新分享
        share_code = generate_share_code()
        await db.execute(
            """
            INSERT INTO shared_classrooms
            (id, stage_id, user_id, share_code, is_public, title, description, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
            """,
            uuid.uuid4(),
            classroom_uuid,
            user_uuid,
            share_code,
            body.get("is_public", True),
            body.get("title", stage["name"]),
            body.get("description", stage["description"]),
            utcnow()
        )

        # 授予分享成就
        await check_share_achievement(db, user_uuid)

        # 触发成长体系事件（自动打卡+分享笔记任务+积分）
        from app.services.gamification_events import record_learning_activity
        await record_learning_activity(
            db, user_uuid, "share", value=1, user_id=current_user_id,
            context={"share_code": share_code, "classroom_id": classroom_id}
        )

    return {
        "share_code": share_code,
        "share_url": f"/share/{share_code}",
        "message": "分享成功！",
    }


@router.get("/share/{share_code}")
async def get_shared_classroom(
    share_code: str,
    db: asyncpg.Connection = Depends(get_db)
):
    """获取分享的课程（无需登录）"""
    share = await db.fetchrow(
        """
        SELECT sc.id, sc.stage_id, sc.title, sc.description, sc.is_public,
               sc.view_count, sc.like_count, u.nickname as author_name
        FROM shared_classrooms sc
        JOIN users u ON sc.user_id = u.id
        WHERE sc.share_code = $1
        """,
        share_code
    )

    if not share:
        raise HTTPException(status_code=404, detail="分享链接无效")

    if not share["is_public"]:
        raise HTTPException(status_code=403, detail="该课程未公开分享")

    # 获取课程内容
    stage = await db.fetchrow(
        "SELECT id, name, language_directive, style, agent_ids FROM stages WHERE id = $1",
        share["stage_id"]
    )

    scenes = await db.fetch(
        """
        SELECT id, type, title, order_index, content
        FROM scenes WHERE stage_id = $1 ORDER BY order_index
        """,
        share["stage_id"]
    )

    # 增加浏览次数
    await db.execute(
        "UPDATE shared_classrooms SET view_count = view_count + 1 WHERE id = $1",
        share["id"]
    )

    return {
        "share_code": share_code,
        "title": share["title"],
        "description": share["description"],
        "author": share["author_name"],
        "view_count": share["view_count"] + 1,
        "like_count": share["like_count"],
        "stage": {
            "id": str(stage["id"]),
            "name": stage["name"],
            "language_directive": stage["language_directive"],
            "style": stage["style"],
            "agent_ids": stage["agent_ids"],
        },
        "scenes": [
            {
                "id": str(s["id"]),
                "type": s["type"],
                "title": s["title"],
                "order_index": s["order_index"],
                "content": s["content"],
            }
            for s in scenes
        ],
    }


@router.post("/share/{share_code}/like")
async def like_shared_classroom(
    share_code: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """点赞分享的课程"""
    user_uuid = uuid.UUID(current_user_id)

    share = await db.fetchrow(
        "SELECT id, stage_id FROM shared_classrooms WHERE share_code = $1",
        share_code
    )

    if not share:
        raise HTTPException(status_code=404, detail="分享链接无效")

    # 检查是否已点赞
    existing_like = await db.fetchrow(
        """
        SELECT id FROM classroom_likes
        WHERE shared_classroom_id = $1 AND user_id = $2
        """,
        share["id"], user_uuid
    )

    if existing_like:
        # 取消点赞
        await db.execute(
            "DELETE FROM classroom_likes WHERE id = $1",
            existing_like["id"]
        )
        await db.execute(
            "UPDATE shared_classrooms SET like_count = like_count - 1 WHERE id = $1",
            share["id"]
        )
        return {"liked": False, "message": "已取消点赞"}
    else:
        # 添加点赞
        await db.execute(
            """
            INSERT INTO classroom_likes (id, shared_classroom_id, user_id, created_at)
            VALUES ($1, $2, $3, $4)
            """,
            uuid.uuid4(), share["id"], user_uuid, utcnow()
        )
        await db.execute(
            "UPDATE shared_classrooms SET like_count = like_count + 1 WHERE id = $1",
            share["id"]
        )
        return {"liked": True, "message": "点赞成功"}


@router.get("/discover")
async def discover_shared_classrooms(
    category: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: asyncpg.Connection = Depends(get_db)
):
    """发现公开分享的课程"""
    query = """
        SELECT sc.share_code, sc.title, sc.description, sc.view_count, sc.like_count,
               sc.avg_rating, sc.rating_count, sc.created_at, sc.stage_id,
               u.nickname as author_name, s.language_directive, s.style
        FROM shared_classrooms sc
        JOIN users u ON sc.user_id = u.id
        JOIN stages s ON sc.stage_id = s.id
        WHERE sc.is_public = TRUE
    """

    if category:
        query += f" AND s.language_directive LIKE '%{category}%'"

    query += """
        ORDER BY sc.like_count DESC, sc.view_count DESC, sc.created_at DESC
        LIMIT $1 OFFSET $2
    """

    rows = await db.fetch(query, limit, offset)

    return {
        "classrooms": [
            {
                "share_code": row["share_code"],
                "stage_id": str(row["stage_id"]),
                "title": row["title"],
                "description": row["description"],
                "author": row["author_name"],
                "style": row["style"],
                "view_count": row["view_count"],
                "like_count": row["like_count"],
                "avg_rating": float(row["avg_rating"]) if row["avg_rating"] else 0,
                "rating_count": row["rating_count"],
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ],
        "total": len(rows),
    }


@router.get("/my-shares")
async def get_my_shared_classrooms(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取我分享的课程"""
    user_uuid = uuid.UUID(current_user_id)

    rows = await db.fetch(
        """
        SELECT sc.share_code, sc.title, sc.description, sc.is_public,
               sc.view_count, sc.like_count, sc.created_at, s.name as original_name
        FROM shared_classrooms sc
        JOIN stages s ON sc.stage_id = s.id
        WHERE sc.user_id = $1
        ORDER BY sc.created_at DESC
        """,
        user_uuid
    )

    return {
        "shares": [
            {
                "share_code": row["share_code"],
                "title": row["title"],
                "original_name": row["original_name"],
                "is_public": row["is_public"],
                "view_count": row["view_count"],
                "like_count": row["like_count"],
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ]
    }


# ==================== 辅助函数 ====================

def generate_share_code() -> str:
    """生成 6 位分享码"""
    import random
    import string
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))


async def check_share_achievement(db: asyncpg.Connection, user_uuid):
    """检查分享成就"""
    share_count = await db.fetchval(
        "SELECT COUNT(*) FROM shared_classrooms WHERE user_id = $1",
        user_uuid
    )

    if share_count >= 1:
        # 授予首次分享成就
        await db.execute(
            """
            INSERT INTO user_achievements (id, user_id, achievement_id, progress, earned_at)
            VALUES ($1, $2, 'share_first', 1, $3)
            ON CONFLICT DO NOTHING
            """,
            uuid.uuid4(), user_uuid, utcnow()
        )


@router.post("/share/{share_code}/rate")
async def rate_shared_classroom(
    share_code: str,
    body: dict = Body(...),
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """给公开课程打分（1-5）"""
    rating = body.get("rating")
    if not rating or rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="评分必须在 1-5 之间")

    user_uuid = uuid.UUID(current_user_id)

    share = await db.fetchrow(
        "SELECT id FROM shared_classrooms WHERE share_code = $1 AND is_public = TRUE",
        share_code
    )
    if not share:
        raise HTTPException(status_code=404, detail="课程不存在或未公开")

    # Upsert 评分
    existing = await db.fetchrow(
        "SELECT id, rating FROM classroom_ratings WHERE shared_classroom_id = $1 AND user_id = $2",
        share["id"], user_uuid
    )
    if existing:
        await db.execute(
            "UPDATE classroom_ratings SET rating = $1 WHERE id = $2",
            rating, existing["id"]
        )
    else:
        await db.execute(
            "INSERT INTO classroom_ratings (id, shared_classroom_id, user_id, rating) VALUES ($1, $2, $3, $4)",
            uuid.uuid4(), share["id"], user_uuid, rating
        )

    # 重新计算平均评分
    stats = await db.fetchrow(
        "SELECT AVG(rating)::numeric(3,2) as avg, COUNT(*) as cnt FROM classroom_ratings WHERE shared_classroom_id = $1",
        share["id"]
    )
    await db.execute(
        "UPDATE shared_classrooms SET avg_rating = $1, rating_count = $2 WHERE id = $3",
        stats["avg"], stats["cnt"], share["id"]
    )

    return {"rating": rating, "avg_rating": float(stats["avg"]), "rating_count": stats["cnt"]}