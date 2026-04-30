"""
知识提取服务 - AI从课程场景内容提取关键知识点
"""

import json
from typing import List, Dict, Any, Optional
from app.services.llm import call_llm
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


# 提取知识点的系统提示
EXTRACT_SYSTEM_PROMPT = """
你是一个知识提取专家。你的任务是从课程内容中提取关键知识点。

提取要求：
1. 识别核心概念、定义、公式、关键术语
2. 每个知识点包含：标题、内容、摘要、关键要点列表
3. 自动归类到技能类别（programming, data, business, language, design, math, science, general）
4. 提取的知识点应该便于记忆和复习

输出格式：
返回 JSON 数组，每个元素包含：
{
  "title": "知识点标题（简洁）",
  "content": "完整内容描述",
  "summary": "一句话摘要",
  "key_points": ["要点1", "要点2", "要点3"],
  "skill_category": "技能类别"
}

只输出 JSON 数组，不要其他内容。
"""

EXTRACT_USER_PROMPT_TEMPLATE = """
请从以下课程内容中提取关键知识点：

## 课程名称
{course_name}

## 场景标题
{scene_title}

## 场景内容
{scene_content}

## 要求
1. 提取 2-5 个核心知识点
2. 每个知识点应该是一个独立的可记忆单元
3. 标题简洁明了（不超过20字）
4. 内容描述清晰，便于理解
5. 摘要一句话概括核心
6. key_points 是记忆要点（2-4个）

请输出 JSON 格式的知识点数组。
"""


async def extract_knowledge_points(
    scene_title: str,
    scene_content: Dict[str, Any],
    course_name: str,
    model: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    从场景内容提取知识点

    Args:
        scene_title: 场景标题
        scene_content: 场景内容（包含 canvas, actions 等）
        course_name: 课程名称
        model: LLM 模型

    Returns:
        知识点列表
    """
    # 构建场景内容摘要
    content_summary = build_content_summary(scene_content)

    user_prompt = EXTRACT_USER_PROMPT_TEMPLATE.format(
        course_name=course_name,
        scene_title=scene_title,
        scene_content=content_summary,
    )

    try:
        response = await call_llm(
            prompt=user_prompt,
            system_prompt=EXTRACT_SYSTEM_PROMPT,
            model=model or settings.DEFAULT_MODEL,
            temperature=0.3,  # 较低温度，确保提取准确
            max_tokens=2048,
        )

        # 解析 JSON
        cleaned = response.strip()

        # 移除 markdown 代码块标记
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

        cleaned = cleaned.strip()

        # 找到 JSON 数组
        start_idx = cleaned.find("[")
        if start_idx != -1:
            cleaned = cleaned[start_idx:]

        end_idx = cleaned.rfind("]")
        if end_idx != -1:
            cleaned = cleaned[:end_idx + 1]

        knowledge_points = json.loads(cleaned)

        # 验证 LLM 返回结构
        if not isinstance(knowledge_points, list):
            raise ValueError("LLM 返回的不是数组")

        for kp in knowledge_points:
            if not isinstance(kp, dict):
                raise ValueError("知识点必须是字典对象")
            if not isinstance(kp.get("title"), str) or not kp.get("title"):
                raise ValueError("知识点必须包含有效的标题")
            if not isinstance(kp.get("content"), str) or not kp.get("content"):
                raise ValueError("知识点必须包含有效的内容")
            # 设置默认值
            kp.setdefault("summary", kp["title"])
            kp.setdefault("key_points", [])
            kp.setdefault("skill_category", "general")

        logger.info(f"[KnowledgeExtractor] Extracted {len(knowledge_points)} points from scene '{scene_title}'")

        return knowledge_points

    except json.JSONDecodeError as e:
        logger.warning(f"[KnowledgeExtractor] JSON parse failed: {e}")
        # 返回默认知识点
        return [{
            "title": scene_title,
            "content": f"来自课程《{course_name}》的 {scene_title} 内容",
            "summary": f"课程核心内容：{scene_title}",
            "key_points": ["理解核心概念", "掌握关键技能"],
            "skill_category": "general",
        }]

    except Exception as e:
        logger.error(f"[KnowledgeExtractor] Extraction failed: {e}")
        raise


def build_content_summary(scene_content: Dict[str, Any]) -> str:
    """
    构建场景内容摘要，用于 AI 提取

    Args:
        scene_content: 场景内容

    Returns:
        内容摘要文本
    """
    summary_parts = []

    # 处理 canvas 元素
    if scene_content and "canvas" in scene_content:
        canvas = scene_content["canvas"]
        if "elements" in canvas:
            for element in canvas.get("elements", [])[:10]:  # 只取前10个元素
                el_type = element.get("type", "")
                if el_type == "text":
                    content = element.get("content", "")
                    if content:
                        summary_parts.append(f"文本: {content[:100]}")
                elif el_type == "shape":
                    summary_parts.append(f"形状: {element.get('style', {}).get('backgroundColor', '未知')}")
                elif el_type == "image":
                    summary_parts.append("图片内容")
                elif el_type == "chart":
                    summary_parts.append(f"图表: {element.get('content', '数据可视化')}")

    # 处理 actions
    if scene_content and "actions" in scene_content:
        for action in scene_content.get("actions", [])[:5]:
            action_type = action.get("type", "")
            if action_type == "speech":
                text = action.get("data", {}).get("text", "")
                if text:
                    summary_parts.append(f"讲解: {text[:150]}")

    if not summary_parts:
        return "场景内容为空或无法解析"

    return "\n".join(summary_parts)


async def categorize_knowledge(
    title: str,
    content: str,
    model: Optional[str] = None,
) -> str:
    """
    自动归类知识点到技能类别

    Args:
        title: 知识点标题
        content: 知识点内容
        model: LLM 模型

    Returns:
        技能类别 ID
    """
    CATEGORIZE_PROMPT = f"""
请将以下知识点归类到最合适的技能类别：

标题: {title}
内容: {content}

可选类别：
- programming: 编程开发
- data: 数据分析
- business: 商业策略
- language: 语言学习
- design: 设计创作
- math: 数学逻辑
- science: 科学知识
- general: 通用知识

只输出类别 ID（一个单词），不要其他内容。
"""

    try:
        response = await call_llm(
            prompt=CATEGORIZE_PROMPT,
            system_prompt="你是一个知识分类助手，只输出类别ID。",
            model=model or settings.DEFAULT_MODEL,
            temperature=0.1,
            max_tokens=20,
        )

        category = response.strip().lower()

        valid_categories = ["programming", "data", "business", "language", "design", "math", "science", "general"]

        if category in valid_categories:
            return category

        return "general"

    except Exception:
        return "general"