"""
LangGraph Agent 编排 - 多 Agent 讨论
"""

from typing import List, Dict, Any, Optional, TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from app.services.llm import call_llm, stream_llm
from app.services.generation.prompts import load_prompt, process_snippets, interpolate_variables
import uuid
import json
import re
import logging

logger = logging.getLogger(__name__)


class DirectorState(TypedDict):
    """Director 状态"""
    messages: List[Dict]
    turn_count: int
    current_agent_id: Optional[str]
    agent_responses: List[Dict]
    should_end: bool
    topic: Optional[str]  # 讨论主题


# Agent 提示词模板ID映射（与Web端一致）
AGENT_PROMPT_IDS = {
    "teacher": "agent-system-wb-teacher",
    "assistant": "agent-system-wb-assistant",
    "student": "agent-system-wb-student",
    "chief_analyst": "agent-system-wb-teacher",  # 商业场景使用teacher模板
    "market_expert": "agent-system-wb-assistant",
    "competition_expert": "agent-system-wb-assistant",
    "finance_risk_expert": "agent-system-wb-assistant",
}


def get_agent_system_prompt(agent_role: str) -> str:
    """
    从模板系统获取 Agent system prompt（与Web端一致）

    Args:
        agent_role: Agent 角色（teacher/student/assistant等）

    Returns:
        Agent system prompt
    """
    prompt_id = AGENT_PROMPT_IDS.get(agent_role, "agent-system-wb-teacher")
    system_prompt, _ = load_prompt(prompt_id)

    if system_prompt:
        # 处理snippet引入
        system_prompt = process_snippets(system_prompt)
        return system_prompt

    # 降级：使用默认提示词
    logger.warning(f"[Director] Agent模板 {prompt_id} 未找到，使用默认提示词")
    return AGENT_SYSTEM_PROMPTS.get(agent_role, AGENT_SYSTEM_PROMPTS["teacher"])


# 默认Agent提示词（当模板系统不可用时使用）
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
你是一位经验丰富的教师，正在课堂上讲解知识。
你的职责：
1. 基于当前场景的关键要点和描述，清晰讲解知识点
2. 回答学生问题，结合场景内容进行解释
3. 引导讨论方向，围绕场景主题展开
4. 适时使用白板绘制关键概念、框架图、关系图

回复格式要求：
- **必须结合场景上下文**：直接引用关键要点，逐条讲解
- 语言简洁明了，避免泛泛而谈
- 当需要展示结构、关系、框架时，使用白板：

**白板格式示例**：
📝 **白板图示（关键结构）**
```
[监事会]
 ├── 股东代表监事
 ├── 职工代表监事
 └── 监事会主席
```

- 结尾可使用 💡 **引导思考** 提出讨论问题
""",
    "student": """
你是一位积极参与的学生，正在课堂上学习。
你的职责：
1. 基于场景内容提出有价值的问题
2. 分享个人理解，结合关键要点
3. 与老师和同学讨论，围绕场景主题
4. 表达困惑或请求进一步解释

回复要求：
- **必须基于场景内容**：引用具体要点提问
- 问题具体明确，不偏离主题
- 表达个人观点时结合场景描述
- 尊重他人意见，积极互动
""",
    "assistant": """
你是教学助手，辅助教师完成教学任务。
你的职责：
1. 补充背景知识，扩展关键要点
2. 提供参考资料和实际案例
3. 协助解答疑难问题
4. 组织互动活动

回复格式要求：
- **必须结合场景内容**：补充要点细节，扩展知识
- 信息准确可靠，与主题相关
- 提供实际案例时使用：

**场景举例格式**：
🏢 **场景举例**
一个中型企业设3人监事会：2名股东代表+1名职工代表...

- 可使用白板展示补充内容的结构图
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


# Agent 角色描述（用于 Director 模板）
AGENT_DESCRIPTIONS = {
    "teacher": "Teacher - 主讲教师，负责知识点讲解、白板绘制、引导讨论",
    "assistant": "Assistant - 教学助手，补充背景知识、提供案例、协助答疑",
    "student": "Student - 学生角色，提问、分享理解、表达困惑",
    "chief_analyst": "Chief Analyst - 首席分析师，提供整体框架和关键洞察",
    "market_expert": "Market Expert - 市场专家，分析市场趋势和消费者行为",
    "competition_expert": "Competition Expert - 竞争专家，分析竞争格局和策略",
    "finance_risk_expert": "Finance & Risk Expert - 财务风险专家，评估财务风险",
}


async def run_director_routing(
    state: DirectorState,
    model: Optional[str] = None,
) -> str:
    """
    使用 Director 模板进行动态 Agent 路由决策

    Args:
        state: Director 状态
        model: LLM 模型

    Returns:
        next_agent_id 或 "END"
    """
    # 获取可用 Agent 列表
    topic = state.get("topic", "")
    if any(keyword in topic.lower() for keyword in ["商业", "策略", "市场", "竞争", "分析", "swot", "porter", "财务", "风险"]):
        available_agents = BUSINESS_AGENT_ROTATION
    else:
        available_agents = EDUCATION_AGENT_ROTATION

    # 获取已发言 Agent
    responded_agents = [r.get("agent_id") for r in state.get("agent_responses", [])]

    # 构建对话摘要
    messages = state.get("messages", [])
    conversation_summary = ""
    if messages:
        # 最近3条消息
        recent = messages[-3:]
        for m in recent:
            role = m.get("role", "user")
            content = m.get("content", "")[:100]
            agent_id = m.get("agent_id", "")
            if agent_id:
                conversation_summary += f"{agent_id}: {content}...\n"
            else:
                conversation_summary += f"{role}: {content}...\n"

    # 构建讨论内容
    discussion_section = ""
    for resp in state.get("agent_responses", [])[-2:]:
        agent_role = resp.get("agent_role", "")
        content = resp.get("content", "")[:200]
        discussion_section += f"**{agent_role}**: {content}...\n\n"

    # 构建 Director 模板变量
    variables = {
        "agentList": "\n".join([AGENT_DESCRIPTIONS.get(a, a) for a in available_agents]),
        "respondedList": "\n".join([AGENT_DESCRIPTIONS.get(a, a) for a in responded_agents]) or "None",
        "conversationSummary": conversation_summary or "讨论开始",
        "discussionSection": discussion_section,
        "whiteboardSection": "",  # 白板状态暂不实现
        "studentProfileSection": "",  # 学生画像暂不实现
        "rule1": f"1. Current turn: {state['turn_count']}. Maximum allowed: 10.",
        "turnCountPlusOne": str(state["turn_count"] + 1),
        "whiteboardOpenText": "closed",
    }

    # 加载 Director 模板
    system_prompt, _ = load_prompt("director")
    if system_prompt:
        system_prompt = process_snippets(system_prompt)
        system_prompt = interpolate_variables(system_prompt, variables)
    else:
        logger.warning("[Director] Director模板未找到，使用默认路由")
        # 降级：简单轮转
        return available_agents[state["turn_count"] % len(available_agents)]

    # 调用 LLM 进行路由决策
    effective_model = model or "qwen3.5-plus"
    response = await call_llm(
        prompt="根据上下文决定下一个发言的Agent",
        system_prompt=system_prompt,
        model=effective_model,
        temperature=0.3,
    )

    # 解析 JSON 响应
    try:
        # 提取 JSON 对象
        json_match = re.search(r'\{[^}]+\}', response)
        if json_match:
            result = json.loads(json_match.group())
            next_agent = result.get("next_agent", "END")
            return next_agent
    except json.JSONDecodeError:
        logger.warning(f"[Director] 路由响应解析失败: {response}")

    # 降级：简单轮转
    return available_agents[state["turn_count"] % len(available_agents)]


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
        model: LLM 模型（应直接传入最终模型名如 qwen3.5-plus，不经过模型映射）

    Returns:
        Agent 回复
    """
    system_prompt = get_agent_system_prompt(agent_role)

    # 添加完整的场景上下文信息
    context_info = ""
    if context:
        scene_title = context.get("scene_title", "")
        scene_type = context.get("scene_type", "slide")
        key_points = context.get("key_points", [])
        description = context.get("description", "")
        stage_name = context.get("stage_name", "")

        if stage_name:
            context_info += f"## 课程主题\n{stage_name}\n\n"
        if scene_title:
            context_info += f"## 当前场景\n标题：{scene_title}\n类型：{scene_type}\n\n"
        if description:
            context_info += f"## 场景描述\n{description}\n\n"
        if key_points and len(key_points) > 0:
            context_info += f"## 关键要点\n"
            for i, point in enumerate(key_points, 1):
                context_info += f"{i}. {point}\n"
            context_info += "\n"

    # 添加对话历史
    if messages:
        context_info += f"## 对话历史\n{json.dumps(messages[-3:], ensure_ascii=False)}\n\n"

    full_system_prompt = system_prompt + "\n\n" + context_info

    # 构建消息
    last_user_message = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            last_user_message = m.get("content", "")
            break

    if not last_user_message:
        last_user_message = context.get("topic", "请开始讲解")

    # 使用指定模型或默认 qwen3.5-plus（不经过模型映射）
    effective_model = model or "qwen3.5-plus"

    # 调用 LLM
    response = await call_llm(
        prompt=last_user_message,
        system_prompt=full_system_prompt,
        model=effective_model,
        temperature=0.7,
    )

    # 解析 actions（支持多种 JSON 格式，确保返回纯文本）
    actions = []
    display_text = response

    # 首先检测是否整个响应都是 JSON 格式 [{"type":"text",...}, {"type":"action",...}]
    try:
        parsed = json.loads(response.strip())
        if isinstance(parsed, list):
            # 检查是否是 [{"type":"text",...}, {"type":"action",...}] 格式
            text_contents = []
            for item in parsed:
                if isinstance(item, dict):
                    item_type = item.get("type", "")
                    if item_type == "text":
                        # 提取 text 元素的 content
                        content = item.get("content", "")
                        if content:
                            text_contents.append(content)
                    elif item_type == "action":
                        # 收集 action 元素
                        actions.append(item)
            # 如果成功提取到文本内容，直接使用
            if text_contents:
                display_text = "\n\n".join(text_contents)
                logger.info(f"[Director] Full JSON array detected - extracted {len(text_contents)} text segments, {len(actions)} actions")
                return {
                    "id": str(uuid.uuid4()),
                    "agent_id": agent_id,
                    "agent_role": agent_role,
                    "content": display_text,
                    "actions": actions,
                }
        elif isinstance(parsed, dict):
            # 单个 JSON 对象 {"type":"text","content":"..."}
            if parsed.get("type") == "text":
                display_text = parsed.get("content", "")
                return {
                    "id": str(uuid.uuid4()),
                    "agent_id": agent_id,
                    "agent_role": agent_role,
                    "content": display_text,
                    "actions": [],
                }
            elif parsed.get("type") == "action":
                actions.append(parsed)
                return {
                    "id": str(uuid.uuid4()),
                    "agent_id": agent_id,
                    "agent_role": agent_role,
                    "content": "",
                    "actions": actions,
                }
    except json.JSONDecodeError:
        # 不是完整 JSON，继续其他解析方法
        pass

    # 方法2：尝试匹配 JSON 数组（部分响应）
    if not actions:
        json_array_match = re.search(r'\[\s*\{.*?\}\s*(?:,\s*\{.*?\}\s*)*\]', response, re.DOTALL)
        if json_array_match:
            try:
                items = json.loads(json_array_match.group())
                if isinstance(items, list):
                    for item in items:
                        if isinstance(item, dict):
                            if item.get("type") == "action":
                                actions.append(item)
                            elif item.get("type") == "text":
                                # 也提取 text 类型
                                content = item.get("content", "")
                                if content:
                                    display_text = content
                    if actions or display_text != response:
                        # 移除 JSON 部分
                        before_json = response[:json_array_match.start()].strip()
                        after_json = response[json_array_match.end():].strip()
                        if before_json or after_json:
                            display_text = (before_json + "\n" + display_text + "\n" + after_json).strip()
            except json.JSONDecodeError:
                pass

    # 方法3：尝试单个 action 对象
    if not actions:
        json_obj_match = re.search(r'\{\s*"type"\s*:\s*"action"[^}]*\}', response, re.DOTALL)
        if json_obj_match:
            try:
                action_obj = json.loads(json_obj_match.group())
                actions.append(action_obj)
                display_text = response[:json_obj_match.start()].strip()
                after_json = response[json_obj_match.end():].strip()
                if after_json:
                    display_text = (display_text + "\n" + after_json).strip()
            except json.JSONDecodeError:
                pass

    # 二次清理：移除残留的 JSON 结构
    def clean_json(text):
        # 清理代码块
        text = re.sub(r'```(?:json)?\s*\n?\s*[\[{].*?[\]}]\s*\n?\s*```', '', text, flags=re.DOTALL)
        # 清理裸露 JSON
        text = re.sub(r'\[\s*\{.*?\}\s*(?:,\s*\{.*?\}\s*)*\]', '', text, flags=re.DOTALL)
        text = re.sub(r'\{\s*"type"\s*:\s*"[^"]*"[^}]*\}', '', text, flags=re.DOTALL)
        # 清理 JSON 字段残留
        text = re.sub(r'"(?:type|content|name|params)"\s*:\s*"[^"]*"', '', text)
        text = re.sub(r'"(?:x|y|width|height|fontSize)"\s*:\s*\d+', '', text)
        # 清理符号残留
        text = re.sub(r'[\[\]{},]', '', text)
        text = re.sub(r'\n\s*\n', '\n\n', text)
        return text.strip()

    display_text = clean_json(display_text)

    # 确保不为空
    if not display_text and response:
        display_text = re.sub(r'[\[\]{}"\':,]', '', response).strip()

    return {
        "id": str(uuid.uuid4()),
        "agent_id": agent_id,
        "agent_role": agent_role,
        "content": display_text,  # 返回纯文本（不含 JSON）
        "actions": actions,  # 返回解析后的 actions
    }


async def stream_agent_response(
    agent_id: str,
    agent_role: str,
    prompt: str,
    context: Dict[str, Any],
    model: Optional[str] = None,
):
    """
    流式生成 Agent 回复（用于 SSE）- 真正的增量流式输出

    注意：model 参数应直接传入最终模型名（如 qwen3.5-plus），
    不经过模型映射。如果不指定，默认使用 qwen3.5-plus。

    Yields:
        增量 SSE 事件：
        - {"type": "text_delta", "agent_id": str, "text": str} - 每个增量文本块
        - {"type": "response_complete", "agent_id": str, "content": str} - 完整响应（用于验证）
    """
    system_prompt = get_agent_system_prompt(agent_role)

    # 使用指定模型或默认 qwen3.5-plus（不经过模型映射）
    effective_model = model or "qwen3.5-plus"

    # 收集完整响应后再解析发送（避免发送 JSON 格式）
    full_response = ""
    async for chunk in stream_llm(
        prompt=prompt,
        system_prompt=system_prompt,
        model=effective_model,
        temperature=0.7,
    ):
        full_response += chunk
        # 不发送原始流（避免显示 JSON）

    # 解析响应，提取纯文本
    # 使用与 run_agent_turn 相同的解析逻辑
    actions = []
    display_text = full_response

    # 首先检测是否整个响应都是 JSON 格式
    try:
        parsed = json.loads(full_response.strip())
        if isinstance(parsed, list):
            text_contents = []
            for item in parsed:
                if isinstance(item, dict):
                    item_type = item.get("type", "")
                    if item_type == "text":
                        content = item.get("content", "")
                        if content:
                            text_contents.append(content)
                    elif item_type == "action":
                        actions.append(item)
            if text_contents:
                display_text = "\n\n".join(text_contents)
        elif isinstance(parsed, dict):
            if parsed.get("type") == "text":
                display_text = parsed.get("content", "")
            elif parsed.get("type") == "action":
                actions.append(parsed)
                display_text = ""
    except json.JSONDecodeError:
        pass

    # 发送解析后的纯文本（分段发送）
    if display_text:
        for i in range(0, len(display_text), 50):
            chunk = display_text[i:i+50]
            yield {
                "type": "text_delta",
                "agent_id": agent_id,
                "text": chunk,
            }

    # 发送完整响应作为确认
    yield {
        "type": "response_complete",
        "agent_id": agent_id,
        "content": display_text,
        "actions": actions,
    }


def build_director_graph():
    """
    构建 LangGraph Director 状态机

    架构：
    START → director → agent_generate → director (loop) → END
    """

    async def director_node(state: DirectorState) -> DirectorState:
        """Director 决策节点 - 使用模板进行动态路由"""
        # 轮次上限控制
        if state["turn_count"] >= 10:
            state["should_end"] = True
            return state

        # 使用 Director 模板进行路由决策
        next_agent = await run_director_routing(state)

        if next_agent == "END" or next_agent == "USER":
            state["should_end"] = True
            return state

        state["current_agent_id"] = next_agent
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
    context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    运行多 Agent 讨论

    Args:
        topic: 讨论主题
        agents: Agent ID 列表（可选，如果不提供则根据主题自动选择）
        max_turns: 最大轮次
        model: LLM 模型
        context: 场景上下文（包含 scene_title, key_points, description 等）

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

            # 构建提示（包含场景上下文）
            if turn == 0 and agent_id == agents[0]:
                # 根据Agent类型和场景上下文定制开场提示
                scene_info = ""
                if context:
                    scene_title = context.get("scene_title", "")
                    key_points = context.get("key_points", [])
                    description = context.get("description", "")
                    scene_type = context.get("scene_type", "slide")
                    stage_name = context.get("stage_name", "")

                    if scene_title:
                        scene_info = f"\n当前场景：{scene_title}\n"
                    if description:
                        scene_info += f"场景描述：{description}\n"
                    if key_points and len(key_points) > 0:
                        scene_info += f"关键要点：{', '.join(key_points)}\n"
                    if stage_name:
                        scene_info += f"课程主题：{stage_name}\n"

                if agent_id in BUSINESS_AGENT_ROTATION:
                    prompt = f"{scene_info}请从{role.replace('_', ' ')}的角度分析：{topic}"
                else:
                    prompt = f"{scene_info}请结合上述内容，开始讨论：{topic}"
            else:
                # 后续轮次：基于前一轮回复继续讨论
                prev_responses_text = ""
                if responses:
                    last_resp = responses[-1]
                    prev_responses_text = f"\n上一轮观点（{last_resp['agent_role']}）：{last_resp['content'][:200]}...\n"
                prompt = f"{prev_responses_text}请继续讨论或补充观点"

            response = await run_agent_turn(
                agent_id=agent_id,
                agent_role=role,
                messages=[],
                context={"topic": topic, **(context or {})},
                model=model,
            )

            responses.append(response)

    return responses