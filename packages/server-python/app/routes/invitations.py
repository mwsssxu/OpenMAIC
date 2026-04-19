"""
邀请系统路由 - 邀请码生成、邀请奖励发放
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.core.redis import invalidate_balance_cache
import asyncpg
import uuid
from datetime import datetime
from app.core.time_utils import utcnow
import random
import string

router = APIRouter()

# ==================== 邀请奖励配置 ====================

# 一级邀请：邀请人获得
LEVEL1_INVITER_POINTS = 20
LEVEL1_INVITER_TOKENS = 50
LEVEL1_INVITEE_TOKENS = 100  # 被邀请人获得

# 二级邀请
LEVEL2_INVITER_POINTS = 10

# 三级邀请
LEVEL3_INVITER_POINTS = 5

MAX_INVITE_LEVEL = 3


# ==================== 辅助函数 ====================

def generate_invite_code() -> str:
    """生成6位邀请码"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


async def get_or_create_invite_code(db: asyncpg.Connection, user_uuid: uuid.UUID) -> str:
    """获取或创建用户邀请码"""
    existing = await db.fetchrow(
        "SELECT invite_code FROM user_invitation_codes WHERE user_id = $1",
        user_uuid
    )

    if existing:
        return existing["invite_code"]

    # 生成唯一邀请码
    code = generate_invite_code()
    while await db.fetchval("SELECT 1 FROM user_invitation_codes WHERE invite_code = $1", code):
        code = generate_invite_code()

    await db.execute(
        """
        INSERT INTO user_invitation_codes (id, user_id, invite_code, created_at)
        VALUES ($1, $2, $3, $4)
        """,
        uuid.uuid4(), user_uuid, code, utcnow()
    )

    return code


# ==================== API 端点 ====================

@router.get("/my-code")
async def get_my_invite_code(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取我的邀请码"""
    user_uuid = uuid.UUID(current_user_id)

    code = await get_or_create_invite_code(db, user_uuid)

    # 获取邀请统计
    stats = await db.fetchrow(
        """
        SELECT COUNT(*) as total_invites,
               COALESCE(SUM(reward_points), 0) as total_points,
               COALESCE(SUM(reward_tokens), 0) as total_tokens
        FROM user_invitations WHERE inviter_id = $1
        """,
        user_uuid
    )

    return {
        "invite_code": code,
        "invite_url": f"/register?invite={code}",
        "total_invites": stats["total_invites"] or 0,
        "total_points_earned": stats["total_points"] or 0,
        "total_tokens_earned": stats["total_tokens"] or 0,
    }


@router.get("/stats")
async def get_invite_stats(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取邀请统计详情"""
    user_uuid = uuid.UUID(current_user_id)

    # 各层级邀请统计
    level_stats = await db.fetch(
        """
        SELECT level, COUNT(*) as count, COALESCE(SUM(reward_points), 0) as points, COALESCE(SUM(reward_tokens), 0) as tokens
        FROM user_invitations WHERE inviter_id = $1
        GROUP BY level ORDER BY level
        """,
        user_uuid
    )

    # 最近邀请的用户
    recent = await db.fetch(
        """
        SELECT ui.level, ui.reward_points, ui.reward_tokens, ui.created_at,
               u.nickname
        FROM user_invitations ui
        JOIN users u ON ui.invitee_id = u.id
        WHERE ui.inviter_id = $1
        ORDER BY ui.created_at DESC
        LIMIT 10
        """,
        user_uuid
    )

    return {
        "level_stats": [
            {
                "level": row["level"],
                "count": row["count"],
                "points_earned": row["points"],
                "tokens_earned": row["tokens"],
            }
            for row in level_stats
        ],
        "recent_invites": [
            {
                "nickname": row["nickname"],
                "level": row["level"],
                "points": row["reward_points"],
                "tokens": row["reward_tokens"],
                "invited_at": row["created_at"].isoformat(),
            }
            for row in recent
        ],
    }


@router.post("/apply")
async def apply_invite_code(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """应用邀请码（注册时调用）"""
    user_uuid = uuid.UUID(current_user_id)
    invite_code = body.get("invite_code", "").upper()

    if not invite_code or len(invite_code) != 6:
        raise HTTPException(status_code=400, detail="无效的邀请码")

    # 检查是否已被邀请
    existing = await db.fetchrow(
        "SELECT id FROM user_invitations WHERE invitee_id = $1",
        user_uuid
    )
    if existing:
        raise HTTPException(status_code=400, detail="已使用过邀请码")

    # 查找邀请码对应的用户
    inviter_code = await db.fetchrow(
        "SELECT user_id, invite_code FROM user_invitation_codes WHERE invite_code = $1",
        invite_code
    )

    if not inviter_code:
        raise HTTPException(status_code=404, detail="邀请码不存在")

    inviter_id = inviter_code["user_id"]

    # 不能邀请自己
    if inviter_id == user_uuid:
        raise HTTPException(status_code=400, detail="不能使用自己的邀请码")

    async with db.transaction():
        # 为邀请人创建邀请码（如果不存在）
        await get_or_create_invite_code(db, inviter_id)

        # 记录一级邀请
        await db.execute(
            """
            INSERT INTO user_invitations (id, inviter_id, invitee_id, level, reward_points, reward_tokens, rewarded_at, created_at)
            VALUES ($1, $2, $3, 1, $4, $5, $6, $7)
            """,
            uuid.uuid4(), inviter_id, user_uuid,
            LEVEL1_INVITER_POINTS, LEVEL1_INVITER_TOKENS, utcnow(), utcnow()
        )

        # 给邀请人发放奖励
        await reward_user(db, inviter_id, LEVEL1_INVITER_POINTS, LEVEL1_INVITER_TOKENS, "一级邀请奖励")

        # 给被邀请人发放奖励
        await reward_user(db, user_uuid, 0, LEVEL1_INVITEE_TOKENS, "受邀注册奖励")

        # 处理二级、三级邀请
        await process_multi_level_invitation(db, inviter_id, user_uuid)

    # 清除余额缓存
    await invalidate_balance_cache(current_user_id)
    await invalidate_balance_cache(str(inviter_id))

    return {
        "inviter_id": str(inviter_id),
        "your_tokens": LEVEL1_INVITEE_TOKENS,
        "message": "邀请码已应用，奖励已发放",
    }


async def reward_user(db: asyncpg.Connection, user_uuid: uuid.UUID, points: int, tokens: int, description: str):
    """发放积分和 Token 奖励"""
    if points > 0:
        account = await db.fetchrow(
            "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
            user_uuid
        )
        if account:
            new_balance = account["balance"] + points
            await db.execute(
                "UPDATE point_accounts SET balance = $1 WHERE user_id = $2",
                new_balance, user_uuid
            )
            await db.execute(
                """
                INSERT INTO point_transactions (id, user_id, source, amount, balance_after, created_at)
                VALUES ($1, $2, 'invitation', $3, $4, $5)
                """,
                uuid.uuid4(), user_uuid, points, new_balance, utcnow()
            )
        else:
            await db.execute(
                "INSERT INTO point_accounts (id, user_id, balance) VALUES ($1, $2, $3)",
                uuid.uuid4(), user_uuid, points
            )

    if tokens > 0:
        from app.routes.tokens import reward_tokens_internal
        await reward_tokens_internal(db, user_uuid, tokens, description)


async def process_multi_level_invitation(db: asyncpg.Connection, inviter_id: uuid.UUID, new_invitee_id: uuid.UUID):
    """处理多级邀请"""
    # 查找邀请人的邀请人（二级）
    level1_invitation = await db.fetchrow(
        "SELECT inviter_id FROM user_invitations WHERE invitee_id = $1 AND level = 1",
        inviter_id
    )

    if level1_invitation:
        level2_inviter = level1_invitation["inviter_id"]

        # 记录二级邀请
        await db.execute(
            """
            INSERT INTO user_invitations (id, inviter_id, invitee_id, level, reward_points, rewarded_at, created_at)
            VALUES ($1, $2, $3, 2, $4, $5, $6)
            """,
            uuid.uuid4(), level2_inviter, new_invitee_id,
            LEVEL2_INVITER_POINTS, utcnow(), utcnow()
        )

        # 给二级邀请人发放奖励
        await reward_user(db, level2_inviter, LEVEL2_INVITER_POINTS, 0, "二级邀请奖励")
        await invalidate_balance_cache(str(level2_inviter))

        # 查找三级邀请人
        level2_invitation = await db.fetchrow(
            "SELECT inviter_id FROM user_invitations WHERE invitee_id = $1 AND level = 1",
            level2_inviter
        )

        if level2_invitation:
            level3_inviter = level2_invitation["inviter_id"]

            # 记录三级邀请
            await db.execute(
                """
                INSERT INTO user_invitations (id, inviter_id, invitee_id, level, reward_points, rewarded_at, created_at)
                VALUES ($1, $2, $3, 3, $4, $5, $6)
                """,
                uuid.uuid4(), level3_inviter, new_invitee_id,
                LEVEL3_INVITER_POINTS, utcnow(), utcnow()
            )

            # 给三级邀请人发放奖励
            await reward_user(db, level3_inviter, LEVEL3_INVITER_POINTS, 0, "三级邀请奖励")
            await invalidate_balance_cache(str(level3_inviter))