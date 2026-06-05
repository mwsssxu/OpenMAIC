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
from app.core.time_utils import utcnow

router = APIRouter()


# ==================== Token套餐 ====================

TOKEN_PACKAGES = {
    "starter": {"price": 600, "tokens": 50, "bonus": 0},      # ¥6 = 50 Token
    "learning": {"price": 1800, "tokens": 180, "bonus": 20},   # ¥18 = 200 Token
    "unlimited": {"price": 4800, "tokens": 500, "bonus": 100}, # ¥48 = 600 Token
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
        return {"balance": 0, "updated_at": utcnow().isoformat(), "source": "db"}

    # 缓存余额
    await cache_token_balance(current_user_id, account["balance"])

    return {
        "balance": account["balance"],
        "updated_at": account["updated_at"].isoformat() if account["updated_at"] else None,
        "source": "db"
    }


@router.get("/overview")
async def get_account_overview(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """
    用户账户总览 - 余额实时监控
    合并返回 Token 余额 + 订阅状态 + 今日用量，前端轮询此接口即可
    """
    from app.routes.subscriptions import PLAN_FEATURES, TOKEN_COST_MAP
    from app.middleware.feature_gate import get_user_subscription, get_feature_usage
    user_uuid = uuid.UUID(current_user_id)

    # Token 余额
    cached_balance = await get_cached_token_balance(current_user_id)
    if cached_balance is not None:
        token_balance = cached_balance
    else:
        account = await db.fetchrow(
            "SELECT balance FROM token_accounts WHERE user_id = $1", user_uuid
        )
        if account is None:
            # 新用户创建默认账户（与 /balance 端点行为一致）
            await db.execute(
                "INSERT INTO token_accounts (id, user_id, balance) VALUES ($1, $2, 0)",
                uuid.uuid4(), user_uuid
            )
            token_balance = 0
        else:
            token_balance = account["balance"]
            await cache_token_balance(current_user_id, token_balance)

    # 订阅状态
    subscription = await get_user_subscription(current_user_id, db)
    plan_type = subscription["plan_type"]
    plan_features = PLAN_FEATURES.get(plan_type, PLAN_FEATURES["free"])

    # 今日各功能用量
    usage_today = {}
    for feature_key in ["ai_interaction", "discussion", "course_generation", "buddy_chat"]:
        usage = await get_feature_usage(current_user_id, feature_key, db)
        limit = plan_features.get(feature_key, {}).get("limit", 0)
        usage_today[feature_key] = {
            "used": usage,
            "limit": limit,
            "remaining": -1 if limit == -1 else max(0, limit - usage),
        }

    # 最近5条Token消耗记录
    recent_tx = await db.fetch(
        """
        SELECT amount, description, created_at
        FROM token_transactions
        WHERE user_id = $1 AND amount < 0
        ORDER BY created_at DESC LIMIT 5
        """,
        user_uuid
    )

    return {
        "token_balance": token_balance,
        "subscription": {
            "plan_type": plan_type,
            "status": subscription.get("status", "active"),
            "expires_at": subscription.get("expires_at"),
            "is_pro": plan_type == "pro",
        },
        "usage_today": usage_today,
        "recent_spends": [
            {
                "amount": abs(tx["amount"]),
                "description": tx["description"],
                "time": tx["created_at"].isoformat() if tx["created_at"] else None,
            }
            for tx in recent_tx
        ],
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
            new_point_balance, utcnow(), user_uuid
        )

        # 更新Token账户
        new_token_balance = token_balance + tokens
        await db.execute(
            "UPDATE token_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
            new_token_balance, utcnow(), user_uuid
        )

        # 记录积分流水
        await db.execute(
            """
            INSERT INTO point_transactions (id, user_id, source, amount, balance_after, created_at)
            VALUES ($1, $2, 'exchange', $3, $4, $5)
            """,
            uuid.uuid4(), user_uuid, -points, new_point_balance, utcnow()
        )

        # 记录Token流水
        await db.execute(
            """
            INSERT INTO token_transactions (id, user_id, type, amount, balance_after, description, created_at)
            VALUES ($1, $2, 'exchange', $3, $4, $5, $6)
            """,
            uuid.uuid4(), user_uuid, tokens, new_token_balance,
            f"积分兑换（{tier}档位）：{points}积分 → {tokens}Token", utcnow()
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
            new_balance, utcnow(), user_uuid
        )

        # 记录流水
        await db.execute(
            """
            INSERT INTO token_transactions (id, user_id, type, amount, balance_after, description, reference_id, created_at)
            VALUES ($1, $2, 'spend', $3, $4, $5, $6, $7)
            """,
            uuid.uuid4(), user_uuid, -amount, new_balance, description,
            uuid.UUID(reference_id) if reference_id else None, utcnow()
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
            new_balance, utcnow(), user_uuid
        )

        # 记录流水
        await db.execute(
            """
            INSERT INTO token_transactions (id, user_id, type, amount, balance_after, description, created_at)
            VALUES ($1, $2, 'reward', $3, $4, $5, $6)
            """,
            uuid.uuid4(), user_uuid, amount, new_balance, description, utcnow()
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
        payment_method, utcnow()
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
        new_balance, utcnow(), user_uuid
    )

    # 记录流水
    await db.execute(
        """
        INSERT INTO token_transactions (id, user_id, type, amount, balance_after, description, created_at)
        VALUES ($1, $2, 'reward', $3, $4, $5, $6)
        """,
        uuid.uuid4(), user_uuid, amount, new_balance, description, utcnow()
    )

    return new_balance


# ==================== Token 消耗引擎 ====================

async def spend_tokens_internal(
    db: asyncpg.Connection,
    user_uuid: uuid.UUID,
    amount: int,
    description: str,
    reference_id: str = None
) -> int:
    """
    内部函数：消费Token（事务内，调用者需在事务内）
    返回消费后的余额，余额不足时抛出 HTTPException
    """
    import math
    amount = math.ceil(amount)  # 向上取整（处理0.5等小数）

    if amount <= 0:
        return 0

    token_account = await db.fetchrow(
        "SELECT balance FROM token_accounts WHERE user_id = $1 FOR UPDATE",
        user_uuid
    )
    if token_account is None or token_account["balance"] < amount:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Token余额不足")

    new_balance = token_account["balance"] - amount
    await db.execute(
        "UPDATE token_accounts SET balance = $1, updated_at = $2 WHERE user_id = $3",
        new_balance, utcnow(), user_uuid
    )

    # 记录流水
    ref_uuid = uuid.UUID(reference_id) if reference_id else None
    await db.execute(
        """
        INSERT INTO token_transactions (id, user_id, type, amount, balance_after, description, reference_id, created_at)
        VALUES ($1, $2, 'spend', $3, $4, $5, $6, $7)
        """,
        uuid.uuid4(), user_uuid, -amount, new_balance, description, ref_uuid, utcnow()
    )

    return new_balance


async def deduct_tokens_for_action(
    db: asyncpg.Connection,
    user_id: str,
    action: str,
    description: str = "",
    reference_id: str = None,
    extra_cost: int = 0
) -> dict:
    """
    按操作类型扣减 Token

    逻辑：
    1. 查用户订阅状态
    2. 如果 Pro 用户且该操作在免费额度内 → 不扣 Token
    3. 如果 Free 用户且在每日免费额度内 → 不扣 Token，但增加使用计数
    4. 超出免费额度 → 扣减 Token

    Args:
        db: 数据库连接
        user_id: 用户ID（字符串）
        action: 操作类型（对应 TOKEN_COST_MAP 的 key）
        description: 描述
        reference_id: 关联ID
        extra_cost: 额外Token消耗（如课程场景数）

    Returns:
        {"deducted": bool, "amount": int, "balance_after": int, "free_quota_used": bool}
    """
    from app.routes.subscriptions import TOKEN_COST_MAP, PLAN_FEATURES
    from app.middleware.feature_gate import get_user_subscription, get_feature_usage, increment_feature_usage
    import math

    user_uuid = uuid.UUID(user_id)

    # 获取订阅状态
    subscription = await get_user_subscription(user_id, db)
    plan_type = subscription["plan_type"]
    features = PLAN_FEATURES.get(plan_type, PLAN_FEATURES["free"])

    # 获取操作对应的 Token 成本
    base_cost = TOKEN_COST_MAP.get(action, 0)
    total_cost = base_cost + extra_cost

    # 判断该操作是否在免费额度内
    # 不同操作对应不同的 feature key
    feature_map = {
        "ai_interaction": "ai_interaction",
        "discussion_2agent": "discussion",
        "discussion_3agent": "discussion",
        "course_generation_base": "course_generation",
        "buddy_deep_chat": "buddy_chat",
    }
    feature_key = feature_map.get(action)

    if feature_key:
        feature_config = features.get(feature_key, {})
        limit = feature_config.get("limit", 0)

        if limit == -1:
            # Pro 无限额度 → 不扣 Token
            await increment_feature_usage(user_id, feature_key, db)
            return {"deducted": False, "amount": 0, "balance_after": -1, "free_quota_used": True}

        # 检查今日使用次数
        usage = await get_feature_usage(user_id, feature_key, db)
        if usage < limit:
            # 还在免费额度内 → 不扣 Token
            await increment_feature_usage(user_id, feature_key, db)
            return {"deducted": False, "amount": 0, "balance_after": -1, "free_quota_used": True}

    # 超出免费额度 → 扣减 Token
    if total_cost <= 0:
        return {"deducted": False, "amount": 0, "balance_after": -1, "free_quota_used": False}

    async with db.transaction():
        new_balance = await spend_tokens_internal(
            db, user_uuid, total_cost,
            description or f"Token消费：{action}",
            reference_id
        )

    # 清除余额缓存
    await invalidate_balance_cache(user_id)

    # 增加使用计数
    if feature_key:
        await increment_feature_usage(user_id, feature_key, db)

    return {"deducted": True, "amount": math.ceil(total_cost), "balance_after": new_balance, "free_quota_used": False}