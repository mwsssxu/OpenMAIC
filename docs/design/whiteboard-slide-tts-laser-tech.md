# 白板、幻灯片、TTS与激光笔技术实现说明文档

本文档详细阐述 OpenMAIC 系统中白板、幻灯片渲染、语音合成(TTS)和激光笔四大核心模块的技术架构与实现细节。

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Action Layer (动作定义层)                        │
│  SpeechAction │ WbDrawTextAction │ WbDrawShapeAction │ LaserAction  │
│  WbDrawChartAction │ WbDrawLatexAction │ WbDrawTableAction 等        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     Engine Layer (执行引擎层)                        │
│           PlaybackEngine (播放控制) │ ActionEngine (动作执行)        │
│           stateless-generate (在线生成) │ director-graph (编排)     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     Store Layer (状态管理层)                         │
│        useCanvasStore (视觉特效) │ useStageStore (全局状态)          │
│        useWhiteboardHistoryStore (历史快照)                          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   Renderer Layer (视觉渲染层)                        │
│  WhiteboardCanvas │ ScreenCanvas │ LaserOverlay │ SpotlightOverlay  │
│  InteractiveWhiteboardCanvas │ AnimatedElement │ ScreenElement      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     Audio Layer (语音合成层)                         │
│   TTS Providers (多提供者) │ AudioPlayer │ Browser Native TTS       │
│   generateTTS工厂函数 │ TTSRateLimitError异常处理                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     API Layer (接口封装层)                           │
│        createWhiteboardAPI (白板CRUD) │ StageAPI (舞台操作)          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、白板系统 (Whiteboard)

### 2.1 白板架构层次

**文件位置**: `components/whiteboard/whiteboard-canvas.tsx`

#### 2.1.1 组件层次结构

```
Whiteboard (容器组件)
  └─ WhiteboardCanvas (主画布)
      └─ InteractiveWhiteboardCanvas (交互核心)
          └─ AnimatedElement (元素动画包装器)
              └─ ScreenElement (元素渲染器)
```

#### 2.1.2 WhiteboardCanvas - 主画布容器

**职责**: 响应式缩放适配 + ResizeObserver监听

```tsx
export const WhiteboardCanvas = forwardRef<WhiteboardCanvasHandle, WhiteboardCanvasProps>(
  function WhiteboardCanvas({ onViewModifiedChange }, ref) {
    const stage = useStageStore.use.stage();
    const isClearing = useCanvasStore.use.whiteboardClearing();
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    // 固定画布尺寸：1000x562.5 (16:9)
    const canvasWidth = 1000;
    const canvasHeight = 562.5;

    // 自适应缩放计算
    const containerScale = useMemo(() => {
      if (containerSize.width === 0 || containerSize.height === 0) return 1;
      return Math.min(
        containerSize.width / canvasWidth,
        containerSize.height / canvasHeight
      );
    }, [containerSize]);

    // ResizeObserver监听容器尺寸变化
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      observer.observe(container);
      setContainerSize({ width: container.clientWidth, height: container.clientHeight });
      return () => observer.disconnect();
    }, []);

    return (
      <div ref={containerRef} className="w-full h-full overflow-hidden">
        <InteractiveWhiteboardCanvas
          canvasHeight={canvasHeight}
          canvasWidth={canvasWidth}
          containerScale={containerScale}
          elements={elements}
          isClearing={isClearing}
        />
      </div>
    );
  }
);
```

### 2.2 InteractiveWhiteboardCanvas - 交互核心

**文件位置**: `components/whiteboard/whiteboard-canvas.tsx:96-375`

#### 2.2.1 状态管理

```tsx
// 用户缩放状态 (0.2 - 5倍)
const [viewZoom, setViewZoom] = useState(1);

// 平移偏移量
const [panX, setPanX] = useState(0);
const [panY, setPanY] = useState(0);

// 交互状态标记
const [isPanning, setIsPanning] = useState(false);
const [isResetting, setIsResetting] = useState(false);

// 视图修改检测
const isViewModified = viewZoom !== 1 || panX !== 0 || panY !== 0;
```

#### 2.2.2 平移边界约束算法

**关键技术**: Zoom-aware pan boundary - 确保画布边缘始终可见

```tsx
const clampPan = useCallback(
  (x: number, y: number, zoom: number) => {
    const totalScale = containerScale * zoom;
    // 最大平移量 = 画布尺寸的一半 + 容器尺寸的一半（考虑缩放）
    const maxPanX = canvasWidth / 2 + containerWidth / (2 * totalScale);
    const maxPanY = canvasHeight / 2 + containerHeight / (2 * totalScale);
    
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, y)),
    };
  },
  [canvasWidth, canvasHeight, containerWidth, containerHeight, containerScale]
);
```

#### 2.2.3 滚轮缩放实现 - 向光标位置缩放

**核心技术**: 保持光标下的点在缩放过程中静止

```tsx
useEffect(() => {
  const el = viewportRef.current;
  if (!el) return;

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (elements.length === 0) return;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

    setViewZoom((prevZoom) => {
      const newZoom = Math.min(5, Math.max(0.2, prevZoom * zoomFactor));

      // 计算光标在容器中的位置
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      // 缩放差值计算
      const oldScale = containerScale * prevZoom;
      const newScale = containerScale * newZoom;
      const scaleDiff = 1 / newScale - 1 / oldScale;

      // 调整平移量以保持光标点静止
      setPanX((prevPanX) => {
        const newPanX = prevPanX + (cursorX - containerWidth / 2) * scaleDiff;
        const maxPX = canvasWidth / 2 + containerWidth / (2 * newScale);
        return Math.max(-maxPX, Math.min(maxPX, newPanX));
      });

      setPanY((prevPanY) => {
        const newPanY = prevPanY + (cursorY - containerHeight / 2) * scaleDiff;
        const maxPY = canvasHeight / 2 + containerHeight / (2 * newScale);
        return Math.max(-maxPY, Math.min(maxPY, newPanY));
      });

      return newZoom;
    });
  };

  el.addEventListener('wheel', onWheel, { passive: false });
  return () => el.removeEventListener('wheel', onWheel);
}, [elements.length, containerScale, containerWidth, containerHeight, canvasWidth, canvasHeight]);
```

#### 2.2.4 拖拽平移实现 - Pointer Events

```tsx
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  if (e.button !== 0) return; // 仅响应左键
  e.preventDefault();
  setIsPanning(true);
  panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}, [panX, panY]);

const handlePointerMove = useCallback((e: React.PointerEvent) => {
  if (!isPanning) return;

  const dx = e.clientX - panStartRef.current.x;
  const dy = e.clientY - panStartRef.current.y;

  // 屏幕空间拖拽 → 画布空间平移（考虑containerScale和viewZoom）
  const effectiveScale = Math.max(containerScale * viewZoom, 0.001);
  const newPanX = panStartRef.current.panX + dx / effectiveScale;
  const newPanY = panStartRef.current.panY + dy / effectiveScale;

  const clamped = clampPan(newPanX, newPanY, viewZoom);
  setPanX(clamped.x);
  setPanY(clamped.y);
}, [containerScale, viewZoom, isPanning, clampPan]);
```

#### 2.2.5 变换矩阵计算

**关键公式**: 画布屏幕位置计算

```tsx
// 总缩放比例 = 容器自适应缩放 × 用户缩放
const totalScale = containerScale * viewZoom;

// 画布在屏幕上的位置（居中 + 平移偏移）
const canvasScreenX = (containerWidth - canvasWidth * totalScale) / 2 + panX * totalScale;
const canvasScreenY = (containerHeight - canvasHeight * totalScale) / 2 + panY * totalScale;

// CSS变换字符串
const canvasTransform = `translate(${canvasScreenX}px, ${canvasScreenY}px) scale(${totalScale})`;
```

### 2.3 AnimatedElement - 元素动画系统

**文件位置**: `components/whiteboard/whiteboard-canvas.tsx:36-94`

#### 2.3.1 入场动画

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.92, y: 8, filter: 'blur(4px)' }}
  animate={{
    opacity: 1,
    scale: 1,
    y: 0,
    rotate: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1], // ease-out曲线
      delay: index * 0.05,     // 级联延迟
    },
  }}
>
  <ScreenElement elementInfo={element} elementIndex={index} animate />
</motion.div>
```

#### 2.3.2 清除动画 - 级联旋转飞出

```tsx
const clearDelay = (totalElements - 1 - index) * 0.055; // 逆序延迟
const clearRotate = (index % 2 === 0 ? 1 : -1) * (2 + index * 0.4); // 交替旋转角度

animate={{
  opacity: 0,
  scale: 0.35,
  y: -35,
  rotate: clearRotate,
  filter: 'blur(8px)',
  transition: {
    duration: 0.38,
    delay: clearDelay,
    ease: [0.5, 0, 1, 0.6],
  },
}}
```

### 2.4 白板元素类型系统

**文件位置**: `lib/types/action.ts:48-181`

#### 2.4.1 Action类型定义

| Action类型 | 用途 | 关键参数 |
|-----------|------|----------|
| `WbOpenAction` | 打开白板 | 无参数 |
| `WbDrawTextAction` | 绘制文本 | content, x, y, fontSize, color |
| `WbDrawShapeAction` | 绘制形状 | shape(rectangle/circle/triangle), x, y, width, height, fillColor |
| `WbDrawChartAction` | 绘制图表 | chartType, data, themeColors |
| `WbDrawLatexAction` | 绘制公式 | latex, color |
| `WbDrawTableAction` | 绘制表格 | data (二维字符串数组) |
| `WbDrawLineAction` | 绘制线条/箭头 | startX, startY, endX, endY, style, points |
| `WbClearAction` | 清空白板 | 无参数 |
| `WbDeleteAction` | 删除元素 | elementId |
| `WbCloseAction` | 关闭白板 | 无参数 |

#### 2.4.2 形状路径定义

**文件位置**: `lib/action/engine.ts:40-44`

```typescript
const SHAPE_PATHS: Record<string, string> = {
  rectangle: 'M 0 0 L 1000 0 L 1000 1000 L 0 1000 Z',
  circle: 'M 500 0 A 500 500 0 1 1 499 0 Z',
  triangle: 'M 500 0 L 1000 1000 L 0 1000 Z',
};
```

**坐标系**: viewBox [1000, 1000]，SVG路径在此坐标系定义后缩放适配实际尺寸。

### 2.5 白板API系统

**文件位置**: `lib/api/stage-api-whiteboard.ts`

#### 2.5.1 工厂函数模式

```typescript
export function createWhiteboardAPI(store: StageStore) {
  const whiteboardAPI = {
    // CRUD操作
    create(): APIResult<Whiteboard>;
    get(): APIResult<Whiteboard>;
    update(updates: Partial<Whiteboard>, whiteboardId: string): APIResult<boolean>;
    delete(whiteboardId: string): APIResult<boolean>;
    list(): APIResult<Whiteboard[]>;

    // 元素操作
    getElement(elementId: string, whiteboardId: string): APIResult<PPTElement>;
    addElement(element: PPTElement, whiteboardId: string): APIResult<boolean>;
    deleteElement(elementId: string, whiteboardId: string): APIResult<boolean>;
    updateElement(element: PPTElement, whiteboardId: string): APIResult<boolean>;
    listElements(whiteboardId: string): APIResult<PPTElement[]>;
  };

  return whiteboardAPI;
}
```

#### 2.5.2 白板数据结构

**文件位置**: `lib/types/stage.ts:10`

```typescript
export type Whiteboard = Omit<Slide, 'theme' | 'turningMode' | 'sectionTag' | 'type'>;

// 实际结构
interface Whiteboard {
  id: string;
  viewportSize: number;      // 默认1000
  viewportRatio: number;     // 默认0.5625 (16:9)
  elements: PPTElement[];    // 元素列表
  background: { type: string; color: string };
  animations: Animation[];   // 动画配置
}
```

### 2.6 ActionEngine白板动作执行

**文件位置**: `lib/action/engine.ts:280-420`

#### 2.6.1 文本绘制实现

```typescript
private async executeWbDrawText(action: WbDrawTextAction): Promise<void> {
  const wb = this.stageAPI.whiteboard.get();
  if (!wb.success || !wb.data) return;

  const fontSize = action.fontSize ?? 18;
  let htmlContent = action.content ?? '';
  
  // 自动包装：纯文本转为HTML段落
  if (!htmlContent.startsWith('<')) {
    htmlContent = `<p style="font-size: ${fontSize}px;">${htmlContent}</p>`;
  }

  this.stageAPI.whiteboard.addElement({
    id: action.elementId || '',
    type: 'text',
    content: htmlContent,
    left: action.x,
    top: action.y,
    width: action.width ?? 400,
    height: action.height ?? 100,
    rotate: 0,
    defaultFontName: 'Microsoft YaHei',
    defaultColor: action.color ?? '#333333',
  }, wb.data.id);

  await delay(800); // 等待入场动画完成
}
```

#### 2.6.2 LaTeX公式渲染

**关键技术**: KaTeX即时渲染

```typescript
private async executeWbDrawLatex(action: WbDrawLatexAction): Promise<void> {
  const wb = this.stageAPI.whiteboard.get();
  if (!wb.success || !wb.data) return;

  try {
    // KaTeX渲染为HTML
    const html = katex.renderToString(action.latex, {
      throwOnError: false,
      displayMode: true,
      output: 'html',
    });

    this.stageAPI.whiteboard.addElement({
      id: action.elementId || '',
      type: 'latex',
      left: action.x,
      top: action.y,
      width: action.width ?? 400,
      height: action.height ?? 80,
      rotate: 0,
      latex: action.latex,
      html,        // 渲染后的HTML
      color: action.color ?? '#000000',
      fixedRatio: true,  // 保持公式比例
    }, wb.data.id);
  } catch (err) {
    log.warn(`Failed to render latex "${action.latex}":`, err);
    return;
  }

  await delay(800);
}
```

### 2.7 白板历史快照系统

**文件位置**: `lib/store/whiteboard-history.ts`

#### 2.7.1 快照存储结构

```typescript
interface WhiteboardHistoryState {
  snapshots: {
    id: string;
    timestamp: number;
    elements: PPTElement[];    // 元素状态快照
  }[];
  currentIndex: number;
}
```

#### 2.7.2 快照操作

```typescript
// 推送快照（清除前保存）
pushSnapshot(elements: PPTElement[]): void;

// 恢复快照
restoreSnapshot(id: string): PPTElement[];

// 清空历史
clearHistory(): void;
```

---

## 三、幻灯片渲染系统 (Slide)

### 3.1 Scene类型路由

**文件位置**: `components/stage/scene-renderer.tsx`

```tsx
export function SceneRenderer({ scene, mode }: SceneRendererProps) {
  return useMemo(() => {
    switch (scene.type) {
      case 'slide':
        return <SlideRenderer mode={mode} />;
      case 'quiz':
        return <QuizView questions={scene.content.questions} />;
      case 'interactive':
        return <InteractiveRenderer content={scene.content} />;
      case 'pbl':
        return <PBLRenderer content={scene.content} mode={mode} />;
      default:
        return <div>Unknown scene type</div>;
    }
  }, [scene, mode]);
}
```

### 3.2 SlideRenderer双模式

**文件位置**: `components/slide-renderer/Editor/index.tsx`

| 模式 | 组件 | 特性 |
|------|------|------|
| `autonomous` | Canvas | 编辑模式，支持交互操作 |
| 其他 | ScreenCanvas | 演示模式，只读 + 视觉特效 |

### 3.3 ScreenCanvas视觉层次

**文件位置**: `components/slide-renderer/Editor/ScreenCanvas.tsx`

```tsx
<div className="relative h-full w-full overflow-hidden">
  {/* 背景层 - 应用背景样式 */}
  <div style={backgroundStyle} />
  
  {/* 内容层 - 缩放适配 */}
  <div style={{ transform: `scale(${canvasScale})` }}>
    {elements.map((element) => (
      <ScreenElement key={element.id} elementInfo={element} />
    ))}
    <HighlightOverlay /> {/* 高亮叠加层 */}
  </div>
  
  {/* 聚光灯层 - SVG遮罩全屏覆盖 */}
  <SpotlightOverlay />
  
  {/* 激光笔层 - 百分比坐标定位 */}
  <div style={{ padding: '5%' }}>
    <LaserOverlay />
  </div>
</div>
```

### 3.4 元素类型映射表

**文件位置**: `components/slide-renderer/Editor/ScreenElement.tsx`

```typescript
const elementTypeMap = {
  image:   BaseImageElement,
  text:    BaseTextElement,
  shape:   BaseShapeElement,
  line:    BaseLineElement,    // 支持笔画动画
  chart:   BaseChartElement,
  latex:   BaseLatexElement,
  table:   BaseTableElement,
  video:   BaseVideoElement,
  code:    BaseCodeElement,
};
```

---

## 四、语音合成系统 (TTS)

### 4.1 SpeechAction类型定义

**文件位置**: `lib/types/action.ts:39-46`

```typescript
export interface SpeechAction extends ActionBase {
  type: 'speech';
  text: string;           // 讲解文本内容
  audioId?: string;       // 预生成音频ID
  audioUrl?: string;      // 服务端生成的音频URL
  voice?: string;         // 语音ID
  speed?: number;         // 语速 (默认 1.0)
}
```

### 4.2 TTS多提供者架构

**文件位置**: `lib/audio/tts-providers.ts`

#### 4.2.1 工厂模式路由

```typescript
export async function generateTTS(
  config: TTSModelConfig,
  text: string,
): Promise<TTSGenerationResult> {
  const provider = TTS_PROVIDERS[config.providerId];
  if (!provider) {
    throw new Error(`Unknown TTS provider: ${config.providerId}`);
  }

  // API Key验证
  if (provider.requiresApiKey && !config.apiKey) {
    throw new Error(`API key required for TTS provider: ${config.providerId}`);
  }

  // 提供者路由
  switch (config.providerId) {
    case 'openai-tts':
      return await generateOpenAITTS(config, text);
    case 'azure-tts':
      return await generateAzureTTS(config, text);
    case 'glm-tts':
      return await generateGLMTTS(config, text);
    case 'qwen-tts':
      return await generateQwenTTS(config, text);
    case 'minimax-tts':
      return await generateMiniMaxTTS(config, text);
    case 'doubao-tts':
      return await generateDoubaoTTS(config, text);
    case 'elevenlabs-tts':
      return await generateElevenLabsTTS(config, text);
    default:
      throw new Error(`Unsupported TTS provider: ${config.providerId}`);
  }
}
```

#### 4.2.2 提供者配置表

| 提供者 | API端点 | 默认模型 | 特点 |
|--------|---------|----------|------|
| OpenAI TTS | `api.openai.com/v1/audio/speech` | `gpt-4o-mini-tts` | 高质量多语言 |
| Azure TTS | `{region}.tts.speech.microsoft.com` | - | SSML标记支持 |
| GLM TTS | `open.bigmodel.cn/api/paas/v4` | `glm-tts` | 智谱清言中文优化 |
| Qwen TTS | `dashscope.aliyuncs.com/api/v1` | `qwen3-tts-flash` | 阿里云百炼 |
| MiniMax TTS | `api.minimaxi.com/v1/t2a_v2` | `speech-2.8-hd` | 多中文音色 |
| Doubao TTS | `openspeech.bytedance.com/api/v3/tts` | - | 火山引擎 |
| ElevenLabs TTS | `api.elevenlabs.io/v1` | `eleven_multilingual_v2` | 国际高质量 |
| VoxCPM2 | `http://127.0.0.1:8000` | - | 本地开源部署 |
| Browser Native | Web Speech API | - | 客户端免费 |

#### 4.2.3 Azure TTS实现示例

**关键技术**: SSML标记 + 语速映射

```typescript
async function generateAzureTTS(
  config: TTSModelConfig,
  text: string,
): Promise<TTSGenerationResult> {
  const baseUrl = config.baseUrl || TTS_PROVIDERS['azure-tts'].defaultBaseUrl;

  // 语速百分比转换 (1.0 → 0%, 1.5 → 50%)
  const rate = config.speed ? `${((config.speed - 1) * 100).toFixed(0)}%` : '0%';
  
  // SSML包装
  const ssml = `
    <speak version='1.0' xml:lang='zh-CN'>
      <voice xml:lang='zh-CN' name='${config.voice}'>
        <prosody rate='${rate}'>${escapeXml(text)}</prosody>
      </voice>
    </speak>
  `.trim();

  const response = await fetch(`${baseUrl}/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': config.apiKey!,
      'Content-Type': 'application/ssml+xml; charset=utf-8',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
    },
    body: ssml,
  });

  if (!response.ok) {
    throw new Error(`Azure TTS API error: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    audio: new Uint8Array(arrayBuffer),
    format: 'mp3',
  };
}
```

### 4.3 PlaybackEngine状态机

**文件位置**: `lib/playback/engine.ts`

#### 4.3.1 状态流转

```
            start()                  pause()
  idle ────────────────→ playing ─────────────→ paused
    ↑                        ↑                      │
    │                        │  resume()            │
    │                        └──────────────────────┘
    │
    │  handleEndDiscussion()
    └──────────────────────────────────────────────
```

#### 4.3.2 语音执行流程

```typescript
async processNext(): Promise<void> {
  const action = this.actions[this.actionIndex];
  
  if (action.type === 'speech') {
    // 优先使用预生成音频
    if (action.audioId || action.audioUrl) {
      await this.audioPlayer.play(action.audioId, action.audioUrl);
    }
    // Browser Native TTS
    else if (this.settings.browserNativeTTS) {
      await this.playWithBrowserTTS(action.text, action.voice, action.speed);
    }
    // 阅读时间模拟
    else {
      const duration = this.calculateReadingTime(action.text);
      await delay(duration);
    }
    
    this.actionIndex++;
    queueMicrotask(() => this.processNext());
  }
}
```

#### 4.3.3 Browser TTS分句策略

**关键原因**: Chrome浏览器存在bug，超过约15秒的语音会被静默截断，`onend`回调永不触发。

```typescript
private splitIntoChunks(text: string): string[] {
  // 按句号分割（支持中英文标点）
  const chunks = text
    .split(/(?<=[.!?。！？\n])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return chunks.length > 0 ? chunks : [text];
}

private async playWithBrowserTTS(text: string, voice?: string, speed?: number): Promise<void> {
  const chunks = this.splitIntoChunks(text);
  
  for (const chunk of chunks) {
    const utterance = new SpeechSynthesisUtterance(chunk);
    if (voice) utterance.voice = speechSynthesis.getVoices().find(v => v.name === voice);
    if (speed) utterance.rate = speed;
    
    speechSynthesis.speak(utterance);
    await new Promise(resolve => utterance.onend = resolve);
  }
}
```

### 4.4 TTS配置管理

**文件位置**: `lib/audio/constants.ts`

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

## 五、激光笔系统 (Laser)

### 5.1 LaserAction类型定义

**文件位置**: `lib/types/action.ts:30-34`

```typescript
export interface LaserAction extends ActionBase {
  type: 'laser';
  elementId: string;      // 目标元素ID
  color?: string;         // 激光笔颜色（默认 '#ff0000'）
}
```

### 5.2 ActionEngine执行逻辑

**文件位置**: `lib/action/engine.ts`

```typescript
private executeLaser(action: LaserAction): void {
  // 设置激光笔状态到CanvasStore
  useCanvasStore.getState().setLaser(action.elementId, {
    color: action.color ?? '#ff0000',
  });
  
  // 安排特效清除（5秒后自动清除）
  this.scheduleEffectClear();
}
```

**特性**: Fire-and-forget（发射即忘），不阻塞后续动作执行。

### 5.3 LaserOverlay动画实现

**文件位置**: `components/slide-renderer/Editor/LaserOverlay.tsx`

#### 5.3.1 飞入动画 - 从最近角落飞入

```tsx
export function LaserOverlay({ geometry, color = '#ff3b30' }: LaserOverlayProps) {
  const { centerX, centerY } = geometry;

  // 确定飞入起点（从目标位置对角的角落飞入）
  const startPos = {
    x: centerX > 50 ? 105 : -5,  // 目标在右侧 → 从左侧飞入
    y: centerY > 50 ? 105 : -5,  // 目标在底部 → 从顶部飞入
  };

  return (
    <motion.div
      key={`laser-${centerX}-${centerY}`}
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
      exit={{
        opacity: 0,
        left: `${startPos.x}%`,
        top: `${startPos.y}%`,
        transition: { duration: 0.25, ease: [0.4, 0, 1, 1] },
      }}
      transition={{
        left: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
        top: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.15 },
      }}
    >
      {/* 环形脉冲动画 */}
      <motion.div
        animate={{ scale: [1, 2.8], opacity: [0.6, 0] }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: 'easeOut',
          repeatDelay: 0.3,
        }}
        style={{ border: `1.5px solid ${color}` }}
      />
      
      {/* 光点核心 */}
      <div style={{
        backgroundColor: color,
        boxShadow: `0 0 8px 2px ${color}60`,
      }} />
    </motion.div>
  );
}
```

#### 5.3.2 动画参数详解

| 动画阶段 | 持续时间 | 缓动曲线 | 特点 |
|---------|---------|----------|------|
| 飞入动画 | 500ms | `[0.22, 1, 0.36, 1]` | ease-out曲线，平滑减速 |
| 退出动画 | 250ms | `[0.4, 0, 1, 1]` | 快速退出 |
| 脉冲动画 | 1500ms | `easeOut` | 无限循环，scale 1→2.8 |

### 5.4 百分比坐标系统

**文件位置**: `lib/types/action.ts:214-221`

```typescript
export interface PercentageGeometry {
  x: number;       // 左边界 (0-100)
  y: number;       // 上边界 (0-100)
  w: number;       // 宽度 (0-100)
  h: number;       // 高度 (0-100)
  centerX: number; // 中心X (0-100)
  centerY: number; // 中心Y (0-100)
}
```

**优势**: 百分比坐标确保响应式布局，在不同屏幕尺寸下保持相对位置一致。

---

## 六、数据流时序图

### 6.1 白板绘制流程

```
AI Agent                 ActionEngine              StageAPI              CanvasStore
   │                          │                         │                     │
   │  WbDrawTextAction        │                         │                     │
   │─────────────────────────>│                         │                     │
   │                          │                         │                     │
   │                          │  whiteboard.get()       │                     │
   │                          │────────────────────────>│                     │
   │                          │                         │                     │
   │                          │  whiteboard.addElement()│                     │
   │                          │────────────────────────>│                     │
   │                          │                         │                     │
   │                          │                         │  setState(更新元素) │
   │                          │                         │────────────────────>│
   │                          │                         │                     │
   │                          │  await delay(800)       │                     │
   │                          │  (等待入场动画)         │                     │
   │                          │                         │                     │
   │                          │  processNext()          │                     │
   │                          │  (queueMicrotask)       │                     │
```

### 6.2 语音合成流程

```
AI Agent                 PlaybackEngine            AudioPlayer           TTS Provider
   │                          │                         │                     │
   │  SpeechAction            │                         │                     │
   │─────────────────────────>│                         │                     │
   │                          │                         │                     │
   │                          │  检查audioId/audioUrl   │                     │
   │                          │                         │                     │
   │                          │  [有预生成音频]         │                     │
   │                          │  audioPlayer.play()     │                     │
   │                          │────────────────────────>│                     │
   │                          │                         │                     │
   │                          │  [无预生成音频]         │                     │
   │                          │  generateTTS()          │                     │
   │                          │─────────────────────────────────────────────>│
   │                          │                         │                     │
   │                          │                         │   返回音频数据      │
   │                          │<─────────────────────────────────────────────│
   │                          │                         │                     │
   │                          │  audioPlayer.play()     │                     │
   │                          │────────────────────────>│                     │
   │                          │                         │                     │
   │                          │  onEnded callback       │                     │
   │                          │<────────────────────────│                     │
   │                          │                         │                     │
   │                          │  processNext()          │                     │
```

---

## 七、关键文件索引

### 7.1 白板模块

| 功能 | 核心文件 |
|------|----------|
| 白板画布容器 | `components/whiteboard/whiteboard-canvas.tsx` |
| 白板交互逻辑 | `components/whiteboard/whiteboard-canvas.tsx:InteractiveWhiteboardCanvas` |
| 白板主组件 | `components/whiteboard/index.tsx` |
| 白板API | `lib/api/stage-api-whiteboard.ts` |
| 白板历史快照 | `lib/store/whiteboard-history.ts` |
| 白板数据类型 | `lib/types/stage.ts:Whiteboard` |

### 7.2 幻灯片模块

| 功能 | 核心文件 |
|------|----------|
| Scene渲染路由 | `components/stage/scene-renderer.tsx` |
| ScreenCanvas | `components/slide-renderer/Editor/ScreenCanvas.tsx` |
| 元素渲染器 | `components/slide-renderer/Editor/ScreenElement.tsx` |
| Scene Context | `lib/contexts/scene-context.tsx` |

### 7.3 TTS模块

| 功能 | 核心文件 |
|------|----------|
| TTS提供者实现 | `lib/audio/tts-providers.ts` |
| TTS配置常量 | `lib/audio/constants.ts` |
| TTS类型定义 | `lib/audio/types.ts` |
| 播放引擎 | `lib/playback/engine.ts` |
| TTS API路由 | `app/api/generate/tts/route.ts` |

### 7.4 激光笔模块

| 功能 | 核心文件 |
|------|----------|
| 激光笔渲染 | `components/slide-renderer/Editor/LaserOverlay.tsx` |
| Canvas状态管理 | `lib/store/canvas.ts` |
| Action类型定义 | `lib/types/action.ts:LaserAction` |

### 7.5 动作执行模块

| 功能 | 核心文件 |
|------|----------|
| ActionEngine | `lib/action/engine.ts` |
| Action类型系统 | `lib/types/action.ts` |
| 多智能体编排 | `lib/orchestration/director-graph.ts` |

---

## 八、扩展指南

### 8.1 添加新的白板元素类型

1. **定义Action类型** (`lib/types/action.ts`)
   ```typescript
   export interface WbDrawXxxAction extends ActionBase {
     type: 'wb_draw_xxx';
     // 自定义参数
   }
   ```

2. **实现执行方法** (`lib/action/engine.ts`)
   ```typescript
   private async executeWbDrawXxx(action: WbDrawXxxAction): Promise<void> {
     this.stageAPI.whiteboard.addElement({ type: 'xxx', ... }, wb.data.id);
     await delay(800);
   }
   ```

3. **添加元素渲染器** (`components/slide-renderer/Editor/`)
   - 创建 `BaseXxxElement.tsx`
   - 在 `ScreenElement.tsx` 中添加类型映射

4. **更新Action类型联合**
   ```typescript
   export type Action = ... | WbDrawXxxAction;
   export const SYNC_ACTIONS = [..., 'wb_draw_xxx'];
   ```

### 8.2 添加新的TTS提供者

1. **添加提供者ID** (`lib/audio/types.ts`)
   ```typescript
   export type TTSProviderId = ... | 'new-provider-tts';
   ```

2. **添加配置** (`lib/audio/constants.ts`)
   ```typescript
   'new-provider-tts': {
     id: 'new-provider-tts',
     name: 'New Provider',
     requiresApiKey: true,
     defaultBaseUrl: 'https://api.newprovider.com/v1',
     voices: [...],
     supportedFormats: ['mp3'],
     speedRange: { min: 0.5, max: 2.0, default: 1.0 },
   }
   ```

3. **实现生成函数** (`lib/audio/tts-providers.ts`)
   ```typescript
   async function generateNewProviderTTS(
     config: TTSModelConfig,
     text: string,
   ): Promise<TTSGenerationResult> {
     // API调用实现
     return { audio: new Uint8Array(arrayBuffer), format: 'mp3' };
   }
   ```

4. **添加路由分支**
   ```typescript
   case 'new-provider-tts':
     return await generateNewProviderTTS(config, text);
   ```

---

## 九、注意事项与最佳实践

### 9.1 白板系统

1. **坐标系统**: 白板使用固定坐标系(1000x562.5)，通过`containerScale`和`viewZoom`双重缩放适配屏幕
2. **平移边界**: 使用Zoom-aware boundary算法，确保画布边缘始终可见
3. **缩放方向**: 滚轮缩放保持光标下的点静止，避免跳跃感
4. **动画延迟**: 元素入场有级联延迟(50ms/元素)，清除动画逆序延迟(55ms/元素)
5. **历史快照**: 清除前自动保存快照，支持撤销恢复

### 9.2 TTS系统

1. **分句播放**: Browser Native TTS必须分句，避免Chrome截断bug
2. **预生成优先**: 服务端预生成音频质量更高，优先使用`audioId/audioUrl`
3. **SSML支持**: Azure TTS使用SSML标记，支持语速、音调精细控制
4. **错误处理**: 使用`TTSRateLimitError`区分限流错误，支持重试逻辑

### 9.3 激光笔系统

1. **百分比坐标**: 使用0-100百分比坐标，确保响应式布局
2. **Fire-and-forget**: 不阻塞播放流程，使用`queueMicrotask`避免栈溢出
3. **自动清除**: 默认5秒后自动清除，防止视觉干扰累积
4. **飞入方向**: 从目标位置对角的角落飞入，增强方向感

### 9.4 Action系统

1. **同步动作**: 白板绘制、语音讲解等动作必须等待完成
2. **异步动作**: 激光笔、聚光灯等视觉特效立即执行不阻塞
3. **队列处理**: 使用`queueMicrotask`处理下一动作，避免递归栈溢出
4. **错误恢复**: 动作执行失败时记录日志并继续，保证播放流程不中断

---

## 十、性能优化建议

### 10.1 白板渲染优化

1. **虚拟化渲染**: 元素数量超过100时考虑虚拟化（仅渲染可视区域）
2. **缓存变换**: 避免重复计算`totalScale`和`canvasTransform`
3. **ResizeObserver**: 使用防抖减少频繁回调
4. **动画优化**: 使用`will-change: transform`提示GPU加速

### 10.2 TTS缓存策略

1. **音频缓存**: 预生成音频URL使用CDN分发
2. **提供者缓存**: 缓存提供者配置和语音列表
3. **分句缓存**: Browser TTS分句结果可缓存避免重复计算

### 10.3 激光笔性能

1. **动画硬件加速**: 使用`transform`而非`left/top`属性
2. **脉冲优化**: 使用CSS动画而非JS驱动减少CPU占用
3. **及时清除**: 自动清除避免DOM节点累积

---

## 十一、故障排查指南

### 11.1 白板问题

| 问题 | 可能原因 | 解决方案 |
|------|---------|----------|
| 元素不显示 | `stage.whiteboard`未初始化 | 检查`stageAPI.whiteboard.create()`调用 |
| 平移超出边界 | `clampPan`计算错误 | 验证`containerScale`和`viewZoom`值 |
| 缩放跳跃 | 光标位置计算错误 | 检查`getBoundingClientRect()`返回值 |
| 清除动画卡顿 | 元素数量过多 | 减少`delay`时间或禁用级联动画 |

### 11.2 TTS问题

| 问题 | 可能原因 | 解决方案 |
|------|---------|----------|
| 语音截断 | Chrome Browser TTS bug | 使用分句策略或服务端TTS |
| API错误 | API Key无效 | 验证`resolveTTSApiKey()`返回值 |
| 音频加载失败 | `audioUrl`过期 | 检查音频URL有效期和CDN配置 |
| 语速异常 | 百分比映射错误 | 验证Azure语速转换公式 |

### 11.3 激光笔问题

| 问题 | 可能原因 | 解决方案 |
|------|---------|----------|
| 位置偏移 | `PercentageGeometry`计算错误 | 检查`findElementGeometry()`实现 |
| 动画卡顿 | GPU未加速 | 添加`will-change: transform` |
| 元素未清除 | `scheduleEffectClear`未执行 | 验证清除定时器设置 |

---

**文档版本**: v2.0  
**最后更新**: 2026-05-04  
**适用版本**: OpenMAIC ≥ 1.0.0