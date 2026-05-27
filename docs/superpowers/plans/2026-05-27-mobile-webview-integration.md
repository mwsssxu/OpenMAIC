# 移动端 WebView 场景集成改进计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 InteractiveWebView 组件集成到课堂页面，渲染 interactive 和 pbl 场景的实际内容。

**Architecture:** 在 `[id].tsx` 中为 interactive/pbl 场景类型渲染 InteractiveWebView，加载场景的 `content.url` 或 `content.htmlContent`，完成场景时触发回调。

**Tech Stack:** React Native, TypeScript, InteractiveWebView 组件

---

## 背景

当前状态：
- InteractiveWebView 组件已完成实现
- 播放引擎已识别 `interactive` 和 `pbl` 场景类型，但只跳过不播放音频
- 课堂页面 (`[id].tsx`) 对这些场景只显示占位图标
- 需要渲染实际内容（如互动游戏、项目学习）

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/mobile/app/classroom/[id].tsx` | 修改 | 集成 InteractiveWebView 渲染 |
| `packages/mobile/lib/types/scene.ts` | 检查 | 确认 interactive/pbl 内容格式 |

---

### Task 1: 确认场景内容格式

**Files:**
- Check: `packages/mobile/lib/types/scene.ts`

- [ ] **Step 1: 检查 interactive/pbl 场景内容类型**

查看场景类型定义，确认 content 字段格式：

```typescript
// 预期格式
interface InteractiveContent {
  url?: string;        // 外部互动内容 URL
  htmlContent?: string; // 内嵌 HTML
  title?: string;
}

interface PblContent {
  url?: string;
  htmlContent?: string;
  title?: string;
  projectData?: any;  // 项目学习特有数据
}
```

- [ ] **Step 2: 验证后端 API 返回格式**

如果有测试数据，验证后端返回的 interactive/pbl 场景的 content 结构。

---

### Task 2: 在课堂页面集成 InteractiveWebView

**Files:**
- Modify: `packages/mobile/app/classroom/[id].tsx`

- [ ] **Step 1: 导入 InteractiveWebView 组件**

在文件顶部的导入区域添加：

```typescript
import { InteractiveWebView, InteractiveWebViewRef } from '@/components/playback/InteractiveWebView';
```

- [ ] **Step 2: 添加 interactiveWebViewRef**

在组件内部添加 ref：

```typescript
const interactiveWebViewRef = useRef<InteractiveWebViewRef>(null);
```

- [ ] **Step 3: 添加场景完成处理函数**

添加处理 interactive/pbl 场景完成的函数：

```typescript
// Interactive/PBL 场景完成回调
const handleInteractiveComplete = useCallback((data: any) => {
  console.log('[Interactive] Scene complete:', data);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  // 可选：记录完成状态，自动进入下一场景
}, []);

const handleInteractiveMessage = useCallback((data: any) => {
  console.log('[Interactive] Message:', data);
  // 处理 WebView 发送的消息
}, []);
```

- [ ] **Step 4: 在渲染逻辑中添加 InteractiveWebView**

找到渲染占位图标的位置（约 1408-1433 行），修改为：

```tsx
/* Interactive/PBL 类型：渲染 WebView */
{currentScene?.type === 'interactive' && (
  <View style={styles.interactiveContainer}>
    <InteractiveWebView
      ref={interactiveWebViewRef}
      sceneId={currentScene.id}
      url={(currentScene.content as any)?.url}
      htmlContent={(currentScene.content as any)?.htmlContent}
      onComplete={handleInteractiveComplete}
      onMessage={handleInteractiveMessage}
      style={styles.interactiveWebView}
    />
  </View>
)}

{currentScene?.type === 'pbl' && (
  <View style={styles.interactiveContainer}>
    <InteractiveWebView
      ref={interactiveWebViewRef}
      sceneId={currentScene.id}
      url={(currentScene.content as any)?.url}
      htmlContent={(currentScene.content as any)?.htmlContent}
      onComplete={handleInteractiveComplete}
      onMessage={handleInteractiveMessage}
      style={styles.interactiveWebView}
    />
  </View>
)}
```

---

### Task 3: 添加样式

**Files:**
- Modify: `packages/mobile/app/classroom/[id].tsx`

- [ ] **Step 1: 添加 InteractiveWebView 容器样式**

在 StyleSheet 中添加：

```typescript
interactiveContainer: {
  flex: 1,
  marginHorizontal: Spacing.md,
  marginVertical: Spacing.sm,
  borderRadius: Rounded.lg,
  overflow: 'hidden',
  backgroundColor: Colors.neutral.background,
  minHeight: 400, // 确保最小高度
},
interactiveWebView: {
  flex: 1,
},
```

---

### Task 4: 处理场景切换

**Files:**
- Modify: `packages/mobile/app/classroom/[id].tsx`

- [ ] **Step 1: 场景切换时重置 WebView 状态**

在 `goToScene` 函数中添加 WebView 重置：

```typescript
function goToScene(index: number) {
  if (index !== currentSceneIndex) {
    // 重置 WebView 状态
    interactiveWebViewRef.current?.injectJavaScript('location.reload();');
    playbackEngineRef.current?.jumpToScene(index);
    setShowThumbnailNav(false);
    setSelectedAnswers({});
    setSubmittedAnswers({});
    setQuizSubmitted(false);
  }
}
```

---

### Task 5: 测试验证

- [ ] **Step 1: TypeScript 编译检查**

Run: `cd packages/mobile && npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 2: 手动测试场景**

1. 创建包含 interactive 场景的课程
2. 导航到 interactive 场景
3. 验证 WebView 正确渲染内容
4. 测试交互功能
5. 测试场景切换

- [ ] **Step 3: 测试 pbl 场景**

同上，验证 pbl 场景渲染

---

### Task 6: 提交代码

- [ ] **Step 1: Commit**

```bash
git add packages/mobile/app/classroom/[id].tsx
git commit -m "feat(mobile): integrate InteractiveWebView for interactive/pbl scenes

- Render InteractiveWebView for interactive and pbl scene types
- Add completion and message handlers
- Handle scene transition state reset

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] interactive 场景正确渲染 WebView 内容
- [ ] pbl 场景正确渲染 WebView 内容
- [ ] 场景完成回调触发
- [ ] 场景切换正常
- [ ] TypeScript 编译无新增错误
- [ ] 不影响现有 slide/quiz 场景功能

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 场景内容格式不匹配 | WebView 无法渲染 | 添加降级显示，显示占位内容 |
| WebView 性能问题 | 卡顿 | 利用已有的低端设备检测降级 |
| 场景切换状态残留 | 数据混乱 | 确保切换时正确重置状态 |
