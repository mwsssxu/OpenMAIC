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


AGENT_SYSTEM_PROMPTS = {
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

        # 选择下一个 Agent（简单轮询）
        agents = ["teacher", "student", "assistant"]
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
        agents: Agent ID 列表
        max_turns: 最大轮次
        model: LLM 模型

    Returns:
        所有 Agent 回复列表
    """
    responses = []

    for turn in range(max_turns):
        for agent_id in agents:
            role = "teacher" if agent_id == agents[0] else "student"

            # 构建提示
            if turn == 0 and agent_id == agents[0]:
                prompt = f"请开始讲解主题：{topic}"
            else:
                prompt = "请继续讨论或提问"

            response = await run_agent_turn(
                agent_id=agent_id,
                agent_role=role,
                messages=[],
                context={"topic": topic},
                model=model,
            )

            responses.append(response)

    return responses