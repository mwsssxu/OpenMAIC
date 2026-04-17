"""AI Personas - Historical figures as learning companions

Create differentiated AI personas with unique knowledge, style, and teaching methods.

Personas:
1. Confucius (孔子) - Chinese philosophy, ethics, learning methods
2. Socrates (苏格拉底) - Western philosophy, critical thinking, questioning
3. Leonardo da Vinci (达芬奇) - Renaissance polymath, creativity, interdisciplinary

Each persona has:
- Unique conversation style
- Domain-specific knowledge
- Teaching philosophy
- Personality traits
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
import asyncpg
import uuid
import json
from app.db.database import get_db
from app.middleware.auth import get_current_user_id

router = APIRouter(prefix="/personas", tags=["ai-personas"])


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
    persona = PERSONAS.get(persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    # Get user context (learning history, preferences)
    user_info = await db.fetchrow(
        """
        SELECT nickname, league_tier, point_balance
        FROM users WHERE id = $1
        """,
        uuid.UUID(user_id)
    )

    # Build persona prompt
    style = persona["style"]
    quotes = style["quotes"]
    keywords = style["keywords"]

    # In production, call Claude/OpenAI with persona-specific prompt
    # For now, generate mock response based on persona style

    # Simulate persona response based on mode
    if mode == "teaching":
        response = f"{persona['name']}：{user_message[:30]}...这个问题很有趣。{style['quotes'][0]}。让我为你讲解..."
        suggestions = ["深入学习这个概念", "尝试实际应用", "思考相关原理"]
    elif mode == "discussion":
        response = f"{persona['name']}：你说得很好。但我有不同的看法，{style['quotes'][len(style['quotes'])-1]}。你怎么看？"
        suggestions = ["进一步讨论", "查阅相关资料", "实践验证"]
    elif mode == "questioning":
        response = f"{persona['name']}：{style['quotes'][0]}。那么你认为这个概念的本质是什么？"
        suggestions = ["重新思考定义", "找出反例", "构建论证"]
    else:
        response = f"{persona['name']}：很高兴和你讨论。{style['approach']}。"
        suggestions = []

    # Add persona-specific elements
    if persona_id == "confucius":
        response += "正所谓\"温故而知新\"，你已经有了很好的基础。"
    elif persona_id == "socrates":
        response += "让我们通过问答来探索这个问题的本质。"
    elif persona_id == "da_vinci":
        response += "我建议你从不同角度观察这个问题，就像观察自然一样。"

    return {
        "persona_id": persona_id,
        "response": response,
        "style_used": style["tone"],
        "quotes_used": quotes[:2],
        "suggestions": suggestions
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
    if len(request.message) < 3:
        raise HTTPException(status_code=400, detail="Message too short")

    # Get or create session
    session_id = await db.fetchval(
        """
        INSERT INTO persona_sessions (user_id, persona_id, started_at, topic)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """,
        uuid.UUID(user_id),
        request.persona_id,
        datetime.utcnow(),
        request.context
    )

    # Generate response
    response_data = await generate_persona_response(
        request.persona_id,
        request.message,
        request.context,
        request.mode,
        user_id,
        db
    )

    # Store message
    await db.execute(
        """
        INSERT INTO persona_messages
        (session_id, user_message, persona_response, created_at)
        VALUES ($1, $2, $3, $4)
        """,
        session_id,
        request.message,
        response_data["response"],
        datetime.utcnow()
    )

    # Update session message count
    await db.execute(
        """
        UPDATE persona_sessions SET message_count = message_count + 1 WHERE id = $1
        """,
        session_id
    )

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