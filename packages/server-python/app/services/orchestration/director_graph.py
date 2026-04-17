"""
LangGraph Agent 编排 - 多 Agent 讨论
"""

from typing import List, Dict, Any, Optional, TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from app.services.llm import call_llm, stream_llm
import uuid
import json


class DirectorState(TypedDict):
    """Director 状态"""
    messages: List[Dict]
    turn_count: int
    current_agent_id: Optional[str]
    agent_responses: List[Dict]
    should_end: bool
    topic: Optional[str]  # 讨论主题


AGENT_SYSTEM_PROMPTS = {
    "chief_analyst": """
你是首席分析师（Chief Analyst），负责商业策略的整体分析框架。
你的职责：
1. 提供整体分析框架和关键洞察
2. 引导讨论方向，协调各专家观点
3. 总结核心发现和战略建议
4. 确保分析的完整性和逻辑性

回复要求：
- 语言专业、宏观视角
- 使用分析框架（SWOT、Porter五力、PEST等）
- 引导其他专家深入讨论
- 适时使用白板绘制关键框架图
""",
    "market_expert": """
你是市场专家（Market Expert），负责市场趋势和消费者分析。
你的职责：
1. 分析市场规模、增长率、趋势
2. 评估消费者行为和需求变化
3. 预测市场发展方向和机会
4. 提供市场数据和统计支持

回复要求：
- 数据驱动、具体量化
- 使用市场分析工具（市场细分、需求分析）
- 提供具体的市场数据和案例
- 关注行业动态和竞争格局
""",
    "competition_expert": """
你是竞争专家（Competition Expert），负责竞争格局和竞争策略分析。
你的职责：
1. 分析竞争对手和竞争格局
2. 评估竞争强度和竞争优势
3. 提供竞争策略建议
4. 识别竞争威胁和机会

回复要求：
- 对比分析、批判性思维
- 使用竞争分析工具（Porter五力、竞争对手画像）
- 关注差异化策略和核心竞争力
- 提供具体的竞争案例
""",
    "finance_risk_expert": """
你是财务/风险专家（Finance & Risk Expert），负责财务分析和风险评估。
你的职责：
1. 分析财务数据和财务健康度
2. 评估投资回报和财务风险
3. 提供财务预测和预算建议
4. 识别潜在风险和应对措施

回复要求：
- 保守审慎、风险意识
- 使用财务分析工具（财务报表分析、ROI计算）
- 关注现金流、盈利能力、偿债能力
- 提供具体的风险评估和应对策略
""",
    # 保留原有教育角色供通用场景使用
    "teacher": """
你是一位经验丰富的教师，负责引导学生学习。
你的职责：
1. 清晰讲解知识点
2. 回答学生问题
3. 引导讨论方向
4. 适时提问激发思考

回复要求：
- 语言简洁明了
- 结合场景内容
- 适当使用白板绘制关键概念
""",
    "student": """
你是一位积极参与的学生，负责提问和讨论。
你的职责：
1. 提出有价值的问题
2. 分享个人理解
3. 与其他同学讨论
4. 完成测验

回复要求：
- 问题具体明确
- 表达个人观点
- 尊重他人意见
""",
    "assistant": """
你是教学助手，辅助教师完成教学任务。
你的职责：
1. 补充背景知识
2. 提供参考资料
3. 协助解答疑难问题
4. 组织互动活动

回复要求：
- 信息准确可靠
- 内容适度补充
- 不替代教师角色
""",
}

# 商业策略Agent轮转顺序
BUSINESS_AGENT_ROTATION = [
    "chief_analyst",     # 开场：整体框架
    "market_expert",     # 市场视角
    "competition_expert", # 竞争视角
    "finance_risk_expert", # 风险视角
    "chief_analyst",     # 总结引导
]

# 教育Agent轮转顺序（原有）
EDUCATION_AGENT_ROTATION = [
    "teacher",
    "student",
    "assistant",
]


async def run_agent_turn(
    agent_id: str,
    agent_role: str,
    messages: List[Dict],
    context: Dict[str, Any],
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    执行单个 Agent 的回复生成

    Args:
        agent_id: Agent ID
        agent_role: 角色（teacher/student/assistant）
        messages: 对话历史
        context: 上下文（场景信息等）
        model: LLM 模型

    Returns:
        Agent 回复
    """
    system_prompt = AGENT_SYSTEM_PROMPTS.get(agent_role, AGENT_SYSTEM_PROMPTS["teacher"])

    # 添加上下文信息
    context_info = f"""
## 当前场景
标题：{context.get('scene_title', '未知')}
类型：{context.get('scene_type', 'slide')}

## 对话上下文
{json.dumps(messages[-3:], ensure_ascii=False) if messages else '无'}
"""

    full_system_prompt = system_prompt + "\n" + context_info

    # 构建消息
    last_user_message = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            last_user_message = m.get("content", "")
            break

    if not last_user_message:
        last_user_message = context.get("topic", "请开始讲解")

    # 调用 LLM
    response = await call_llm(
        prompt=last_user_message,
        system_prompt=full_system_prompt,
        model=model,
        temperature=0.7,
    )

    return {
        "id": str(uuid.uuid4()),
        "agent_id": agent_id,
        "agent_role": agent_role,
        "content": response,
        "actions": [],  # 可后续添加白板绘制等
    }


async def stream_agent_response(
    agent_id: str,
    agent_role: str,
    prompt: str,
    context: Dict[str, Any],
    model: Optional[str] = None,
):
    """
    流式生成 Agent 回复（用于 SSE）
    """
    system_prompt = AGENT_SYSTEM_PROMPTS.get(agent_role, AGENT_SYSTEM_PROMPTS["teacher"])

    buffer = ""
    for chunk in await stream_llm(
        prompt=prompt,
        system_prompt=system_prompt,
        model=model,
        temperature=0.7,
    ):
        buffer += chunk
        yield {
            "type": "text_delta",
            "agent_id": agent_id,
            "text": chunk,
        }

    # 流式结束，返回完整回复
    yield {
        "type": "response_complete",
        "agent_id": agent_id,
        "content": buffer,
    }


def build_director_graph():
    """
    构建 LangGraph Director 状态机

    架构：
    START → director → agent_generate → director (loop) → END
    """

    async def director_node(state: DirectorState) -> DirectorState:
        """Director 决策节点"""
        # 简单策略：轮次控制
        if state["turn_count"] >= 10:
            state["should_end"] = True
            return state

        # 选择下一个 Agent
        # 根据主题类型选择轮转顺序
        topic = state.get("topic", "")
        if any(keyword in topic.lower() for keyword in ["商业", "策略", "市场", "竞争", "分析", "swot", "porter", "财务", "风险"]):
            agents = BUSINESS_AGENT_ROTATION
        else:
            agents = EDUCATION_AGENT_ROTATION

        state["current_agent_id"] = agents[state["turn_count"] % len(agents)]
        state["turn_count"] += 1

        return state

    async def agent_generate_node(state: DirectorState) -> DirectorState:
        """Agent 生成节点"""
        agent_id = state["current_agent_id"]

        response = await run_agent_turn(
            agent_id=agent_id,
            agent_role=agent_id,
            messages=state["messages"],
            context={},
        )

        state["agent_responses"].append(response)

        # 添加到消息历史
        state["messages"].append({
            "role": "assistant",
            "content": response["content"],
            "agent_id": agent_id,
        })

        return state

    # 构建图
    graph = StateGraph(DirectorState)

    graph.add_node("director", director_node)
    graph.add_node("agent_generate", agent_generate_node)

    graph.set_entry_point("director")

    # 条件路由
    def should_continue(state: DirectorState) -> str:
        if state["should_end"]:
            return "end"
        return "continue"

    graph.add_conditional_edges(
        "director",
        should_continue,
        {"end": END, "continue": "agent_generate"}
    )

    graph.add_edge("agent_generate", "director")

    return graph.compile()


async def run_multi_agent_discussion(
    topic: str,
    agents: List[str],
    max_turns: int = 5,
    model: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    运行多 Agent 讨论

    Args:
        topic: 讨论主题
        agents: Agent ID 列表（可选，如果不提供则根据主题自动选择）
        max_turns: 最大轮次
        model: LLM 模型

    Returns:
        所有 Agent 回复列表
    """
    responses = []

    # 如果没有提供agents，根据主题自动选择
    if not agents:
        if any(keyword in topic.lower() for keyword in ["商业", "策略", "市场", "竞争", "分析", "swot", "porter", "财务", "风险"]):
            agents = BUSINESS_AGENT_ROTATION
        else:
            agents = EDUCATION_AGENT_ROTATION

    for turn in range(max_turns):
        for agent_id in agents:
            # 使用agent_id作为role（匹配AGENT_SYSTEM_PROMPTS）
            role = agent_id

            # 构建提示
            if turn == 0 and agent_id == agents[0]:
                # 根据Agent类型定制开场提示
                if agent_id in BUSINESS_AGENT_ROTATION:
                    prompt = f"请从{role.replace('_', ' ')}的角度分析主题：{topic}"
                else:
                    prompt = f"请开始讲解主题：{topic}"
            else:
                prompt = "请继续讨论或补充观点"

            response = await run_agent_turn(
                agent_id=agent_id,
                agent_role=role,
                messages=[],
                context={"topic": topic},
                model=model,
            )

            responses.append(response)

    return responses