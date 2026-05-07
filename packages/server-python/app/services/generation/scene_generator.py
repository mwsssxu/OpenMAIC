"""
场景生成器 - 两阶段生成管道 Stage 2

使用精确排版Prompt模板生成丰富的幻灯片内容
包含: text元素 + shape装饰 + 精确坐标
"""

import json
import re
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.services.llm import call_llm
from app.services.generation.outline_generator import SceneOutline
from app.services.generation.prompts.slide_content_system import (
    SLIDE_CONTENT_SYSTEM_PROMPT,
    SLIDE_CONTENT_USER_TEMPLATE,
    TEXT_HEIGHT_TABLE,
)
import uuid


logger = logging.getLogger(__name__)


def format_elements_info(content: Dict[str, Any]) -> str:
    """
    格式化元素信息，提取ID和类型用于prompt

    Args:
        content: 场景内容

    Returns:
        格式化的元素列表字符串
    """
    elements = content.get("canvas", {}).get("elements", [])
    if not elements:
        return "无元素"

    lines = []
    for el in elements:
        el_id = el.get("id", "unknown")
        el_type = el.get("type", "unknown")
        el_left = el.get("left", 0)
        el_top = el.get("top", 0)

        # 提取文本内容（如果是text元素）
        content_preview = ""
        if el_type == "text":
            text_content = el.get("content", "")
            # 清理HTML标签
            if text_content and "<p" in text_content:
                text_content = re.sub(r"<[^>]+>", "", text_content)
            content_preview = f", 内容: {text_content[:50]}..." if text_content else ""

        lines.append(f"- ID: {el_id}, 类型: {el_type}, 位置: ({el_left}, {el_top}){content_preview}")

    return "\n".join(lines)


class SlideElement(BaseModel):
    """幻灯片元素"""
    id: str
    type: str  # text, image, shape, chart, latex, table, line
    left: float
    top: float
    width: float
    height: float
    content: Optional[Any] = None
    fill: Optional[str] = None
    path: Optional[str] = None
    viewBox: Optional[List[float]] = None
    defaultColor: Optional[str] = None
    defaultFontName: Optional[str] = ""
    fixedRatio: Optional[bool] = None


class SlideContent(BaseModel):
    """幻灯片内容"""
    type: str = "slide"
    canvas: Dict[str, Any]


class QuizQuestion(BaseModel):
    """测验问题"""
    id: str
    type: str  # single, multiple, short_answer
    question: str
    options: Optional[List[Dict]] = None
    answer: Optional[List[str]] = None
    analysis: Optional[str] = None


class QuizContent(BaseModel):
    """测验内容"""
    type: str = "quiz"
    questions: List[QuizQuestion]


class Action(BaseModel):
    """Agent Action"""
    id: str
    type: str  # speech, wb_draw_text, wb_draw_shape, spotlight, laser, discussion
    data: Dict[str, Any]


# 使用精确排版Prompt模板（从prompts模块导入）
# 包含Canvas规范、高度查表、元素类型定义、设计规则


QUIZ_USER_PROMPT_TEMPLATE = """
请根据以下大纲生成测验内容：

## 场景大纲
标题：{title}
描述：{description}

## 语言
{language}

## 要求
1. 生成 3-5 个测验问题
2. 类型包括：single（单选）、multiple（多选）、short_answer（简答）
3. 提供正确答案和解析

输出格式：
{{"type": "quiz", "questions": [{{'id': 'q_1', 'type': 'single', 'question': '问题文本', 'options': [{{'label': '选项A', 'value': 'A'}}], 'answer': ['A'], 'analysis': '解析文本'}}]}}
"""


async def generate_scene_content(
    outline: SceneOutline,
    language: str = "zh-CN",
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    生成场景内容（使用精确排版Prompt）

    Args:
        outline: 场景大纲
        language: 语言
        model: LLM 模型

    Returns:
        场景内容（JSON），包含精确坐标格式的元素
    """
    if outline.type == "slide":
        # 使用精确排版Prompt模板
        prompt = SLIDE_CONTENT_USER_TEMPLATE.format(
            title=outline.title,
            type=outline.type,
            description=outline.description,
            key_points=", ".join(outline.key_points or []),
            language=language,
        )
        system_prompt = SLIDE_CONTENT_SYSTEM_PROMPT
    elif outline.type == "quiz":
        prompt = QUIZ_USER_PROMPT_TEMPLATE.format(
            title=outline.title,
            description=outline.description,
            language=language,
        )
        system_prompt = "你是测验内容生成专家。只输出JSON。"
    else:
        # interactive / pbl 暂时返回默认结构
        return {"type": outline.type, "content": {}}

    logger.info(f"[SceneGenerator] Generating content for: {outline.title} ({outline.type})")

    response = await call_llm(
        prompt=prompt,
        system_prompt=system_prompt,
        model=model,
        temperature=0.7,
        max_tokens=4096,
    )

    # 增强的JSON解析逻辑
    content = parse_json_response(response, outline.type)

    # 后处理：确保元素格式正确（精确坐标而非嵌套position）
    if outline.type == "slide" and content.get("canvas"):
        content = fix_element_format(content)

    return content


def parse_json_response(response: str, content_type: str) -> Dict[str, Any]:
    """
    增强的JSON解析（处理LLM输出的各种异常）

    Args:
        response: LLM原始响应
        content_type: 内容类型

    Returns:
        解析后的JSON字典
    """
    try:
        cleaned = response.strip()

        # 移除 markdown 代码块标记
        if "```" in cleaned:
            # 多种模式匹配
            patterns = [
                r"```json\s*",  # ```json
                r"```\s*",      # ```
            ]
            for pattern in patterns:
                cleaned = re.sub(pattern, "", cleaned)
            # 移除结尾的 ```
            cleaned = re.sub(r"```.*$", "", cleaned)

        cleaned = cleaned.strip()

        # 找到 JSON 对象的起始位置
        start_brace = cleaned.find("{")
        if start_brace != -1:
            cleaned = cleaned[start_brace:]

        # 找到最后一个 }
        end_brace = cleaned.rfind("}")
        if end_brace != -1:
            cleaned = cleaned[:end_brace + 1]

        return json.loads(cleaned.strip())

    except json.JSONDecodeError as e:
        logger.warning(f"[SceneGenerator] JSON解析失败: {e}")
        logger.debug(f"[SceneGenerator] 响应内容: {response[:500]}")

        # 返回默认结构
        if content_type == "slide":
            return {
                "type": "slide",
                "canvas": {
                    "width": 1000,
                    "height": 562,
                    "background": "#ffffff",
                    "elements": [],
                }
            }
        elif content_type == "quiz":
            return {"type": "quiz", "questions": []}
        return {"type": content_type, "content": {}}


def fix_element_format(content: Dict[str, Any]) -> Dict[str, Any]:
    """
    后处理：确保元素使用精确坐标格式

    将嵌套的position对象转换为直接的left/top/width/height属性

    Args:
        content: 原始内容

    Returns:
        修复后的内容
    """
    if not content.get("canvas") or not content["canvas"].get("elements"):
        return content

    fixed_elements = []
    for el in content["canvas"]["elements"]:
        fixed_el = dict(el)

        # 如果元素使用嵌套position格式，转换为直接属性
        if "position" in fixed_el and isinstance(fixed_el["position"], dict):
            pos = fixed_el.pop("position")
            fixed_el["left"] = pos.get("left", 50)
            fixed_el["top"] = pos.get("top", 50)
            fixed_el["width"] = pos.get("width", 100)
            fixed_el["height"] = pos.get("height", 50)

        # 如果元素使用嵌套style格式，提取关键属性
        if "style" in fixed_el and isinstance(fixed_el["style"], dict):
            style = fixed_el["style"]
            # 提取fontSize到content中（TextElement需要）
            if "fontSize" in style and fixed_el["type"] == "text":
                # 确保content是HTML格式
                if fixed_el.get("content") and "<p" not in fixed_el["content"]:
                    font_size = style["fontSize"]
                    color = style.get("color", "#333333")
                    fixed_el["content"] = f'<p style="font-size: {font_size}px; color: {color};">{fixed_el["content"]}</p>'
                fixed_el["defaultColor"] = style.get("color", "#333333")

        # 确保TextElement有必要的属性
        if fixed_el["type"] == "text":
            if "defaultColor" not in fixed_el:
                fixed_el["defaultColor"] = "#333333"
            if "defaultFontName" not in fixed_el:
                fixed_el["defaultFontName"] = ""

        # 确保ShapeElement有必要的属性
        if fixed_el["type"] == "shape":
            if "path" not in fixed_el:
                fixed_el["path"] = "M 0 0 L 1 0 L 1 1 L 0 1 Z"
            if "viewBox" not in fixed_el:
                fixed_el["viewBox"] = [1, 1]
            if "fixedRatio" not in fixed_el:
                fixed_el["fixedRatio"] = False

        fixed_elements.append(fixed_el)

    content["canvas"]["elements"] = fixed_elements
    return content


async def generate_scene_actions(
    outline: SceneOutline,
    content: Dict[str, Any],
    language: str = "zh-CN",
    model: Optional[str] = None,
) -> List[Action]:
    """
    生成 Agent Actions（讲解行为）

    Args:
        outline: 场景大纲
        content: 场景内容
        language: 语言
        model: LLM 模型

    Returns:
        Action 列表
    """
    ACTIONS_PROMPT = """
请根据场景内容生成 Agent 讲解行为。

## 场景信息
标题：{title}

## 场景元素（带ID）
{elements_info}

## 语言
{language}

## 要求
生成讲解行为序列，包括：
1. speech - 语音讲解（必需，为每个重要元素生成讲解）
2. spotlight - 聚焦元素（可选，使用 target_element_id 指定要聚焦的元素ID）
3. laser - 激光笔指向（可选，使用 target_element_id 指定指向的元素）
4. wb_draw_text - 白板绘制文字（可选，在白板上展示公式或关键词）

## 重要规则
- target_element_id 必须是上述场景元素列表中的真实ID
- 每个元素的讲解应该包含：先spotlight/laser聚焦，再speech讲解
- speech 的 text 应该是完整的讲解内容，不要直接复制幻灯片文字

输出格式：
[{{'id': 'action_1', 'type': 'speech', 'data': {{'text': '开场介绍文本'}}}}, {{'id': 'action_2', 'type': 'spotlight', 'data': {{'target_element_id': 'title', 'dim_opacity': 0.7}}}}, {{'id': 'action_3', 'type': 'speech', 'data': {{'text': '标题讲解内容'}}}}, {{'id': 'action_4', 'type': 'laser', 'data': {{'target_element_id': 'point_0', 'color': '#ff3b30'}}}}, {{'id': 'action_5', 'type': 'speech', 'data': {{'text': '要点讲解内容'}}}}]

只输出 JSON 数组。
"""

    prompt = ACTIONS_PROMPT.format(
        title=outline.title,
        elements_info=format_elements_info(content),
        language=language,
    )

    logger.info(f"[SceneGenerator] Generating actions for: {outline.title}")
    logger.debug(f"[SceneGenerator] Elements info:\n{format_elements_info(content)}")

    try:
        response = await call_llm(
            prompt=prompt,
            system_prompt="你是 Agent 行为设计专家。只输出 JSON 数组。",
            model=model,
            temperature=0.7,
            max_tokens=2048,
        )

        logger.info(f"[SceneGenerator] LLM response length: {len(response)}")
        logger.debug(f"[SceneGenerator] LLM response preview: {response[:200]}...")
    except Exception as llm_error:
        logger.error(f"[SceneGenerator] LLM call failed: {llm_error}")
        raise

    try:
        cleaned = response.strip()
        # 移除 markdown 代码块标记
        if "```" in cleaned:
            start_idx = cleaned.find("```")
            if start_idx != -1:
                rest = cleaned[start_idx:]
                if rest.startswith("```json"):
                    cleaned = rest[7:]
                elif rest.startswith("```"):
                    cleaned = rest[3:]
                end_idx = cleaned.find("```")
                if end_idx != -1:
                    cleaned = cleaned[:end_idx]

        cleaned = cleaned.strip()
        # 找到 JSON 数组的起始位置
        start_bracket = cleaned.find("[")
        if start_bracket != -1:
            cleaned = cleaned[start_bracket:]

        # 找到最后一个 ]
        end_bracket = cleaned.rfind("]")
        if end_bracket != -1:
            cleaned = cleaned[:end_bracket + 1]

        actions_data = json.loads(cleaned.strip())

        return [
            Action(
                id=a.get("id") or str(uuid.uuid4()),
                type=a.get("type", "speech"),
                data=a.get("data", {}),
            )
            for a in actions_data
        ]
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.warning(f"[SceneGenerator] Actions解析失败: {e}, cleaned content: {cleaned[:500]}")
        # 抛出异常，让scene_service.py的完整fallback接管
        raise ValueError(f"Failed to parse actions JSON: {e}")


async def generate_full_scene(
    outline: SceneOutline,
    language: str = "zh-CN",
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    生成完整场景（内容 + Actions）
    """
    content = await generate_scene_content(outline, language, model)
    actions = await generate_scene_actions(outline, content, language, model)

    return {
        "id": str(uuid.uuid4()),
        "outline_id": outline.id,
        "type": outline.type,
        "title": outline.title,
        "order": outline.order,
        "content": content,
        "actions": [a.model_dump() for a in actions],
    }