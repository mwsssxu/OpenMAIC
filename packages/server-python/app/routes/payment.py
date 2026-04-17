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
from datetime import datetime
import hashlib
import json

router = APIRouter()

# ==================== Token套餐配置 ====================

TOKEN_PACKAGES = {
    "basic": {"price": 1000, "tokens": 100, "bonus": 0, "name": "基础包"},
    "standard": {"price": 5000, "tokens": 500, "bonus": 100, "name": "标准包"},
    "premium": {"price": 10000, "tokens": 1000, "bonus": 500, "name": "高级包"},
}

# 新用户首购折扣
NEW_USER_DISCOUNT = 0.5  # 50% 折扣


# ==================== 订单 API ====================

@router.get("/packages")
async def get_payment_packages():
    """获取 Token 购买套餐"""
    return [
        {
            "id": id_,
            "name": data["name"],
            "price": data["price"] / 100,  # 转换为元
            "tokens": data["tokens"],
            "bonus": data["bonus"],
            "total_tokens": data["tokens"] + data["bonus"],
            "price_per_token": round(data["price"] / (data["tokens"] + data["bonus"]), 2),
        }
        for id_, data in TOKEN_PACKAGES.items()
    ]


@router.post("/create-order")
async def create_payment_order(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """创建支付订单"""
    user_uuid = uuid.UUID(current_user_id)
    package_id = body.get("package", "basic")
    payment_method = body.get("payment_method", "wechat")  # wechat, alipay

    if package_id not in TOKEN_PACKAGES:
        raise HTTPException(status_code=400, detail="无效的套餐")

    package = TOKEN_PACKAGES[package_id]

    # 检查是否新用户首购
    existing_orders = await db.fetchval(
        "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'paid'",
        user_uuid
    )
    is_new_user = existing_orders == 0

    # 计算价格
    original_price = package["price"]
    if is_new_user:
        actual_price = int(original_price * NEW_USER_DISCOUNT)
        discount_note = "新用户首购50%折扣"
    else:
        actual_price = original_price
        discount_note = None

    token_amount = package["tokens"] + package["bonus"]

    # 创建订单
    order_id = uuid.uuid4()
    await db.execute(
        """
        INSERT INTO orders (id, user_id, amount, token_amount, payment_method, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'created', $6)
        """,
        order_id, user_uuid, actual_price, token_amount, payment_method, datetime.utcnow()
    )

    # 根据支付方式获取支付参数
    if payment_method == "wechat":
        # TODO: 实际调用微信支付 API
        # 这里返回模拟数据
        payment_params = {
            "appid": "模拟appid",
            "partnerid": "模拟商户号",
            "prepayid": f"mock_prepay_{order_id.hex}",
            "noncestr": hashlib.md5(str(datetime.utcnow()).encode()).hexdigest(),
            "timestamp": int(datetime.utcnow().timestamp()),
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
        "package": package_id,
        "original_price": original_price / 100,
        "actual_price": actual_price / 100,
        "discount": discount_note,
        "token_amount": token_amount,
        "payment_method": payment_method,
        "status": "created",
        "wechat_params": payment_params if payment_method == "wechat" else None,
        "alipay_url": payment_url if payment_method == "alipay" else None,
        "expires_at": (datetime.utcnow() + datetime.timedelta(hours=2)).isoformat(),
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

    # CRITICAL: 签名验证 - 生产环境必须启用
    # 从配置获取微信API密钥
    # wechat_api_key = settings.WECHAT_PAY_API_KEY
    # if wechat_api_key:
    #     signature = request.headers.get("Wechatpay-Signature", "")
    #     if not verify_wechat_signature(body, signature, wechat_api_key):
    #         logger.warning(f"微信支付签名验证失败: {out_trade_no}")
    #         return {"code": "FAIL", "message": "签名验证失败"}
    # else:
    #     # 开发环境警告
    #     logger.warning("微信支付签名验证未启用 - 仅限开发环境使用")

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
        data.get("total_fee", 0), body.decode(), datetime.utcnow()
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

    out_trade_no = form_data.get("out_trade_no", "")
    transaction_id = form_data.get("trade_no", "")

    # TODO: 实际验证签名

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
        json.dumps(dict(form_data)), datetime.utcnow()
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
    """处理支付成功，入账 Token"""
    async with db.transaction():
        # 获取订单并锁定
        order = await db.fetchrow(
            "SELECT id, user_id, token_amount, status FROM orders WHERE id = $1 FOR UPDATE",
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
            transaction_id, datetime.utcnow(), order_id
        )

        # 入账 Token
        from app.routes.tokens import reward_tokens_internal
        await reward_tokens_internal(
            db, order["user_id"], order["token_amount"],
            f"{provider}支付购买"
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
    result = await process_payment_success(db, o_uuid, f"mock_tx_{datetime.utcnow().timestamp()}", "mock")

    if result:
        return {"message": "模拟支付成功，Token已入账"}
    else:
        raise HTTPException(status_code=500, detail="支付处理失败")