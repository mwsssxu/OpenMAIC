"""
大纲生成器 - 两阶段生成管道 Stage 1
"""

import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.services.llm import call_llm, stream_llm
import uuid

class SceneOutline(BaseModel):
    """场景大纲"""
    id: str
    title: str
    type: str  # slide, quiz, interactive, pbl
    description: str
    order: int
    key_points: Optional[List[str]] = []
    estimated_duration: Optional[int] = None
    media_generations: Optional[List[Dict]] = None


OUTLINE_SYSTEM_PROMPT = """
你是一个专业的课程设计专家。你的任务是根据用户的需求和参考材料，
设计一个结构化的教学大纲。

输出要求：
1. 返回 JSON 数组，每个元素是一个场景大纲
2. 每个场景包含：id, title, type, description, order, key_points
3. type 可以是：slide（幻灯片）、quiz（测验）、interactive（交互）、pbl（项目式学习）
4. key_points 是该场景的核心要点列表
5. 顺序合理，循序渐进
6. 只输出 JSON，不要其他内容

示例输出格式：
[
  {
    "id": "scene_1",
    "title": "课程简介",
    "type": "slide",
    "description": "介绍本课程的主题和学习目标",
    "order": 1,
    "key_points": ["主题概述", "学习目标", "课程安排"]
  },
  {
    "id": "scene_2",
    "title": "核心概念",
    "type": "slide",
    "description": "讲解核心概念和原理",
    "order": 2,
    "key_points": ["概念定义", "原理说明", "示例演示"]
  }
]
"""

OUTLINE_USER_PROMPT_TEMPLATE = """
请根据以下需求设计课程大纲：

## 用户需求
{requirement}

## 参考材料
{pdf_content}

## 语言要求
{language}

## 可用图片
{available_images}

## 智能体配置
{agent_context}

## 网络搜索增强
{web_search_context}

请输出 JSON 数组格式的课程大纲。
"""


async def generate_outlines(
    requirement: str,
    pdf_content: Optional[str] = None,
    language: str = "zh-CN",
    available_images: Optional[List[str]] = None,
    model: Optional[str] = None,
    agent_ids: Optional[List[str]] = None,
    web_search: bool = False,
) -> List[SceneOutline]:
    """
    生成课程大纲

    Args:
        requirement: 用户需求描述
        pdf_content: PDF 文本内容
        language: 语言
        available_images: 可用图片描述列表
        model: LLM 模型
        agent_ids: 选用的智能体ID列表
        web_search: 是否启用网络搜索增强

    Returns:
        场景大纲列表
    """
    # 构建智能体上下文
    agent_context = "无智能体配置"
    if agent_ids and len(agent_ids) > 0:
        agent_context = f"已配置 {len(agent_ids)} 个智能体参与课堂互动，请设计适合互动的场景"

    # 构建网络搜索上下文
    web_search_context = "未启用网络搜索"
    if web_search:
        web_search_context = "已启用网络搜索，可参考网络资源丰富内容"

    # 构建提示词
    user_prompt = OUTLINE_USER_PROMPT_TEMPLATE.format(
        requirement=requirement,
        pdf_content=pdf_content or "无",
        language=language,
        available_images="\n".join(available_images) if available_images else "无",
        agent_context=agent_context,
        web_search_context=web_search_context,
    )

    # 调用 LLM
    response = await call_llm(
        prompt=user_prompt,
        system_prompt=OUTLINE_SYSTEM_PROMPT,
        model=model,
        temperature=0.7,
        max_tokens=4096,
    )

    # 解析 JSON
    try:
        # 清理可能的 markdown 包装
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        outlines_data = json.loads(cleaned)

        # 转换为 Pydantic 模型
        outlines = []
        for i, item in enumerate(outlines_data):
            outlines.append(SceneOutline(
                id=item.get("id") or str(uuid.uuid4()),
                title=item.get("title", f"场景 {i+1}"),
                type=item.get("type", "slide"),
                description=item.get("description", ""),
                order=item.get("order", i+1),
                key_points=item.get("key_points", []),
                estimated_duration=item.get("estimated_duration"),
                media_generations=item.get("media_generations"),
            ))

        return outlines
    except json.JSONDecodeError as e:
        # 解析失败，返回默认大纲
        return [
            SceneOutline(
                id=str(uuid.uuid4()),
                title="课程简介",
                type="slide",
                description=f"基于需求 '{requirement[:50]}...' 的课程简介",
                order=1,
                key_points=["主题概述", "学习目标"],
            ),
            SceneOutline(
                id=str(uuid.uuid4()),
                title="核心内容",
                type="slide",
                description="讲解核心概念",
                order=2,
                key_points=["概念定义", "原理说明"],
            ),
        ]


async def stream_outlines(
    requirement: str,
    pdf_content: Optional[str] = None,
    language: str = "zh-CN",
    model: Optional[str] = None,
):
    """
    流式生成大纲（用于 SSE）

    Yields:
        解析出的场景大纲（逐个返回）
    """
    user_prompt = OUTLINE_USER_PROMPT_TEMPLATE.format(
        requirement=requirement,
        pdf_content=pdf_content or "无",
        language=language,
        available_images="无",
    )

    buffer = ""
    parsed_count = 0

    for chunk in await stream_llm(
        prompt=user_prompt,
        system_prompt=OUTLINE_SYSTEM_PROMPT,
        model=model,
        temperature=0.7,
        max_tokens=4096,
    ):
        buffer += chunk

        # 尝试解析完整的大纲对象
        outlines = extract_outlines_from_buffer(buffer, parsed_count)
        for outline in outlines:
            parsed_count += 1
            yield outline


def extract_outlines_from_buffer(buffer: str, already_parsed: int) -> List[Dict]:
    """
    从部分 JSON 数组中提取已完成的对象

    Args:
        buffer: 当前累积的文本
        already_parsed: 已解析的对象数量

    Returns:
        新解析的对象列表
    """
    results = []

    # 找到 JSON 数组起始
    array_start = buffer.find("[")
    if array_start == -1:
        return results

    stripped = buffer[array_start:]

    # 状态机解析
    depth = 0
    object_start = -1
    in_string = False
    escaped = False
    object_count = 0

    for i, char in enumerate(stripped):
        if escaped:
            escaped = False
            continue
        if char == "\\" and in_string:
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue

        if char == "{":
            if depth == 0:
                object_start = i
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0 and object_start >= 0:
                object_count += 1
                if object_count > already_parsed:
                    try:
                        obj = json.loads(stripped[object_start:i+1])
                        results.append(obj)
                    except:
                        pass
                object_start = -1

    return results