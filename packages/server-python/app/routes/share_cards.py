"""Social share cards generation routes

Generate shareable cards for social media platforms.
Supports course completion, achievements, skill passports, and recommendations.

Types:
1. Achievement share card - when earning an achievement
2. Course completion card - when finishing a course
3. Skill passport card - radar chart with skill levels
4. Check-in milestone card - streak achievements
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.time_utils import utcnow
import asyncpg
import uuid
import hashlib
import base64
from app.db.database import get_db
from app.middleware.auth import get_current_user_id

router = APIRouter(prefix="/share-cards", tags=["share-cards"])


class ShareCardRequest(BaseModel):
    card_type: str  # 'achievement', 'course_completion', 'passport', 'checkin'
    reference_id: str  # achievement_id, course_id, passport_id, etc.
    style: str = "gradient"  # 'gradient', 'minimal', 'dark'
    platform: str = "wechat"  # 'wechat', 'weibo', 'twitter', 'general'


class ShareCard(BaseModel):
    card_id: str
    card_type: str
    title: str
    subtitle: str
    image_url: str
    share_url: str
    qr_code_url: Optional[str]
    created_at: datetime


class AchievementCardData(BaseModel):
    achievement_name: str
    achievement_icon: str
    achievement_level: int
    description: str
    earned_date: datetime
    user_name: str


class CourseCompletionCardData(BaseModel):
    course_name: str
    course_category: str
    completion_rate: int
    time_spent: int  # minutes
    rating: int
    user_name: str
    completed_date: datetime


class PassportCardData(BaseModel):
    user_name: str
    skill_data: List[dict]  # [{skill_name, level}]
    total_courses: int
    total_points: int
    league_tier: str


class CheckinCardData(BaseModel):
    streak_days: int
    total_checkins: int
    milestone_type: str  # '7days', '30days', '100days'
    user_name: str
    checkin_date: datetime


# ============ Card Generation ============

async def generate_achievement_card(
    user_id: str,
    achievement_id: str,
    style: str,
    db: asyncpg.Connection
) -> dict:
    """Generate achievement share card."""
    # Get achievement data
    achievement = await db.fetchrow(
        """
        SELECT a.id, a.name, a.icon, a.level, a.description, ua.earned_at
        FROM achievements a
        JOIN user_achievements ua ON a.id = ua.achievement_id
        WHERE ua.user_id = $1 AND ua.achievement_id = $2
        """,
        uuid.UUID(user_id),
        uuid.UUID(achievement_id)
    )

    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement not found")

    user = await db.fetchrow(
        "SELECT nickname FROM users WHERE id = $1",
        uuid.UUID(user_id)
    )

    # Generate card content
    card_id = hashlib.md5(f"{user_id}_{achievement_id}_{datetime.now()}".encode()).hexdigest()[:12]
    title = f"🏆 获得成就: {achievement['name']}"
    subtitle = f"{user['nickname']} 完成了 {achievement['description']}"

    # Generate image (mock for now)
    image_url = f"https://api.openmaic.com/share-cards/{card_id}.png"

    return {
        "card_id": card_id,
        "card_type": "achievement",
        "title": title,
        "subtitle": subtitle,
        "image_url": image_url,
        "share_url": f"https://openmaic.com/share/{card_id}",
        "qr_code_url": f"https://api.openmaic.com/qrcode/{card_id}",
        "data": {
            "achievement_name": achievement["name"],
            "achievement_icon": achievement["icon"],
            "achievement_level": achievement["level"],
            "description": achievement["description"],
            "earned_date": achievement["earned_at"].isoformat(),
            "user_name": user["nickname"],
        }
    }


async def generate_course_completion_card(
    user_id: str,
    course_id: str,
    style: str,
    db: asyncpg.Connection
) -> dict:
    """Generate course completion share card."""
    # Get course and completion data
    course = await db.fetchrow(
        """
        SELECT s.id, s.name, s.description, cc.rating, cc.time_spent, cc.completed_at,
               cc.completion_percentage
        FROM stages s
        JOIN course_completions cc ON s.id = cc.course_id
        WHERE cc.user_id = $1 AND cc.course_id = $2
        """,
        uuid.UUID(user_id),
        uuid.UUID(course_id)
    )

    if not course:
        raise HTTPException(status_code=404, detail="Course completion not found")

    user = await db.fetchrow(
        "SELECT nickname FROM users WHERE id = $1",
        uuid.UUID(user_id)
    )

    # Generate card content
    card_id = hashlib.md5(f"{user_id}_{course_id}_{datetime.now()}".encode()).hexdigest()[:12]
    title = f"📚 完成课程: {course['name']}"
    subtitle = f"{user['nickname']} 完成了这门课程，用时{course['time_spent']}分钟"

    # Generate image (mock for now)
    image_url = f"https://api.openmaic.com/share-cards/{card_id}.png"

    return {
        "card_id": card_id,
        "card_type": "course_completion",
        "title": title,
        "subtitle": subtitle,
        "image_url": image_url,
        "share_url": f"https://openmaic.com/share/{card_id}",
        "qr_code_url": f"https://api.openmaic.com/qrcode/{card_id}",
        "data": {
            "course_name": course["name"],
            "course_category": "学习",
            "completion_rate": course["completion_percentage"],
            "time_spent": course["time_spent"],
            "rating": course["rating"],
            "user_name": user["nickname"],
            "completed_date": course["completed_at"].isoformat(),
        }
    }


async def generate_passport_card(
    user_id: str,
    style: str,
    db: asyncpg.Connection
) -> dict:
    """Generate skill passport share card."""
    # Get passport data
    passport = await db.fetchrow(
        """
        SELECT lp.id, lp.total_courses, lp.total_points, u.nickname, u.league_tier
        FROM learning_passports lp
        JOIN users u ON lp.user_id = u.id
        WHERE lp.user_id = $1
        """,
        uuid.UUID(user_id)
    )

    # Get skill assessments
    skills = await db.fetch(
        """
        SELECT skill_name, level
        FROM skill_assessments
        WHERE user_id = $1 AND level > 0
        ORDER BY level DESC
        LIMIT 7
        """,
        uuid.UUID(user_id)
    )

    skill_data = [{"skill_name": s["skill_name"], "level": s["level"]} for s in skills]

    # Generate card content
    card_id = hashlib.md5(f"{user_id}_passport_{datetime.now()}".encode()).hexdigest()[:12]
    title = f"🎯 学习护照"
    subtitle = f"{passport['nickname']} 的技能认证 | {passport['league_tier']}级联赛"

    # Generate image (mock for now)
    image_url = f"https://api.openmaic.com/share-cards/{card_id}.png"

    return {
        "card_id": card_id,
        "card_type": "passport",
        "title": title,
        "subtitle": subtitle,
        "image_url": image_url,
        "share_url": f"https://openmaic.com/share/{card_id}",
        "qr_code_url": f"https://api.openmaic.com/qrcode/{card_id}",
        "data": {
            "user_name": passport["nickname"],
            "skill_data": skill_data,
            "total_courses": passport["total_courses"],
            "total_points": passport["total_points"],
            "league_tier": passport["league_tier"],
        }
    }


async def generate_checkin_card(
    user_id: str,
    milestone_type: str,
    style: str,
    db: asyncpg.Connection
) -> dict:
    """Generate check-in milestone share card."""
    # Get check-in data
    streak_days = await db.fetchval(
        """
        SELECT COUNT(*) as streak_days
        FROM daily_checkins
        WHERE user_id = $1
        ORDER BY checkin_date DESC
        LIMIT 30
        """,
        uuid.UUID(user_id)
    ) or 0

    total_checkins = await db.fetchval(
        """
        SELECT COUNT(*) FROM daily_checkins WHERE user_id = $1
        """,
        uuid.UUID(user_id)
    ) or 0

    user = await db.fetchrow(
        "SELECT nickname FROM users WHERE id = $1",
        uuid.UUID(user_id)
    )

    # Determine milestone
    milestone_map = {
        "7days": {"days": 7, "title": "连续7天打卡"},
        "30days": {"days": 30, "title": "连续30天打卡"},
        "100days": {"days": 100, "title": "累计100天打卡"},
    }
    milestone_info = milestone_map.get(milestone_type, {"days": streak_days, "title": f"连续{streak_days}天打卡"})

    # Generate card content
    card_id = hashlib.md5(f"{user_id}_checkin_{milestone_type}_{datetime.now()}".encode()).hexdigest()[:12]
    title = f"🔥 {milestone_info['title']}"
    subtitle = f"{user['nickname']} 坚持学习，累计打卡{total_checkins}天"

    # Generate image (mock for now)
    image_url = f"https://api.openmaic.com/share-cards/{card_id}.png"

    return {
        "card_id": card_id,
        "card_type": "checkin",
        "title": title,
        "subtitle": subtitle,
        "image_url": image_url,
        "share_url": f"https://openmaic.com/share/{card_id}",
        "qr_code_url": f"https://api.openmaic.com/qrcode/{card_id}",
        "data": {
            "streak_days": streak_days,
            "total_checkins": total_checkins,
            "milestone_type": milestone_type,
            "user_name": user["nickname"],
            "checkin_date": utcnow().isoformat(),
        }
    }


async def store_share_card(
    user_id: str,
    card_data: dict,
    db: asyncpg.Connection
) -> str:
    """Store share card record."""
    await db.execute(
        """
        INSERT INTO share_cards
        (id, user_id, card_type, reference_id, title, subtitle, image_url, share_url, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        uuid.UUID(card_data["card_id"]),
        uuid.UUID(user_id),
        card_data["card_type"],
        card_data.get("reference_id", ""),
        card_data["title"],
        card_data["subtitle"],
        card_data["image_url"],
        card_data["share_url"],
        utcnow()
    )
    return card_data["card_id"]


# ============ Routes ============

@router.post("/generate")
async def generate_share_card(
    request: ShareCardRequest,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Generate a share card for social media."""
    card_data = None

    if request.card_type == "achievement":
        card_data = await generate_achievement_card(user_id, request.reference_id, request.style, db)
    elif request.card_type == "course_completion":
        card_data = await generate_course_completion_card(user_id, request.reference_id, request.style, db)
    elif request.card_type == "passport":
        card_data = await generate_passport_card(user_id, request.style, db)
    elif request.card_type == "checkin":
        card_data = await generate_checkin_card(user_id, request.reference_id, request.style, db)
    else:
        raise HTTPException(status_code=400, detail="Invalid card type")

    card_data["reference_id"] = request.reference_id

    # Store card
    await store_share_card(user_id, card_data, db)

    return card_data


@router.get("/{card_id}")
async def get_share_card(
    card_id: str,
    db: asyncpg.Connection = Depends(get_db)
):
    """Get share card by ID."""
    card = await db.fetchrow(
        """
        SELECT id, card_type, title, subtitle, image_url, share_url, created_at
        FROM share_cards
        WHERE id = $1
        """,
        card_id
    )

    if not card:
        raise HTTPException(status_code=404, detail="Share card not found")

    return {
        "card_id": str(card["id"]),
        "card_type": card["card_type"],
        "title": card["title"],
        "subtitle": card["subtitle"],
        "image_url": card["image_url"],
        "share_url": card["share_url"],
        "created_at": card["created_at"].isoformat()
    }


@router.get("/templates")
async def get_card_templates():
    """Get available card templates."""
    return {
        "templates": [
            {
                "type": "achievement",
                "name": "成就分享",
                "description": "展示你获得的成就徽章",
                "styles": ["gradient", "minimal", "dark"],
                "platforms": ["wechat", "weibo", "twitter"]
            },
            {
                "type": "course_completion",
                "name": "课程完成",
                "description": "分享你完成的课程",
                "styles": ["gradient", "minimal", "dark"],
                "platforms": ["wechat", "weibo", "twitter"]
            },
            {
                "type": "passport",
                "name": "学习护照",
                "description": "展示你的技能雷达图",
                "styles": ["gradient", "minimal", "dark"],
                "platforms": ["wechat", "weibo", "twitter"]
            },
            {
                "type": "checkin",
                "name": "打卡里程碑",
                "description": "分享你的打卡成就",
                "styles": ["gradient", "minimal", "dark"],
                "platforms": ["wechat", "weibo", "twitter"]
            }
        ]
    }


@router.get("/history")
async def get_share_history(
    limit: int = Query(20, le=50),
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user's share card history."""
    cards = await db.fetch(
        """
        SELECT id, card_type, title, subtitle, image_url, share_url, created_at
        FROM share_cards
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        uuid.UUID(user_id),
        limit
    )

    return {
        "cards": [
            {
                "card_id": str(c["id"]),
                "card_type": c["card_type"],
                "title": c["title"],
                "subtitle": c["subtitle"],
                "image_url": c["image_url"],
                "share_url": c["share_url"],
                "created_at": c["created_at"].isoformat()
            }
            for c in cards
        ]
    }


@router.post("/track-share")
async def track_share_event(
    card_id: str,
    platform: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Track share event for analytics."""
    await db.execute(
        """
        INSERT INTO share_events
        (card_id, user_id, platform, shared_at)
        VALUES ($1, $2, $3, $4)
        """,
        card_id,
        uuid.UUID(user_id),
        platform,
        utcnow()
    )

    # Give share reward points (via point_accounts ledger)
    from app.services.gamification_events import grant_points
    await grant_points(
        db, uuid.UUID(user_id), 5,
        source="share_card",
        context={},
    )

    return {"success": True, "reward": 5}