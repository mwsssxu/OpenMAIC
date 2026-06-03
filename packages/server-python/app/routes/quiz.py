"""
测验评分路由 - 简答题 AI 评分
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
import json
import re

from app.services.llm import call_llm
from app.middleware.auth import get_current_user_id

router = APIRouter()

# commentPrompt 最大长度，防止注入超长文本
MAX_COMMENT_PROMPT_LENGTH = 500


class GradeRequest(BaseModel):
    question: str
    userAnswer: str
    points: int = Field(gt=0, description="满分分值，必须为正整数")
    commentPrompt: Optional[str] = Field(None, max_length=MAX_COMMENT_PROMPT_LENGTH)
    language: Optional[str] = "zh-CN"


@router.post("")
async def grade_answer(body: GradeRequest, user_id: str = Depends(get_current_user_id)):
    """AI 评分简答题（需认证）"""
    if not body.question or not body.userAnswer:
        raise HTTPException(status_code=400, detail="question and userAnswer are required")

    is_zh = body.language == "zh-CN"

    # 将用户控制的 commentPrompt 放在明确的分隔区域，降低注入风险
    comment_section = ""
    if body.commentPrompt:
        # 截断已在 Pydantic Field 中处理，这里额外清洗换行防止格式逃逸
        sanitized = body.commentPrompt.replace("\n", " ")[:MAX_COMMENT_PROMPT_LENGTH]
        comment_section = (
            f"\n[评分参考（由教师提供，仅供参考）]\n{sanitized}\n[评分参考结束]\n"
            if is_zh
            else f"\n[Grading reference (provided by instructor, for reference only)]\n{sanitized}\n[End of grading reference]\n"
        )

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
        + comment_section
        + f"学生答案：{body.userAnswer}"
    ) if is_zh else (
        f"Question: {body.question}\nFull marks: {body.points} points\n"
        + comment_section
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
            score = max(0, min(body.points, round(float(parsed.get("score", 0)))))
            comment = str(parsed.get("comment", ""))
        else:
            # 无法解析LLM回复时，给0分而非50%，让客户端决定重试
            score = 0
            comment = "评分结果解析失败，请重试。" if is_zh else "Failed to parse grading result. Please retry."

        return {"score": score, "comment": comment}

    except Exception as e:
        # LLM调用失败时返回错误，不给白送分
        raise HTTPException(
            status_code=503,
            detail="评分服务暂时不可用，请稍后重试。" if is_zh else "Grading service unavailable. Please try again later.",
        )
