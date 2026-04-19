"""
Agent Profiles 生成器 - 根据课程信息生成智能体配置
"""

import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.services.llm import call_llm
import uuid

class AgentProfile(BaseModel):
    """智能体配置"""
    id: str
    name: str
    role: str  # teacher, assistant, student
    persona: str
    avatar: str
    color: str
    priority: int
    enabled: bool = True


# Agent颜色调色板
AGENT_COLOR_PALETTE = [
    "#5b9bd5",  # 蓝色 - 老师
    "#10b981",  # 绿色 - 助教
    "#f59e0b",  # 橙色 - 学生
    "#8b5cf6",  # 紫色
    "#06b6d4",  # 青色
    "#ef4444",  # 红色
    "#ec4899",  # 粉色
    "#84cc16",  # 黄绿色
]

# 默认头像列表
DEFAULT_AVATARS = [
    "teacher.png",
    "assistant.png",
    "student1.png",
    "student2.png",
    "student3.png",
]


AGENT_SYSTEM_PROMPT = """
你是一个专业的课程设计专家。你的任务是根据课程信息，生成合适的智能体配置。

智能体类型：
- teacher: 主讲老师，负责讲解核心内容，priority=10
- assistant: 助教，负责辅助讲解和答疑，priority=7
- student: 学生角色，负责提问互动，priority=4-6

输出要求：
1. 返回 JSON 对象，包含 agents 数组
2. 必须有且仅有1个 teacher
3. 根据课程复杂度决定智能体数量（通常3-5个）
4. 每个智能体包含：name, role, persona, avatar, color, priority
5. persona 是2-3句话描述智能体的性格和教学/学习风格
6. 所有智能体使用不同颜色
7. 只输出 JSON，不要其他内容

示例输出格式：
{
  "agents": [
    {
      "name": "张老师",
      "role": "teacher",
      "persona": "资深教师，讲解清晰有条理，善于用例子说明复杂概念。",
      "avatar": "teacher.png",
      "color": "#5b9bd5",
      "priority": 10
    },
    {
      "name": "小明",
      "role": "student",
      "persona": "好奇心强，喜欢提问，经常代表其他同学提出疑问。",
      "avatar": "student1.png",
      "color": "#f59e0b",
      "priority": 5
    }
  ]
}
"""

AGENT_USER_PROMPT_TEMPLATE = """
请根据以下课程信息生成智能体配置：

## 课程名称
{stage_name}

## 课程描述
{stage_description}

## 课程大纲
{scene_outlines}

## 语言
{language}

## 可用头像
{available_avatars}

## 可用颜色
{available_colors}

请输出 JSON 格式的智能体配置。
"""


async def generate_agent_profiles(
    stage_name: str,
    stage_description: Optional[str] = None,
    scene_outlines: Optional[List[Dict]] = None,
    language: str = "zh-CN",
    model: Optional[str] = None,
) -> List[AgentProfile]:
    """
    生成智能体配置

    Args:
        stage_name: 课程名称
        stage_description: 课程描述
        scene_outlines: 场景大纲列表
        language: 语言
        model: LLM 模型

    Returns:
        智能体配置列表
    """
    # 构建大纲摘要
    outlines_summary = ""
    if scene_outlines and len(scene_outlines) > 0:
        outlines_summary = "\n".join([
            f"{i+1}. {o.get('title', '')} - {o.get('description', '')}"
            for i, o in enumerate(scene_outlines)
        ])
    else:
        outlines_summary = "暂无大纲" if language == "zh-CN" else "No outlines available"

    # 构建提示词
    user_prompt = AGENT_USER_PROMPT_TEMPLATE.format(
        stage_name=stage_name,
        stage_description=stage_description or ("暂无描述" if language == "zh-CN" else "No description"),
        scene_outlines=outlines_summary,
        language=language,
        available_avatars=json.dumps(DEFAULT_AVATARS),
        available_colors=json.dumps(AGENT_COLOR_PALETTE),
    )

    # 调用 LLM
    try:
        response = await call_llm(
            prompt=user_prompt,
            system_prompt=AGENT_SYSTEM_PROMPT,
            model=model,
            temperature=0.7,
            max_tokens=2048,
        )

        # 解析 JSON
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        data = json.loads(cleaned)
        agents_data = data.get("agents", [])

        # 转换为 AgentProfile
        agents = []
        for i, agent in enumerate(agents_data):
            agents.append(AgentProfile(
                id=str(uuid.uuid4()),
                name=agent.get("name", f"Agent {i+1}"),
                role=agent.get("role", "student"),
                persona=agent.get("persona", ""),
                avatar=agent.get("avatar", DEFAULT_AVATARS[i % len(DEFAULT_AVATARS)]),
                color=agent.get("color", AGENT_COLOR_PALETTE[i % len(AGENT_COLOR_PALETTE)]),
                priority=agent.get("priority", 5),
                enabled=True,
            ))

        # 验证必须有teacher
        if not any(a.role == "teacher" for a in agents):
            agents.insert(0, AgentProfile(
                id=str(uuid.uuid4()),
                name="老师" if language == "zh-CN" else "Teacher",
                role="teacher",
                persona="专业教师，讲解清晰" if language == "zh-CN" else "Professional teacher",
                avatar="teacher.png",
                color="#5b9bd5",
                priority=10,
                enabled=True,
            ))

        return agents

    except Exception as e:
        # LLM 调用失败，返回默认配置
        import logging
        logging.warning(f"Agent生成失败: {e}")
        return get_default_agents(language)


def get_default_agents(language: str = "zh-CN") -> List[AgentProfile]:
    """获取默认智能体配置"""
    if language == "zh-CN":
        return [
            AgentProfile(
                id=str(uuid.uuid4()),
                name="老师",
                role="teacher",
                persona="专业教师，讲解清晰有条理，善于用例子说明复杂概念。",
                avatar="teacher.png",
                color="#5b9bd5",
                priority=10,
                enabled=True,
            ),
            AgentProfile(
                id=str(uuid.uuid4()),
                name="助教",
                role="assistant",
                persona="助教老师，负责辅助讲解和答疑，耐心解答同学问题。",
                avatar="assistant.png",
                color="#10b981",
                priority=7,
                enabled=True,
            ),
            AgentProfile(
                id=str(uuid.uuid4()),
                name="好奇同学",
                role="student",
                persona="好奇心强，喜欢提问，经常代表其他同学提出疑问。",
                avatar="student1.png",
                color="#f59e0b",
                priority=5,
                enabled=True,
            ),
        ]
    else:
        return [
            AgentProfile(
                id=str(uuid.uuid4()),
                name="Teacher",
                role="teacher",
                persona="Professional teacher with clear explanations and good examples.",
                avatar="teacher.png",
                color="#5b9bd5",
                priority=10,
                enabled=True,
            ),
            AgentProfile(
                id=str(uuid.uuid4()),
                name="Assistant",
                role="assistant",
                persona="Teaching assistant who helps with Q&A and supplementary explanations.",
                avatar="assistant.png",
                color="#10b981",
                priority=7,
                enabled=True,
            ),
            AgentProfile(
                id=str(uuid.uuid4()),
                name="Curious Student",
                role="student",
                persona="Curious student who asks questions and represents other students' doubts.",
                avatar="student1.png",
                color="#f59e0b",
                priority=5,
                enabled=True,
            ),
        ]