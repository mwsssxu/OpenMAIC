# 白板双指缩放/平移改进计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为白板组件添加双指缩放和平移手势，支持大画布操作。

**Architecture:** 使用 `react-native-gesture-handler` 的 `PinchGestureHandler` 和 `PanGestureHandler` 组合手势，配合 `react-native-reanimated` 实现流畅的缩放和平移动画。

**Tech Stack:** React Native, react-native-gesture-handler, react-native-reanimated

---

## 背景

当前白板组件 (`whiteboard.tsx`) 使用 `PanResponder` 仅支持单指绘制。需要添加：
1. 双指缩放 - 放大/缩小画布
2. 双指平移 - 在缩放状态下移动画布
3. 绘制与缩放/平移的模式切换

---

## 设计要点

### 手势冲突处理

- **单指拖动**：绘制模式
- **双指捏合**：缩放模式
- **双指拖动**：平移模式（缩放状态下）

使用 `react-native-gesture-handler` 的 `Gesture.Simultaneous` 或手势状态判断来区分。

### 缩放限制

- 最小缩放：0.5x
- 最大缩放：3x
- 平移边界：不允许移出画布边界

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/mobile/components/playback/whiteboard.tsx` | 重写 | 添加缩放/平移手势处理 |

---

### Task 1: 添加手势和动画依赖导入

**Files:**
- Modify: `packages/mobile/components/playback/whiteboard.tsx`

- [ ] **Step 1: 更新 imports**

```typescript
/**
 * 移动端白板组件 - 支持手势绘制、双指缩放和平移
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withClamp,
  runOnJS,
} from 'react-native-reanimated';
import { useI18n } from '@/lib/i18n';
import { Colors } from '@/lib/constants/theme';
import { useHaptics } from '@/lib/hooks/use-haptics';
```

---

### Task 2: 添加缩放和平移状态

**Files:**
- Modify: `packages/mobile/components/playback/whiteboard.tsx`

- [ ] **Step 1: 添加缩放/平移状态变量**

在组件内部添加：

```typescript
export function Whiteboard({
  width,
  height,
  elements = [],
  onElementAdd,
  onClear,
  editable = true,
}: WhiteboardProps) {
  const { t } = useI18n();
  const haptics = useHaptics();
  const screenWidth = width || Dimensions.get('window').width - 40;
  const screenHeight = height || screenWidth * 0.75;

  // 缩放和平移状态（使用 Reanimated）
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // 缩放限制
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;

  // 绘制状态
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [paths, setPaths] = useState<WhiteboardElement[]>(elements);
  const [color, setColor] = useState('#333333');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [showTools, setShowTools] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
```

---

### Task 3: 实现缩放手势

**Files:**
- Modify: `packages/mobile/components/playback/whiteboard.tsx`

- [ ] **Step 1: 添加双指缩放手势**

```typescript
// 双指缩放手势
const pinchGesture = Gesture.Pinch()
  .onUpdate((e) => {
    // 限制缩放范围
    const newScale = savedScale.value * e.scale;
    scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
  })
  .onEnd(() => {
    savedScale.value = scale.value;
    // 缩放结束时触觉反馈
    if (scale.value < 0.8 || scale.value > 2.5) {
      runOnJS(haptics.light)();
    }
  });
```

---

### Task 4: 实现平移手势

**Files:**
- Modify: `packages/mobile/components/playback/whiteboard.tsx`

- [ ] **Step 1: 添加双指平移手势**

```typescript
// 双指平移手势（仅在缩放状态下生效）
const panGesture = Gesture.Pan()
  .onUpdate((e) => {
    // 仅在缩放状态下允许平移
    if (scale.value > 1.1) {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    }
  })
  .onEnd(() => {
    savedTranslateX.value = translateX.value;
    savedTranslateY.value = translateY.value;
  });
```

---

### Task 5: 实现绘制手势

**Files:**
- Modify: `packages/mobile/components/playback/whiteboard.tsx`

- [ ] **Step 1: 添加绘制手势**

```typescript
// 绘制路径转换：将屏幕坐标转换为画布坐标
const screenToCanvasX = (screenX: number) => {
  'worklet';
  return (screenX - translateX.value) / scale.value;
};

const screenToCanvasY = (screenY: number) => {
  'worklet';
  return (screenY - translateY.value) / scale.value;
};

// 单指绘制手势
const drawGesture = Gesture.Pan()
  .activeOffsetX([-10, 10])  // 需要移动 10px 才激活
  .activeOffsetY([-10, 10])
  .onStart((e) => {
    if (!editable || scale.value > 1.1) return;
    runOnJS(setIsDrawing)(true);
    const x = screenToCanvasX(e.x);
    const y = screenToCanvasY(e.y);
    runOnJS(setCurrentPath)(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
  })
  .onUpdate((e) => {
    if (!editable || scale.value > 1.1) return;
    const x = screenToCanvasX(e.x);
    const y = screenToCanvasY(e.y);
    runOnJS(setCurrentPath)((prev: string | null) => 
      prev ? `${prev} L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`
    );
  })
  .onEnd(() => {
    if (!editable || !currentPath) return;
    runOnJS(setIsDrawing)(false);
    const newElement: WhiteboardElement = {
      id: `path_${Date.now()}`,
      type: 'path',
      data: currentPath,
      color,
      strokeWidth,
    };
    runOnJS(setPaths)((prev: WhiteboardElement[]) => [...prev, newElement]);
    runOnJS(onElementAdd)?.(newElement);
    runOnJS(setCurrentPath)(null);
  });
```

---

### Task 6: 组合手势

**Files:**
- Modify: `packages/mobile/components/playback/whiteboard.tsx`

- [ ] **Step 1: 组合缩放、平移和绘制手势**

```typescript
// 组合手势：缩放和平移同时进行，绘制单独处理
const composedGesture = Gesture.Simultaneous(
  pinchGesture,
  panGesture
);

// 绘制手势需要与其他手势互斥
const gesture = Gesture.Race(drawGesture, composedGesture);
```

---

### Task 7: 实现动画样式

**Files:**
- Modify: `packages/mobile/components/playback/whiteboard.tsx`

- [ ] **Step 1: 添加动画样式**

```typescript
// 画布变换样式
const animatedCanvasStyle = useAnimatedStyle(() => ({
  transform: [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ],
}));

// 缩放指示器样式
const [showZoomIndicator, setShowZoomIndicator] = useState(false);
const zoomIndicatorTimeout = useRef<NodeJS.Timeout | null>(null);

const updateZoomIndicator = useCallback(() => {
  setShowZoomIndicator(true);
  if (zoomIndicatorTimeout.current) {
    clearTimeout(zoomIndicatorTimeout.current);
  }
  zoomIndicatorTimeout.current = setTimeout(() => {
    setShowZoomIndicator(false);
  }, 1500);
}, []);
```

---

### Task 8: 更新渲染逻辑

**Files:**
- Modify: `packages/mobile/components/playback/whiteboard.tsx`

- [ ] **Step 1: 更新主渲染**

```typescript
return (
  <View style={[styles.container, { width: screenWidth, height: screenHeight + (showTools && editable ? 60 : 0) }]}>
    {/* 缩放指示器 */}
    {showZoomIndicator && (
      <View style={styles.zoomIndicator}>
        <Text style={styles.zoomText}>{Math.round(scale.value * 100)}%</Text>
      </View>
    )}

    {/* 白板画布 - 使用 GestureDetector 包裹 */}
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.canvas, { width: screenWidth, height: screenHeight }]}>
        {/* 背景 */}
        <View style={{ width: screenWidth, height: screenHeight, backgroundColor: '#ffffff' }} />

        {/* 已绘制的路径 */}
        <Animated.View style={animatedCanvasStyle}>
          {paths.map((el) => {
            if (el.type === 'path') {
              return renderPath(el.data, el.color, el.strokeWidth);
            }
            return null;
          })}

          {/* 当前正在绘制的路径 */}
          {currentPath && renderPath(currentPath, color, strokeWidth)}
        </Animated.View>
      </Animated.View>
    </GestureDetector>

    {/* 工具栏 */}
    {editable && showTools && (
      <View style={styles.toolbar}>
        {/* 缩放重置按钮 */}
        <TouchableOpacity 
          style={styles.resetZoomButton}
          onPress={() => {
            scale.value = withSpring(1);
            savedScale.value = 1;
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
            haptics.light();
          }}
        >
          <Text style={styles.resetZoomText}>重置视图</Text>
        </TouchableOpacity>

        {/* 颜色选择 */}
        <View style={styles.colorPicker}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorButton, { backgroundColor: c }, color === c && styles.colorButtonActive]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>

        {/* 笔触大小 */}
        <View style={styles.strokePicker}>
          {STROKE_WIDTHS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.strokeButton, strokeWidth === s && styles.strokeButtonActive]}
              onPress={() => setStrokeWidth(s)}
            >
              <View style={[styles.strokeIndicator, { width: s, height: s }]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleUndo}>
            <Text style={styles.actionButtonText}>{t('whiteboard.undo')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={handleClear}>
            <Text style={styles.actionButtonText}>{t('whiteboard.clear')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
  </View>
);
```

---

### Task 9: 添加新样式

**Files:**
- Modify: `packages/mobile/components/playback/whiteboard.tsx`

- [ ] **Step 1: 添加缩放相关样式**

```typescript
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  canvas: {
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  zoomIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  zoomText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  resetZoomButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.neutral.background,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  resetZoomText: {
    fontSize: 11,
    color: Colors.neutral.textSecondary,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  colorPicker: {
    flexDirection: 'row',
    gap: 4,
  },
  colorButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  colorButtonActive: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  strokePicker: {
    flexDirection: 'row',
    gap: 8,
  },
  strokeButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: Colors.neutral.card,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  strokeButtonActive: {
    borderColor: '#007AFF',
  },
  strokeIndicator: {
    backgroundColor: '#333',
    borderRadius: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#eee',
  },
  clearButton: {
    backgroundColor: '#ffebee',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
  },
});
```

---

### Task 10: 验证和提交

- [ ] **Step 1: TypeScript 编译检查**

Run: `cd packages/mobile && npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 2: Commit**

```bash
git add packages/mobile/components/playback/whiteboard.tsx
git commit -m "feat(mobile): add pinch zoom and pan to whiteboard

- Add pinch gesture for zoom (0.5x - 3x range)
- Add two-finger pan gesture when zoomed
- Add zoom indicator showing current scale
- Add reset view button
- Convert drawing coordinates based on zoom/pan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] 双指捏合可以缩放画布
- [ ] 缩放范围限制在 0.5x - 3x
- [ ] 缩放状态下可以平移画布
- [ ] 单指绘制在缩放状态下仍可工作
- [ ] 缩放指示器显示当前缩放比例
- [ ] 重置视图按钮可以恢复默认状态
- [ ] TypeScript 编译无错误
