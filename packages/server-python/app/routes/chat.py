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

# Chat 专用模型（使用 qwen3.6-plus）
CHAT_MODEL = "qwen3.6-plus"


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
    logger.info(f"[Parse] ========== 解析开始 ==========")
    logger.info(f"[Parse] 输入长度: {len(response_text)} chars")
    logger.info(f"[Parse] 输入内容前300字符: {response_text[:300]}")

    actions = []
    display_text = response_text.strip()

    # 首先检测是否整个响应都是 JSON 格式 [{"type":...}, ...]
    # 这是最常见的情况 - LLM 直接输出 JSON 数组
    try:
        # 尝试解析整个响应为 JSON
        logger.info(f"[Parse] 尝试解析完整JSON...")
        parsed = json.loads(response_text.strip())
        logger.info(f"[Parse] JSON解析成功，类型: {type(parsed).__name__}")

        if isinstance(parsed, list):
            logger.info(f"[Parse] JSON数组长度: {len(parsed)}")
            # 检查是否是 [{"type":"text",...}, {"type":"action",...}] 格式
            text_contents = []
            for i, item in enumerate(parsed):
                if isinstance(item, dict):
                    item_type = item.get("type", "")
                    logger.info(f"[Parse] 数组元素[{i}] type={item_type}")
                    if item_type == "text":
                        # 提取 text 元素的 content
                        content = item.get("content", "")
                        if content:
                            text_contents.append(content)
                            logger.info(f"[Parse] 提取text content长度: {len(content)}")
                    elif item_type == "action":
                        # 收集 action 元素
                        actions.append(item)
                        logger.info(f"[Parse] 收集action: {item.get('name', 'unknown')}")

            # 如果成功提取到文本内容，直接使用
            if text_contents:
                display_text = "\n\n".join(text_contents)
                logger.info(f"[Parse] ✅ 完整JSON数组提取成功 - text片段数={len(text_contents)}, actions数={len(actions)}")
                logger.info(f"[Parse] 最终display_text前100字符: {display_text[:100]}")
                return display_text, actions

        elif isinstance(parsed, dict):
            # 单个 JSON 对象 {"type":"text","content":"..."}
            logger.info(f"[Parse] 单个JSON对象，type={parsed.get('type')}")
            if parsed.get("type") == "text":
                display_text = parsed.get("content", "")
                logger.info(f"[Parse] ✅ 单个JSON text对象提取成功")
                return display_text, actions
            elif parsed.get("type") == "action":
                actions.append(parsed)
                display_text = ""
                logger.info(f"[Parse] ✅ 单个JSON action对象提取成功")
                return display_text, actions
    except json.JSONDecodeError as je:
        # 不是完整 JSON，继续其他解析方法
        logger.info(f"[Parse] JSON解析失败: {je}, 尝试其他方法")

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

    # 方法4：从扁平化/拼接文本中提取 wb_* actions
    # 当 LLM 输出类似 "typeactionnamewb_draw_shapeparamsshaperectanglex120y250..."
    # 或缩写格式 "w_textparamscontent..." 的扁平化文本时，用正则提取 action 片段
    if not actions:
        # 扩展匹配模式：包括完整名称和缩写形式
        # 缩写映射：w_text=wb_draw_text, w_shape=wb_draw_shape, w_latex=wb_draw_latex 等
        action_patterns = {
            'wb_draw_text': ['wb_draw_text', 'w_text', 'draw_text'],
            'wb_draw_shape': ['wb_draw_shape', 'w_shape', 'draw_shape'],
            'wb_draw_line': ['wb_draw_line', 'w_line', 'draw_line'],
            'wb_draw_latex': ['wb_draw_latex', 'w_latex', 'draw_latex'],
            'wb_draw_chart': ['wb_draw_chart', 'w_chart', 'draw_chart'],
            'wb_draw_table': ['wb_draw_table', 'w_table', 'draw_table'],
            'wb_draw_code': ['wb_draw_code', 'w_code', 'draw_code'],
            'wb_open': ['wb_open', 'w_open'],
            'wb_close': ['wb_close', 'w_close'],
            'wb_clear': ['wb_clear', 'w_clear'],
            'wb_delete': ['wb_delete', 'w_delete'],
            'wb_edit_code': ['wb_edit_code', 'w_edit_code'],
        }

        wb_action_names = list(action_patterns.keys())

        for act_name in wb_action_names:
            patterns_to_match = action_patterns[act_name]
            found = False

            for pattern in patterns_to_match:
                # 匹配多种格式：
                # 1. "name":"wb_draw_shape" (标准JSON)
                # 2. namewb_draw_shape (扁平化)
                # 3. wb_draw_shape (裸action名)
                # 4. w_text (缩写形式)
                regex_patterns = [
                    rf'"name"\s*:\s*"{re.escape(pattern)}"',
                    rf'name{re.escape(pattern)}',
                    rf'{re.escape(pattern)}(?=\s*params|\s*\n|\s*$|params)',
                ]

                for pat in regex_patterns:
                    m = re.search(pat, response_text, re.IGNORECASE)
                    if m:
                        found = True
                        # 找到了 action，尝试提取 params
                        after_name = response_text[m.end():]

                        # 对于 wb_open/wb_close/wb_clear 无需 params
                        if act_name in ('wb_open', 'wb_close', 'wb_clear'):
                            actions.append({"type": "action", "name": act_name, "params": {}})
                        else:
                            # 尝试提取 params JSON 对象
                            params_match = re.search(r'"params"\s*:\s*(\{[^}]*\})', after_name)
                            params = {}
                            if params_match:
                                try:
                                    params = json.loads(params_match.group(1))
                                except json.JSONDecodeError:
                                    pass
                            else:
                                # 扁平化格式：提取 key-value 对
                                param_fields = {
                                    'wb_draw_text': ['content', 'x', 'y', 'width', 'height', 'fontSize', 'color', 'elementId'],
                                    'wb_draw_shape': ['shape', 'x', 'y', 'width', 'height', 'fillColor', 'elementId'],
                                    'wb_draw_line': ['startX', 'startY', 'endX', 'endY', 'color', 'width', 'style', 'points', 'elementId'],
                                    'wb_draw_latex': ['latex', 'content', 'x', 'y', 'height', 'width', 'color', 'elementId'],
                                    'wb_draw_chart': ['chartType', 'x', 'y', 'width', 'height', 'data'],
                                    'wb_draw_table': ['x', 'y', 'width', 'height', 'data'],
                                    'wb_draw_code': ['language', 'code', 'content', 'x', 'y', 'width', 'height', 'fileName', 'elementId'],
                                    'wb_delete': ['elementId'],
                                    'wb_edit_code': ['elementId', 'operations'],
                                }
                                fields = param_fields.get(act_name, [])

                                for field in fields:
                                    # 匹配 fieldvalue (扁平化) 或 field:value 或 "field":value
                                    val_match = re.search(
                                        rf'{re.escape(field)}\s*[:=]?\s*([^,\s\}}]+)',
                                        after_name
                                    )
                                    if val_match:
                                        val = val_match.group(1).strip().strip('"').strip("'")
                                        # 数值字段转换
                                        if field in ('x', 'y', 'width', 'height', 'fontSize', 'startX', 'startY', 'endX', 'endY'):
                                            try:
                                                val = float(val)
                                                if val == int(val):
                                                    val = int(val)
                                            except ValueError:
                                                pass
                                        params[field] = val

                            actions.append({"type": "action", "name": act_name, "params": params})
                        break  # 找到这个 pattern 后跳出 regex_patterns 循环

                if found:
                    break  # 找到这个 action 后跳出 patterns_to_match 循环

        if actions:
            # 从 display_text 中移除 action 相关内容
            # 直接使用正则移除所有 wb_* action 块（包括参数）
            cleaned_text = response_text

            # 移除完整的 action 块（从 "action" 或 "typeaction" 开始到下一个 action 或文本结束）
            # 模式：action/name/params 的扁平化组合
            for act in actions:
                act_name = act.get("name", "")
                # 移除包含该 action 名的整个块
                # 匹配: "action\n  wb_draw_text\n  ...\n\n" 或 "typeactionnamewb_draw_text..."
                patterns_to_remove = [
                    rf'action\s*\n?\s*{re.escape(act_name)}[^\n]*(?:\n[^\n]*)*?(?=\n\s*\n|\n\s*action|\Z)',  # 多行格式
                    rf'typeactionname{re.escape(act_name)}[^\n]*',  # 扁平化格式
                    rf'"{re.escape(act_name)}"[^}}]*\}}',  # JSON 片段
                ]
                for pat in patterns_to_remove:
                    cleaned_text = re.sub(pat, '', cleaned_text, flags=re.DOTALL)

            # 移除截断/损坏的 action 格式
            cleaned_text = re.sub(r'[a-z]*namewb_[a-z_]*[^\n]*', '', cleaned_text, flags=re.IGNORECASE)
            cleaned_text = re.sub(r'[a-z]*wb_dra[a-z_]*[^\n]*', '', cleaned_text, flags=re.IGNORECASE)
            cleaned_text = re.sub(r'w_(text|shape|latex|chart|table|code|line|open|close|clear|delete)[a-z]*', '', cleaned_text, flags=re.IGNORECASE)

            # 移除残留的 JSON 关键字
            cleaned_text = re.sub(r'\b(type|action|name|params|elementId)\b', '', cleaned_text)
            cleaned_text = re.sub(r'\b(content|x|y|width|height|fontSize|color|shape|data|latex|code|language|fileName|startX|startY|endX|endY|points|style|chartType|fillColor)\b', '', cleaned_text)
            # 移除 LaTeX 残留
            cleaned_text = re.sub(r'\\[a-zA-Z]+\s*\{[^}]*\}', '', cleaned_text)
            cleaned_text = re.sub(r'\\[a-zA-Z]+', '', cleaned_text)
            # 移除颜色值和数字
            cleaned_text = re.sub(r'#[0-9a-fA-F]{3,6}\s*', '', cleaned_text)
            cleaned_text = re.sub(r'\b\d{2,}\b', '', cleaned_text)
            cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()

            if cleaned_text and len(cleaned_text) > 10:
                display_text = cleaned_text
            elif not cleaned_text:
                display_text = ""
            logger.info(f"[Parse] 方法4提取: {len(actions)} actions from flattened text, cleaned_text length: {len(cleaned_text)}")

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

        # 清理残留的空引号对
        cleaned = re.sub(r'""\s*:\s*""', '', cleaned)
        cleaned = re.sub(r'""\s*,?\s*""', '', cleaned)
        cleaned = re.sub(r':\s*""', '', cleaned)
        cleaned = re.sub(r'""', '', cleaned)

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

    # 检查清理后是否还有有效内容（至少有一些字母或中文）
    has_valid_content = bool(re.search(r'[一-鿿\w]{3,}', display_text))

    if not has_valid_content and response_text:
        # 如果清理后没有有效内容，尝试提取纯文本部分
        logger.warning(f"[Parse] display_text无有效内容，使用fallback提取")
        # 移除所有 JSON 相关字符后保留
        fallback_text = re.sub(r'[\[\]{}"\':,]', ' ', response_text)
        fallback_text = re.sub(r'\b(type|content|name|params|x|y|width|height|fontSize|color|action|elementId)\b', ' ', fallback_text, flags=re.IGNORECASE)
        # 移除损坏的 action 格式
        fallback_text = re.sub(r'[a-z]*namewb_[a-z_]*', ' ', fallback_text, flags=re.IGNORECASE)
        fallback_text = re.sub(r'[a-z]*wb_dra[a-z_]*', ' ', fallback_text, flags=re.IGNORECASE)
        fallback_text = re.sub(r'w_(text|shape|latex|chart|table|code|line|open|close|clear|delete)[a-z]*', ' ', fallback_text, flags=re.IGNORECASE)
        # 移除数字和颜色值
        fallback_text = re.sub(r'#[0-9a-fA-F]{3,6}', ' ', fallback_text)
        fallback_text = re.sub(r'\b\d{2,}\b', ' ', fallback_text)
        # 移除 LaTeX
        fallback_text = re.sub(r'\\[a-zA-Z]+\s*\{[^}]*\}', ' ', fallback_text)
        fallback_text = re.sub(r'\\[a-zA-Z]+', ' ', fallback_text)
        # 清理空白
        fallback_text = re.sub(r'\s+', ' ', fallback_text).strip()

        if fallback_text and len(fallback_text) > 5:
            display_text = fallback_text
            logger.info(f"[Parse] fallback提取成功: {display_text[:50]}...")
        else:
            # 如果 fallback 也失败，返回空字符串
            display_text = ""
            logger.warning(f"[Parse] fallback提取失败，返回空字符串")

    logger.info(f"[Parse] ========== 解析结束 ==========")
    logger.info(f"[Parse] 最终结果: display_text长度={len(display_text)} chars, actions数量={len(actions)}")
    logger.info(f"[Parse] display_text前100字符: {display_text[:100]}")
    if actions:
        logger.info(f"[Parse] actions列表: {[a.get('name', 'unknown') for a in actions]}")

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
    logger.info(f"[AgentStream] ========== 新请求开始 ==========")
    logger.info(f"[AgentStream] Request body: {json.dumps(body, ensure_ascii=False)[:500]}")

    agent_id = body.get("agentId", "teacher")
    agent_role = body.get("agentRole", agent_id)
    prompt = body.get("prompt", "")
    previous_responses = body.get("previousResponses", [])
    context = body.get("context", {})

    logger.info(f"[AgentStream] 解析参数 - agentId={agent_id}, role={agent_role}")
    logger.info(f"[AgentStream] prompt前50字符: {prompt[:50]}")
    logger.info(f"[AgentStream] previousResponses数量: {len(previous_responses)}")
    logger.info(f"[AgentStream] context内容: scene_title={context.get('scene_title', '')}, key_points={context.get('key_points', [])}")

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
        try:
            message_id = f"msg-{uuid.uuid4().hex[:8]}"
            logger.info(f"[AgentStream] event_stream 开始 - messageId={message_id}")

            # 发送 agent_start
            yield sse_event("agent_start", {
                "messageId": message_id,
                "agentId": agent_id,
                "agentName": agent_role.replace("_", " ").title(),
            })
            logger.info(f"[AgentStream] 已发送 agent_start")

            # 流式生成（先收集完整响应，再发送解析后的文本）
            system_prompt = get_agent_system_prompt(agent_role)
            logger.info(f"[AgentStream] Agent {agent_id} - system_prompt前100字符: {system_prompt[:100]}")
            logger.info(f"[AgentStream] Agent {agent_id} - full_prompt前200字符: {full_prompt[:200]}")

            full_response = ""
            chunk_count = 0
            try:
                async for chunk in stream_llm(
                    prompt=full_prompt,
                    system_prompt=system_prompt,
                    model=CHAT_MODEL,
                    temperature=0.7,
                ):
                    full_response += chunk
                    chunk_count += 1
                    if chunk_count % 20 == 0:
                        logger.debug(f"[AgentStream] LLM进度: {chunk_count} chunks, {len(full_response)} chars")
            except Exception as llm_err:
                logger.error(f"[AgentStream] LLM调用失败: {llm_err}")
                import traceback
                logger.error(f"[AgentStream] LLM错误堆栈: {traceback.format_exc()}")
                yield sse_event("error", {"message": f"LLM调用失败: {str(llm_err)}"})
                return

            logger.info(f"[AgentStream] Agent {agent_id} - LLM完成: {len(full_response)} chars, {chunk_count} chunks")
            logger.info(f"[AgentStream] LLM响应前200字符: {full_response[:200]}")

            # 解析 actions（分离纯文本和 actions）
            display_text, actions = parse_agent_actions(full_response)
            logger.info(f"[AgentStream] 解析结果: display_text长度={len(display_text)}, actions数量={len(actions)}")
            logger.info(f"[AgentStream] display_text前100字符: {display_text[:100]}")

            # 发送纯文本作为 text_delta（分段发送模拟流式效果）
            if display_text:
                logger.info(f"[AgentStream] Agent {agent_id} - 开始发送 text_delta")
                # 分段发送（每 50 字符一段）
                chunks_sent = 0
                for i in range(0, len(display_text), 50):
                    chunk = display_text[i:i+50]
                    yield sse_event("text_delta", {
                        "messageId": message_id,
                        "content": chunk,
                    })
                    chunks_sent += 1
                logger.info(f"[AgentStream] Agent {agent_id} - 已发送 {chunks_sent} 个 text_delta 事件")
            else:
                logger.warning(f"[AgentStream] Agent {agent_id} - display_text 为空，无法发送")

            # 发送 action 事件
            if actions:
                logger.info(f"[AgentStream] 发送 {len(actions)} 个 action 事件")
                for action in actions:
                    action_id = f"action-{uuid.uuid4().hex[:8]}"
                    action_name = action.get("name", "unknown")
                    logger.info(f"[AgentStream] action: {action_name}, params: {json.dumps(action.get('params', {}), ensure_ascii=False)[:100]}")
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
            logger.info(f"[AgentStream] ========== Agent {agent_id} 完成 ==========")

        except Exception as e:
            logger.error(f"[AgentStream] event_stream 异常: {e}")
            import traceback
            logger.error(f"[AgentStream] 异常堆栈: {traceback.format_exc()}")
            yield sse_event("error", {"message": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )