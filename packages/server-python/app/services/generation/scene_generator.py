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
from app.services.llm import call_llm, stream_llm
from app.services.generation.outline_generator import SceneOutline
from app.services.generation.prompts.slide_content_simple import (
    SLIDE_CONTENT_SYSTEM_PROMPT,
    SLIDE_CONTENT_USER_TEMPLATE,
    TEXT_HEIGHT_TABLE,
)
import uuid


logger = logging.getLogger(__name__)


def format_teacher_persona_for_prompt(agents: Optional[List[Dict[str, Any]]]) -> str:
    """
    格式化教师人设信息用于Prompt（与Web端一致）

    Args:
        agents: 智能体列表

    Returns:
        教师人设文本
    """
    if not agents or len(agents) == 0:
        return ""

    # 找到教师智能体
    teacher_agent = None
    for agent in agents:
        if agent.get("role") == "teacher":
            teacher_agent = agent
            break

    if not teacher_agent:
        return ""

    return f"""## Teacher Persona
The primary teacher for this course is:
- Name: {teacher_agent.get('name', 'Teacher')}
- Role: {teacher_agent.get('role', 'teacher')}
- Persona: {teacher_agent.get('persona', 'A professional teacher')}

Design the course content and teaching style to match this teacher's persona."""


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
    agents: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    生成场景内容（使用精确排版Prompt + 流式调用避免超时）

    Args:
        outline: 场景大纲
        language: 语言
        model: LLM 模型
        agents: 智能体信息列表（用于构建teacherContext）

    Returns:
        场景内容（JSON），包含精确坐标格式的元素
    """
    if outline.type == "slide":
        # 构建教师人设上下文（与Web端一致）
        teacher_context = format_teacher_persona_for_prompt(agents)

        # 使用精确排版Prompt模板
        prompt = SLIDE_CONTENT_USER_TEMPLATE.format(
            title=outline.title,
            type=outline.type,
            description=outline.description,
            key_points=", ".join(outline.key_points or []),
            language=language,
            teacher_context=teacher_context,
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
    logger.debug(f"[SceneGenerator] Prompt length: {len(prompt)}, System prompt length: {len(system_prompt)}")

    # 使用流式调用避免DashScope 30秒超时问题（与Web端一致）
    try:
        chunks = []
        async for chunk in stream_llm(
            prompt=prompt,
            system_prompt=system_prompt,
            model=model,
            temperature=0.7,
            max_tokens=4096,
        ):
            chunks.append(chunk)

        response = "".join(chunks)
        logger.info(f"[SceneGenerator] Stream completed, response length: {len(response)}")
    except Exception as e:
        logger.warning(f"[SceneGenerator] Stream failed, falling back to non-stream: {e}")
        # 流式失败时回退到非流式（可能超时）
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
    agents: Optional[List[Dict[str, Any]]] = None,
) -> List[Action]:
    """
    生成 Agent Actions（讲解行为）- 使用流式调用避免超时

    Args:
        outline: 场景大纲
        content: 场景内容
        language: 语言
        model: LLM 模型
        agents: 智能体信息列表（用于个性化讲解）

    Returns:
        Action 列表
    """
    # 构建教师人设上下文（与Web端一致）
    teacher_context = format_teacher_persona_for_prompt(agents)

    # 构建智能体列表信息（用于讲解风格）
    agents_info = ""
    if agents and len(agents) > 0:
        agents_info = "## 讲解智能体\n" + "\n".join([
            f"- {a.get('name', 'Agent')} ({a.get('role', 'assistant')}): {a.get('persona', '专业讲师')}"
            for a in agents[:3]  # 最多3个
        ])

    ACTIONS_PROMPT = """生成Agent讲解行为:
标题: {title}
描述: {description}
要点: {key_points}
元素: {elements_info}
{teacher_context}
{agents_info}
语言: {language}

行为类型:
- speech: 讲解文本(必需)
- spotlight: 聚焦元素(target_element_id)
- laser: 激光笔(target_element_id,color)
- wb_draw_text: 白板写字

规则: target_element_id必须是真实元素ID,先聚焦再讲解,讲解内容比幻灯片更丰富(背景知识+举例)

输出:[{{'id':'a1','type':'speech','data':{{'text':'开场'}}}},{{'id':'a2','type':'spotlight','data':{{'target_element_id':'title','dim_opacity':0.7}}}},{{'id':'a3','type':'speech','data':{{'text':'标题讲解'}}}}]
只输出JSON数组。"""

    prompt = ACTIONS_PROMPT.format(
        title=outline.title,
        description=outline.description or "",
        key_points=", ".join(outline.key_points or []),
        elements_info=format_elements_info(content),
        teacher_context=teacher_context,
        agents_info=agents_info,
        language=language,
    )

    logger.info(f"[SceneGenerator] Generating actions for: {outline.title}")
    logger.debug(f"[SceneGenerator] Elements info:\n{format_elements_info(content)}")

    # 使用流式调用避免DashScope 30秒超时问题
    try:
        chunks = []
        async for chunk in stream_llm(
            prompt=prompt,
            system_prompt="Agent行为设计专家。只输出JSON数组。",
            model=model,
            temperature=0.7,
            max_tokens=2048,
        ):
            chunks.append(chunk)

        response = "".join(chunks)
        logger.info(f"[SceneGenerator] Stream completed, response length: {len(response)}")
    except Exception as stream_error:
        logger.warning(f"[SceneGenerator] Stream failed, falling back to non-stream: {stream_error}")
        # 流式失败时回退到非流式
        response = await call_llm(
            prompt=prompt,
            system_prompt="Agent行为设计专家。只输出JSON数组。",
            model=model,
            temperature=0.7,
            max_tokens=2048,
        )
        logger.info(f"[SceneGenerator] Fallback response length: {len(response)}")

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
    agents: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    生成完整场景（内容 + Actions）- 支持智能体信息
    """
    content = await generate_scene_content(outline, language, model, agents)
    actions = await generate_scene_actions(outline, content, language, model, agents)

    return {
        "id": str(uuid.uuid4()),
        "outline_id": outline.id,
        "type": outline.type,
        "title": outline.title,
        "order": outline.order,
        "content": content,
        "actions": [a.model_dump() for a in actions],
    }