"""
Prompt 模板管理系统 - 统一管理所有生成场景的 Prompt
"""

from typing import Dict, Any, Optional

# Prompt ID 常量
class PROMPT_IDS:
    REQUIREMENTS_TO_OUTLINES = "requirements_to_outlines"
    SCENE_CONTENT_SLIDE = "scene_content_slide"
    SCENE_CONTENT_QUIZ = "scene_content_quiz"
    SCENE_CONTENT_INTERACTIVE = "scene_content_interactive"
    SCENE_CONTENT_PBL = "scene_content_pbl"
    SCENE_ACTIONS = "scene_actions"
    AGENT_PROFILES = "agent_profiles"
    WEB_SEARCH_QUERY_REWRITE = "web_search_query_rewrite"


# Prompt 模板定义
PROMPTS: Dict[str, Dict[str, str]] = {
    # 大纲生成
    PROMPT_IDS.REQUIREMENTS_TO_OUTLINES: {
        "system": """你是一个教学大纲生成专家。根据用户需求生成结构化的教学大纲。

输出要求：
1. 生成 5-15 个场景大纲
2. 每个场景包含：id, title, type, description, order
3. 场景类型：slide（幻灯片）、quiz（测验）、interactive（互动）、pbl（项目学习）
4. 只输出 JSON 数组，不要其他内容

场景类型分布建议：
- slide: 70%（主要内容讲解）
- quiz: 15%（知识检验）
- interactive: 10%（互动讨论）
- pbl: 5%（项目实践）""",
        "user": """请根据以下需求生成教学大纲：

## 用户需求
{requirement}

## 语言
{language}

## PDF 内容摘要
{pdf_content}

## 可用图片
{available_images}

## 研究上下文
{research_context}

## 媒体生成策略
{media_generation_policy}

## 教师角色上下文
{teacher_context}

输出格式：
[
  {
    "id": "场景ID",
    "title": "场景标题",
    "type": "slide|quiz|interactive|pbl",
    "description": "场景描述",
    "order": 场景顺序数字,
    "key_points": ["要点1", "要点2", "要点3"],
    "suggestedImageIds": ["建议使用的图片ID"]
  }
]""",
    },

    # 幻灯片内容生成
    PROMPT_IDS.SCENE_CONTENT_SLIDE: {
        "system": """你是一个教学幻灯片内容生成专家。根据大纲生成完整的幻灯片内容。

输出要求：
1. 生成 canvas 结构（包含元素列表）
2. 元素类型包括：text, image, shape, chart, latex, table
3. 布局合理，视觉美观
4. 只输出 JSON，不要其他内容""",
        "user": """请根据以下大纲生成幻灯片内容：

## 场景大纲
标题：{title}
类型：{type}
描述：{description}
要点：{key_points}

## 语言
{language}

## 可用图片
{available_images}

## 教师上下文
{teacher_context}

输出格式：
{
  "type": "slide",
  "canvas": {
    "width": 1000,
    "height": 562,
    "background": "#ffffff",
    "elements": [
      {
        "id": "element_1",
        "type": "text",
        "content": "标题内容",
        "position": {"left": 50, "top": 50, "width": 900, "height": 100},
        "style": {"fontSize": 48, "color": "#333333"}
      }
    ]
  }
}""",
    },

    # 测验内容生成
    PROMPT_IDS.SCENE_CONTENT_QUIZ: {
        "system": """你是一个教学测验生成专家。根据大纲生成测验问题。

输出要求：
1. 生成 3-5 个测验问题
2. 问题类型：single（单选）、multiple（多选）、short_answer（简答）
3. 提供正确答案和解析
4. 只输出 JSON，不要其他内容""",
        "user": """请根据以下大纲生成测验内容：

## 场景大纲
标题：{title}
描述：{description}
要点：{key_points}

## 语言
{language}

输出格式：
{
  "type": "quiz",
  "questions": [
    {
      "id": "q_1",
      "type": "single",
      "question": "问题文本",
      "options": [{"label": "选项A", "value": "A"}, {"label": "选项B", "value": "B"}],
      "answer": ["A"],
      "analysis": "解析文本"
    }
  ]
}""",
    },

    # 互动内容生成
    PROMPT_IDS.SCENE_CONTENT_INTERACTIVE: {
        "system": """你是一个教学互动活动设计专家。根据大纲生成互动内容。

输出要求：
1. 设计互动讨论主题和引导问题
2. 设计角色扮演或小组活动
3. 只输出 JSON，不要其他内容""",
        "user": """请根据以下大纲生成互动内容：

## 场景大纲
标题：{title}
描述：{description}
要点：{key_points}

## 语言
{language}

输出格式：
{
  "type": "interactive",
  "activities": [
    {
      "id": "act_1",
      "type": "discussion",
      "title": "讨论主题",
      "questions": ["引导问题1", "引导问题2"],
      "duration": 10
    }
  ]
}""",
    },

    # PBL 项目生成
    PROMPT_IDS.SCENE_CONTENT_PBL: {
        "system": """你是一个项目式学习（PBL）设计专家。根据大纲生成项目任务。

输出要求：
1. 设计项目任务和目标
2. 设计评估标准
3. 只输出 JSON，不要其他内容""",
        "user": """请根据以下大纲生成 PBL 项目内容：

## 场景大纲
标题：{title}
描述：{description}
要点：{key_points}

## 语言
{language}

输出格式：
{
  "type": "pbl",
  "project": {
    "title": "项目标题",
    "description": "项目描述",
    "tasks": [
      {"id": "task_1", "title": "任务1", "description": "任务描述", "duration": 30}
    ],
    "deliverables": ["成果要求1", "成果要求2"],
    "rubric": [{"criterion": "评估标准", "maxScore": 10}]
  }
}""",
    },

    # 场景动作生成
    PROMPT_IDS.SCENE_ACTIONS: {
        "system": """你是一个教学场景动作设计专家。根据场景内容生成 Agent 讲解行为。

输出要求：
1. 生成讲解行为序列（speech, spotlight, wb_draw 等）
2. speech 文本要自然流畅
3. 每个元素对应讲解动作
4. 只输出 JSON 数组，不要其他内容""",
        "user": """请根据场景内容生成 Agent 讲解行为：

## 场景信息
标题：{title}
类型：{type}
内容：{content_json}

## 上下文
页码：{page_index} / {total_pages}
所有标题：{all_titles}
前序讲解：{previous_speeches}

## 语言
{language}

## 教师/Agent 上下文
{teacher_context}

## 用户信息
{user_profile}

输出格式：
[
  {
    "id": "action_1",
    "type": "speech",
    "data": {"text": "讲解文本", "elementId": "element_1"}
  },
  {
    "id": "action_2",
    "type": "spotlight",
    "data": {"elementId": "element_1", "dimOpacity": 0.5}
  }
]""",
    },

    # 智能体配置生成
    PROMPT_IDS.AGENT_PROFILES: {
        "system": """你是一个智能体角色设计专家。为课程生成多个智能体角色配置。

输出要求：
1. 生成 3-5 个智能体
2. 必须有 1 个 teacher 角色
3. 其他角色可以是 assistant 或 student
4. 只输出 JSON，不要其他内容""",
        "user": """请为以下课程生成智能体角色：

## 课程信息
名称：{stage_name}
描述：{stage_description}

## 场景大纲
{scene_outlines}

## 语言
{language}

## 可用头像
{available_avatars}

## 头像描述
{avatar_descriptions}

## 可用语音
{available_voices}

## 颜色调色板
{color_palette}

输出格式：
{
  "agents": [
    {
      "name": "角色名称",
      "role": "teacher|assistant|student",
      "persona": "角色性格描述（2-3句话）",
      "avatar": "头像路径",
      "color": "#颜色代码",
      "priority": 10,
      "voice": "voice_id（如果有）"
    }
  ]
}""",
    },

    # 网络搜索查询重写
    PROMPT_IDS.WEB_SEARCH_QUERY_REWRITE: {
        "system": """你是一个搜索查询优化专家。根据用户需求和上下文生成最优搜索查询。

输出要求：
1. 输出一个优化后的搜索查询字符串
2. 只输出查询文本，不要其他内容""",
        "user": """请根据以下需求优化搜索查询：

## 用户需求
{requirement}

## PDF 内容摘要
{pdf_content}

## 原始需求语言
{language}

输出：优化后的搜索查询（保留关键信息，去掉冗余）""",
    },
}


def build_prompt(prompt_id: str, variables: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """
    构建 Prompt，替换变量

    Args:
        prompt_id: Prompt ID
        variables: 变量字典

    Returns:
        {system, user} Prompt 字典，如果模板不存在返回 None
    """
    template = PROMPTS.get(prompt_id)
    if not template:
        return None

    system = template["system"]
    user = template["user"]

    # 替换变量
    for key, value in variables.items():
        placeholder = "{" + key + "}"
        # 处理 None 值
        if value is None:
            value = ""
        # 处理列表和字典
        if isinstance(value, (list, dict)):
            import json
            value = json.dumps(value, ensure_ascii=False)
        user = user.replace(placeholder, str(value))

    return {"system": system, "user": user}


def get_prompt(prompt_id: str) -> Optional[Dict[str, str]]:
    """
    获取 Prompt 模板（不替换变量）

    Args:
        prompt_id: Prompt ID

    Returns:
        {system, user} Prompt 字典
    """
    return PROMPTS.get(prompt_id)


# Agent 颜色调色板
AGENT_COLOR_PALETTE = [
    "#5b9bd5",  # 蓝色 - teacher
    "#10b981",  # 绿色 - assistant
    "#f59e0b",  # 橙色 - student
    "#8b5cf6",  # 紫色
    "#ef4444",  # 红色
    "#06b6d4",  # 青色
    "#84cc16",  # 黄绿色
    "#f97316",  # 深橙色
]