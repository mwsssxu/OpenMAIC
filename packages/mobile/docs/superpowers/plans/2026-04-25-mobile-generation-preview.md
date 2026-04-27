# Mobile Generation Preview Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the generation-preview page for mobile with step visualization animations, agent reveal modal, and SSE outline streaming, calling Python backend APIs.

**Architecture:** React Native page with Reanimated animations, Zustand + MMKV state management, SSE streaming via XMLHttpRequest, API calls to Python backend `/generate/*` endpoints.

**Tech Stack:** React Native + Expo, react-native-reanimated, zustand, react-native-mmkv, expo-file-system

---

## File Structure

### New Files
```
app/generation-preview/index.tsx            # Main page (entry point)
components/generation-preview/
  step-visualizer.tsx                        # Step visualization animations
  progress-indicator.tsx                     # Top progress dots
  agent-reveal-modal.tsx                     # Agent card flip modal
  status-card.tsx                            # Success/error/loading card
lib/store/
  generation-session.ts                      # Zustand + MMKV store
lib/hooks/
  use-generation-session.ts                  # Session management hook
lib/api/
  pdf-parser.ts                              # PDF upload via expo-file-system
  web-search-api.ts                          # Web search API wrapper
lib/constants/
  generation-steps.ts                        # Step definitions
  generation-animation.ts                    # Animation configs
```

### Modified Files
```
lib/api-client/index.ts                      # Add PDF parse + web search methods
lib/types/scene.ts                           # Add GenerationSession types
```

---

## Phase 1: Core Framework (Tasks 1-4)

### Task 1: Type Definitions and Constants

**Files:**
- Modify: `lib/types/scene.ts` (add types at end)
- Create: `lib/constants/generation-steps.ts`
- Create: `lib/constants/generation-animation.ts`

- [ ] **Step 1: Add GenerationSession types to scene.ts**

```typescript
// Add to lib/types/scene.ts at the end

// Generation Preview Types
export type GenerationStepId = 'pdf-analysis' | 'web-search' | 'agent-generation' | 'outline' | 'slide-content' | 'actions';

export interface GenerationStep {
  id: GenerationStepId;
  title: string;
  description: string;
  type: 'analysis' | 'writing' | 'visual';
}

export interface GenerationSessionState {
  sessionId: string;
  stageId: string;
  requirements: {
    requirement: string;
    language: 'zh-CN' | 'en-US';
    webSearch?: boolean;
    agentMode?: 'auto' | 'preset';
    userNickname?: string;
    userBio?: string;
  };
  pdfFile?: { uri: string; name: string; size: number };
  pdfText?: string;
  pdfImages?: PdfImage[];
  imageStorageIds?: string[];
  webSearchSources?: Array<{ title: string; url: string }>;
  researchContext?: string;
  sceneOutlines?: SceneOutline[];
  generatedAgents?: AgentProfile[];
  selectedAgentIds?: string[];
  currentStep: GenerationStepId;
  isComplete: boolean;
  error?: string;
}

export interface PdfImage {
  id: string;
  pageNumber: number;
  description?: string;
  width?: number;
  height?: number;
  storageId?: string;
}

export interface SceneOutline {
  id: string;
  type: 'slide' | 'quiz' | 'interactive' | 'pbl';
  title: string;
  description: string;
  key_points: string[];
  order: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  persona?: string;
  avatar?: string;
  color?: string;
  priority?: number;
  voiceConfig?: {
    providerId: string;
    voiceId: string;
  };
}
```

- [ ] **Step 2: Create generation-steps.ts constants**

```typescript
// lib/constants/generation-steps.ts

import { GenerationStep } from '@/lib/types/scene';

export const ALL_STEPS: GenerationStep[] = [
  { id: 'pdf-analysis', title: 'PDF 解析', description: '正在解析 PDF 文档...', type: 'analysis' },
  { id: 'web-search', title: '网络搜索', description: '正在搜索相关资料...', type: 'analysis' },
  { id: 'agent-generation', title: '智能体生成', description: '正在生成教学智能体...', type: 'visual' },
  { id: 'outline', title: '大纲生成', description: '正在生成课程大纲...', type: 'writing' },
  { id: 'slide-content', title: '内容生成', description: '正在生成场景内容...', type: 'writing' },
  { id: 'actions', title: '动作编排', description: '正在编排教学动作...', type: 'writing' },
];

export const getActiveSteps = (session: { requirements: { webSearch?: boolean }; pdfFile?: unknown } | null): GenerationStep[] => {
  if (!session) return ALL_STEPS.filter(s => s.id !== 'pdf-analysis' && s.id !== 'web-search');
  
  const steps: GenerationStep[] = [];
  
  if (session.pdfFile) {
    steps.push(ALL_STEPS[0]); // pdf-analysis
  }
  
  if (session.requirements?.webSearch) {
    steps.push(ALL_STEPS[1]); // web-search
  }
  
  // Always include agent-generation, outline, slide-content, actions
  steps.push(...ALL_STEPS.slice(2));
  
  return steps;
};

export const MAX_PDF_CONTENT_CHARS = 50000;
export const MAX_VISION_IMAGES = 10;
```

- [ ] **Step 3: Create generation-animation.ts constants**

```typescript
// lib/constants/generation-animation.ts

import { Easing } from 'react-native-reanimated';

// Scan animation
export const SCAN_DURATION = 2500;
export const SCAN_EASING = Easing.inOut(Easing.quad);

// Flip animation (Agent cards)
export const FLIP_DURATION = 600;
export const FLIP_EASING = Easing.out(Easing.cubic);

// Highlight animation
export const HIGHLIGHT_DURATION = 1400;

// Skeleton shimmer
export const SKELETON_DURATION = 1200;

// Progress dot
export const DOT_DURATION = 500;

// Outline item delay
export const OUTLINE_DELAY = 80;
```

- [ ] **Step 4: Commit types and constants**

```bash
git add lib/types/scene.ts lib/constants/generation-steps.ts lib/constants/generation-animation.ts
git commit -m "feat(mobile): add generation-preview types and constants"
```

---

### Task 2: Zustand + MMKV Store

**Files:**
- Create: `lib/store/generation-session.ts`

- [ ] **Step 1: Create generation-session store**

```typescript
// lib/store/generation-session.ts

import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { GenerationSessionState } from '@/lib/types/scene';

const storage = new MMKV();

interface GenerationSessionStore {
  state: GenerationSessionState | null;
  loadFromJson: (json: string) => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
  updateState: (updates: Partial<GenerationSessionState>) => void;
  setStep: (step: GenerationSessionState['currentStep']) => void;
  setError: (error: string | undefined) => void;
  setComplete: (isComplete: boolean) => void;
  clear: () => void;
}

export const useGenerationSessionStore = create<GenerationSessionStore>((set, get) => ({
  state: null,

  loadFromJson: (json: string) => {
    try {
      const parsed = JSON.parse(json) as GenerationSessionState;
      set({ state: parsed });
    } catch (e) {
      console.error('Failed to parse session:', e);
    }
  },

  loadFromStorage: () => {
    try {
      const saved = storage.getString('generationSession');
      if (saved) {
        const parsed = JSON.parse(saved) as GenerationSessionState;
        set({ state: parsed });
      }
    } catch (e) {
      console.error('Failed to load session from storage:', e);
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

  setStep: (step) => {
    get().updateState({ currentStep: step });
  },

  setError: (error) => {
    get().updateState({ error });
  },

  setComplete: (isComplete) => {
    get().updateState({ isComplete });
  },

  clear: () => {
    set({ state: null });
    storage.delete('generationSession');
  },
}));
```

- [ ] **Step 2: Commit store**

```bash
git add lib/store/generation-session.ts
git commit -m "feat(mobile): add generation-session zustand store with MMKV"
```

---

### Task 3: PDF Parser and Web Search API

**Files:**
- Modify: `lib/api-client/index.ts` (add methods at end of class before export)
- Create: `lib/api/pdf-parser.ts`

- [ ] **Step 1: Add PDF parse and web search methods to api-client**

```typescript
// Add to lib/api-client/index.ts, inside ApiClient class, before export

  // ==================== PDF Parse ====================

  async parsePdf(
    pdfUri: string,
    fileName: string,
    providerId?: string,
    apiKey?: string,
    baseUrl?: string,
  ) {
    // Use expo-file-system for upload
    const FileSystem = require('expo-file-system');
    
    const uploadResult = await FileSystem.uploadAsync(
      `${this.getBaseUrl()}/parse-pdf`,
      pdfUri,
      {
        httpMethod: 'POST',
        fieldName: 'pdf',
        mimeType: 'application/pdf',
        uploadType: FileSystem.UploadType.MULTIPART,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    if (uploadResult.statusCode !== 200) {
      const errorData = JSON.parse(uploadResult.body);
      throw new Error(errorData.error || 'PDF解析失败');
    }

    const result = JSON.parse(uploadResult.body);
    return result.data;
  }

  // ==================== Web Search ====================

  async webSearch(
    query: string,
    pdfText?: string,
    apiKey?: string,
    provider?: string,
  ) {
    const { data } = await this.client.post('/generate/web-search', {
      query,
      pdfText,
      apiKey,
      provider: provider || 'serper',
    });
    return data;
  }

  // ==================== Scene Content & Actions ====================

  async generateSceneContent(
    outline: { id: string; title: string; type: string; description?: string; order: number },
    allOutlines: any[],
    stageInfo: { name: string; description?: string; language?: string },
    stageId: string,
    agents: any[],
  ) {
    const { data } = await this.client.post('/generate/scene-content', {
      outline,
      allOutlines,
      stageInfo,
      stageId,
      agents,
    });
    return data;
  }

  async generateSceneActions(
    outline: any,
    allOutlines: any[],
    content: any,
    stageId: string,
    agents: any[],
    previousSpeeches?: string[],
    userProfile?: string,
  ) {
    const { data } = await this.client.post('/generate/scene-actions', {
      outline,
      allOutlines,
      content,
      stageId,
      agents,
      previousSpeeches,
      userProfile,
    });
    return data;
  }
```

- [ ] **Step 2: Create pdf-parser.ts wrapper**

```typescript
// lib/api/pdf-parser.ts

import { apiClient } from '@/lib/api-client';
import { MAX_PDF_CONTENT_CHARS, MAX_VISION_IMAGES } from '@/lib/constants/generation-steps';
import { PdfImage } from '@/lib/types/scene';

export interface PdfParseResult {
  text: string;
  images: PdfImage[];
  metadata?: Record<string, unknown>;
  warnings: string[];
}

export async function parsePdfFile(
  pdfUri: string,
  fileName: string,
  signal?: AbortSignal,
  providerId?: string,
  apiKey?: string,
  baseUrl?: string,
): Promise<PdfParseResult> {
  const result = await apiClient.parsePdf(pdfUri, fileName, providerId, apiKey, baseUrl);

  // Process truncation warnings
  const warnings: string[] = [];
  if (result.text?.length > MAX_PDF_CONTENT_CHARS) {
    warnings.push(`PDF文本已截断至${MAX_PDF_CONTENT_CHARS}字符`);
  }
  if (result.images?.length > MAX_VISION_IMAGES) {
    warnings.push(`PDF图片已截断至${MAX_VISION_IMAGES}张`);
  }

  // Normalize images
  const images: PdfImage[] = result.metadata?.pdfImages
    ? result.metadata.pdfImages.map((img: any) => ({
        id: img.id,
        pageNumber: img.pageNumber || 1,
        description: img.description,
        width: img.width,
        height: img.height,
      }))
    : result.images?.map((src: string, i: number) => ({
        id: `img_${i + 1}`,
        pageNumber: 1,
      })) || [];

  return {
    text: result.text?.substring(0, MAX_PDF_CONTENT_CHARS) || '',
    images: images.slice(0, MAX_VISION_IMAGES),
    metadata: result.metadata,
    warnings,
  };
}
```

- [ ] **Step 3: Commit API additions**

```bash
git add lib/api-client/index.ts lib/api/pdf-parser.ts
git commit -m "feat(mobile): add PDF parse and web search API methods"
```

---

### Task 4: Progress Indicator Component

**Files:**
- Create: `components/generation-preview/progress-indicator.tsx`

- [ ] **Step 1: Create progress-indicator component**

```typescript
// components/generation-preview/progress-indicator.tsx

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { GenerationStep } from '@/lib/types/scene';
import { DOT_DURATION } from '@/lib/constants/generation-animation';

interface ProgressIndicatorProps {
  steps: GenerationStep[];
  currentIndex: number;
}

function AnimatedDot({ isActive, isPast }: { isActive: boolean; isPast: boolean }) {
  const width = useSharedValue(6);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (isActive) {
      width.value = withTiming(32, { duration: DOT_DURATION, easing: Easing.out(Easing.cubic) });
      opacity.value = withTiming(1, { duration: DOT_DURATION });
    } else if (isPast) {
      width.value = withTiming(6, { duration: DOT_DURATION });
      opacity.value = withTiming(0.3, { duration: DOT_DURATION });
    } else {
      width.value = withTiming(6, { duration: DOT_DURATION });
      opacity.value = withTiming(0.5, { duration: DOT_DURATION });
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
        style,
      ]}
    />
  );
}

export function ProgressIndicator({ steps, currentIndex }: ProgressIndicatorProps) {
  return (
    <View style={styles.container}>
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
  },
  dotActive: {
    backgroundColor: '#3b82f6',
  },
});
```

- [ ] **Step 2: Commit progress indicator**

```bash
git add components/generation-preview/progress-indicator.tsx
git commit -m "feat(mobile): add animated progress indicator for generation-preview"
```

---

## Phase 2: Animation Components (Tasks 5-7)

### Task 5: Step Visualizer Components

**Files:**
- Create: `components/generation-preview/step-visualizer.tsx`

- [ ] **Step 1: Create step-visualizer with skeleton animations**

```typescript
// components/generation-preview/step-visualizer.tsx

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SceneOutline, GenerationStepId } from '@/lib/types/scene';
import { SCAN_DURATION, SKELETON_DURATION, HIGHLIGHT_DURATION } from '@/lib/constants/generation-animation';

interface StepVisualizerProps {
  stepId: GenerationStepId;
  outlines?: SceneOutline[];
  webSearchSources?: Array<{ title: string; url: string }>;
}

// Skeleton line animation
function SkeletonLine({ width: widthPercent, delay = 0 }: { width: number; delay?: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: SKELETON_DURATION / 2 }),
          withTiming(0.3, { duration: SKELETON_DURATION / 2 })
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeletonLine,
        { width: `${widthPercent}%` },
        style,
      ]}
    />
  );
}

// PDF Scan Animation
function PdfScanVisualizer() {
  const scanLineY = useSharedValue(5);

  useEffect(() => {
    scanLineY.value = withRepeat(
      withTiming(90, { duration: SCAN_DURATION, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    top: `${scanLineY.value}%`,
  }));

  return (
    <View style={styles.pdfContainer}>
      <View style={styles.pdfDocument}>
        {[80, 60, 90, 45, 70].map((w, i) => (
          <SkeletonLine key={i} width={w} delay={i * 200} />
        ))}
        <Animated.View style={[styles.scanLine, scanLineStyle]} />
      </View>
      <Ionicons name="document-text" size={32} color="#3b82f6" />
    </View>
  );
}

// Web Search Animation
function WebSearchVisualizer({ sources }: { sources?: Array<{ title: string; url: string }> }) {
  const activeIndex = useSharedValue(0);

  useEffect(() => {
    activeIndex.value = withRepeat(
      withTiming(3, { duration: HIGHLIGHT_DURATION }),
      -1,
      true
    );
  }, []);

  const hasResults = sources && sources.length > 0;

  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchCard}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={14} color="#14b8a6" />
          <SkeletonLine width={70} />
        </View>
        <View style={styles.resultsList}>
          {hasResults ? (
            sources.slice(0, 4).map((source, i) => (
              <View key={source.url} style={styles.resultItem}>
                <Text style={styles.resultTitle} numberOfLines={1}>
                  {source.title}
                </Text>
              </View>
            ))
          ) : (
            [85, 70, 60, 50].map((w, i) => (
              <SkeletonLine key={i} width={w} delay={i * 150} />
            ))
          )}
        </View>
      </View>
      {hasResults && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{sources.length}</Text>
        </View>
      )}
    </View>
  );
}

// Agent Generation Animation
function AgentGenerationVisualizer() {
  return (
    <View style={styles.agentContainer}>
      <Ionicons name="people" size={48} color="#8b5cf6" />
      <View style={styles.agentLines}>
        {[60, 50, 40].map((w, i) => (
          <SkeletonLine key={i} width={w} delay={i * 300} />
        ))}
      </View>
    </View>
  );
}

// Outline Streaming Animation
function StreamingOutlineVisualizer({ outlines }: { outlines?: SceneOutline[] }) {
  const hasOutlines = outlines && outlines.length > 0;

  return (
    <View style={styles.outlineContainer}>
      <View style={styles.outlineCard}>
        <SkeletonLine width={33} />
        {hasOutlines ? (
          outlines.map((outline, i) => (
            <View key={outline.id} style={styles.outlineItem}>
              <Text style={styles.outlineNumber}>{i + 1}</Text>
              <Text style={styles.outlineTitle} numberOfLines={1}>
                {outline.title}
              </Text>
            </View>
          ))
        ) : (
          [80, 65, 70, 55, 60].map((w, i) => (
            <SkeletonLine key={i} width={w} delay={i * 200} />
          ))
        )}
      </View>
    </View>
  );
}

// Content Generation Animation
function ContentVisualizer() {
  return (
    <View style={styles.contentContainer}>
      <Ionicons name="create" size={32} color="#f59e0b" />
      <View style={styles.contentLines}>
        {[90, 75, 80, 60].map((w, i) => (
          <SkeletonLine key={i} width={w} delay={i * 150} />
        ))}
      </View>
    </View>
  );
}

// Actions Animation
function ActionsVisualizer() {
  return (
    <View style={styles.actionsContainer}>
      <Ionicons name="git-branch" size={32} color="#10b981" />
      <View style={styles.actionLines}>
        {[70, 60, 50, 55].map((w, i) => (
          <SkeletonLine key={i} width={w} delay={i * 200} />
        ))}
      </View>
    </View>
  );
}

export function StepVisualizer({ stepId, outlines, webSearchSources }: StepVisualizerProps) {
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

const styles = StyleSheet.create({
  // Skeleton
  skeletonLine: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 8,
  },
  // PDF
  pdfContainer: {
    width: 192,
    height: 192,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfDocument: {
    width: 120,
    height: 140,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    position: 'relative',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#3b82f6',
    opacity: 0.8,
  },
  // Search
  searchContainer: {
    width: 192,
    height: 192,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchCard: {
    width: 160,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resultsList: {
    gap: 6,
  },
  resultItem: {
    paddingVertical: 4,
  },
  resultTitle: {
    fontSize: 12,
    color: '#1e40af',
  },
  badge: {
    backgroundColor: '#14b8a6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Agent
  agentContainer: {
    width: 192,
    height: 192,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  agentLines: {
    width: 100,
  },
  // Outline
  outlineContainer: {
    width: 192,
    height: 192,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineCard: {
    width: 160,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 12,
  },
  outlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  outlineNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  outlineTitle: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  // Content
  contentContainer: {
    width: 192,
    height: 192,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  contentLines: {
    width: 140,
  },
  // Actions
  actionsContainer: {
    width: 192,
    height: 192,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  actionLines: {
    width: 120,
  },
});
```

- [ ] **Step 2: Commit step visualizer**

```bash
git add components/generation-preview/step-visualizer.tsx
git commit -m "feat(mobile): add animated step visualizer components"
```

---

### Task 6: Status Card Component

**Files:**
- Create: `components/generation-preview/status-card.tsx`

- [ ] **Step 1: Create status-card component**

```typescript
// components/generation-preview/status-card.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GenerationStep } from '@/lib/types/scene';

interface StatusCardProps {
  step?: GenerationStep;
  error?: string | null;
  isComplete?: boolean;
  truncationWarnings?: string[];
}

export function StatusCard({ step, error, isComplete, truncationWarnings }: StatusCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {error
          ? '生成失败'
          : isComplete
          ? '生成完成'
          : step?.title || '正在处理'}
      </Text>
      <Text style={styles.description}>
        {error
          ? error
          : isComplete
          ? '即将进入课堂...'
          : step?.description || ''}
      </Text>
      
      {truncationWarnings && truncationWarnings.length > 0 && !error && !isComplete && (
        <View style={styles.warningContainer}>
          <Ionicons name="alert-circle" size={16} color="#f59e0b" />
          <Text style={styles.warningText}>
            {truncationWarnings[0]}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#92400e',
  },
});
```

- [ ] **Step 2: Commit status card**

```bash
git add components/generation-preview/status-card.tsx
git commit -m "feat(mobile): add status card for generation-preview"
```

---

### Task 7: Agent Reveal Modal

**Files:**
- Create: `components/generation-preview/agent-reveal-modal.tsx`

- [ ] **Step 1: Create agent-reveal-modal with flip animation**

```typescript
// components/generation-preview/agent-reveal-modal.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AgentProfile } from '@/lib/types/scene';
import { FLIP_DURATION } from '@/lib/constants/generation-animation';

interface AgentRevealModalProps {
  visible: boolean;
  agents: AgentProfile[];
  onClose: () => void;
  onAllRevealed?: () => void;
}

function AgentCard({ agent, isRevealed, index }: { agent: AgentProfile; isRevealed: boolean; index: number }) {
  const rotateY = useSharedValue(180);

  useEffect(() => {
    if (isRevealed) {
      // Delay based on index for staggered reveal
      const delay = index * 500;
      setTimeout(() => {
        rotateY.value = withTiming(0, {
          duration: FLIP_DURATION,
          easing: Easing.out(Easing.cubic),
        });
      }, delay);
    }
  }, [isRevealed, index]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${rotateY.value}deg` },
    ],
    opacity: interpolate(rotateY.value, [90, 180], [1, 0]),
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${rotateY.value + 180}deg` },
    ],
    opacity: interpolate(rotateY.value, [90, 180], [0, 1]),
  }));

  return (
    <View style={styles.cardContainer}>
      {/* Back side (mystery) */}
      <Animated.View style={[styles.cardBack, backStyle]}>
        <Ionicons name="sparkles" size={36} color="#c4b5fd" />
        <Text style={styles.cardBackText}>?</Text>
      </Animated.View>

      {/* Front side (revealed) */}
      <Animated.View style={[styles.cardFront, { backgroundColor: agent.color || '#8b5cf6' }, frontStyle]}>
        <Ionicons name="person" size={32} color="#fff" />
        <Text style={styles.agentName}>{agent.name}</Text>
        <Text style={styles.agentRole}>{agent.role}</Text>
        {agent.persona && (
          <Text style={styles.agentPersona} numberOfLines={2}>
            {agent.persona}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

export function AgentRevealModal({ visible, agents, onClose, onAllRevealed }: AgentRevealModalProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const allRevealed = revealedCount >= agents.length;

  useEffect(() => {
    if (!visible || agents.length === 0) return;

    // Start revealing after 400ms
    const startTimeout = setTimeout(() => {
      setRevealedCount(1);

      if (agents.length <= 1) {
        // Single agent - close after 600ms
        setTimeout(() => {
          onAllRevealed?.();
          onClose();
        }, 600);
        return;
      }

      // Reveal remaining agents every 500ms
      const interval = setInterval(() => {
        setRevealedCount(prev => {
          const next = prev + 1;
          if (next >= agents.length) {
            clearInterval(interval);
            // Auto-close after all revealed + 1s delay
            setTimeout(() => {
              onAllRevealed?.();
              onClose();
            }, 1000);
          }
          return next;
        });
      }, 500);

      return () => clearInterval(interval);
    }, 400);

    return () => clearTimeout(startTimeout);
  }, [visible, agents.length]);

  if (agents.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <Text style={styles.modalTitle}>✨ 智能体已生成</Text>
        
        <View style={styles.cardsContainer}>
          {agents.map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isRevealed={index < revealedCount}
              index={index}
            />
          ))}
        </View>

        {/* Progress dots */}
        <View style={styles.progressDots}>
          {agents.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index < revealedCount && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {allRevealed && (
          <TouchableOpacity onPress={() => { onAllRevealed?.(); onClose(); }} style={styles.continueButton}>
            <Text style={styles.continueText}>继续生成</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  cardContainer: {
    width: 100,
    height: 140,
  },
  cardBack: {
    position: 'absolute',
    width: 100,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  cardBackText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#c4b5fd',
    marginTop: 8,
  },
  cardFront: {
    position: 'absolute',
    width: 100,
    height: 140,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    backfaceVisibility: 'hidden',
  },
  agentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
  },
  agentRole: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  agentPersona: {
    fontSize: 10,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 4,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
  },
  dotActive: {
    backgroundColor: '#8b5cf6',
  },
  continueButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  continueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Commit agent reveal modal**

```bash
git add components/generation-preview/agent-reveal-modal.tsx
git commit -m "feat(mobile): add agent reveal modal with flip animation"
```

---

## Phase 3: Main Page Integration (Task 8)

### Task 8: Generation Preview Main Page

**Files:**
- Create: `app/generation-preview/index.tsx`

- [ ] **Step 1: Create main generation-preview page**

```typescript
// app/generation-preview/index.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { nanoid } from 'nanoid/non-secure';

import { useGenerationSessionStore } from '@/lib/store/generation-session';
import { apiClient } from '@/lib/api-client';
import { parsePdfFile } from '@/lib/api/pdf-parser';
import { ProgressIndicator } from '@/components/generation-preview/progress-indicator';
import { StepVisualizer } from '@/components/generation-preview/step-visualizer';
import { StatusCard } from '@/components/generation-preview/status-card';
import { AgentRevealModal } from '@/components/generation-preview/agent-reveal-modal';
import { getActiveSteps, ALL_STEPS } from '@/lib/constants/generation-steps';
import { GenerationSessionState, SceneOutline, AgentProfile } from '@/lib/types/scene';

export default function GenerationPreviewScreen() {
  const router = useRouter();
  const sessionStore = useGenerationSessionStore();
  const hasStartedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [streamingOutlines, setStreamingOutlines] = useState<SceneOutline[]>([]);
  const [webSearchSources, setWebSearchSources] = useState<Array<{ title: string; url: string }>>([]);
  const [truncationWarnings, setTruncationWarnings] = useState<string[]>([]);
  const [generatedAgents, setGeneratedAgents] = useState<AgentProfile[]>([]);
  const [showAgentReveal, setShowAgentReveal] = useState(false);
  const agentRevealResolveRef = useRef<(() => void) | null>(null);

  // Load session from storage or route params
  useEffect(() => {
    sessionStore.loadFromStorage();
    
    // Check route params
    const params = router.params as { session?: string } | undefined;
    if (params?.session) {
      sessionStore.loadFromJson(params.session);
    }
  }, []);

  // Auto-start generation
  useEffect(() => {
    if (sessionStore.state && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startGeneration();
    }
  }, [sessionStore.state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const getActiveStepsList = () => getActiveSteps(sessionStore.state);

  const startGeneration = async () => {
    const session = sessionStore.state;
    if (!session) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    setError(null);
    setCurrentStepIndex(0);
    setStreamingOutlines([]);
    setWebSearchSources([]);

    try {
      let activeSteps = getActiveStepsList();
      const stageId = session.stageId || nanoid(10);

      // Step 0: Parse PDF if needed
      if (session.pdfFile) {
        const pdfStepIdx = activeSteps.findIndex(s => s.id === 'pdf-analysis');
        if (pdfStepIdx >= 0) setCurrentStepIndex(pdfStepIdx);

        try {
          const pdfResult = await parsePdfFile(
            session.pdfFile.uri,
            session.pdfFile.name,
            signal
          );

          sessionStore.updateState({
            pdfText: pdfResult.text,
            pdfImages: pdfResult.images,
          });

          if (pdfResult.warnings.length > 0) {
            setTruncationWarnings(pdfResult.warnings);
          }

          activeSteps = getActiveStepsList();
        } catch (e) {
          throw new Error('PDF解析失败');
        }
      }

      // Step 1: Web Search if enabled
      if (session.requirements.webSearch) {
        const wsStepIdx = activeSteps.findIndex(s => s.id === 'web-search');
        if (wsStepIdx >= 0) setCurrentStepIndex(wsStepIdx);

        try {
          const wsResult = await apiClient.webSearch(
            session.requirements.requirement,
            session.pdfText
          );

          setWebSearchSources(wsResult.sources || []);
          sessionStore.updateState({
            researchContext: wsResult.context,
            webSearchSources: wsResult.sources,
          });

          activeSteps = getActiveStepsList();
        } catch (e) {
          console.warn('Web search failed:', e);
          // Continue without web search
        }
      }

      // Step 2: Agent Generation
      const agentStepIdx = activeSteps.findIndex(s => s.id === 'agent-generation');
      if (agentStepIdx >= 0) setCurrentStepIndex(agentStepIdx);

      let agents: AgentProfile[] = [];
      try {
        const agentResult = await apiClient.generateAgentProfiles(
          { name: session.requirements.requirement.substring(0, 100) },
          session.requirements.language
        );

        agents = agentResult.agents || [];
        setGeneratedAgents(agents);
        sessionStore.updateState({ generatedAgents: agents });

        // Show reveal modal
        setShowAgentReveal(true);
        await new Promise<void>(resolve => {
          agentRevealResolveRef.current = resolve;
        });
      } catch (e) {
        console.warn('Agent generation failed:', e);
        // Use default agents
        const defaultResult = await apiClient.getDefaultAgents(session.requirements.language);
        agents = defaultResult.agents || [];
        setGeneratedAgents(agents);
      }

      // Step 3: Outline Generation (SSE)
      const outlineStepIdx = activeSteps.findIndex(s => s.id === 'outline');
      if (outlineStepIdx >= 0) setCurrentStepIndex(outlineStepIdx);

      const collectedOutlines: SceneOutline[] = [];
      setStreamingOutlines([]);

      await apiClient.generateOutlinesStream(
        session.requirements.requirement,
        session.requirements.language,
        agents,
        session.requirements.webSearch,
        (outline) => {
          collectedOutlines.push(outline as SceneOutline);
          setStreamingOutlines([...collectedOutlines]);
        },
        (count) => {
          console.log(`Generated ${count} outlines`);
        },
        (err) => {
          console.error('Outline error:', err);
        }
      );

      if (collectedOutlines.length === 0) {
        throw new Error('大纲生成失败，请重试');
      }

      sessionStore.updateState({ sceneOutlines: collectedOutlines });

      // Brief pause
      await new Promise(resolve => setTimeout(resolve, 800));

      // Step 4: Scene Content
      const contentStepIdx = activeSteps.findIndex(s => s.id === 'slide-content');
      if (contentStepIdx >= 0) setCurrentStepIndex(contentStepIdx);

      const firstOutline = collectedOutlines[0];
      const contentResult = await apiClient.generateSceneContent(
        firstOutline,
        collectedOutlines,
        { name: session.requirements.requirement.substring(0, 100), language: session.requirements.language },
        stageId,
        agents
      );

      if (!contentResult.success) {
        throw new Error('场景内容生成失败');
      }

      // Step 5: Scene Actions
      const actionsStepIdx = activeSteps.findIndex(s => s.id === 'actions');
      if (actionsStepIdx >= 0) setCurrentStepIndex(actionsStepIdx);

      const actionsResult = await apiClient.generateSceneActions(
        firstOutline,
        collectedOutlines,
        contentResult.content,
        stageId,
        agents
      );

      if (!actionsResult.success) {
        throw new Error('场景动作生成失败');
      }

      // Complete
      setIsComplete(true);
      sessionStore.setComplete(true);

      // Navigate to classroom after brief pause
      await new Promise(resolve => setTimeout(resolve, 500));
      sessionStore.clear();
      router.replace(`/classroom/${stageId}`);

    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('Generation aborted');
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
      sessionStore.setError(e instanceof Error ? e.message : String(e));
    }
  };

  const goBackToHome = () => {
    abortControllerRef.current?.abort();
    sessionStore.clear();
    router.replace('/');
  };

  const retryGeneration = () => {
    setError(null);
    hasStartedRef.current = false;
    startGeneration();
  };

  // Loading state
  if (!sessionStore.state) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeSteps = getActiveStepsList();
  const currentStep = activeSteps[currentStepIndex] || ALL_STEPS[0];

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      <TouchableOpacity onPress={goBackToHome} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#334155" />
        <Text style={styles.backText}>返回首页</Text>
      </TouchableOpacity>

      {/* Progress indicator */}
      <View style={styles.progressWrapper}>
        <ProgressIndicator steps={activeSteps} currentIndex={currentStepIndex} />
      </View>

      {/* Main content card */}
      <ScrollView contentContainerStyle={styles.contentCard}>
        {/* Step visualizer */}
        <View style={styles.visualizerWrapper}>
          <StepVisualizer
            stepId={currentStep.id}
            outlines={streamingOutlines}
            webSearchSources={webSearchSources}
          />
        </View>

        {/* Status card */}
        <View style={styles.statusWrapper}>
          <StatusCard
            step={currentStep}
            error={error}
            isComplete={isComplete}
            truncationWarnings={truncationWarnings}
          />
        </View>

        {/* Footer */}
        {!error && !isComplete && (
          <View style={styles.footer}>
            <Ionicons name="sparkles" size={16} color="#94a3b8" />
            <Text style={styles.footerText}>AI 正在生成...</Text>
            {generatedAgents.length > 0 && !showAgentReveal && (
              <TouchableOpacity onPress={() => setShowAgentReveal(true)} style={styles.viewAgentsButton}>
                <Ionicons name="people" size={14} color="#8b5cf6" />
                <Text style={styles.viewAgentsText}>查看智能体</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {error && (
          <TouchableOpacity onPress={retryGeneration} style={styles.retryButton}>
            <Ionicons name="refresh" size={16} color="#3b82f6" />
            <Text style={styles.retryText}>返回重试</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Agent reveal modal */}
      <AgentRevealModal
        visible={showAgentReveal}
        agents={generatedAgents}
        onClose={() => {
          setShowAgentReveal(false);
          agentRevealResolveRef.current?.();
          agentRevealResolveRef.current = null;
        }}
        onAllRevealed={() => {
          agentRevealResolveRef.current?.();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backText: {
    fontSize: 16,
    color: '#334155',
  },
  progressWrapper: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  contentCard: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  visualizerWrapper: {
    marginBottom: 24,
  },
  statusWrapper: {
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#94a3b8',
    letterSpacing: 1,
  },
  viewAgentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    backgroundColor: '#f3e8ff',
  },
  viewAgentsText: {
    fontSize: 12,
    color: '#8b5cf6',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  retryText: {
    fontSize: 16,
    color: '#3b82f6',
  },
});
```

- [ ] **Step 2: Install nanoid dependency**

```bash
npm install nanoid
```

- [ ] **Step 3: Commit main page**

```bash
git add app/generation-preview/index.tsx package.json package-lock.json
git commit -m "feat(mobile): add generation-preview main page with full flow"
```

---

## Phase 4: Integration Testing (Task 9)

### Task 9: Integration and Testing

**Files:**
- Test manually with Python backend running

- [ ] **Step 1: Verify Python backend is running**

```bash
cd packages/server-python
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- [ ] **Step 2: Start mobile app**

```bash
cd packages/mobile
npm start
```

- [ ] **Step 3: Test full generation flow**

Test scenarios:
1. Navigate to `/generation-preview` with session params
2. Verify progress indicator animates
3. Verify step visualizers show skeleton animations
4. Verify SSE outlines stream correctly
5. Verify agent reveal modal shows flip animation
6. Verify navigation to classroom page

- [ ] **Step 4: Test PDF upload flow (optional)**

If PDF feature is enabled:
1. Select PDF file
2. Verify PDF parse step runs
3. Verify truncation warnings show if needed

- [ ] **Step 5: Test error handling**

1. Simulate network error (disconnect backend)
2. Verify error card shows
3. Click retry button
4. Verify generation restarts

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(mobile): complete generation-preview module implementation"
```

---

## Summary

**Total Tasks:** 9
**Estimated Duration:** 6-8 working days

**Key Deliverables:**
- Generation preview page with step visualization
- Agent reveal modal with flip animation
- SSE outline streaming integration
- PDF parsing via Python backend
- Web search integration
- Zustand + MMKV state management