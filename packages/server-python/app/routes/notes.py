"""
共享笔记路由 - 笔记发布、购买、收益统计
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.core.redis import invalidate_balance_cache
import asyncpg
import uuid
from datetime import datetime
from app.core.time_utils import utcnow

router = APIRouter()

# ==================== 收益分配 ====================

AUTHOR_RATIO = 0.70  # 作者70%
PLATFORM_RATIO = 0.30  # 平台30%
MIN_AUTHOR_REWARD = 1  # 作者最低收益


# ==================== 笔记发布 ====================

@router.post("/")
async def publish_note(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """发布共享笔记"""
    user_uuid = uuid.UUID(current_user_id)

    title = body.get("title", "").strip()
    content = body.get("content", "").strip()
    course_id = body.get("course_id")
    visibility = body.get("visibility", "public")
    price = body.get("price", 0)
    tags = body.get("tags", "")

    if not title or not content:
        raise HTTPException(status_code=400, detail="标题和内容不能为空")

    if visibility not in ["public", "paid", "matched"]:
        raise HTTPException(status_code=400, detail="无效的可见范围")

    if price < 0:
        raise HTTPException(status_code=400, detail="价格不能为负数")

    note_id = uuid.uuid4()

    await db.execute(
        """
        INSERT INTO shared_notes (id, user_id, title, content, course_id, visibility, price, tags, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', $9)
        """,
        note_id, user_uuid, title, content,
        uuid.UUID(course_id) if course_id else None,
        visibility, price, tags, utcnow()
    )

    return {
        "id": str(note_id),
        "title": title,
        "visibility": visibility,
        "price": price,
        "message": "笔记已发布",
    }


@router.get("/")
async def get_notes_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    visibility: str = None,
    course_id: str = None,
    search: str = None,
    sort: str = "recent",  # recent, popular, rating
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取笔记列表"""
    user_uuid = uuid.UUID(current_user_id)
    offset = (page - 1) * limit

    # 构建查询
    conditions = ["status = 'published'"]
    params = []
    param_idx = 1

    if visibility:
        conditions.append(f"visibility = ${param_idx}")
        params.append(visibility)
        param_idx += 1

    if course_id:
        conditions.append(f"course_id = ${param_idx}")
        params.append(uuid.UUID(course_id))
        param_idx += 1

    if search:
        # [W-1 fix] Escape LIKE wildcards to prevent injection
        escaped_search = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        conditions.append(f"(title ILIKE ${param_idx} OR content ILIKE ${param_idx})")
        params.append(f"%{escaped_search}%")
        param_idx += 1

    where_clause = "WHERE " + " AND ".join(conditions)

    # 排序
    order_clause = "ORDER BY created_at DESC"
    if sort == "popular":
        order_clause = "ORDER BY purchase_count DESC, created_at DESC"
    elif sort == "rating":
        order_clause = "ORDER BY rating DESC, created_at DESC"

    rows = await db.fetch(
        f"""
        SELECT id, user_id, title, visibility, price, tags, rating,
               rating_count, purchase_count, created_at
        FROM shared_notes {where_clause} {order_clause}
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """,
        *params, limit, offset
    )

    # 获取购买状态
    purchased_ids = await db.fetch(
        """
        SELECT note_id FROM note_purchases WHERE user_id = $1
        """,
        user_uuid
    )
    purchased_set = {str(row["note_id"]) for row in purchased_ids}

    return {
        "items": [
            {
                "id": str(row["id"]),
                "user_id": str(row["user_id"]),
                "title": row["title"],
                "visibility": row["visibility"],
                "price": row["price"],
                "tags": row["tags"],
                "rating": float(row["rating"]) if row["rating"] else 0,
                "rating_count": row["rating_count"],
                "purchase_count": row["purchase_count"],
                "is_purchased": str(row["id"]) in purchased_set,
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ],
        "pagination": {
            "page": page,
            "limit": limit,
        },
    }


# ==================== 我的笔记（必须在 /{note_id} 之前）====================

@router.get("/my-shares")
async def get_my_shared_notes(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取我发布的共享笔记列表"""
    user_uuid = uuid.UUID(current_user_id)

    rows = await db.fetch(
        """
        SELECT id, title, visibility, price, rating, rating_count,
               purchase_count, status, created_at
        FROM shared_notes
        WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        user_uuid
    )

    return {
        "shares": [
            {
                "id": str(row["id"]),
                "title": row["title"],
                "visibility": row["visibility"],
                "price": row["price"],
                "rating": float(row["rating"]) if row["rating"] else 0,
                "rating_count": row["rating_count"],
                "purchase_count": row["purchase_count"],
                "status": row["status"],
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ]
    }


@router.get("/my/earnings")
async def get_my_earnings(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取笔记收益统计"""
    user_uuid = uuid.UUID(current_user_id)

    total = await db.fetchrow(
        """
        SELECT COALESCE(SUM(author_reward), 0) as total_earnings,
               COUNT(*) as total_purchases
        FROM note_purchases WHERE note_id IN (
            SELECT id FROM shared_notes WHERE user_id = $1
        )
        """,
        user_uuid
    )

    notes_count = await db.fetchval(
        "SELECT COUNT(*) FROM shared_notes WHERE user_id = $1",
        user_uuid
    )

    return {
        "total_earnings": total["total_earnings"] or 0,
        "total_purchases": total["total_purchases"] or 0,
        "notes_count": notes_count,
    }


# ==================== 笔记详情（动态路由放最后）===================

@router.get("/{note_id}")
async def get_note_detail(
    note_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取笔记详情"""
    user_uuid = uuid.UUID(current_user_id)
    n_uuid = uuid.UUID(note_id)

    note = await db.fetchrow(
        """
        SELECT id, user_id, title, content, course_id, visibility, price, tags,
               rating, rating_count, purchase_count, status, created_at
        FROM shared_notes WHERE id = $1
        """,
        n_uuid
    )

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    # 检查购买状态
    purchased = await db.fetchrow(
        """
        SELECT id FROM note_purchases WHERE user_id = $1 AND note_id = $2
        """,
        user_uuid, n_uuid
    )

    is_purchased = purchased is not None
    is_author = note["user_id"] == user_uuid

    # 检查用户评分
    user_rating_row = await db.fetchrow(
        """
        SELECT rating FROM note_ratings WHERE user_id = $1 AND note_id = $2
        """,
        user_uuid, n_uuid
    )
    user_rating = user_rating_row["rating"] if user_rating_row else 0

    # 非公开笔记需要购买或作者是当前用户
    if note["visibility"] != "public" and not is_purchased and not is_author:
        return {
            "id": str(note["id"]),
            "title": note["title"],
            "visibility": note["visibility"],
            "price": note["price"],
            "is_purchased": False,
            "is_author": False,
            "user_rating": 0,
            "preview": note["content"][:200] + "...",  # 仅显示预览
            "message": "需要购买后查看完整内容",
        }

    return {
        "id": str(note["id"]),
        "user_id": str(note["user_id"]),
        "title": note["title"],
        "content": note["content"],
        "course_id": str(note["course_id"]) if note["course_id"] else None,
        "visibility": note["visibility"],
        "price": note["price"],
        "tags": note["tags"],
        "rating": float(note["rating"]) if note["rating"] else 0,
        "rating_count": note["rating_count"],
        "purchase_count": note["purchase_count"],
        "is_purchased": is_purchased,
        "is_author": is_author,
        "user_rating": user_rating,
        "created_at": note["created_at"].isoformat(),
    }


@router.post("/{note_id}/purchase")
async def purchase_note(
    note_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """购买笔记"""
    user_uuid = uuid.UUID(current_user_id)
    n_uuid = uuid.UUID(note_id)

    # 检查笔记
    note = await db.fetchrow(
        """
        SELECT id, user_id, title, price, visibility FROM shared_notes WHERE id = $1 AND status = 'published'
        """,
        n_uuid
    )

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    # 不能购买自己的笔记
    if note["user_id"] == user_uuid:
        raise HTTPException(status_code=400, detail="不能购买自己的笔记")

    # 检查是否已购买
    existing = await db.fetchrow(
        "SELECT id FROM note_purchases WHERE user_id = $1 AND note_id = $2",
        user_uuid, n_uuid
    )
    if existing:
        raise HTTPException(status_code=400, detail="已购买此笔记")

    price = note["price"]
    if price <= 0:
        raise HTTPException(status_code=400, detail="此笔记无需购买")

    # 计算作者收益（最低为1积分，但不超过price）
    author_reward = max(int(price * AUTHOR_RATIO), MIN_AUTHOR_REWARD if price >= 1 else 0)
    author_reward = min(author_reward, price)  # 确保作者收益不超过价格
    platform_fee = max(0, price - author_reward)  # 确保平台费不为负

    async with db.transaction():
        # 检查积分余额
        point_account = await db.fetchrow(
            "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
            user_uuid
        )
        if point_account is None or point_account["balance"] < price:
            raise HTTPException(status_code=400, detail="积分余额不足")

        # 扣减积分
        new_balance = point_account["balance"] - price
        await db.execute(
            "UPDATE point_accounts SET balance = $1 WHERE user_id = $2",
            new_balance, user_uuid
        )

        # 记录购买
        await db.execute(
            """
            INSERT INTO note_purchases (id, user_id, note_id, price, author_reward, platform_fee, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            uuid.uuid4(), user_uuid, n_uuid, price, author_reward, platform_fee, utcnow()
        )

        # 给作者发放积分
        author_account = await db.fetchrow(
            "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
            note["user_id"]
        )
        if author_account:
            author_new_balance = author_account["balance"] + author_reward
            await db.execute(
                "UPDATE point_accounts SET balance = $1 WHERE user_id = $2",
                author_new_balance, note["user_id"]
            )
            await db.execute(
                """
                INSERT INTO point_transactions (id, user_id, source, amount, balance_after, reference_id, created_at)
                VALUES ($1, $2, 'notes', $3, $4, $5, $6)
                """,
                uuid.uuid4(), note["user_id"], author_reward, author_new_balance, n_uuid, utcnow()
            )

        # 更新笔记购买数
        await db.execute(
            "UPDATE shared_notes SET purchase_count = purchase_count + 1 WHERE id = $1",
            n_uuid
        )

    # 清除缓存
    await invalidate_balance_cache(current_user_id)
    await invalidate_balance_cache(str(note["user_id"]))

    return {
        "note_id": str(n_uuid),
        "price": price,
        "author_reward": author_reward,
        "message": "笔记购买成功，可以查看完整内容",
    }


@router.post("/{note_id}/rating")
async def rate_note(
    note_id: str,
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """评分笔记（购买后，每个用户只能评一次）"""
    user_uuid = uuid.UUID(current_user_id)
    n_uuid = uuid.UUID(note_id)
    rating = body.get("rating", 0)

    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="评分范围 1-5")

    # 检查是否已购买
    purchased = await db.fetchrow(
        "SELECT id FROM note_purchases WHERE user_id = $1 AND note_id = $2",
        user_uuid, n_uuid
    )
    if not purchased:
        raise HTTPException(status_code=403, detail="购买后才能评分")

    # 检查是否已评分
    existing_rating = await db.fetchrow(
        "SELECT id, rating FROM note_ratings WHERE user_id = $1 AND note_id = $2",
        user_uuid, n_uuid
    )

    async with db.transaction():
        # [C-5 fix] Lock the row to prevent concurrent rating race condition
        await db.fetchrow(
            "SELECT id FROM shared_notes WHERE id = $1 FOR UPDATE",
            n_uuid
        )

        if existing_rating:
            # 更新评分记录
            await db.execute(
                "UPDATE note_ratings SET rating = $1 WHERE id = $2",
                rating, existing_rating["id"]
            )
        else:
            # 插入评分记录
            await db.execute(
                """
                INSERT INTO note_ratings (id, user_id, note_id, rating, created_at)
                VALUES ($1, $2, $3, $4, $5)
                """,
                uuid.uuid4(), user_uuid, n_uuid, rating, utcnow()
            )

        # [C-5 fix] Recompute rating from note_ratings table to avoid floating point drift
        await db.execute(
            """
            UPDATE shared_notes
            SET rating = (SELECT COALESCE(AVG(rating), 0) FROM note_ratings WHERE note_id = $1),
                rating_count = (SELECT COUNT(*) FROM note_ratings WHERE note_id = $1)
            WHERE id = $1
            """,
            n_uuid
        )

    return {"rating": rating, "message": "评分已记录"}
