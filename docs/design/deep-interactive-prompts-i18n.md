# Deep Interactive Mode、Prompts系统与国际化技术实现文档

本文档详细阐述 OpenMAIC v0.2.x 版本新增的核心功能：深度互动模式、文件化Prompts系统和多语言国际化架构。

---

## 一、Deep Interactive Mode 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Interactive Scene Types (场景类型层)                 │
│  Visualization3D │ Simulation │ Game │ Diagram │ Code │ Widget       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  Content Generation Layer (内容生成层)                │
│    Prompt Templates │ Scene Builder │ Media Manifest │ Actions       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  Widget Framework (组件框架层)                        │
│    iframe sandbox │ message bridge │ state sync │ teacher actions   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  Renderer Layer (渲染层)                              │
│  InteractiveRenderer │ ThumbnailInteractive │ Responsive Container   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、Interactive Scene Types 场景类型详解

### 2.1 场景类型定义

**文件位置**: `lib/types/generation.ts`

| 场景类型 | Prompt模板 | 功能描述 | 响应式支持 |
|---------|-----------|---------|-----------|
| `visualization3d` | `visualization3d-content/` | 3D可视化互动 | 桌面/平板/手机 |
| `simulation` | `simulation-content/` | 科学模拟实验 | 桌面/平板 |
| `game` | `game-content/` | 游戏化学习 | 桌面/平板/手机 |
| `diagram` | `diagram-content/` | 思维导图/图表 | 桌面/平板 |
| `code` | `code-content/` | 在线编程练习 | 桌面 |

### 2.2 场景大纲结构

```typescript
interface InteractiveOutline {
  type: 'interactive';
  title: string;
  description: string;
  key_points: string[];
  interactiveConfig: {
    mode: 'visualization3d' | 'simulation' | 'game' | 'diagram' | 'code' | 'widget';
    description: string;        // 详细描述给AI教师指导内容
    teacherActions?: string[];  // 教师预设动作列表
    widgetConfig?: {
      type: string;             // Widget类型标识
      props: Record<string, unknown>;
    };
  };
}
```

### 2.3 Prompt模板示例 - Game内容

**文件位置**: `lib/prompts/templates/game-content/system.md`

```markdown
You are designing an interactive **game-based learning** scene for the course.

## Scene Structure

Generate a JSON object with:
- `mode`: "game"
- `gameType`: one of ["quiz-game", "puzzle", "strategy", "simulation-game"]
- `elements`: game UI components (buttons, score display, progress bar)
- `teacherActions`: suggested teacher interventions
- `studentInstructions`: how to play

## Game Design Guidelines

1. **Educational Alignment**: Game mechanics must reinforce learning objectives
2. **Progressive Difficulty**: Start simple, gradually increase challenge
3. **Immediate Feedback**: Clear visual/audio feedback for correct/incorrect actions
4. **Time Management**: Include optional time limits to maintain engagement

{{#if imageEnabled}}
{{snippet:slide-image-instructions}}
{{/if}}

{{#if videoEnabled}}
{{snippet:video-instructions}}
{{/if}}
```

### 2.4 教师动作系统

**文件位置**: `lib/prompts/templates/widget-teacher-actions/`

```typescript
interface TeacherAction {
  type: 'widget-action';
  action: 'highlight' | 'guide' | 'hint' | 'celebrate' | 'correct';
  target?: string;           // 目标元素ID
  message?: string;          // 提示消息
  delay?: number;            // 动作延迟(ms)
}
```

---

## 三、Widget框架实现

### 3.1 iframe沙箱架构

**文件位置**: `lib/store/widget-iframe.ts`

```typescript
interface WidgetIframeState {
  iframeRef: HTMLIFrameElement | null;
  isLoaded: boolean;
  messageChannel: MessageChannel | null;
  currentAction: TeacherAction | null;
  actionQueue: TeacherAction[];
}

// iframe通信协议
type WidgetMessage = {
  type: 'state-sync' | 'teacher-action' | 'student-input' | 'resize';
  payload: unknown;
};
```

### 3.2 安全边界设计

**文件位置**: `middleware.ts`

```typescript
// 防框架攻击配置
const securityHeaders = {
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
};

// 可选：允许特定域名嵌入
if (process.env.ALLOWED_FRAME_ANCESTORS) {
  securityHeaders['Content-Security-Policy'] = 
    `frame-ancestors 'self' ${process.env.ALLOWED_FRAME_ANCESTORS}`;
}
```

### 3.3 响应式缩放适配

**文件位置**: `components/scene-renderers/interactive-renderer.tsx`

```tsx
const getResponsiveScale = () => {
  const { width, height } = containerDimensions;
  
  // 根据设备类型调整缩放
  const baseScale = Math.min(width / 1000, height / 600);
  
  if (isMobile) {
    return baseScale * 0.85;  // 手机略小，留出导航空间
  }
  if (isTablet) {
    return baseScale * 0.92;  // 平板适中
  }
  return baseScale;           // 桌面全尺寸
};
```

---

## 四、文件化Prompts系统

### 4.1 目录结构

```
lib/prompts/
├── loader.ts             ← 文件加载 + 缓存
├── index.ts              ← 公共API (loadPrompt, buildPrompt)
├── types.ts              ← PromptId/SnippetId类型联合
├── README.md             ← 系统文档
├── templates/
│   └── <prompt-id>/
│       ├── system.md     ← 系统提示（必需）
│       └── user.md       ← 用户提示（可选）
└── snippets/
    └── <snippet-id>.md   ← 可复用片段
```

### 4.2 模板语法系统

**文件位置**: `lib/prompts/loader.ts`

| 语法 | 用途 | 处理函数 |
|-----|------|---------|
| `{{variableName}}` | 变量插值 | `interpolateVariables()` |
| `{{snippet:snippet-name}}` | 片段引用 | `processSnippets()` |
| `{{#if condition}}...{{/if}}` | 条件块 | `processConditionalBlocks()` |

### 4.3 处理顺序

```typescript
export function buildPrompt(
  promptId: PromptId,
  variables: Record<string, unknown>,
): { system: string; user: string } | null {
  const prompt = loadPrompt(promptId);
  if (!prompt) return null;

  return {
    system: interpolateVariables(
      processConditionalBlocks(prompt.systemPrompt, variables),
      variables,
    ),
    user: interpolateVariables(
      processConditionalBlocks(prompt.userPromptTemplate, variables),
      variables,
    ),
  };
}
```

**处理顺序**: 片段引用 → 条件块 → 变量插值

### 4.4 条件媒体指令

**文件位置**: `lib/prompts/snippets/slide-image-instructions.md`

```markdown
## Image Generation Guidelines

When including images:
1. Use descriptive prompts for educational relevance
2. Avoid decorative-only images
3. Ensure accessibility with alt-text descriptions

{{#if imageGenerationEnabled}}
Use AI image generation for custom educational diagrams.
{{/if}}
```

**使用方式**:
```typescript
const prompt = buildPrompt('slide-content', {
  imageEnabled: true,
  imageGenerationEnabled: settings.imageGenerationEnabled,
  // ... 其他变量
});
```

### 4.5 PromptId类型定义

**文件位置**: `lib/prompts/types.ts`

```typescript
export type PromptId = 
  | 'agent-system'
  | 'agent-system-wb-teacher'
  | 'agent-system-wb-assistant'
  | 'agent-system-wb-student'
  | 'director'
  | 'code-content'
  | 'diagram-content'
  | 'game-content'
  | 'interactive-actions'
  | 'interactive-outlines'
  | 'pbl-actions'
  | 'pbl-design'
  | 'quiz-actions'
  | 'quiz-content'
  | 'requirements-to-outlines'
  | 'simulation-content'
  | 'slide-actions'
  | 'slide-content'
  | 'visualization3d-content'
  | 'widget-teacher-actions';

export type SnippetId =
  | 'action-types'
  | 'element-types'
  | 'image-instructions'
  | 'json-output-rules'
  | 'media-safety-guidelines'
  | 'speech-guidelines'
  | 'video-instructions'
  | 'whiteboard-reference';
```

---

## 五、国际化系统 (i18next)

### 5.1 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                     i18next Core (国际化核心)                        │
│    Language Detection │ Resource Loading │ Interpolation            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     Locale Files (语言文件层)                        │
│    zh-CN │ zh-TW │ en-US │ ja-JP │ ru-RU │ ar-SA                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     React Integration (React集成层)                  │
│    useTranslation Hook │ Trans Component │ LanguageSwitcher         │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 语言文件结构

**文件位置**: `lib/i18n/locales/*.json`

| 语言 | 文件 | 键数量 | 大小 |
|-----|------|-------|------|
| 🇨🇳 简体中文 | `zh-CN.json` | ~2000 | 45KB |
| 🇹🇼 繁体中文 | `zh-TW.json` | ~2000 | 45KB |
| 🇺🇸 英语 | `en-US.json` | ~2000 | 46KB |
| 🇯🇵 日语 | `ja-JP.json` | ~2000 | 54KB |
| 🇷🇺 俄语 | `ru-RU.json` | ~2000 | 63KB |
| 🇸🇦 阿拉伯语 | `ar-SA.json` | ~2000 | 58KB |

### 5.3 配置初始化

**文件位置**: `lib/i18n/config.ts`

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: require('./locales/zh-CN.json') },
      'zh-TW': { translation: require('./locales/zh-TW.json') },
      'en-US': { translation: require('./locales/en-US.json') },
      'ja-JP': { translation: require('./locales/ja-JP.json') },
      'ru-RU': { translation: require('./locales/ru-RU.json') },
      'ar-SA': { translation: require('./locales/ar-SA.json') },
    },
    fallbackLng: 'en-US',
    interpolation: {
      escapeValue: false,  // React已处理安全
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });
```

### 5.4 使用示例

**Hook方式**:
```tsx
import { useTranslation } from 'react-i18next';

function Component() {
  const { t, i18n } = useTranslation();
  
  return (
    <div>
      <h1>{t('generation.title')}</h1>
      <p>{t('generation.description', { count: 5 })}</p>
      <button onClick={() => i18n.changeLanguage('zh-TW')}>
        切换繁体中文
      </button>
    </div>
  );
}
```

**组件方式**:
```tsx
import { Trans } from 'react-i18next';

function Component() {
  return (
    <Trans i18nKey="settings.providerConfig">
      配置 <strong>{{ name: provider.name }}</strong> 提供者
    </Trans>
  );
}
```

### 5.5 CI键对齐检查

**文件位置**: `scripts/check-i18n-keys.mjs`

```javascript
// 检查所有语言文件的键是否一致
const checkKeyAlignment = () => {
  const baseKeys = Object.keys(locales['en-US']);
  
  for (const [lang, keys] of Object.entries(locales)) {
    const missing = baseKeys.filter(k => !keys[k]);
    const extra = Object.keys(keys).filter(k => !baseKeys[k]);
    
    if (missing.length > 0 || extra.length > 0) {
      console.error(`[${lang}] Missing: ${missing}, Extra: ${extra}`);
      process.exit(1);
    }
  }
};
```

---

## 六、VoxCPM2语音克隆系统

### 6.1 架构设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Voice Pool (语音池 - 本地存储)                      │
│    IndexedDB存储 │ 参考音频 │ 克隆参数 │ Agent语音映射               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   VoxCPM Backend (后端服务)                          │
│    vLLM-Omni │ Nano-VLLM │ Official API │ Auto Voice生成            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   Voice Picker UI (语音选择器)                       │
│    搜索过滤 │ 预览播放 │ Agent绑定 │ Voice Profile管理               │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 语音池管理

**文件位置**: `lib/audio/voxcpm-voices.ts`

```typescript
interface VoiceProfile {
  id: string;
  name: string;
  referenceAudio: string;    // 参考音频URL或Base64
  createdAt: number;
  agentId?: string;          // 绑定的Agent ID
  autoGenerated?: boolean;   // 是否Auto Voice生成
}

interface VoxCPMVoicePool {
  voices: VoiceProfile[];
  addVoice(profile: VoiceProfile): void;
  getVoice(id: string): VoiceProfile | undefined;
  bindToAgent(voiceId: string, agentId: string): void;
  deleteVoice(id: string): void;
}
```

### 6.3 Auto Voice生成

**文件位置**: `lib/audio/voxcpm.ts`

```typescript
// 根据Agent人设自动生成匹配的语音
const generateAutoVoice = async (agent: Agent): Promise<VoiceProfile> => {
  const persona = agent.persona;
  
  // 从人设文本推断语音特征
  const voiceTraits = await inferVoiceTraits(persona);
  
  // 使用预置参考音频库选择最佳匹配
  const referenceAudio = selectReferenceByTraits(voiceTraits);
  
  return {
    id: nanoid(),
    name: `${agent.name}-voice`,
    referenceAudio,
    autoGenerated: true,
    agentId: agent.id,
  };
};
```

### 6.4 语音选择器组件

**文件位置**: `components/audio/tts-config-popover.tsx`

```tsx
function VoicePicker({ agentId, onSelect }) {
  const { voices } = useVoxCPMVoicePool();
  const [search, setSearch] = useState('');
  
  const filtered = voices.filter(v => 
    v.name.includes(search) || 
    (v.agentId === agentId)
  );
  
  return (
    <div>
      <Input placeholder="搜索语音..." value={search} onChange={setSearch} />
      <List>
        {filtered.map(voice => (
          <VoiceItem 
            key={voice.id}
            voice={voice}
            onPreview={() => playPreview(voice)}
            onSelect={() => onSelect(voice)}
          />
        ))}
      </List>
      <Button onClick={() => generateAutoVoice(agent)}>
        Auto Generate
      </Button>
    </div>
  );
}
```

---

## 七、Thinking配置系统

### 7.1 模型推理元数据

**文件位置**: `lib/ai/thinking-config.ts`

```typescript
interface ThinkingConfig {
  enabled: boolean;
  type: 'effort' | 'budget' | 'toggle';
  
  // Effort模式（Claude）
  effort?: 'low' | 'medium' | 'high';
  
  // Budget模式（自定义token限制）
  budgetTokens?: number;
  
  // Toggle模式（简单开关）
  // enabled: true/false
}

interface ModelMetadata {
  id: string;
  name: string;
  provider: string;
  thinking?: ThinkingConfig;
  supportsVision?: boolean;
  maxOutputTokens?: number;
}
```

### 7.2 Provider映射

| Provider | Thinking参数 | 示例模型 |
|----------|-------------|---------|
| Anthropic | `thinking: { type: 'enabled', budget_tokens: 10000 }` | Claude Opus 4 |
| OpenAI | `reasoning_effort: 'medium'` | o1-preview |
| DeepSeek | `thinking: { enabled: true }` | DeepSeek-R1 |
| 其他 | 无支持 | - |

### 7.3 模型选择器集成

**文件位置**: `components/settings/model-selector.tsx`

```tsx
function ModelSelector({ onSelect }) {
  const models = useModelRegistry();
  const [thinkingLevel, setThinkingLevel] = useState<string>();
  
  const filtered = models.filter(m => {
    if (thinkingLevel && m.thinking) {
      return m.thinking.type === thinkingLevel;
    }
    return true;
  });
  
  return (
    <Popover>
      <PopoverContent>
        <SearchInput />
        <ThinkingLevelFilter value={thinkingLevel} onChange={setThinkingLevel} />
        <ModelList models={filtered} onSelect={onSelect} />
      </PopoverContent>
    </Popover>
  );
}
```

---

## 八、新增Providers

### 8.1 图片生成适配器

| Provider | 文件 | 特点 |
|----------|------|------|
| **HappyHorse** | `lib/media/adapters/happyhorse-adapter.ts` | 视频生成 |
| **Lemonade** | `lib/media/adapters/lemonade-image-adapter.ts` | 图片生成 |
| **OpenAI Image** | `lib/media/adapters/openai-image-adapter.ts` | GPT-Image-2 |

### 8.2 网页搜索Provider

**Bocha搜索**:
```typescript
// 文件: lib/web-search/bocha.ts
interface BochaSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

const bochaSearch = async (query: string): Promise<BochaSearchResult[]> => {
  const response = await fetch('https://api.bocha.io/search', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ query }),
  });
  return response.json().results;
};
```

### 8.3 PDF解析Provider

**MinerU Cloud**:
```typescript
// 文件: lib/pdf/mineru-cloud.ts
interface MinerUResult {
  text: string;
  images: { id: string; data: string }[];
  tables: { content: string }[];
}

const mineruParse = async (file: File): Promise<MinerUResult> => {
  // 上传文件到MinerU Cloud
  const uploadUrl = await uploadToMinerU(file);
  
  // 等待解析完成
  const result = await pollMinerUResult(uploadUrl);
  
  return result;
};
```

---

## 九、课程完成系统

### 9.1 完成页面组件

**文件位置**: `components/scene-renderers/classroom-complete.tsx`

```tsx
interface CompleteSummary {
  totalScenes: number;
  completedQuizzes: number;
  quizScores: Record<string, { correct: number; total: number }>;
  sceneTypeStats: Record<string, number>;
  durationMinutes: number;
}

function ClassroomComplete({ summary }: { summary: CompleteSummary }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {/* Quiz成绩卡片 */}
      <QuizScoreCard scores={summary.quizScores} />
      
      {/* 场景类型统计 */}
      <SceneTypeStats stats={summary.sceneTypeStats} />
      
      {/* 撒花动画 */}
      <ConfettiCelebration />
      
      {/* 完成按钮 */}
      <Button onClick={returnToHome}>返回首页</Button>
    </motion.div>
  );
}
```

### 9.2 Quiz持久化

**文件位置**: `lib/quiz/persistence.ts`

```typescript
interface QuizState {
  sceneId: string;
  selectedAnswers: Record<string, string>;
  submitted: boolean;
  graded: boolean;
  results: Record<string, boolean>;
  aiFeedback?: string;
}

// IndexedDB存储
const persistQuizState = async (state: QuizState): Promise<void> => {
  const db = await openDB('openmaic-quiz');
  await db.put('quiz-states', state, state.sceneId);
};

const loadQuizState = async (sceneId: string): Promise<QuizState | undefined> => {
  const db = await openDB('openmaic-quiz');
  return db.get('quiz-states', sceneId);
};
```

---

## 十、关键文件索引

### 10.1 Deep Interactive模块

| 功能 | 核心文件 |
|------|----------|
| 场景渲染 | `components/scene-renderers/interactive-renderer.tsx` |
| 缩略图 | `components/slide-renderer/components/ThumbnailInteractive/index.tsx` |
| Widget状态 | `lib/store/widget-iframe.ts` |
| iframe工具 | `lib/utils/iframe.ts` |
| Widget类型 | `lib/types/widgets.ts` |

### 10.2 Prompts模块

| 功能 | 核心文件 |
|------|----------|
| 加载器 | `lib/prompts/loader.ts` |
| 公共API | `lib/prompts/index.ts` |
| 类型定义 | `lib/prompts/types.ts` |
| 模板目录 | `lib/prompts/templates/*/` |
| 片段目录 | `lib/prompts/snippets/` |

### 10.3 i18n模块

| 功能 | 核心文件 |
|------|----------|
| 配置 | `lib/i18n/config.ts` |
| 语言文件 | `lib/i18n/locales/*.json` |
| Hook | `lib/hooks/use-i18n.tsx` |
| 切换器 | `components/language-switcher.tsx` |
| CI检查 | `scripts/check-i18n-keys.mjs` |

### 10.4 VoxCPM模块

| 功能 | 核心文件 |
|------|----------|
| 语音池 | `lib/audio/voxcpm-voices.ts` |
| API客户端 | `lib/audio/voxcpm.ts` |
| WAV工具 | `lib/audio/wav-utils.ts` |

### 10.5 Quiz模块

| 功能 | 核心文件 |
|------|----------|
| 持久化 | `lib/quiz/persistence.ts` |
| 评分 | `lib/quiz/grading.ts` |

---

## 十一、扩展指南

### 11.1 添加新的Interactive场景类型

1. **创建Prompt模板** (`lib/prompts/templates/<type>-content/`)
   ```markdown
   # system.md
   You are designing an interactive **<type>** scene...
   
   {{#if imageEnabled}}
   {{snippet:slide-image-instructions}}
   {{/if}}
   ```

2. **添加类型到联合** (`lib/prompts/types.ts`)
   ```typescript
   export type PromptId = ... | '<type>-content';
   ```

3. **实现渲染器** (`components/scene-renderers/`)
   ```tsx
   export function <Type>Renderer({ content }) {
     return <iframe src={content.widgetUrl} />;
   }
   ```

### 11.2 添加新的语言支持

1. **创建语言文件** (`lib/i18n/locales/<lang>.json`)
   ```json
   {
     "generation": { "title": "...", "description": "..." },
     "settings": { "...": "..." }
   }
   ```

2. **更新配置** (`lib/i18n/config.ts`)
   ```typescript
   resources: {
     ...,
     '<lang>': { translation: require('./locales/<lang>.json') },
   }
   ```

3. **添加到locales列表** (`lib/i18n/locales.ts`)
   ```typescript
   export const SUPPORTED_LOCALES = [
     ...,
     { code: '<lang>', name: 'Language Name' },
   ];
   ```

---

## 十二、注意事项

### 12.1 Prompts系统

1. **命名约定**: 变量用`camelCase`，模板ID用`kebab-case`
2. **处理顺序**: 片段→条件→变量，不可逆
3. **条件块**: 不支持嵌套，保持简单
4. **缓存**: 加载后自动缓存，开发时用`clearPromptCache()`

### 12.2 i18n系统

1. **键对齐**: CI检查确保所有语言键一致
2. **插值**: 使用`{{count}}`等变量支持复数
3. **检测顺序**: localStorage优先，浏览器语言次之
4. **回退**: 缺失键回退到`en-US`

### 12.3 VoxCPM系统

1. **本地存储**: 语音池存IndexedDB，无服务器依赖
2. **参考音频**: 支持URL或Base64编码
3. **Auto Voice**: 根据人设文本推断语音特征
4. **绑定**: Agent可绑定专属语音Profile

---

## 十三、性能优化

### 13.1 Prompts加载

1. **缓存**: 首次加载后缓存到内存
2. **片段复用**: 公共片段避免重复存储
3. **条件裁剪**: 禁用功能不发送相关指令

### 13.2 i18n加载

1. **按需加载**: 可配置动态加载语言文件
2. **缓存**: 语言文件加载后缓存
3. **键数量**: 控制在2000左右，避免过大

### 13.3 Widget iframe

1. **沙箱**: 阻止不必要的iframe重载
2. **通信**: 使用MessageChannel减少开销
3. **缩放**: CSS transform而非iframe内部缩放

---

**文档版本**: v3.0  
**最后更新**: 2026-05-12  
**适用版本**: OpenMAIC ≥ 0.2.0