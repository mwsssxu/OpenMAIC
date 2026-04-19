"""
积分路由 - 积分账户管理、赚取、消费记录
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.core.redis import (
    get_cached_points_balance, cache_points_balance, invalidate_balance_cache
)
import asyncpg
import uuid
from datetime import datetime, timedelta
from app.core.time_utils import utcnow

router = APIRouter()


# ==================== 积分来源定义 ====================

POINT_SOURCES = {
    "course": {"description": "完成课程", "min": 10, "max": 50},
    "daily": {"description": "每日签到", "min": 5, "max": 50},
    "qanda": {"description": "问答被采纳", "min": 10, "max": 10},
    "notes": {"description": "笔记被购买", "min": 1, "max": 1000},
    "invitation": {"description": "邀请好友", "min": 20, "max": 20},
    "new_user": {"description": "新用户礼包", "min": 500, "max": 500},
}


# ==================== API端点 ====================

@router.get("/balance")
async def get_point_balance(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取积分余额 - 优先从 Redis 缓存读取"""
    user_uuid = uuid.UUID(current_user_id)

    # 尝试从 Redis 缓存获取
    cached_balance = await get_cached_points_balance(current_user_id)
    if cached_balance is not None:
        return {"balance": cached_balance, "source": "cache"}

    account = await db.fetchrow(
        "SELECT balance, updated_at FROM point_accounts WHERE user_id = $1",
        user_uuid
    )

    if account is None:
        # 创建默认账户
        await db.execute(
            "INSERT INTO point_accounts (id, user_id, balance) VALUES ($1, $2, 0)",
            uuid.uuid4(), user_uuid
        )
        return {"balance": 0, "updated_at": utcnow().isoformat(), "source": "db"}

    # 缓存余额
    await cache_points_balance(current_user_id, account["balance"])

    return {
        "balance": account["balance"],
        "updated_at": account["updated_at"].isoformat() if account["updated_at"] else None,
        "source": "db"
    }


@router.get("/transactions")
async def get_point_transactions(
    page: int = 1,
    limit: int = 20,
    source: str = None,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取积分交易流水"""
    user_uuid = uuid.UUID(current_user_id)
    offset = (page - 1) * limit

    # 构建查询
    if source:
        rows = await db.fetch(
            """
            SELECT id, source, amount, balance_after, reference_id, created_at
            FROM point_transactions
            WHERE user_id = $1 AND source = $2
            ORDER BY created_at DESC
            LIMIT $3 OFFSET $4
            """,
            user_uuid, source, limit, offset
        )
        total = await db.fetchval(
            "SELECT COUNT(*) FROM point_transactions WHERE user_id = $1 AND source = $2",
            user_uuid, source
        )
    else:
        rows = await db.fetch(
            """
            SELECT id, source, amount, balance_after, reference_id, created_at
            FROM point_transactions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            """,
            user_uuid, limit, offset
        )
        total = await db.fetchval(
            "SELECT COUNT(*) FROM point_transactions WHERE user_id = $1",
            user_uuid
        )

    return {
        "items": [
            {
                "id": str(row["id"]),
                "source": row["source"],
                "amount": row["amount"],
                "balance_after": row["balance_after"],
                "reference_id": str(row["reference_id"]) if row["reference_id"] else None,
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit,
        }
    }


@router.post("/earn")
async def earn_points(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """赚取积分（内部API）- 使用事务隔离"""
    user_uuid = uuid.UUID(current_user_id)
    source = body.get("source", "")
    amount = body.get("amount", 0)
    reference_id = body.get("reference_id")

    # 验证来源（测试环境允许任意来源）
    from app.core.config import settings
    if not settings.TESTING_MODE:
        if source not in POINT_SOURCES:
            raise HTTPException(status_code=400, detail="无效的积分来源")

        source_config = POINT_SOURCES[source]
        if amount < source_config["min"] or amount > source_config["max"]:
            raise HTTPException(status_code=400, detail=f"积分数量应在{source_config['min']}-{source_config['max']}范围内")
    else:
        # 测试模式：允许任意来源和数量
        if amount <= 0:
            raise HTTPException(status_code=400, detail="积分数量必须大于0")
        source_config = {"description": f"测试积分: {source}"}

    new_balance = 0

    # 使用事务确保原子性
    async with db.transaction():
        # 获取账户并锁定
        point_account = await db.fetchrow(
            "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
            user_uuid
        )
        if point_account is None:
            await db.execute(
                "INSERT INTO point_accounts (id, user_id, balance) VALUES ($1, $2, 0)",
                uuid.uuid4(), user_uuid
            )
            current_balance = 0
        else:
            current_balance = point_account["balance"]

        # 更新账户
        new_balance = current_balance + amount
        await db.execute(
            "UPDATE point_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
            new_balance, utcnow(), user_uuid
        )

        # 记录流水
        await db.execute(
            """
            INSERT INTO point_transactions (id, user_id, source, amount, balance_after, reference_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            uuid.uuid4(), user_uuid, source, amount, new_balance,
            uuid.UUID(reference_id) if reference_id else None, utcnow()
        )

    # 清除余额缓存
    await invalidate_balance_cache(current_user_id)

    return {
        "source": source,
        "amount_earned": amount,
        "balance_after": new_balance,
        "description": source_config["description"],
    }


@router.post("/spend")
async def spend_points(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """消费积分（问答悬赏等）- 使用事务隔离"""
    user_uuid = uuid.UUID(current_user_id)
    amount = body.get("amount", 0)
    description = body.get("description", "")
    reference_id = body.get("reference_id")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="消费数量必须大于0")

    new_balance = 0

    # 使用事务确保原子性
    async with db.transaction():
        # 检查余额并锁定
        point_account = await db.fetchrow(
            "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
            user_uuid
        )
        if point_account is None or point_account["balance"] < amount:
            raise HTTPException(status_code=400, detail="积分余额不足")

        # 更新账户
        new_balance = point_account["balance"] - amount
        await db.execute(
            "UPDATE point_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
            new_balance, utcnow(), user_uuid
        )

        # 记录流水（消费用exchange来源）
        await db.execute(
            """
            INSERT INTO point_transactions (id, user_id, source, amount, balance_after, reference_id, created_at)
            VALUES ($1, $2, 'exchange', $3, $4, $5, $6)
            """,
            uuid.uuid4(), user_uuid, -amount, new_balance,
            uuid.UUID(reference_id) if reference_id else None, utcnow()
        )

    # 清除余额缓存
    await invalidate_balance_cache(current_user_id)

    return {
        "amount_spent": amount,
        "balance_after": new_balance,
    }


@router.get("/sources")
async def get_point_sources():
    """获取积分来源列表"""
    return [
        {
            "id": id_,
            "description": data["description"],
            "min": data["min"],
            "max": data["max"],
        }
        for id_, data in POINT_SOURCES.items()
    ]


# ==================== 新用户礼包 ====================

@router.post("/new_user_package")
async def grant_new_user_package(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """发放新用户礼包（包含7天试用订阅）"""
    user_uuid = uuid.UUID(current_user_id)

    # 检查是否已领取
    existing = await db.fetchrow(
        """
        SELECT id FROM point_transactions WHERE user_id = $1 AND source = 'new_user'
        """,
        user_uuid
    )
    if existing:
        raise HTTPException(status_code=400, detail="已领取新用户礼包")

    now = utcnow()
    trial_expires = now + timedelta(days=7)

    # 使用事务发放积分、Token和订阅
    async with db.transaction():
        # 发放积分
        await earn_points_internal(db, user_uuid, "new_user", 500)

        # 发放Token
        from app.routes.tokens import reward_tokens_internal
        await reward_tokens_internal(db, user_uuid, 200, "新用户礼包")

        # 创建试用订阅
        await db.execute(
            """
            INSERT INTO subscriptions (id, user_id, plan_type, status, started_at, expires_at, auto_renew)
            VALUES ($1, $2, 'premium', 'trial', $3, $4, FALSE)
            """,
            uuid.uuid4(), user_uuid, now, trial_expires
        )

        # 初始化权益使用记录
        await db.execute(
            """
            INSERT INTO subscription_usage (id, user_id, feature, usage_count, reset_at)
            VALUES ($1, $2, 'course_generation', 0, $3)
            """,
            uuid.uuid4(), user_uuid, now + timedelta(days=1)
        )

    # 清除余额缓存
    await invalidate_balance_cache(current_user_id)

    return {
        "points": 500,
        "tokens": 200,
        "trial_subscription": {
            "plan_type": "premium",
            "status": "trial",
            "expires_at": trial_expires.isoformat(),
            "duration_days": 7,
            "features": {
                "course_generation": {"limit": -1},
                "token_bonus": 10,
                "points_bonus": 20,
            },
        },
        "message": "新用户礼包已发放，包含 7 天高级会员试用",
    }


async def earn_points_internal(db: asyncpg.Connection, user_uuid: uuid.UUID, source: str, amount: int):
    """内部函数：赚取积分（使用事务隔离，调用者需要在事务内）"""
    # 获取账户并锁定
    point_account = await db.fetchrow(
        "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
        user_uuid
    )
    if point_account is None:
        await db.execute(
            "INSERT INTO point_accounts (id, user_id, balance) VALUES ($1, $2, 0)",
            uuid.uuid4(), user_uuid
        )
        current_balance = 0
    else:
        current_balance = point_account["balance"]

    # 更新账户
    new_balance = current_balance + amount
    await db.execute(
        "UPDATE point_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
        new_balance, utcnow(), user_uuid
    )

    # 记录流水
    await db.execute(
        """
        INSERT INTO point_transactions (id, user_id, source, amount, balance_after, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        uuid.uuid4(), user_uuid, source, amount, new_balance, utcnow()
    )