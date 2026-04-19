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
        # 解析失败，返回智能默认大纲
        return generate_smart_default_outlines(requirement, language)


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
