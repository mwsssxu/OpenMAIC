"""
聊天功能测试脚本
测试多 Agent 对话 SSE 流式响应

运行方式:
python tests/test_chat_sse.py
"""

import asyncio
import httpx
import json
import uuid

API_BASE_URL = "http://localhost:8000"
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "test123456"


async def get_auth_token() -> str:
    """获取认证 token"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{API_BASE_URL}/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if resp.status_code != 200:
            raise Exception(f"登录失败: {resp.text}")
        return resp.json().get("access_token")


async def test_chat_discussion_sse(token: str):
    """测试多 Agent 讨论 SSE 流式响应"""
    print("=" * 60)
    print("测试: 多 Agent 讨论 SSE 流式响应")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=120.0) as client:
        # 构建请求
        request_body = {
            "messages": [],
            "config": {
                "sessionType": "discussion",
                "agentIds": ["teacher", "student", "assistant"],
                "discussionTopic": "请讲解公司治理结构的基本概念",
                "discussionPrompt": "请讲解公司治理结构的基本概念"
            },
            "storeState": {
                "stage": {"name": "公司治理"},
                "scene": {
                    "title": "公司治理结构",
                    "content": {
                        "key_points": ["股东会", "董事会", "监事会", "管理层"],
                        "description": "公司治理结构是指公司内部的权力分配和监督机制"
                    }
                }
            }
        }

        print(f"\n请求配置:")
        print(f"  - sessionType: {request_body['config']['sessionType']}")
        print(f"  - agentIds: {request_body['config']['agentIds']}")
        print(f"  - topic: {request_body['config']['discussionTopic'][:30]}...")

        # 发送 SSE 请求
        agent_responses = []
        current_agent = None
        total_text = ""
        total_actions = 0

        async with client.stream(
            "POST",
            f"{API_BASE_URL}/chat",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream"
            },
            json=request_body,
        ) as response:
            if response.status_code != 200:
                print(f"\n❌ 请求失败: {response.status_code}")
                print(response.text)
                return False

            print(f"\n✅ SSE 连接成功，开始接收事件...\n")

            async for line in response.aiter_lines():
                if not line.strip():
                    continue

                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    try:
                        event = json.loads(data_str)
                        event_type = event.get("type")
                        event_data = event.get("data", {})

                        if event_type == "agent_start":
                            current_agent = event_data.get("agentId")
                            agent_responses.append({
                                "agentId": current_agent,
                                "text": "",
                                "actions": []
                            })
                            print(f"🤖 Agent 开始: {current_agent}")

                        elif event_type == "text_delta":
                            content = event_data.get("content", "")
                            if current_agent and agent_responses:
                                agent_responses[-1]["text"] += content
                            total_text += content
                            # 打印部分内容
                            if len(content) > 0:
                                print(f"   📝 {content[:50]}...")

                        elif event_type == "action":
                            action_name = event_data.get("actionName", "")
                            action_id = event_data.get("actionId", "")
                            if current_agent and agent_responses:
                                agent_responses[-1]["actions"].append({
                                    "actionId": action_id,
                                    "actionName": action_name,
                                    "params": event_data.get("params", {})
                                })
                            total_actions += 1
                            print(f"   🎬 Action: {action_name}")

                        elif event_type == "agent_end":
                            print(f"✅ Agent 结束: {current_agent}")
                            current_agent = None

                        elif event_type == "done":
                            print(f"\n🎉 讨论结束!")
                            print(f"   - 总轮次: {event_data.get('totalAgents', 0)}")
                            print(f"   - 总动作: {event_data.get('totalActions', 0)}")

                        elif event_type == "error":
                            print(f"❌ 错误: {event_data.get('message', 'Unknown error')}")

                    except json.JSONDecodeError:
                        pass

        # 打印结果统计
        print("\n" + "=" * 60)
        print("测试结果统计")
        print("=" * 60)

        unique_agents = set(r["agentId"] for r in agent_responses)
        print(f"\n参与 Agent 数量: {len(unique_agents)}")
        print(f"参与 Agent 列表: {list(unique_agents)}")

        print(f"\n总文本长度: {len(total_text)} 字符")
        print(f"总动作数量: {total_actions}")

        print("\n各 Agent 详情:")
        for resp in agent_responses:
            agent_id = resp.get("agentId", "unknown")
            text_len = len(resp.get("text", ""))
            actions_count = len(resp.get("actions", []))
            print(f"  - {agent_id}: 文本 {text_len} 字, 动作 {actions_count} 个")

        # 验证结果
        print("\n验证结果:")
        passed = True

        # 1. 检查是否有多个不同 Agent 参与
        if len(unique_agents) >= 2:
            print(f"  ✅ 多 Agent 参与: {len(unique_agents)} 个不同 Agent")
        else:
            print(f"  ❌ 多 Agent 参与: 只有 {len(unique_agents)} 个 Agent")
            passed = False

        # 2. 检查是否包含 teacher, student, assistant
        expected_agents = {"teacher", "student", "assistant"}
        found_agents = unique_agents.intersection(expected_agents)
        if len(found_agents) >= 2:
            print(f"  ✅ 角色类型: 包含 {list(found_agents)}")
        else:
            print(f"  ❌ 角色类型: 缺少预期角色")
            passed = False

        # 3. 检查是否有文本内容
        if len(total_text) > 100:
            print(f"  ✅ 文本内容: {len(total_text)} 字符")
        else:
            print(f"  ❌ 文本内容: 内容过短")
            passed = False

        return passed


async def main():
    print("\n" + "=" * 60)
    print("OpenMAIC 聊天功能测试")
    print("=" * 60)

    try:
        # 1. 获取 token
        print("\n步骤 1: 获取认证 token...")
        token = await get_auth_token()
        print(f"✅ Token 获取成功")

        # 2. 测试讨论 SSE
        print("\n步骤 2: 测试多 Agent 讨论 SSE...")
        passed = await test_chat_discussion_sse(token)

        if passed:
            print("\n" + "=" * 60)
            print("🎉 所有测试通过!")
            print("=" * 60)
        else:
            print("\n" + "=" * 60)
            print("❌ 测试失败，请检查日志")
            print("=" * 60)

    except Exception as e:
        print(f"\n❌ 测试执行失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())