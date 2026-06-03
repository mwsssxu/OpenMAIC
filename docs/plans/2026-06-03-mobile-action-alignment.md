# 移动端 Action 功能对齐 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 将移动端 PlaybackEngine 的 Action 支持从当前 6 种对齐到 Web 端 21 种，同时充分考虑移动端屏幕尺寸、触控交互、性能等特性。

**Architecture:** 在现有 PlaybackEngine 基础上扩展 Action 分发，引入 ActionEngine 执行层（与 Web 端对齐但适配移动端），新增对应的回调接口和 UI 组件。类型系统从 snake_case 的 data 映射升级为与 Web 端一致的 flat 接口。优先实现高价值、低风险的 Action，延迟实现需要新 UI 框架的复杂 Action。

**Tech Stack:** Expo SDK / React Native / TypeScript / expo-av / react-native-gesture-handler / react-native-reanimated

---

## 当前状态 vs 目标状态

| Action 类型 | Web | Mobile 当前 | 移动端适配策略 |
|---|---|---|---|
| `speech` | ✅ | ✅ | 已实现，保持不变 |
| `spotlight` | ✅ | ✅ | 已实现，保持不变 |
| `laser` | ✅ | ✅ | 已实现，保持不变 |
| `wb_open` | ✅ | ✅ | 已实现，保持不变 |
| `wb_draw_text` | ✅ | ✅ | 已实现，保持不变 |
| `wb_draw_shape` | ✅ | ✅ | 已实现，保持不变 |
| `wb_clear` | ✅ | ✅ | 已实现，保持不变 |
| `wb_close` | ✅ | ✅ | 已实现，保持不变 |
| `wb_draw_chart` | ✅ | ❌ | **P1** — 渲染组件已存在(ChartElement)，只需接入 engine |
| `wb_draw_latex` | ✅ | ❌ | **P1** — 渲染组件已存在(LatexElement)，只需接入 engine |
| `wb_draw_table` | ✅ | ❌ | **P1** — 渲染组件已存在(TableElement)，只需接入 engine |
| `wb_draw_code` | ✅ | ❌ | **P1** — 渲染组件已存在(CodeElement)，只需接入 engine |
| `wb_draw_line` | ✅ | ❌ | **P1** — 渲染组件已存在(LineElement)，只需接入 engine |
| `wb_edit_code` | ✅ | ❌ | **P2** — 移动端场景少见，低优先级 |
| `wb_delete` | ✅ | ❌ | **P1** — 元素级删除，白板操作闭环必需 |
| `discussion` | ✅ | ❌(engine内) | **P2** — 当前独立Modal实现，engine内对齐需设计 |
| `play_video` | ✅ | ❌ | **P2** — VideoElement已存在，但移动端视频播放需特殊处理 |
| `widget_highlight` | ✅ | ❌ | **P3** — 需iframe通信，移动端WebView限制多 |
| `widget_setState` | ✅ | ❌ | **P3** — 同上 |
| `widget_annotation` | ✅ | ❌ | **P3** — 同上 |
| `widget_reveal` | ✅ | ❌ | **P3** — 同上 |

---

## 移动端适配原则

### 1. 屏幕与布局
- 白板元素使用 **百分比坐标** (0-1000)，与 Web 端一致，渲染时按屏幕宽度缩放
- 小屏设备（< 375pt）自动降级：chart 用简化版，table 允许横滑，code 默认折叠
- 白板 overlay 占屏幕 **全宽 85%**（Web 端侧边栏在移动端不可用）

### 2. 触控交互
- 白板内操作 **不加动画延迟**（Web 端 800ms fade-in 在移动端感觉迟钝，改为 200ms）
- `wb_open` 动画用 spring（stiffness 200, damping 20），比 Web 端快（2s → 0.6s）
- spotlight/laser 效果通过 **触觉反馈**（expo-haptics）增强感知

### 3. 性能
- 白板元素数量 > 20 时，使用 **虚拟化渲染**（仅渲染可见区域）
- chart 渲染优先用纯 RN 组件，避免 WebView 开销
- LaTeX 渲染用 Unicode 近似（已有 simplifyLatex），不引入 katex 的 JS bundle（~200KB）

### 4. 不做的事情（YAGNI）
- ❌ Widget iframe 交互（P3）— 移动端 WebView 限制太多，且 interactive 场景占比低
- ❌ `wb_edit_code` 的行级操作 — 移动端无键盘快捷键，行级编辑体验差
- ❌ live 模式（discussion 侵入播放状态机）— 保持当前 Modal 方案，更符合移动端心智模型
- ❌ 阅读计时器（Web 端兜底）— 移动端 TTS 可靠性高（expo-speech 原生），不需要

---

## Phase 1: 类型系统与 Engine 基础重构

### Task 1: 扩展 ActionType 和 ActionDataMap

**Objective:** 在 `lib/types/scene.ts` 中添加缺失的 Action 类型定义

**Files:**
- Modify: `packages/mobile/lib/types/scene.ts:22-78`

**Step 1: 扩展 ActionType union**

```typescript
// 当前：
export type ActionType = 'speech' | 'spotlight' | 'laser' | 'highlight' | 'gesture' | 'wb_draw_text' | 'wb_draw_shape' | 'wb_open' | 'wb_clear' | 'wb_close';

// 目标：
export type ActionType =
  | 'speech' | 'spotlight' | 'laser'
  | 'wb_open' | 'wb_draw_text' | 'wb_draw_shape' | 'wb_draw_chart'
  | 'wb_draw_latex' | 'wb_draw_table' | 'wb_draw_line' | 'wb_draw_code'
  | 'wb_clear' | 'wb_delete' | 'wb_close'
  | 'discussion' | 'play_video';
  // 注意：移除 'highlight' | 'gesture'（从未使用），
  // 不添加 widget_*（P3 延迟）和 wb_edit_code（P2 延迟）
```

**Step 2: 添加新 ActionData 接口**

```typescript
export interface WbDrawChartActionData {
  chartType: 'bar' | 'column' | 'line' | 'pie' | 'ring' | 'area' | 'radar' | 'scatter';
  x: number; y: number; width: number; height: number;
  data: { labels: string[]; legends: string[]; series: number[][] };
  themeColors?: string[];
}

export interface WbDrawLatexActionData {
  latex: string;
  x: number; y: number; width?: number; height?: number;
  color?: string;
}

export interface WbDrawTableActionData {
  x: number; y: number; width: number; height: number;
  data: string[][];
  outline?: { width: number; style: string; color: string };
  theme?: { color: string };
}

export interface WbDrawLineActionData {
  startX: number; startY: number; endX: number; endY: number;
  color?: string; width?: number; style?: 'solid' | 'dashed';
  points?: string[];
}

export interface WbDrawCodeActionData {
  language: string; code: string;
  x: number; y: number; width?: number; height?: number;
  fileName?: string;
}

export interface WbDeleteActionData {
  elementId: string;
}

export interface DiscussionActionData {
  topic: string;
  prompt?: string;
  agentId?: string;
}

export interface PlayVideoActionData {
  elementId: string;
}
```

**Step 3: 扩展 ActionDataMap**

```typescript
export interface ActionDataMap {
  speech: SpeechActionData;
  spotlight: SpotlightActionData;
  laser: LaserActionData;
  wb_draw_text: WbDrawTextActionData;
  wb_draw_shape: WbDrawShapeActionData;
  wb_draw_chart: WbDrawChartActionData;
  wb_draw_latex: WbDrawLatexActionData;
  wb_draw_table: WbDrawTableActionData;
  wb_draw_line: WbDrawLineActionData;
  wb_draw_code: WbDrawCodeActionData;
  wb_open: Record<string, never>;
  wb_clear: Record<string, never>;
  wb_delete: WbDeleteActionData;
  wb_close: Record<string, never>;
  discussion: DiscussionActionData;
  play_video: PlayVideoActionData;
}
```

**Verification:** `npx tsc --noEmit` 在 packages/mobile 下通过

---

### Task 2: 扩展 PlaybackEngineCallbacks

**Objective:** 为新 Action 类型添加回调接口

**Files:**
- Modify: `packages/mobile/lib/playback/engine.ts:50-65`

**Step 1: 扩展回调类型**

在现有 `PlaybackEngineCallbacks` 中添加：

```typescript
export type PlaybackEngineCallbacks = {
  onSceneChange?: (index: number, scene: Scene | null) => void;
  onActionExecute?: (action: SceneAction) => void;
  onComplete?: () => void;
  onModeChange?: (mode: EngineMode) => void;
  onError?: (error: Error) => void;
  onTTSGenerate?: (audioId: string) => void;
  onTTSReady?: (audioId: string) => void;
  // Visual effects
  onSpotlight?: (elementId: string, dimness?: number) => void;
  onLaser?: (elementId: string, color?: string) => void;
  onClearEffects?: () => void;
  // Whiteboard actions — 统一回调，由 WhiteboardOverlay 分发
  onWhiteboardAction?: (action: SceneAction) => void;
  onWhiteboardOpen?: () => void;
  // 新增：白板元素删除
  onWhiteboardDelete?: (elementId: string) => void;
  // 新增：讨论触发（不侵入状态机，走独立 Modal）
  onDiscussionTrigger?: (topic: string, prompt?: string, agentId?: string) => void;
  // 新增：视频播放
  onPlayVideo?: (elementId: string) => void;
};
```

**Verification:** `npx tsc --noEmit` 通过

---

### Task 3: 重构 processSceneActions 的 Action 分发

**Objective:** 将 if-else 链重构为 switch-case，并添加新 Action 的处理分支

**Files:**
- Modify: `packages/mobile/lib/playback/engine.ts:165-194` (processSceneActions)
- Modify: `packages/mobile/lib/playback/engine.ts:241-259` (playCurrentSceneAuto 中的重复分发)

**Step 1: 重构 processSceneActions**

```typescript
private async processSceneActions(scene: Scene): Promise<void> {
  const actions = scene.actions || [];

  if (actions.length === 0) {
    await this.speakSceneContent(scene);
    return;
  }

  this.clearEffects();

  for (const action of actions) {
    if (this.mode !== 'playing') return;

    this.callbacks.onActionExecute?.(action);

    switch (action.type) {
      // Fire-and-forget
      case 'spotlight':
        this.executeSpotlight(action);
        break;
      case 'laser':
        this.executeLaser(action);
        break;

      // Whiteboard — 同步阻塞（需等待渲染）
      case 'wb_open':
        this.callbacks.onWhiteboardOpen?.();
        break;
      case 'wb_draw_text':
      case 'wb_draw_shape':
      case 'wb_draw_chart':
      case 'wb_draw_latex':
      case 'wb_draw_table':
      case 'wb_draw_line':
      case 'wb_draw_code':
        this.executeWhiteboard(action);
        break;
      case 'wb_delete':
        this.executeWhiteboardDelete(action);
        break;
      case 'wb_clear':
      case 'wb_close':
        this.clearEffects();
        break;

      // Speech — 阻塞
      case 'speech':
        await this.executeSpeech(action as SceneAction<'speech'>);
        break;

      // Discussion — 不侵入状态机，触发独立 Modal
      case 'discussion':
        this.executeDiscussion(action);
        break;

      // Video
      case 'play_video':
        this.executePlayVideo(action);
        break;

      default:
        // 未知 action 静默跳过
        break;
    }
  }
}
```

**Step 2: 提取 auto-play 的分发为复用**

当前 `playCurrentSceneAuto` 中有重复的分发逻辑。提取为共享方法：

```typescript
/** 判断 action 是否为阻塞类型 */
private isBlockingAction(action: SceneAction): boolean {
  return action.type === 'speech' || action.type === 'discussion' || action.type === 'play_video';
}

/** auto-play 中 speech 后需要场景切换 */
private async handleAutoAdvance(): Promise<void> {
  this.clearAutoAdvanceTimer();
  this.autoAdvanceTimer = setTimeout(async () => {
    this.autoAdvanceTimer = null;
    if (this.mode === 'playing') {
      await this.nextScene();
      if (this.mode === 'playing') {
        await this.playCurrentSceneAuto();
      }
    }
  }, 500);
}
```

**Verification:** 手动测试已有功能不受影响（speech/spotlight/laser/wb_draw_text/wb_draw_shape）

---

## Phase 2: 白板高级元素 Action 实现

### Task 4: 实现 executeWhiteboard 对新 Action 类型的分发

**Objective:** 让 WhiteboardOverlay 能接收并渲染 chart/latex/table/line/code 元素

**Files:**
- Modify: `packages/mobile/lib/playback/engine.ts` — 添加 executeWhiteboard 中的 data 透传
- Modify: `packages/mobile/components/classroom/WhiteboardOverlay.tsx` — 添加新元素类型的渲染

**Step 1: engine.ts 中 executeWhiteboard 增强**

当前 `executeWhiteboard` 只是简单转发。无需修改引擎逻辑，因为 `onWhiteboardAction` 已经传递完整 action 对象。WhiteboardOverlay 根据新的 `action.type` 分支处理即可。

**Step 2: WhiteboardOverlay 中添加新元素渲染**

在 `WhiteboardOverlay` 的元素渲染逻辑中（当前只有 text 和 shape），添加：

```typescript
// 在 whiteboardStore 的 addElement 调用前，根据 action.type 构建元素
case 'wb_draw_chart': {
  const d = action.data as WbDrawChartActionData;
  whiteboardStore.addElement({
    id: action.id,
    type: 'chart',
    chartType: d.chartType,
    data: d.data,
    themeColors: d.themeColors,
    left: d.x, top: d.y, width: d.width, height: d.height,
  });
  break;
}
case 'wb_draw_latex': {
  const d = action.data as WbDrawLatexActionData;
  whiteboardStore.addElement({
    id: action.id,
    type: 'latex',
    latex: d.latex,
    color: d.color,
    left: d.x, top: d.y, width: d.width, height: d.height,
  });
  break;
}
case 'wb_draw_table': {
  const d = action.data as WbDrawTableActionData;
  whiteboardStore.addElement({
    id: action.id,
    type: 'table',
    data: d.data,
    outline: d.outline,
    theme: d.theme,
    left: d.x, top: d.y, width: d.width, height: d.height,
  });
  break;
}
case 'wb_draw_line': {
  const d = action.data as WbDrawLineActionData;
  whiteboardStore.addElement({
    id: action.id,
    type: 'line',
    startX: d.startX, startY: d.startY, endX: d.endX, endY: d.endY,
    color: d.color, width: d.width, style: d.style, points: d.points,
  });
  break;
}
case 'wb_draw_code': {
  const d = action.data as WbDrawCodeActionData;
  whiteboardStore.addElement({
    id: action.id,
    type: 'code',
    language: d.language, code: d.code,
    fileName: d.fileName,
    left: d.x, top: d.y, width: d.width, height: d.height,
  });
  break;
}
```

**Step 3: 白板渲染组件对接**

WhiteboardOverlay 的 `renderElement` 函数需要根据 `element.type` 使用已有的 slide 组件：

```typescript
// 在 WhiteboardOverlay 的 renderWhiteboardElement 中添加：
case 'chart':
  return <ChartElement element={el as PPTChartElement} theme={theme} scaleX={1} scaleY={1} isWhiteboard />;
case 'latex':
  return <LatexElement element={el as PPTLatexElement} theme={theme} scaleX={1} scaleY={1} isWhiteboard />;
case 'table':
  return <TableElement element={el as PPTTableElement} theme={theme} scaleX={1} scaleY={1} isWhiteboard />;
case 'line':
  return <LineElement element={el as PPTLineElement} theme={theme} scaleX={1} scaleY={1} isWhiteboard />;
case 'code':
  return <CodeElement element={el as PPTCodeElement} theme={theme} scaleX={1} scaleY={1} isWhiteboard />;
```

这些组件 **已经存在** 于 `packages/mobile/components/slide/` 中，且已支持 `isWhiteboard` prop，只需引入。

**Verification:** 用包含 chart/latex/table/line/code action 的测试场景，验证白板 overlay 正确渲染

---

### Task 5: 实现 wb_delete Action

**Objective:** 支持从白板中删除指定元素

**Files:**
- Modify: `packages/mobile/lib/playback/engine.ts` — 添加 executeWhiteboardDelete
- Modify: `packages/mobile/lib/whiteboard/element-store.ts` — 确认有 removeElement 方法
- Modify: `packages/mobile/components/classroom/WhiteboardOverlay.tsx` — 绑定删除回调

**Step 1: engine.ts 添加删除方法**

```typescript
private executeWhiteboardDelete(action: SceneAction<'wb_delete'>): void {
  const data = action.data as WbDeleteActionData;
  if (!data.elementId) return;
  this.callbacks.onWhiteboardDelete?.(data.elementId);
}
```

**Step 2: classroom/[id].tsx 中绑定 onWhiteboardDelete 回调**

```typescript
// 在 initPlaybackEngine 的 callbacks 中添加：
onWhiteboardDelete: (elementId: string) => {
  whiteboardStore.removeElement(elementId);
},
```

**Step 3: 验证 element-store 有 removeElement**

检查 `packages/mobile/lib/whiteboard/element-store.ts`，若无则添加：

```typescript
removeElement(id: string) {
  set((state) => ({
    elements: state.elements.filter((el) => el.id !== id),
  }));
}
```

**Verification:** 播放包含 `wb_draw_text` + `wb_delete` 的场景，验证元素先出现后消失

---

### Task 6: 白板动画延迟适配移动端

**Objective:** 将白板操作的渲染等待时间从 Web 端的 800ms 降为移动端的 200ms

**Files:**
- Modify: `packages/mobile/components/classroom/WhiteboardOverlay.tsx` — 元素添加后的等待逻辑

**Step 1: 添加移动端动画常量**

在 WhiteboardOverlay 顶部：

```typescript
// 移动端白板动画时长（ms）— 比 Web 端快以适配触控操作预期
const MOBILE_WB_ANIM_MS = 200;
const MOBILE_WB_CLEAR_ANIM_MS = 400;  // Web: 380+55n/1400, Mobile: 简化
const MOBILE_WB_OPEN_ANIM_MS = 600;   // Web: 2000 (spring), Mobile: 更快
const MOBILE_WB_CLOSE_ANIM_MS = 400;  // Web: 700
```

**Step 2: 在白板元素添加回调中加入延迟**

当前 WhiteboardOverlay 的 `onWhiteboardAction` 回调没有等待动画完成。需要在 `classroom/[id].tsx` 的回调中加入可配置的延迟：

```typescript
onWhiteboardAction: (action: SceneAction) => {
  // 白板元素添加 → 等待渲染动画
  whiteboardOverlayRef.current?.handleAction(action);
},
```

WhiteboardOverlay 的 `handleAction` 方法在添加元素后返回 Promise，engine 端 `await` 该 Promise。但由于当前 engine 的 `executeWhiteboard` 不是 async，需要改为：

```typescript
// engine.ts 中
case 'wb_draw_text':
case 'wb_draw_shape':
case 'wb_draw_chart':
case 'wb_draw_latex':
case 'wb_draw_table':
case 'wb_draw_line':
case 'wb_draw_code':
  await this.executeWhiteboard(action);  // 改为 await
  break;
```

```typescript
private async executeWhiteboard(action: SceneAction): Promise<void> {
  this.callbacks.onWhiteboardAction?.(action);
  this.callbacks.onWhiteboardOpen?.();
  // 移动端等待渲染动画完成
  await delay(MOBILE_WB_ANIM_MS);
}
```

**Verification:** 白板元素出现后，下一个 action 不会立即执行，而是有短暂等待

---

## Phase 3: Discussion 与 Video Action

### Task 7: 实现 discussion Action（不侵入状态机）

**Objective:** 当 engine 遇到 discussion action 时，触发独立 Modal 而非进入 live 模式

**Files:**
- Modify: `packages/mobile/lib/playback/engine.ts` — 添加 executeDiscussion
- Modify: `packages/mobile/app/classroom/[id].tsx` — 绑定 onDiscussionTrigger 回调

**设计决策：**
- Web 端 discussion 会将 engine 切入 `live` 模式，暂停 lecture 播放
- 移动端保持当前 `idle/playing/paused` 三态，discussion 触发后 engine 继续播放后续 action
- 讨论由 `classroom/[id].tsx` 中已有的 `startMultiAgentDiscussion` 处理
- 这是 **异步触发**：engine 不等待讨论完成，用户可以在播放途中随时打开讨论

**Step 1: engine.ts 添加 executeDiscussion**

```typescript
private executeDiscussion(action: SceneAction<'discussion'>): void {
  const data = action.data as DiscussionActionData;
  // 不暂停播放，异步通知 UI 层
  this.callbacks.onDiscussionTrigger?.(data.topic, data.prompt, data.agentId);
}
```

**Step 2: classroom/[id].tsx 绑定回调**

在 `initPlaybackEngine` 的 callbacks 中：

```typescript
onDiscussionTrigger: (topic, prompt, agentId) => {
  // 在播放控制栏显示讨论提示 Badge（非阻塞）
  setDiscussionHint({ topic, prompt, agentId });
  // 触觉反馈提示用户
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
},
```

UI 层在播放控制区域显示一个「💬 参与讨论」Badge，用户点击后打开现有的讨论 Modal。

**Verification:** 播放包含 discussion action 的场景时，底部出现讨论提示 Badge，点击打开讨论 Modal，播放不被中断

---

### Task 8: 实现 play_video Action

**Objective:** 支持在播放过程中自动播放幻灯片中的视频元素

**Files:**
- Modify: `packages/mobile/lib/playback/engine.ts` — 添加 executePlayVideo
- Modify: `packages/mobile/app/classroom/[id].tsx` — 绑定 onPlayVideo 回调

**Step 1: engine.ts 添加 executePlayVideo**

```typescript
private executePlayVideo(action: SceneAction<'play_video'>): void {
  const data = action.data as PlayVideoActionData;
  if (!data.elementId) return;
  this.callbacks.onPlayVideo?.(data.elementId);
}
```

**Step 2: classroom/[id].tsx 中处理视频播放**

```typescript
onPlayVideo: (elementId: string) => {
  // 查找当前场景中的视频元素并播放
  const scene = data?.scenes?.[currentSceneIndex];
  if (!scene || scene.type !== 'slide') return;
  const elements = (scene.content as SlideContent)?.canvas?.elements ?? [];
  const videoEl = elements.find((el: any) => el.id === elementId);
  if (videoEl) {
    setAutoPlayVideoElementId(elementId);
  }
},
```

**移动端特殊处理：**
- 视频播放使用全屏覆盖（而非 Web 端的内嵌），因为手机屏幕小
- 视频结束后自动关闭覆盖层
- `VideoElement` 组件已存在于 `packages/mobile/components/slide/VideoElement.tsx`

**Verification:** 播放包含 `play_video` action 的场景，视频自动播放，结束后返回幻灯片

---

## Phase 4: 清理与验证

### Task 9: 移除废弃的 Action 类型

**Objective:** 清理 `highlight` 和 `gesture` 这两个从未实现的 Action 类型

**Files:**
- Modify: `packages/mobile/lib/types/scene.ts` — 从 ActionType 和 ActionDataMap 中移除
- Search: 确认无其他文件引用这两个类型

**Step 1: 移除类型定义**

从 `ActionType` 中移除 `'highlight' | 'gesture'`，从 `ActionDataMap` 中移除对应条目。

**Step 2: 全局搜索确认无引用**

```bash
grep -r "highlight\|gesture" packages/mobile/lib/ packages/mobile/components/ packages/mobile/app/ --include='*.ts' --include='*.tsx'
```

清除所有残留引用。

**Verification:** `npx tsc --noEmit` 通过

---

### Task 10: 端到端集成测试

**Objective:** 用包含全部 Action 类型的测试场景验证功能完整性

**Files:**
- Create: `packages/mobile/__tests__/playback-engine-actions.test.ts`

**Step 1: 编写测试**

测试覆盖：
1. 全 Action 类型遍历，验证 engine 不 crash
2. 白板元素 chart/latex/table/line/code 的 callback 正确触发
3. wb_delete 后元素从 store 中消失
4. discussion 不阻塞后续 action
5. play_video 触发回调但不改变 engine mode

**Step 2: 用后端 API 创建包含多类型 action 的测试课程**

**Verification:** 所有测试通过

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| WhiteboardOverlay 808行大文件，改动可能引入回归 | 中 | 每个 Action 类型独立渲染，互不影响；增量提交 |
| ChartElement 在白板模式下布局异常 | 低 | isWhiteboard prop 已有，组件已处理此场景 |
| LaTeX Unicode 近似在复杂公式下不准确 | 低 | 已有 simplifyLatex，覆盖常见模式；极端场景降级显示原始 LaTeX |
| classroom/[id].tsx 3861行巨组件 | 高 | 回调绑定集中在一处（initPlaybackEngine），不新增独立逻辑 |
| 移动端内存压力（大量白板元素） | 中 | 元素 > 20 时触发虚拟化（Phase 5 可选优化） |

---

## 实施顺序与依赖关系

```
Task 1 (类型) ──→ Task 2 (回调) ──→ Task 3 (分发重构)
                                        │
                    ┌───────────────────┼──────────────────┐
                    ▼                   ▼                   ▼
              Task 4 (白板元素)   Task 5 (wb_delete)   Task 6 (动画)
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        ▼
                              Task 7 (discussion)
                              Task 8 (play_video)  ← 可并行
                                        │
                                        ▼
                              Task 9 (清理) → Task 10 (测试)
```

**预计工时：**
- Phase 1 (Task 1-3): 2h — 基础重构，无 UI 变化
- Phase 2 (Task 4-6): 4h — 白板元素对接，需 UI 调试
- Phase 3 (Task 7-8): 2h — 独立功能，可并行
- Phase 4 (Task 9-10): 1h — 清理验证

**总计约 9 小时**

---

_Last updated: 2026-06-03_
