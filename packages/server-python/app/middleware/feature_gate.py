"""
权益检查中间件 - 检查用户是否有权限使用某功能

支持两种检查模式：
1. 限额型功能（ai_interaction, discussion 等）- 检查剩余次数
2. 布尔型功能（note_export, review_reminder 等）- 检查是否开通
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
        return {"plan_type": "free", "status": "active", "expires_at": None}

    # 检查过期
    if subscription["expires_at"] and subscription["expires_at"] < utcnow():
        return {"plan_type": "free", "status": "expired", "expires_at": subscription["expires_at"].isoformat() if subscription["expires_at"] else None}

    return {
        "plan_type": subscription["plan_type"],
        "status": subscription["status"],
        "expires_at": subscription["expires_at"].isoformat() if subscription["expires_at"] else None,
    }


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


async def check_feature_access(
    user_id: str,
    feature: str,
    db: asyncpg.Connection
) -> dict:
    """
    检查用户是否有权限使用某功能

    Returns:
        {"allowed": bool, "reason": str, "limit": int, "usage": int, "remaining": int}
    """
    subscription = await get_user_subscription(user_id, db)
    plan_type = subscription["plan_type"]

    features = PLAN_FEATURES.get(plan_type, PLAN_FEATURES["free"])

    if feature not in features:
        raise HTTPException(
            status_code=403,
            detail=f"功能 '{feature}' 不在当前套餐中，升级Pro解锁更多功能"
        )

    feature_config = features[feature]

    # 布尔型功能（True/False）
    if isinstance(feature_config, bool):
        if not feature_config:
            raise HTTPException(
                status_code=403,
                detail=f"功能 '{feature}' 需要Pro会员，升级即享"
            )
        return {"allowed": True, "reason": "ok", "limit": -1, "usage": 0, "remaining": -1}

    # 字符串型功能（如 passport: "basic" / "full"）
    if isinstance(feature_config, str):
        return {"allowed": True, "reason": "ok", "value": feature_config}

    # 数字型功能（如 course_max_scenes: 5, whiteboard_storage_days: 7）
    if isinstance(feature_config, (int, float)):
        return {"allowed": True, "reason": "ok", "value": feature_config}

    # 限额型功能（dict: {"limit": N, "period": "daily"}）
    if isinstance(feature_config, dict):
        limit = feature_config.get("limit", 0)

        if limit == -1:
            # 无限
            return {"allowed": True, "reason": "ok", "limit": -1, "usage": 0, "remaining": -1}

        usage = await get_feature_usage(user_id, feature, db)
        remaining = max(0, limit - usage)

        if usage >= limit:
            raise HTTPException(
                status_code=403,
                detail=f"已达到 '{feature}' 使用上限（{limit}次/{feature_config.get('period', 'daily')}），可购买Token继续使用或升级Pro"
            )

        return {"allowed": True, "reason": "ok", "limit": limit, "usage": usage, "remaining": remaining}

    # 未知类型，默认允许
    return {"allowed": True, "reason": "ok"}


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
# 限额型：
#   @router.post("/classrooms")
#   async def create_classroom(
#       _: bool = Depends(require_feature_access("course_generation")),
#       ...
#   ):
#       await increment_feature_usage(current_user_id, "course_generation", db)
#
# 布尔型：
#   @router.post("/notes/export")
#   async def export_note(
#       _: bool = Depends(require_feature_access("note_export")),
#       ...
#   ):
#
# Token消耗型（超额自动扣Token）：
#   from app.routes.tokens import deduct_tokens_for_action
#   result = await deduct_tokens_for_action(db, user_id, "ai_interaction", "AI课堂问答")
