"""
权益检查中间件 - 检查用户是否有权限使用某功能
"""

from fastapi import HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.routes.subscriptions import PLAN_FEATURES
import asyncpg
import uuid
from datetime import datetime, timedelta
from app.core.time_utils import utcnow


async def get_user_subscription(user_id: str, db: asyncpg.Connection) -> dict:
    """获取用户当前订阅"""
    user_uuid = uuid.UUID(user_id)

    subscription = await db.fetchrow(
        """
        SELECT plan_type, status, expires_at
        FROM subscriptions WHERE user_id = $1
        """,
        user_uuid
    )

    if not subscription:
        return {"plan_type": "free", "status": "active"}

    # 检查过期
    if subscription["expires_at"] and subscription["expires_at"] < utcnow():
        return {"plan_type": "free", "status": "expired"}

    return {
        "plan_type": subscription["plan_type"],
        "status": subscription["status"],
    }


async def check_feature_access(
    user_id: str,
    feature: str,
    db: asyncpg.Connection
) -> bool:
    """检查用户是否有权限使用某功能"""
    subscription = await get_user_subscription(user_id, db)
    plan_type = subscription["plan_type"]

    features = PLAN_FEATURES.get(plan_type, PLAN_FEATURES["free"])

    if feature not in features:
        raise HTTPException(
            status_code=403,
            detail=f"功能 '{feature}' 不在当前套餐中"
        )

    feature_config = features[feature]

    # 检查使用限制
    if feature_config.get("limit") != -1:  # -1 表示无限制
        usage = await get_feature_usage(user_id, feature, db)
        if usage >= feature_config["limit"]:
            raise HTTPException(
                status_code=403,
                detail=f"已达到 '{feature}' 使用上限（{feature_config['limit']}次/{feature_config['period']}）"
            )

    return True


async def get_feature_usage(
    user_id: str,
    feature: str,
    db: asyncpg.Connection
) -> int:
    """获取功能使用次数"""
    user_uuid = uuid.UUID(user_id)

    usage = await db.fetchrow(
        """
        SELECT usage_count, reset_at FROM subscription_usage
        WHERE user_id = $1 AND feature = $2
        """,
        user_uuid, feature
    )

    if not usage:
        return 0

    # 检查是否需要重置
    if usage["reset_at"] and usage["reset_at"] < utcnow():
        # 重置计数
        await db.execute(
            """
            UPDATE subscription_usage SET usage_count = 0, reset_at = $1
            WHERE user_id = $2 AND feature = $3
            """,
            utcnow() + timedelta(days=1),
            user_uuid, feature
        )
        return 0

    return usage["usage_count"]


async def increment_feature_usage(
    user_id: str,
    feature: str,
    db: asyncpg.Connection
):
    """增加功能使用次数"""
    user_uuid = uuid.UUID(user_id)

    # 检查是否存在记录
    existing = await db.fetchrow(
        "SELECT id FROM subscription_usage WHERE user_id = $1 AND feature = $2",
        user_uuid, feature
    )

    if existing:
        await db.execute(
            """
            UPDATE subscription_usage SET usage_count = usage_count + 1
            WHERE user_id = $1 AND feature = $2
            """,
            user_uuid, feature
        )
    else:
        await db.execute(
            """
            INSERT INTO subscription_usage (id, user_id, feature, usage_count, reset_at)
            VALUES ($1, $2, $3, 1, $4)
            """,
            uuid.uuid4(), user_uuid, feature, utcnow() + timedelta(days=1)
        )


# ==================== 依赖注入版本 ====================

async def require_feature_access(
    feature: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """权益检查依赖注入"""
    await check_feature_access(current_user_id, feature, db)
    return True


# 使用示例：
# @router.post("/classrooms")
# async def create_classroom(
#     _: bool = Depends(require_feature_access("course_generation")),
#     ...
# ):
#     ...
#     await increment_feature_usage(current_user_id, "course_generation", db)