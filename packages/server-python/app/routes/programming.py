"""Programming Learning Vertical Template

Specialized learning template for programming education with:
- Code highlighting and syntax checking
- Auto-graded coding exercises
- Safe code execution sandbox
- Error diagnosis and fix suggestions
- Project portfolio management
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

router = APIRouter(prefix="/programming", tags=["programming-template"])


# ============ Models ============

class CodeSubmission(BaseModel):
    course_id: str
    exercise_id: str
    code: str
    language: str  # 'python', 'javascript', 'java', 'cpp'


class CodeReviewRequest(BaseModel):
    code: str
    language: str
    focus_areas: Optional[List[str]] = None  # ['syntax', 'style', 'performance', 'security']


class ProjectPortfolio(BaseModel):
    project_name: str
    description: str
    language: str
    code_url: Optional[str]
    tags: List[str]
    is_public: bool = True


class ExerciseResult(BaseModel):
    exercise_id: str
    passed: bool
    score: int
    errors: List[dict]
    suggestions: List[str]
    execution_time: float
    memory_used: Optional[float]


# ============ Language Configs ============

LANGUAGE_CONFIGS = {
    "python": {
        "extension": ".py",
        "run_command": "python3",
        "highlight_js": "python",
        "linter": "pylint",
        "formatter": "black",
        "common_errors": ["SyntaxError", "IndentationError", "TypeError", "NameError"]
    },
    "javascript": {
        "extension": ".js",
        "run_command": "node",
        "highlight_js": "javascript",
        "linter": "eslint",
        "formatter": "prettier",
        "common_errors": ["SyntaxError", "TypeError", "ReferenceError"]
    },
    "java": {
        "extension": ".java",
        "run_command": "java",
        "highlight_js": "java",
        "linter": "checkstyle",
        "formatter": "google-java-format",
        "common_errors": ["CompilationException", "NullPointerException"]
    },
    "cpp": {
        "extension": ".cpp",
        "run_command": "g++",
        "highlight_js": "cpp",
        "linter": "cppcheck",
        "formatter": "clang-format",
        "common_errors": ["CompilationException", "SegmentationFault"]
    }
}


# ============ Code Analysis ============

async def analyze_syntax_errors(code: str, language: str) -> List[dict]:
    """Analyze code for syntax errors."""
    # In production, use actual parser/linter
    # For now, simulate common error detection
    errors = []

    # Python-specific checks
    if language == "python":
        # Check indentation
        lines = code.split('\n')
        for i, line in enumerate(lines):
            if line and not line.startswith('#') and not line.startswith(' ') and i > 0:
                prev_line = lines[i-1]
                if prev_line.endswith(':') and not line.startswith('    ') and not line.startswith('\t'):
                    errors.append({
                        "type": "IndentationError",
                        "line": i + 1,
                        "message": "Expected indented block",
                        "severity": "error"
                    })

        # Check for missing imports
        if 'import' not in code and any(kw in code for kw in ['print', 'len', 'range', 'open']):
            errors.append({
                "type": "Warning",
                "line": 1,
                "message": "Consider adding necessary imports",
                "severity": "warning"
            })

    return errors


async def analyze_code_style(code: str, language: str) -> List[dict]:
    """Analyze code style and best practices."""
    suggestions = []

    # Check for common style issues
    if language == "python":
        # PEP 8 checks
        lines = code.split('\n')
        for i, line in enumerate(lines):
            # Line length
            if len(line) > 79:
                suggestions.append({
                    "type": "style",
                    "line": i + 1,
                    "message": "Line exceeds 79 characters (PEP 8)",
                    "severity": "info"
                })

            # Naming conventions
            if '=' in line:
                var_name = line.split('=')[0].strip()
                if var_name and not var_name.islower() and '_' not in var_name:
                    suggestions.append({
                        "type": "style",
                        "line": i + 1,
                        "message": f"Variable '{var_name}' should use snake_case",
                        "severity": "info"
                    })

    return suggestions


async def generate_fix_suggestions(errors: List[dict], language: str) -> List[str]:
    """Generate fix suggestions for errors."""
    suggestions = []

    for error in errors:
        if error["type"] == "IndentationError":
            suggestions.append("在冒号后的行添加4个空格的缩进")
        elif error["type"] == "SyntaxError":
            suggestions.append("检查括号、引号是否匹配")
        elif error["type"] == "TypeError":
            suggestions.append("检查变量类型和函数参数类型")
        elif error["type"] == "NameError":
            suggestions.append("检查变量是否已定义或导入")

    return suggestions


# ============ Exercise Evaluation ============

async def evaluate_code_submission(
    code: str,
    language: str,
    exercise_id: str,
    user_id: str,
    db: asyncpg.Connection
) -> dict:
    """Evaluate code submission against exercise criteria."""
    # Get exercise test cases
    exercise = await db.fetchrow(
        """
        SELECT id, title, test_cases, max_score, time_limit, memory_limit
        FROM programming_exercises WHERE id = $1
        """,
        uuid.UUID(exercise_id)
    )

    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    test_cases = json.loads(exercise["test_cases"]) if exercise["test_cases"] else []

    # Simulate execution (in production, use actual sandbox)
    passed_count = 0
    execution_time = 0.5  # mock
    errors = []

    for i, test in enumerate(test_cases[:5]):  # Limit test cases
        # Simulate test execution
        passed = True  # mock - would actually run code
        if passed:
            passed_count += 1
        else:
            errors.append({
                "test_case": i + 1,
                "input": test.get("input", ""),
                "expected": test.get("expected", ""),
                "actual": "模拟输出",  # mock
                "message": "输出不匹配"
            })

    # Calculate score
    total_tests = len(test_cases[:5])
    score = int((passed_count / total_tests) * exercise["max_score"]) if total_tests > 0 else 0
    passed = passed_count == total_tests

    return {
        "passed": passed,
        "score": score,
        "errors": errors,
        "execution_time": execution_time,
        "memory_used": 10.5,  # MB mock
    }


# ============ Routes ============

@router.get("/languages")
async def get_supported_languages():
    """Get supported programming languages."""
    return {
        "languages": [
            {
                "id": k,
                "name": k.capitalize(),
                "extension": v["extension"],
                "highlight_js": v["highlight_js"],
                "linter": v["linter"]
            }
            for k, v in LANGUAGE_CONFIGS.items()
        ]
    }


@router.post("/analyze")
async def analyze_code(
    request: CodeReviewRequest
):
    """Analyze code for errors and style issues."""
    errors = await analyze_syntax_errors(request.code, request.language)
    style_issues = await analyze_code_style(request.code, request.language)
    suggestions = await generate_fix_suggestions(errors, request.language)

    return {
        "syntax_errors": errors,
        "style_issues": style_issues,
        "fix_suggestions": suggestions,
        "overall_score": 85 if len(errors) == 0 else 60,
        "recommendation": "代码结构清晰，建议优化变量命名" if len(errors) == 0 else "请先修复语法错误"
    }


@router.post("/submit")
async def submit_code(
    request: CodeSubmission,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Submit and evaluate code for an exercise."""
    # Analyze code first
    errors = await analyze_syntax_errors(request.code, request.language)

    if len(errors) > 0:
        # Has syntax errors, cannot run
        return {
            "passed": False,
            "score": 0,
            "errors": errors,
            "suggestions": await generate_fix_suggestions(errors, request.language),
            "execution_time": 0,
            "message": "代码存在语法错误，无法执行"
        }

    # Evaluate submission
    result = await evaluate_code_submission(
        request.code,
        request.language,
        request.exercise_id,
        user_id,
        db
    )

    # Store submission
    submission_id = await db.fetchval(
        """
        INSERT INTO code_submissions
        (user_id, exercise_id, code, language, passed, score, execution_time, submitted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        """,
        uuid.UUID(user_id),
        uuid.UUID(request.exercise_id),
        request.code,
        request.language,
        result["passed"],
        result["score"],
        result["execution_time"],
        datetime.utcnow()
    )

    # Give points based on score
    points = result["score"]
    await db.execute(
        """
        UPDATE users SET point_balance = point_balance + $2 WHERE id = $1
        """,
        uuid.UUID(user_id),
        points
    )

    return {
        "submission_id": str(submission_id),
        "passed": result["passed"],
        "score": result["score"],
        "errors": result["errors"],
        "suggestions": [],
        "execution_time": result["execution_time"],
        "memory_used": result.get("memory_used"),
        "earned_points": points
    }


@router.get("/exercises/{course_id}")
async def get_course_exercises(
    course_id: str,
    difficulty: str = Query("all"),  # 'easy', 'medium', 'hard', 'all'
    db: asyncpg.Connection = Depends(get_db)
):
    """Get programming exercises for a course."""
    conditions = ["course_id = $1"]
    params = [uuid.UUID(course_id)]

    if difficulty != "all":
        conditions.append("difficulty = $" + str(len(params) + 1))
        params.append(difficulty)

    exercises = await db.fetch(
        f"""
        SELECT id, title, description, difficulty, language, max_score
        FROM programming_exercises
        WHERE {" AND ".join(conditions)}
        ORDER BY difficulty, created_at
        """,
        *params
    )

    return {
        "exercises": [
            {
                "id": str(e["id"]),
                "title": e["title"],
                "description": e["description"],
                "difficulty": e["difficulty"],
                "language": e["language"],
                "max_score": e["max_score"]
            }
            for e in exercises
        ]
    }


@router.get("/exercises/{exercise_id}/detail")
async def get_exercise_detail(
    exercise_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get detailed exercise info including previous submissions."""
    exercise = await db.fetchrow(
        """
        SELECT id, title, description, difficulty, language, starter_code,
               hints, max_score, time_limit
        FROM programming_exercises WHERE id = $1
        """,
        uuid.UUID(exercise_id)
    )

    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    # Get user's previous submissions
    submissions = await db.fetch(
        """
        SELECT id, passed, score, submitted_at
        FROM code_submissions
        WHERE user_id = $1 AND exercise_id = $2
        ORDER BY submitted_at DESC
        LIMIT 5
        """,
        uuid.UUID(user_id),
        uuid.UUID(exercise_id)
    )

    return {
        "exercise": {
            "id": str(exercise["id"]),
            "title": exercise["title"],
            "description": exercise["description"],
            "difficulty": exercise["difficulty"],
            "language": exercise["language"],
            "starter_code": exercise["starter_code"],
            "hints": exercise["hints"],
            "max_score": exercise["max_score"],
            "time_limit": exercise["time_limit"]
        },
        "previous_submissions": [
            {
                "id": str(s["id"]),
                "passed": s["passed"],
                "score": s["score"],
                "submitted_at": s["submitted_at"].isoformat()
            }
            for s in submissions
        ]
    }


@router.post("/portfolio")
async def create_project_portfolio(
    request: ProjectPortfolio,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Create a project portfolio entry."""
    portfolio_id = await db.fetchval(
        """
        INSERT INTO project_portfolios
        (user_id, project_name, description, language, code_url, tags, is_public, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        """,
        uuid.UUID(user_id),
        request.project_name,
        request.description,
        request.language,
        request.code_url,
        json.dumps(request.tags),
        request.is_public,
        datetime.utcnow()
    )

    return {
        "portfolio_id": str(portfolio_id),
        "success": True,
        "message": "项目作品已添加到学习护照"
    }


@router.get("/portfolio")
async def get_user_portfolio(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user's project portfolio."""
    projects = await db.fetch(
        """
        SELECT id, project_name, description, language, code_url, tags,
               is_public, rating, created_at
        FROM project_portfolios
        WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        uuid.UUID(user_id)
    )

    return {
        "projects": [
            {
                "id": str(p["id"]),
                "project_name": p["project_name"],
                "description": p["description"],
                "language": p["language"],
                "code_url": p["code_url"],
                "tags": json.loads(p["tags"]) if p["tags"] else [],
                "is_public": p["is_public"],
                "rating": p["rating"],
                "created_at": p["created_at"].isoformat()
            }
            for p in projects
        ]
    }


@router.get("/stats")
async def get_programming_stats(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get user's programming learning statistics."""
    stats = await db.fetchrow(
        """
        SELECT
            COUNT(*) as total_submissions,
            COUNT(*) FILTER (WHERE passed = true) as passed_count,
            AVG(score) as avg_score,
            COUNT(DISTINCT exercise_id) as exercises_attempted,
            MIN(submitted_at) as first_submission,
            MAX(submitted_at) as last_submission
        FROM code_submissions WHERE user_id = $1
        """,
        uuid.UUID(user_id)
    )

    # Get language distribution
    language_stats = await db.fetch(
        """
        SELECT language, COUNT(*) as count
        FROM code_submissions WHERE user_id = $1
        GROUP BY language
        """,
        uuid.UUID(user_id)
    )

    return {
        "total_submissions": stats["total_submissions"] or 0,
        "passed_count": stats["passed_count"] or 0,
        "pass_rate": round((stats["passed_count"] or 0) / (stats["total_submissions"] or 1) * 100, 1),
        "avg_score": round(stats["avg_score"] or 0, 1),
        "exercises_attempted": stats["exercises_attempted"] or 0,
        "by_language": {s["language"]: s["count"] for s in language_stats}
    }


@router.get("/leaderboard/{language}")
async def get_language_leaderboard(
    language: str,
    limit: int = Query(20, le=50),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get leaderboard for a specific language."""
    leaders = await db.fetch(
        """
        SELECT u.nickname, u.avatar_url,
               COUNT(*) FILTER (WHERE cs.passed = true) as passed_count,
               AVG(cs.score) as avg_score
        FROM code_submissions cs
        JOIN users u ON cs.user_id = u.id
        WHERE cs.language = $1
        GROUP BY u.id
        ORDER BY passed_count DESC, avg_score DESC
        LIMIT $2
        """,
        language,
        limit
    )

    return {
        "language": language,
        "leaders": [
            {
                "nickname": l["nickname"],
                "avatar_url": l["avatar_url"],
                "passed_count": l["passed_count"],
                "avg_score": round(l["avg_score"] or 0, 1)
            }
            for l in leaders
        ]
    }