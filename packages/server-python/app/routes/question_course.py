"""Question-driven course generation routes

Generate courses based on user questions or topics.

Workflow:
1. User submits a question/topic
2. AI analyzes and expands into course outline
3. Generate detailed explanation scenes
4. Add practice questions and extensions
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import asyncpg
import uuid
from app.db.database import get_db
from app.middleware.auth import get_current_user_id

router = APIRouter(prefix="/question-course", tags=["question-course"])


class QuestionCourseRequest(BaseModel):
    question: str
    language: str = "zh-CN"
    depth: str = "understand"  # skim, understand, master
    include_practice: bool = True
    target_duration: int = 30  # Target duration in minutes


class CourseOutline(BaseModel):
    title: str
    description: str
    topics: List[dict]


class PracticeQuestion(BaseModel):
    question: str
    type: str  # 'multiple_choice', 'short_answer', 'discussion'
    difficulty: str  # 'easy', 'medium', 'hard'
    answer: Optional[str]


class GeneratedCourse(BaseModel):
    course_id: str
    title: str
    outline: CourseOutline
    practice_questions: List[PracticeQuestion]


# ============ AI Course Generation ============

async def analyze_question_and_generate_outline(
    question: str,
    depth: str = "understand",
    language: str = "zh-CN"
) -> dict:
    """Use AI to analyze question and generate course outline."""
    # In production, call Claude/OpenAI API
    # For now, return structured mock response

    # Simulate AI analysis
    keywords = extract_keywords(question)

    # Generate outline based on depth
    topic_count = {"skim": 3, "understand": 5, "master": 8}[depth]

    topics = []
    for i in range(topic_count):
        topics.append({
            "title": f"知识点{i+1}: {keywords[i % len(keywords)]}",
            "content": f"详细讲解{keywords[i % len(keywords)]}的概念和应用",
            "key_points": [
                f"要点1: {keywords[i % len(keywords)]}的定义",
                f"要点2: {keywords[i % len(keywords)]}的特点",
                f"要点3: {keywords[i % len(keywords)]}的应用场景",
            ],
            "examples": [
                f"示例: {keywords[i % len(keywords)]}在实际中的应用",
            ],
        })

    return {
        "title": f"课程: {question}",
        "description": f"针对问题「{question}」的详细讲解课程",
        "topics": topics,
    }


def extract_keywords(question: str) -> List[str]:
    """Extract keywords from question for course generation."""
    # Simple keyword extraction (in production, use NLP or AI)
    words = question.replace('?', ' ').replace('？', ' ').replace(',', ' ').split()
    keywords = []

    # Filter meaningful words (length > 2)
    for word in words:
        if len(word) > 2 and word not in ['如何', '怎么', '什么', '为什么', '怎样']:
            keywords.append(word)

    # Default keywords if none extracted
    if not keywords:
        keywords = ['概念', '原理', '应用', '方法', '实践']

    return keywords


async def generate_practice_questions(
    outline: dict,
    count: int = 5,
    language: str = "zh-CN"
) -> List[dict]:
    """Generate practice questions based on course outline."""
    # In production, use AI to generate relevant questions

    questions = []
    topics = outline.get("topics", [])

    for i, topic in enumerate(topics[:count]):
        # Generate different question types
        if i % 3 == 0:
            questions.append({
                "question": f"关于{topic['title']}，以下哪个说法是正确的？",
                "type": "multiple_choice",
                "difficulty": "easy",
                "options": ["选项A", "选项B", "选项C", "选项D"],
                "answer": "选项A",
            })
        elif i % 3 == 1:
            questions.append({
                "question": f"请简要说明{topic['title']}的核心概念。",
                "type": "short_answer",
                "difficulty": "medium",
                "answer": f"{topic['title']}的核心概念是...",
            })
        else:
            questions.append({
                "question": f"讨论{topic['title']}在实际场景中的应用。",
                "type": "discussion",
                "difficulty": "hard",
                "answer": None,
            })

    return questions


async def create_course_from_outline(
    user_id: str,
    outline: dict,
    practice_questions: List[dict],
    db: asyncpg.Connection
) -> str:
    """Create course database records from generated outline."""
    # Create course
    course_id = await db.fetchval(
        """
        INSERT INTO stages (user_id, name, description, created_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """,
        uuid.UUID(user_id),
        outline["title"],
        outline["description"],
        datetime.utcnow()
    )

    # Create scenes for each topic
    for i, topic in enumerate(outline.get("topics", [])):
        scene_id = await db.fetchval(
            """
            INSERT INTO scenes (stage_id, name, position, created_at)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            """,
            course_id,
            topic["title"],
            i + 1,
            datetime.utcnow()
        )

        # Store key points and examples as scene content
        # In production, generate actual slide content

    # Store practice questions
    # Could use a separate questions table

    return str(course_id)


# ============ Routes ============

@router.post("/generate", response_model=GeneratedCourse)
async def generate_course_from_question(
    request: QuestionCourseRequest,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Generate a course from user question."""
    if len(request.question) < 5:
        raise HTTPException(status_code=400, detail="Question too short")

    # Generate outline
    outline = await analyze_question_and_generate_outline(
        request.question,
        request.depth,
        request.language
    )

    # Generate practice questions if requested
    practice = []
    if request.include_practice:
        practice = await generate_practice_questions(
            outline,
            min(len(outline["topics"]), 5),
            request.language
        )

    # Create course
    course_id = await create_course_from_outline(
        user_id,
        outline,
        practice,
        db
    )

    return GeneratedCourse(
        course_id=course_id,
        title=outline["title"],
        outline=CourseOutline(**outline),
        practice_questions=[PracticeQuestion(**q) for q in practice]
    )


@router.post("/preview")
async def preview_course_outline(
    request: QuestionCourseRequest
):
    """Preview course outline without creating course."""
    outline = await analyze_question_and_generate_outline(
        request.question,
        request.depth,
        request.language
    )

    practice = []
    if request.include_practice:
        practice = await generate_practice_questions(
            outline,
            min(len(outline["topics"]), 5),
            request.language
        )

    return {
        "outline": outline,
        "practice_questions": practice,
        "estimated_duration": len(outline["topics"]) * 5,  # 5 min per topic
    }


@router.get("/examples")
async def get_question_examples():
    """Get example questions for course generation."""
    return {
        "examples": [
            {"question": "如何理解机器学习中的梯度下降？", "category": "技术"},
            {"question": "什么是异步编程？为什么需要异步？", "category": "技术"},
            {"question": "如何进行有效的项目管理？", "category": "管理"},
            {"question": "区块链的核心原理是什么？", "category": "技术"},
            {"question": "怎样培养良好的阅读习惯？", "category": "生活"},
            {"question": "Python装饰器的原理和应用场景", "category": "编程"},
        ],
        "categories": ["技术", "编程", "管理", "生活", "学习"]
    }


@router.get("/history")
async def get_generation_history(
    limit: int = Query(20, le=50),
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user's question-driven course generation history."""
    # Query courses that were generated from questions
    courses = await db.fetch(
        """
        SELECT s.id, s.name, s.description, s.created_at
        FROM stages s
        WHERE s.user_id = $1 AND s.description LIKE '%针对问题%'
        ORDER BY s.created_at DESC
        LIMIT $2
        """,
        uuid.UUID(user_id),
        limit
    )

    return {
        "courses": [
            {
                "id": str(c["id"]),
                "title": c["name"],
                "description": c["description"],
                "created_at": c["created_at"].isoformat()
            }
            for c in courses
        ]
    }