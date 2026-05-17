#!/bin/bash
# 聊天功能测试脚本
# 测试多 Agent 对话 SSE 流式响应

API_BASE_URL="http://localhost:8000"

echo "============================================================"
echo "OpenMAIC 聊天功能测试"
echo "============================================================"

# 测试讨论 SSE（使用 curl）
echo ""
echo "测试: 多 Agent 讨论 SSE 流式响应"
echo ""

# 使用 SSE 流式请求
curl -X POST "$API_BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer test-token-for-testing" \
  -d '{
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
  }' \
  --no-buffer \
  --max-time 120 2>&1 | while IFS= read -r line; do
    if [[ "$line" =~ ^data:\ ]]; then
      # 提取并解析 JSON
      data="${line#data: }"
      event_type=$(echo "$data" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('type',''))" 2>/dev/null)
      event_data=$(echo "$data" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('data',{})))" 2>/dev/null)

      case "$event_type" in
        "agent_start")
          agent_id=$(echo "$event_data" | python3 -c "import sys,json; print(json.load(sys.stdin).get('agentId',''))")
          echo "🤖 Agent 开始: $agent_id"
          ;;
        "text_delta")
          content=$(echo "$event_data" | python3 -c "import sys,json; c=json.load(sys.stdin).get('content',''); print(c[:50]+'...' if len(c)>50 else c)" 2>/dev/null)
          echo "   📝 $content"
          ;;
        "action")
          action_name=$(echo "$event_data" | python3 -c "import sys,json; print(json.load(sys.stdin).get('actionName',''))")
          echo "   🎬 Action: $action_name"
          ;;
        "agent_end")
          agent_id=$(echo "$event_data" | python3 -c "import sys,json; print(json.load(sys.stdin).get('agentId',''))")
          echo "✅ Agent 结束: $agent_id"
          ;;
        "done")
          total_agents=$(echo "$event_data" | python3 -c "import sys,json; print(json.load(sys.stdin).get('totalAgents',0))")
          echo ""
          echo "🎉 讨论结束! 总轮次: $total_agents"
          ;;
        "error")
          message=$(echo "$event_data" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))")
          echo "❌ 错误: $message"
          ;;
      esac
    fi
  done

echo ""
echo "============================================================"
echo "测试完成"
echo "============================================================"