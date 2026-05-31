"""
测验评分路由 - 简答题 AI 评分
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
import re

from app.services.llm import call_llm

router = APIRouter()


class GradeRequest(BaseModel):
    question: str
    userAnswer: str
    points: int
    commentPrompt: Optional[str] = None
    language: Optional[str] = "zh-CN"


@router.post("")
async def grade_answer(body: GradeRequest):
    """AI 评分简答题"""
    if not body.question or not body.userAnswer:
        raise HTTPException(status_code=400, detail="question and userAnswer are required")

    if not body.points or body.points <= 0:
        raise HTTPException(status_code=400, detail="points must be a positive number")

    is_zh = body.language == "zh-CN"

    system_prompt = (
        f"你是一位专业的教育评估专家。请根据题目和学生答案进行评分并给出简短评语。\n"
        f"必须以如下 JSON 格式回复（不要包含其他内容）：\n"
        f'{{"score": <0到{body.points}的整数>, "comment": "<一两句评语>"}}'
        if is_zh
        else f"You are a professional educational assessor. Grade the student's answer and provide brief feedback.\n"
        f"You must reply in the following JSON format only (no other content):\n"
        f'{{"score": <integer from 0 to {body.points}>, "comment": "<one or two sentences of feedback>"}}'
    )

    user_prompt = (
        f"题目：{body.question}\n满分：{body.points}分\n"
        + (f"评分要点：{body.commentPrompt}\n" if body.commentPrompt else "")
        + f"学生答案：{body.userAnswer}"
        if is_zh
        else f"Question: {body.question}\nFull marks: {body.points} points\n"
        + (f"Grading guidance: {body.commentPrompt}\n" if body.commentPrompt else "")
        + f"Student answer: {body.userAnswer}"
    )

    try:
        text = await call_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
        )

        # Parse JSON from LLM response
        # Find the first balanced {…} block — avoids greedy match grabbing extra content
        first_brace = text.find('{')
        if first_brace >= 0:
            depth = 0
            for i in range(first_brace, len(text)):
                if text[i] == '{':
                    depth += 1
                elif text[i] == '}':
                    depth -= 1
                if depth == 0:
                    json_str = text[first_brace:i + 1]
                    break
            else:
                json_str = text[first_brace:]
            parsed = json.loads(json_str)
        else:
            score = max(0, min(body.points, round(float(parsed.get("score", 0)))))
            comment = str(parsed.get("comment", ""))
        else:
            score = round(body.points * 0.5)
            comment = "已作答，请参考标准答案。" if is_zh else "Answer received. Please refer to the standard answer."

        return {"score": score, "comment": comment}

    except Exception as e:
        # Fallback: partial credit
        return {
            "score": round(body.points * 0.5),
            "comment": "评分服务暂时不可用，已给予基础分。" if is_zh else "Grading service unavailable, partial credit given.",
        }
