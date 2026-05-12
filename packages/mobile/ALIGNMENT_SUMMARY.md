# Mobile端 与 Web端 对齐实现 - 完成总结

## 已完成的修改

### 1. Python后端修复

#### 1.1 模型兼容性 (`app/services/llm.py`)
```python
# 添加模型映射 - 将不支持的模型转换为 DashScope 支持的模型
MODEL_REMAP = {
    "gpt-4o-mini": "qwen-plus",
    "gpt-4o": "qwen-plus",
    "gpt-3.5-turbo": "qwen-turbo",
    ...
}
```
- 解决 DashScope API 不支持 gpt-4o-mini 的问题
- 在 `call_llm`, `stream_llm`, `call_llm_with_vision` 中自动映射

#### 1.2 动态Agent支持 (`app/routes/personas.py`)
```python
is_known_agent = persona_id in AGENT_SYSTEM_PROMPTS
is_dynamic_agent = not persona and not is_known_agent and persona_description

# 动态Agent使用通用模板 + persona_description
```
- 支持动态生成的 Agent ID
- 接收 `persona_description` 参数定制个性

#### 1.3 提示词模板 (`app/services/generation/prompts/templates/`)
- 从 Web端 复制 `requirements-to-outlines` 模板
- 大纲生成与 Web端 保持一致

### 2. Mobile端修复

#### 2.1 音频播放顺序 (`lib/playback/audio-player.ts`)
```typescript
// 修改为等待播放完成再返回
return new Promise<boolean>((resolve) => {
  audio.onended = () => {
    resolve(true);
  };
});
```
- 解决多个音频重叠播放问题
- Web端 和 Native端 都正确等待

#### 2.2 Action类型扩展 (`lib/types/scene.ts`)
```typescript
// 添加白板Action类型
export type ActionType = 'speech' | 'spotlight' | 'laser' | ... | 'wb_draw_text' | 'wb_draw_shape' | 'wb_open' | 'wb_clear' | 'wb_close';

// 添加白板数据类型
export interface WbDrawTextActionData {...}
export interface WbDrawShapeActionData {...}
```

#### 2.3 PlaybackEngine白板触发 (`lib/playback/engine.ts`)
```typescript
// 新增回调类型
onWhiteboardAction?: (action: SceneAction) => void;
onWhiteboardOpen?: () => void;

// 处理白板actions
private executeWhiteboard(action: SceneAction): void {
  this.callbacks.onWhiteboardAction?.(action);
  this.callbacks.onWhiteboardOpen?.(); // 自动打开白板
}
```
- 与 Web端 WebPlaybackEngine 对齐
- 自动触发白板显示

#### 2.4 多Agent讨论 (`lib/api-client/index.ts`)
```typescript
// 新增方法
async runMultiAgentDiscussion(
  topic: string,
  agents: string[],
  maxTurns: number,
  onResponse: (response) => void,
): Promise<...>
```
- 调用 `/chat/discussion` API
- 支持轮流发言回调

#### 2.5 Classroom页面集成 (`app/classroom/[id].tsx`)
```typescript
// PlaybackEngine回调
onWhiteboardAction: (action) => {...},
onWhiteboardOpen: () => setShowWhiteboard(true),

// 多Agent讨论函数
async function startMultiAgentDiscussion(topic: string) {...}
```
- 互动场景添加"开始多Agent讨论"按钮
- 讨论模式自动显示轮流发言

---

## 对齐验证清单

| 功能 | Web端 | Mobile端 | 状态 |
|-----|-------|---------|------|
| 大纲生成提示词 | templates/ | templates/ | ✅一致 |
| Agent系统提示词 | AGENT_SYSTEM_PROMPTS | 同后端 | ✅一致 |
| Speech等待完成 | 阻塞 | 阻塞 | ✅已对齐 |
| 白板Action触发 | onWhiteboardAction | onWhiteboardAction | ✅已对齐 |
| Spotlight/Laser | 非阻塞 | 非阻塞 | ✅一致 |
| 多Agent讨论 | /chat/discussion | /chat/discussion | ✅已添加 |
| 模型映射 | - | MODEL_REMAP | ✅已添加 |
| 动态Agent支持 | persona_description | persona_description | ✅已添加 |

---

## 待实现功能 (P2)

1. **白板用户交互绘制** - Mobile端仅显示，Web端支持用户绘制
2. **WebSocket协作同步** - Mobile端未实现实时协作
3. **讨论SSE流式** - 当前 `/chat/discussion` 返回完整数组，可改为流式

---

## 文件修改列表

| 文件路径 | 修改类型 |
|---------|---------|
| `server-python/app/services/llm.py` | 添加模型映射 |
| `server-python/app/routes/personas.py` | 动态Agent支持 |
| `server-python/app/services/generation/prompts/templates/` | 新增模板目录 |
| `mobile/lib/playback/audio-player.ts` | 等待播放完成 |
| `mobile/lib/playback/engine.ts` | 白板回调+类型处理 |
| `mobile/lib/types/scene.ts` | Action类型扩展 |
| `mobile/lib/api-client/index.ts` | 多Agent讨论API |
| `mobile/app/classroom/[id].tsx` | 讨论功能+白板集成 |

---

## 测试建议

1. **Agent对话测试**
   - 点击 Agent 头像，发送问题
   - 验证 SSE 流式响应
   - 验证白板自动显示（如有 wb_draw actions）

2. **多Agent讨论测试**
   - 进入互动场景
   - 点击"开始多Agent讨论"
   - 验证轮流发言显示

3. **播放测试**
   - 点击播放按钮
   - 验证语音播放顺序（无重叠）
   - 验证白板自动显示