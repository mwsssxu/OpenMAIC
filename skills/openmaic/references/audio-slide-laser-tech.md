# Audio + Slide + Laser 技术方案

## 架构概述

课程播放系统由三个核心模块组成：

```
┌──────────────────────────────────────────────────────────────────────┐
│                         PlaybackEngine                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   speech    │───▶│  spotlight  │───▶│    laser    │              │
│  │   (TTS)     │    │  (聚焦)     │    │   (激光笔)  │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│         │                 │                  │                       │
│         ▼                 ▼                  ▼                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    ActionEngine                                  ││
│  │  execute(action) → updateCanvasStore → trigger callbacks       ││
│  └─────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       ScreenCanvas                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Elements Layer                           │    │
│  │  TextElement, ImageElement, ShapeElement, VideoElement      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    HighlightOverlay                          │    │
│  │  手动高亮标注（用户绘制）                                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   SpotlightOverlay                           │    │
│  │  SVG Mask遮罩 + 背景变暗 + 目标高亮                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    LaserOverlay                              │    │
│  │  飞入动画 + 脉冲发光                                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. Action 类型定义

### Speech Action

```typescript
interface SpeechAction {
  id: string;
  type: 'speech';
  text: string;
  elementId?: string;  // 关联的目标元素（用于同步高亮）
  voiceId?: string;
  speed?: number;
}
```

### Spotlight Action

```typescript
interface SpotlightAction {
  id: string;
  type: 'spotlight';
  elementId: string;    // 目标元素ID
  dimOpacity?: number;  // 背景变暗程度 (0-1, 默认0.7)
  duration?: number;    // 持续时间(ms)
}
```

### Laser Action

```typescript
interface LaserAction {
  id: string;
  type: 'laser';
  elementId: string;    // 目标元素ID
  color?: string;       // 激光笔颜色 (默认 '#ff3b30')
  duration?: number;    // 飞入动画时间(ms)
}
```

---

## 2. SpotlightOverlay 实现原理

### Web端实现（SVG Mask）

```tsx
// SpotlightOverlay.tsx
export function SpotlightOverlay() {
  const spotlightElementId = useCanvasStore.use.spotlightElementId();
  const dimness = spotlightOptions?.dimness ?? 0.7;

  // 使用 SVG mask 实现遮罩效果
  return (
    <svg viewBox="0 0 100 100">
      <defs>
        <mask id={`mask-${spotlightElementId}`}>
          {/* 白色背景 = 显示遮罩层 */}
          <rect x="0" y="0" width="100" height="100" fill="white" />
          {/* 黑色矩形 = 遮罩层镂空（高亮区域） */}
          <rect
            x={rect.x - padding}
            y={rect.y - padding}
            width={rect.w + padding * 2}
            height={rect.h + padding * 2}
            fill="black"
            rx={radius}
          />
        </mask>
      </defs>

      {/* 遮罩层：背景变暗 */}
      <rect
        width="100"
        height="100"
        fill={`rgba(0,0,0,${dimness})`}
        mask={`url(#mask-${spotlightElementId})`}
      />

      {/* 白色边框：高亮边界 */}
      <rect
        x={rect.x - borderWidth}
        y={rect.y - borderWidth}
        width={rect.w + borderWidth * 2}
        height={rect.h + borderWidth * 2}
        fill="none"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1.2"
      />
    </svg>
  );
}
```

### 动画效果

```tsx
// 从大范围收缩到精确位置
<motion.rect
  initial={{
    x: rect.x - 8,      // 初始：较大范围
    y: rect.y - 8,
    width: rect.w + 16,
    height: rect.h + 16,
    rx: 4,              // 圆角较大
  }}
  animate={{
    x: rect.x - 0.4,    // 最终：精确范围
    y: rect.y - 0.6,
    width: rect.w + 0.8,
    height: rect.h + 1.2,
    rx: 1,              // 圆角较小
  }}
  transition={{
    duration: 0.6,
    ease: [0.16, 1, 0.3, 1],  // ease-out-expo
  }}
/>
```

### 视觉效果

| 层级 | 效果 | 实现 |
|------|------|------|
| 遮罩层 | 背景变暗(70%) | SVG rect + mask |
| 镂空区 | 目标元素清晰 | mask black cutout |
| 边框 | 白色半透明边框 | stroke rect |
| 动画 | 收缩动画 | motion/react |

---

## 3. LaserOverlay 实现原理

### Web端实现

```tsx
// LaserOverlay.tsx
export function LaserOverlay({ geometry, color = '#ff3b30' }) {
  const { centerX, centerY } = geometry;  // 百分比坐标 (0-100)

  // 从屏幕角落飞入
  const startPos = {
    x: centerX > 50 ? 105 : -5,  // 右侧元素从右上飞入
    y: centerY > 50 ? 105 : -5,  // 左侧元素从左上飞入
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        left: `${startPos.x}%`,
        top: `${startPos.y}%`,
      }}
      animate={{
        opacity: 1,
        left: `${centerX}%`,
        top: `${centerY}%`,
      }}
      transition={{
        left: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
        top: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
      }}
    >
      {/* 脉冲环 */}
      <motion.div
        animate={{ scale: [1, 2.8], opacity: [0.6, 0] }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
        }}
        style={{ border: `1.5px solid ${color}` }}
      />

      {/* 核心点 */}
      <div
        style={{
          width: 10,
          height: 10,
          backgroundColor: color,
          boxShadow: `0 0 8px 2px ${color}60`,  // 发光效果
        }}
      />
    </motion.div>
  );
}
```

### 视觉效果

| 元素 | 效果 | 参数 |
|------|------|------|
| 飞入路径 | 从角落到目标 | 0.5s ease-out |
| 核心点 | 10px 圆点 | + 发光阴影 |
| 脉冲环 | 1→2.8倍放大 | 1.5s 循环 |
| 退出动画 | 返回角落消失 | 0.25s |

---

## 4. PlaybackEngine 处理流程

### Web端流程

```typescript
// lib/playback/engine.ts
case 'spotlight':
case 'laser': {
  // 1. 执行 ActionEngine（更新 CanvasStore）
  this.actionEngine.execute(action);

  // 2. 触发回调（通知UI层）
  this.callbacks.onEffectFire?.({
    kind: action.type,
    targetId: action.elementId,
    ...(action.type === 'spotlight'
      ? { dimOpacity: action.dimOpacity }
      : { color: action.color }),
  });

  // 3. 非阻塞执行（避免阻塞后续 speech）
  queueMicrotask(() => this.processNext());
  break;
}
```

### ActionEngine 执行

```typescript
// lib/action/engine.ts
execute(action: Action): void {
  switch (action.type) {
    case 'spotlight':
      useCanvasStore.getState().setSpotlightElementId(action.elementId);
      useCanvasStore.getState().setSpotlightOptions({
        dimness: action.dimOpacity ?? 0.7,
      });
      break;

    case 'laser':
      useCanvasStore.getState().setLaserElementId(action.elementId);
      useCanvasStore.getState().setLaserOptions({
        color: action.color ?? '#ff3b30',
      });
      break;
  }
}
```

---

## 5. CanvasStore 状态管理

### Web端 Zustand Store

```typescript
// lib/store/canvas.ts
interface CanvasStore {
  // Spotlight 状态
  spotlightElementId: string | null;
  spotlightOptions: { dimness: number } | null;
  setSpotlightElementId: (id: string | null) => void;
  setSpotlightOptions: (options: { dimness: number } | null) => void;

  // Laser 状态
  laserElementId: string | null;
  laserOptions: { color: string } | null;
  setLaserElementId: (id: string | null) => void;
  setLaserOptions: ( options: { color: string } | null) => void;

  // 清除所有效果
  clearEffects: () => void;
}
```

---

## 6. Mobile端适配方案

### React Native 限制

| 功能 | Web实现 | Mobile适配 |
|------|---------|------------|
| SVG Mask | 原生SVG | 使用绝对定位 + opacity |
| motion/react | Framer Motion Web | react-native-reanimated |
| 遮罩效果 | CSS mask | 半透明遮罩View + 镂空区域 |
| 激光飞入 | CSS left/top动画 | Animated.Value + transform |

### Spotlight 移动端实现

```tsx
// 使用遮罩层 + 镂空区域（替代SVG mask）
<View style={{ flex: 1 }}>
  {/* 半透明遮罩层 */}
  <View
    style={[
      styles.dimOverlay,
      { backgroundColor: `rgba(0,0,0,${dimness})` }
    ]}
  />

  {/* 镂空区域（白色边框） */}
  <Animated.View
    style={[
      styles.spotlightCutout,
      {
        left: position.left * scale,
        top: position.top * scale,
        width: position.width * scale,
        height: position.height * scale,
      }
    ]}
  >
    {/* 白色边框 */}
    <View style={styles.spotlightBorder} />
  </Animated.View>
</View>
```

### Laser 移动端实现

```tsx
// react-native-reanimated 实现
const laserX = useSharedValue(startX);
const laserY = useSharedValue(startY);
const laserOpacity = useSharedValue(0);
const pulseScale = useSharedValue(1);

useEffect(() => {
  // 飞入动画
  laserX.value = withTiming(targetX, { duration: 500, easing: Easing.out(Easing.exp) });
  laserY.value = withTiming(targetY, { duration: 500, easing: Easing.out(Easing.exp) });
  laserOpacity.value = withTiming(1, { duration: 150 });

  // 脉冲动画
  pulseScale.value = withRepeat(
    withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(2.8, { duration: 1200 })
    ),
    -1,  // infinite
    true
  );
}, []);

const animatedStyle = useAnimatedStyle(() => ({
  left: laserX.value * scale,
  top: laserY.value * scale,
  opacity: laserOpacity.value,
}));
```

---

## 7. 语音+视觉效果联动

### Action 执行顺序

```typescript
// 场景 actions 示例
actions: [
  { type: 'speech', text: '现在我们来学习第一个要点...', elementId: 'point_0' },
  { type: 'spotlight', elementId: 'point_0', dimOpacity: 0.7 },
  { type: 'laser', elementId: 'point_0', color: '#ff3b30' },
  { type: 'speech', text: '接下来是第二个要点...', elementId: 'point_1' },
  { type: 'spotlight', elementId: 'point_1' },
  // ...
]
```

### 联动效果

```
Timeline:
───────────────────────────────────────────────────────────────▶
│   Speech     │   Spotlight  │   Laser      │   Speech      │
│   point_0    │   point_0    │   point_0    │   point_1     │
│   ──────     │   ──────     │   ──────     │   ──────      │
│   语音播放   │   背景变暗   │   激光飞入   │   切换目标    │
│   同时高亮   │   聚焦效果   │   动画效果   │   转移焦点    │
```

---

## 8. 数据结构示例

### Scene Content

```json
{
  "type": "slide",
  "canvas": {
    "width": 1000,
    "height": 562,
    "background": "#ffffff",
    "elements": [
      {
        "id": "title",
        "type": "text",
        "content": "木工基础与安全规范",
        "position": { "top": 30, "left": 50, "width": 900, "height": 60 },
        "style": { "fontSize": 36, "color": "#333333" }
      },
      {
        "id": "point_0",
        "type": "text",
        "content": "• 木工安全规范概述",
        "position": { "top": 200, "left": 50, "width": 900, "height": 40 },
        "style": { "fontSize": 16, "color": "#444444" }
      }
    ]
  }
}
```

### Actions

```json
[
  {
    "id": "speech_1",
    "type": "speech",
    "text": "现在我们来学习木工安全规范...",
    "elementId": "point_0"
  },
  {
    "id": "spotlight_1",
    "type": "spotlight",
    "elementId": "point_0",
    "dimOpacity": 0.7
  },
  {
    "id": "laser_1",
    "type": "laser",
    "elementId": "point_0",
    "color": "#ff3b30"
  }
]
```

---

## 9. 参考文件路径

| 文件 | 路径 | 功能 |
|------|------|------|
| ScreenCanvas | `components/slide-renderer/Editor/ScreenCanvas.tsx` | 幻灯片画布主组件 |
| SpotlightOverlay | `components/slide-renderer/Editor/SpotlightOverlay.tsx` | 聚光灯效果 |
| LaserOverlay | `components/slide-renderer/Editor/LaserOverlay.tsx` | 激光笔效果 |
| PlaybackEngine | `lib/playback/engine.ts` | 播放引擎 |
| ActionEngine | `lib/action/engine.ts` | Action执行引擎 |
| CanvasStore | `lib/store/canvas.ts` | 画布状态管理 |
| types/action | `lib/types/action.ts` | Action类型定义 |

---

## 10. Mobile端待实现功能

| 功能 | 状态 | 优先级 |
|------|------|--------|
| SpotlightOverlay | 已实现 | ✅ |
| LaserOverlay | 已实现 | ✅ |
| PlaybackEngine spotlight/laser处理 | 已实现 | ✅ |
| CanvasElement → PPTElement 转换 | 已实现 | ✅ |
| Speech + Spotlight 联动 | 已实现 | ✅ |
| elementId → geometry 转换 | 已有 | ✅ |

---

## 11. Mobile端实现文件路径

| 文件 | 路径 | 功能 |
|------|------|------|
| SpotlightOverlay | `components/slide/SpotlightOverlay.tsx` | 四层遮罩镂空效果 + 收缩动画 |
| LaserOverlay | `components/slide/LaserOverlay.tsx` | 飞入动画 + 脉冲发光 |
| ScreenCanvas | `components/slide/ScreenCanvas.tsx` | 整合 spotlight/laser overlay |
| PlaybackEngine | `lib/playback/engine.ts` | 添加 onSpotlight/onLaser 回调 |
| classroom/[id].tsx | `app/classroom/[id].tsx` | 整合视觉效果状态管理 |

---

## 12. 实现细节说明

### SpotlightOverlay 实现

由于 React Native 不支持 SVG mask，采用四块遮罩层方案：
- Top layer: 从画布顶部到镂空区域顶部
- Bottom layer: 从镂空区域底部到画布底部
- Left layer: 镂空区域左侧（高度覆盖镂空区上下）
- Right layer: 镂空区域右侧（高度覆盖镂空区上下）

动画使用 `react-native-reanimated`:
- `paddingAnim`: 从 40px 收缩到 8px（600ms ease-out-expo）
- `borderRadiusAnim`: 从 12px 收缩到 4px

### LaserOverlay 实现

飞入动画:
- 从屏幕角落飞入（根据目标位置决定起点）
- 目标在右侧 → 从右上角飞入
- 目标在左侧 → 从左上角飞入
- 动画时长 500ms，ease-out-expo

脉冲动画:
- `pulseScale`: 1 → 2.8 无限循环（1.5s 周期）
- `pulseOpacity`: 0.6 → 0 无限循环

### PlaybackEngine 回调

新增回调类型:
```typescript
onSpotlight?: (elementId: string, dimness?: number) => void;
onLaser?: (elementId: string, color?: string) => void;
onClearEffects?: () => void;
```

非阻塞执行:
- spotlight/laser action 执行后立即继续处理下一个 action
- speech action 是阻塞的，等待音频播放完成