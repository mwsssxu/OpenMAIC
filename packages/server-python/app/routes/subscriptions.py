"""
会员订阅路由 - 订阅管理、权益检查、套餐信息
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.core.redis import invalidate_balance_cache
import asyncpg
import uuid
from datetime import datetime, timedelta
from app.core.time_utils import utcnow

router = APIRouter()


# ==================== 套餐配置 ====================

PLAN_PRICES = {
    "premium_monthly": {"price": 2900, "days": 30},  # ¥29/月
    "premium_yearly": {"price": 29000, "days": 365},  # ¥290/年
    "enterprise_monthly": {"price": 9900, "days": 30},  # ¥99/月
}

PLAN_FEATURES = {
    "free": {
        "course_generation": {"limit": 2, "period": "daily"},
        "token_bonus": 0,
        "points_bonus": 0,
        "collaboration_limit": 10,
        "whiteboard_storage_days": 30,
        "ai_model": "gpt-4o-mini",
    },
    "premium": {
        "course_generation": {"limit": -1, "period": "daily"},  # 无限
        "token_bonus": 10,  # +10%
        "points_bonus": 20,  # +20%
        "collaboration_limit": 50,
        "whiteboard_storage_days": -1,  # 永久
        "ai_model": "gpt-4o",
    },
    "enterprise": {
        "course_generation": {"limit": -1, "period": "daily"},
        "token_bonus": 20,  # +20%
        "points_bonus": 30,  # +30%
        "collaboration_limit": -1,  # 无限
        "whiteboard_storage_days": -1,
        "ai_model": "gpt-4o",
        "team_management": True,
    },
}


# ==================== API端点 ====================

@router.get("/status")
async def get_subscription_status(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取用户订阅状态"""
    user_uuid = uuid.UUID(current_user_id)

    subscription = await db.fetchrow(
        """
        SELECT plan_type, status, expires_at, auto_renew, started_at
        FROM subscriptions WHERE user_id = $1
        """,
        user_uuid
    )

    if not subscription:
        # 默认免费用户
        return {
            "plan_type": "free",
            "status": "active",
            "expires_at": None,
            "features": PLAN_FEATURES["free"],
        }

    # 检查是否过期
    if subscription["expires_at"] and subscription["expires_at"] < utcnow():
        plan_type = "free"
        status = "expired"
    else:
        plan_type = subscription["plan_type"]
        status = subscription["status"]

    return {
        "plan_type": plan_type,
        "status": status,
        "expires_at": subscription["expires_at"].isoformat() if subscription["expires_at"] else None,
        "auto_renew": subscription["auto_renew"],
        "started_at": subscription["started_at"].isoformat() if subscription["started_at"] else None,
        "features": PLAN_FEATURES.get(plan_type, PLAN_FEATURES["free"]),
    }


@router.post("/trial")
async def start_trial_subscription(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """开始试用（7天高级会员）"""
    user_uuid = uuid.UUID(current_user_id)

    # 检查是否已有订阅
    existing = await db.fetchrow(
        "SELECT id FROM subscriptions WHERE user_id = $1",
        user_uuid
    )

    if existing:
        raise HTTPException(status_code=400, detail="已有订阅记录，无法再次试用")

    # 创建试用订阅
    now = utcnow()
    expires_at = now + timedelta(days=7)

    await db.execute(
        """
        INSERT INTO subscriptions (id, user_id, plan_type, status, started_at, expires_at, auto_renew)
        VALUES ($1, $2, 'premium', 'trial', $3, $4, FALSE)
        """,
        uuid.uuid4(), user_uuid, now, expires_at
    )

    # 初始化权益使用记录
    await db.execute(
        """
        INSERT INTO subscription_usage (id, user_id, feature, usage_count, reset_at)
        VALUES ($1, $2, 'course_generation', 0, $3)
        """,
        uuid.uuid4(), user_uuid, now + timedelta(days=1)
    )

    return {
        "plan_type": "premium",
        "status": "trial",
        "expires_at": expires_at.isoformat(),
        "duration_days": 7,
        "features": PLAN_FEATURES["premium"],
        "message": "已开启7天高级会员试用",
    }


@router.get("/features")
async def get_plan_features():
    """获取所有套餐权益对比"""
    return {
        "plans": PLAN_FEATURES,
    }


@router.get("/pricing")
async def get_pricing():
    """获取定价信息"""
    return {
        "plans": {
            "premium": {
                "monthly": PLAN_PRICES["premium_monthly"]["price"] / 100,
                "yearly": PLAN_PRICES["premium_yearly"]["price"] / 100,
                "yearly_discount": 17,  # 年付优惠百分比
            },
            "enterprise": {
                "monthly": PLAN_PRICES["enterprise_monthly"]["price"] / 100,
            },
        },
    }


@router.get("/usage")
async def get_subscription_usage(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取权益使用情况"""
    user_uuid = uuid.UUID(current_user_id)

    rows = await db.fetch(
        """
        SELECT feature, usage_count, reset_at
        FROM subscription_usage WHERE user_id = $1
        """,
        user_uuid
    )

    return {
        "usage": [
            {
                "feature": row["feature"],
                "usage_count": row["usage_count"],
                "reset_at": row["reset_at"].isoformat() if row["reset_at"] else None,
            }
            for row in rows
        ]
    }