"""
大纲生成器 - 两阶段生成管道 Stage 1
"""

import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.services.llm import call_llm, stream_llm
import uuid
import logging
import time

logger = logging.getLogger(__name__)

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


OUTLINE_SYSTEM_PROMPT = """你是课程设计专家。根据需求生成教学大纲JSON数组。

输出格式要求：
- JSON数组，每个场景包含：id, title, type, description, order, key_points
- type可选：slide/quiz/interactive/pbl
- key_points是核心要点列表
- 只输出JSON，无其他内容

示例：
[{"id":"scene_1","title":"课程简介","type":"slide","description":"介绍课程主题","order":1,"key_points":["概述","目标"]}]
"""

OUTLINE_USER_PROMPT_TEMPLATE = """需求：{requirement}
语言：{language}
参考材料：{pdf_content}
可用图片：{available_images}

请生成课程大纲JSON数组。"""


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

    # 调用 LLM（减少 max_tokens 避免超时）
    response = await call_llm(
        prompt=user_prompt,
        system_prompt=OUTLINE_SYSTEM_PROMPT,
        model=model,
        temperature=0.7,
        max_tokens=2048,  # 从4096减少，避免GLM-5推理时间过长
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
        # 解析失败，返回智能默认大纲
        return generate_smart_default_outlines(requirement, language)


async def stream_outlines(
    requirement: str,
    pdf_content: Optional[str] = None,
    language: str = "zh-CN",
    model: Optional[str] = None,
    agent_ids: Optional[List[str]] = None,
    web_search: bool = False,
    total_count: int = 5,  # 默认生成5个大纲
):
    """
    流式生成大纲（逐个生成，每个大纲单独调用 LLM）

    Yields:
        解析出的场景大纲（逐个返回）
    """
    start_time = time.time()
    logger.info(f"[Outline] 开始流式生成 - requirement={requirement[:50]}..., count={total_count}")

    # 先生成大纲列表框架（标题和类型）
    logger.info(f"[Outline] 步骤1: 生成大纲标题列表")
    try:
        outline_titles = await generate_outline_titles(
            requirement, language, model, total_count
        )
        elapsed = time.time() - start_time
        logger.info(f"[Outline] 标题列表生成完成 - {len(outline_titles)} 个标题 (耗时: {elapsed:.1f}s)")
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[Outline] 标题列表生成失败 (耗时: {elapsed:.1f}s): {e}")
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
        logger.info(f"[Outline] 使用默认标题列表 - {len(outline_titles)} 个")

    # 然后逐个生成每个大纲的详细内容
    logger.info(f"[Outline] 步骤2: 逐个生成大纲详情")
    for i, outline_info in enumerate(outline_titles):
        outline_start = time.time()
        try:
            logger.info(f"[Outline] 生成大纲 #{i+1}: {outline_info.get('title', '')}")
            outline = await generate_single_outline(
                requirement=requirement,
                outline_info=outline_info,
                order=i + 1,
                language=language,
                model=model,
            )
            outline_elapsed = time.time() - outline_start
            logger.info(f"[Outline] 大纲 #{i+1} 完成 - {outline.title} (耗时: {outline_elapsed:.1f}s)")
            yield outline
        except Exception as e:
            outline_elapsed = time.time() - outline_start
            logger.warning(f"[Outline] 大纲 #{i+1} 生成失败 (耗时: {outline_elapsed:.1f}s): {e}")
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
    logger.info(f"[Outline] 流式生成完成 - 总耗时: {total_elapsed:.1f}s")


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

    system_prompt = """你是课程设计专家。根据需求快速生成课程大纲的标题列表。

输出格式：JSON数组，每个元素包含 title, type, description
- type: slide/quiz/interactive/pbl
- description: 简短的一句话描述
- 只输出JSON，无其他内容

示例：
[{"title":"课程简介","type":"slide","description":"介绍课程主题和学习目标"}]
"""

    user_prompt = f"""需求：{requirement}
语言：{language}
请生成 {total_count} 个课程大纲的标题列表。"""

    # 使用更多重试次数
    logger.info(f"[Titles] 调用LLM - model={model}")
    try:
        response = await call_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model=model,
            temperature=0.7,
            max_tokens=1024,
            max_retries=5,  # 增加重试次数
        )
        elapsed = time.time() - start_time
        logger.info(f"[Titles] LLM响应完成 (耗时: {elapsed:.1f}s), 响应长度: {len(response)}")
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[Titles] LLM调用失败 (耗时: {elapsed:.1f}s): {e}")
        raise

    # 解析 JSON
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
        # 解析失败，返回默认标题
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
- 只输出JSON，无其他内容

示例：
{"id":"scene_1","title":"课程简介","type":"slide","description":"介绍课程主题","order":1,"key_points":["概述","目标","安排"]}
"""

    user_prompt = f"""需求：{requirement}
大纲标题：{outline_info.get('title', '')}
大纲类型：{outline_info.get('type', 'slide')}
简述：{outline_info.get('description', '')}
序号：{order}
语言：{language}

请生成这个大纲的详细内容，包含 key_points。"""

    logger.info(f"[Single] 调用LLM - model={model}")
    try:
        response = await call_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model=model,
            temperature=0.7,
            max_tokens=512,
            max_retries=5,  # 增加重试次数
        )
        elapsed = time.time() - start_time
        logger.info(f"[Single] LLM响应完成 (耗时: {elapsed:.1f}s), 响应长度: {len(response)}")
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[Single] LLM调用失败 (耗时: {elapsed:.1f}s): {e}")
        raise

    # 解析 JSON
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
        # 解析失败，返回基本信息
        return SceneOutline(
            id=str(uuid.uuid4()),
            title=outline_info.get("title", f"场景 {order}"),
            type=outline_info.get("type", "slide"),
            description=outline_info.get("description", ""),
            order=order,
            key_points=["内容要点"],
        )


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

def generate_smart_default_outlines(
    requirement: str,
    language: str = "zh-CN",
    agent_ids: Optional[List[str]] = None,
) -> List[SceneOutline]:
    """
    根据需求内容生成智能默认大纲（当LLM不可用时使用）

    Args:
        requirement: 用户需求描述
        language: 语言
        agent_ids: 智能体ID列表

    Returns:
        场景大纲列表
    """
    # 分析需求关键词，提取主题
    topic_keywords = {
        "python": "Python", "编程": "编程", "代码": "代码", "函数": "函数",
        "变量": "变量", "循环": "循环", "算法": "算法",
        "数学": "数学", "物理": "物理", "化学": "化学", "生物": "生物",
        "历史": "历史", "地理": "地理", "英语": "英语", "写作": "写作",
        "设计": "设计", "绘画": "绘画", "音乐": "音乐",
    }

    detected_topic = "课程"
    for keyword, topic in topic_keywords.items():
        if keyword.lower() in requirement.lower():
            detected_topic = topic
            break

    # 检测目标受众
    audience_keywords = {
        "小学生": "小学生", "初中生": "初中生", "高中生": "高中生",
        "大学生": "大学生", "成人": "成人学习者", "初学者": "初学者", "入门": "初学者",
    }
    detected_audience = "学习者" if language == "zh-CN" else "learners"
    for keyword, audience in audience_keywords.items():
        if keyword in requirement:
            detected_audience = audience
            break

    # 是否有智能体配置
    has_agents = agent_ids and len(agent_ids) > 0

    if language == "zh-CN":
        outlines = [
            SceneOutline(id=str(uuid.uuid4()), title=f"{detected_topic}课程简介", type="slide",
                description=f"介绍{detected_topic}课程的主题、学习目标和课程安排，面向{detected_audience}",
                order=1, key_points=["课程主题概述", "学习目标说明", "课程结构介绍"]),
            SceneOutline(id=str(uuid.uuid4()), title="基础概念讲解", type="slide",
                description=f"讲解{detected_topic}的基础概念和核心术语",
                order=2, key_points=["核心概念定义", "术语解释", "基础原理说明"]),
            SceneOutline(id=str(uuid.uuid4()), title="核心内容深入", type="slide",
                description=f"深入讲解{detected_topic}的核心内容和重要知识点",
                order=3, key_points=["重点知识讲解", "典型案例分析", "实际应用示例"]),
        ]
        if has_agents:
            outlines.append(SceneOutline(id=str(uuid.uuid4()), title="互动讨论环节", type="interactive",
                description="智能体与学员互动讨论，答疑解惑", order=4, key_points=["问题讨论", "案例互动", "答疑环节"]))
        outlines.extend([
            SceneOutline(id=str(uuid.uuid4()), title="知识检测", type="quiz",
                description=f"通过测验检验{detected_topic}学习效果",
                order=5 if has_agents else 4, key_points=["基础题目测试", "进阶题目挑战", "学习效果评估"]),
            SceneOutline(id=str(uuid.uuid4()), title="总结与延伸", type="slide",
                description=f"总结{detected_topic}课程要点，提供延伸学习建议",
                order=6 if has_agents else 5, key_points=["要点总结回顾", "延伸学习建议", "课后作业布置"]),
        ])
    else:
        outlines = [
            SceneOutline(id=str(uuid.uuid4()), title=f"{detected_topic} Course Introduction", type="slide",
                description=f"Introduction to {detected_topic} for {detected_audience}",
                order=1, key_points=["Course overview", "Learning objectives", "Course structure"]),
            SceneOutline(id=str(uuid.uuid4()), title="Basic Concepts", type="slide",
                description=f"Explanation of {detected_topic} fundamentals",
                order=2, key_points=["Core concepts", "Key terminology", "Basic principles"]),
            SceneOutline(id=str(uuid.uuid4()), title="Core Content", type="slide",
                description=f"Deep dive into {detected_topic} key topics",
                order=3, key_points=["Key topics", "Case analysis", "Practical examples"]),
        ]
        if has_agents:
            outlines.append(SceneOutline(id=str(uuid.uuid4()), title="Interactive Discussion", type="interactive",
                description="Interactive discussion with AI agents", order=4, key_points=["Discussion", "Q&A session"]))
        outlines.extend([
            SceneOutline(id=str(uuid.uuid4()), title="Knowledge Assessment", type="quiz",
                description=f"Test understanding of {detected_topic}",
                order=5 if has_agents else 4, key_points=["Basic questions", "Advanced challenges"]),
            SceneOutline(id=str(uuid.uuid4()), title="Summary & Extension", type="slide",
                description=f"Summary of {detected_topic} key points",
                order=6 if has_agents else 5, key_points=["Key summary", "Extension suggestions", "Homework"]),
        ])

    return outlines
