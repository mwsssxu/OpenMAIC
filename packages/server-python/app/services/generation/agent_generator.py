"""
Agent Profiles 生成器 - 根据课程信息生成智能体配置
"""

import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, field_validator
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
    # Voice 配置（用于 TTS）
    voice_provider: Optional[str] = None  # openai, minimax
    voice_id: Optional[str] = None  # alloy, nova, shimmer, etc.
    voice_speed: Optional[float] = None  # 0.25-4.0

    @field_validator('voice_speed')
    @classmethod
    def validate_speed(cls, v):
        if v is not None and not (0.25 <= v <= 4.0):
            raise ValueError('voice_speed must be between 0.25 and 4.0')
        return v


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

# 默认语音配置
DEFAULT_VOICE_CONFIGS = [
    {"provider": "openai", "voice": "alloy", "speed": 1.0},  # teacher
    {"provider": "openai", "voice": "nova", "speed": 1.0},   # assistant
    {"provider": "openai", "voice": "shimmer", "speed": 1.1}, # student
    {"provider": "openai", "voice": "echo", "speed": 1.0},   # student
    {"provider": "openai", "voice": "fable", "speed": 0.9},  # student
]


# 合并prompt（不使用system_prompt，避免DashScope超时）
AGENT_PROMPT_TEMPLATE = """你是课程设计专家。根据课程信息生成智能体配置。

课程: {stage_name}
描述: {stage_description}
大纲: {scene_outlines}

输出JSON: {{'agents': [...]}}
规则：
- 1个teacher(priority=10, #5b9bd5蓝)
- 1个assistant(priority=7, #10b981绿)
- 2个不同性格student(priority=4-6)
- 每个agent: name, role, persona(一句话), color, priority
- 学生性格: 好奇型/学霸型/活泼型等
- 只输出JSON"""


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
        outlines_summary = "暂无大纲" if language == "zh-CN" else "No outlines"

    # 构建合并prompt（避免DashScope超时）
    prompt = AGENT_PROMPT_TEMPLATE.format(
        stage_name=stage_name,
        stage_description=stage_description or ("暂无描述" if language == "zh-CN" else "No description"),
        scene_outlines=outlines_summary,
    )

    # 调用 LLM（不使用system_prompt，避免超时）
    try:
        response = await call_llm(
            prompt=prompt,
            system_prompt=None,  # 不使用system_prompt避免DashScope超时
            model=model,
            temperature=0.7,
            max_tokens=800,
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
            voice_config = DEFAULT_VOICE_CONFIGS[i % len(DEFAULT_VOICE_CONFIGS)]
            agents.append(AgentProfile(
                id=str(uuid.uuid4()),
                name=agent.get("name", f"Agent {i+1}"),
                role=agent.get("role", "student"),
                persona=agent.get("persona", ""),
                avatar=agent.get("avatar", DEFAULT_AVATARS[i % len(DEFAULT_AVATARS)]),
                color=agent.get("color", AGENT_COLOR_PALETTE[i % len(AGENT_COLOR_PALETTE)]),
                priority=agent.get("priority", 5),
                enabled=True,
                voice_provider=voice_config["provider"],
                voice_id=voice_config["voice"],
                voice_speed=voice_config["speed"],
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
                voice_provider="openai",
                voice_id="alloy",
                voice_speed=1.0,
            ))

        return agents

    except Exception as e:
        # LLM 调用失败，返回默认配置
        import logging
        logging.warning(f"Agent生成失败: {e}")
        return get_default_agents(language)


def get_default_agents(language: str = "zh-CN") -> List[AgentProfile]:
    """获取默认智能体配置（扩展版：1老师+1助教+3学生）"""
    if language == "zh-CN":
        return [
            AgentProfile(
                id=str(uuid.uuid4()),
                name="张老师",
                role="teacher",
                persona="资深教师，讲解清晰有条理，善于用生动例子说明复杂概念，引导学生思考。",
                avatar="teacher.png",
                color="#5b9bd5",
                priority=10,
                enabled=True,
                voice_provider="openai",
                voice_id="alloy",
                voice_speed=1.0,
            ),
            AgentProfile(
                id=str(uuid.uuid4()),
                name="李助教",
                role="assistant",
                persona="助教老师，耐心负责，善于答疑解惑，补充老师的讲解，帮助同学巩固知识。",
                avatar="assistant.png",
                color="#10b981",
                priority=7,
                enabled=True,
                voice_provider="openai",
                voice_id="nova",
                voice_speed=1.0,
            ),
            AgentProfile(
                id=str(uuid.uuid4()),
                name="好奇小明",
                role="student",
                persona="好奇心强，喜欢提问基础问题，经常代表初学者提出疑问，活跃课堂气氛。",
                avatar="student1.png",
                color="#f59e0b",
                priority=5,
                enabled=True,
                voice_provider="openai",
                voice_id="shimmer",
                voice_speed=1.1,
            ),
            AgentProfile(
                id=str(uuid.uuid4()),
                name="学霸小红",
                role="student",
                persona="学习能力强，善于总结和举一反三，经常提出深入的思考问题，帮助同学理解核心概念。",
                avatar="student2.png",
                color="#8b5cf6",
                priority=6,
                enabled=True,
                voice_provider="openai",
                voice_id="echo",
                voice_speed=1.0,
            ),
            AgentProfile(
                id=str(uuid.uuid4()),
                name="活泼小刚",
                role="student",
                persona="性格活泼，喜欢分享观点和实际应用案例，经常将知识与生活联系起来。",
                avatar="student3.png",
                color="#06b6d4",
                priority=4,
                enabled=True,
                voice_provider="openai",
                voice_id="fable",
                voice_speed=0.9,
            ),
        ]
    else:
        return [
            AgentProfile(
                id=str(uuid.uuid4()),
                name="Teacher Zhang",
                role="teacher",
                persona="Senior teacher with clear explanations, good examples, and thought-provoking guidance.",
                avatar="teacher.png",
                color="#5b9bd5",
                priority=10,
                enabled=True,
                voice_provider="openai",
                voice_id="alloy",
                voice_speed=1.0,
            ),
            AgentProfile(
                id=str(uuid.uuid4()),
                name="Assistant Li",
                role="assistant",
                persona="Patient assistant who helps with Q&A and reinforces key concepts.",
                avatar="assistant.png",
                color="#10b981",
                priority=7,
                enabled=True,
                voice_provider="openai",
                voice_id="nova",
                voice_speed=1.0,
            ),
            AgentProfile(
                id=str(uuid.uuid4()),
                name="Curious Student",
                role="student",
                persona="Curious student who asks fundamental questions and represents beginners' doubts.",
                avatar="student1.png",
                color="#f59e0b",
                priority=5,
                enabled=True,
                voice_provider="openai",
                voice_id="shimmer",
                voice_speed=1.1,
            ),
            AgentProfile(
                id=str(uuid.uuid4()),
                name="Smart Student",
                role="student",
                persona="Quick learner who summarizes well and asks deep questions about core concepts.",
                avatar="student2.png",
                color="#8b5cf6",
                priority=6,
                enabled=True,
                voice_provider="openai",
                voice_id="echo",
                voice_speed=1.0,
            ),
            AgentProfile(
                id=str(uuid.uuid4()),
                name="Active Student",
                role="student",
                persona="Active student who shares real-world examples and connects knowledge to daily life.",
                avatar="student3.png",
                color="#06b6d4",
                priority=4,
                enabled=True,
                voice_provider="openai",
                voice_id="shimmer",
                voice_speed=1.1,
            ),
        ]