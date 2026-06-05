"""
支付路由 - 微信支付、支付宝集成

注意：实际支付需要配置真实的商户密钥
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.core.redis import invalidate_balance_cache
from app.core.config import settings
import asyncpg
import uuid
from datetime import datetime, timezone, timedelta
from app.core.time_utils import utcnow
import hashlib
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# ==================== Token套餐配置 ====================

TOKEN_PACKAGES = {
    "starter": {"price": 600, "tokens": 50, "bonus": 0, "name": "体验包"},      # ¥6 = 50 Token
    "learning": {"price": 1800, "tokens": 180, "bonus": 20, "name": "学习包"},   # ¥18 = 200 Token
    "unlimited": {"price": 4800, "tokens": 500, "bonus": 100, "name": "畅学包"}, # ¥48 = 600 Token
}

# 订阅套餐配置（与 subscriptions.py PLAN_PRICES 保持一致）
SUBSCRIPTION_PACKAGES = {
    "pro_monthly": {"price": 1900, "days": 30, "name": "Pro 月卡"},       # ¥19/月
    "pro_yearly": {"price": 19000, "days": 365, "name": "Pro 年卡"},      # ¥190/年
}

# 新用户首购折扣
NEW_USER_DISCOUNT = 0.5  # 50% 折扣


# ==================== 订单 API ====================

@router.get("/packages")
async def get_payment_packages():
    """获取所有购买套餐（Token包 + 订阅套餐）"""
    token_packages = [
        {
            "id": id_,
            "type": "token",
            "name": data["name"],
            "price": data["price"] / 100,  # 转换为元
            "tokens": data["tokens"],
            "bonus": data["bonus"],
            "total_tokens": data["tokens"] + data["bonus"],
            "price_per_token": round(data["price"] / (data["tokens"] + data["bonus"]), 2),
        }
        for id_, data in TOKEN_PACKAGES.items()
    ]

    subscription_packages = [
        {
            "id": id_,
            "type": "subscription",
            "name": data["name"],
            "price": data["price"] / 100,
            "days": data["days"],
            "period": "monthly" if data["days"] <= 31 else "yearly",
            "price_label": f"¥{data['price'] / 100:.0f}",
            "price_per_day": round(data["price"] / 100 / data["days"], 2),
            "popular": id_ == "pro_yearly",
            "features": [
                "无限AI问答",
                "5次/天讨论模式",
                "5次/天课程生成",
                "每月50 Token赠送",
            ],
        }
        for id_, data in SUBSCRIPTION_PACKAGES.items()
    ]

    return {
        "token_packages": token_packages,
        "subscription_packages": subscription_packages,
    }


@router.post("/create-order")
async def create_payment_order(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """创建支付订单（Token包 或 订阅套餐）"""
    user_uuid = uuid.UUID(current_user_id)
    package_id = body.get("package", "starter")
    order_type = body.get("type", "token")  # token 或 subscription
    payment_method = body.get("payment_method", "wechat")  # wechat, alipay

    # 确定套餐
    if order_type == "subscription":
        if package_id not in SUBSCRIPTION_PACKAGES:
            raise HTTPException(status_code=400, detail="无效的订阅套餐")
        package = SUBSCRIPTION_PACKAGES[package_id]
        token_amount = 50  # Pro 月赠50 Token
        subscription_days = package["days"]
        subscription_plan = "pro"
    elif order_type == "token":
        if package_id not in TOKEN_PACKAGES:
            raise HTTPException(status_code=400, detail="无效的Token套餐")
        package = TOKEN_PACKAGES[package_id]
        token_amount = package["tokens"] + package["bonus"]
        subscription_days = None
        subscription_plan = None
    else:
        raise HTTPException(status_code=400, detail="无效的订单类型")

    # 检查是否新用户首购折扣（仅适用于Token包）
    original_price = package["price"]
    if order_type == "token":
        existing_orders = await db.fetchval(
            "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'paid'",
            user_uuid
        )
        is_new_user = existing_orders == 0
        if is_new_user:
            actual_price = int(original_price * NEW_USER_DISCOUNT)
            discount_note = "新用户首购50%折扣"
        else:
            actual_price = original_price
            discount_note = None
    else:
        actual_price = original_price
        discount_note = None

    # 创建订单
    order_id = uuid.uuid4()
    await db.execute(
        """
        INSERT INTO orders (id, user_id, amount, token_amount, payment_method, status, created_at,
                            order_type, subscription_days, subscription_plan)
        VALUES ($1, $2, $3, $4, $5, 'created', $6, $7, $8, $9)
        """,
        order_id, user_uuid, actual_price, token_amount, payment_method, utcnow(),
        order_type, subscription_days, subscription_plan
    )

    # 根据支付方式获取支付参数
    if payment_method == "wechat":
        # TODO: 实际调用微信支付 API
        payment_params = {
            "appid": "模拟appid",
            "partnerid": "模拟商户号",
            "prepayid": f"mock_prepay_{order_id.hex}",
            "noncestr": hashlib.md5(str(utcnow()).encode()).hexdigest(),
            "timestamp": int(utcnow().timestamp()),
            "sign": "模拟签名",
        }
        payment_url = None
    elif payment_method == "alipay":
        # TODO: 实际调用支付宝 API
        payment_params = None
        payment_url = f"https://openapi.alipay.com/gateway.do?mock_order_id={order_id.hex}"
    else:
        raise HTTPException(status_code=400, detail="不支持的支付方式")

    return {
        "order_id": str(order_id),
        "order_type": order_type,
        "package": package_id,
        "original_price": original_price / 100,
        "actual_price": actual_price / 100,
        "discount": discount_note,
        "token_amount": token_amount,
        "payment_method": payment_method,
        "status": "created",
        "wechat_params": payment_params if payment_method == "wechat" else None,
        "alipay_url": payment_url if payment_method == "alipay" else None,
        "expires_at": (utcnow() + timedelta(hours=2)).isoformat(),
    }


@router.get("/orders")
async def get_user_orders(
    page: int = 1,
    limit: int = 20,
    status: str = None,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取用户订单列表"""
    user_uuid = uuid.UUID(current_user_id)
    offset = (page - 1) * limit

    if status:
        rows = await db.fetch(
            """
            SELECT id, amount, token_amount, payment_method, status,
                   transaction_id, paid_at, created_at
            FROM orders WHERE user_id = $1 AND status = $2
            ORDER BY created_at DESC LIMIT $3 OFFSET $4
            """,
            user_uuid, status, limit, offset
        )
        total = await db.fetchval(
            "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = $2",
            user_uuid, status
        )
    else:
        rows = await db.fetch(
            """
            SELECT id, amount, token_amount, payment_method, status,
                   transaction_id, paid_at, created_at
            FROM orders WHERE user_id = $1
            ORDER BY created_at DESC LIMIT $2 OFFSET $3
            """,
            user_uuid, limit, offset
        )
        total = await db.fetchval(
            "SELECT COUNT(*) FROM orders WHERE user_id = $1",
            user_uuid
        )

    return {
        "items": [
            {
                "id": str(row["id"]),
                "amount": row["amount"] / 100,
                "token_amount": row["token_amount"],
                "payment_method": row["payment_method"],
                "status": row["status"],
                "transaction_id": row["transaction_id"],
                "paid_at": row["paid_at"].isoformat() if row["paid_at"] else None,
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


@router.get("/orders/{order_id}")
async def get_order_detail(
    order_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取订单详情"""
    user_uuid = uuid.UUID(current_user_id)
    o_uuid = uuid.UUID(order_id)

    order = await db.fetchrow(
        """
        SELECT id, user_id, amount, token_amount, payment_method, status,
               transaction_id, paid_at, notify_data, created_at, updated_at
        FROM orders WHERE id = $1 AND user_id = $2
        """,
        o_uuid, user_uuid
    )

    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    return {
        "id": str(order["id"]),
        "amount": order["amount"] / 100,
        "token_amount": order["token_amount"],
        "payment_method": order["payment_method"],
        "status": order["status"],
        "transaction_id": order["transaction_id"],
        "paid_at": order["paid_at"].isoformat() if order["paid_at"] else None,
        "created_at": order["created_at"].isoformat(),
        "updated_at": order["updated_at"].isoformat() if order["updated_at"] else None,
    }


# ==================== 支付回调 ====================

# SECURITY WARNING: Payment callbacks MUST verify signatures in production!
# Without proper signature verification, malicious actors can forge payment success.
# Implement real signature verification using WeChat/Alipay SDK before production deployment.

import hashlib
import hmac

def verify_wechat_signature(body: bytes, signature: str, api_key: str) -> bool:
    """微信支付签名验证框架 - 生产环境必须实现"""
    # TODO: 使用微信支付SDK实现真实验证
    # 示例: HMAC-SHA256 签名验证
    expected_sig = hmac.new(api_key.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected_sig)

def verify_alipay_signature(params: dict, alipay_public_key: str) -> bool:
    """支付宝签名验证框架 - 生产环境必须实现"""
    # TODO: 使用支付宝SDK实现RSA2签名验证
    # from alipay import AliPay
    # alipay = AliPay(alipay_public_key=alipay_public_key)
    # return alipay.verify(params)
    return False  # 默认返回False，生产环境必须实现


@router.post("/callback/wechat")
async def wechat_pay_callback(
    request: Request,
    db: asyncpg.Connection = Depends(get_db)
):
    """微信支付回调"""
    # 获取回调数据
    body = await request.body()
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return {"code": "FAIL", "message": "无效的数据格式"}

    # SECURITY: 签名验证 - 生产环境强制启用
    wechat_api_key = settings.WECHAT_PAY_API_KEY
    if wechat_api_key:
        signature = request.headers.get("Wechatpay-Signature", "")
        if not signature or not verify_wechat_signature(body, signature, wechat_api_key):
            logger.warning(f"微信支付签名验证失败")
            return {"code": "FAIL", "message": "签名验证失败"}
    elif not settings.TESTING_MODE:
        # 生产环境必须配置API密钥
        logger.error("WECHAT_PAY_API_KEY未配置 - 生产环境拒绝支付回调")
        return {"code": "FAIL", "message": "支付配置错误"}
    else:
        # 开发环境警告
        logger.warning("微信支付签名验证未启用 - 仅限开发环境使用")

    # 解析订单号和交易号
    out_trade_no = data.get("out_trade_no", "")
    transaction_id = data.get("transaction_id", "")

    try:
        order_id = uuid.UUID(out_trade_no.replace("mock_", ""))
    except ValueError:
        return {"code": "FAIL", "message": "无效的订单号"}

    # 记录回调
    await db.execute(
        """
        INSERT INTO payment_callbacks (id, order_id, provider, transaction_id, amount, status, raw_data, created_at)
        VALUES ($1, $2, 'wechat', $3, $4, 'success', $5, $6)
        """,
        uuid.uuid4(), order_id, transaction_id,
        data.get("total_fee", 0), body.decode(), utcnow()
    )

    # 处理订单
    result = await process_payment_success(db, order_id, transaction_id, "wechat")

    if result:
        return {"code": "SUCCESS", "message": "成功"}
    else:
        return {"code": "FAIL", "message": "订单处理失败"}


@router.post("/callback/alipay")
async def alipay_callback(
    request: Request,
    db: asyncpg.Connection = Depends(get_db)
):
    """支付宝回调"""
    form_data = await request.form()
    form_dict = dict(form_data)

    # SECURITY: 签名验证 - 生产环境强制启用
    alipay_public_key = settings.ALIPAY_PUBLIC_KEY
    if alipay_public_key:
        if not verify_alipay_signature(form_dict, alipay_public_key):
            logger.warning("支付宝签名验证失败")
            return "fail"
    elif not settings.TESTING_MODE:
        # 生产环境必须配置公钥
        logger.error("ALIPAY_PUBLIC_KEY未配置 - 生产环境拒绝支付回调")
        return "fail"
    else:
        # 开发环境警告
        logger.warning("支付宝签名验证未启用 - 仅限开发环境使用")

    out_trade_no = form_data.get("out_trade_no", "")
    transaction_id = form_data.get("trade_no", "")

    try:
        order_id = uuid.UUID(out_trade_no.replace("mock_", ""))
    except ValueError:
        return "fail"

    # 记录回调
    await db.execute(
        """
        INSERT INTO payment_callbacks (id, order_id, provider, transaction_id, amount, status, raw_data, created_at)
        VALUES ($1, $2, 'alipay', $3, $4, 'success', $5, $6)
        """,
        uuid.uuid4(), order_id, transaction_id,
        int(float(form_data.get("total_amount", 0)) * 100),
        json.dumps(dict(form_data)), utcnow()
    )

    # 处理订单
    result = await process_payment_success(db, order_id, transaction_id, "alipay")

    if result:
        return "success"
    else:
        return "fail"


async def process_payment_success(
    db: asyncpg.Connection,
    order_id: uuid.UUID,
    transaction_id: str,
    provider: str
) -> bool:
    """处理支付成功，入账 Token + 激活订阅"""
    async with db.transaction():
        # 获取订单并锁定
        order = await db.fetchrow(
            """
            SELECT id, user_id, token_amount, status, order_type,
                   subscription_days, subscription_plan
            FROM orders WHERE id = $1 FOR UPDATE
            """,
            order_id
        )

        if not order:
            return False

        if order["status"] == "paid":
            return True  # 已处理，幂等

        # 更新订单状态
        await db.execute(
            """
            UPDATE orders SET status = 'paid', transaction_id = $1, paid_at = $2, updated_at = $2
            WHERE id = $3
            """,
            transaction_id, utcnow(), order_id
        )

        # 入账 Token
        from app.routes.tokens import reward_tokens_internal
        if order["token_amount"] and order["token_amount"] > 0:
            await reward_tokens_internal(
                db, order["user_id"], order["token_amount"],
                f"{provider}支付购买"
            )

        # 处理订阅订单
        if order["order_type"] == "subscription" and order["subscription_plan"]:
            now = utcnow()
            # 查看是否有现有订阅
            existing_sub = await db.fetchrow(
                "SELECT id, plan_type, expires_at FROM subscriptions WHERE user_id = $1",
                order["user_id"]
            )

            sub_days = order["subscription_days"] or 30
            sub_plan = order["subscription_plan"] or "pro"

            if existing_sub:
                # 已有订阅：从当前到期日或现在开始续期
                current_expires = existing_sub["expires_at"]
                start_from = max(current_expires, now) if current_expires else now
                new_expires = start_from + timedelta(days=sub_days)
                await db.execute(
                    """
                    UPDATE subscriptions SET plan_type = $1, status = 'active',
                                             expires_at = $2, auto_renew = TRUE, updated_at = $3
                    WHERE user_id = $4
                    """,
                    sub_plan, new_expires, now, order["user_id"]
                )
            else:
                # 新建订阅
                new_expires = now + timedelta(days=sub_days)
                await db.execute(
                    """
                    INSERT INTO subscriptions (id, user_id, plan_type, status, started_at, expires_at, auto_renew)
                    VALUES ($1, $2, $3, 'active', $4, $5, TRUE)
                    """,
                    uuid.uuid4(), order["user_id"], sub_plan, now, new_expires
                )

        # 清除余额缓存
        await invalidate_balance_cache(str(order["user_id"]))

        return True


# ==================== 模拟支付（测试用） ====================
# SECURITY WARNING: This endpoint MUST be disabled in production!

@router.post("/mock-pay/{order_id}")
async def mock_pay_success(
    order_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """模拟支付成功（仅用于测试环境）"""
    # SECURITY: Block in production environment
    if not settings.TESTING_MODE:
        raise HTTPException(
            status_code=403,
            detail="Mock payment not available in production environment"
        )
    user_uuid = uuid.UUID(current_user_id)
    o_uuid = uuid.UUID(order_id)

    # 检查订单
    order = await db.fetchrow(
        "SELECT id, user_id, status FROM orders WHERE id = $1 AND user_id = $2",
        o_uuid, user_uuid
    )

    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    if order["status"] == "paid":
        return {"message": "订单已支付"}

    # 模拟支付成功
    result = await process_payment_success(db, o_uuid, f"mock_tx_{utcnow().timestamp()}", "mock")

    if result:
        return {"message": "模拟支付成功，Token已入账"}
    else:
        raise HTTPException(status_code=500, detail="支付处理失败")