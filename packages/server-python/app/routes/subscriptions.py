"""
会员订阅路由 - 订阅管理、权益检查、套餐信息

套餐体系（2层）:
- Free: 免费引流层，核心功能有限额
- Pro: 核心付费层，¥19/月 或 ¥190/年

参数均可从 API 获取，前端不硬编码。
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.core.redis import invalidate_balance_cache
from app.core.pricing import PLAN_PRICES, TOKEN_PACKAGES
import asyncpg
import uuid
from datetime import datetime, timedelta
from app.core.time_utils import utcnow

router = APIRouter()


# ==================== 套餐配置（价格统一在 app.core.pricing 中管理） ====================

PLAN_FEATURES = {
    "free": {
        # AI 互动
        "ai_interaction": {"limit": 5, "period": "daily"},            # AI课堂问答 5次/天
        "discussion": {"limit": 1, "period": "daily"},                # 讨论模式 1次/天
        "discussion_max_agents": 2,                                    # 最多2 Agent
        # 课程
        "course_generation": {"limit": 1, "period": "daily"},          # 课程生成 1次/天
        "course_max_scenes": 5,                                        # 每课程最多5场景
        # 学习搭子
        "buddy_chat": {"limit": 10, "period": "daily"},               # 学习搭子 10条/天
        # 问答
        "question_post": True,                                         # 可发布问题
        "question_ai_assist": False,                                   # AI辅助构思
        # 笔记
        "note_create": True,                                           # 创建笔记
        "note_export": False,                                          # PDF导出
        # 学习工具
        "review_reminder": False,                                      # 艾宾浩斯复习
        "passport": "basic",                                           # 基础学习护照
        "whiteboard_storage_days": 7,                                  # 白板存储7天
        # AI 模型
        "ai_model": "qwen-turbo",                                      # 基础模型
        # 赠送
        "token_bonus_pct": 0,                                          # Token奖励加成 0%
        "points_bonus_pct": 0,                                         # 积分奖励加成 0%
        "monthly_token_grant": 0,                                      # 每月赠送Token
    },
    "pro": {
        # AI 互动
        "ai_interaction": {"limit": -1, "period": "daily"},            # 无限
        "discussion": {"limit": -1, "period": "daily"},                # 无限
        "discussion_max_agents": 3,                                    # 最多3 Agent
        # 课程
        "course_generation": {"limit": 5, "period": "daily"},          # 5次/天
        "course_max_scenes": 10,                                       # 每课程最多10场景
        # 学习搭子
        "buddy_chat": {"limit": -1, "period": "daily"},               # 无限
        # 问答
        "question_post": True,
        "question_ai_assist": True,                                    # AI辅助构思
        # 笔记
        "note_create": True,
        "note_export": True,                                           # PDF导出
        # 学习工具
        "review_reminder": True,                                       # 艾宾浩斯复习
        "passport": "full",                                            # 完整学习护照+导出
        "whiteboard_storage_days": -1,                                 # 永久
        # AI 模型
        "ai_model": "qwen3.7-plus",                                    # 高级模型
        # 赠送
        "token_bonus_pct": 10,                                         # Token奖励加成 10%
        "points_bonus_pct": 20,                                        # 积分奖励加成 20%
        "monthly_token_grant": 50,                                     # 每月赠送50 Token
        # 专属
        "priority_queue": True,                                        # 高峰期优先
        "shared_note_pricing": True,                                   # 共享笔记可定价
    },
}

# Token 消耗规则（所有用户通用，按次付费场景）
TOKEN_COST_MAP = {
    "ai_interaction": 1,           # AI课堂问答 1 Token/次
    "discussion_2agent": 2,        # 2-Agent讨论 2 Token/次
    "discussion_3agent": 3,        # 3-Agent讨论 3 Token/次
    "course_generation_base": 5,   # 课程生成基础 5 Token
    "course_generation_per_scene": 1,  # 每多1场景 +1 Token
    "buddy_deep_chat": 2,          # 学习搭子深度对话 2 Token/次
    "note_ai_summary": 1,          # 笔记AI摘要 1 Token
    "question_ai_assist": 2,       # 问答AI辅助 2 Token
    "tts_synthesis": 0.5,          # TTS语音 0.5 Token（取整）
}

# 新用户注册赠送
NEW_USER_TOKEN_GRANT = 200


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
    """开始试用（7天Pro会员）"""
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
        VALUES ($1, $2, 'pro', 'trial', $3, $4, FALSE)
        """,
        uuid.uuid4(), user_uuid, now, expires_at
    )

    # 初始化权益使用记录（每日重置的功能）
    for feature in ["ai_interaction", "discussion", "course_generation", "buddy_chat"]:
        await db.execute(
            """
            INSERT INTO subscription_usage (id, user_id, feature, usage_count, reset_at)
            VALUES ($1, $2, $3, 0, $4)
            ON CONFLICT (user_id, feature) DO NOTHING
            """,
            uuid.uuid4(), user_uuid, feature, now + timedelta(days=1)
        )

    return {
        "plan_type": "pro",
        "status": "trial",
        "expires_at": expires_at.isoformat(),
        "duration_days": 7,
        "features": PLAN_FEATURES["pro"],
        "message": "已开启7天Pro会员试用",
    }


@router.get("/features")
async def get_plan_features():
    """获取所有套餐权益对比（前端展示用）"""
    return {
        "plans": PLAN_FEATURES,
        "token_costs": TOKEN_COST_MAP,
    }


@router.get("/pricing")
async def get_pricing():
    """获取定价信息"""
    return {
        "plans": {
            "pro": {
                "monthly": PLAN_PRICES["pro_monthly"]["price"] / 100,
                "yearly": PLAN_PRICES["pro_yearly"]["price"] / 100,
                "yearly_monthly": round(PLAN_PRICES["pro_yearly"]["price"] / 100 / 12, 1),  # 年付折合月价
                "yearly_discount": round(
                    (1 - PLAN_PRICES["pro_yearly"]["price"] / (PLAN_PRICES["pro_monthly"]["price"] * 12)) * 100
                ),  # 年付优惠百分比
            },
        },
        "new_user_token_grant": NEW_USER_TOKEN_GRANT,
    }


@router.get("/usage")
async def get_subscription_usage(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取权益使用情况"""
    user_uuid = uuid.UUID(current_user_id)

    # 获取当前套餐
    sub_status = await get_subscription_status(current_user_id, db)
    plan_type = sub_status["plan_type"]
    features = PLAN_FEATURES.get(plan_type, PLAN_FEATURES["free"])

    rows = await db.fetch(
        """
        SELECT feature, usage_count, reset_at
        FROM subscription_usage WHERE user_id = $1
        """,
        user_uuid
    )

    usage_map = {row["feature"]: row for row in rows}

    # 构建完整的使用报告（包含限额信息）
    result = []
    for feature_key in ["ai_interaction", "discussion", "course_generation", "buddy_chat"]:
        feature_config = features.get(feature_key, {})
        if not feature_config:
            continue

        usage_row = usage_map.get(feature_key)
        usage_count = 0
        reset_at = None

        if usage_row:
            # 检查是否需要重置
            if usage_row["reset_at"] and usage_row["reset_at"] < utcnow():
                usage_count = 0
                reset_at = usage_row["reset_at"].isoformat()
            else:
                usage_count = usage_row["usage_count"]
                reset_at = usage_row["reset_at"].isoformat() if usage_row["reset_at"] else None

        limit = feature_config.get("limit", 0)
        result.append({
            "feature": feature_key,
            "usage_count": usage_count,
            "limit": limit,  # -1 表示无限
            "period": feature_config.get("period", "daily"),
            "reset_at": reset_at,
            "remaining": -1 if limit == -1 else max(0, limit - usage_count),
        })

    return {
        "plan_type": plan_type,
        "usage": result,
    }


# ==================== Token 消耗引擎（内部函数） ====================

async def check_and_deduct_tokens_for_action(
    user_id: str,
    action_key: str,
    db,
    extra_count: int = 0
) -> dict:
    """
    检查并扣减 Token（内部函数，供路由层调用）

    逻辑：
    1. 获取用户订阅状态（plan_type）
    2. 获取该 action 对应的免费额度配置
    3. 检查是否在免费额度内（usage < limit 或 limit == -1）
    4. 如果在免费额度内: increment_feature_usage, 不扣 Token
    5. 如果超出免费额度: 检查 Token 余额 >= TOKEN_COST_MAP[action_key] + extra_count
    6. 扣除 Token（调用 deduct_tokens_for_action）
    7. 返回结果

    Args:
        user_id: 用户ID（字符串）
        action_key: 操作类型（对应 TOKEN_COST_MAP 的 key，如 'ai_interaction', 'discussion_2agent', 'buddy_deep_chat', 'course_generation_base'）
        db: 数据库连接
        extra_count: 额外消耗数量（如课程场景数，course_generation_base + scene_count）

    Returns:
        {"deducted": bool, "amount": int, "balance_after": int, "free_quota_used": bool}

    Raises:
        HTTPException: 当超出免费额度且 Token 余额不足时，返回 400
    """
    from app.routes.tokens import deduct_tokens_for_action

    # action_key 到描述的映射
    action_descriptions = {
        "ai_interaction": "AI课堂问答",
        "discussion_2agent": "2-Agent讨论",
        "discussion_3agent": "3-Agent讨论",
        "buddy_deep_chat": "学习搭子深度对话",
        "course_generation_base": "课程生成",
    }
    description = action_descriptions.get(action_key, f"Token消费：{action_key}")

    result = await deduct_tokens_for_action(
        db=db,
        user_id=user_id,
        action=action_key,
        description=description,
        extra_cost=extra_count,
    )

    return result
