"""
问答悬赏路由 - 问题发布、回答、采纳
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from app.middleware.auth import get_current_user_id, get_optional_user_id
from app.db.database import get_db
from app.core.redis import invalidate_balance_cache
import asyncpg
import uuid
from datetime import datetime
from app.core.time_utils import utcnow
import re

router = APIRouter()

# ==================== 安全配置 ====================

MAX_QUESTION_LENGTH = 5000      # 问题内容最大长度
MAX_TITLE_LENGTH = 255          # 标题最大长度
MIN_BOUNTY = 10                 # 最小悬赏积分
MAX_BOUNTY = 10000              # 最大悬赏积分


# ==================== 安全辅助函数 ====================

def sanitize_content(content: str) -> str:
    """清理内容，防止 XSS"""
    if len(content) > MAX_QUESTION_LENGTH:
        content = content[:MAX_QUESTION_LENGTH]
    content = re.sub(r'<[^>]*>', '', content)  # 移除 HTML 标签
    return content.strip()


def sanitize_title(title: str) -> str:
    """清理标题"""
    if len(title) > MAX_TITLE_LENGTH:
        title = title[:MAX_TITLE_LENGTH]
    title = re.sub(r'<[^>]*>', '', title)
    return title.strip()


# ==================== 问题 API ====================

@router.post("")
async def create_question(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """发布问题（含悬赏积分）"""
    user_uuid = uuid.UUID(current_user_id)

    title = sanitize_title(body.get("title", ""))
    content = sanitize_content(body.get("content", ""))
    bounty = body.get("bounty", 0)
    tags = body.get("tags", "")

    if not title or not content:
        raise HTTPException(status_code=400, detail="标题和内容不能为空")

    if bounty < 0:
        raise HTTPException(status_code=400, detail="悬赏积分不能为负数")

    if bounty > 0:
        if bounty < MIN_BOUNTY:
            raise HTTPException(status_code=400, detail=f"最小悬赏积分: {MIN_BOUNTY}")
        if bounty > MAX_BOUNTY:
            raise HTTPException(status_code=400, detail=f"最大悬赏积分: {MAX_BOUNTY}")

    question_id = uuid.uuid4()

    # 使用事务确保原子性
    async with db.transaction():
        # 如果有悬赏，扣减积分
        if bounty > 0:
            point_account = await db.fetchrow(
                "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
                user_uuid
            )
            if point_account is None or point_account["balance"] < bounty:
                raise HTTPException(status_code=400, detail="积分余额不足")

            new_balance = point_account["balance"] - bounty
            await db.execute(
                "UPDATE point_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
                new_balance, utcnow(), user_uuid
            )

            # 记录积分流水
            await db.execute(
                """
                INSERT INTO point_transactions (id, user_id, source, amount, balance_after, reference_id, created_at)
                VALUES ($1, $2, 'bounty', $3, $4, $5, $6)
                """,
                uuid.uuid4(), user_uuid, -bounty, new_balance, question_id, utcnow()
            )

        # 创建问题
        await db.execute(
            """
            INSERT INTO questions (id, user_id, title, content, bounty, bounty_status, tags, created_at)
            VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)
            """,
            question_id, user_uuid, title, content, bounty, tags, utcnow()
        )

    # 清除余额缓存
    await invalidate_balance_cache(current_user_id)

    return {
        "id": str(question_id),
        "title": title,
        "bounty": bounty,
        "bounty_status": "open",
        "message": "问题已发布",
    }


@router.get("")
async def get_questions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str = None,
    tags: str = None,
    sort: str = "recent",  # recent, bounty, hot
    current_user_id: str | None = Depends(get_optional_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取问题列表（公开访问）"""
    offset = (page - 1) * limit

    # 构建查询条件
    conditions = []
    params = []
    param_idx = 1

    if status:
        conditions.append(f"bounty_status = ${param_idx}")
        params.append(status)
        param_idx += 1

    if tags:
        conditions.append(f"tags LIKE ${param_idx}")
        params.append(f"%{tags}%")
        param_idx += 1

    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

    # 排序
    order_clause = "ORDER BY created_at DESC"
    if sort == "bounty":
        order_clause = "ORDER BY bounty DESC, created_at DESC"
    elif sort == "hot":
        order_clause = "ORDER BY view_count DESC, answer_count DESC, created_at DESC"

    # 查询问题
    rows = await db.fetch(
        f"""
        SELECT id, user_id, title, content, bounty, bounty_status, tags, view_count, answer_count,
               accepted_answer_id, created_at
        FROM questions
        {where_clause}
        {order_clause}
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """,
        *params, limit, offset
    )

    # 查询总数
    total = await db.fetchval(
        f"""
        SELECT COUNT(*) FROM questions {where_clause}
        """,
        *params
    )

    # 获取用户昵称
    user_ids = [row["user_id"] for row in rows]
    users = await db.fetch(
        "SELECT id, nickname FROM users WHERE id = ANY($1)",
        user_ids
    )
    user_map = {u["id"]: u["nickname"] for u in users}

    return {
        "items": [
            {
                "id": str(row["id"]),
                "user_id": str(row["user_id"]),
                "user_nickname": user_map.get(row["user_id"], "匿名"),
                "title": row["title"],
                "content": row["content"][:200] + "..." if len(row["content"]) > 200 else row["content"],
                "bounty": row["bounty"],
                "bounty_status": row["bounty_status"],
                "tags": row["tags"] or "",
                "view_count": row["view_count"] or 0,
                "answer_count": row["answer_count"] or 0,
                "has_accepted": row["accepted_answer_id"] is not None,
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit,
        }
    }


@router.get("/{question_id}")
async def get_question_detail(
    question_id: str,
    current_user_id: str | None = Depends(get_optional_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取问题详情（公开访问）"""
    q_uuid = uuid.UUID(question_id)

    question = await db.fetchrow(
        """
        SELECT id, user_id, title, content, bounty, bounty_status, tags,
               view_count, answer_count, accepted_answer_id, created_at, updated_at
        FROM questions WHERE id = $1
        """,
        q_uuid
    )

    if not question:
        raise HTTPException(status_code=404, detail="问题不存在")

    # 更新浏览数（原子更新，避免 NULL + 1 问题）
    new_view_count = await db.fetchval(
        "UPDATE questions SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1 RETURNING view_count",
        q_uuid
    )

    # 获取用户昵称
    user = await db.fetchrow(
        "SELECT nickname FROM users WHERE id = $1",
        question["user_id"]
    )

    return {
        "id": str(question["id"]),
        "user_id": str(question["user_id"]),
        "user_nickname": user["nickname"] if user else "匿名",
        "title": question["title"],
        "content": question["content"],
        "bounty": question["bounty"],
        "bounty_status": question["bounty_status"],
        "tags": question["tags"] or "",
        "view_count": new_view_count,  # 使用原子更新后的值
        "answer_count": question["answer_count"] or 0,
        "accepted_answer_id": str(question["accepted_answer_id"]) if question["accepted_answer_id"] else None,
        "created_at": question["created_at"].isoformat(),
        "updated_at": question["updated_at"].isoformat() if question["updated_at"] else None,
    }