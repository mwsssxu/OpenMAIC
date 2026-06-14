"""Test analyze_assessment_results returns per-question detail."""
import asyncio
import pytest
from app.routes.assessments import analyze_assessment_results


@pytest.mark.asyncio
async def test_question_results_includes_correct_and_wrong():
    questions = [
        {
            "id": "q1",
            "content": "1+1=?",
            "type": "single_choice",
            "options": {"A": "1", "B": "2", "C": "3"},
            "correct_answer": "B",
            "points": 10,
            "explanation": "基本算术",
        },
        {
            "id": "q2",
            "content": "首都是?",
            "type": "single_choice",
            "options": {"A": "上海", "B": "北京", "C": "广州"},
            "correct_answer": "B",
            "points": 10,
            "explanation": "中国首都",
        },
    ]
    answers = [
        {"question_id": "q1", "answer": "B"},  # 对
        {"question_id": "q2", "answer": "A"},  # 错
    ]

    result = await analyze_assessment_results(answers, questions)

    assert result["score"] == 50.0
    assert result["correct_count"] == 1
    assert "question_results" in result
    qrs = result["question_results"]
    assert len(qrs) == 2

    # q1 答对
    q1 = qrs[0]
    assert q1["question_id"] == "q1"
    assert q1["is_correct"] is True
    assert q1["user_answer"] == "B"
    assert q1["correct_answer"] == "B"
    assert q1["explanation"] == "基本算术"

    # q2 答错
    q2 = qrs[1]
    assert q2["is_correct"] is False
    assert q2["user_answer"] == "A"
    assert q2["correct_answer"] == "B"
    assert q2["explanation"] == "中国首都"


@pytest.mark.asyncio
async def test_unanswered_question_marked_wrong():
    questions = [
        {
            "id": "q1",
            "content": "Q1",
            "correct_answer": "A",
            "points": 5,
        }
    ]
    answers = []  # 没作答
    result = await analyze_assessment_results(answers, questions)
    assert result["correct_count"] == 0
    assert result["question_results"][0]["user_answer"] is None
    assert result["question_results"][0]["is_correct"] is False
