"""
Token路由 - Token账户管理、购买、兑换、消费记录
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.core.redis import (
    get_cached_token_balance, cache_token_balance, invalidate_balance_cache
)
import asyncpg
import uuid
from datetime import datetime

router = APIRouter()


# ==================== Token套餐 ====================

TOKEN_PACKAGES = {
    "basic": {"price": 1000, "tokens": 100, "bonus": 0},  # ￥10 = 100 Token
    "standard": {"price": 5000, "tokens": 500, "bonus": 100},  # ￥50 = 600 Token
    "premium": {"price": 10000, "tokens": 1000, "bonus": 500},  # ￥100 = 1500 Token
}


# ==================== 积分兑换档位 ====================

TOKEN_EXCHANGE_RATES = {
    "small": {"points": 50, "tokens": 10},      # 50积分 → 10Token
    "standard": {"points": 100, "tokens": 25},  # 100积分 → 25Token (效率提升150%)
    "large": {"points": 200, "tokens": 60},     # 200积分 → 60Token (效率提升200%)
}


# ==================== API端点 ====================

@router.get("/balance")
async def get_token_balance(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取Token余额 - 优先从 Redis 缓存读取"""
    user_uuid = uuid.UUID(current_user_id)

    # 尝试从 Redis 缓存获取
    cached_balance = await get_cached_token_balance(current_user_id)
    if cached_balance is not None:
        return {"balance": cached_balance, "source": "cache"}

    account = await db.fetchrow(
        "SELECT balance, updated_at FROM token_accounts WHERE user_id = $1",
        user_uuid
    )

    if account is None:
        # 创建默认账户
        await db.execute(
            "INSERT INTO token_accounts (id, user_id, balance) VALUES ($1, $2, 0)",
            uuid.uuid4(), user_uuid
        )
        return {"balance": 0, "updated_at": datetime.utcnow().isoformat(), "source": "db"}

    # 缓存余额
    await cache_token_balance(current_user_id, account["balance"])

    return {
        "balance": account["balance"],
        "updated_at": account["updated_at"].isoformat() if account["updated_at"] else None,
        "source": "db"
    }


@router.get("/transactions")
async def get_token_transactions(
    page: int = 1,
    limit: int = 20,
    type: str = None,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取Token交易流水"""
    user_uuid = uuid.UUID(current_user_id)
    offset = (page - 1) * limit

    # 构建查询
    if type:
        rows = await db.fetch(
            """
            SELECT id, type, amount, balance_after, description, reference_id, created_at
            FROM token_transactions
            WHERE user_id = $1 AND type = $2
            ORDER BY created_at DESC
            LIMIT $3 OFFSET $4
            """,
            user_uuid, type, limit, offset
        )
        total = await db.fetchval(
            "SELECT COUNT(*) FROM token_transactions WHERE user_id = $1 AND type = $2",
            user_uuid, type
        )
    else:
        rows = await db.fetch(
            """
            SELECT id, type, amount, balance_after, description, reference_id, created_at
            FROM token_transactions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            """,
            user_uuid, limit, offset
        )
        total = await db.fetchval(
            "SELECT COUNT(*) FROM token_transactions WHERE user_id = $1",
            user_uuid
        )

    return {
        "items": [
            {
                "id": str(row["id"]),
                "type": row["type"],
                "amount": row["amount"],
                "balance_after": row["balance_after"],
                "description": row["description"],
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


@router.get("/exchange-rates")
async def get_exchange_rates():
    """获取积分兑换 Token 档位列表"""
    return {
        "tiers": [
            {
                "tier": id_,
                "points": data["points"],
                "tokens": data["tokens"],
                "efficiency": round(data["tokens"] / data["points"], 2),  # 效率比
            }
            for id_, data in TOKEN_EXCHANGE_RATES.items()
        ],
        "message": "兑换效率：档位越大，Token 获得越多"
    }


@router.post("/exchange")
async def exchange_points_to_tokens(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """积分兑换Token（按档位兑换）"""
    user_uuid = uuid.UUID(current_user_id)
    tier = body.get("tier", "standard")

    # 验证档位
    if tier not in TOKEN_EXCHANGE_RATES:
        raise HTTPException(status_code=400, detail="无效兑换档位，可选：small, standard, large")

    points = TOKEN_EXCHANGE_RATES[tier]["points"]
    tokens = TOKEN_EXCHANGE_RATES[tier]["tokens"]

    # 使用事务确保原子性
    async with db.transaction():
        # 使用 FOR UPDATE 锁定行防止并发
        point_account = await db.fetchrow(
            "SELECT balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
            user_uuid
        )
        if point_account is None or point_account["balance"] < points:
            raise HTTPException(status_code=400, detail="积分余额不足")

        # 获取Token账户并锁定
        token_account = await db.fetchrow(
            "SELECT balance FROM token_accounts WHERE user_id = $1 FOR UPDATE",
            user_uuid
        )
        if token_account is None:
            await db.execute(
                "INSERT INTO token_accounts (id, user_id, balance) VALUES ($1, $2, 0)",
                uuid.uuid4(), user_uuid
            )
            token_balance = 0
        else:
            token_balance = token_account["balance"]

        # 更新积分账户
        new_point_balance = point_account["balance"] - points
        await db.execute(
            "UPDATE point_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
            new_point_balance, datetime.utcnow(), user_uuid
        )

        # 更新Token账户
        new_token_balance = token_balance + tokens
        await db.execute(
            "UPDATE token_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
            new_token_balance, datetime.utcnow(), user_uuid
        )

        # 记录积分流水
        await db.execute(
            """
            INSERT INTO point_transactions (id, user_id, source, amount, balance_after, created_at)
            VALUES ($1, $2, 'exchange', $3, $4, $5)
            """,
            uuid.uuid4(), user_uuid, -points, new_point_balance, datetime.utcnow()
        )

        # 记录Token流水
        await db.execute(
            """
            INSERT INTO token_transactions (id, user_id, type, amount, balance_after, description, created_at)
            VALUES ($1, $2, 'exchange', $3, $4, $5, $6)
            """,
            uuid.uuid4(), user_uuid, tokens, new_token_balance,
            f"积分兑换（{tier}档位）：{points}积分 → {tokens}Token", datetime.utcnow()
        )

    # 清除余额缓存
    await invalidate_balance_cache(current_user_id)

    return {
        "tier": tier,
        "points_used": points,
        "tokens_gained": tokens,
        "point_balance": new_point_balance,
        "token_balance": new_token_balance,
        "efficiency": round(tokens / points, 2),
    }


@router.post("/spend")
async def spend_tokens(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """消费Token（内部API，用于课程生成等）- 使用事务隔离"""
    user_uuid = uuid.UUID(current_user_id)
    amount = body.get("amount", 0)
    description = body.get("description", "")
    reference_id = body.get("reference_id")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="消费数量必须大于0")

    new_balance = 0

    # 使用事务确保原子性
    async with db.transaction():
        # 使用 FOR UPDATE 锁定行
        token_account = await db.fetchrow(
            "SELECT balance FROM token_accounts WHERE user_id = $1 FOR UPDATE",
            user_uuid
        )
        if token_account is None or token_account["balance"] < amount:
            raise HTTPException(status_code=400, detail="Token余额不足")

        # 更新账户
        new_balance = token_account["balance"] - amount
        await db.execute(
            "UPDATE token_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
            new_balance, datetime.utcnow(), user_uuid
        )

        # 记录流水
        await db.execute(
            """
            INSERT INTO token_transactions (id, user_id, type, amount, balance_after, description, reference_id, created_at)
            VALUES ($1, $2, 'spend', $3, $4, $5, $6, $7)
            """,
            uuid.uuid4(), user_uuid, -amount, new_balance, description,
            uuid.UUID(reference_id) if reference_id else None, datetime.utcnow()
        )

    # 清除余额缓存
    await invalidate_balance_cache(current_user_id)

    return {
        "amount_spent": amount,
        "balance_after": new_balance,
    }


@router.post("/reward")
async def reward_tokens(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """奖励Token（新用户礼包、邀请奖励等）- 使用事务隔离"""
    user_uuid = uuid.UUID(current_user_id)
    amount = body.get("amount", 0)
    description = body.get("description", "")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="奖励数量必须大于0")

    new_balance = 0

    # 使用事务确保原子性
    async with db.transaction():
        # 获取账户并锁定
        token_account = await db.fetchrow(
            "SELECT balance FROM token_accounts WHERE user_id = $1 FOR UPDATE",
            user_uuid
        )
        if token_account is None:
            await db.execute(
                "INSERT INTO token_accounts (id, user_id, balance) VALUES ($1, $2, 0)",
                uuid.uuid4(), user_uuid
            )
            current_balance = 0
        else:
            current_balance = token_account["balance"]

        # 更新账户
        new_balance = current_balance + amount
        await db.execute(
            "UPDATE token_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
            new_balance, datetime.utcnow(), user_uuid
        )

        # 记录流水
        await db.execute(
            """
            INSERT INTO token_transactions (id, user_id, type, amount, balance_after, description, created_at)
            VALUES ($1, $2, 'reward', $3, $4, $5, $6)
            """,
            uuid.uuid4(), user_uuid, amount, new_balance, description, datetime.utcnow()
        )

    # 清除余额缓存
    await invalidate_balance_cache(current_user_id)

    return {
        "amount_rewarded": amount,
        "balance_after": new_balance,
    }


@router.get("/packages")
async def get_token_packages():
    """获取Token购买套餐列表"""
    return [
        {
            "id": id_,
            "price": data["price"] / 100,  # 转换为元
            "tokens": data["tokens"],
            "bonus": data["bonus"],
            "total_tokens": data["tokens"] + data["bonus"],
        }
        for id_, data in TOKEN_PACKAGES.items()
    ]


@router.post("/purchase")
async def create_purchase_order(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """创建Token购买订单"""
    user_uuid = uuid.UUID(current_user_id)
    package_id = body.get("package", "basic")
    payment_method = body.get("payment_method", "wechat")

    if package_id not in TOKEN_PACKAGES:
        raise HTTPException(status_code=400, detail="无效的套餐")

    package = TOKEN_PACKAGES[package_id]

    # 创建订单
    order_id = uuid.uuid4()
    await db.execute(
        """
        INSERT INTO orders (id, user_id, amount, token_amount, payment_method, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'created', $6)
        """,
        order_id, user_uuid, package["price"], package["tokens"] + package["bonus"],
        payment_method, datetime.utcnow()
    )

    # TODO: 调用支付API获取支付参数
    # 微信支付/支付宝

    return {
        "order_id": str(order_id),
        "amount": package["price"] / 100,
        "token_amount": package["tokens"] + package["bonus"],
        "payment_method": payment_method,
        "status": "created",
        # 微信支付参数需要实际调用API获取
        "wechat_params": None,
        "alipay_url": None,
    }


# ==================== 内部函数 ====================

async def reward_tokens_internal(db: asyncpg.Connection, user_uuid: uuid.UUID, amount: int, description: str):
    """内部函数：奖励Token（使用事务隔离，调用者需要在事务内）"""
    # 获取账户并锁定
    token_account = await db.fetchrow(
        "SELECT balance FROM token_accounts WHERE user_id = $1 FOR UPDATE",
        user_uuid
    )
    if token_account is None:
        await db.execute(
            "INSERT INTO token_accounts (id, user_id, balance) VALUES ($1, $2, 0)",
            uuid.uuid4(), user_uuid
        )
        current_balance = 0
    else:
        current_balance = token_account["balance"]

    # 更新账户
    new_balance = current_balance + amount
    await db.execute(
        "UPDATE token_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
        new_balance, datetime.utcnow(), user_uuid
    )

    # 记录流水
    await db.execute(
        """
        INSERT INTO token_transactions (id, user_id, type, amount, balance_after, description, created_at)
        VALUES ($1, $2, 'reward', $3, $4, $5, $6)
        """,
        uuid.uuid4(), user_uuid, amount, new_balance, description, datetime.utcnow()
    )

    return new_balance