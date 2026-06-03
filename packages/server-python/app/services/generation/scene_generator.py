"""
场景生成器 - 两阶段生成管道 Stage 2

使用Web端一致的模板化Prompt生成场景内容
支持: slide, quiz, interactive (simulation, game, diagram, code, visualization3d)

模型路由: 根据场景类型自动选择合适的模型
"""

import asyncio
import json
import re
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.services.llm import call_llm, stream_llm
from app.services.model_router import SceneType, get_model_router
from app.services.generation.outline_generator import SceneOutline
from app.services.generation.prompts import build_prompt, PROMPT_IDS
from app.services.generation.prompts.slide_content_simple import TEXT_HEIGHT_TABLE
import uuid


logger = logging.getLogger(__name__)


def _get_scene_type_for_generation(outline_type: str) -> SceneType:
    """
    将大纲类型映射到场景类型（用于模型路由）

    Args:
        outline_type: 大纲类型 (slide, quiz, interactive, pbl)

    Returns:
        SceneType 枚举值
    """
    mapping = {
        "slide": SceneType.SCENE_GENERATION,
        "quiz": SceneType.SCENE_GENERATION,
        "interactive": SceneType.INTERACTIVE_GENERATION,
        "pbl": SceneType.SCENE_GENERATION,
    }
    return mapping.get(outline_type, SceneType.SCENE_GENERATION)


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


# quiz/pbl/interactive 场景内容生成使用模板化 Prompt，参见 generate_scene_content
# 保留此占位常量避免向后不兼容，已废弃
QUIZ_USER_PROMPT_TEMPLATE = """(deprecated — use build_prompt('quiz-content'))"""


# widget_type → prompt_id 映射表
# 绝大多数 widget 用 f"{type}-content"；个别模板名不按命名规则（与 Web 端 prompts-zh-CN 一致）
# 在这里显式列出，避免默默 fallback 到不存在的模板
WIDGET_CONTENT_PROMPT_OVERRIDES = {
    "html": "interactive-html",
    "scientific-model": "interactive-scientific-model",
}


def _resolve_widget_prompt_id(widget_type: str) -> str:
    """根据 widget_type 返回对应的 prompt 模板 ID。"""
    if widget_type in WIDGET_CONTENT_PROMPT_OVERRIDES:
        return WIDGET_CONTENT_PROMPT_OVERRIDES[widget_type]
    return f"{widget_type}-content"


async def generate_scene_content(
    outline: SceneOutline,
    language: str = "zh-CN",
    language_directive: Optional[str] = None,
    model: Optional[str] = None,
    agents: Optional[List[Dict[str, Any]]] = None,
    image_enabled: bool = False,
    video_enabled: bool = False,
) -> Dict[str, Any]:
    """
    生成场景内容（使用Web端一致的模板化Prompt）

    Args:
        outline: 场景大纲
        language: 语言
        language_directive: 语言指令（从大纲生成阶段传递）
        model: LLM 模型
        agents: 智能体信息列表（用于构建teacherContext）
        image_enabled: 是否启用图片生成
        video_enabled: 是否启用视频生成

    Returns:
        场景内容（JSON）
    """
    # 构建教师人设上下文
    teacher_context = format_teacher_persona_for_prompt(agents)

    # 构建语言指令
    lang_directive = language_directive or f"Output all content in {language} language."

    if outline.type == "slide":
        # 使用Web端一致的slide-content模板
        system_prompt, user_prompt = build_prompt(
            "slide-content",
            {
                "title": outline.title,
                "description": outline.description,
                "keyPoints": ", ".join(outline.key_points or []),
                "teacherContext": teacher_context,
                "languageDirective": lang_directive,
                "canvas_width": 1000,
                "canvas_height": 562,
                "imageElementEnabled": False,  # 暂不支持源图片
                "generatedImageEnabled": image_enabled,
                "generatedVideoEnabled": video_enabled,
            },
            conditions={
                "imageElementEnabled": False,
                "generatedImageEnabled": image_enabled,
                "generatedVideoEnabled": video_enabled,
            }
        )

        # 如果模板加载失败，使用fallback
        if not system_prompt or not user_prompt:
            logger.warning("[SceneGenerator] slide-content template not found, using fallback")
            from app.services.generation.prompts.slide_content_simple import (
                SLIDE_CONTENT_SYSTEM_PROMPT,
                SLIDE_CONTENT_USER_TEMPLATE,
            )
            system_prompt = SLIDE_CONTENT_SYSTEM_PROMPT
            user_prompt = SLIDE_CONTENT_USER_TEMPLATE.format(
                title=outline.title,
                type=outline.type,
                description=outline.description,
                key_points=", ".join(outline.key_points or []),
                language=language,
                teacher_context=teacher_context,
            )

    elif outline.type == "quiz":
        # 使用 Web 端一致的 quiz-content 模板
        widget_outline = getattr(outline, 'widget_outline', {}) or {}
        system_prompt, user_prompt = build_prompt(
            "quiz-content",
            {
                "title": outline.title,
                "description": outline.description,
                "keyPoints": ", ".join(outline.key_points or []),
                "questionCount": widget_outline.get("questionCount", 5),
                "difficulty": widget_outline.get("difficulty", "medium"),
                "questionTypes": widget_outline.get("questionTypes", "single,multiple,short_answer"),
                "languageDirective": lang_directive,
                "teacherContext": teacher_context,
            }
        )
        if not system_prompt or not user_prompt:
            logger.warning("[SceneGenerator] quiz-content template not found, using minimal fallback")
            system_prompt = "你是测验内容生成专家。只输出JSON。"
            user_prompt = (
                f"标题：{outline.title}\n"
                f"描述：{outline.description}\n"
                f"要点：{', '.join(outline.key_points or [])}\n"
                f"{lang_directive}\n"
                "生成 3-5 道题，类型 single/multiple/short_answer，每道附 analysis 与 points。\n"
                # 与 Web 端 quiz-content 模板输出保持一致的字段命名（answer/options/analysis/points）
                "直接输出 JSON 数组 [{\"id\":\"q1\",\"type\":\"single\",\"question\":\"...\",\"options\":[\"A\",\"B\"],\"answer\":[\"A\"],\"analysis\":\"...\",\"points\":5}]"
            )

    elif outline.type == "interactive":
        # Interactive场景 - 使用widget模板
        widget_type = getattr(outline, 'widget_type', None) or 'simulation'
        widget_outline = getattr(outline, 'widget_outline', {}) or {}
        widget_prompt_id = _resolve_widget_prompt_id(widget_type)

        # 构建模板参数，确保 language 参数存在
        template_vars = {
            "title": outline.title,
            "description": outline.description,
            "keyPoints": ", ".join(outline.key_points or []),
            "languageDirective": lang_directive,
            "language": language,  # 为 interactive-html 模板提供 language 参数
            "teacherContext": teacher_context,
            # Widget特定参数
            **widget_outline,
        }

        system_prompt, user_prompt = build_prompt(
            widget_prompt_id,
            template_vars
        )

        if not system_prompt or not user_prompt:
            logger.warning(f"[SceneGenerator] {widget_prompt_id} template not found for widget_type={widget_type}, using default")
            return {"type": "interactive", "content": {}, "widgetType": widget_type}

    else:
        # pbl等其他类型暂时返回默认结构
        return {"type": outline.type, "content": {}}

    logger.info(f"[SceneGenerator] Generating content for: {outline.title} ({outline.type})")
    logger.debug(f"[SceneGenerator] System prompt length: {len(system_prompt) if system_prompt else 0}, User prompt length: {len(user_prompt) if user_prompt else 0}")

    # 场景驱动的模型选择
    router = get_model_router()
    scene_type = _get_scene_type_for_generation(outline.type)

    if model:
        selected_model = model
    else:
        selected_model = router.get_model_for_scene(scene_type)
        logger.info(f"[SceneGenerator] 场景 {scene_type.value} 选择模型: {selected_model}")

    # 使用流式调用避免超时
    try:
        chunks = []
        async for chunk in stream_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model=selected_model,
            temperature=0.7,
            max_tokens=4096,
            scene_type=scene_type,
        ):
            chunks.append(chunk)

        response = "".join(chunks)
        logger.info(f"[SceneGenerator] Stream completed, response length: {len(response)}")
    except Exception as e:
        logger.warning(f"[SceneGenerator] Stream failed, falling back to non-stream: {e}")
        response = await call_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model=selected_model,
            temperature=0.7,
            max_tokens=4096,
            scene_type=scene_type,
        )

    # 解析JSON
    content = parse_json_response(response, outline.type)

    # 后处理
    if outline.type == "slide" and content.get("canvas"):
        content = fix_element_format(content)

    # Interactive场景添加widgetType标记
    if outline.type == "interactive":
        content["widgetType"] = getattr(outline, 'widget_type', 'simulation')

    return content


def parse_json_response(response: str, content_type: str) -> Dict[str, Any]:
    """
    增强的JSON解析（处理LLM输出的各种异常）

    Args:
        response: LLM原始响应
        content_type: 内容类型。quiz 分支要求返回 JSON 数组，会被包装成
                      {"type": "quiz", "questions": [...]}。其他类型默认按 JSON 对象解析。

    Returns:
        解析后的JSON字典
    """
    try:
        cleaned = response.strip()

        # 移除 markdown 代码块标记（仅剥首尾的围栏，避免损坏内部反引号）
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```\s*$", "", cleaned, flags=re.S).strip()

        # quiz 场景下 LLM 输出为 JSON 数组，需优先尝试数组解析
        if content_type == "quiz":
            start_bracket = cleaned.find("[")
            end_bracket = cleaned.rfind("]")
            if start_bracket != -1 and end_bracket > start_bracket:
                arr_text = cleaned[start_bracket:end_bracket + 1]
                arr = json.loads(arr_text)
                if isinstance(arr, list):
                    return {"type": "quiz", "questions": arr}
            # 如果模型返了对象包装格式（如 {"questions":[...]}），回落对象解析

        # 通用对象解析
        start_brace = cleaned.find("{")
        if start_brace != -1:
            cleaned = cleaned[start_brace:]

        end_brace = cleaned.rfind("}")
        if end_brace != -1:
            cleaned = cleaned[:end_brace + 1]

        parsed = json.loads(cleaned.strip())

        # quiz 回落路径：若对象缺少 type 或 questions，补全为标准形式
        if content_type == "quiz" and isinstance(parsed, dict):
            questions = parsed.get("questions")
            if isinstance(questions, list):
                return {"type": "quiz", "questions": questions}

        return parsed

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


def _build_agents_block(agents: Optional[List[Dict[str, Any]]], limit: int = 3, exclude_teacher: bool = True) -> str:
    """构建 agents 介绍文本块（供 actions 模板使用）。

    Args:
        agents: 智能体列表
        limit: 最多展示几个
        exclude_teacher: 默认排除 role=teacher 的智能体，避免与 teacherContext 信息重复
    """
    if not agents:
        return ""
    filtered = [a for a in agents if not (exclude_teacher and a.get("role") == "teacher")]
    if not filtered:
        return ""
    lines = [
        f"- {a.get('name', 'Agent')} ({a.get('role', 'assistant')}): {a.get('persona', '专业讲师')}"
        for a in filtered[:limit]
    ]
    return "## 讲解智能体\n" + "\n".join(lines)


def _actions_prompt_id(scene_type: str) -> str:
    """根据场景类型返回对应的 actions 模板 ID"""
    mapping = {
        "slide": "slide-actions",
        "quiz": "quiz-actions",
        "interactive": "interactive-actions",
        "pbl": "pbl-actions",
    }
    return mapping.get(scene_type, "slide-actions")


def _normalize_actions(raw_items: List[Any]) -> List[Action]:
    """将模板输出的统一 {type,name,params} / {type:'text',content} 格式规范化为库内 Action。

    未知 / 未支持的项会记录 warning 日志以便排查。
    """
    results: List[Action] = []
    for item in raw_items:
        if not isinstance(item, dict):
            logger.warning(f"[actions] skip non-dict item: {item!r}")
            continue
        item_type = item.get("type")
        if item_type == "text":
            # 文本/语音
            results.append(Action(
                id=item.get("id") or str(uuid.uuid4()),
                type="speech",
                data={"text": item.get("content", "")},
            ))
        elif item_type == "action":
            name = item.get("name", "")
            params = item.get("params", {}) or {}
            if name in ("spotlight", "laser"):
                # 合并顺序：先清洗 params、再优先映射 target_element_id，避免被 params 里的同名键覆盖
                sanitized = {k: v for k, v in params.items() if k not in ("elementId", "target_element_id")}
                target_id = params.get("target_element_id") or params.get("elementId")
                results.append(Action(
                    id=item.get("id") or str(uuid.uuid4()),
                    type=name,
                    data={**sanitized, "target_element_id": target_id},
                ))
            elif name == "discussion":
                results.append(Action(
                    id=item.get("id") or str(uuid.uuid4()),
                    type="discussion",
                    data=params,
                ))
            else:
                logger.warning(f"[actions] skip unsupported action name: {name!r}")
        elif item_type in ("speech", "spotlight", "laser", "discussion", "wb_draw_text", "wb_draw_shape"):
            # 兼容旧格式
            results.append(Action(
                id=item.get("id") or str(uuid.uuid4()),
                type=item_type,
                data=item.get("data", {}),
            ))
        else:
            logger.warning(f"[actions] skip unrecognized type: {item_type!r}")
    return results


async def generate_scene_actions(
    outline: SceneOutline,
    content: Dict[str, Any],
    language: str = "zh-CN",
    model: Optional[str] = None,
    agents: Optional[List[Dict[str, Any]]] = None,
) -> List[Action]:
    """
    生成 Agent Actions（讲解行为）- 使用模板化 Prompt，按场景类型分派

    Args:
        outline: 场景大纲
        content: 场景内容
        language: 语言
        model: LLM 模型
        agents: 智能体信息列表（用于个性化讲解）

    Returns:
        Action 列表
    """
    scene_type = outline.type or "slide"
    prompt_id = _actions_prompt_id(scene_type)

    teacher_context = format_teacher_persona_for_prompt(agents)
    agents_block = _build_agents_block(agents)
    lang_directive = f"Output all content in {language} language."

    # 按场景类型构造模板变量
    common_vars = {
        "title": outline.title,
        "description": outline.description or "",
        "keyPoints": ", ".join(outline.key_points or []),
        "teacherContext": teacher_context,
        "agents": agents_block,
        "courseContext": "",
        "userProfile": "",
        "languageDirective": lang_directive,
    }

    if scene_type == "slide":
        common_vars["elements"] = format_elements_info(content)
    elif scene_type == "quiz":
        questions = content.get("questions", []) if isinstance(content, dict) else []
        common_vars["questions"] = "\n".join([
            f"- [{q.get('type', 'single')}] {q.get('question', '')}" for q in (questions[:10] if isinstance(questions, list) else [])
        ]) or "暂无题目"
    elif scene_type == "interactive":
        widget_outline = getattr(outline, 'widget_outline', {}) or {}
        common_vars["conceptName"] = widget_outline.get("conceptName") or outline.title
        common_vars["designIdea"] = widget_outline.get("designIdea", "")
    elif scene_type == "pbl":
        widget_outline = getattr(outline, 'widget_outline', {}) or {}
        common_vars["projectTopic"] = widget_outline.get("projectTopic") or outline.title
        common_vars["projectDescription"] = widget_outline.get("projectDescription") or outline.description or ""

    system_prompt, user_prompt = build_prompt(prompt_id, common_vars)

    # 模板不存在时的最简化 fallback（保障流程不断）
    if not system_prompt or not user_prompt:
        logger.warning(f"[SceneGenerator] {prompt_id} template missing, using fallback")
        system_prompt = "你是教学动作设计师，只输出 JSON 数组。"
        user_prompt = (
            f"标题：{outline.title}\n"
            f"要点：{', '.join(outline.key_points or [])}\n"
            f"{lang_directive}\n"
            "输出 JSON 数组 [{\"type\":\"text\",\"content\":\"...\"}]"
        )

    logger.info(f"[SceneGenerator] Generating actions for {outline.title} ({scene_type}) via {prompt_id}")

    # 场景驱动的模型选择（actions使用AGENT_CHAT场景）
    router = get_model_router()
    selected_model = model or router.get_model_for_scene(SceneType.AGENT_CHAT)
    logger.info(f"[SceneGenerator] Actions生成选择模型: {selected_model}")

    # 使用流式调用避免 DashScope 30s 超时
    try:
        chunks = []
        async for chunk in stream_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model=selected_model,
            temperature=0.7,
            max_tokens=2048,
            scene_type=SceneType.AGENT_CHAT,
        ):
            chunks.append(chunk)
        response = "".join(chunks)
    except Exception as stream_error:
        logger.warning(f"[SceneGenerator] Stream failed, fallback to non-stream: {stream_error}")
        response = await call_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model=selected_model,
            temperature=0.7,
            max_tokens=2048,
            scene_type=SceneType.AGENT_CHAT,
        )

    # 解析 JSON 数组
    cleaned = response.strip()
    try:
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
        start_bracket = cleaned.find("[")
        if start_bracket != -1:
            cleaned = cleaned[start_bracket:]
        end_bracket = cleaned.rfind("]")
        if end_bracket != -1:
            cleaned = cleaned[:end_bracket + 1]

        raw_items = json.loads(cleaned)
        if not isinstance(raw_items, list):
            raise ValueError("actions response is not a JSON array")

        actions = _normalize_actions(raw_items)
        if not actions:
            raise ValueError("no valid action parsed")
        return actions

    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
        logger.warning(f"[SceneGenerator] Actions解析失败: {e}, cleaned content: {cleaned[:500]}")
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