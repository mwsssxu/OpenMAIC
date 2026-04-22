"""
场景生成器 - 两阶段生成管道 Stage 2
"""

import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.services.llm import call_llm
from app.services.generation.outline_generator import SceneOutline
import uuid


class SlideElement(BaseModel):
    """幻灯片元素"""
    id: str
    type: str  # text, image, shape, chart, latex, table
    content: Any
    position: Dict[str, float]
    style: Optional[Dict] = None


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


SCENE_SYSTEM_PROMPT = """
你是一个教学场景内容生成专家。根据大纲生成完整的教学内容。

输出要求：
1. 对于 slide 类型：生成 canvas 结构（包含元素列表）
2. 对于 quiz 类型：生成问题列表
3. 对于 interactive 类型：生成 HTML 代码
4. 对于 pbl 类型：生成项目配置

只输出 JSON，不要其他内容。
"""

SLIDE_USER_PROMPT_TEMPLATE = """
请根据以下大纲生成幻灯片内容：

## 场景大纲
标题：{title}
类型：{type}
描述：{description}

## 语言
{language}

## 要求
1. 生成幻灯片画布内容（canvas.elements）
2. 元素类型包括：text, image, shape, chart, latex, table
3. 布局合理，视觉美观
4. 内容与大纲描述一致

输出格式：
{{"type": "slide", "canvas": {{'width': 1000, 'height': 562, 'background': '#ffffff', 'elements': [{{'id': 'element_1', 'type': 'text', 'content': '标题内容', 'position': {{'left': 50, 'top': 50, 'width': 900, 'height': 100}}, 'style': {{'fontSize': 48, 'color': '#333333'}}}}]}}}}
"""

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
    生成场景内容

    Args:
        outline: 场景大纲
        language: 语言
        model: LLM 模型

    Returns:
        场景内容（JSON）
    """
    if outline.type == "slide":
        prompt = SLIDE_USER_PROMPT_TEMPLATE.format(
            title=outline.title,
            type=outline.type,
            description=outline.description,
            language=language,
        )
    elif outline.type == "quiz":
        prompt = QUIZ_USER_PROMPT_TEMPLATE.format(
            title=outline.title,
            description=outline.description,
            language=language,
        )
    else:
        # interactive / pbl 暂时返回默认结构
        return {"type": outline.type, "content": {}}

    response = await call_llm(
        prompt=prompt,
        system_prompt=SCENE_SYSTEM_PROMPT,
        model=model,
        temperature=0.7,
        max_tokens=4096,
    )

    # 解析 JSON（改进清理逻辑）
    try:
        cleaned = response.strip()
        # 移除 markdown 代码块标记
        if "```" in cleaned:
            # 找到第一个 ``` 后的内容
            start_idx = cleaned.find("```")
            if start_idx != -1:
                # 跳过 ```json 或 ```
                rest = cleaned[start_idx:]
                if rest.startswith("```json"):
                    cleaned = rest[7:]
                elif rest.startswith("```"):
                    cleaned = rest[3:]
                # 移除结尾的 ```
                end_idx = cleaned.find("```")
                if end_idx != -1:
                    cleaned = cleaned[:end_idx]

        cleaned = cleaned.strip()
        # 尝试找到 JSON 对象的起始位置
        start_brace = cleaned.find("{")
        if start_brace != -1:
            cleaned = cleaned[start_brace:]

        # 找到最后一个 }
        end_brace = cleaned.rfind("}")
        if end_brace != -1:
            cleaned = cleaned[:end_brace + 1]

        return json.loads(cleaned.strip())
    except Exception as e:
        import logging
        logging.warning(f"JSON 解析失败: {e}, response: {response[:200]}")
        return {"type": outline.type, "content": {}}


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
内容：{content_json}

## 语言
{language}

## 要求
生成讲解行为序列，包括：
1. speech - 语音讲解（必需，每段讲解对应一个元素）
2. spotlight - 聚焦元素（可选）
3. wb_draw_text - 白板绘制文字（可选）
4. wb_draw_shape - 白板绘制形状（可选）

输出格式：
[{{'id': 'action_1', 'type': 'speech', 'data': {{'text': '讲解文本内容', 'elementId': 'element_1'}}}}, {{'id': 'action_2', 'type': 'spotlight', 'data': {{'elementId': 'element_1', 'dimOpacity': 0.5}}}}]

只输出 JSON 数组。
"""

    prompt = ACTIONS_PROMPT.format(
        title=outline.title,
        content_json=json.dumps(content, ensure_ascii=False)[:2000],
        language=language,
    )

    response = await call_llm(
        prompt=prompt,
        system_prompt="你是 Agent 行为设计专家。只输出 JSON 数组。",
        model=model,
        temperature=0.7,
        max_tokens=2048,
    )

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
    except:
        # 返回默认讲解
        return [
            Action(
                id=str(uuid.uuid4()),
                type="speech",
                data={"text": f"现在我们来学习 {outline.title}"},
            )
        ]


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