# 移动端Generation Preview模块设计文档

**日期**: 2026-04-23
**目标**: 完整复刻web端generation-preview功能，提升移动端课程生成体验

---

## 1. 设计目标

### 1.1 核心目标
- 完整复刻web端generation-preview页面功能
- 提供步骤可视化动画，替代简单的进度指示器
- 实现Agent揭示动画，增强生成体验
- 支持PDF上传解析功能
- 支持网络搜索结果展示
- SSE大纲流式渲染实时可视化
- 预览第一个场景后跳转课堂页面

### 1.2 技术约束
- 使用React Native + Expo技术栈
- 动画使用`react-native-reanimated`
- PDF解析通过调用Python后端`/parse-pdf` API（generate.py:96）
- 状态管理使用zustand + MMKV持久化
- 路由使用expo-router

---

## 2. 架构设计

### 2.1 文件结构

```
packages/mobile/app/
├── generation-preview/
│   ├── index.tsx                    # 主页面
│   ├── components/
│   │   ├── step-visualizer.tsx      # 步骤可视化动画组件
│   │   ├── progress-indicator.tsx   # 顶部进度点指示器
│   │   ├── agent-reveal-modal.tsx   # Agent揭示动画Modal
│   │   ├── pdf-upload-card.tsx      # PDF上传组件（可选）
│   │   ├── web-search-results.tsx   # 网络搜索结果卡片
│   │   └── streaming-outline.tsx    # SSE大纲流式渲染
│   │   └── status-card.tsx          # 状态卡片（成功/失败/进行中）
│   └── types.ts                     # 类型定义
├── lib/
│   ├── hooks/
│   │   ├── use-generation-session.ts # session状态管理hook
│   │   ├── use-pdf-upload.ts         # PDF上传处理hook
│   │   ├── use-sse-outline.ts        # SSE大纲流式hook
│   └── api/
│   │   ├── pdf-parser.ts             # PDF解析API封装
│   │   ├── generation-api.ts         # 生成API封装
│   │   ├── web-search-api.ts         # 网络搜索API封装
│   └── constants/
│   │   └ generation-steps.ts         # 步骤常量定义
│   │   └ generation-animation.ts     # 动画配置常量
│   └── store/
│   │   └ generation-session.ts       # zustand store
```

### 2.2 核心类型定义

```typescript
// GenerationSession状态（参考web端）
export interface GenerationSessionState {
  sessionId: string;
  stageId: string;
  requirements: {
    requirement: string;
    language: 'zh-CN' | 'en-US';
    webSearch?: boolean;
    agentMode?: 'auto' | 'preset';
  };
  
  // PDF相关
  pdfFile?: { uri: string; name: string; size: number };
  pdfText?: string;
  pdfImages?: PdfImage[];
  imageStorageIds?: string[];
  
  // 网络搜索
  webSearchSources?: Array<{ title: string; url: string }>;
  researchContext?: string;
  
  // 大纲
  sceneOutlines?: SceneOutline[];
  
  // Agent
  generatedAgents?: AgentProfile[];
  selectedAgentIds?: string[];
  
  // 进度
  currentStep: GenerationStepId;
  isComplete: boolean;
  error?: string;
}

// 生成步骤（参考web端ALL_STEPS）
export type GenerationStepId = 
  | 'pdf-analysis'
  | 'web-search'
  | 'agent-generation'
  | 'outline'
  | 'slide-content'
  | 'actions';

export interface GenerationStep {
  id: GenerationStepId;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  type: 'analysis' | 'writing' | 'visual';
}
```

---

## 3. 主页面流程

### 3.1 导航流程

```
首页输入需求 → generation-preview页面 → 自动启动生成流程
  ↓
步骤可视化动画（PDF解析 → 网络搜索 → Agent生成 → 大纲 → 场景内容）
  ↓
Agent揭示Modal（等待用户点击"继续"）
  ↓
SSE大纲流式渲染（实时显示大纲条目）
  ↓
第一个场景预览 → 自动跳转classroom页面
```

### 3.2 主页面实现逻辑

**generation-preview/index.tsx核心流程**（参考web端page.tsx:131-800）：

```typescript
export default function GenerationPreviewScreen() {
  const router = useRouter();
  
  // 状态管理（参考web端）
  const session = useGenerationSessionStore();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  
  // 流式数据
  const [streamingOutlines, setStreamingOutlines] = useState<SceneOutline[]>([]);
  const [webSearchSources, setWebSearchSources] = useState<WebSearchSource[]>([]);
  const [generatedAgents, setGeneratedAgents] = useState<AgentProfile[]>([]);
  
  // Agent揭示控制
  const [showAgentReveal, setShowAgentReveal] = useState(false);
  const agentRevealResolveRef = useRef<(() => void) | null>(null);
  
  // AbortController（参考web端）
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 从路由参数或MMKV加载session
  useEffect(() => {
    const params = router.getParams();
    if (params.session) {
      session.loadFromJson(params.session);
    }
  }, []);
  
  // 自动启动生成（参考web端useEffect:122-128）
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (session.state && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startGenerationFlow();
    }
  }, [session.state]);
  
  // 核心生成流程（参考web端startGeneration:131-800）
  const startGenerationFlow = async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;
    
    try {
      // 1. PDF解析（如果有）
      if (session.state.pdfFile) {
        setCurrentStepIndex(STEPS.findIndex(s => s.id === 'pdf-analysis'));
        await parsePdfStep(signal);
      }
      
      // 2. 网络搜索（如果启用）
      if (session.state.requirements.webSearch) {
        setCurrentStepIndex(STEPS.findIndex(s => s.id === 'web-search'));
        await webSearchStep(signal);
      }
      
      // 3. Agent生成（参考web端:357-521）
      const agentStepIdx = STEPS.findIndex(s => s.id === 'agent-generation');
      setCurrentStepIndex(agentStepIdx);
      
      const agents = await generateAgentsWithApi(signal);
      setGeneratedAgents(agents);
      
      // Agent揭示动画（等待用户确认）
      setShowAgentReveal(true);
      await new Promise<void>(resolve => {
        agentRevealResolveRef.current = resolve;
      });
      
      // 4. SSE大纲生成（参考web端:524-623）
      const outlineStepIdx = STEPS.findIndex(s => s.id === 'outline');
      setCurrentStepIndex(outlineStepIdx);
      
      await streamOutlineGeneration(signal);
      
      // 5. 第一个场景内容生成（参考web端:625-788）
      setCurrentStepIndex(STEPS.findIndex(s => s.id === 'slide-content'));
      await generateFirstSceneContent(signal);
      
      // 6. 动作生成
      setCurrentStepIndex(STEPS.findIndex(s => s.id === 'actions'));
      await generateFirstSceneActions(signal);
      
      // 7. 完成跳转
      setIsComplete(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      router.replace(`/classroom/${session.state.stageId}`);
      
    } catch (err) {
      if (err.name === 'AbortError') return; // 正常取消
      setError(err.message);
    }
  };
  
  // 返回首页（参考web端goBackToHome:811-815）
  const goBackToHome = () => {
    abortControllerRef.current?.abort();
    session.clear();
    router.replace('/');
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {/* 返回按钮 */}
      <TouchableOpacity onPress={goBackToHome} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} />
        <Text>返回首页</Text>
      </TouchableOpacity>
      
      {/* 进度指示器（参考web端:886-900） */}
      <ProgressIndicator 
        steps={getActiveSteps(session.state)}
        currentIndex={currentStepIndex}
      />
      
      {/* 步骤可视化卡片（参考web端:905-942） */}
      <View style={styles.visualizerCard}>
        <StepVisualizer 
          stepId={getActiveSteps(session.state)[currentStepIndex]?.id}
          outlines={streamingOutlines}
          webSearchSources={webSearchSources}
          agents={generatedAgents}
        />
        
        {/* 状态文本 */}
        <StatusCard 
          step={getActiveSteps(session.state)[currentStepIndex]}
          error={error}
          isComplete={isComplete}
        />
      </View>
      
      {/* Agent揭示Modal */}
      <AgentRevealModal
        visible={showAgentReveal}
        agents={generatedAgents}
        onClose={() => {
          setShowAgentReveal(false);
          agentRevealResolveRef.current?.();
        }}
      />
      
      {/* 错误重试按钮 */}
      {error && (
        <TouchableOpacity onPress={retryGeneration} style={styles.retryButton}>
          <Text>返回重试</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
```

---

## 4. 核心组件设计

### 4.1 StepVisualizer - 步骤可视化

**参考web端visualizers.tsx:21-761**，使用react-native-reanimated实现：

```typescript
export function StepVisualizer({ stepId, outlines, webSearchSources, agents }) {
  switch (stepId) {
    case 'pdf-analysis':
      return <PdfScanVisualizer />;
    case 'web-search':
      return <WebSearchVisualizer sources={webSearchSources} />;
    case 'agent-generation':
      return <AgentGenerationVisualizer />;
    case 'outline':
      return <StreamingOutlineVisualizer outlines={outlines} />;
    case 'slide-content':
      return <ContentVisualizer />;
    case 'actions':
      return <ActionsVisualizer />;
    default:
      return null;
  }
}

// PDF扫描动画（参考web端:48-84）
function PdfScanVisualizer() {
  const scanLineY = useSharedValue(5);
  
  useEffect(() => {
    scanLineY.value = withRepeat(
      withTiming(90, { duration: 2500, easing: EASE_IN_OUT }),
      -1,
      true
    );
  }, []);
  
  return (
    <View style={styles.pdfContainer}>
      {/* 文档卡片 */}
      <View style={styles.pdfDocument}>
        {/* 文本行骨架 */}
        {[80, 60, 90, 45, 70].map((w, i) => (
          <SkeletonLine key={i} width={w} delay={i * 200} />
        ))}
        
        {/* 扫描激光线 */}
        <Animated.View 
          style={[
            styles.scanLine,
            { top: scanLineY }
          ]}
        />
      </View>
      
      {/* 扫描图标 */}
      <AnimatedIcon icon="scan" />
    </View>
  );
}

// 网络搜索可视化（参考web端:88-239）
function WebSearchVisualizer({ sources }) {
  const activeResultIndex = useSharedValue(0);
  
  useEffect(() => {
    if (sources.length > 0) {
      activeResultIndex.value = withRepeat(
        withTiming(Math.min(sources.length - 1, 3), { duration: 1400 }),
        -1,
        true
      );
    }
  }, [sources.length]);
  
  return (
    <View style={styles.searchContainer}>
      {/* 搜索卡片 */}
      <View style={styles.searchCard}>
        {/* 搜索栏 */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={14} color="#14b8a6" />
          <SkeletonLine width={70} />
        </View>
        
        {/* 搜索结果列表 */}
        <View style={styles.resultsList}>
          {sources.length === 0 ? (
            // 骨架屏
            skeletonResults.map((item, i) => (
              <SkeletonResult key={i} {...item} delay={i * 150} />
            ))
          ) : (
            // 实际结果
            sources.slice(0, 4).map((source, i) => (
              <AnimatedResult 
                key={source.url}
                source={source}
                isActive={i === Math.round(activeResultIndex.value)}
              />
            ))
          )}
        </View>
        
        {/* 扫描光束 */}
        <ScanningBeam />
      </View>
      
      {/* 来源数量徽章 */}
      {sources.length > 0 && (
        <Badge count={sources.length} />
      )}
    </View>
  );
}

// SSE大纲流式可视化（参考web端:242-296）
function StreamingOutlineVisualizer({ outlines }) {
  return (
    <View style={styles.outlineContainer}>
      {/* 大纲卡片 */}
      <View style={styles.outlineCard}>
        {/* 标题骨架 */}
        <SkeletonLine width={33} />
        
        {/* 大纲条目 */}
        {outlines.length === 0 ? (
          // 等待骨架
          skeletonLines.map((w, i) => (
            <SkeletonLine key={i} width={w} delay={i * 200} />
          ))
        ) : (
          // 流式大纲条目
          outlines.map((outline, i) => (
            <AnimatedOutlineItem key={outline.id} outline={outline} index={i} />
          ))
        )}
        
        {/* 加载指示点 */}
        {outlines.length > 0 && (
          <AnimatedDot />
        )}
      </View>
    </View>
  );
}

// 动作时间轴可视化（参考web端:628-761）
function ActionsVisualizer() {
  const activeIndex = useSharedValue(0);
  
  useEffect(() => {
    activeIndex.value = withRepeat(
      withTiming(ACTION_ITEMS.length - 1, { duration: 1600 }),
      -1,
      true
    );
  }, []);
  
  return (
    <View style={styles.actionsContainer}>
      {/* 时间轴卡片 */}
      <View style={styles.timelineCard}>
        {/* 动作条目 */}
        {ACTION_ITEMS.map((item, i) => (
          <AnimatedActionItem 
            key={i}
            item={item}
            isActive={i === Math.round(activeIndex.value)}
          />
        ))}
        
        {/* 滑动高亮 */}
        <AnimatedHighlight activeIndex={activeIndex} />
      </View>
    </View>
  );
}
```

### 4.2 AgentRevealModal - Agent揭示动画

**参考web端agent-reveal-modal.tsx**，使用Reanimated实现3D翻转：

```typescript
export function AgentRevealModal({ visible, agents, onClose }) {
  const [revealedCount, setRevealedCount] = useState(0);
  const allRevealed = revealedCount >= agents.length;
  
  // 卡片翻转动画
  useEffect(() => {
    if (!visible) return;
    
    let count = 0;
    const startTimeout = setTimeout(() => {
      count = 1;
      setRevealedCount(1);
      
      if (agents.length <= 1) {
        setTimeout(onClose, 600);
        return;
      }
      
      const interval = setInterval(() => {
        count++;
        setRevealedCount(count);
        if (count >= agents.length) {
          clearInterval(interval);
        }
      }, 500);
      
      return () => clearInterval(interval);
    }, 400);
    
    return () => clearTimeout(startTimeout);
  }, [visible, agents.length]);
  
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        {/* 标题 */}
        <Text style={styles.modalTitle}>
          ✨ 智能体已生成
        </Text>
        
        {/* 卡片列表 */}
        <View style={styles.cardsContainer}>
          {agents.map((agent, index) => (
            <AgentCard 
              key={agent.id}
              agent={agent}
              isRevealed={index < revealedCount}
            />
          ))}
        </View>
        
        {/* 进度点 */}
        <View style={styles.progressDots}>
          {agents.map((_, index) => (
            <Dot 
              key={index}
              isActive={index < revealedCount}
            />
          ))}
        </View>
        
        {/* 继续按钮 */}
        {allRevealed && (
          <TouchableOpacity onPress={onClose} style={styles.continueButton}>
            <Text>继续生成</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

// Agent卡片翻转动画（参考web端:154-360）
function AgentCard({ agent, isRevealed }) {
  const rotateY = useSharedValue(180);
  
  useEffect(() => {
    if (isRevealed) {
      rotateY.value = withTiming(0, { 
        duration: 600, 
        easing: EASE_OUT_CUBIC 
      });
    }
  }, [isRevealed]);
  
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotateY.value}deg` }],
    opacity: rotateY.value < 90 ? 1 : 0,
  }));
  
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotateY.value + 180}deg` }],
    opacity: rotateY.value > 90 ? 1 : 0,
  }));
  
  return (
    <View style={styles.cardContainer}>
      {/* 前面卡片 */}
      <Animated.View style={[styles.cardFront, frontStyle]}>
        {/* 头像渐变背景 */}
        <GradientBackground color={agent.color} />
        
        {/* 头像 */}
        <AvatarCircle avatar={agent.avatar} color={agent.color} />
        
        {/* 名字和角色 */}
        <Text style={[styles.agentName, { color: agent.color }]}>
          {agent.name}
        </Text>
        <RoleBadge role={agent.role} color={agent.color} />
        
        {/* 人设描述 */}
        <Text style={styles.agentPersona}>
          {agent.persona}
        </Text>
      </Animated.View>
      
      {/* 背面卡片（神秘状态） */}
      <Animated.View style={[styles.cardBack, backStyle]}>
        <GradientBackground colors={['#6366f1', '#a855f7']} />
        <Ionicons name="sparkles" size={36} color="#c4b5fd" />
        <Text style={styles.cardBackText}>?</Text>
      </Animated.View>
    </View>
  );
}
```

### 4.3 ProgressIndicator - 进度点指示器

**参考web端:886-900**：

```typescript
export function ProgressIndicator({ steps, currentIndex }) {
  return (
    <View style={styles.progressContainer}>
      {steps.map((step, idx) => (
        <AnimatedDot 
          key={step.id}
          isActive={idx === currentIndex}
          isPast={idx < currentIndex}
        />
      ))}
    </View>
  );
}

function AnimatedDot({ isActive, isPast }) {
  const width = useSharedValue(6);
  const opacity = useSharedValue(0.5);
  
  useEffect(() => {
    if (isActive) {
      width.value = withTiming(32, { duration: 500 });
      opacity.value = withTiming(1, { duration: 500 });
    } else if (isPast) {
      width.value = withTiming(6, { duration: 500 });
      opacity.value = withTiming(0.3, { duration: 500 });
    } else {
      width.value = withTiming(6, { duration: 500 });
      opacity.value = withTiming(0.5, { duration: 500 });
    }
  }, [isActive, isPast]);
  
  const style = useAnimatedStyle(() => ({
    width: width.value,
    opacity: opacity.value,
  }));
  
  return (
    <Animated.View 
      style={[
        styles.dot,
        isActive && styles.dotActive,
        style
      ]}
    />
  );
}
```

---

## 5. API集成

### 5.1 PDF解析API

**lib/api/pdf-parser.ts**（参考web端:159-298）：

```typescript
export async function parsePdfFile(
  pdfFile: { uri: string; name: string; size: number },
  signal?: AbortSignal
): Promise<PdfParseResult> {
  // 使用expo-file-system上传文件
  const uploadResult = await FileSystem.uploadAsync(
    `${API_BASE_URL}/parse-pdf`,
    pdfFile.uri,
    {
      httpMethod: 'POST',
      fieldName: 'pdf',
      mimeType: 'application/pdf',
      uploadType: FileSystem.UploadType.MULTIPART,
    }
  );
  
  if (uploadResult.statusCode !== 200) {
    throw new Error('PDF解析失败');
  }
  
  const result = JSON.parse(uploadResult.body);
  
  // 处理截断警告（参考web端:278-294）
  const warnings = [];
  if (result.data.text.length > MAX_PDF_CONTENT_CHARS) {
    warnings.push(`PDF文本已截断至${MAX_PDF_CONTENT_CHARS}字符`);
  }
  if (result.data.images?.length > MAX_VISION_IMAGES) {
    warnings.push(`PDF图片已截断至${MAX_VISION_IMAGES}张`);
  }
  
  return {
    text: result.data.text,
    images: result.data.metadata?.pdfImages || result.data.images,
    warnings,
  };
}
```

### 5.2 Agent生成API

**lib/api/generation-api.ts**（参考web端:446-461）：

```typescript
export async function generateAgentProfiles(
  stageInfo: { name: string; description?: string },
  language: string,
  signal?: AbortSignal
): Promise<AgentProfile[]> {
  const response = await apiClient.post('/generate/agent-profiles', {
    stageInfo,
    language,
    availableAvatars: AGENT_DEFAULT_AVATARS,
    avatarDescriptions: AVATAR_DESCRIPTIONS,
    availableVoices: getAvailableVoicesForGeneration(),
  }, { signal });
  
  return response.agents;
}
```

### 5.3 SSE大纲流式API

**lib/hooks/use-sse-outline.ts**（参考web端:532-608）：

```typescript
export function useSseOutlineGeneration() {
  const [outlines, setOutlines] = useState<SceneOutline[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const startStreaming = async (
    requirements: UserRequirements,
    pdfText?: string,
    agents?: Agent[],
    signal?: AbortSignal
  ) => {
    setIsStreaming(true);
    setOutlines([]);
    
    // 使用XMLHttpRequest处理SSE（参考mobile已有实现）
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/generate/outlines-stream`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${apiClient.token}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    let collected: SceneOutline[] = [];
    
    xhr.onreadystatechange = () => {
      if (xhr.readyState >= 3) {
        const fullText = xhr.responseText;
        // 解析SSE数据（参考mobile api-client:232-348）
        const events = parseSseEvents(fullText);
        
        for (const event of events) {
          if (event.type === 'outline') {
            collected.push(event.data);
            setOutlines([...collected]);
          } else if (event.type === 'done') {
            setIsStreaming(false);
            return collected;
          }
        }
      }
    };
    
    xhr.send(JSON.stringify({
      requirement: requirements.requirement,
      language: requirements.language,
      agent_ids: agents?.map(a => a.id),
      web_search: requirements.webSearch,
    }));
    
    signal?.addEventListener('abort', () => xhr.abort());
  };
  
  return { outlines, isStreaming, startStreaming };
}
```

---

## 6. 状态管理

### 6.1 Generation Session Store

**lib/store/generation-session.ts**：

```typescript
import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

interface GenerationSessionStore {
  state: GenerationSessionState | null;
  
  loadFromJson: (json: string) => void;
  saveToStorage: () => void;
  updateState: (updates: Partial<GenerationSessionState>) => void;
  clear: () => void;
}

export const useGenerationSessionStore = create<GenerationSessionStore>((set, get) => ({
  state: null,
  
  loadFromJson: (json) => {
    try {
      const parsed = JSON.parse(json);
      set({ state: parsed });
    } catch (e) {
      console.error('Failed to parse session:', e);
    }
  },
  
  saveToStorage: () => {
    const { state } = get();
    if (state) {
      storage.set('generationSession', JSON.stringify(state));
    }
  },
  
  updateState: (updates) => {
    const { state } = get();
    if (state) {
      set({ state: { ...state, ...updates } });
      get().saveToStorage();
    }
  },
  
  clear: () => {
    set({ state: null });
    storage.delete('generationSession');
  },
}));
```

---

## 7. 动画配置

### 7.1 动画常量

**lib/constants/generation-animation.ts**：

```typescript
import { Easing } from 'react-native-reanimated';

// 扫描动画
export const SCAN_DURATION = 2500;
export const SCAN_EASING = Easing.inOut(Easing.quad);

// 翻转动画（Agent卡片）
export const FLIP_DURATION = 600;
export const FLIP_EASING = Easing.out(Easing.cubic);

// 结果高亮动画
export const HIGHLIGHT_DURATION = 1400;
export const HIGHLIGHT_SPRING = {
  stiffness: 300,
  damping: 28,
};

// 骨架闪烁
export const SKELETON_DURATION = 1200;

// 进度点动画
export const DOT_DURATION = 500;

// 大纲条目动画
export const OUTLINE_DELAY = 80; // 每个条目延迟
```

---

## 8. 错误处理

### 8.1 错误类型

```typescript
export enum GenerationErrorType {
  PDF_PARSE_FAILED = 'PDF_PARSE_FAILED',
  WEB_SEARCH_FAILED = 'WEB_SEARCH_FAILED',
  AGENT_GENERATION_FAILED = 'AGENT_GENERATION_FAILED',
  OUTLINE_GENERATION_FAILED = 'OUTLINE_GENERATION_FAILED',
  SCENE_GENERATION_FAILED = 'SCENE_GENERATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ABORTED = 'ABORTED',
}

export class GenerationError extends Error {
  type: GenerationErrorType;
  
  constructor(type: GenerationErrorType, message: string) {
    super(message);
    this.type = type;
  }
}
```

### 8.2 错误处理UI

```typescript
function ErrorCard({ error, onRetry }) {
  const errorType = classifyError(error);
  
  return (
    <View style={styles.errorCard}>
      <Ionicons 
        name={errorType === 'NETWORK_ERROR' ? 'wifi' : 'alert-circle'} 
        size={48} 
        color="#ef4444" 
      />
      <Text style={styles.errorTitle}>生成失败</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      
      <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
        <Ionicons name="refresh" size={16} />
        <Text>返回重试</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 9. 测试计划

### 9.1 单元测试

- StepVisualizer动画组件渲染测试
- AgentRevealModal翻转动画测试
- ProgressIndicator状态变化测试
- PDF解析API调用测试
- SSE大纲流式hook测试

### 9.2 集成测试

- 完整生成流程端到端测试
- 错误恢复和重试测试
- 用户取消流程测试
- 内存和性能测试

### 9.3 用户测试

- PDF上传体验测试
- Agent揭示动画用户反馈
- 步骤可视化清晰度测试
- 错误提示友好度测试

---

## 10. 实施计划

### 10.1 优先级排序

**Phase 1 - 核心框架**（1-2天）
- 主页面框架搭建
- Session状态管理
- 基础导航流程
- ProgressIndicator组件

**Phase 2 - 动画组件**（2-3天）
- StepVisualizer核心可视化
- PdfScanVisualizer扫描动画
- WebSearchVisualizer搜索结果
- StreamingOutlineVisualizer大纲流式

**Phase 3 - Agent揭示**（1-2天）
- AgentRevealModal翻转动画
- 卡片布局和样式
- 进度点指示器

**Phase 4 - API集成**（1-2天）
- PDF解析API
- Agent生成API
- SSE大纲流式API
- 网络搜索API

**Phase 5 - 集成测试**（1天）
- 端到端流程测试
- 错误处理测试
- 性能优化

### 10.2 预估工作量

- 总代码量：约1500-2000行
- 预估工期：6-8个工作日
- 测试覆盖：单元测试70%，集成测试30%

---

## 11. 与web端差异说明

### 11.1 技术差异

| 功能 | Web端实现 | 移动端实现 |
|------|----------|-----------|
| 动画库 | motion/react | react-native-reanimated |
| PDF上传 | Browser File API | expo-document-picker + FileSystem |
| 状态存储 | sessionStorage | MMKV |
| 3D翻转 | CSS preserve-3d | Reanimated rotateY transform |
| SSE处理 | fetch + ReadableStream | XMLHttpRequest |
| Modal | React Portal | React Native Modal |

### 11.2 功能简化

- **TTS语音生成**：移动端暂不自动生成（web端:714-768）
- **截断警告**：简化为Alert.alert（web端Tooltip复杂实现）
- **图像存储**：简化为直接存储base64（web端IndexedDB）

### 11.3 保留核心体验

- 步骤可视化动画完整保留
- Agent揭示翻转动画完整保留
- SSE大纲流式渲染完整保留
- 进度指示器完整保留
- 错误处理完整保留

---

## 12. 后续扩展

### 12.1 功能增强

- 添加TTS自动生成（需集成expo-av）
- 添加图片/视频自动生成
- 添加课程模板选择
- 添加历史生成记录

### 12.2 性能优化

- 动画性能优化（使用Worklet）
- 大文件PDF上传优化
- 内存管理优化
- 网络请求缓存

---

**设计完成，等待用户审核后进入implementation plan阶段。**