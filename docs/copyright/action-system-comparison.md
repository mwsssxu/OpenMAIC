# Web端与移动端 Action 处理方式对比与移植优化文档

## 一、总体架构对比

### Web端架构（三层分离）

```
┌─────────────────────────────────────────────────┐
│  Stage.tsx（协调层）                              │
│  创建 ActionEngine + PlaybackEngine              │
│  桥接 React 状态 ↔ 引擎回调                      │
├─────────────────────────────────────────────────┤
│  PlaybackEngine（调度层）                         │
│  状态机 idle→playing→paused→live                  │
│  按序执行 Action[]，处理 Discussion 生命周期       │
├─────────────────────────────────────────────────┤
│  ActionEngine（执行层）                           │
│  execute(action) 统一入口                        │
│  Fire-and-forget: spotlight/laser               │
│  Synchronous: speech/wb_*/play_video/widget_*   │
└─────────────────────────────────────────────────┘
```

### 移动端架构（两层合并）

```
┌─────────────────────────────────────────────────┐
│  classroom/[id].tsx（协调+UI 全在页面组件内）      │
│  创建 PlaybackEngine，直接用 useState 管理所有状态 │
├─────────────────────────────────────────────────┤
│  PlaybackEngine（调度+执行 合一）                  │
│  状态机 idle→playing→paused（无 live）             │
│  processSceneActions() 内联执行逻辑               │
│  无独立 ActionEngine                             │
└─────────────────────────────────────────────────┘
```

**核心差异**：Web端 ActionEngine 与 PlaybackEngine 分离，ActionEngine 只负责执行单个 Action 的副作用，PlaybackEngine 负责调度顺序和状态机。移动端将执行逻辑内联到 PlaybackEngine 中，没有独立 ActionEngine。

---

## 二、Action 类型体系对比

### Web端 (`lib/types/action.ts`)

| 类型 | 分类 | 说明 |
|------|------|------|
| `spotlight` | Fire-and-forget | 聚焦元素，其余暗化 |
| `laser` | Fire-and-forget | 激光笔指向 |
| `speech` | Synchronous | 语音讲解，等待TTS完成 |
| `play_video` | Synchronous | 播放视频元素 |
| `wb_open` | Synchronous | 打开白板 |
| `wb_draw_text` | Synchronous | 白板绘制文本 |
| `wb_draw_shape` | Synchronous | 白板绘制图形 |
| `wb_draw_chart` | Synchronous | 白板绘制图表 |
| `wb_draw_latex` | Synchronous | 白板绘制LaTeX公式 |
| `wb_draw_table` | Synchronous | 白板绘制表格 |
| `wb_draw_line` | Synchronous | 白板绘制线条/箭头 |
| `wb_draw_code` | Synchronous | 白板绘制代码块 |
| `wb_edit_code` | Synchronous | 白板编辑代码块 |
| `wb_clear` | Synchronous | 清除白板 |
| `wb_delete` | Synchronous | 删除白板元素 |
| `wb_close` | Synchronous | 关闭白板 |
| `discussion` | External | 触发讨论（外部管理生命周期） |
| `widget_highlight` | Synchronous | Widget元素高亮 |
| `widget_setState` | Synchronous | Widget状态设置 |
| `widget_annotation` | Synchronous | Widget标注 |
| `widget_reveal` | Synchronous | Widget揭示 |

**Action 结构**：Flat object，属性直接展开
```typescript
{ id: 'xxx', type: 'speech', text: '讲解内容', audioUrl: '...' }
{ id: 'xxx', type: 'wb_draw_text', elementId: 'el1', content: '...', x: 100, y: 200 }
```

### 移动端 (`packages/mobile/lib/types/scene.ts`)

| 类型 | 分类 | 说明 | 与Web端差异 |
|------|------|------|------------|
| `speech` | Synchronous | 语音讲解 | ✅ 对齐 |
| `spotlight` | Fire-and-forget | 聚焦 | ✅ 对齐 |
| `laser` | Fire-and-forget | 激光笔 | ✅ 对齐 |
| `highlight` | Fire-and-forget | 高亮 | ❌ Web端无此类型 |
| `gesture` | — | 手势 | ❌ Web端无此类型，移动端为空实现 |
| `wb_draw_text` | Synchronous | 白板文本 | ✅ 对齐 |
| `wb_draw_shape` | Synchronous | 白板图形 | ✅ 对齐 |
| `wb_open` | Synchronous | 打开白板 | ✅ 对齐 |
| `wb_clear` | Synchronous | 清除白板 | ✅ 对齐 |
| `wb_close` | Synchronous | 关闭白板 | ✅ 对齐 |

**缺失的 Action 类型**（Web端有，移动端无）：
- `play_video` — 视频播放
- `wb_draw_chart` — 图表绘制
- `wb_draw_latex` — LaTeX公式
- `wb_draw_table` — 表格绘制
- `wb_draw_line` — 线条/箭头
- `wb_draw_code` / `wb_edit_code` — 代码块
- `wb_delete` — 删除白板元素
- `discussion` — 讨论触发（移动端在页面组件内手动处理）
- `widget_*` — 全部4种Widget交互

**Action 结构**：`{id, type, data}` 分离式
```typescript
{ id: 'xxx', type: 'speech', data: { text: '讲解内容', audio_id: '...' } }
{ id: 'xxx', type: 'wb_draw_text', data: { text: '...', left: 100, top: 200 } }
```

> ⚠️ **结构不兼容**：Web端 flat object vs 移动端 `{id, type, data}` 分离。后端API返回的是Web端 flat 格式，移动端需要做适配转换。

---

## 三、Web端 Action 处理完整流程

### 3.1 生成阶段

**代码引用**：
- `lib/generation/scene-generator.ts` — `generateSceneActions()` 函数
- `lib/generation/action-parser.ts` — `parseActionsFromStructuredOutput()` 函数
- `app/api/generate/scene-actions/route.ts` — API路由

**流程**：

```
用户需求 → generateOutlines() → 每个outline → generateSceneActions()
                                                    ↓
                                          LLM 输出结构化 JSON Array
                                                    ↓
                              parseActionsFromStructuredOutput()
                                                    ↓
                              1. 去除 markdown code fences
                              2. 提取 JSON array 区段
                              3. 三级容错: JSON.parse → jsonrepair → partial-json
                              4. 逐项转换: type:text → SpeechAction
                                          type:action → 按 name 映射具体类型
                              5. 后处理: discussion必须最后
                                         非slide场景过滤slide-only action
                                         allowedActions白名单过滤
                                                    ↓
                                          Action[] → buildCompleteScene()
```

**在线流式路径**（`lib/orchestration/stateless-generate.ts`）：
- SSE 流式输出，增量解析 JSON Array
- `partial-json` 处理不完整 JSON
- 逐项 emit：`type:text` → 语音流，`type:action` → 视觉效果
- Action 和 text 可自由交错

### 3.2 执行阶段 — ActionEngine

**代码引用**：`lib/action/engine.ts` — `ActionEngine` 类

```typescript
class ActionEngine {
  constructor(stageStore, audioPlayer, widgetMessageCallback)
  
  async execute(action: Action): Promise<void> {
    // 白板操作前自动 ensureWhiteboardOpen()
    switch (action.type) {
      case 'spotlight':  → CanvasStore.setSpotlight() + scheduleEffectClear()
      case 'laser':      → CanvasStore.setLaser() + scheduleEffectClear()
      case 'speech':     → audioPlayer.play() + await onEnded
      case 'play_video': → resolveMediaPlaceholderId() + CanvasStore.playVideo() + await completion
      case 'wb_open':    → StageAPI.whiteboard.get() + CanvasStore.setWhiteboardOpen(true) + await delay(2000)
      case 'wb_draw_text':   → StageAPI.whiteboard.addElement() + await delay(800)
      case 'wb_draw_shape':  → StageAPI.whiteboard.addElement() + await delay(800)
      case 'wb_draw_chart':  → StageAPI.whiteboard.addElement() + await delay(800)
      case 'wb_draw_latex':  → katex.renderToString() + addElement() + await delay(800)
      case 'wb_draw_table':  → build TableCell[][] + addElement() + await delay(800)
      case 'wb_draw_line':   → calc bounding box + addElement() + await delay(800)
      case 'wb_draw_code':   → codeToLines() + addElement() + await delay(animMs)
      case 'wb_edit_code':   → find element + apply operation + updateElement() + await delay(600)
      case 'wb_clear':       → pushSnapshot() + setWhiteboardClearing(true) + await animMs + update({elements:[]})
      case 'wb_delete':      → deleteElement() + await delay(300)
      case 'wb_close':       → setWhiteboardOpen(false) + await delay(700)
      case 'discussion':     → 不执行，外部管理
      case 'widget_*':       → sendWidgetMessage() + await delay(300)
    }
  }
}
```

**关键设计**：
- Fire-and-forget（spotlight/laser）立即返回，5秒自动清除
- Synchronous（speech/wb_*）返回 Promise，调用方 await
- 白板操作前自动 `ensureWhiteboardOpen()`
- 每个白板操作后有动画延时等待（800ms/600ms/300ms等）
- Discussion 不在引擎内执行，由 PlaybackEngine 回调触发

### 3.3 调度阶段 — PlaybackEngine

**代码引用**：`lib/playback/engine.ts` — `PlaybackEngine` 类

**状态机**：
```
idle ──start()──→ playing ──pause()──→ paused
 ▲                   ▲                   │
 │                   │ resume()          │
 │                   └───────────────────┘
 │
 │ handleEndDiscussion()
 │                   confirmDiscussion()
 │                   / handleUserInterrupt()
 │                        │
 │                        ▼       pause()
 └─────────────────── live ──────────→ paused
                         ▲               │
                         │ resume/user   │
                         └───────────────┘
```

**核心调度逻辑**（`processNext()` 方法）：
1. 取当前 Action
2. 如果是 `discussion` 类型：
   - 首次遇到：触发 `onProactiveShow` → 等待用户确认 → `onDiscussionConfirmed`
   - 用户确认后：切换到 `live` 模式，SSE 对话流驱动
   - 对话结束：`onDiscussionEnd` → 回到 `idle`/`playing`
3. 如果是 `speech` 类型：
   - 有预生成音频：`audioPlayer.play()` + `onSpeechStart(text)` + await `onEnded`
   - 无音频+TTS开启：Browser TTS 或云端 TTS
   - 无音频+TTS关闭：计算阅读时间（中文30字/秒，英文12词/秒），setTimeout
4. 如果是 spotlight/laser：`actionEngine.execute()` → `onEffectFire(effect)`
5. 其他同步Action：`await actionEngine.execute(action)`
6. Action 完成 → `actionIndex++` → `processNext()` 递归

### 3.4 协调层 — Stage.tsx

**代码引用**：`components/stage.tsx` — `Stage` 组件

**Action 集成方式**（`useEffect([currentScene])` 内）：

```typescript
// 1. 创建 ActionEngine
const actionEngine = new ActionEngine(useStageStore, audioPlayerRef.current, widgetSendMessage);

// 2. 创建 PlaybackEngine，传入回调
const engine = new PlaybackEngine([currentScene], actionEngine, audioPlayerRef.current, {
  onSpeechStart: (text) => {
    setLectureSpeech(text);
    chatAreaRef.current?.addLectureMessage(sessionId, {type:'speech', text}, idx);
  },
  onSpeechEnd: () => setActiveBubbleId(null),
  onEffectFire: (effect) => {
    if (effect.kind === 'spotlight' || effect.kind === 'laser') {
      chatAreaRef.current?.addLectureMessage(sessionId, {type: effect.kind, elementId}, idx);
    }
  },
  onProactiveShow: (trigger) => setDiscussionTrigger(trigger),
  onDiscussionConfirmed: (topic, prompt, agentId) => handleDiscussionSSE(topic, prompt, agentId),
  onDiscussionEnd: () => { /* 清理讨论状态 */ },
  onUserInterrupt: (text) => chatAreaRef.current?.sendMessage(text),
  onComplete: () => { /* 标记完成，自动播放下一场景 */ },
});
```

**关键桥接**：
- `PlaybackEngine` 回调 → 更新 React 状态（`lectureSpeech`, `engineMode`, `discussionTrigger`）
- `ChatArea` 负责流式对话（SSE），通过 `onLiveSpeech/onThinking/onCueUser` 回调驱动 Roundtable UI
- `CanvasArea` 渲染课件 + spotlight/laser overlay + 白板 overlay
- `Roundtable` 展示参与者、语音气泡、讨论控制

---

## 四、移动端 Action 处理流程

### 4.1 PlaybackEngine（调度+执行合一）

**代码引用**：`packages/mobile/lib/playback/engine.ts`

**状态机**：仅 `idle → playing → paused`（无 `live` 模式）

**核心执行逻辑**（`processSceneActions()` 方法）：

```typescript
for (const action of actions) {
  if (action.type === 'spotlight') {
    this.executeSpotlight(action);        // 非阻塞
  } else if (action.type === 'laser') {
    this.executeLaser(action);            // 非阻塞
  } else if (action.type === 'wb_draw_text' || action.type === 'wb_draw_shape') {
    this.executeWhiteboard(action);       // 非阻塞，触发回调
  } else if (action.type === 'wb_open') {
    this.callbacks.onWhiteboardOpen?.();
  } else if (action.type === 'wb_clear' || action.type === 'wb_close') {
    this.callbacks.onClearEffects?.();
  } else if (action.type === 'speech') {
    await this.executeSpeech(action);     // 阻塞，等待TTS完成
  }
  // 其他action类型暂不处理
}
```

**TTS 执行逻辑**（`speakText()` 方法）：
1. 检查内存缓存（`audioCache` Map）
2. 请求 TTS API（`apiClient.generateTTS()`）
3. 缓存音频数据（Native: `saveAudioFile()` 保存到文件系统）
4. 播放音频（`audioPlayer.play()`）
5. Fallback: `expo-speech` 本地语音合成

### 4.2 协调层 — classroom/[id].tsx

**代码引用**：`packages/mobile/app/classroom/[id].tsx`

**Action 集成方式**：

```typescript
// 初始化 PlaybackEngine（在 initPlaybackEngine 回调中）
playbackEngineRef.current = new PlaybackEngine(data.scenes, {
  onSceneChange: (index) => setCurrentSceneIndex(index),
  onSpotlight: (elementId) => setSpotlightElementId(elementId),
  onLaser: (elementId, color) => { setLaserElementId(elementId); setLaserOptions({color}); },
  onClearEffects: () => { setSpotlightElementId(null); setLaserElementId(null); },
  onWhiteboardAction: (action) => console.log('[Whiteboard] Action:', action.type),
  onWhiteboardOpen: () => setShowWhiteboard(true),
}, ttsConfig);
```

**SSE 讨论/聊天处理**（在页面组件内，非 PlaybackEngine）：
- 单Agent聊天：`apiClient.streamAgentChat()` + SSE 解析
- 多Agent讨论：同上，`sessionType: 'discussion'`
- SSE 事件流：`agent_start` → `text_delta` → `action` → `agent_end`
- Action 处理：在 SSE `action` 事件中内联处理 `wb_open/wb_draw_text/wb_draw_table/wb_draw_code/spotlight/laser`

### 4.3 视觉效果组件

| 组件 | 代码引用 | 实现方式 | 与Web端差异 |
|------|---------|---------|------------|
| SpotlightOverlay | `components/slide/SpotlightOverlay.tsx` | 4个dimming View围出cutout + Reanimated动画 | Web端用SVG mask，移动端用4层View |
| LaserOverlay | `components/slide/LaserOverlay.tsx` | 飞入动画+脉冲环+核心点，Reanimated | 实现方式不同但效果对齐 |
| PointerOverlay | `components/playback/PointerOverlay.tsx` | 手动触摸控制激光笔/聚光灯 | Web端无此组件（Web用Action驱动） |
| WhiteboardOverlay | `components/classroom/WhiteboardOverlay.tsx` | Modal/Absolute模式，支持wb_draw_text/wb_draw_shape | Web端用StageAPI操作白板store |
| Whiteboard | `components/playback/whiteboard.tsx` | PanResponder手势绘制 | Web端白板是完整编辑器，移动端是简化画板 |

---

## 五、差异分析与优化建议

### 5.1 架构层差异

| 维度 | Web端 | 移动端 | 优化建议 |
|------|-------|--------|---------|
| ActionEngine | 独立类，职责单一 | 无，逻辑内联到PlaybackEngine | **新建移动端 ActionEngine**，从PlaybackEngine中提取执行逻辑 |
| PlaybackEngine | 纯调度，不执行 | 调度+执行合一 | 分离关注点，PlaybackEngine只负责调度顺序和状态机 |
| 状态机 | 4态(idle/playing/paused/live) | 3态(idle/playing/paused) | **增加 `live` 状态**，统一讨论生命周期管理 |
| Action类型 | 21种 | 10种 | 见5.2节逐步补齐 |
| Action结构 | Flat object | `{id, type, data}` 分离 | **统一为 flat object**，与后端API对齐 |
| Discussion处理 | PlaybackEngine回调→ChatArea SSE | 页面组件内手动SSE | 封装为独立模块 |
| Widget交互 | 4种widget_* action | 无 | P1优先级，interactive场景需要 |

### 5.2 缺失 Action 类型移植优先级

#### P0 — 核心教学体验

| Action | Web端代码 | 移动端移植方案 |
|--------|----------|--------------|
| `discussion` | PlaybackEngine `onProactiveShow/onDiscussionConfirmed/onDiscussionEnd` | PlaybackEngine 增加 `live` 状态 + 讨论触发回调；页面组件监听回调启动SSE讨论 |
| `wb_draw_chart` | `ActionEngine.executeWbDrawChart()` → `StageAPI.whiteboard.addElement({type:'chart'})` | WhiteboardOverlay 增加 chart 渲染：用 `react-native-svg` + 简化版 ECharts 或静态图表 |
| `wb_draw_table` | `ActionEngine.executeWbDrawTable()` → build TableCell[][] | WhiteboardOverlay 增加 table 渲染：用 FlatList 或 ScrollView + 网格布局 |
| `wb_draw_latex` | `ActionEngine.executeWbDrawLatex()` → `katex.renderToString()` | WhiteboardOverlay 增加 latex 渲染：用 `react-native-math-view` 或 WebView + KaTeX |

#### P1 — 增强教学效果

| Action | Web端代码 | 移动端移植方案 |
|--------|----------|--------------|
| `wb_draw_line` | `ActionEngine.executeWbDrawLine()` → calc bbox + addElement | WhiteboardOverlay 增加 line/arrow 渲染：`react-native-svg` Line + 可选箭头marker |
| `wb_draw_code` | `ActionEngine.executeWbDrawCode()` → codeToLines() + addElement | WhiteboardOverlay 增加 code block 渲染：语法高亮用 `react-native-syntax-highlighter` |
| `wb_edit_code` | `ActionEngine.executeWbEditCode()` → find+apply operation | 低优先级，移动端白板编辑代码块场景少 |
| `wb_delete` | `ActionEngine.executeWbDelete()` → deleteElement() | WhiteboardOverlay 维护 elements 数组，按 elementId 过滤 |
| `play_video` | `ActionEngine.executePlayVideo()` → resolveMedia + CanvasStore.playVideo() | VideoElement 组件已存在，需要 PlaybackEngine 集成 await 播放完成 |

#### P2 — 交互场景

| Action | Web端代码 | 移动端移植方案 |
|--------|----------|--------------|
| `widget_highlight` | `ActionEngine.executeWidgetHighlight()` → postMessage | Interactive场景 WebView postMessage |
| `widget_setState` | `ActionEngine.executeWidgetSetState()` → postMessage | 同上 |
| `widget_annotation` | `ActionEngine.executeWidgetAnnotation()` → postMessage | 同上 |
| `widget_reveal` | `ActionEngine.executeWidgetReveal()` → postMessage | 同上 |

### 5.3 Action 结构统一

**问题**：后端API返回Web端 flat 格式，移动端用 `{id, type, data}` 格式，需要适配转换。

**当前转换位置**：`classroom/[id].tsx` 中 SSE `action` 事件处理，手动从 `params` 提取字段。

**优化方案**：在 `lib/types/scene.ts` 中增加适配函数：

```typescript
// 将后端 flat Action 转为移动端 SceneAction
function adaptAction(flatAction: Record<string, unknown>): SceneAction {
  const { id, type, ...rest } = flatAction;
  return { id: id as string, type: type as ActionType, data: extractActionData(type, rest) };
}

// 将移动端 SceneAction 转为 flat Action（与Web端对齐）
function flattenAction(action: SceneAction): Record<string, unknown> {
  return { id: action.id, type: action.type, ...action.data };
}
```

### 5.4 PlaybackEngine 状态机扩展

**当前移动端**：`idle → playing → paused`

**目标**：`idle → playing → paused → live`（与Web端对齐）

**需要增加的能力**：

| 能力 | Web端实现 | 移动端移植 |
|------|----------|-----------|
| `live` 模式 | Discussion 确认后切换 | PlaybackEngine 增加 `live` 状态 + `confirmDiscussion()/handleEndDiscussion()` |
| ProactiveCard | `onProactiveShow` 回调触发讨论提示 | 回调触发移动端讨论提示 UI |
| 用户中断 | `onUserInterrupt(text)` → ChatArea.sendMessage | 回调触发聊天输入 |
| 讨论暂停/恢复 | buffer-level pause + TTS pause | 移动端已有部分实现（`isDiscussionPaused`） |
| 场景切换 epoch | `sceneEpochRef` 防止 stale SSE | 移动端需要类似机制 |

---

## 六、移植实施路线

### Phase 1：ActionEngine 抽取 + Action 结构统一

1. **新建 `packages/mobile/lib/action/engine.ts`**
   - 从 PlaybackEngine 中提取 `executeSpotlight/executeLaser/executeSpeech/executeWhiteboard` 为独立 ActionEngine
   - PlaybackEngine 改为调用 `actionEngine.execute(action)`
   - 参考 Web端 `lib/action/engine.ts` 的接口设计

2. **统一 Action 结构为 flat object**
   - 修改 `packages/mobile/lib/types/scene.ts`，Action 类型改为 flat 结构
   - 增加 `adaptAction()` / `flattenAction()` 转换函数
   - 更新所有消费 Action 的组件

3. **补齐 Action 类型定义**
   - 增加 `wb_draw_chart/wb_draw_table/wb_draw_latex/wb_draw_line/wb_draw_code/wb_edit_code/wb_delete/play_video/discussion/widget_*`
   - 先定义类型，实现可逐步跟进

### Phase 2：PlaybackEngine 状态机扩展

1. **增加 `live` 模式**
   - `EngineMode = 'idle' | 'playing' | 'paused' | 'live'`
   - 增加 `confirmDiscussion()/skipDiscussion()/handleEndDiscussion()/handleUserInterrupt()`

2. **Discussion 生命周期管理**
   - PlaybackEngine 遇到 `discussion` Action 时触发 `onProactiveShow` 回调
   - 用户确认后 `confirmDiscussion()` → `live` 模式
   - SSE 讨论流结束后 `handleEndDiscussion()` → `idle`

3. **场景切换 epoch 机制**
   - 防止 stale SSE 回调污染新场景状态

### Phase 3：白板 Action 补齐

1. **WhiteboardOverlay 增强**
   - 支持 `wb_draw_chart`：引入轻量图表库或 WebView + ECharts
   - 支持 `wb_draw_table`：网格布局渲染
   - 支持 `wb_draw_latex`：`react-native-math-view` 或 WebView + KaTeX
   - 支持 `wb_draw_line`：`react-native-svg` Line
   - 支持 `wb_draw_code`：语法高亮组件
   - 支持 `wb_delete`：按 elementId 过滤元素

2. **ActionEngine 白板方法对齐**
   - 每个白板操作后有动画延时等待（与Web端 800ms/600ms/300ms 对齐）
   - `wb_open` 前自动 `ensureWhiteboardOpen()`

### Phase 4：Widget + Video + 交互增强

1. **Widget Action 支持**
   - Interactive 场景的 WebView 增加 postMessage 通信
   - ActionEngine 增加 `executeWidgetHighlight/SetState/Annotation/Reveal`

2. **play_video Action**
   - ActionEngine 增加 `executePlayVideo()`
   - VideoElement 播放完成后 resolve Promise

3. **在线流式 Action 解析**
   - 移动端 SSE `action` 事件处理从页面组件提取到 ActionEngine
   - 参考 Web端 `stateless-generate.ts` 的增量解析逻辑

---

## 七、代码引用索引

### Web端

| 文件 | 关键内容 |
|------|---------|
| `lib/types/action.ts` | Action 类型定义（21种），FIRE_AND_FORGET/SYNC/SLIDE_ONLY 常量 |
| `lib/action/engine.ts` | ActionEngine 类，execute() 统一入口，所有Action执行逻辑 |
| `lib/playback/engine.ts` | PlaybackEngine 类，4态状态机，processNext() 调度逻辑 |
| `lib/playback/types.ts` | EngineMode, Effect, TriggerEvent, PlaybackEngineCallbacks |
| `lib/playback/derived-state.ts` | computePlaybackView() 派生状态计算 |
| `lib/generation/action-parser.ts` | parseActionsFromStructuredOutput() 三级容错解析 |
| `lib/generation/scene-generator.ts` | generateSceneActions() Action生成 |
| `lib/orchestration/stateless-generate.ts` | SSE流式增量解析，structured output parser |
| `app/api/generate/scene-actions/route.ts` | Action生成API路由 |
| `components/stage.tsx` | Stage组件，ActionEngine+PlaybackEngine创建，回调桥接 |
| `components/canvas/canvas-area.tsx` | CanvasArea，课件渲染+效果overlay |
| `components/roundtable/index.tsx` | Roundtable，讨论UI |
| `components/chat/chat-area.tsx` | ChatArea，SSE流式对话 |
| `components/chat/use-chat-sessions.ts` | 聊天会话管理 |
| `lib/store/canvas.ts` | CanvasStore，spotlight/laser/whiteboard状态 |

### 移动端

| 文件 | 关键内容 |
|------|---------|
| `packages/mobile/lib/types/scene.ts` | SceneAction 类型定义（10种），{id,type,data} 结构 |
| `packages/mobile/lib/playback/engine.ts` | PlaybackEngine 类，3态状态机，调度+执行合一 |
| `packages/mobile/lib/playback/audio-player.ts` | AudioPlayer，expo-av 封装 |
| `packages/mobile/app/classroom/[id].tsx` | 课堂页面，所有Action集成和UI逻辑 |
| `packages/mobile/components/slide/SpotlightOverlay.tsx` | Spotlight效果，4层dimming View |
| `packages/mobile/components/slide/LaserOverlay.tsx` | Laser效果，飞入+脉冲动画 |
| `packages/mobile/components/playback/PointerOverlay.tsx` | 手动触摸指针控制 |
| `packages/mobile/components/classroom/WhiteboardOverlay.tsx` | 白板覆盖层，wb_draw_text/wb_draw_shape |
| `packages/mobile/components/playback/whiteboard.tsx` | 白板画板，PanResponder手势绘制 |
| `packages/mobile/components/playback/Quiz.tsx` | 测验组件 |
| `packages/mobile/lib/utils/sse-parser.ts` | SSE内容解析器 |
| `packages/mobile/lib/api-client/index.ts` | API客户端，streamAgentChat/generateTTS |