"""AI Personas - Historical figures as learning companions

Create differentiated AI personas with unique knowledge, style, and teaching methods.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.time_utils import utcnow
import asyncpg
import uuid
import json
import logging
import time
from app.db.database import get_db
from app.middleware.auth import get_current_user_id
from app.services.llm import call_llm

router = APIRouter(prefix="/personas", tags=["ai-personas"])
logger = logging.getLogger(__name__)

# 日志截断长度常量
LOG_TRUNCATION_LENGTH = 100


# ============ Persona Definitions ============

PERSONAS = {
    "confucius": {
        "id": "confucius",
        "name": "孔子",
        "name_en": "Confucius",
        "era": "春秋时期 (551-479 BC)",
        "avatar": "https://api.openmaic.com/personas/confucius.png",
        "specialty": "中国哲学、伦理学、学习方法",
        "description": "儒家学派创始人，主张\"学而不思则罔，思而不学则殆\"",
        "style": {
            "tone": "温和谦逊",
            "approach": "启发式教学，强调思考",
            "quotes": ["三人行，必有我师焉", "学而时习之，不亦说乎", "温故而知新"],
            "keywords": ["学习", "思考", "礼仪", "修身", "仁义"]
        },
        "teaching_methods": [
            "问答引导",
            "典故讲解",
            "生活比喻",
            "循序渐进"
        ],
        "expertise": ["儒家经典", "人生哲学", "学习方法", "道德修养"]
    },
    "socrates": {
        "id": "socrates",
        "name": "苏格拉底",
        "name_en": "Socrates",
        "era": "古希腊 (470-399 BC)",
        "avatar": "https://api.openmaic.com/personas/socrates.png",
        "specialty": "西方哲学、批判性思维、辩证法",
        "description": "西方哲学奠基人，以\"苏格拉底式提问\"著称",
        "style": {
            "tone": "幽默反讽",
            "approach": "连续追问，引导发现真理",
            "quotes": ["我知道我一无所知", "未经审视的人生不值得过"],
            "keywords": ["质疑", "辩论", "真理", "美德", "思考"]
        },
        "teaching_methods": [
            "苏格拉底式提问",
            "反例论证",
            "逻辑推演",
            "对话辩证"
        ],
        "expertise": ["哲学思考", "逻辑分析", "批判思维", "美德探讨"]
    },
    "da_vinci": {
        "id": "da_vinci",
        "name": "达芬奇",
        "name_en": "Leonardo da Vinci",
        "era": "文艺复兴 (1452-1519)",
        "avatar": "https://api.openmaic.com/personas/da_vinci.png",
        "specialty": "跨学科创新、艺术与科学融合",
        "description": "文艺复兴全才，融合艺术、科学、工程的先驱",
        "style": {
            "tone": "好奇探索",
            "approach": "观察自然，跨领域思考",
            "quotes": ["学习永远不会使心智疲劳", "simplicity is the ultimate sophistication"],
            "keywords": ["观察", "创新", "跨学科", "艺术", "科学"]
        },
        "teaching_methods": [
            "观察记录",
            "动手实践",
            "类比联想",
            "跨界融合"
        ],
        "expertise": ["艺术创作", "科学探索", "工程设计", "创新思维"]
    }
}


# ============ Models ============

class PersonaInfo(BaseModel):
    id: str
    name: str
    name_en: str
    era: str
    specialty: str
    description: str


class PersonaChatRequest(BaseModel):
    persona_id: str
    message: str
    context: Optional[str] = None  # course_id, question_id, etc.
    mode: str = "teaching"  # 'teaching', 'discussion', 'questioning'


class PersonaChatResponse(BaseModel):
    persona_id: str
    response: str
    style_used: str
    quotes_used: List[str]
    suggestions: List[str]
    elapsed_seconds: Optional[float] = None
    fallback: Optional[bool] = None


class PersonaSession(BaseModel):
    session_id: str
    persona_id: str
    user_id: str
    started_at: datetime
    message_count: int
    topic: Optional[str]


# ============ Chat Generation ============

async def generate_persona_response(
    persona_id: str,
    user_message: str,
    context: Optional[str],
    mode: str,
    user_id: str,
    db: asyncpg.Connection
) -> dict:
    """Generate persona response using AI."""
    start_time = time.time()
    persona = PERSONAS.get(persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    logger.info(f"[Persona] 开始生成响应 - persona={persona['name']}, mode={mode}")
    logger.debug(f"[Persona] 用户消息: {user_message[:LOG_TRUNCATION_LENGTH]}...")
    logger.debug(f"[Persona] 上下文: {context or '无'}")

    # 获取用户信息
    user_info = await db.fetchrow(
        """
        SELECT nickname, league_tier, point_balance
        FROM users WHERE id = $1
        """,
        uuid.UUID(user_id)
    )
    user_name = user_info["nickname"] or "学员"

    # 构建智能体提示词
    style = persona["style"]
    quotes = style["quotes"]

    system_prompt = f"""你是{persona['name']}（{persona['name_en']}），{persona['era']}的历史人物。

## 你的身份特征
- 专业领域：{persona['specialty']}
- 教学风格：{style['tone']}，{style['approach']}
- 核心思想：{', '.join(style['keywords'][:3])}

## 你的经典名言
{chr(10).join([f'- "{q}"' for q in quotes])}

## 教学方法
{chr(10).join([f'- {m}' for m in persona['teaching_methods']])}

## 回答要求
1. 以{persona['name']}的身份和风格回答
2. 适当引用你的经典名言
3. 使用{style['tone']}的语气
4. 结合学生的问题给出有启发性的回答
5. 如果是{mode}模式：
   - teaching: 详细讲解概念，给出例子
   - discussion: 引导讨论，提出追问
   - questioning: 用苏格拉底式提问引导学生思考

当前对话者：{user_name}"""

    user_prompt = f"""学生问题：{user_message}

请以{persona['name']}的身份回答这个问题。"""

    logger.info(f"[Persona] 系统提示词长度: {len(system_prompt)}")
    logger.debug(f"[Persona] 用户提示词(截断): {user_prompt[:LOG_TRUNCATION_LENGTH]}...")

    try:
        # 调用 LLM
        llm_start = time.time()
        response = await call_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.8,  # 更高的温度让回答更有个性
            max_tokens=1024,
        )
        llm_elapsed = time.time() - llm_start

        logger.info(f"[Persona] LLM响应完成 (耗时: {llm_elapsed:.1f}s, 长度: {len(response)})")
        logger.debug(f"[Persona] LLM响应内容(截断): {response[:LOG_TRUNCATION_LENGTH]}...")

        total_elapsed = time.time() - start_time
        logger.info(f"[Persona] 生成完成 (总耗时: {total_elapsed:.1f}s)")

        return {
            "persona_id": persona_id,
            "response": response,
            "style_used": style["tone"],
            "quotes_used": quotes[:2],
            "suggestions": ["继续深入探讨", "尝试实际应用", "思考相关原理"],
            "elapsed_seconds": round(total_elapsed, 2)
        }

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[Persona] LLM调用失败 (耗时: {elapsed:.1f}s): {e}")

        # 降级到模拟响应
        if mode == "teaching":
            response = f"{persona['name']}：{user_message[:30]}...这个问题很有趣。{style['quotes'][0]}。让我为你讲解..."
        elif mode == "discussion":
            response = f"{persona['name']}：你说得很好。但我有不同的看法，{style['quotes'][-1]}。你怎么看？"
        else:
            response = f"{persona['name']}：{style['quotes'][0]}。那么你认为这个概念的本质是什么？"

        logger.info(f"[Persona] 使用降级响应: {response[:100]}...")

        return {
            "persona_id": persona_id,
            "response": response,
            "style_used": style["tone"],
            "quotes_used": quotes[:2],
            "suggestions": [],
            "elapsed_seconds": round(elapsed, 2),
            "fallback": True
        }


# ============ Routes ============

@router.get("/list")
async def list_personas():
    """List all available personas."""
    return {
        "personas": [
            PersonaInfo(
                id=p["id"],
                name=p["name"],
                name_en=p["name_en"],
                era=p["era"],
                specialty=p["specialty"],
                description=p["description"]
            )
            for p in PERSONAS.values()
        ]
    }


@router.get("/{persona_id}")
async def get_persona(persona_id: str):
    """Get detailed persona info."""
    persona = PERSONAS.get(persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    return {
        "persona": persona,
        "stats": {
            "total_sessions": 0,  # Would query from database
            "total_messages": 0,
            "avg_rating": 4.5
        }
    }


@router.post("/chat")
async def chat_with_persona(
    request: PersonaChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Chat with a persona."""
    start_time = time.time()
    logger.info(f"[Chat] 开始聊天请求 - persona={request.persona_id}, mode={request.mode}")
    logger.info(f"[Chat] 用户消息: {request.message}")
    logger.info(f"[Chat] 上下文: {request.context or '无'}")

    if len(request.message) < 3:
        raise HTTPException(status_code=400, detail="Message too short")

    # Generate response
    response_data = await generate_persona_response(
        request.persona_id,
        request.message,
        request.context,
        request.mode,
        user_id,
        db
    )

    # Store message in session
    try:
        session_id = await db.fetchval(
            """
            INSERT INTO persona_sessions (user_id, persona_id, started_at, topic)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            """,
            uuid.UUID(user_id),
            request.persona_id,
            utcnow(),
            request.context
        )

        await db.execute(
            """
            INSERT INTO persona_messages
            (session_id, user_message, persona_response, created_at)
            VALUES ($1, $2, $3, $4)
            """,
            session_id,
            request.message,
            response_data["response"],
            utcnow()
        )

        await db.execute(
            """
            UPDATE persona_sessions SET message_count = message_count + 1 WHERE id = $1
            """,
            session_id
        )

        logger.info(f"[Chat] 会话已保存 - session_id={session_id}")
    except Exception as e:
        logger.warning(f"[Chat] 保存会话失败: {e}")

    total_elapsed = time.time() - start_time
    logger.info(f"[Chat] 请求完成 (总耗时: {total_elapsed:.1f}s)")

    return PersonaChatResponse(**response_data)


@router.get("/sessions")
async def get_persona_sessions(
    persona_id: Optional[str] = Query(None),
    limit: int = Query(10, le=30),
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user's persona chat sessions."""
    conditions = ["user_id = $1"]
    params = [uuid.UUID(user_id)]

    if persona_id:
        conditions.append("persona_id = $" + str(len(params) + 1))
        params.append(persona_id)

    params.append(limit)

    sessions = await db.fetch(
        f"""
        SELECT id, persona_id, started_at, message_count, topic
        FROM persona_sessions
        WHERE {" AND ".join(conditions)}
        ORDER BY started_at DESC
        LIMIT ${len(params)}
        """,
        *params
    )

    return {
        "sessions": [
            {
                "session_id": str(s["id"]),
                "persona_id": s["persona_id"],
                "started_at": s["started_at"].isoformat(),
                "message_count": s["message_count"],
                "topic": s["topic"]
            }
            for s in sessions
        ]
    }


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get messages from a persona session."""
    # Verify session ownership
    session = await db.fetchrow(
        """
        SELECT id, user_id FROM persona_sessions WHERE id = $1
        """,
        uuid.UUID(session_id)
    )

    if not session or str(session["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = await db.fetch(
        """
        SELECT user_message, persona_response, created_at
        FROM persona_messages
        WHERE session_id = $1
        ORDER BY created_at
        """,
        uuid.UUID(session_id)
    )

    return {
        "messages": [
            {
                "user_message": m["user_message"],
                "persona_response": m["persona_response"],
                "created_at": m["created_at"].isoformat()
            }
            for m in messages
        ]
    }


@router.post("/sessions/{session_id}/feedback")
async def rate_persona_session(
    session_id: str,
    rating: int,
    feedback: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Rate a persona session."""
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")

    await db.execute(
        """
        UPDATE persona_sessions SET rating = $2, feedback = $3
        WHERE id = $1 AND user_id = $4
        """,
        uuid.UUID(session_id),
        rating,
        feedback,
        uuid.UUID(user_id)
    )

    # Give points for feedback
    await db.execute(
        """
        UPDATE users SET point_balance = point_balance + 3 WHERE id = $1
        """,
        uuid.UUID(user_id)
    )

    return {"success": True, "reward": 3}


@router.get("/recommend")
async def recommend_persona(
    topic: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Recommend best persona for a topic."""
    # Analyze topic keywords
    topic_lower = topic.lower()

    # Simple keyword matching
    recommendations = []

    if any(k in topic_lower for k in ["哲学", "伦理", "学习", "儒家", "修养", "道德", "人生"]):
        recommendations.append({
            "persona_id": "confucius",
            "score": 0.9,
            "reason": "孔子擅长人生哲学和学习方法"
        })

    if any(k in topic_lower for k in ["哲学", "逻辑", "辩论", "批判", "质疑", "思考", "真理"]):
        recommendations.append({
            "persona_id": "socrates",
            "score": 0.9,
            "reason": "苏格拉底擅长批判性思维和辩论"
        })

    if any(k in topic_lower for k in ["创新", "艺术", "科学", "工程", "跨学科", "设计", "自然"]):
        recommendations.append({
            "persona_id": "da_vinci",
            "score": 0.9,
            "reason": "达芬奇擅长跨学科创新和艺术科学融合"
        })

    if not recommendations:
        recommendations.append({
            "persona_id": "confucius",
            "score": 0.5,
            "reason": "孔子适合一般性学习和思考"
        })

    return {"recommendations": recommendations}