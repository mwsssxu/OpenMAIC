"""
回答路由 - 回答提交、投票、采纳
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.core.redis import invalidate_balance_cache
import asyncpg
import uuid
from datetime import datetime
from app.core.time_utils import utcnow
import re

router = APIRouter()

# ==================== 安全配置 ====================

MAX_ANSWER_LENGTH = 10000       # 回答内容最大长度
BOUNTY_AUTHOR_RATIO = 0.9       # 作者获得90%
BOUNTY_PLATFORM_RATIO = 0.1     # 平台获得10%


def sanitize_content(content: str) -> str:
    """清理内容"""
    if len(content) > MAX_ANSWER_LENGTH:
        content = content[:MAX_ANSWER_LENGTH]
    content = re.sub(r'<[^>]*>', '', content)
    return content.strip()


# ==================== 回答 API ====================

@router.post("/")
async def create_answer(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """提交回答"""
    user_uuid = uuid.UUID(current_user_id)
    question_id = body.get("question_id")
    content = sanitize_content(body.get("content", ""))

    if not question_id or not content:
        raise HTTPException(status_code=400, detail="问题和回答内容不能为空")

    q_uuid = uuid.UUID(question_id)

    # 检查问题是否存在且未关闭
    question = await db.fetchrow(
        "SELECT id, user_id, bounty, bounty_status FROM questions WHERE id = $1",
        q_uuid
    )

    if not question:
        raise HTTPException(status_code=404, detail="问题不存在")

    if question["bounty_status"] == "closed":
        raise HTTPException(status_code=400, detail="问题已关闭")

    # 不能回答自己的问题
    if question["user_id"] == user_uuid:
        raise HTTPException(status_code=400, detail="不能回答自己的问题")

    answer_id = uuid.uuid4()

    # 创建回答
    await db.execute(
        """
        INSERT INTO answers (id, question_id, user_id, content, created_at)
        VALUES ($1, $2, $3, $4, $5)
        """,
        answer_id, q_uuid, user_uuid, content, utcnow()
    )

    # 更新问题回答数
    await db.execute(
        "UPDATE questions SET answer_count = answer_count + 1 WHERE id = $1",
        q_uuid
    )

    return {
        "id": str(answer_id),
        "question_id": str(q_uuid),
        "content": content,
        "message": "回答已提交",
    }


@router.get("/question/{question_id}")
async def get_answers_for_question(
    question_id: str,
    page: int = 1,
    limit: int = 20,
    sort: str = "recent",  # recent, votes, accepted
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取问题的回答列表"""
    q_uuid = uuid.UUID(question_id)
    offset = (page - 1) * limit

    # 排序
    order_clause = "ORDER BY created_at DESC"
    if sort == "votes":
        order_clause = "ORDER BY vote_count DESC, created_at DESC"
    elif sort == "accepted":
        order_clause = "ORDER BY is_accepted DESC, vote_count DESC, created_at DESC"

    rows = await db.fetch(
        f"""
        SELECT id, question_id, user_id, content, rating, vote_count,
               is_accepted, accepted_at, created_at
        FROM answers WHERE question_id = $1
        {order_clause}
        LIMIT $2 OFFSET $3
        """,
        q_uuid, limit, offset
    )

    total = await db.fetchval(
        "SELECT COUNT(*) FROM answers WHERE question_id = $1",
        q_uuid
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
                "question_id": str(row["question_id"]),
                "user_id": str(row["user_id"]),
                "user_nickname": user_map.get(row["user_id"], "匿名"),
                "content": row["content"],
                "rating": row["rating"],
                "vote_count": row["vote_count"],
                "is_accepted": row["is_accepted"],
                "accepted_at": row["accepted_at"].isoformat() if row["accepted_at"] else None,
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


@router.post("/{answer_id}/vote")
async def vote_answer(
    answer_id: str,
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """投票回答（赞成/反对）"""
    user_uuid = uuid.UUID(current_user_id)
    a_uuid = uuid.UUID(answer_id)
    vote = body.get("vote", 0)

    if vote not in [1, -1]:
        raise HTTPException(status_code=400, detail="投票值必须为 1（赞成）或 -1（反对）")

    # 检查回答是否存在
    answer = await db.fetchrow(
        "SELECT id, user_id, vote_count FROM answers WHERE id = $1",
        a_uuid
    )

    if not answer:
        raise HTTPException(status_code=404, detail="回答不存在")

    # 不能给自己的回答投票
    if answer["user_id"] == user_uuid:
        raise HTTPException(status_code=400, detail="不能给自己的回答投票")

    async with db.transaction():
        # 检查是否已投票
        existing = await db.fetchrow(
            "SELECT vote FROM answer_votes WHERE answer_id = $1 AND user_id = $2",
            a_uuid, user_uuid
        )

        if existing:
            # 更新投票
            old_vote = existing["vote"]
            await db.execute(
                "UPDATE answer_votes SET vote = $1 WHERE answer_id = $2 AND user_id = $3",
                vote, a_uuid, user_uuid
            )
            # 更新回答投票数（差值）
            vote_delta = vote - old_vote
        else:
            # 新投票
            await db.execute(
                """
                INSERT INTO answer_votes (id, answer_id, user_id, vote, created_at)
                VALUES ($1, $2, $3, $4, $5)
                """,
                uuid.uuid4(), a_uuid, user_uuid, vote, utcnow()
            )
            vote_delta = vote

        # 更新回答投票数
        await db.execute(
            "UPDATE answers SET vote_count = vote_count + $1 WHERE id = $2",
            vote_delta, a_uuid
        )

    return {
        "vote": vote,
        "vote_count": answer["vote_count"] + vote_delta,
        "message": "投票已记录",
    }


@router.post("/{answer_id}/accept")
async def accept_answer(
    answer_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """采纳答案（仅问题作者）"""
    user_uuid = uuid.UUID(current_user_id)
    a_uuid = uuid.UUID(answer_id)

    # 获取回答和问题信息
    answer = await db.fetchrow(
        """
        SELECT a.id, a.question_id, a.user_id, a.is_accepted
        FROM answers a WHERE a.id = $1
        """,
        a_uuid
    )

    if not answer:
        raise HTTPException(status_code=404, detail="回答不存在")

    if answer["is_accepted"]:
        raise HTTPException(status_code=400, detail="该回答已被采纳")

    # 获取问题信息
    question = await db.fetchrow(
        """
        SELECT id, user_id, bounty, bounty_status, accepted_answer_id
        FROM questions WHERE id = $1
        """,
        answer["question_id"]
    )

    # 检查是否是问题作者
    if question["user_id"] != user_uuid:
        raise HTTPException(status_code=403, detail="只有问题作者可以采纳答案")

    # 如果已有采纳答案，取消之前的采纳
    if question["accepted_answer_id"]:
        await db.execute(
            "UPDATE answers SET is_accepted = FALSE, accepted_at = NULL WHERE id = $1",
            question["accepted_answer_id"]
        )

    bounty = question["bounty"]
    author_reward = int(bounty * BOUNTY_AUTHOR_RATIO)
    platform_reward = int(bounty * BOUNTY_PLATFORM_RATIO)

    async with db.transaction():
        # 采纳答案
        await db.execute(
            "UPDATE answers SET is_accepted = TRUE, accepted_at = $1 WHERE id = $2",
            utcnow(), a_uuid
        )

        # 更新问题的采纳答案
        await db.execute(
            "UPDATE questions SET accepted_answer_id = $1, bounty_status = 'closed' WHERE id = $2",
            a_uuid, question["id"]
        )

        # 发放悬赏积分
        if bounty > 0:
            # 给回答者发放积分
            answer_user_account = await db.fetchrow(
                "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
                answer["user_id"]
            )
            if answer_user_account:
                new_balance = answer_user_account["balance"] + author_reward
                await db.execute(
                    "UPDATE point_accounts SET balance = $1 WHERE user_id = $2",
                    new_balance, answer["user_id"]
                )
                await db.execute(
                    """
                    INSERT INTO point_transactions (id, user_id, source, amount, balance_after, reference_id, created_at)
                    VALUES ($1, $2, 'qanda', $3, $4, $5, $6)
                    """,
                    uuid.uuid4(), answer["user_id"], author_reward, new_balance, question["id"], utcnow()
                )

            # 平台积分（可忽略或记录）
            # TODO: 平台积分处理

    # 清除余额缓存
    await invalidate_balance_cache(current_user_id)
    await invalidate_balance_cache(str(answer["user_id"]))

    return {
        "answer_id": str(a_uuid),
        "bounty_claimed": bounty,
        "author_reward": author_reward,
        "message": "答案已采纳，悬赏积分已发放",
    }