"""
聊天功能单元测试
测试 chat.py 的 parse_agent_actions 和 SSE 事件生成

运行方式:
pytest tests/test_chat_unit.py -v --asyncio-mode=auto
"""

import pytest
import asyncio
import json
import re
from app.routes.chat import parse_agent_actions, sse_event


def test_parse_agent_actions_json_array():
    """测试解析 JSON 数组格式的 actions"""
    response_text = '''
这是讲解文本。

```json
[{"type":"action","name":"wb_open","params":{}},{"type":"action","name":"wb_draw_text","params":{"content":"测试内容"}}]
```
'''
    display_text, actions = parse_agent_actions(response_text)

    assert len(actions) == 2
    assert actions[0]["name"] == "wb_open"
    assert actions[1]["name"] == "wb_draw_text"
    assert "讲解文本" in display_text
    assert "```json" not in display_text
    print(f"✅ JSON 数组解析成功: {len(actions)} actions")


def test_parse_agent_actions_multiple_blocks():
    """测试解析多个独立 JSON 代码块的 actions"""
    response_text = '''
这是讲解文本。

```json
{"type":"action","name":"wb_open","params":{}}
```

继续讲解...

```json
{"type":"action","name":"wb_draw_text","params":{"content":"图表内容"}}
```
'''
    display_text, actions = parse_agent_actions(response_text)

    assert len(actions) == 2
    assert actions[0]["name"] == "wb_open"
    assert actions[1]["name"] == "wb_draw_text"
    assert "讲解文本" in display_text
    assert "继续讲解" in display_text
    assert "```json" not in display_text
    print(f"✅ 多代码块解析成功: {len(actions)} actions")


def test_parse_agent_actions_raw_json():
    """测试解析无代码块的原始 JSON"""
    response_text = '''
这是讲解文本。

[{"type":"action","name":"wb_open","params":{}},{"type":"action","name":"wb_draw_text","params":{"content":"测试"}}]

后续内容。
'''
    display_text, actions = parse_agent_actions(response_text)

    assert len(actions) == 2
    assert actions[0]["name"] == "wb_open"
    assert "讲解文本" in display_text
    assert "后续内容" in display_text
    print(f"✅ 原始 JSON 解析成功: {len(actions)} actions")


def test_parse_agent_actions_no_actions():
    """测试无 actions 的纯文本"""
    response_text = '''
这是纯讲解文本，没有 JSON 内容。
'''
    display_text, actions = parse_agent_actions(response_text)

    assert len(actions) == 0
    assert display_text.strip() == "这是纯讲解文本，没有 JSON 内容。"
    print(f"✅ 纯文本解析成功: 无 actions")


def test_sse_event_format():
    """测试 SSE 事件格式"""
    event = sse_event("agent_start", {
        "messageId": "msg-123",
        "agentId": "teacher",
        "agentName": "张老师",
        "agentColor": "#5b9bd5"
    })

    assert event.startswith("data: ")
    assert "agent_start" in event
    assert "teacher" in event
    assert "\n\n" in event

    # 解析验证
    data_str = event[6:].strip()
    parsed = json.loads(data_str)
    assert parsed["type"] == "agent_start"
    assert parsed["data"]["agentId"] == "teacher"
    print(f"✅ SSE 格式正确: {parsed['type']}")


def test_sse_event_text_delta():
    """测试 text_delta SSE 事件"""
    event = sse_event("text_delta", {
        "messageId": "msg-123",
        "content": "这是增量文本内容"
    })

    data_str = event[6:].strip()
    parsed = json.loads(data_str)

    assert parsed["type"] == "text_delta"
    assert parsed["data"]["content"] == "这是增量文本内容"
    print(f"✅ text_delta 格式正确")


def test_sse_event_action():
    """测试 action SSE 事件"""
    event = sse_event("action", {
        "messageId": "msg-123",
        "actionId": "action-456",
        "actionName": "wb_draw_text",
        "params": {"content": "白板内容"},
        "agentId": "teacher"
    })

    data_str = event[6:].strip()
    parsed = json.loads(data_str)

    assert parsed["type"] == "action"
    assert parsed["data"]["actionName"] == "wb_draw_text"
    assert parsed["data"]["params"]["content"] == "白板内容"
    print(f"✅ action 格式正确")


def test_sse_event_done():
    """测试 done SSE 事件"""
    event = sse_event("done", {
        "totalAgents": 6,
        "totalActions": 3,
        "directorState": {"turnCount": 2, "shouldEnd": True}
    })

    data_str = event[6:].strip()
    parsed = json.loads(data_str)

    assert parsed["type"] == "done"
    assert parsed["data"]["totalAgents"] == 6
    print(f"✅ done 格式正确")


if __name__ == "__main__":
    print("=" * 60)
    print("聊天功能单元测试")
    print("=" * 60)

    print("\n测试 parse_agent_actions:")
    test_parse_agent_actions_json_array()
    test_parse_agent_actions_multiple_blocks()
    test_parse_agent_actions_raw_json()
    test_parse_agent_actions_no_actions()

    print("\n测试 SSE 事件格式:")
    test_sse_event_format()
    test_sse_event_text_delta()
    test_sse_event_action()
    test_sse_event_done()

    print("\n" + "=" * 60)
    print("🎉 所有测试通过!")
    print("=" * 60)