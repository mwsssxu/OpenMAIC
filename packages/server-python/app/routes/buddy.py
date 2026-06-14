"""
学习搭子路由 - 搭子配置、消息生成、情绪触发
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.routes.subscriptions import check_and_deduct_tokens_for_action
import asyncpg
from app.services.llm import call_llm
import uuid
from datetime import datetime, timedelta
from app.core.time_utils import utcnow
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== 搭子类型定义 ====================

BUDDY_TYPES = {
    "encourager": {
        "name": "鼓励者",
        "description": "温柔激励型，在你完成任务时给予鼓励",
        "tone": "warm",
        "prompts": {
            "checkin": "太棒了！你今天坚持打卡了，继续保持这份热情！",
            "task_complete": "你真的很努力，每一步都在进步，加油！",
            "miss_checkin": "没关系，偶尔休息一下也是可以的。明天继续加油吧！",
            "inactive": "好久没见到你了，期待你回来一起学习！",
        },
    },
    "challenger": {
        "name": "挑战者",
        "description": "竞争激励型，喜欢挑战你超越极限",
        "tone": "strict",
        "prompts": {
            "checkin": "打卡成功！但我相信你能做得更好，明天再挑战一下自己！",
            "task_complete": "不错，但这还不够！你有能力完成更多！",
            "miss_checkin": "断签了？这可不是你的风格！明天必须补上！",
            "inactive": "你跑哪去了？我们还有目标要达成呢！",
        },
    },
    "listener": {
        "name": "倾听者",
        "description": "陪伴型，安静地陪伴你的学习之旅",
        "tone": "warm",
        "prompts": {
            "checkin": "我看到你今天打卡了，一直在这里陪着你。",
            "task_complete": "慢慢来，每一点进步都值得记录。",
            "miss_checkin": "今天休息了？没关系，明天继续就好。",
            "inactive": "好久不见，我会一直在这里等你的。",
        },
    },
    "critic": {
        "name": "毒舌者",
        "description": "吐槽型，喜欢调侃你但真心希望你进步",
        "tone": "humorous",
        "prompts": {
            "checkin": "打卡？就这？我还以为你能做更多呢~",
            "task_complete": "居然完成了？看来你还是有点实力的。",
            "miss_checkin": "断签？懒惰的借口罢了。明天记得补上！",
            "inactive": "消失这么久？你是不是忘了还有学习这回事？",
        },
    },
    "scholar": {
        "name": "学者",
        "description": "知识型，喜欢分享学习心得和知识点",
        "tone": "serious",
        "prompts": {
            "checkin": "打卡成功！坚持学习是最好的知识积累方式。",
            "task_complete": "任务完成！建议你复盘一下今天的学习内容。",
            "miss_checkin": "断签一天没关系，但要记得及时补上学习进度。",
            "inactive": "长时间不学习会导致知识遗忘，建议你重新开始。",
        },
    },
    "partner": {
        "name": "伙伴",
        "description": "默契型，像老朋友一样陪伴你",
        "tone": "warm",
        "prompts": {
            "checkin": "嘿，又见面了！今天的学习怎么样？",
            "task_complete": "不错不错！我们一起继续加油！",
            "miss_checkin": "今天没来？没事，明天我还在这里等你。",
            "inactive": "好久不见！是不是遇到什么困难了？需要聊聊吗？",
        },
    },
}


# ==================== API 端点 ====================

@router.get("/types")
async def get_buddy_types():
    """获取搭子类型列表"""
    return {
        "types": [
            {
                "id": id_,
                "name": data["name"],
                "description": data["description"],
                "tone": data["tone"],
            }
            for id_, data in BUDDY_TYPES.items()
        ],
    }


@router.get("/my-config")
async def get_my_buddy_config(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取我的搭子配置"""
    user_uuid = uuid.UUID(current_user_id)

    config = await db.fetchrow(
        """
        SELECT buddy_type, buddy_name, buddy_avatar, tone_style, active
        FROM buddy_configs WHERE user_id = $1
        """,
        user_uuid
    )

    if not config:
        # 默认配置
        return {
            "buddy_type": "encourager",
            "buddy_name": BUDDY_TYPES["encourager"]["name"],
            "tone_style": "warm",
            "active": True,
            "is_default": True,
        }

    return {
        "buddy_type": config["buddy_type"],
        "buddy_name": config["buddy_name"] or BUDDY_TYPES[config["buddy_type"]]["name"],
        "buddy_avatar": config["buddy_avatar"],
        "tone_style": config["tone_style"] or BUDDY_TYPES[config["buddy_type"]]["tone"],
        "active": config["active"],
        "is_default": False,
    }


@router.post("/config")
async def set_buddy_config(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """设置搭子配置"""
    user_uuid = uuid.UUID(current_user_id)
    buddy_type = body.get("buddy_type", "encourager")
    buddy_name = body.get("buddy_name")
    tone_style = body.get("tone_style")

    if buddy_type not in BUDDY_TYPES:
        raise HTTPException(status_code=400, detail="无效的搭子类型")

    # 检查是否已配置
    existing = await db.fetchrow(
        "SELECT id FROM buddy_configs WHERE user_id = $1",
        user_uuid
    )

    if existing:
        await db.execute(
            """
            UPDATE buddy_configs
            SET buddy_type = $1, buddy_name = $2, tone_style = $3, updated_at = $4
            WHERE user_id = $5
            """,
            buddy_type, buddy_name, tone_style, utcnow(), user_uuid
        )
    else:
        await db.execute(
            """
            INSERT INTO buddy_configs (id, user_id, buddy_type, buddy_name, tone_style, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            uuid.uuid4(), user_uuid, buddy_type, buddy_name, tone_style, utcnow()
        )

    return {
        "buddy_type": buddy_type,
        "buddy_name": buddy_name or BUDDY_TYPES[buddy_type]["name"],
        "tone_style": tone_style or BUDDY_TYPES[buddy_type]["tone"],
        "message": "搭子配置已更新",
    }


@router.get("/messages")
async def get_buddy_messages(
    page: int = 1,
    limit: int = 20,
    unread_only: bool = False,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取搭子消息列表"""
    user_uuid = uuid.UUID(current_user_id)
    offset = (page - 1) * limit

    if unread_only:
        rows = await db.fetch(
            """
            SELECT id, trigger_event, message_type, content, read, created_at
            FROM buddy_messages WHERE user_id = $1 AND read = FALSE
            ORDER BY created_at DESC LIMIT $2 OFFSET $3
            """,
            user_uuid, limit, offset
        )
        total = await db.fetchval(
            "SELECT COUNT(*) FROM buddy_messages WHERE user_id = $1 AND read = FALSE",
            user_uuid
        )
    else:
        rows = await db.fetch(
            """
            SELECT id, trigger_event, message_type, content, read, created_at
            FROM buddy_messages WHERE user_id = $1
            ORDER BY created_at DESC LIMIT $2 OFFSET $3
            """,
            user_uuid, limit, offset
        )
        total = await db.fetchval(
            "SELECT COUNT(*) FROM buddy_messages WHERE user_id = $1",
            user_uuid
        )

    return {
        "items": [
            {
                "id": str(row["id"]),
                "trigger_event": row["trigger_event"],
                "message_type": row["message_type"],
                "content": row["content"],
                "read": row["read"],
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "unread_count": await db.fetchval(
                "SELECT COUNT(*) FROM buddy_messages WHERE user_id = $1 AND read = FALSE",
                user_uuid
            ),
        },
    }


@router.post("/messages/{message_id}/read")
async def mark_message_read(
    message_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """标记消息已读"""
    user_uuid = uuid.UUID(current_user_id)
    m_uuid = uuid.UUID(message_id)

    await db.execute(
        "UPDATE buddy_messages SET read = TRUE WHERE id = $1 AND user_id = $2",
        m_uuid, user_uuid
    )

    return {"message": "消息已标记为已读"}


@router.post("/deep-chat")
async def buddy_deep_chat(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """
    学习搭子深度对话

    Token 消耗规则：
    - 免费用户：每日 10 次 buddy_chat 免费额度
    - 超出免费额度：消耗 2 Token/次
    - Pro 用户：无限免费额度
    """
    # Token 消耗检查
    try:
        token_result = await check_and_deduct_tokens_for_action(current_user_id, "buddy_deep_chat", db)
        logger.info(f"[BuddyDeepChat] Token check: deducted={token_result['deducted']}, free_quota={token_result['free_quota_used']}")
    except HTTPException as e:
        logger.warning(f"[BuddyDeepChat] Token check failed: {e.detail}")
        raise

    user_uuid = uuid.UUID(current_user_id)
    message = body.get("message", "")
    buddy_type = body.get("buddy_type", "encourager")

    if buddy_type not in BUDDY_TYPES:
        buddy_type = "encourager"

    # 获取搭子配置
    config = await db.fetchrow(
        "SELECT buddy_type, buddy_name, tone_style FROM buddy_configs WHERE user_id = $1",
        user_uuid
    )
    if config:
        buddy_type = config["buddy_type"] or buddy_type
        buddy_name = config["buddy_name"] or BUDDY_TYPES[buddy_type]["name"]
        tone_style = config["tone_style"] or BUDDY_TYPES[buddy_type]["tone"]
    else:
        buddy_name = BUDDY_TYPES[buddy_type]["name"]
        tone_style = BUDDY_TYPES[buddy_type]["tone"]

    # 生成回复（基于搭子类型的预设模板 + 用户消息）
    buddy_data = BUDDY_TYPES[buddy_type]
    tone_map = {
        "warm": "温暖鼓励",
        "strict": "严格督促",
        "humorous": "幽默调侃",
        "serious": "认真严谨",
    }
    tone_desc = tone_map.get(tone_style, "温暖鼓励")

    # 存储用户消息
    await db.execute(
        """
        INSERT INTO buddy_messages (id, user_id, trigger_event, message_type, content, created_at)
        VALUES ($1, $2, 'deep_chat', 'user', $3, $4)
        """,
        uuid.uuid4(), user_uuid, message, utcnow()
    )

    # 读取最近10条对话历史
    history_rows = await db.fetch(
        """
        SELECT message_type, content FROM buddy_messages
        WHERE user_id = $1 AND trigger_event = 'deep_chat'
        ORDER BY created_at DESC LIMIT 10
        """,
        user_uuid
    )
    # 反转为时间正序
    history_rows = list(reversed(history_rows))
    # 拼接历史为 prompt 上下文
    history_lines = []
    for row in history_rows:
        if row["message_type"] == "user":
            history_lines.append(f"用户：{row['content']}")
        else:
            history_lines.append(f"{buddy_name}：{row['content']}")
    history_text = "\n".join(history_lines)

    # 用 LLM 生成智能回复
    system_prompt = (
        f"你是{buddy_name}，一个{tone_desc}风格的学习搭子（{buddy_data['name']}类型）。"
        f"你的角色：{buddy_data.get('description', '陪伴和帮助用户学习')}。"
        f"请用{tone_desc}的语气回复用户，保持简洁（100字以内），关注学习和成长。"
        f"如果是提问，给出建议；如果是分享，给予回应。不要使用markdown。"
    )
    # 拼接历史+当前消息作为 prompt
    full_prompt = f"{history_text}\n用户：{message}" if history_text else message
    try:
        response_content = await call_llm(
            prompt=full_prompt,
            system_prompt=system_prompt,
            temperature=0.8,
            max_tokens=200,
            user_id=current_user_id,
            db=db,
        )
    except Exception as e:
        logger.warning(f"[BuddyDeepChat] LLM failed, fallback to template: {e}")
        response_content = f"[{buddy_name}] 收到！让我想想怎么帮你..."

    # 存储对话记录
    await db.execute(
        """
        INSERT INTO buddy_messages (id, user_id, trigger_event, message_type, content, created_at)
        VALUES ($1, $2, 'deep_chat', 'text', $3, $4)
        """,
        uuid.uuid4(), user_uuid, response_content, utcnow()
    )

    return {
        "buddy_name": buddy_name,
        "buddy_type": buddy_type,
        "tone_style": tone_style,
        "content": response_content,
        "token_result": token_result,
    }


# ==================== 内部函数 ====================

async def generate_buddy_message(
    db: asyncpg.Connection,
    user_uuid: uuid.UUID,
    trigger_event: str,
    buddy_type: str = "encourager"
) -> str:
    """生成搭子消息"""
    if buddy_type not in BUDDY_TYPES:
        buddy_type = "encourager"

    # 获取预设消息模板
    template = BUDDY_TYPES[buddy_type]["prompts"].get(trigger_event, "继续加油！")

    # 存储消息
    await db.execute(
        """
        INSERT INTO buddy_messages (id, user_id, trigger_event, message_type, content, created_at)
        VALUES ($1, $2, $3, 'text', $4, $5)
        """,
        uuid.uuid4(), user_uuid, trigger_event, template, utcnow()
    )

    return template


async def get_user_buddy_type(db: asyncpg.Connection, user_uuid: uuid.UUID) -> str:
    """获取用户搭子类型"""
    config = await db.fetchrow(
        "SELECT buddy_type FROM buddy_configs WHERE user_id = $1",
        user_uuid
    )
    return config["buddy_type"] if config else "encourager"