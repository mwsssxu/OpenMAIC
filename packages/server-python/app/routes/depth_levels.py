"""Learning depth levels - Adapt content based on user's learning goal

Three depth levels:
1. Skim (浏览) - Quick overview, key points only, ~10 min
2. Understand (理解) - Moderate depth, explanations, examples, ~30 min
3. Master (精通) - Deep dive, practice, extensions, ~60+ min

Features:
- User can select depth level before starting course
- Content adapts to depth (scene count, detail level, exercises)
- League tier influences recommended depth
- Progress tracking per depth level
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import asyncpg
import uuid
from app.db.database import get_db
from app.middleware.auth import get_current_user_id

router = APIRouter(prefix="/depth-levels", tags=["depth-levels"])


# ============ Constants ============

DEPTH_CONFIGS = {
    "skim": {
        "name": "浏览",
        "description": "快速了解核心概念",
        "estimated_time": 10,  # minutes
        "scene_ratio": 0.3,  # 30% of full scenes
        "detail_level": "key_points",
        "exercises": "none",
        "review_required": False,
        "points_multiplier": 0.5,
        "badge": "快速学习者"
    },
    "understand": {
        "name": "理解",
        "description": "掌握概念和应用场景",
        "estimated_time": 30,
        "scene_ratio": 0.7,
        "detail_level": "full_content",
        "exercises": "basic",
        "review_required": True,
        "points_multiplier": 1.0,
        "badge": "深入学习者"
    },
    "master": {
        "name": "精通",
        "description": "完全掌握并能应用",
        "estimated_time": 60,
        "scene_ratio": 1.0,
        "detail_level": "deep_content",
        "exercises": "advanced",
        "review_required": True,
        "points_multiplier": 1.5,
        "badge": "专家学习者"
    }
}

LEAGUE_RECOMMENDATIONS = {
    "bronze": "skim",
    "silver": "understand",
    "gold": "understand",
    "platinum": "master",
    "diamond": "master",
    "master": "master",
    "champion": "master"
}


# ============ Models ============

class DepthSelection(BaseModel):
    course_id: str
    depth: str  # 'skim', 'understand', 'master'


class DepthProgress(BaseModel):
    course_id: str
    depth: str
    progress_percentage: float
    scenes_completed: int
    total_scenes: int
    estimated_time_remaining: int
    started_at: datetime
    points_multiplier: float


class DepthStats(BaseModel):
    total_courses: int
    by_depth: dict
    avg_completion_rate: float
    preferred_depth: str


# ============ Routes ============

@router.get("/configs")
async def get_depth_configs():
    """Get available depth level configurations."""
    return {
        "depths": [
            {
                "id": k,
                "name": v["name"],
                "description": v["description"],
                "estimated_time": v["estimated_time"],
                "exercises": v["exercises"],
                "points_multiplier": v["points_multiplier"],
                "badge": v["badge"]
            }
            for k, v in DEPTH_CONFIGS.items()
        ]
    }


@router.post("/select")
async def select_depth_level(
    request: DepthSelection,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Select depth level for a course."""
    if request.depth not in DEPTH_CONFIGS:
        raise HTTPException(status_code=400, detail="Invalid depth level")

    # Get course info
    course = await db.fetchrow(
        """
        SELECT s.id, s.name, s.description
        FROM stages s
        WHERE s.id = $1
        """,
        uuid.UUID(request.course_id)
    )

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Get total scenes
    total_scenes = await db.fetchval(
        """
        SELECT COUNT(*) FROM scenes WHERE stage_id = $1
        """,
        uuid.UUID(request.course_id)
    ) or 0

    # Calculate scenes for this depth
    depth_config = DEPTH_CONFIGS[request.depth]
    scenes_for_depth = int(total_scenes * depth_config["scene_ratio"])

    # Create or update depth progress record
    existing = await db.fetchrow(
        """
        SELECT id FROM depth_progress
        WHERE user_id = $1 AND course_id = $2
        """,
        uuid.UUID(user_id),
        uuid.UUID(request.course_id)
    )

    if existing:
        await db.execute(
            """
            UPDATE depth_progress
            SET depth = $2, total_scenes = $3, updated_at = $4
            WHERE id = $1
            """,
            existing["id"],
            request.depth,
            scenes_for_depth,
            datetime.utcnow()
        )
        progress_id = existing["id"]
    else:
        progress_id = await db.fetchval(
            """
            INSERT INTO depth_progress
            (user_id, course_id, depth, total_scenes, started_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            """,
            uuid.UUID(user_id),
            uuid.UUID(request.course_id),
            request.depth,
            scenes_for_depth,
            datetime.utcnow()
        )

    return {
        "success": True,
        "progress_id": str(progress_id),
        "depth": request.depth,
        "scenes_to_complete": scenes_for_depth,
        "estimated_time": depth_config["estimated_time"],
        "points_multiplier": depth_config["points_multiplier"]
    }


@router.get("/recommend/{course_id}")
async def recommend_depth_level(
    course_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Recommend optimal depth level based on user's league tier."""
    # Get user's league tier
    user = await db.fetchrow(
        """
        SELECT league_tier, point_balance FROM users WHERE id = $1
        """,
        uuid.UUID(user_id)
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    league = user["league_tier"] or "bronze"

    # Get course difficulty (if exists)
    course_difficulty = await db.fetchval(
        """
        SELECT difficulty FROM courses WHERE id = $1
        """,
        uuid.UUID(course_id)
    ) or "medium"

    # Get previous depth usage stats
    user_depth_stats = await db.fetchrow(
        """
        SELECT
            COUNT(*) FILTER (WHERE depth = 'skim') as skim_count,
            COUNT(*) FILTER (WHERE depth = 'understand') as understand_count,
            COUNT(*) FILTER (WHERE depth = 'master') as master_count
        FROM depth_progress WHERE user_id = $1
        """,
        uuid.UUID(user_id)
    )

    # Recommend based on league
    base_recommendation = LEAGUE_RECOMMENDATIONS.get(league, "understand")

    # Adjust based on difficulty
    if course_difficulty == "easy" and base_recommendation == "master":
        base_recommendation = "understand"
    elif course_difficulty == "hard" and base_recommendation == "skim":
        base_recommendation = "understand"

    # Adjust based on previous patterns
    if user_depth_stats:
        total = (user_depth_stats["skim_count"] or 0) + \
                (user_depth_stats["understand_count"] or 0) + \
                (user_depth_stats["master_count"] or 0)
        if total > 5:
            # User has pattern, respect it
            if user_depth_stats["master_count"] > total * 0.6:
                base_recommendation = "master"

    return {
        "recommended_depth": base_recommendation,
        "reason": f"基于您的联赛等级({league})推荐{DEPTH_CONFIGS[base_recommendation]['name']}模式",
        "config": DEPTH_CONFIGS[base_recommendation],
        "alternatives": [
            {"depth": k, "name": v["name"]}
            for k, v in DEPTH_CONFIGS.items()
            if k != base_recommendation
        ]
    }


@router.get("/progress/{course_id}")
async def get_depth_progress(
    course_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user's depth progress for a course."""
    progress = await db.fetchrow(
        """
        SELECT dp.id, dp.depth, dp.scenes_completed, dp.total_scenes, dp.started_at
        FROM depth_progress dp
        WHERE dp.user_id = $1 AND dp.course_id = $2
        """,
        uuid.UUID(user_id),
        uuid.UUID(course_id)
    )

    if not progress:
        # No progress, return default
        return {
            "course_id": course_id,
            "depth": None,
            "progress_percentage": 0,
            "scenes_completed": 0,
            "total_scenes": 0,
            "message": "尚未选择学习深度"
        }

    depth_config = DEPTH_CONFIGS.get(progress["depth"], DEPTH_CONFIGS["understand"])
    percentage = (progress["scenes_completed"] / progress["total_scenes"]) * 100 if progress["total_scenes"] > 0 else 0

    return {
        "course_id": course_id,
        "depth": progress["depth"],
        "progress_percentage": round(percentage, 1),
        "scenes_completed": progress["scenes_completed"],
        "total_scenes": progress["total_scenes"],
        "estimated_time_remaining": int(depth_config["estimated_time"] * (1 - percentage / 100)),
        "started_at": progress["started_at"].isoformat(),
        "points_multiplier": depth_config["points_multiplier"]
    }


@router.post("/complete-scene")
async def complete_scene_at_depth(
    course_id: str,
    scene_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Mark a scene as completed at current depth level."""
    # Get user's current depth for this course
    progress = await db.fetchrow(
        """
        SELECT id, depth, scenes_completed, total_scenes
        FROM depth_progress
        WHERE user_id = $1 AND course_id = $2
        """,
        uuid.UUID(user_id),
        uuid.UUID(course_id)
    )

    if not progress:
        raise HTTPException(status_code=400, detail="No depth level selected")

    # Update progress
    new_completed = progress["scenes_completed"] + 1
    await db.execute(
        """
        UPDATE depth_progress
        SET scenes_completed = $2, updated_at = $3
        WHERE id = $1
        """,
        progress["id"],
        new_completed,
        datetime.utcnow()
    )

    # Give points with multiplier
    depth_config = DEPTH_CONFIGS.get(progress["depth"], DEPTH_CONFIGS["understand"])
    base_points = 5  # Base points per scene
    earned_points = int(base_points * depth_config["points_multiplier"])

    await db.execute(
        """
        UPDATE users SET point_balance = point_balance + $2 WHERE id = $1
        """,
        uuid.UUID(user_id),
        earned_points
    )

    # Check if course is complete at this depth
    is_complete = new_completed >= progress["total_scenes"]

    return {
        "success": True,
        "scenes_completed": new_completed,
        "total_scenes": progress["total_scenes"],
        "is_complete": is_complete,
        "earned_points": earned_points,
        "depth": progress["depth"]
    }


@router.get("/stats")
async def get_depth_stats(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user's overall depth learning statistics."""
    stats = await db.fetchrow(
        """
        SELECT
            COUNT(*) as total_courses,
            COUNT(*) FILTER (WHERE depth = 'skim') as skim_count,
            COUNT(*) FILTER (WHERE depth = 'understand') as understand_count,
            COUNT(*) FILTER (WHERE depth = 'master') as master_count,
            AVG(scenes_completed * 1.0 / total_scenes) as avg_completion
        FROM depth_progress WHERE user_id = $1
        """,
        uuid.UUID(user_id)
    )

    # Determine preferred depth
    preferred = "understand"
    if stats:
        counts = {
            "skim": stats["skim_count"] or 0,
            "understand": stats["understand_count"] or 0,
            "master": stats["master_count"] or 0
        }
        preferred = max(counts, key=counts.get)

    return {
        "total_courses": stats["total_courses"] or 0,
        "by_depth": {
            "skim": stats["skim_count"] or 0,
            "understand": stats["understand_count"] or 0,
            "master": stats["master_count"] or 0
        },
        "avg_completion_rate": round((stats["avg_completion"] or 0) * 100, 1),
        "preferred_depth": preferred
    }


@router.put("/change")
async def change_depth_level(
    course_id: str,
    new_depth: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Change depth level for a course (restart with new depth)."""
    if new_depth not in DEPTH_CONFIGS:
        raise HTTPException(status_code=400, detail="Invalid depth level")

    # Get total scenes
    total_scenes = await db.fetchval(
        """
        SELECT COUNT(*) FROM scenes WHERE stage_id = $1
        """,
        uuid.UUID(course_id)
    ) or 0

    depth_config = DEPTH_CONFIGS[new_depth]
    scenes_for_depth = int(total_scenes * depth_config["scene_ratio"])

    # Update existing progress
    await db.execute(
        """
        UPDATE depth_progress
        SET depth = $2, total_scenes = $3, scenes_completed = 0, started_at = $4
        WHERE user_id = $1 AND course_id = $5
        """,
        uuid.UUID(user_id),
        new_depth,
        scenes_for_depth,
        datetime.utcnow(),
        uuid.UUID(course_id)
    )

    return {
        "success": True,
        "new_depth": new_depth,
        "scenes_to_complete": scenes_for_depth,
        "message": f"已切换到{depth_config['name']}模式，进度已重置"
    }