"""
聊天路由 - SSE 流式 Agent 对话（参考Web端实现）

SSE 事件格式（与Web端一致）:
- data: {"type":"agent_start","data":{"messageId":"...","agentId":"..."}}
- data: {"type":"text_delta","data":{"messageId":"...","content":"..."}}
- data: {"type":"action","data":{"messageId":"...","actionId":"...","actionName":"...","params":{...}}}
- data: {"type":"agent_end","data":{"messageId":"...","agentId":"..."}}
- data: {"type":"done","data":{"totalAgents":1,"directorState":{...}}}

注意：使用 `data: {JSON}\n\n` 格式，不带 `event:` 字段
"""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.middleware.auth import get_current_user_id
from app.services.orchestration.director_graph import stream_agent_response, run_multi_agent_discussion, get_agent_system_prompt
from app.services.llm import stream_llm
from app.core.config import settings
from app.services.generation.prompts import process_snippets
import json
import uuid
import logging
import re

logger = logging.getLogger(__name__)
router = APIRouter()

# Chat 专用模型（参考Web端，使用 qwen3.5-plus）
CHAT_MODEL = "qwen3.5-plus"


def sse_event(event_type: str, data: dict) -> str:
    """生成 SSE 事件（Web端格式：不带 event 字段）"""
    return f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"


def parse_agent_actions(response_text: str) -> tuple:
    """
    解析Agent响应中的actions，确保返回纯文本

    核心原则：display_text 必须是纯文本，不含任何 JSON 结构

    特殊处理：当LLM输出整个响应为JSON格式时：
    [{"type":"text","content":"..."}, {"type":"action","name":"...","params":{...}}]
    需要提取 "type":"text" 元素中的 content 字段作为显示文本
    """
    actions = []
    display_text = response_text.strip()

    # 首先检测是否整个响应都是 JSON 格式 [{"type":...}, ...]
    # 这是最常见的情况 - LLM 直接输出 JSON 数组
    try:
        # 尝试解析整个响应为 JSON
        parsed = json.loads(response_text.strip())
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
                logger.info(f"[Parse] Full JSON array detected - extracted {len(text_contents)} text segments, {len(actions)} actions")
                return display_text, actions

        elif isinstance(parsed, dict):
            # 单个 JSON 对象 {"type":"text","content":"..."}
            if parsed.get("type") == "text":
                display_text = parsed.get("content", "")
                logger.info(f"[Parse] Single JSON text object detected - extracted content")
                return display_text, actions
            elif parsed.get("type") == "action":
                actions.append(parsed)
                display_text = ""
                return display_text, actions
    except json.JSONDecodeError:
        # 不是完整 JSON，继续其他解析方法
        pass

    # 方法1：提取 ```json 代码块
    code_block_pattern = r'```(?:json)?\s*\n?\s*(\[.*?\]|\{.*?\})\s*\n?\s*```'
    code_blocks = re.findall(code_block_pattern, response_text, re.DOTALL)
    if code_blocks:
        for block in code_blocks:
            try:
                parsed = json.loads(block)
                if isinstance(parsed, list):
                    for item in parsed:
                        if item.get("type") == "action":
                            actions.append(item)
                elif isinstance(parsed, dict) and parsed.get("type") == "action":
                    actions.append(parsed)
            except json.JSONDecodeError:
                continue

        if actions:
            # 移除所有代码块
            display_text = re.sub(code_block_pattern, '', response_text, flags=re.DOTALL).strip()

    # 方法2：匹配裸露的 JSON 数组 [...]
    if not actions:
        # 尝试匹配完整的 JSON 数组
        bracket_pattern = r'\[\s*\{.*?\}\s*(?:,\s*\{.*?\}\s*)*\]'
        json_match = re.search(bracket_pattern, response_text, re.DOTALL)
        if json_match:
            try:
                items = json.loads(json_match.group())
                if isinstance(items, list):
                    for item in items:
                        if item.get("type") == "action":
                            actions.append(item)
                    if actions:
                        # 移除 JSON 部分
                        display_text = response_text[:json_match.start()].strip()
                        after = response_text[json_match.end():].strip()
                        if after:
                            display_text = (display_text + "\n" + after).strip()
            except json.JSONDecodeError:
                pass

    # 方法3：匹配单个 action 对象 {...}
    if not actions:
        obj_pattern = r'\{\s*"type"\s*:\s*"action"[^}]*\}'
        obj_match = re.search(obj_pattern, response_text, re.DOTALL)
        if obj_match:
            try:
                action_obj = json.loads(obj_match.group())
                if action_obj.get("type") == "action":
                    actions.append(action_obj)
                    display_text = response_text[:obj_match.start()].strip()
                    after = response_text[obj_match.end():].strip()
                    if after:
                        display_text = (display_text + "\n" + after).strip()
            except json.JSONDecodeError:
                pass

    # 第二步：校验 display_text 是否还包含 JSON 结构
    # 如果包含，再次清理
    def clean_json_from_text(text: str) -> str:
        """递归清理文本中的所有 JSON 结构"""
        cleaned = text

        # 清理代码块
        cleaned = re.sub(r'```(?:json)?\s*\n?\s*[\[{].*?[\]}]\s*\n?\s*```', '', cleaned, flags=re.DOTALL)

        # 清理裸露的 JSON 数组
        cleaned = re.sub(r'\[\s*\{.*?\}\s*(?:,\s*\{.*?\}\s*)*\]', '', cleaned, flags=re.DOTALL)

        # 清理单个 JSON 对象（包含 type 字段）
        cleaned = re.sub(r'\{\s*"type"\s*:\s*"[^"]*"[^}]*\}', '', cleaned, flags=re.DOTALL)

        # 清理残留的 JSON 片段（如 "content":"..."）
        cleaned = re.sub(r'"(?:type|content|name|params|x|y|width|height|fontSize|color)"\s*:\s*"[^"]*"', '', cleaned)
        cleaned = re.sub(r'"(?:type|content|name|params|x|y|width|height|fontSize|color)"\s*:\s*\d+', '', cleaned)

        # 清理方括号和花括号残留
        cleaned = re.sub(r'[\[\]{},]', '', cleaned)

        # 清理多余空白
        cleaned = re.sub(r'\n\s*\n', '\n\n', cleaned)
        cleaned = cleaned.strip()

        return cleaned

    # 执行校验和二次清理
    original_display = display_text
    display_text = clean_json_from_text(display_text)

    # 如果清理后文本明显变短，说明有残留 JSON，记录日志
    if len(display_text) < len(original_display) * 0.8:
        logger.warning(f"[Parse] Display text cleaned: {len(original_display)} -> {len(display_text)} chars")

    # 确保 display_text 不为空
    if not display_text and response_text:
        # 如果清理后为空，尝试提取纯文本部分
        # 移除所有 JSON 相关字符后保留
        display_text = re.sub(r'[\[\]{}"\':,]', '', response_text)
        display_text = re.sub(r'\b(type|content|name|params|x|y|width|height|fontSize|color)\b', '', display_text)
        display_text = display_text.strip()

    logger.info(f"[Parse] Result: display_text={len(display_text)} chars, actions={len(actions)}")
    if actions:
        logger.info(f"[Parse] Actions: {[a.get('name', 'unknown') for a in actions]}")

    return display_text, actions


@router.post("")
async def chat(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    SSE 流式聊天（参考Web端实现）

    支持两种模式：
    1. 单Agent对话（默认）
    2. 多Agent讨论（sessionType: 'discussion'）

    SSE 事件格式（与Web端一致）:
    - agent_start: {"messageId", "agentId", "agentName", "agentAvatar", "agentColor"}
    - text_delta: {"messageId", "content"}
    - action: {"messageId", "actionId", "actionName", "params", "agentId"}
    - agent_end: {"messageId", "agentId"}
    - done: {"totalAgents", "totalActions", "directorState"}
    """
    messages = body.get("messages", [])
    config = body.get("config", {})
    store_state = body.get("storeState", {})

    # 获取 Agent 配置
    agents = config.get("agentIds", ["teacher", "student"])
    session_type = config.get("sessionType", "chat")
    discussion_topic = config.get("discussionTopic", "")
    discussion_prompt = config.get("discussionPrompt", "")
    topic = store_state.get("stage", {}).get("name", "课程讲解")

    # 场景上下文
    scene_title = store_state.get("scene", {}).get("title", topic)
    scene_content = store_state.get("scene", {}).get("content", {})
    key_points = scene_content.get("key_points", [])
    description = scene_content.get("description", "")

    async def event_stream():
        total_actions = 0

        # 讨论模式：多个 Agent 依次发言
        if session_type == "discussion" and len(agents) > 1:
            logger.info(f"[Chat] Discussion mode - agents={agents}, topic={discussion_topic[:50]}")

            # 讨论轮次（默认 1 轮，减少总时间）
            max_turns = 1
            discussion_agents = agents[:2]  # 最多 2 个 Agent 参与（减少 LLM 调用）

            logger.info(f"[Chat] Discussion config - max_turns={max_turns}, discussion_agents={discussion_agents}")
            logger.info(f"[Chat] Scene context - title={scene_title}, key_points={key_points}")

            # 构建场景上下文
            context_section = ""
            if scene_title:
                context_section += f"## 当前场景\n标题：{scene_title}\n\n"
            if description:
                context_section += f"## 场景描述\n{description}\n\n"
            if key_points and len(key_points) > 0:
                context_section += f"## 关键要点\n"
                for i, point in enumerate(key_points, 1):
                    context_section += f"{i}. {point}\n"
                context_section += "\n"

            # 讨论主题
            discussion_question = discussion_prompt or discussion_topic or f"请讨论：{scene_title}"

            # 依次让每个 Agent 发言
            previous_responses = []  # 记录前面Agent的发言
            for turn in range(max_turns):
                logger.info(f"[Chat] Starting discussion turn {turn+1}/{max_turns}")
                for i, agent_id in enumerate(discussion_agents):
                    logger.info(f"[Chat] Turn {turn+1} - Agent {i+1}/{len(discussion_agents)}: {agent_id}")

                    # 提取角色类型
                    role = agent_id.lower()
                    if "student" in role:
                        role = "student"
                    elif "assistant" in role:
                        role = "assistant"
                    else:
                        role = "teacher"
                    logger.info(f"[Chat] Agent {agent_id} role determined as: {role}")

                    message_id = f"msg-{uuid.uuid4().hex[:8]}"

                    # 发送 agent_start 事件
                    agent_name = agent_id.replace("_", " ").title()
                    agent_colors = {"teacher": "#4A90E2", "student": "#F59E0B", "assistant": "#10B981"}
                    yield sse_event("agent_start", {
                        "messageId": message_id,
                        "agentId": agent_id,
                        "agentName": agent_name,
                        "agentAvatar": None,
                        "agentColor": agent_colors.get(role, "#888888"),
                    })

                    # 构建发言提示 - 所有Agent都收到场景上下文
                    prompt = f"{context_section}\n## 讨论问题\n{discussion_question}\n\n"

                    if turn == 0 and i == 0:
                        # 第一个 Agent 开场
                        prompt += "请开始讨论，结合场景要点发表观点，引导讨论。"
                    else:
                        # 后续发言：包含前面Agent的发言摘要
                        if previous_responses:
                            prompt += "## 前面同学的发言\n"
                            for resp in previous_responses[-3:]:  # 只取最近3条
                                prompt += f"- **{resp['agent']}**: {resp['content'][:200]}...\n"
                            prompt += "\n请继续讨论，结合场景要点补充观点或回应其他人的发言。"
                        else:
                            prompt += "请继续讨论，结合场景要点补充观点。"

                    try:
                        # 流式生成
                        system_prompt = get_agent_system_prompt(role)
                        logger.info(f"[Chat] Agent {agent_id} - system_prompt length: {len(system_prompt)} chars")
                        logger.info(f"[Chat] Agent {agent_id} - prompt: {prompt[:100]}...")

                        full_response = ""
                        chunk_count = 0
                        async for chunk in stream_llm(
                            prompt=prompt,
                            system_prompt=system_prompt,
                            model=CHAT_MODEL,
                            temperature=0.7,
                        ):
                            full_response += chunk
                            chunk_count += 1
                            if chunk_count % 10 == 0:
                                logger.debug(f"[Chat] Agent {agent_id} - received {chunk_count} chunks, {len(full_response)} chars")

                        logger.info(f"[Chat] Agent {agent_id} - LLM completed: {len(full_response)} chars total, {chunk_count} chunks")

                        # 解析 actions（分离纯文本和 actions）
                        display_text, actions = parse_agent_actions(full_response)
                        logger.info(f"[Chat] Agent {agent_id} - parsed: display_text={len(display_text)} chars, actions={len(actions)}")
                        if actions:
                            logger.info(f"[Chat] Agent {agent_id} - actions detail: {[a.get('name', 'unknown') for a in actions]}")

                        # 发送纯文本作为 text_delta（分段发送模拟流式效果）
                        if display_text:
                            logger.info(f"[Chat] Agent {agent_id} - sending text_delta in chunks")
                            # 分段发送（每 50 字符一段）
                            chunks_sent = 0
                            for i in range(0, len(display_text), 50):
                                chunk = display_text[i:i+50]
                                yield sse_event("text_delta", {
                                    "messageId": message_id,
                                    "content": chunk,
                                })
                                chunks_sent += 1
                            logger.info(f"[Chat] Agent {agent_id} - sent {chunks_sent} text_delta events")
                        else:
                            logger.warning(f"[Chat] Agent {agent_id} - no display_text to send")

                        # 发送 action 事件
                        if actions:
                            logger.info(f"[Chat] Agent {agent_id} - sending {len(actions)} action events")
                            for action in actions:
                                action_id = f"action-{uuid.uuid4().hex[:8]}"
                                action_name = action.get("name", "unknown")
                                logger.info(f"[Chat] Agent {agent_id} - action: {action_name}")
                                yield sse_event("action", {
                                    "messageId": message_id,
                                    "actionId": action_id,
                                    "actionName": action_name,
                                    "params": action.get("params", {}),
                                    "agentId": agent_id,
                                })
                                total_actions += 1

                        logger.info(f"[Chat] Discussion turn {turn+1} - {agent_id}: {len(full_response)} chars, {len(actions)} actions")

                        # 记录发言内容供后续Agent参考
                        previous_responses.append({
                            'agent': agent_name,
                            'role': role,
                            'content': display_text[:500]  # 只保存摘要
                        })

                    except Exception as e:
                        logger.error(f"[Chat] Discussion error for {agent_id}: {e}")
                        import traceback
                        logger.error(f"[Chat] Traceback: {traceback.format_exc()}")
                        yield sse_event("error", {"message": str(e)})

                    # 发送 agent_end 事件
                    logger.info(f"[Chat] Agent {agent_id} - sending agent_end")
                    yield sse_event("agent_end", {
                        "messageId": message_id,
                        "agentId": agent_id,
                    })

            # 发送 done 事件
            logger.info(f"[Chat] Discussion complete - total_agents={len(discussion_agents) * max_turns}, total_actions={total_actions}")
            yield sse_event("done", {
                "totalAgents": len(discussion_agents) * max_turns,
                "totalActions": total_actions,
                "directorState": {
                    "turnCount": max_turns,
                    "currentAgentId": discussion_agents[-1],
                    "shouldEnd": True,
                },
            })

        else:
            # 单 Agent 对话模式
            first_agent = agents[0] if agents else "teacher"
            role = "teacher"
            if "student" in first_agent.lower():
                role = "student"
            elif "assistant" in first_agent.lower():
                role = "assistant"

            # 获取最后一个用户消息
            last_user_message = ""
            for m in reversed(messages):
                if m.get("role") == "user":
                    content = m.get("content", "")
                    if isinstance(content, list):
                        for part in content:
                            if isinstance(part, dict) and part.get("type") == "text":
                                last_user_message = part.get("text", "")
                                break
                    else:
                        last_user_message = content
                    break

            if not last_user_message:
                last_user_message = body.get("message", f"请开始讲解 {topic}")

            logger.info(f"[Chat] Request: agent={first_agent}, role={role}, message={last_user_message[:50]}")

            message_id = f"msg-{uuid.uuid4().hex[:8]}"

            yield sse_event("agent_start", {
                "messageId": message_id,
                "agentId": first_agent,
                "agentName": first_agent.replace("_", " ").title(),
                "agentAvatar": None,
                "agentColor": "#4A90E2",
            })

            try:
                system_prompt = get_agent_system_prompt(role)

                # 构建场景上下文
                context_section = ""
                if scene_title:
                    context_section += f"\n## 当前场景\n标题：{scene_title}\n类型：slide\n"
                if description:
                    context_section += f"\n## 场景描述\n{description}\n"
                if key_points and len(key_points) > 0:
                    context_section += f"\n## 关键要点\n"
                    for i, point in enumerate(key_points, 1):
                        context_section += f"{i}. {point}\n"

                whiteboard_section = "\n## Whiteboard State\nNo elements on whiteboard.\n"
                user_question = f"\n## User Question\n{last_user_message}\n"
                full_prompt = context_section + whiteboard_section + user_question

                # 流式生成（先收集完整响应）
                full_response = ""
                async for chunk in stream_llm(
                    prompt=full_prompt,
                    system_prompt=system_prompt,
                    model=CHAT_MODEL,
                    temperature=0.7,
                ):
                    full_response += chunk
                # 不发送原始流（避免显示 JSON）

                # 解析 actions（分离纯文本和 actions）
                display_text, actions = parse_agent_actions(full_response)

                # 发送纯文本作为 text_delta（分段发送模拟流式效果）
                if display_text:
                    for i in range(0, len(display_text), 50):
                        chunk = display_text[i:i+50]
                        yield sse_event("text_delta", {
                            "messageId": message_id,
                            "content": chunk,
                        })

                # 发送 action 事件
                for i, action in enumerate(actions):
                    action_id = f"action-{uuid.uuid4().hex[:8]}"
                    yield sse_event("action", {
                        "messageId": message_id,
                        "actionId": action_id,
                        "actionName": action.get("name", "unknown"),
                        "params": action.get("params", {}),
                        "agentId": first_agent,
                    })
                    total_actions += 1

                logger.info(f"[Chat] Response complete: {len(full_response)} chars, {len(actions)} actions")

            except Exception as e:
                logger.error(f"[Chat] Stream error: {e}")
                yield sse_event("error", {"message": str(e)})
                return

            yield sse_event("agent_end", {
                "messageId": message_id,
                "agentId": first_agent,
            })

            yield sse_event("done", {
                "totalAgents": 1,
                "totalActions": total_actions,
                "agentHadContent": bool(full_response),
                "directorState": {
                    "turnCount": 1,
                    "currentAgentId": first_agent,
                    "shouldEnd": True,
                },
            })

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/discussion")
async def start_discussion(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """多 Agent 讨论（基于场景上下文）"""
    topic = body.get("topic", "")
    agents = body.get("agents", ["teacher", "student", "assistant"])
    max_turns = body.get("maxTurns", 3)
    context = body.get("context", {})  # 场景上下文

    logger.info(f"[Discussion] Request received - topic={topic[:100]}, agents={agents}, context_keys={list(context.keys())}")
    logger.info(f"[Discussion] Scene context - title={context.get('scene_title', 'N/A')}, key_points={context.get('key_points', [])}")

    try:
        # 使用 Chat 专用模型，传递完整上下文
        responses = await run_multi_agent_discussion(
            topic=topic,
            agents=agents,
            max_turns=max_turns,
            model=CHAT_MODEL,
            context=context,  # 传递场景上下文
        )

        logger.info(f"[Discussion] Completed - {len(responses)} responses generated")
        return {"responses": responses}

    except Exception as e:
        logger.error(f"[Discussion] Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        # 返回降级响应，避免前端无响应
        return {
            "responses": [
                {
                    "agent_id": "teacher",
                    "agent_role": "teacher",
                    "content": f"抱歉，讨论服务暂时不可用。请稍后重试或切换场景。\n\n场景：{context.get('scene_title', '未知')}\n要点：{', '.join(context.get('key_points', ['无']))}",
                    "actions": []
                }
            ]
        }


@router.post("/agent-stream")
async def stream_single_agent(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    单 Agent 流式响应（分批处理讨论）

    前端可以依次调用此 API，每个请求处理一个 agent。
    每次请求约 10-20 秒，不会超时。

    参数：
    - agentId: agent ID（如 "teacher", "student", "assistant")
    - agentRole: agent 角色
    - prompt: 讨论问题/提示
    - previousResponses: 前面 agent 的发言（用于上下文）
    - context: 场景上下文

    返回：SSE 流式事件
    """
    agent_id = body.get("agentId", "teacher")
    agent_role = body.get("agentRole", agent_id)
    prompt = body.get("prompt", "")
    previous_responses = body.get("previousResponses", [])
    context = body.get("context", {})

    logger.info(f"[AgentStream] Request - agentId={agent_id}, role={agent_role}, prompt={prompt[:50]}")
    logger.info(f"[AgentStream] Previous responses count: {len(previous_responses)}")

    # 构建场景上下文
    scene_title = context.get("scene_title", "")
    description = context.get("description", "")
    key_points = context.get("key_points", [])

    # 构建完整 prompt
    full_prompt = ""
    if scene_title:
        full_prompt += f"## 当前场景\n标题：{scene_title}\n\n"
    if description:
        full_prompt += f"## 场景描述\n{description}\n\n"
    if key_points:
        full_prompt += f"## 关键要点\n"
        for i, point in enumerate(key_points, 1):
            full_prompt += f"{i}. {point}\n"
        full_prompt += "\n"

    full_prompt += f"## 讨论问题\n{prompt}\n\n"

    # 添加前面 agent 的发言作为上下文
    if previous_responses:
        full_prompt += "## 前面同学的发言\n"
        for resp in previous_responses:
            agent_name = resp.get("agent", resp.get("agent_id", "同学"))
            content = resp.get("content", resp.get("message", ""))
            if content:
                full_prompt += f"- **{agent_name}**: {content[:200]}...\n"
        full_prompt += "\n"

    if previous_responses:
        full_prompt += "请继续讨论，结合场景要点补充观点或回应其他人的发言。"
    else:
        full_prompt += "请开始讨论，结合场景要点发表你的观点。"

    async def event_stream():
        message_id = f"msg-{uuid.uuid4().hex[:8]}"

        # 发送 agent_start
        yield sse_event("agent_start", {
            "messageId": message_id,
            "agentId": agent_id,
            "agentName": agent_role.replace("_", " ").title(),
        })

        # 流式生成（先收集完整响应，再发送解析后的文本）
        system_prompt = get_agent_system_prompt(agent_role)
        logger.info(f"[AgentStream] Agent {agent_id} - system_prompt length: {len(system_prompt)} chars")

        full_response = ""
        chunk_count = 0
        async for chunk in stream_llm(
            prompt=full_prompt,
            system_prompt=system_prompt,
            model=CHAT_MODEL,
            temperature=0.7,
        ):
            full_response += chunk
            chunk_count += 1
            # 不发送原始流（避免显示 JSON）

        logger.info(f"[AgentStream] Agent {agent_id} - completed: {len(full_response)} chars, {chunk_count} chunks")

        # 解析 actions（分离纯文本和 actions）
        display_text, actions = parse_agent_actions(full_response)
        logger.info(f"[AgentStream] parsed: display_text={len(display_text)} chars, actions={len(actions)}")

        # 发送纯文本作为 text_delta（分段发送模拟流式效果）
        if display_text:
            logger.info(f"[AgentStream] Agent {agent_id} - sending text_delta in chunks")
            # 分段发送（每 50 字符一段）
            chunks_sent = 0
            for i in range(0, len(display_text), 50):
                chunk = display_text[i:i+50]
                yield sse_event("text_delta", {
                    "messageId": message_id,
                    "content": chunk,
                })
                chunks_sent += 1
            logger.info(f"[AgentStream] Agent {agent_id} - sent {chunks_sent} text_delta events")
        else:
            logger.warning(f"[AgentStream] Agent {agent_id} - no display_text to send")

        # 发送 action 事件
        if actions:
            for action in actions:
                action_id = f"action-{uuid.uuid4().hex[:8]}"
                action_name = action.get("name", "unknown")
                yield sse_event("action", {
                    "messageId": message_id,
                    "actionId": action_id,
                    "actionName": action_name,
                    "params": action.get("params", {}),
                    "agentId": agent_id,
                })

        # 发送 agent_end
        yield sse_event("agent_end", {
            "messageId": message_id,
            "agentId": agent_id,
            "content": display_text,
        })

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )