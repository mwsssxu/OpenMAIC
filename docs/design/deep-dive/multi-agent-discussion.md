# 多智能体讨论流程详细设计

## 流程概述

```
用户发起讨论 → LangGraph状态机启动 → 角色轮转发言 → 用户参与 → 循环讨论 → 结束
```

## LangGraph状态机设计

### 状态定义

```typescript
interface DiscussionState {
  classroom_id: string;
  topic: string;
  context: string; // 课程内容上下文
  messages: Message[];
  current_agent: AgentRole;
  turn_count: number;
  user_participated: boolean;
  is_active: boolean;
}
```

### 状态机节点

| 节点 | 操作 | 输出 |
|------|------|------|
| init | 初始化状态、加载上下文 | DiscussionState |
| select_agent | 选择下一个发言角色 | AgentRole |
| generate_response | 调用LLM生成回复 | Message |
| user_input | 等待用户输入（可选） | Message |
| broadcast | 推送消息给所有用户 | SSE消息 |
| end | 结束讨论 | 最终状态 |

### 状态机边（Edges）

```typescript
// LangGraph边定义
const edges = [
  { from: 'init', to: 'select_agent' },
  { from: 'select_agent', to: 'generate_response' },
  { from: 'generate_response', to: 'broadcast' },
  { from: 'broadcast', to: 'user_input', condition: 'allow_user' },
  { from: 'broadcast', to: 'select_agent', condition: 'continue' },
  { from: 'broadcast', to: 'end', condition: 'max_turns' },
  { from: 'user_input', to: 'select_agent' },
];
```

## 智能体角色设计

### 角色定义

| 角色 | 职责 | Prompt风格 |
|------|------|-----------|
| Chief Analyst | 整体分析框架、关键洞察 | 专业、宏观、领导 |
| Market Expert | 市场趋势、消费者分析 | 数据驱动、具体 |
| Competition Expert | 竞争格局、SWOT分析 | 对比、批判 |
| Finance/Risk Expert | 财务分析、风险评估 | 保守、风险提示 |

### Prompt模板

```typescript
const agentPrompts = {
  chief_analyst: `
你是首席分析师。你的职责是：
- 提供整体分析框架
- 指出关键洞察和趋势
- 协调其他专家的观点
- 引导讨论方向

风格：专业、宏观、领导力。
请基于以下上下文发表观点：
{context}
`,
  market_expert: `
你是市场专家。你的职责是：
- 分析市场趋势和消费者行为
- 提供市场数据和预测
- 评估市场规模和增长潜力

风格：数据驱动、具体、实用。
请基于以下上下文发表观点：
{context}
`,
};
```

### 角色轮转逻辑

```typescript
const agentRotation = [
  'chief_analyst', // 开场
  'market_expert', // 市场视角
  'competition_expert', // 竞争视角
  'finance_risk_expert', // 风险视角
  'chief_analyst', // 总结和引导
];
```

## SSE流式推送设计

### 推送流程

| 步骤 | 推送内容 | 格式 |
|------|---------|------|
| 1 | 角色开始发言 | agent_start |
| 2 | 逐字推送内容 | message (多次) |
| 3 | 角色发言结束 | agent_end |
| 4 | 用户参与机会 | user_input_available |
| 5 | 下一个角色 | agent_start |

### SSE消息格式

```
Event: agent_start
Data: {"agent": "Chief Analyst", "role": "首席分析师", "avatar": "url"}

Event: message
Data: {"content": "从整体市场来看", "timestamp": 1634567890}

Event: message
Data: {"content": "，市场规模正在快速增长", "timestamp": 1634567891}

Event: agent_end
Data: {"agent": "Chief Analyst", "duration": 2.5, "message_count": 15}

Event: user_input_available
Data: {"available": true, "timeout": 30}

Event: agent_start
Data: {"agent": "Market Expert", "role": "市场专家"}
```

## LiteLLM集成设计

### 模型配置

```python
# LiteLLM配置
litellm_config = {
    "chief_analyst": "gpt-4o",
    "market_expert": "claude-3-5-sonnet",
    "competition_expert": "gpt-4o",
    "finance_risk_expert": "claude-3-5-sonnet",
}
```

### 调用示例

```python
response = litellm.completion(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": chief_analyst_prompt},
        {"role": "user", "content": f"基于上下文讨论：{context}"},
    ],
    stream=True,
)
```

## 用户参与设计

### 用户输入流程

| 步骤 | 操作 | 时间限制 |
|------|------|---------|
| 1 | 显示输入框 | 30s |
| 2 | 用户输入文字 | 用户控制 |
| 3 | 提交用户发言 | 立即 |
| 4 | 智能体回应用户 | 自动 |

### 用户发言处理

```typescript
// 用户发言后，智能体回应
if (userMessage) {
  state.messages.push({
    role: 'user',
    content: userMessage,
    agent: 'user',
  });
  
  // 下一个智能体回应用户
  nextAgent = selectNextAgent(state);
  prompt = buildResponsePrompt(nextAgent, userMessage, state);
  response = callLLM(prompt);
}
```

## Token消耗计算

| 操作 | Token消耗 |
|------|-----------|
| 智能体发言（轮） | 1 Token |
| 用户发言（轮） | 免费 |
| 超过10轮 | 每轮2 Token |

## 讨论结束条件

| 条件 | 说明 |
|------|------|
| 轮数上限 | 默认20轮，可设置5-50轮 |
| 用户主动结束 | 点击结束按钮 |
| 无活跃用户 | 5分钟无用户交互 |

## 讨论记录存储

### 存储格式

```json
{
  "classroom_id": "uuid",
  "discussion_id": "uuid",
  "messages": [
    {
      "id": "uuid",
      "agent": "Chief Analyst",
      "content": "从整体市场来看...",
      "timestamp": 1634567890
    },
    {
      "id": "uuid",
      "agent": "user",
      "content": "请问这个趋势会持续多久？",
      "timestamp": 1634567920
    }
  ],
  "created_at": "2026-04-17T10:00:00Z"
}
```

## 性能优化

| 优化点 | 方法 |
|--------|------|
| LLM响应慢 | LiteLLM缓存、预设模板 |
| SSE连接不稳定 | 心跳检测、重连机制 |
| 多用户并发 | Redis消息队列、WebSocket |

## 错误处理

| 错误类型 | 处理方式 |
|----------|---------|
| LLM调用失败 | 重试、降级模型、提示用户 |
| SSE连接断开 | 重连、恢复讨论状态 |
| Token不足 | 提示充值、暂停讨论 |