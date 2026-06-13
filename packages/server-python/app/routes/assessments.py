"""Learning Assessment System - Measure knowledge mastery after course completion

Implements断裂点4修复: 学习效果测评，量化知识掌握度

Workflow:
1. Course completion triggers assessment generation
2. AI generates questions based on course content
3. User takes assessment
4. Results analyzed, mastery level calculated
5. Recommendations for review or next courses
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from app.core.time_utils import utcnow
import asyncpg
import uuid
import json
from app.db.database import get_db
from app.middleware.auth import get_current_user_id

router = APIRouter(prefix="/assessments", tags=["learning-assessments"])


# ============ Assessment Types ============

ASSESSMENT_TYPES = {
    "quick": {
        "name": "快速测评",
        "duration_minutes": 5,
        "questions_count": 5,
        "difficulty": "basic",
        "description": "快速检查核心知识点掌握"
    },
    "standard": {
        "name": "标准测评",
        "duration_minutes": 15,
        "questions_count": 10,
        "difficulty": "mixed",
        "description": "全面评估知识理解程度"
    },
    "deep": {
        "name": "深度测评",
        "duration_minutes": 30,
        "questions_count": 20,
        "difficulty": "advanced",
        "description": "深入测试应用和分析能力"
    }
}


# ============ Models ============

class AssessmentRequest(BaseModel):
    course_id: str
    assessment_type: str = "standard"


class AssessmentAnswer(BaseModel):
    assessment_id: str
    answers: List[dict]  # [{question_id, answer}]


class AssessmentResult(BaseModel):
    assessment_id: str
    course_id: str
    score: float
    mastery_level: str
    passed: bool
    correct_count: int
    total_questions: int
    time_spent: int
    recommendations: List[dict]


# ============ Question Generation ============

async def generate_assessment_questions(
    course_id: str,
    assessment_type: str,
    db: asyncpg.Connection
) -> List[dict]:
    """Generate assessment questions for a course."""
    # Get course content/keywords
    course = await db.fetchrow(
        """
        SELECT s.id, s.name, s.description FROM stages s WHERE s.id = $1
        """,
        uuid.UUID(course_id)
    )

    config = ASSESSMENT_TYPES.get(assessment_type, ASSESSMENT_TYPES["standard"])

    # In production, call AI to generate questions based on course content
    # For now, generate mock questions

    questions = []
    for i in range(config["questions_count"]):
        difficulty = "easy" if i < config["questions_count"] // 3 else \
                     "medium" if i < 2 * config["questions_count"] // 3 else "hard"

        question = {
            "id": f"q_{i}",
            "type": "multiple_choice",
            "content": f"{course['name']}: 问题{i+1} - 测试知识点掌握情况",
            "options": ["选项A", "选项B", "选项C", "选项D"],
            "correct_answer": "A",
            "difficulty": difficulty,
            "points": 10 if difficulty == "easy" else 15 if difficulty == "medium" else 20,
            "explanation": "这是正确答案的解释"
        }
        questions.append(question)

    return questions


async def analyze_assessment_results(
    answers: List[dict],
    questions: List[dict]
) -> dict:
    """Analyze answers and calculate mastery level."""
    correct_count = 0
    total_points = 0
    earned_points = 0

    for answer in answers:
        question = next((q for q in questions if q["id"] == answer["question_id"]), None)
        if question and answer["answer"] == question["correct_answer"]:
            correct_count += 1
            earned_points += question["points"]

    for q in questions:
        total_points += q["points"]

    score = (earned_points / total_points * 100) if total_points > 0 else 0

    # Determine mastery level
    if score >= 90:
        mastery = "精通"
    elif score >= 75:
        mastery = "熟练"
    elif score >= 60:
        mastery = "掌握"
    elif score >= 40:
        mastery = "了解"
    else:
        mastery = "需复习"

    return {
        "score": round(score, 1),
        "mastery_level": mastery,
        "passed": score >= 60,
        "correct_count": correct_count,
        "total_questions": len(questions),
        "earned_points": earned_points
    }


async def generate_recommendations_from_result(
    result: dict,
    course_id: str,
    db: asyncpg.Connection
) -> List[dict]:
    """Generate learning recommendations based on assessment result."""
    recommendations = []

    if result["score"] < 60:
        # Need review
        recommendations.append({
            "type": "review",
            "title": "建议复习课程",
            "description": "部分知识点掌握不牢固，建议重新学习",
            "action": "review_course",
            "course_id": course_id
        })
    elif result["score"] >= 90:
        # Can advance
        recommendations.append({
            "type": "advance",
            "title": "可以学习进阶内容",
            "description": "掌握程度优秀，推荐学习相关进阶课程",
            "action": "view_recommendations"
        })

    if result["mastery_level"] in ["掌握", "了解", "需复习"]:
        recommendations.append({
            "type": "practice",
            "title": "建议多做练习",
            "description": "通过练习巩固知识",
            "action": "start_practice"
        })

    return recommendations


# ============ Routes ============

@router.post("/create")
async def create_assessment(
    request: AssessmentRequest,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Create assessment for a completed course."""
    user_uuid = uuid.UUID(user_id)
    course_uuid = uuid.UUID(request.course_id)

    # Verify course completion
    completion = await db.fetchrow(
        """
        SELECT id, completed_at FROM course_completions
        WHERE user_id = $1 AND course_id = $2
        """,
        user_uuid, course_uuid
    )

    if not completion:
        raise HTTPException(status_code=400, detail="Course not completed yet")

    config = ASSESSMENT_TYPES.get(request.assessment_type, ASSESSMENT_TYPES["standard"])

    # Generate questions
    questions = await generate_assessment_questions(request.course_id, request.assessment_type, db)

    # Create assessment record
    assessment_id = uuid.uuid4()
    expires_at = utcnow() + timedelta(minutes=config["duration_minutes"] * 2)

    await db.execute(
        """
        INSERT INTO learning_assessments
        (id, user_id, course_id, assessment_type, questions, duration_minutes,
         expires_at, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
        """,
        assessment_id, user_uuid, course_uuid, request.assessment_type,
        json.dumps(questions), config["duration_minutes"],
        expires_at, utcnow()
    )

    return {
        "assessment_id": str(assessment_id),
        "course_id": request.course_id,
        "assessment_type": request.assessment_type,
        "config": config,
        "questions": questions,
        "expires_at": expires_at.isoformat(),
        "message": f"测评已创建，限时{config['duration_minutes']}分钟"
    }


@router.get("/{assessment_id}")
async def get_assessment(
    assessment_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get assessment details."""
    assessment = await db.fetchrow(
        """
        SELECT id, user_id, course_id, assessment_type, questions, duration_minutes,
               expires_at, status, created_at
        FROM learning_assessments WHERE id = $1
        """,
        uuid.UUID(assessment_id)
    )

    if not assessment or str(assessment["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Assessment not found")

    config = ASSESSMENT_TYPES[assessment["assessment_type"]]
    questions = json.loads(assessment["questions"])

    # Hide correct answers for pending assessments
    if assessment["status"] == "pending":
        for q in questions:
            del q["correct_answer"]
            del q["explanation"]

    return {
        "assessment_id": str(assessment["id"]),
        "course_id": str(assessment["course_id"]),
        "assessment_type": assessment["assessment_type"],
        "config": config,
        "questions": questions,
        "duration_minutes": assessment["duration_minutes"],
        "expires_at": assessment["expires_at"].isoformat(),
        "status": assessment["status"],
        "time_remaining": max(0, int((assessment["expires_at"] - utcnow()).total_seconds() / 60))
    }


@router.post("/submit")
async def submit_assessment(
    request: AssessmentAnswer,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Submit assessment answers and get results."""
    assessment = await db.fetchrow(
        """
        SELECT id, user_id, course_id, questions, status, expires_at
        FROM learning_assessments WHERE id = $1
        """,
        uuid.UUID(request.assessment_id)
    )

    if not assessment or str(assessment["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if assessment["status"] != "pending":
        raise HTTPException(status_code=400, detail="Assessment already submitted")

    if utcnow() > assessment["expires_at"]:
        raise HTTPException(status_code=400, detail="Assessment expired")

    questions = json.loads(assessment["questions"])

    # Analyze results
    result = await analyze_assessment_results(request.answers, questions)

    # Generate recommendations
    recommendations = await generate_recommendations_from_result(
        result, str(assessment["course_id"]), db
    )

    # Calculate time spent (approximate)
    now = utcnow()
    created = assessment.get("created_at", now)
    time_spent = int((now - created).total_seconds() / 60) if created else 5

    # Update assessment record
    await db.execute(
        """
        UPDATE learning_assessments
        SET status = 'completed', score = $1, mastery_level = $2, passed = $3,
            correct_count = $4, time_spent_minutes = $5, completed_at = $6,
            answers = $7, recommendations = $8
        WHERE id = $9
        """,
        result["score"], result["mastery_level"], result["passed"],
        result["correct_count"], time_spent, now,
        json.dumps(request.answers), json.dumps(recommendations),
        assessment["id"]
    )

    # Award points (uses gamification_events.grant_points which writes to
    # point_accounts — the correct ledger location, see token-ledger-schema.md)
    from app.services.gamification_events import grant_points
    base_points = 10
    bonus = int(result["score"] / 10)  # 1 point per 10% score
    total_points = base_points + bonus
    await grant_points(
        db, uuid.UUID(user_id), total_points,
        source="assessment",
        context={"assessment_id": request.assessment_id, "score": result["score"]},
    )

    # Update course completion mastery level
    await db.execute(
        """
        UPDATE course_completions SET mastery_level = $2
        WHERE user_id = $1 AND course_id = $3
        """,
        uuid.UUID(user_id),
        result["mastery_level"],
        assessment["course_id"]
    )

    # 触发成长体系事件（自动打卡+测验任务+积分）
    from app.services.gamification_events import record_learning_activity
    user_uuid = uuid.UUID(user_id)
    gamification_result = await record_learning_activity(
        db, user_uuid, "quiz", value=1, user_id=user_id,
        context={"assessment_id": request.assessment_id, "score": result["score"]}
    )

    return {
        "assessment_id": str(assessment["id"]),
        "course_id": str(assessment["course_id"]),
        "score": result["score"],
        "mastery_level": result["mastery_level"],
        "passed": result["passed"],
        "correct_count": result["correct_count"],
        "total_questions": len(questions),
        "time_spent": time_spent,
        "recommendations": recommendations,
        "earned_points": total_points,
        "gamification": gamification_result,
        "message": f"测评完成，掌握程度：{result['mastery_level']}"
    }


@router.get("/results/{course_id}")
async def get_course_assessment_results(
    course_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get all assessment results for a course."""
    results = await db.fetch(
        """
        SELECT id, assessment_type, score, mastery_level, passed, correct_count,
               time_spent_minutes, completed_at, status
        FROM learning_assessments
        WHERE user_id = $1 AND course_id = $2
        ORDER BY completed_at DESC
        """,
        uuid.UUID(user_id),
        uuid.UUID(course_id)
    )

    return {
        "results": [
            {
                "assessment_id": str(r["id"]),
                "assessment_type": r["assessment_type"],
                "score": r["score"],
                "mastery_level": r["mastery_level"],
                "passed": r["passed"],
                "correct_count": r["correct_count"],
                "time_spent": r["time_spent_minutes"],
                "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
                "status": r["status"]
            }
            for r in results
        ]
    }


@router.get("/stats")
async def get_assessment_stats(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user's assessment statistics."""
    stats = await db.fetchrow(
        """
        SELECT
            COUNT(*) as total_assessments,
            COUNT(*) FILTER (WHERE passed = true) as passed_count,
            AVG(score) as avg_score,
            COUNT(*) FILTER (WHERE mastery_level = '精通') as mastery_count,
            COUNT(*) FILTER (WHERE mastery_level = '熟练') as proficient_count,
            AVG(time_spent_minutes) as avg_time
        FROM learning_assessments WHERE user_id = $1 AND status = 'completed'
        """,
        uuid.UUID(user_id)
    )

    return {
        "total_assessments": stats["total_assessments"] or 0,
        "passed_count": stats["passed_count"] or 0,
        "pass_rate": round((stats["passed_count"] or 0) / max(stats["total_assessments"] or 1, 1) * 100, 1),
        "avg_score": round(stats["avg_score"] or 0, 1),
        "mastery_distribution": {
            "精通": stats["mastery_count"] or 0,
            "熟练": stats["proficient_count"] or 0
        },
        "avg_time_minutes": round(stats["avg_time"] or 0, 1)
    }


@router.get("/types")
async def get_assessment_types():
    """Get available assessment types."""
    return {
        "types": [
            {
                "id": k,
                "name": v["name"],
                "duration_minutes": v["duration_minutes"],
                "questions_count": v["questions_count"],
                "difficulty": v["difficulty"],
                "description": v["description"]
            }
            for k, v in ASSESSMENT_TYPES.items()
        ]
    }