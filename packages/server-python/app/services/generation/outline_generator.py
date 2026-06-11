"""
大纲生成器 - 与Web端一致的实现

使用模板化prompt + 流式生成 + heartbeat + 重试机制
支持场景驱动的模型路由
"""

import json
import asyncio
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.services.llm import call_llm, stream_llm
from app.services.model_router import SceneType, get_model_router
from app.services.generation.prompts import build_prompt, PROMPT_IDS
import uuid
import logging
import time

logger = logging.getLogger(__name__)


# 关键词 → widget 类型映射（用于智能推断）
_WIDGET_TYPE_KEYWORDS: Dict[str, list] = {
    "simulation": [
        "力", "运动", "速度", "加速度", "抛体", "波动", "电路", "电压", "电流",
        "化学反应", "分子", "pH", "细胞", "生态",
        "函数", "图像", "概率", "统计分布",
        "force", "motion", "velocity", "projectile", "wave", "circuit",
        "reaction", "molecule", "cell", "ecosystem",
        "function", "graph", "probability",
    ],
    "visualization3d": [
        "3D", "三维", "立体", "分子结构", "原子", "太阳系", "行星", "轨道",
        "骨骼", "器官", "解剖", "几何体", "体积",
        "molecular", "solar system", "planet", "orbit",
        "anatomy", "organ", "geometry", "3d",
    ],
    "code": [
        "编程", "代码", "算法", "数据结构", "排序", "搜索", "递归",
        "Python", "JavaScript", "Java", "C++",
        "programming", "code", "algorithm", "data structure",
        "sorting", "recursion",
    ],
    "game": [
        "挑战", "游戏", "竞速", "着陆", "射击", "闯关", "练习",
        "challenge", "game", "racing", "landing", "shooting",
    ],
    "diagram": [
        "流程", "架构", "系统", "决策树", "思维导图", "层次", "关系",
        "process", "architecture", "system", "decision tree",
        "mind map", "hierarchy", "relationship",
    ],
}


def _infer_widget_type(outline: "SceneOutline") -> str:
    """根据大纲标题和描述中的关键词推断最合适的 widget 类型。"""
    text = f"{outline.title} {outline.description} {' '.join(outline.key_points or [])}".lower()

    best_type = "simulation"
    best_score = 0

    for widget_type, keywords in _WIDGET_TYPE_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw.lower() in text)
        if score > best_score:
            best_score = score
            best_type = widget_type

    return best_type


def _build_widget_outline(outline: "SceneOutline") -> Dict[str, Any]:
    """根据推断的 widget 类型构建对应的 widgetOutline 配置。"""
    widget_type = outline.widget_type or _infer_widget_type(outline)
    title = outline.title
    description = outline.description or ""
    key_points = outline.key_points or []

    if widget_type == "simulation":
        return {
            "conceptName": title,
            "subject": "综合学习",
            "conceptOverview": description,
            "keyPoints": ", ".join(key_points),
            "scientificConstraints": "模拟需遵循物理/数学规律",
            "designIdea": "可调参数的交互式模拟，用户通过滑块或拖拽控制变量，实时观察变化",
        }
    elif widget_type == "visualization3d":
        return {
            "visualizationType": "custom",
            "objects": key_points[:5] if key_points else [title],
            "interactions": ["orbit", "zoom", "speed_slider"],
            "conceptName": title,
            "conceptOverview": description,
        }
    elif widget_type == "code":
        return {
            "language": "python",
            "challengeType": "concept_demo",
            "conceptName": title,
            "conceptOverview": description,
            "keyPoints": ", ".join(key_points),
        }
    elif widget_type == "game":
        return {
            "gameType": "action",
            "challenge": description,
            "playerControls": key_points[:3] if key_points else ["interact"],
            "conceptName": title,
        }
    elif widget_type == "diagram":
        return {
            "diagramType": "flowchart",
            "nodeCount": max(5, len(key_points) * 2),
            "conceptName": title,
            "conceptOverview": description,
            "keyPoints": ", ".join(key_points),
        }
    else:
        # html fallback
        return {
            "conceptName": title,
            "subject": "综合学习",
            "conceptOverview": description,
            "keyPoints": ", ".join(key_points),
            "scientificConstraints": "互动内容需符合教学逻辑",
            "designIdea": "交互式学习界面",
        }


class SceneOutline(BaseModel):
    """场景大纲（与Web端一致）"""
    id: str
    title: str
    type: str  # slide, quiz, interactive, pbl
    description: str
    order: int
    key_points: Optional[List[str]] = []
    estimated_duration: Optional[int] = None
    media_generations: Optional[List[Dict]] = None
    suggested_image_ids: Optional[List[str]] = None
    quiz_config: Optional[Dict] = None  # quiz场景配置
    interactive_config: Optional[Dict] = None  # interactive场景配置 (deprecated)
    pbl_config: Optional[Dict] = None  # pbl场景配置
    # Widget字段（Web端新功能）
    widget_type: Optional[str] = None  # simulation, game, diagram, code, visualization3d
    widget_outline: Optional[Dict] = None  # Widget配置
    # 语言指令（从大纲生成阶段传递给场景内容生成）
    language_directive: Optional[str] = None


# 增量JSON解析器（与Web端一致）
def extract_new_outlines(buffer: str, already_parsed: int) -> List[Dict]:
    """
    从部分JSON数组中提取已完成的对象
    """
    results = []

    array_start = buffer.find("[")
    if array_start == -1:
        return results

    stripped = buffer[array_start:]
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


# 最大PDF内容长度（与Web端一致）
MAX_PDF_CONTENT_CHARS = 8000


async def generate_outlines(
    requirement: str,
    pdf_content: Optional[str] = None,
    language: str = "zh-CN",
    model: Optional[str] = None,
    agent_ids: Optional[List[str]] = None,
    web_search: bool = False,
    web_search_context: Optional[str] = None,
    agents: Optional[List[Dict]] = None,
) -> List[SceneOutline]:
    """
    生成课程大纲（使用Web端一致的prompt模板）

    Args:
        requirement: 用户需求文本
        pdf_content: PDF文档内容
        language: 课程语言
        model: LLM模型名称
        agent_ids: 智能体ID列表
        web_search: 是否启用网络搜索增强
        web_search_context: 网络搜索结果内容
        agents: 完整agent信息列表，用于构建teacherContext（与Web端一致）

    Returns:
        场景大纲列表
    """
    start_time = time.time()
    logger.info(f"[Outline] 开始生成 - requirement={requirement[:50]}...")

    # 构建teacherContext（与Web端一致）
    teacher_context = ""
    if agents and len(agents) > 0:
        teacher_agent = None
        for agent in agents:
            if agent.get("role") == "teacher":
                teacher_agent = agent
                break
        if teacher_agent:
            teacher_context = f"""## Teacher Persona

The primary teacher for this course is:
- Name: {teacher_agent.get('name', 'Teacher')}
- Role: {teacher_agent.get('role', 'teacher')}
- Persona: {teacher_agent.get('persona', 'A professional teacher')}

Design the course content and teaching style to match this teacher's persona."""

    # 构建变量（与Web端user.md一致）
    variables = {
        "requirement": requirement,
        "language": language,
        "pdfContent": (pdf_content[:MAX_PDF_CONTENT_CHARS] if pdf_content else ("无" if language == "zh-CN" else "None")),
        "availableImages": ("无可用图片" if language == "zh-CN" else "No images available"),
        "researchContext": web_search_context or ("无" if language == "zh-CN" else "None"),
        "mediaGenerationPolicy": "",  # 媒体生成策略，默认空
        "teacherContext": teacher_context,  # 教师上下文
        "userProfile": "",  # 用户画像，暂时空
    }

    # 加载prompt模板
    system_prompt, user_prompt = build_prompt(
        PROMPT_IDS["REQUIREMENTS_TO_OUTLINES"],
        variables
    )

    if not system_prompt or not user_prompt:
        logger.warning("[Outline] Prompt模板加载失败，使用默认prompt")
        # Fallback到简化prompt
        system_prompt = """你是课程设计专家。根据需求生成教学大纲JSON数组。
输出格式：JSON数组，每个场景包含：id, title, type, description, order, key_points
type可选：slide/quiz
最后一个场景必须是slide类型的课程总结
只输出JSON，无其他内容"""
        user_prompt = f"""需求：{requirement}
语言：{language}
参考材料：{pdf_content or "无"}
请生成课程大纲JSON数组。"""

    # 调用LLM（与Web端一致：保持system/user分离）
    try:
        logger.info(f"[Outline] System prompt长度: {len(system_prompt)} 字符")
        logger.info(f"[Outline] User prompt长度: {len(user_prompt)} 字符")

        # 场景驱动的模型选择
        router = get_model_router()
        selected_model = model or router.get_model_for_scene(SceneType.OUTLINE_GENERATION)
        logger.info(f"[Outline] 场景 {SceneType.OUTLINE_GENERATION.value} 选择模型: {selected_model}")

        response = await call_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,  # 与Web端一致：分离system/user
            model=selected_model,
            temperature=0.7,
            max_tokens=4096,
            scene_type=SceneType.OUTLINE_GENERATION,
        )

        elapsed = time.time() - start_time
        logger.info(f"[Outline] LLM响应完成 (耗时: {elapsed:.1f}s), 响应长度: {len(response)}")

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[Outline] LLM调用失败 (耗时: {elapsed:.1f}s): {e}")
        # 返回智能默认大纲
        return generate_smart_default_outlines(requirement, language, agent_ids)

    # 解析JSON（新格式：包含 languageDirective 和 outlines）
    try:
        cleaned = response.strip()
        # 去除markdown包装
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        # 尝试解析为对象（新格式）
        parsed_data = json.loads(cleaned)

        # 提取 languageDirective
        language_directive = None
        outlines_data = None

        if isinstance(parsed_data, dict):
            # 新格式：{"languageDirective": "...", "outlines": [...]}
            language_directive = parsed_data.get("languageDirective")
            outlines_data = parsed_data.get("outlines", [])
            logger.info(f"[Outline] 新格式解析成功 - languageDirective存在: {language_directive is not None}, {len(outlines_data)} 个大纲")
        elif isinstance(parsed_data, list):
            # 旧格式：直接返回数组
            outlines_data = parsed_data
            logger.info(f"[Outline] 旧格式解析成功 - {len(outlines_data)} 个大纲")
        else:
            logger.warning(f"[Outline] 无法识别的JSON格式")
            return generate_smart_default_outlines(requirement, language, agent_ids)

        # 转换为SceneOutline
        outlines = []
        for i, item in enumerate(outlines_data):
            outline = SceneOutline(
                id=item.get("id") or str(uuid.uuid4()),
                title=item.get("title", f"场景 {i+1}"),
                type=item.get("type", "slide"),
                description=item.get("description", ""),
                order=item.get("order", i+1),
                key_points=item.get("key_points", item.get("keyPoints", [])),  # 兼容两种命名
                estimated_duration=item.get("estimated_duration"),
                media_generations=item.get("media_generations"),
                suggested_image_ids=item.get("suggestedImageIds"),
                quiz_config=item.get("quizConfig"),
                interactive_config=item.get("interactiveConfig"),
                pbl_config=item.get("pblConfig"),
                # Widget字段（Web端新功能）
                widget_type=item.get("widgetType"),
                widget_outline=item.get("widgetOutline"),
            )

            # 为 interactive 场景补充智能 widget 配置（如果 LLM 未提供）
            if outline.type == "interactive" and not outline.widget_type:
                outline.widget_type = _infer_widget_type(outline)
                outline.widget_outline = _build_widget_outline(outline)
                logger.info(f"[Outline] 为 interactive 场景 '{outline.title}' 推断 widget 类型: {outline.widget_type}")

            # 存储 languageDirective 到大纲对象（传递给后续生成）
            if language_directive:
                outline.language_directive = language_directive
            outlines.append(outline)

        total_elapsed = time.time() - start_time
        logger.info(f"[Outline] 完成 - {len(outlines)} 个大纲 (总耗时: {total_elapsed:.1f}s)")

        # 返回大纲列表，附带 languageDirective
        # 注：将 languageDirective 存储在第一个大纲的属性中
        return outlines

    except json.JSONDecodeError as e:
        elapsed = time.time() - start_time
        logger.warning(f"[Outline] JSON解析失败 (耗时: {elapsed:.1f}s): {e}")
        return generate_smart_default_outlines(requirement, language, agent_ids)


async def stream_generate_outlines(
    requirement: str,
    pdf_content: Optional[str] = None,
    language: str = "zh-CN",
    model: Optional[str] = None,
    agent_ids: Optional[List[str]] = None,
    web_search: bool = False,
    web_search_context: Optional[str] = None,
    agents: Optional[List[Dict]] = None,
):
    """
    流式生成大纲（与Web端一致：单次LLM流式调用，实时解析JSON数组）

    使用 stream_llm 流式调用，逐块解析JSON数组中的大纲对象，
    实时yield返回每个解析完成的大纲。

    Args:
        agents: 完整agent信息列表，用于构建teacherContext（与Web端一致）
    """
    start_time = time.time()
    logger.info(f"[StreamOutline] 开始流式生成 - requirement={requirement[:50]}...")

    # 构建teacherContext（与Web端一致）
    teacher_context = ""
    if agents and len(agents) > 0:
        teacher_agent = None
        for agent in agents:
            if agent.get("role") == "teacher":
                teacher_agent = agent
                break
        if teacher_agent:
            teacher_context = f"""## Teacher Persona

The primary teacher for this course is:
- Name: {teacher_agent.get('name', 'Teacher')}
- Role: {teacher_agent.get('role', 'teacher')}
- Persona: {teacher_agent.get('persona', 'A professional teacher')}

Design the course content and teaching style to match this teacher's persona."""

    # 构建变量（与Web端一致）
    variables = {
        "requirement": requirement,
        "language": language,
        "pdfContent": (pdf_content[:MAX_PDF_CONTENT_CHARS] if pdf_content else ("无" if language == "zh-CN" else "None")),
        "availableImages": ("无可用图片" if language == "zh-CN" else "No images available"),
        "researchContext": web_search_context or ("无" if language == "zh-CN" else "None"),
        "mediaGenerationPolicy": "",
        "teacherContext": teacher_context,
        "userProfile": "",
    }

    # 加载prompt模板
    system_prompt, user_prompt = build_prompt(
        PROMPT_IDS["REQUIREMENTS_TO_OUTLINES"],
        variables
    )

    if not system_prompt or not user_prompt:
        logger.warning("[StreamOutline] Prompt模板加载失败，使用默认prompt")
        system_prompt = """你是课程设计专家。根据需求生成教学大纲JSON数组。
输出格式：JSON数组，每个场景包含：id, title, type, description, order, key_points
只输出JSON，无其他内容"""
        user_prompt = f"""需求：{requirement}
语言：{language}
请生成课程大纲JSON数组。"""

    # 使用 stream_llm 流式调用
    full_text = ""
    parsed_count = 0

    # 场景驱动的模型选择
    router = get_model_router()
    selected_model = model or router.get_model_for_scene(SceneType.OUTLINE_GENERATION)
    logger.info(f"[StreamOutline] 场景 {SceneType.OUTLINE_GENERATION.value} 选择模型: {selected_model}")

    try:
        logger.info(f"[StreamOutline] System prompt长度: {len(system_prompt)} 字符")
        logger.info(f"[StreamOutline] User prompt长度: {len(user_prompt)} 字符")

        async for chunk in stream_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model=selected_model,
            temperature=0.7,
            max_tokens=4096,
            scene_type=SceneType.OUTLINE_GENERATION,
        ):
            full_text += chunk

            # 尝试从累积文本中提取新的大纲对象
            new_outlines = extract_new_outlines(full_text, parsed_count)
            for outline_data in new_outlines:
                parsed_count += 1
                outline = SceneOutline(
                    id=outline_data.get("id") or str(uuid.uuid4()),
                    title=outline_data.get("title", f"场景 {parsed_count}"),
                    type=outline_data.get("type", "slide"),
                    description=outline_data.get("description", ""),
                    order=outline_data.get("order", parsed_count),
                    key_points=outline_data.get("key_points", outline_data.get("keyPoints", [])),  # 兼容两种命名
                    estimated_duration=outline_data.get("estimated_duration"),
                    media_generations=outline_data.get("media_generations"),
                    quiz_config=outline_data.get("quizConfig"),
                    interactive_config=outline_data.get("interactiveConfig"),
                    pbl_config=outline_data.get("pblConfig"),
                    # Widget字段（Web端新功能）
                    widget_type=outline_data.get("widgetType"),
                    widget_outline=outline_data.get("widgetOutline"),
                )

                # 为 interactive 场景补充智能 widget 配置（如果 LLM 未提供）
                if outline.type == "interactive" and not outline.widget_type:
                    outline.widget_type = _infer_widget_type(outline)
                    outline.widget_outline = _build_widget_outline(outline)
                    logger.info(f"[StreamOutline] 为 interactive 场景 '{outline.title}' 推断 widget 类型: {outline.widget_type}")

                elapsed = time.time() - start_time
                logger.info(f"[StreamOutline] 大纲 #{parsed_count} 解析完成 - {outline.title} (耗时: {elapsed:.1f}s)")
                yield outline

        elapsed = time.time() - start_time
        logger.info(f"[StreamOutline] 流式生成完成 - 共 {parsed_count} 个大纲 (总耗时: {elapsed:.1f}s)")

        # 如果没有解析出任何大纲，返回默认大纲
        if parsed_count == 0:
            logger.warning("[StreamOutline] 未解析出大纲，使用默认大纲")
            for outline in generate_smart_default_outlines(requirement, language, agent_ids):
                yield outline

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[StreamOutline] 流式生成失败 (耗时: {elapsed:.1f}s): {e}")
        # 失败时返回默认大纲
        for outline in generate_smart_default_outlines(requirement, language, agent_ids):
            yield outline


async def generate_outline_titles(
    requirement: str,
    language: str,
    model: Optional[str],
    total_count: int,
) -> List[Dict]:
    """
    生成大纲标题列表（快速，只确定标题和类型）
    """
    start_time = time.time()
    logger.info(f"[Titles] 开始生成标题列表 - count={total_count}")

    # 简化prompt（标题列表生成不需要完整模板）
    system_prompt = """你是课程设计专家。根据需求快速生成课程大纲的标题列表。

输出格式：JSON数组，每个元素包含 title, type, description
- type: slide/quiz
- description: 简短的一句话描述
- 只输出JSON，无其他内容"""

    user_prompt = f"""需求：{requirement}
语言：{language}
请生成 {total_count} 个课程大纲的标题列表。

注意：
- 第一个场景是课程简介
- 最后一个场景是slide类型的"课程总结"或"总结回顾"
- 中间穿插quiz场景检验学习效果
- 只使用slide和quiz两种类型"""

    try:
        response = await call_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,  # 与Web端一致：分离system/user
            model=model,
            temperature=0.7,
            max_tokens=1024,
        )

        elapsed = time.time() - start_time
        logger.info(f"[Titles] LLM响应完成 (耗时: {elapsed:.1f}s), 响应长度: {len(response)}")

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[Titles] LLM调用失败 (耗时: {elapsed:.1f}s): {e}")
        raise

    # 解析JSON
    try:
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        titles = json.loads(cleaned)
        logger.info(f"[Titles] JSON解析成功 - {len(titles)} 个标题")
        return titles if isinstance(titles, list) else []

    except json.JSONDecodeError as e:
        logger.warning(f"[Titles] JSON解析失败: {e}, 使用默认标题")
        # 返回默认标题
        if language == "zh-CN":
            return [
                {"title": "课程简介", "type": "slide", "description": "介绍课程主题和学习目标"},
                {"title": "核心内容", "type": "slide", "description": "讲解核心知识点"},
                {"title": "深入讲解", "type": "slide", "description": "深入探讨重点内容"},
                {"title": "知识检测", "type": "quiz", "description": "检验学习效果"},
                {"title": "总结回顾", "type": "slide", "description": "回顾课程要点"},
            ]
        else:
            return [
                {"title": "Introduction", "type": "slide", "description": "Course overview and objectives"},
                {"title": "Core Content", "type": "slide", "description": "Key concepts explanation"},
                {"title": "Deep Dive", "type": "slide", "description": "Detailed discussion"},
                {"title": "Quiz", "type": "quiz", "description": "Knowledge check"},
                {"title": "Summary", "type": "slide", "description": "Key takeaways"},
            ]


async def generate_single_outline(
    requirement: str,
    outline_info: Dict,
    order: int,
    language: str,
    model: Optional[str],
) -> SceneOutline:
    """
    生成单个大纲的详细内容
    """
    start_time = time.time()
    title = outline_info.get('title', '')
    logger.info(f"[Single] 开始生成大纲 #{order}: {title}")

    system_prompt = """你是课程设计专家。根据标题生成单个课程大纲的详细内容。

输出格式：JSON对象，包含 id, title, type, description, order, key_points
- key_points: 3-5个核心要点列表
- 只输出JSON，无其他内容"""

    user_prompt = f"""需求：{requirement}
大纲标题：{outline_info.get('title', '')}
大纲类型：{outline_info.get('type', 'slide')}
简述：{outline_info.get('description', '')}
序号：{order}
语言：{language}

请生成这个大纲的详细内容，包含 key_points。"""

    try:
        response = await call_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,  # 与Web端一致：分离system/user
            model=model,
            temperature=0.7,
            max_tokens=512,
        )

        elapsed = time.time() - start_time
        logger.info(f"[Single] LLM响应完成 (耗时: {elapsed:.1f}s), 响应长度: {len(response)}")

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[Single] LLM调用失败 (耗时: {elapsed:.1f}s): {e}")
        raise

    # 解析JSON
    try:
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        data = json.loads(cleaned)
        logger.info(f"[Single] JSON解析成功 - title={data.get('title', title)}")

        return SceneOutline(
            id=data.get("id") or str(uuid.uuid4()),
            title=data.get("title") or outline_info.get("title", f"场景 {order}"),
            type=data.get("type") or outline_info.get("type", "slide"),
            description=data.get("description") or outline_info.get("description", ""),
            order=data.get("order") or order,
            key_points=data.get("key_points", []),
        )

    except json.JSONDecodeError as e:
        logger.warning(f"[Single] JSON解析失败: {e}, 使用基本信息")
        return SceneOutline(
            id=str(uuid.uuid4()),
            title=outline_info.get("title", f"场景 {order}"),
            type=outline_info.get("type", "slide"),
            description=outline_info.get("description", ""),
            order=order,
            key_points=["内容要点"],
        )


async def stream_outlines(
    requirement: str,
    pdf_content: Optional[str] = None,
    language: str = "zh-CN",
    model: Optional[str] = None,
    agent_ids: Optional[List[str]] = None,
    web_search: bool = False,
    total_count: int = 5,
):
    """
    流式生成大纲（逐个生成，每个大纲单独调用 LLM）

    这是旧版本的流式生成，保留向后兼容
    """
    start_time = time.time()
    logger.info(f"[Stream] 开始流式生成 - requirement={requirement[:50]}..., count={total_count}")

    # 先生成大纲列表框架（标题和类型）
    logger.info(f"[Stream] 步骤1: 生成大纲标题列表")
    try:
        outline_titles = await generate_outline_titles(
            requirement, language, model, total_count
        )
        elapsed = time.time() - start_time
        logger.info(f"[Stream] 标题列表生成完成 - {len(outline_titles)} 个标题 (耗时: {elapsed:.1f}s)")
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[Stream] 标题列表生成失败 (耗时: {elapsed:.1f}s): {e}")
        # 使用默认标题
        if language == "zh-CN":
            outline_titles = [
                {"title": "课程简介", "type": "slide", "description": "介绍课程主题和学习目标"},
                {"title": "核心内容", "type": "slide", "description": "讲解核心知识点"},
                {"title": "深入讲解", "type": "slide", "description": "深入探讨重点内容"},
                {"title": "知识检测", "type": "quiz", "description": "检验学习效果"},
                {"title": "总结回顾", "type": "slide", "description": "回顾课程要点"},
            ]
        else:
            outline_titles = [
                {"title": "Introduction", "type": "slide", "description": "Course overview and objectives"},
                {"title": "Core Content", "type": "slide", "description": "Key concepts explanation"},
                {"title": "Deep Dive", "type": "slide", "description": "Detailed discussion"},
                {"title": "Quiz", "type": "quiz", "description": "Knowledge check"},
                {"title": "Summary", "type": "slide", "description": "Key takeaways"},
            ]
        logger.info(f"[Stream] 使用默认标题列表 - {len(outline_titles)} 个")

    # 然后逐个生成每个大纲的详细内容
    logger.info(f"[Stream] 步骤2: 逐个生成大纲详情")
    for i, outline_info in enumerate(outline_titles):
        outline_start = time.time()
        try:
            logger.info(f"[Stream] 生成大纲 #{i+1}: {outline_info.get('title', '')}")
            outline = await generate_single_outline(
                requirement=requirement,
                outline_info=outline_info,
                order=i + 1,
                language=language,
                model=model,
            )
            outline_elapsed = time.time() - outline_start
            logger.info(f"[Stream] 大纲 #{i+1} 完成 - {outline.title} (耗时: {outline_elapsed:.1f}s)")
            yield outline
        except Exception as e:
            outline_elapsed = time.time() - outline_start
            logger.warning(f"[Stream] 大纲 #{i+1} 生成失败 (耗时: {outline_elapsed:.1f}s): {e}")
            # 失败时使用默认内容
            yield SceneOutline(
                id=str(uuid.uuid4()),
                title=outline_info.get("title", f"场景 {i+1}"),
                type=outline_info.get("type", "slide"),
                description=outline_info.get("description", ""),
                order=i + 1,
                key_points=["内容要点"],
            )

    total_elapsed = time.time() - start_time
    logger.info(f"[Stream] 流式生成完成 - 总耗时: {total_elapsed:.1f}s")


def generate_smart_default_outlines(
    requirement: str,
    language: str = "zh-CN",
    agent_ids: Optional[List[str]] = None,
) -> List[SceneOutline]:
    """
    根据需求内容生成智能默认大纲（当LLM不可用时使用）
    """
    # 分析需求关键词，提取主题
    topic_keywords = {
        "python": "Python", "编程": "编程", "代码": "代码", "函数": "函数",
        "变量": "变量", "循环": "循环", "算法": "算法",
        "数学": "数学", "物理": "物理", "化学": "化学", "生物": "生物",
        "历史": "历史", "地理": "地理", "英语": "英语", "写作": "写作",
        "设计": "设计", "绘画": "绘画", "音乐": "音乐",
        "市场": "市场营销", "营销": "市场营销", "商业": "商业",
        "swot": "SWOT分析", "战略": "战略管理",
    }

    detected_topic = "课程"
    for keyword, topic in topic_keywords.items():
        if keyword.lower() in requirement.lower():
            detected_topic = topic
            break

    # 是否有智能体配置
    has_agents = agent_ids and len(agent_ids) > 0

    outlines: List[SceneOutline] = []

    if language == "zh-CN":
        outlines.extend([
            SceneOutline(id=str(uuid.uuid4()), title=f"{detected_topic}课程简介", type="slide",
                description=f"介绍{detected_topic}课程的主题、学习目标",
                order=1, key_points=["课程主题概述", "学习目标说明", "课程结构介绍"]),
            SceneOutline(id=str(uuid.uuid4()), title="基础概念讲解", type="slide",
                description=f"讲解{detected_topic}的基础概念和核心术语",
                order=2, key_points=["核心概念定义", "术语解释", "基础原理说明"]),
            SceneOutline(id=str(uuid.uuid4()), title="核心内容深入", type="slide",
                description=f"深入讲解{detected_topic}的核心内容和重要知识点",
                order=3, key_points=["重点知识讲解", "典型案例分析", "实际应用示例"]),
        ])
        if has_agents:
            outlines.append(SceneOutline(id=str(uuid.uuid4()), title="互动讨论环节", type="slide",
                description="智能体与学员互动讨论，答疑解惑", order=4, key_points=["问题讨论", "案例互动", "答疑环节"]))
        outlines.extend([
            SceneOutline(id=str(uuid.uuid4()), title="知识检测", type="quiz",
                description=f"通过测验检验{detected_topic}学习效果",
                order=5 if has_agents else 4, key_points=["基础题目测试", "进阶题目挑战", "学习效果评估"],
                quiz_config={"questionCount": 2, "difficulty": "medium", "questionTypes": ["single", "multiple"]}),
            SceneOutline(id=str(uuid.uuid4()), title="总结与延伸", type="slide",
                description=f"总结{detected_topic}课程要点，提供延伸学习建议",
                order=6 if has_agents else 5, key_points=["要点总结回顾", "延伸学习建议", "课后作业布置"]),
            SceneOutline(id=str(uuid.uuid4()), title="课程完成", type="slide",
                description="恭喜完成课程学习，回顾学习成果",
                order=7 if has_agents else 6, key_points=["学习成果回顾", "下一步建议", "鼓励与祝福"]),
        ])
    else:
        outlines.extend([
            SceneOutline(id=str(uuid.uuid4()), title=f"{detected_topic} Introduction", type="slide",
                description=f"Introduction to {detected_topic}",
                order=1, key_points=["Course overview", "Learning objectives", "Course structure"]),
            SceneOutline(id=str(uuid.uuid4()), title="Basic Concepts", type="slide",
                description=f"Explanation of {detected_topic} fundamentals",
                order=2, key_points=["Core concepts", "Key terminology", "Basic principles"]),
            SceneOutline(id=str(uuid.uuid4()), title="Core Content", type="slide",
                description=f"Deep dive into {detected_topic}",
                order=3, key_points=["Key topics", "Case analysis", "Practical examples"]),
        ])
        if has_agents:
            outlines.append(SceneOutline(id=str(uuid.uuid4()), title="Interactive Discussion", type="slide",
                description="Interactive discussion with AI agents", order=4, key_points=["Discussion", "Q&A session"]))
        outlines.extend([
            SceneOutline(id=str(uuid.uuid4()), title="Knowledge Assessment", type="quiz",
                description=f"Test understanding of {detected_topic}",
                order=5 if has_agents else 4, key_points=["Basic questions", "Advanced challenges"],
                quiz_config={"questionCount": 2, "difficulty": "medium", "questionTypes": ["single", "multiple"]}),
            SceneOutline(id=str(uuid.uuid4()), title="Summary & Extension", type="slide",
                description=f"Summary of {detected_topic} key points",
                order=6 if has_agents else 5, key_points=["Key summary", "Extension suggestions", "Homework"]),
            SceneOutline(id=str(uuid.uuid4()), title="Course Complete", type="slide",
                description="Congratulations on completing the course, review your achievements",
                order=7 if has_agents else 6, key_points=["Achievement review", "Next steps", "Encouragement"]),
        ])

    return outlines


def uniquify_media_element_ids(outlines: List[SceneOutline]) -> List[SceneOutline]:
    """
    确保mediaGenerations中的elementId全局唯一（与Web端一致）
    """
    global_counter = {"img": 0, "vid": 0}

    for outline in outlines:
        if outline.media_generations:
            for media in outline.media_generations:
                old_id = media.get("elementId", "")
                if old_id.startswith("gen_img_"):
                    global_counter["img"] += 1
                    media["elementId"] = f"gen_img_{global_counter['img']}"
                elif old_id.startswith("gen_vid_"):
                    global_counter["vid"] += 1
                    media["elementId"] = f"gen_vid_{global_counter['vid']}"

    return outlines