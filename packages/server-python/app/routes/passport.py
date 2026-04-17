"""
学习护照路由 - 技能认证、项目作品集、能力雷达图
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
import asyncpg
import uuid
from datetime import datetime
from typing import Optional, List
import json

router = APIRouter()


# ==================== 技能类别定义 ====================

SKILL_CATEGORIES = {
    "programming": {"name": "编程开发", "icon": "💻", "color": "#5b9bd5"},
    "data": {"name": "数据分析", "icon": "📊", "color": "#4CAF50"},
    "business": {"name": "商业策略", "icon": "📈", "color": "#FF9800"},
    "language": {"name": "语言学习", "icon": "🌐", "color": "#9C27B0"},
    "design": {"name": "设计创作", "icon": "🎨", "color": "#E91E63"},
    "math": {"name": "数学逻辑", "icon": "🔢", "color": "#3F51B5"},
    "science": {"name": "科学知识", "icon": "🔬", "color": "#00BCD4"},
}

LEVEL_NAMES = {
    1: "入门",
    2: "基础",
    3: "进阶",
    4: "精通",
    5: "专家",
}


# ==================== 学习护照 ====================

@router.get("/me")
async def get_my_passport(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取我的学习护照"""
    user_uuid = uuid.UUID(current_user_id)

    # 获取用户基本信息
    user = await db.fetchrow(
        "SELECT nickname, avatar_url, created_at FROM users WHERE id = $1",
        user_uuid
    )

    # 获取技能护照
    passports = await db.fetch(
        """
        SELECT id, skill_name, skill_category, skill_level, courses_completed,
               projects_completed, total_time_hours, quiz_avg_score,
               review_completion_rate, verified, badges, created_at
        FROM learning_passports WHERE user_id = $1
        ORDER BY skill_level DESC, updated_at DESC
        """,
        user_uuid
    )

    # 获取学习统计
    total_courses = await db.fetchval(
        "SELECT COUNT(*) FROM course_completions WHERE user_id = $1",
        user_uuid
    ) or 0

    total_time = await db.fetchval(
        """
        SELECT COALESCE(SUM(time_spent_minutes), 0) +
               COALESCE(SUM(total_time_hours * 60), 0)
        FROM (
            SELECT time_spent_minutes FROM course_completions WHERE user_id = $1
            UNION ALL
            SELECT total_time_hours * 60 FROM learning_passports WHERE user_id = $1
        ) subq
        """,
        user_uuid
    ) or 0

    # 连续打卡天数
    streak_info = await db.fetchrow(
        """
        SELECT current_streak, max_streak FROM users WHERE id = $1
        """,
        user_uuid
    )

    # 联赛等级
    league = await db.fetchrow(
        """
        SELECT tier, name, icon FROM subscriptions WHERE user_id = $1
        """,
        user_uuid
    )

    # 构建能力雷达图数据
    radar_data = {}
    for cat_id, cat_info in SKILL_CATEGORIES.items():
        skills_in_cat = [p for p in passports if p["skill_category"] == cat_id]
        if skills_in_cat:
            avg_level = sum(s["skill_level"] for s in skills_in_cat) / len(skills_in_cat)
            radar_data[cat_id] = {
                "name": cat_info["name"],
                "value": avg_level * 20,  # 转换为百分比
                "level": avg_level,
            }
        else:
            radar_data[cat_id] = {
                "name": cat_info["name"],
                "value": 0,
                "level": 0,
            }

    # 项目作品数
    portfolio_count = await db.fetchval(
        "SELECT COUNT(*) FROM project_portfolios WHERE user_id = $1",
        user_uuid
    ) or 0

    return {
        "user": {
            "nickname": user["nickname"] or "学习者",
            "avatar_url": user["avatar_url"],
            "registered_at": user["created_at"].isoformat(),
        },
        "skills": [
            {
                "id": str(p["id"]),
                "name": p["skill_name"],
                "category": p["skill_category"],
                "category_name": SKILL_CATEGORIES.get(p["skill_category"], {}).get("name", "其他"),
                "level": p["skill_level"],
                "level_name": LEVEL_NAMES.get(p["skill_level"], "入门"),
                "stars": "⭐" * p["skill_level"],
                "courses": p["courses_completed"],
                "projects": p["projects_completed"],
                "hours": round(p["total_time_hours"], 1),
                "verified": p["verified"],
                "badges": p["badges"].split(",") if p["badges"] else [],
            }
            for p in passports
        ],
        "statistics": {
            "total_courses": total_courses,
            "total_skills": len(passports),
            "total_hours": round(total_time / 60, 1),
            "streak_days": streak_info["current_streak"] if streak_info else 0,
            "max_streak": streak_info["max_streak"] if streak_info else 0,
            "portfolio_count": portfolio_count,
        },
        "radar_chart": radar_data,
        "league": {
            "tier": league["tier"] if league else "bronze",
            "name": league["name"] if league else "铜牌",
            "icon": league["icon"] if league else "🥉",
        },
    }


@router.post("/skills")
async def add_or_update_skill(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """添加或更新技能"""
    user_uuid = uuid.UUID(current_user_id)

    skill_name = body.get("skill_name", "").strip()
    skill_category = body.get("skill_category", "programming")

    if not skill_name:
        raise HTTPException(status_code=400, detail="技能名称不能为空")

    if skill_category not in SKILL_CATEGORIES:
        raise HTTPException(status_code=400, detail="无效的技能类别")

    # 检查是否已有此技能
    existing = await db.fetchrow(
        """
        SELECT id, skill_level, courses_completed FROM learning_passports
        WHERE user_id = $1 AND skill_name = $2
        """,
        user_uuid, skill_name
    )

    now = datetime.utcnow()

    if existing:
        # 更新技能（增加课程数）
        new_courses = existing["courses_completed"] + 1
        # 计算新等级：每完成3门课程升一级，最高5级
        new_level = min(5, (new_courses // 3) + 1)

        await db.execute(
            """
            UPDATE learning_passports
            SET courses_completed = $1, skill_level = $2, updated_at = $3
            WHERE id = $4
            """,
            new_courses, new_level, now, existing["id"]
        )

        passport_id = existing["id"]
        level_changed = new_level > existing["skill_level"]
    else:
        # 创建新技能
        passport_id = uuid.uuid4()
        await db.execute(
            """
            INSERT INTO learning_passports
            (id, user_id, skill_name, skill_category, skill_level, courses_completed,
             projects_completed, total_time_hours, verified, created_at)
            VALUES ($1, $2, $3, $4, 1, 1, 0, 0, FALSE, $5)
            """,
            passport_id, user_uuid, skill_name, skill_category, now
        )
        level_changed = False

    return {
        "passport_id": str(passport_id),
        "skill_name": skill_name,
        "category": skill_category,
        "category_name": SKILL_CATEGORIES[skill_category]["name"],
        "level": new_level if existing else 1,
        "level_name": LEVEL_NAMES.get(new_level if existing else 1, "入门"),
        "level_changed": level_changed,
        "message": "技能已更新" + (f"，升级到 {LEVEL_NAMES[new_level]}" if level_changed else ""),
    }


@router.get("/skills/{skill_name}/assess")
async def assess_skill(
    skill_name: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """评估技能等级"""
    user_uuid = uuid.UUID(current_user_id)

    passport = await db.fetchrow(
        """
        SELECT id, skill_level, courses_completed, projects_completed,
               quiz_avg_score, review_completion_rate
        FROM learning_passports WHERE user_id = $1 AND skill_name = $2
        """,
        user_uuid, skill_name
    )

    if not passport:
        raise HTTPException(status_code=404, detail="技能不存在")

    # 综合评分算法
    courses_score = min(30, passport["courses_completed"] * 10)  # 课程完成度
    projects_score = min(20, passport["projects_completed"] * 5)  # 项目完成度
    quiz_score = (passport["quiz_avg_score"] or 70) / 100 * 30  # 测验平均分
    review_score = (passport["review_completion_rate"] or 50) / 100 * 20  # 复习完成率

    total_score = courses_score + projects_score + quiz_score + review_score

    # 根据综合分数计算等级
    recommended_level = 1
    if total_score >= 80:
        recommended_level = 5
    elif total_score >= 60:
        recommended_level = 4
    elif total_score >= 45:
        recommended_level = 3
    elif total_score >= 25:
        recommended_level = 2

    # 创建评估记录
    assessment_id = uuid.uuid4()
    now = datetime.utcnow()

    await db.execute(
        """
        INSERT INTO skill_assessments
        (id, user_id, skill_name, assessment_type, score, level_before,
         level_after, passed, details, assessed_at, created_at)
        VALUES ($1, $2, $3, 'ai_evaluation', $4, $5, $6, $7, $8, $9, $10)
        """,
        assessment_id, user_uuid, skill_name, total_score,
        passport["skill_level"], recommended_level,
        recommended_level >= passport["skill_level"],
        json.dumps({
            "courses_score": courses_score,
            "projects_score": projects_score,
            "quiz_score": quiz_score,
            "review_score": review_score,
        }),
        now, now
    )

    return {
        "skill_name": skill_name,
        "current_level": passport["skill_level"],
        "current_level_name": LEVEL_NAMES.get(passport["skill_level"], "入门"),
        "recommended_level": recommended_level,
        "recommended_level_name": LEVEL_NAMES.get(recommended_level, "入门"),
        "score": round(total_score, 1),
        "breakdown": {
            "courses": round(courses_score, 1),
            "projects": round(projects_score, 1),
            "quiz": round(quiz_score, 1),
            "review": round(review_score, 1),
        },
        "can_upgrade": recommended_level > passport["skill_level"],
        "assessment_id": str(assessment_id),
    }


# ==================== 项目作品集 ====================

@router.get("/portfolios")
async def get_my_portfolios(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取我的项目作品集"""
    user_uuid = uuid.UUID(current_user_id)

    portfolios = await db.fetch(
        """
        SELECT id, stage_id, project_name, project_type, description,
               content_url, thumbnail_url, tags, rating, ai_feedback,
               is_public, view_count, like_count, created_at
        FROM project_portfolios WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        user_uuid
    )

    return {
        "portfolios": [
            {
                "id": str(p["id"]),
                "project_name": p["project_name"],
                "type": p["project_type"],
                "description": p["description"],
                "url": p["content_url"],
                "thumbnail": p["thumbnail_url"],
                "tags": p["tags"].split(",") if p["tags"] else [],
                "rating": p["rating"],
                "ai_feedback": p["ai_feedback"],
                "is_public": p["is_public"],
                "view_count": p["view_count"],
                "like_count": p["like_count"],
                "created_at": p["created_at"].isoformat(),
            }
            for p in portfolios
        ],
        "total": len(portfolios),
        "public_count": len([p for p in portfolios if p["is_public"]]),
    }


@router.post("/portfolios")
async def create_portfolio(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """创建项目作品"""
    user_uuid = uuid.UUID(current_user_id)

    project_name = body.get("project_name", "").strip()
    project_type = body.get("project_type", "document")
    description = body.get("description", "")
    content_url = body.get("content_url", "")
    thumbnail_url = body.get("thumbnail_url")
    tags = body.get("tags", [])
    is_public = body.get("is_public", True)
    stage_id = body.get("stage_id")

    if not project_name:
        raise HTTPException(status_code=400, detail="项目名称不能为空")

    portfolio_id = uuid.uuid4()
    now = datetime.utcnow()

    await db.execute(
        """
        INSERT INTO project_portfolios
        (id, user_id, stage_id, project_name, project_type, description,
         content_url, thumbnail_url, tags, is_public, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        """,
        portfolio_id, user_uuid,
        uuid.UUID(stage_id) if stage_id else None,
        project_name, project_type, description,
        content_url, thumbnail_url,
        ",".join(tags) if tags else None,
        is_public, now
    )

    # 更新技能护照的项目数
    if tags:
        for tag in tags[:3]:  # 取前3个标签作为技能
            passport = await db.fetchrow(
                """
                SELECT id, projects_completed FROM learning_passports
                WHERE user_id = $1 AND skill_name = $2
                """,
                user_uuid, tag
            )
            if passport:
                await db.execute(
                    """
                    UPDATE learning_passports
                    SET projects_completed = $1, updated_at = $2
                    WHERE id = $3
                    """,
                    passport["projects_completed"] + 1, now, passport["id"]
                )

    return {
        "portfolio_id": str(portfolio_id),
        "project_name": project_name,
        "type": project_type,
        "is_public": is_public,
        "message": "项目作品已创建",
    }


@router.get("/portfolios/public")
async def get_public_portfolios(
    page: int = 1,
    limit: int = 20,
    skill: str = None,
    db: asyncpg.Connection = Depends(get_db)
):
    """获取公开作品集"""
    offset = (page - 1) * limit

    if skill:
        rows = await db.fetch(
            """
            SELECT p.id, p.project_name, p.project_type, p.description,
                   p.thumbnail_url, p.tags, p.rating, p.view_count, p.like_count,
                   u.nickname, u.avatar_url, p.created_at
            FROM project_portfolios p
            JOIN users u ON u.id = p.user_id
            WHERE p.is_public = TRUE AND p.tags LIKE '%' || $1 || '%'
            ORDER BY p.like_count DESC, p.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            skill, limit, offset
        )
    else:
        rows = await db.fetch(
            """
            SELECT p.id, p.project_name, p.project_type, p.description,
                   p.thumbnail_url, p.tags, p.rating, p.view_count, p.like_count,
                   u.nickname, u.avatar_url, p.created_at
            FROM project_portfolios p
            JOIN users u ON u.id = p.user_id
            WHERE p.is_public = TRUE
            ORDER BY p.like_count DESC, p.created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset
        )

    return {
        "portfolios": [
            {
                "id": str(row["id"]),
                "project_name": row["project_name"],
                "type": row["project_type"],
                "description": row["description"],
                "thumbnail": row["thumbnail_url"],
                "tags": row["tags"].split(",") if row["tags"] else [],
                "rating": row["rating"],
                "author": {
                    "nickname": row["nickname"],
                    "avatar": row["avatar_url"],
                },
                "view_count": row["view_count"],
                "like_count": row["like_count"],
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ],
        "page": page,
        "limit": limit,
    }


@router.post("/portfolios/{portfolio_id}/like")
async def like_portfolio(
    portfolio_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """点赞作品"""
    portfolio_uuid = uuid.UUID(portfolio_id)

    await db.execute(
        """
        UPDATE project_portfolios SET like_count = like_count + 1 WHERE id = $1
        """,
        portfolio_uuid
    )

    return {"message": "已点赞"}