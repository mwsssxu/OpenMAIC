# 语音讲解、幻灯片与激光笔技术框架

本文档详细说明 OpenMAIC 中语音讲解 (Speech)、幻灯片渲染 (Slide) 和激光笔 (Laser) 的技术架构与实现细节。

## 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                     Action Layer (动作定义)                      │
│  SpeechAction │ SpotlightAction │ LaserAction │ HighlightAction │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Engine Layer (执行引擎)                      │
│           PlaybackEngine (播放控制) │ ActionEngine (动作执行)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Store Layer (状态管理)                       │
│        useCanvasStore (视觉特效) │ useSettingsStore (TTS配置)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Renderer Layer (视觉渲染)                      │
│  ScreenCanvas │ LaserOverlay │ SpotlightOverlay │ HighlightOverlay │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Audio Layer (语音合成)                       │
│   TTS Providers (多提供者) │ AudioPlayer │ Browser Native TTS    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 一、语音讲解 (Speech)

### 1.1 Action 类型定义

**文件位置**: `lib/types/action.ts`

```typescript
export interface SpeechAction extends ActionBase {
  type: 'speech';
  text: string;           // 讲解文本内容
  audioId?: string;       // 预生成音频ID
  audioUrl?: string;      // 预生成音频URL（服务端TTS生成）
  voice?: string;         // 语音ID
  speed?: number;         // 语速 (默认 1.0)
}
```

### 1.2 TTS 提供者架构

OpenMAIC 采用 **工厂模式** 路由 TTS 请求到多个提供者，核心文件为 `lib/audio/tts-providers.ts`。

| 提供者 | API 端点 | 特点 | 默认模型 |
|--------|----------|------|----------|
| OpenAI TTS | `api.openai.com/v1/audio/speech` | 高质量多语言 | `gpt-4o-mini-tts` |
| Azure TTS | `{region}.tts.speech.microsoft.com` | SSML 标记支持 | - |
| GLM TTS | `open.bigmodel.cn/api/paas/v4` | 智谱清言中文 | `glm-tts` |
| Qwen TTS | `dashscope.aliyuncs.com/api/v1` | 阿里云百炼 | `qwen3-tts-flash` |
| MiniMax TTS | `api.minimaxi.com/v1/t2a_v2` | 多中文音色 | `speech-2.8-hd` |
| Doubao TTS | `openspeech.bytedance.com/api/v3/tts` | 火山引擎 | - |
| ElevenLabs TTS | `api.elevenlabs.io/v1` | 国际高质量 | `eleven_multilingual_v2` |
| VoxCPM2 | 本地部署 `http://127.0.0.1:8000` | 开源可控 | - |
| Browser Native | Web Speech API | 客户端免费 | - |

### 1.3 PlaybackEngine 状态机

**文件位置**: `lib/playback/engine.ts`

状态流转图:
```
                start()                  pause()
  idle ──────────────────→ playing ──────────────→ paused
    ↑                         ↑                       │
    │                         │  resume()             │
    │                         └───────────────────────┘
    │
    │  handleEndDiscussion()
    └─────────────────────────────────────────────────
```

**语音执行流程** (`processNext()` 方法):

1. **预生成音频检查**: 优先使用 `audioId/audioUrl`
2. **AudioPlayer 播放**: 调用 `audioPlayer.play(audioId, audioUrl)`
3. **Browser Native TTS**: 无预生成音频时，检查是否启用 Web Speech API
4. **分句策略**: 将长文本按句号分割，避免 Chrome 15秒截断问题
5. **阅读时间模拟**: 未启用 TTS 时，按 CJK 150ms/字符、非CJK 240ms/词 计算

### 1.4 Browser Native TTS 分句实现

```typescript
// lib/playback/engine.ts:608-616
private splitIntoChunks(text: string): string[] {
  // 按句号分割 (支持中英文标点)
  const chunks = text
    .split(/(?<=[.!?。！？\n])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return chunks.length > 0 ? chunks : [text];
}
```

**分句原因**: Chrome 浏览器存在 bug，超过约 15 秒的语音会被静默截断，`onend` 回调永不触发，导致引擎卡死。

### 1.5 TTS 配置管理

**文件位置**: `lib/audio/constants.ts`

配置结构:
```typescript
export interface TTSProviderConfig {
  id: string;
  name: string;
  requiresApiKey: boolean;
  defaultBaseUrl: string;
  icon: string;
  models: { id: string; name: string }[];
  defaultModelId: string;
  voices: TTSVoiceInfo[];
  supportedFormats: string[];
  speedRange: { min: number; max: number; default: number };
}
```

---

## 二、幻灯片渲染 (Slide)

### 2.1 Scene 类型路由

**文件位置**: `components/stage/scene-renderer.tsx`

```typescript
export function SceneRenderer({ scene, mode }) {
  switch (scene.type) {
    case 'slide':     return <SlideRenderer mode={mode} />;
    case 'quiz':      return <QuizView questions={scene.content.questions} />;
    case 'interactive': return <InteractiveRenderer content={scene.content} />;
    case 'pbl':       return <PBLRenderer content={scene.content} mode={mode} />;
  }
}
```

### 2.2 SlideRenderer 双模式

**文件位置**: `components/slide-renderer/Editor/index.tsx`

| 模式 | 组件 | 用途 |
|------|------|------|
| `autonomous` | `Canvas` | 编辑模式，支持交互操作 |
| 其他 | `ScreenCanvas` | 演示模式，只读 + 视觉特效 |

### 2.3 ScreenCanvas 视觉层结构

**文件位置**: `components/slide-renderer/Editor/ScreenCanvas.tsx`

```tsx
<div className="relative h-full w-full overflow-hidden">
  {/* 背景层 */}
  <div style={backgroundStyle} />
  
  {/* 内容层 - 按 canvasScale 缩放 */}
  <div style={{ transform: `scale(${canvasScale})` }}>
    {elements.map((element) => (
      <ScreenElement key={element.id} elementInfo={element} />
    ))}
    <HighlightOverlay />
  </div>
  
  {/* 聚光灯层 - 全屏 SVG 遮罩 */}
  <SpotlightOverlay />
  
  {/* 视觉特效层 - 百分比坐标定位 */}
  <div style={{ padding: '5%' }}>
    <LaserOverlay />
  </div>
</div>
```

### 2.4 元素类型映射

**文件位置**: `components/slide-renderer/Editor/ScreenElement.tsx`

```typescript
const elementTypeMap = {
  image:   BaseImageElement,
  text:    BaseTextElement,
  shape:   BaseShapeElement,
  line:    BaseLineElement,   // 支持笔画动画
  chart:   BaseChartElement,
  latex:   BaseLatexElement,
  table:   BaseTableElement,
  video:   BaseVideoElement,
  code:    BaseCodeElement,
};
```

### 2.5 Scene Context 数据订阅

**文件位置**: `lib/contexts/scene-context.tsx`

使用 React 18 的 `useSyncExternalStore` 实现精确订阅:
```typescript
export function useSceneSelector<T, R>(
  content: T,
  selector: (content: T) => R,
): R {
  return selector(content);
}
```

---

## 三、激光笔 (Laser)

### 3.1 Action 类型定义

**文件位置**: `lib/types/action.ts`

```typescript
export interface LaserAction extends ActionBase {
  type: 'laser';
  elementId: string;      // 目标元素 ID
  color?: string;         // 颜色 (默认 '#ff0000')
}
```

### 3.2 ActionEngine 执行

**文件位置**: `lib/action/engine.ts`

```typescript
private executeLaser(action: LaserAction): void {
  useCanvasStore.getState().setLaser(action.elementId, {
    color: action.color ?? '#ff0000',
  });
  this.scheduleEffectClear();  // 5 秒后自动清除
}
```

**特点**: Fire-and-forget (发射即忘)，不阻塞后续动作执行。

### 3.3 LaserOverlay 动画实现

**文件位置**: `components/slide-renderer/Editor/LaserOverlay.tsx`

```tsx
export function LaserOverlay({ geometry, color = '#ff3b30' }) {
  const { centerX, centerY } = geometry;
  
  // 从最近的角落飞入
  const startPos = {
    x: centerX > 50 ? 105 : -5,
    y: centerY > 50 ? 105 : -5,
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, left: `${startPos.x}%`, top: `${startPos.y}%` }}
      animate={{ opacity: 1, left: `${centerX}%`, top: `${centerY}%` }}
      exit={{ opacity: 0, left: `${startPos.x}%`, top: `${startPos.y}%` }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* 环形脉冲动画 */}
      <motion.div
        animate={{ scale: [1, 2.8], opacity: [0.6, 0] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
        style={{ border: `1.5px solid ${color}` }}
      />
      
      {/* 光点核心 */}
      <div
        style={{
          backgroundColor: color,
          boxShadow: `0 0 8px 2px ${color}60`,
        }}
      />
    </motion.div>
  );
}
```

**动画参数**:
- 飞入动画: 500ms, ease `[0.22, 1, 0.36, 1]` (ease-out 曲线)
- 退出动画: 250ms, ease `[0.4, 0, 1, 1]`
- 脉冲动画: 1.5s 无限循环, scale 1→2.8

### 3.4 百分比坐标系统

激光笔使用百分比坐标 (0-100) 定位，而非像素坐标，确保响应式布局:
```typescript
export interface PercentageGeometry {
  x: number;       // 左边界 (0-100)
  y: number;       // 上边界 (0-100)
  w: number;       // 宽度 (0-100)
  h: number;       // 高度 (0-100)
  centerX: number; // 中心 X (0-100)
  centerY: number; // 中心 Y (0-100)
}
```

---

## 四、聚光灯 (Spotlight)

### 4.1 Action 类型定义

```typescript
export interface SpotlightAction extends ActionBase {
  type: 'spotlight';
  elementId: string;
  dimOpacity?: number;  // 背景变暗程度 (默认 0.5)
}
```

### 4.2 SVG Mask 实现原理

**文件位置**: `components/slide-renderer/Editor/SpotlightOverlay.tsx`

```tsx
<svg viewBox="0 0 100 100" preserveAspectRatio="none">
  <defs>
    <mask id={`mask-${spotlightElementId}`}>
      {/* 白色背景 = 显示遮罩层 (变暗区域) */}
      <rect x="0" y="0" width="100" height="100" fill="white" />
      
      {/* 黑色矩形 = 隐藏遮罩层 (镂空聚焦区) */}
      <motion.rect
        fill="black"
        animate={{
          x: rect.x - 0.4,
          y: rect.y - 0.6,
          width: rect.w + 0.8,
          height: rect.h + 1.2,
          rx: 1,  // 圆角
        }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </mask>
  </defs>
  
  {/* 变暗背景层 */}
  <rect
    width="100" height="100"
    fill={`rgba(0,0,0,${dimness})`}
    mask={`url(#mask-${spotlightElementId})`}
  />
  
  {/* 白色边框 (高亮轮廓) */}
  <motion.rect
    stroke="rgba(255,255,255,0.7)"
    strokeWidth="1.2"
    fill="none"
  />
</svg>
```

**关键技术**:
- SVG `<mask>` 元素实现镂空效果
- `preserveAspectRatio="none"` 确保全屏覆盖
- 不使用 `backdrop-filter` (与 SVG mask 冲突，导致某些浏览器聚焦区也被变暗)

---

## 五、高亮 (Highlight)

### 5.1 实现方式

**文件位置**: `components/slide-renderer/Editor/HighlightOverlay.tsx`

```tsx
<div style={{
  border: `${borderWidth}px solid ${color}`,
  boxShadow: `0 0 ${borderWidth * 3}px ${color}`,
  backgroundColor: `${color}${opacityHex}`,
}}>
  {/* 脉冲动画 */}
  <div className="animate-pulse" />
  
  {/* 闪烁效果 */}
  {animated && (
    <div className="animate-ping" style={{ animationDuration: '2s' }} />
  )}
</div>

<style jsx>{`
  @keyframes breathe {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.02); }
  }
`}</style>
```

**特点**:
- 不修改元素本身属性，创建叠加层
- 支持多元素同时高亮
- CSS `box-shadow` 实现发光效果

---

## 六、状态管理 (useCanvasStore)

**文件位置**: `lib/store/canvas.ts`

### 6.1 教学特性状态

```typescript
interface CanvasState {
  // 聚光灯
  spotlightElementId: string;
  spotlightOptions: SpotlightOptions | null;
  spotlightMode: 'pixel' | 'percentage';
  spotlightPercentageGeometry: PercentageGeometry | null;
  
  // 高亮
  highlightedElementIds: string[];
  highlightOptions: HighlightOverlayOptions | null;
  
  // 激光笔
  laserElementId: string;
  laserOptions: LaserOptions | null;
  
  // 缩放
  zoomTarget: { elementId: string; scale: number } | null;
}
```

### 6.2 Actions

```typescript
// 设置激光笔
setLaser: (elementId: string, options?: LaserOptions) => void;

// 清除激光笔
clearLaser: () => void;

// 清除所有特效
clearAllEffects: () => void;  // 清除 spotlight, highlight, laser, zoom
```

---

## 七、数据流时序图

```
AI Agent                 PlaybackEngine            ActionEngine
   │                          │                         │
   │  Scene.actions[]         │                         │
   │─────────────────────────>│                         │
   │                          │                         │
   │                          │  execute(LaserAction)   │
   │                          │────────────────────────>│
   │                          │                         │
   │                          │                         │  setLaser()
   │                          │                         │──────────> useCanvasStore
   │                          │                         │
   │                          │  processNext()          │
   │                          │  (queueMicrotask)       │
   │                          │                         │
   │                          │                         │
   │                          │  execute(SpeechAction)  │
   │                          │────────────────────────>│
   │                          │                         │
   │                          │  AudioPlayer.play()     │
   │                          │──────────> AudioPlayer  │
   │                          │                         │
   │                          │  onEnded callback       │
   │                          │<────────────────────────│
   │                          │                         │
   │                          │  processNext()          │
   │                          │  (continue)             │
```

---

## 八、关键文件索引

| 功能模块 | 核心文件 |
|----------|----------|
| Action 类型定义 | `lib/types/action.ts` |
| 播放引擎 | `lib/playback/engine.ts` |
| 动作执行引擎 | `lib/action/engine.ts` |
| Canvas 状态管理 | `lib/store/canvas.ts` |
| TTS 提供者实现 | `lib/audio/tts-providers.ts` |
| TTS 配置常量 | `lib/audio/constants.ts` |
| 激光笔渲染 | `components/slide-renderer/Editor/LaserOverlay.tsx` |
| 聚光灯渲染 | `components/slide-renderer/Editor/SpotlightOverlay.tsx` |
| 高亮渲染 | `components/slide-renderer/Editor/HighlightOverlay.tsx` |
| 幻灯片画布 | `components/slide-renderer/Editor/ScreenCanvas.tsx` |
| Scene 渲染路由 | `components/stage/scene-renderer.tsx` |
| Scene Context | `lib/contexts/scene-context.tsx` |

---

## 九、扩展指南

### 添加新的 TTS 提供者

1. 在 `lib/audio/types.ts` 中添加 `TTSProviderId`
2. 在 `lib/audio/constants.ts` 中添加配置
3. 在 `lib/audio/tts-providers.ts` 中实现 `generateXxxTTS()` 函数
4. 在 `generateTTS()` switch 中添加 case
5. 在 `lib/i18n.ts` 中添加翻译

### 添加新的视觉特效

1. 在 `lib/types/action.ts` 中定义新的 Action 类型
2. 在 `lib/store/canvas.ts` 中添加状态和 Actions
3. 在 `lib/action/engine.ts` 中实现执行方法
4. 在 `components/slide-renderer/Editor/` 中创建 Overlay 组件
5. 在 `ScreenCanvas.tsx` 中引入并渲染

---

## 十、注意事项

1. **Fire-and-forget 动作**: `spotlight` 和 `laser` 不阻塞播放，使用 `queueMicrotask()` 避免栈溢出
2. **特效自动清除**: 默认 5 秒后自动清除，防止视觉干扰累积
3. **百分比坐标**: 激光笔和聚光灯使用百分比坐标，确保响应式
4. **Browser TTS 分句**: 必须分句播放，避免 Chrome 截断 bug
5. **SVG Mask**: 聚光灯不使用 `backdrop-filter`，与 SVG mask 存在兼容问题