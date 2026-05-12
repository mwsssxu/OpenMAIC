# Web端与Mobile端实现对比分析

## 1. 整体架构

### Web端
```
用户 → React组件 → API Client → Python后端 → LLM
                  ↓ SSE流式
                  ↓ WebSocket协作
```

### Mobile端
```
用户 → React Native组件 → API Client → Python后端 → LLM
                          ↓ SSE流式（部分实现）
                          ↓ 无WebSocket
```

---

## 2. 各阶段实现对比

### 2.1 课程生成

| 功能 | Web端 | Mobile端 | 差异 |
|-----|-------|---------|------|
| 大纲生成 | `/generate/outlines-stream` SSE | `/generate/outlines-stream` SSE | ✅一致 |
| Agent配置 | `/generate/agent-profiles` | `/generate/agent-profiles` | ✅一致 |
| 场景生成 | `/generate/scene-with-actions` | `/generate/scene-with-actions` | ✅一致 |

### 2.2 Agent对话

| 功能 | Web端 | Mobile端 | 差异 |
|-----|-------|---------|------|
| 主要API | `/chat` SSE | `/personas/chat` REST ⚠️ | 应统一使用 `/chat` |
| 多Agent讨论 | `/chat/discussion` | `/chat/discussion` | ✅已添加 |
| 系统提示词 | `AGENT_SYSTEM_PROMPTS` | `AGENT_SYSTEM_PROMPTS`（后端） | ✅一致 |
| 动态Agent | 支持 `persona_description` | 支持 `persona_description` | ✅一致 |

**问题**: Mobile端优先使用 `/personas/chat`，但 `/chat` SSE 是主要接口

### 2.3 播放引擎

| 功能 | Web端 WebPlaybackEngine | Mobile端 PlaybackEngine | 差异 |
|-----|------------------------|------------------------|------|
| Speech等待 | ✅ 阻塞等待播放完成 | ✅ 已修复等待完成 | ✅已对齐 |
| Spotlight | ✅ 非阻塞 | ✅ 非阻塞 | ✅一致 |
| Laser | ✅ 非阻塞 | ✅ 非阻塞 | ✅一致 |
| 白板Actions | ✅ 触发白板显示 | ⚠️ 需手动显示 | 需自动触发 |

### 2.4 白板系统

| 功能 | Web端 | Mobile端 | 差异 |
|-----|-------|---------|------|
| 组件 | WhiteboardCanvas (完整) | WhiteboardOverlay (简化) | 功能简化 |
| Agent绘制 | wb_draw_text/shape | wb_draw_text/shape | ✅一致 |
| 用户绘制 | ✅ 支持交互绘制 | ❌ 仅显示 | 功能缺失 |
| 协作同步 | WebSocket CRDT | ❌ 无 | 功能缺失 |

### 2.5 TTS语音

| 功能 | Web端 | Mobile端 | 差异 |
|-----|-------|---------|------|
| API | `/tts` | `/tts` | ✅一致 |
| Browser Native | Web Speech API | expo-speech | ✅一致 |
| 播放等待 | ✅ 正确等待 | ✅ 已修复 | ✅已对齐 |

---

## 3. 需要完善的功能

### 3.1 Agent对话 - 使用Web端一致的SSE流

**Web端实现**:
```typescript
// api-client.ts
async streamChat(body, onChunk, onError) {
  const response = await fetch(`${API_URL}/chat/stream`, {...});
  // SSE解析
}

// classroom page
const response = await apiClient.chat({
  messages,
  config: { agentIds: [selectedAgent.id] },
  storeState: { stage: { name }, scene: { title } },
});
```

**Mobile端需调整**:
- 优先使用 `/chat` SSE，而非 `/personas/chat`
- 确保 `agent_role` 正确传递（匹配 AGENT_SYSTEM_PROMPTS）

### 3.2 播放引擎 - 自动处理白板Actions

**Web端实现**:
```typescript
// playback/engine.ts
if (action.type === 'wb_draw_text' || action.type === 'wb_draw_shape') {
  // 触发白板显示
  this.callbacks.onWhiteboardAction?.(action);
}
```

**Mobile端需添加**:
- PlaybackEngine 添加 `onWhiteboardAction` 回调
- 自动触发白板显示

### 3.3 多Agent讨论 - SSE流式讨论

**当前实现**: `/chat/discussion` 返回完整数组

**改进方案**: 改为 SSE 流式返回每个 Agent 回复

---

## 4. AGENT_SYSTEM_PROMPTS 对齐

### 后端定义 (director_graph.py)
```python
AGENT_SYSTEM_PROMPTS = {
    "teacher": """你是教师，负责引导学生学习...""",
    "student": """你是学生，负责提问和讨论...""",
    "assistant": """你是教学助手，辅助教师...""",
}
```

### 前端传递规则
- `agent_id` = "teacher" / "student" / "assistant" 时，使用对应 SYSTEM_PROMPT
- 动态 Agent ID 时，使用 `persona_description` 参数
- 确保 Mobile端 apiClient.streamAgentChat 传递正确的 `agentIds`

---

## 5. 修复优先级

| 优先级 | 功能 | 文件 |
|-------|------|------|
| P0 | 统一使用 `/chat` SSE | mobile/lib/api-client, classroom/[id] |
| P0 | PlaybackEngine自动触发白板 | mobile/lib/playback/engine.ts |
| P1 | 白板交互绘制 | mobile/components/classroom/WhiteboardOverlay |
| P2 | 多Agent讨论SSE流式 | server-python/routes/chat.py |

---

## 6. 提示词一致性检查

### 大纲生成提示词
- ✅ 已从Web端复制到 `prompts/templates/requirements-to-outlines/`

### 场景内容生成提示词
- ✅ `slide-content` 模板已复制

### Agent对话提示词
- ✅ `AGENT_SYSTEM_PROMPTS` 后端统一定义
- ⚠️ Mobile端需确保传递正确的 `agent_role`

---

## 7. 执行计划

1. **Phase 1**: 统一Agent对话API
   - 修改 `streamAgentChat` 为主要方法
   - 添加 `agent_role` 参数传递

2. **Phase 2**: PlaybackEngine白板触发
   - 添加 `onWhiteboardAction` 回调
   - 自动处理 wb_draw actions

3. **Phase 3**: 优化白板组件
   - 支持基本交互绘制
   - 显示 Agent 绘制的公式/图表

4. **Phase 4**: SSE流式讨论
   - `/chat/discussion` 改为 SSE
   - Mobile端实时显示讨论过程