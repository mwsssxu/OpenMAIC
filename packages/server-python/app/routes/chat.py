"""
聊天路由 - SSE 流式 Agent 对话
"""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.middleware.auth import get_current_user_id
from app.services.orchestration.director_graph import stream_agent_response, run_multi_agent_discussion
from app.core.config import settings
import json
import asyncio
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("")
async def chat(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """SSE 流式聊天"""
    messages = body.get("messages", [])
    config = body.get("config", {})
    store_state = body.get("storeState", {})
    model = body.get("model", settings.DEFAULT_MODEL)

    # 获取 Agent 配置
    agents = config.get("agentIds", ["teacher", "student"])
    topic = store_state.get("stage", {}).get("name", "课程讲解")

    async def event_stream():
        # 流式生成第一个 Agent 的回复
        first_agent = agents[0] if agents else "teacher"
        role = "teacher"

        # 获取最后一个用户消息
        last_user_message = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_message = m.get("content", "")
                break

        if not last_user_message:
            last_user_message = body.get("message", f"请开始讲解 {topic}")

        logger.info(f"Chat request: agent={first_agent}, message={last_user_message[:50]}")

        # 发送开始事件
        yield f"event: start\ndata: {json.dumps({'agent_id': first_agent, 'role': role})}\n\n"

        try:
            # 先获取完整响应，再发送
            response_text = ""
            async for event in stream_agent_response(
                agent_id=first_agent,
                agent_role=role,
                prompt=last_user_message,
                context={"topic": topic, "scene_title": topic},
                model=model,
            ):
                if event["type"] == "response_complete":
                    response_text = event["content"]
                    break

            # 发送text_delta事件
            logger.info(f"Got response: {response_text[:50]}")
            yield f"event: text_delta\ndata: {json.dumps({'type': 'text_delta', 'agent_id': first_agent, 'text': response_text})}\n\n"

            # 发送response_complete事件
            yield f"event: response_complete\ndata: {json.dumps({'type': 'response_complete', 'agent_id': first_agent, 'content': response_text})}\n\n"

        except Exception as e:
            logger.error(f"Error in stream: {e}")
            import traceback
            logger.error(traceback.format_exc())
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

        # 发送结束事件
        logger.info(f"Sending end event")
        yield f"event: end\ndata: {json.dumps({'agent_id': first_agent})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )


@router.post("/discussion")
async def start_discussion(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """多 Agent 讨论"""
    topic = body.get("topic", "")
    agents = body.get("agents", ["teacher", "student", "assistant"])
    max_turns = body.get("maxTurns", 3)
    model = body.get("model", settings.DEFAULT_MODEL)

    responses = await run_multi_agent_discussion(
        topic=topic,
        agents=agents,
        max_turns=max_turns,
        model=model,
    )

    return {"responses": responses}