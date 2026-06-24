import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGoBack } from '@/lib/utils/navigation';
import { showError, confirmAction } from '@/lib/utils/error-toast';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getAvatarImage } from '@/lib/constants/avatar-images';
import * as Speech from 'expo-speech';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { apiClient } from '@/lib/api-client';
import { saveAudioFile } from '@/lib/storage/audio-storage';
import { AudioPlayer } from '@/lib/playback/audio-player';
import { useAuth } from '@/lib/auth/auth-context';
import { PlaybackEngine, EngineMode, TTSConfig } from '@/lib/playback/engine';
import { Scene, Agent as LibAgent, QuizQuestion, QuizContent, InteractiveContent } from '@/lib/types/scene';
import { ScreenCanvas, SlideBackground } from '@/components/slide';
import { WhiteboardOverlay } from '@/components/classroom/WhiteboardOverlay';
import { BottomSheetModal } from '@/components/common/BottomSheetModal';
import { HintToast } from '@/components/common/HintToast';
import { InteractiveWebView, InteractiveWebViewRef } from '@/components/playback/InteractiveWebView';
import { renderWidget, getDefaultParams } from '@/lib/widgets/widget-registry';
import { DiagramView, SimulationView } from '@/components/playback/DiagramView';
import { ClassroomCompletePage } from '@/components/classroom/ClassroomCompletePage';
import { useFirstTimeHint } from '@/lib/hooks/use-first-time-hint';
import { useLearningTracker } from '@/lib/hooks/use-learning-tracker';
import { mobileActionEngine } from '@/lib/whiteboard/action-engine';
import { whiteboardStore } from '@/lib/whiteboard/element-store';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useResponsiveDimensions } from '@/lib/utils/responsive';
import { NoteCreationModal } from '@/lib/components/NoteCreationModal';
import {
  readDraft,
  writeDraft,
  readSubmittedState,
  writeSubmittedAnswers,
  writeSubmittedResults,
  clearSubmitted,
  type QuestionResult,
} from '@/lib/quiz/persistence';
import {
  isShortAnswer,
  isMultipleChoice,
  toArray,
  arraysEqual,
} from '@/lib/quiz/grading';
import { QUIZ_LEVEL_CONFIG } from '@/lib/quiz/levelConfig';
import type { QuizLevel } from '@/lib/quiz/types';
import {
  readChatHistory,
  saveChatHistory,
  appendChatEntry,
  clearChatHistory,
  readDiscussionHistory,
  saveDiscussionHistory,
  appendDiscussionEntry,
  type ChatEntry,
} from '@/lib/chat/persistence';
import {
  parseSSEContent,
  extractDiscussionTopic,
  extractWhiteboardText,
  type ParsedContent,
} from '@/lib/utils/sse-parser';

// Widget 类型 → 图标/标签映射
const WIDGET_ICON_MAP: Record<string, string> = {
  simulation: 'flask-outline',
  game: 'game-controller-outline',
  diagram: 'git-branch-outline',
  code: 'code-slash-outline',
  visualization3d: 'cube-outline',
  html: 'code-working',
  'scientific-model': 'beaker-outline',
};

const WIDGET_LABEL_MAP: Record<string, string> = {
  simulation: '模拟',
  game: '游戏',
  diagram: '图表',
  code: '编程',
  visualization3d: '3D',
  html: '互动',
  'scientific-model': '科学模型',
};

/**
 * 注入移动端适配脚本到 WebView HTML 内容
 * 确保 viewport、触摸交互、安全区域、性能优化
 */
function injectMobileAdaptation(html: string, widgetType?: string): string {
  // 检查 HTML 是否已有 viewport meta
  const hasViewport = html.includes('viewport');
  
  const mobileScript = `
<script>
(function() {
  // 确保 viewport meta 存在（移动端适配的关键）
  if (!document.querySelector('meta[name="viewport"]')) {
    var meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    document.head.appendChild(meta);
  }
  
  // 3D 性能优化：在移动端降低渲染质量
  if (${widgetType === 'visualization3d' ? 'true' : 'false'}) {
    window.__MOBILE_3D_OPTIMIZED__ = true;
  }
})();
</script>`;

  // 如果 HTML 没有 viewport，在 <head> 中注入
  if (!hasViewport) {
    const headCloseIdx = html.indexOf('</head>');
    if (headCloseIdx !== -1) {
      return html.slice(0, headCloseIdx) + mobileScript + html.slice(headCloseIdx);
    }
  }
  
  // 已有 viewport，在 </body> 前注入脚本
  const bodyCloseIdx = html.lastIndexOf('</body>');
  if (bodyCloseIdx !== -1) {
    return html.slice(0, bodyCloseIdx) + mobileScript + html.slice(bodyCloseIdx);
  }
  
  // 没有 body 标签，直接追加
  return html + mobileScript;
}

// 清理 JSON 残留内容和扁平化 action 格式的辅助函数

/**
 * 清理 TTS 文本 — 去除表格/数据列表，只保留口语讲解
 *
 * 策略：
 * 1. 检测并移除 | 分隔的表格行
 * 2. 检测并移除连续的短行数据块（对比列表）
 * 3. 保留自然语言句子
 */
function cleanTTSContent(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const resultLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 跳过空行
    if (!trimmed) continue;

    // 跳过 markdown 表格行 (| xxx | xxx |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) continue;
    // 跳过表格分隔行 (|---|---|)
    if (trimmed.match(/^\|[-:]+\|/)) continue;

    // 跳过纯数据行：连续的 "标签 值" 模式（如 "股息分配 固定股息，优先支付"）
    // 特征：2-4个词，中间无标点，像表格数据
    if (trimmed.match(/^[\u4e00-\u9fa5a-zA-Z]{2,8}\s+[\u4e00-\u9fa5a-zA-Z，、]+\s+[\u4e00-\u9fa5a-zA-Z，、]+$/)) {
      // 但如果包含口语连接词（所以、因此、而、那么等），保留
      if (!trimmed.match(/所以|因此|但是|而且|那么|因为|虽然|不过|然而/)) {
        continue;
      }
    }

    // 跳过纯标题行（"xxx的核心特征"、"xxx vs xxx"）
    if (trimmed.match(/^[\u4e00-\u9fa5a-zA-Z]{2,20}的?(核心|对比|比较|特征|要点|总结)$/)) continue;

    // 跳过 █ 柱状图
    if (trimmed.includes('█') && !trimmed.match(/[。，！？；：]/)) continue;

    resultLines.push(trimmed);
  }

  return resultLines.join('\n').trim();
}

function cleanJsonFromText(text: string): string {

  // 首先检测是否整个响应都是 JSON 格式 [{"type":"text","content":"..."}, ...]
  try {
    const parsed = JSON.parse(text.trim());
    if (Array.isArray(parsed)) {
      // 提取 type:text 元素的 content
      const textContents: string[] = [];
      for (const item of parsed) {
        if (item && typeof item === 'object' && item.type === 'text') {
          if (item.content) {
            textContents.push(item.content);
          }
        }
      }
      if (textContents.length > 0) {
        return textContents.join('\n\n');
      }
    } else if (parsed && typeof parsed === 'object' && parsed.type === 'text') {
      // 单个 JSON 对象 {"type":"text","content":"..."}
      return parsed.content || '';
    }
  } catch (e) {
    // 不是完整 JSON，继续清理
  }

  let cleaned = text;

  // 检测是否包含 JSON 结构片段
  if (cleaned.includes('{"type"') || cleaned.includes('[{"type"') || cleaned.includes('"content":')) {
    // 移除完整的 JSON 数组
    cleaned = cleaned.replace(/\[\s*\{.*?\}\s*(?:,\s*\{.*?\}\s*)*\]/gs, '');
    // 移除单个 JSON 对象
    cleaned = cleaned.replace(/\{\s*"type"\s*:\s*"[^"]*"[^}]*\}/gs, '');
    // 移除 JSON 字段残留
    cleaned = cleaned.replace(/"(?:type|content|name|params|x|y|width|height|fontSize|color)"\s*:\s*"[^"]*"/g, '');
    cleaned = cleaned.replace(/"(?:x|y|width|height|fontSize)"\s*:\s*\d+/g, '');
  }

  // 检测扁平化/损坏的 action 格式
  // 包括：typeactionnamewb_draw_text..., w_textparamscontent..., nnamewb_dra... (截断格式)
  const hasActionResidue = cleaned.includes('typeaction') ||
    cleaned.match(/^(action|w_\w+)\s/m) ||
    cleaned.match(/w_(text|shape|latex|chart|table|code|open|close|clear)/) ||
    cleaned.match(/namewb_/) ||
    cleaned.match(/[a-z]*wb_dra/);

  if (hasActionResidue) {
    // 移除扁平化格式：typeactionname{action_name}...
    cleaned = cleaned.replace(/typeactionname[a-z_]+\s*paramsshape[a-z_]+[^a-z\s]*/gi, '');
    cleaned = cleaned.replace(/typeactionname[a-z_]+[^\n]*/gi, '');
    // 移除截断/损坏的格式：nnamewb_dra..., namewb_draw...
    cleaned = cleaned.replace(/[a-z]*namewb_[a-z_]*[^\n]*/gi, '');
    cleaned = cleaned.replace(/[a-z]*wb_dra[a-z_]*[^\n]*/gi, '');
    cleaned = cleaned.replace(/w_(text|shape|latex|chart|table|code|open|close|clear|delete|edit_code)\w*/gi, '');
    // 移除 params 关键字及其后的参数块
    cleaned = cleaned.replace(/params[a-z]*\s*[^\n]*/gi, '');
    // 移除多行 action 块
    cleaned = cleaned.replace(/^action\s+[a-z_]+\s*\n([^a-z\n][^\n]*\n)*/gim, '');
  }

  // 统一清理所有残留的无效字符
  // 移除残留的关键字
  cleaned = cleaned.replace(/\b(type|action|name|params|elementId|wb_open|wb_close|wb_clear|wb_draw_text|wb_draw_shape|wb_draw_latex|wb_draw_chart|wb_draw_table|wb_draw_code|wb_draw_line|wb_delete|wb_edit_code)\b/gi, '');
  // 移除参数字段名
  cleaned = cleaned.replace(/\b(content|x|y|width|height|fontSize|color|shape|data|latex|code|language|fileName|fillColor|startX|startY|endX|endY|points|style|chartType)\b/gi, '');
  // 移除 JSON 符号残留
  cleaned = cleaned.replace(/[\[\]{}]/g, '');
  // 移除引号残留
  cleaned = cleaned.replace(/""\s*:\s*""/g, '');
  cleaned = cleaned.replace(/""\s*,?\s*""/g, '');
  cleaned = cleaned.replace(/:\s*""/g, '');
  cleaned = cleaned.replace(/"[^"]*":\s*"[^"]*"/g, '');
  cleaned = cleaned.replace(/""/g, '');
  // 移除纯数字行（坐标等）
  cleaned = cleaned.replace(/^\s*\d+\s*\n/gm, '');
  cleaned = cleaned.replace(/\b\d{2,}\b/g, '');
  // 移除颜色值
  cleaned = cleaned.replace(/#[0-9a-fA-F]{3,6}\s*/g, '');
  // 移除反斜杠转义序列（LaTeX 残留）
  cleaned = cleaned.replace(/\\[a-zA-Z]+\s*\{[^}]*\}/g, '');
  cleaned = cleaned.replace(/\\[a-zA-Z]+/g, '');
  // 移除代码块残留
  cleaned = cleaned.replace(/```\w*\n?/g, '');

  // 最终清理：移除连续的无效字符
  cleaned = cleaned.replace(/[,:;]+/g, ' '); // 移除连续的标点
  cleaned = cleaned.replace(/\s+/g, ' ').trim(); // 合并空白

  // 检查清理后是否有有效内容（至少有一些字母或中文）
  if (!cleaned.match(/[一-鿿\w]{3,}/)) {
    return ''; // 无有效内容，返回空字符串
  }

  return cleaned;
}

// 场景大纲类型（用于后台创建）
interface SceneOutline {
  id: string;
  type: 'slide' | 'quiz' | 'interactive' | 'pbl';
  title: string;
  description: string;
  key_points: string[];
  order: number;
}

// 本地 Agent 类型（扩展自 lib/types）
interface Agent extends LibAgent {
  persona?: string;
  avatar?: string;
}

interface ClassroomData {
  stage: {
    id: string;
    name: string;
    description?: string;
    language_directive?: string; // 语言设置
    agent_ids?: string[];
    generatedAgentConfigs?: Agent[];
    pendingOutlines?: SceneOutline[]; // 待创建的场景大纲（从后端获取）
  };
  scenes: Scene[];
  agents?: Agent[];
}

/**
 * 将 background 转换为 SlideBackground
 * 后端返回的数据格式：{ type: 'solid', color: '#xxx' }
 */
function convertToSlideBackground(bg?: { type?: string; color?: string }): SlideBackground | undefined {
  if (!bg) return undefined;
  console.log('[convertToSlideBackground]', bg);
  return {
    type: (bg.type || 'solid') as 'solid',
    color: bg.color || '#ffffff',
  };
}

// 验证 hex 颜色格式
function isValidHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

// 安全的颜色处理：验证并添加 alpha
function safeColorWithAlpha(color: string, alpha: string = '20'): string {
  if (isValidHexColor(color)) {
    return color + alpha;
  }
  return '#888888' + alpha;
}

// 计算测验分数
function calculateQuizScore(
  scenes: Scene[],
  quizQuestions: Record<string, { phase: string; result?: { correct: boolean; earned: number } }>
): number | undefined {
  // 检查是否有测验场景
  const hasQuizScene = scenes.some(s => s.type === 'quiz');
  if (!hasQuizScene) return undefined;

  // 计算正确率
  let totalQuestions = 0;
  let correctQuestions = 0;

  for (const [qId, qs] of Object.entries(quizQuestions)) {
    if (qs.result) {
      totalQuestions++;
      if (qs.result.correct) {
        correctQuestions++;
      }
    }
  }

  if (totalQuestions === 0) return undefined;
  return Math.round((correctQuestions / totalQuestions) * 100);
}

export default function ClassroomScreen() {
  const { id, pendingOutlines, totalScenes, remainingCount } = useLocalSearchParams<{ id: string; pendingOutlines?: string; totalScenes?: string; remainingCount?: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<ClassroomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  // 响应式尺寸
  const { isTablet } = useResponsiveDimensions();

  // 首次进入课堂：提示滑动与缩放手势（3.8s 后自动消失）
  const classroomGestureHint = useFirstTimeHint('classroom.gesture', {
    delayMs: 800,
    autoHideMs: 3800,
  });

  // 后台创建场景进度
  const [backgroundCreating, setBackgroundCreating] = useState(false);
  const [createdScenesCount, setCreatedScenesCount] = useState(0);
  const [pendingScenesTotal, setPendingScenesTotal] = useState(0);
  const [showManualCreateHint, setShowManualCreateHint] = useState(false); // 显示手动创建提示
  const backgroundCreatingRef = useRef(false); // 防止重复创建

  // 学习时长追踪
  const { updateScenesCompleted, completeLearning } = useLearningTracker({
    courseId: id || '',
    totalScenes: data?.scenes?.length || 0,
    onComplete: (result) => {
      // Learning completed - result logged internally
    },
  });

  // 教学工具状态
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showPointer, setShowPointer] = useState(false);
  const [showThumbnailNav, setShowThumbnailNav] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  // 智能体互动
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ agent: string; message: string; agentId?: string; actions?: any[]; persona?: string }>>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [discussionMode, setDiscussionMode] = useState(false); // 多 Agent讨论模式
  const [discussionRunning, setDiscussionRunning] = useState(false); // 讨论进行中
  const [waitingForAgent, setWaitingForAgent] = useState(false); // 等待首个Agent响应
  const [hasDiscussionHistory, setHasDiscussionHistory] = useState(false); // 是否有讨论历史可查看
  const [discussionHint, setDiscussionHint] = useState<{ topic: string; prompt?: string; agentId?: string } | null>(null);
  // TODO(play_video): autoPlayVideoElementId is set by onPlayVideo callback but not yet consumed.
  // Wire to VideoElement auto-play logic when video overlay is implemented on mobile.
  const [autoPlayVideoElementId, setAutoPlayVideoElementId] = useState<string | null>(null);

  // 解析后的内容状态
  const [pendingThinkingPrompt, setPendingThinkingPrompt] = useState<string | null>(null); // 待处理的引导思考
  const [whiteboardTextContent, setWhiteboardTextContent] = useState<string | null>(null); // 白板纯文本内容（legacy fallback）
  const [speakingAgentId, setSpeakingAgentId] = useState<string | null>(null); // 当前发言的Agent ID

  // Refs for async state access（避免 stale state 问题）
  const pendingThinkingPromptRef = useRef<string | null>(null);
  const speakingTimeoutRef = useRef<number | null>(null);
  const currentAgentTextRef = useRef<string>(''); // 当前Agent累积文本（用于TTS）
  const discussionAudioPlayerRef = useRef<AudioPlayer | null>(null); // 讨论专用音频播放器

  // 同步更新 ref
  useEffect(() => {
    pendingThinkingPromptRef.current = pendingThinkingPrompt;
  }, [pendingThinkingPrompt]);

  // 清理 speaking timeout（组件卸载或模态框关闭时）
  useEffect(() => {
    return () => {
      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = null;
      }
    };
  }, []);

  // 语音教学
  const [playbackMode, setPlaybackMode] = useState<EngineMode>('idle');
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false); // 默认关闭自动播放
  const playbackEngineRef = useRef<PlaybackEngine | null>(null);

  // 视觉效果（spotlight/laser）
  const [spotlightElementId, setSpotlightElementId] = useState<string | null>(null);
  const [laserElementId, setLaserElementId] = useState<string | null>(null);
  const [laserOptions, setLaserOptions] = useState<{ color?: string }>({});

  // InteractiveWebView ref
  const interactiveWebViewRef = useRef<InteractiveWebViewRef>(null);

  // TTS 配置
  const [ttsConfig, setTtsConfig] = useState<TTSConfig>({
    provider: 'qwen',
    voice: 'Cherry',
    speed: 1.0,
    model: 'qwen3-tts-flash',
  });

  // 知识提取
  const [extractingKnowledge, setExtractingKnowledge] = useState(false);
  const [showExtractResult, setShowExtractResult] = useState(false);
  const [extractedCards, setExtractedCards] = useState<any[]>([]);

  // 测验交互状态 - Duolingo 逐题模式
  type QuestionPhase = 'answering' | 'grading' | 'feedback' | 'completed';
  interface QuestionState {
    phase: QuestionPhase;
    answer: string | string[];
    result?: { correct: boolean; earned: number; correctAnswer?: string; aiComment?: string };
  }
  interface QuizFlowState {
    currentIndex: number;
    questions: Record<string, QuestionState>;
    phase: 'active' | 'summary';
    showAnalysis?: boolean;
  }
  const [quizFlow, setQuizFlow] = useState<QuizFlowState>({ currentIndex: 0, questions: {}, phase: 'active' });

  // 场景切换动画 - 使用 Reanimated
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  // 使用 useWindowDimensions 替代硬编码尺寸，响应屏幕旋转
  const windowDimensions = useWindowDimensions();
  const screenWidth = windowDimensions.width - 40;

  // 横屏检测 - 调整布局
  const isLandscape = windowDimensions.width > windowDimensions.height;
  const slideHeight = isLandscape ? windowDimensions.height * 0.7 : windowDimensions.height * 0.5;

  // iPad 分屏检测 - 宽度 < 600px 时进入紧凑模式
  const isCompactMode = windowDimensions.width < 600;

  useEffect(() => {
    if (!authLoading && isAuthenticated && id) {
      loadClassroom();
    }
  }, [id, authLoading, isAuthenticated]);

  // Quiz场景状态恢复 - 当切换到Quiz场景时加载持久化状态
  useEffect(() => {
    const scene = data?.scenes?.[currentSceneIndex];
    if (scene?.type === 'quiz' && scene?.id) {
      const questions = (scene.content as QuizContent)?.questions;

      // Quiz 场景缺少 questions：自动补充生成
      if (!questions || questions.length === 0) {
        const regenerateQuiz = async () => {
          try {
            const result = await apiClient.regenerateQuizQuestions(id, scene.id);
            if (result.success && result.questions && result.questions.length > 0) {
              // 更新本地 scene 数据
              const updatedContent = { ...(scene.content as any), questions: result.questions };
              scene.content = updatedContent as any;
              // 触发重渲染
              setData(prev => prev ? { ...prev } : prev);
            }
          } catch (err) {
            console.warn('[Quiz] Failed to regenerate questions:', err);
          }
        };
        regenerateQuiz();
        return;
      }

      const loadQuizState = async () => {
        const submittedState = await readSubmittedState(scene.id);
        if (submittedState?.kind === 'reviewing') {
          // 已完成 - 转换为 summary 阶段
          const flowQuestions: Record<string, QuestionState> = {};
          submittedState.results.forEach(r => {
            const q = questions.find(qq => qq.id === r.questionId);
            flowQuestions[r.questionId] = {
              phase: 'completed',
              answer: submittedState.answers[r.questionId] ?? '',
              result: {
                correct: r.correct === true,
                earned: r.correct ? (q?.points ?? 1) : 0,
                aiComment: r.feedback,
              },
            };
          });
          setQuizFlow({ currentIndex: questions.length, questions: flowQuestions, phase: 'summary' });
        } else if (submittedState?.kind === 'answering') {
          // 旧格式部分提交 - 显示 summary
          const flowQuestions: Record<string, QuestionState> = {};
          Object.entries(submittedState.answers).forEach(([qId, ans]) => {
            flowQuestions[qId] = { phase: 'completed', answer: ans, result: { correct: false, earned: 0 } };
          });
          setQuizFlow({ currentIndex: questions.length, questions: flowQuestions, phase: 'summary' });
        } else {
          // 加载草稿
          const draft = await readDraft(scene.id);
          if (draft && Object.keys(draft).length > 0) {
            const flowQuestions: Record<string, QuestionState> = {};
            Object.entries(draft).forEach(([qId, ans]) => {
              flowQuestions[qId] = { phase: 'answering', answer: ans };
            });
            const firstUnanswered = questions.findIndex(q => !flowQuestions[q.id]);
            setQuizFlow({ currentIndex: firstUnanswered >= 0 ? firstUnanswered : 0, questions: flowQuestions, phase: 'active' });
          } else {
            setQuizFlow({ currentIndex: 0, questions: {}, phase: 'active', showAnalysis: false });
          }
        }
      };
      loadQuizState();
    }
  }, [data, currentSceneIndex]);

  // 聊天历史恢复 - 当切换场景时加载聊天历史
  useEffect(() => {
    const scene = data?.scenes?.[currentSceneIndex];
    if (scene?.id) {
      const loadChatHistory = async () => {
        try {
          const history = await readChatHistory(scene.id);
          if (history.length > 0) {
            setChatHistory(history);
            console.log('[Chat] Loaded history:', history.length, 'entries');
          } else {
            setChatHistory([]); // 清空历史
          }
        } catch (err) {
          showError(err);
          console.warn('[Chat] Failed to load history:', err);
        }
      };
      loadChatHistory();
    }
  }, [data, currentSceneIndex]);

  // 课程完成时记录学习数据
  useEffect(() => {
    if (!data?.scenes || data.scenes.length === 0) return;
    
    const currentScene = data.scenes[currentSceneIndex];
    // 到达最后一个场景即视为课程完成（不再依赖标题匹配）
    const isLastScene = currentSceneIndex === data.scenes.length - 1;

    if (isLastScene) {
      // 计算测验分数（quizFlow.questions 在此时读取最新值）
      const quizScore = calculateQuizScore(data.scenes, quizFlow.questions);

      // 收集错题数据
      const quizAnswers: any[] = [];
      for (const scene of data.scenes) {
        if (scene.type !== 'quiz') continue;
        const qs = (scene.content as any)?.questions as any[] | undefined;
        if (!qs) continue;
        for (const q of qs) {
          const qState = quizFlow.questions[q.id];
          if (!qState) continue;
          const correctAnswer = q.answer ? (Array.isArray(q.answer) ? q.answer : [q.answer]) : [];
          quizAnswers.push({
            question_id: q.id,
            correct: !!qState.result?.correct,
            user_answer: qState.answer,
            question: {
              id: q.id,
              type: q.type,
              content: q.question,
              options: q.options,
              correct_answer: correctAnswer,
              explanation: q.analysis,
              points: q.points || 1,
            },
          });
        }
      }

      // 调用完成学习API（含错题数据）
      completeLearning(quizScore, quizAnswers);
    }
  }, [data, currentSceneIndex, completeLearning]);

  // 场景切换函数 - 添加触觉反馈
  const goToNextScene = useCallback(() => {
    if (data && currentSceneIndex < data.scenes.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      translateX.value = withTiming(-screenWidth, { duration: 200 }, (finished) => {
        if (finished) {
          playbackEngineRef.current?.nextScene();
          translateX.value = 0;
        }
      });
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [data, currentSceneIndex, screenWidth]);

  const goToPrevScene = useCallback(() => {
    if (currentSceneIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      translateX.value = withTiming(screenWidth, { duration: 200 }, (finished) => {
        if (finished) {
          playbackEngineRef.current?.prevScene();
          translateX.value = 0;
        }
      });
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [currentSceneIndex, screenWidth]);

  // 手势导航 - 使用 Gesture Handler
  const panGesture = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .onEnd((event) => {
      if (event.translationX > 50) {
        goToPrevScene();
      } else if (event.translationX < -50) {
        goToNextScene();
      }
    });

  // 缩放手势 - 用于查看幻灯片细节
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
      } else if (scale.value > 3) {
        scale.value = withSpring(3);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      savedScale.value = scale.value;
    });

  // 组合手势
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // 动画样式
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  // 后台创建剩余场景（从API获取大纲 - 更可靠）
  async function createAllScenesInBackground(outlines: SceneOutline[]) {
    if (!id || !outlines || outlines.length === 0 || backgroundCreatingRef.current) return;

    backgroundCreatingRef.current = true;
    setBackgroundCreating(true);
    setPendingScenesTotal(outlines.length);
    setCreatedScenesCount(0);

    const language = data?.stage?.language_directive || 'zh-CN';
    const initialCount = data?.scenes?.length || 0;
    console.log(`[Background] 并行创建 ${outlines.length} 个场景`);

    // SSE 实时监听场景创建进度（替代 5 秒轮询）
    let eventSource: EventSource | null = null;
    try {
      const sseUrl = `${apiClient.getBaseUrl()}/classrooms/${id}/scenes/progress`;
      eventSource = new EventSource(sseUrl);
      eventSource.onmessage = (e) => {
        try {
          const progress = JSON.parse(e.data);
          if (progress.status === 'connected') return;
          if (progress.status === 'done' || progress.status === 'timeout') {
            eventSource?.close();
            eventSource = null;
            return;
          }
          if (progress.completed !== undefined) {
            setCreatedScenesCount(progress.completed);
            // 每 2 个场景或最后一个刷新一次完整数据
            if (progress.completed % 2 === 0 || progress.completed >= progress.total) {
              apiClient.getClassroom(id).then(d => d && setData(d)).catch(() => {});
            }
          }
        } catch {}
      };
      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        // SSE 失败时降级为轮询
        console.log('[Background] SSE 连接失败，降级为轮询');
        const pollInterval = setInterval(async () => {
          try {
            const pollData = await apiClient.getClassroom(id);
            setData(pollData);
            const created = (pollData?.scenes?.length || 0) - initialCount;
            setCreatedScenesCount(created);
            if (created >= outlines.length) clearInterval(pollInterval);
          } catch {}
        }, 5000);
        // 5 分钟后自动停止轮询
        setTimeout(() => clearInterval(pollInterval), 300000);
      };
    } catch {
      // SSE 不可用，不阻塞主流程
    }

    try {
      await apiClient.createAllScenes(id, outlines, language);
      eventSource?.close();
      const finalData = await apiClient.getClassroom(id);
      setData(finalData);
      setCreatedScenesCount((finalData?.scenes?.length || 0) - initialCount);
      console.log(`[Background] 所有场景创建完成`);
    } catch (err: any) {
      eventSource?.close();
      showError(err);
      console.error('[Background] 并行创建失败，尝试逐个创建:', err.message);

      // 降级：逐个创建未完成的场景
      const freshData = await apiClient.getClassroom(id);
      setData(freshData);
      const existingScenes = freshData?.scenes?.length || 0;
      const remaining = outlines.length - (existingScenes - (freshData?.scenes?.length || 0));

      for (let i = 0; i < remaining; i++) {
        try {
          const currentData = await apiClient.getClassroom(id);
          const currentCount = currentData?.scenes?.length || 0;
          await apiClient.createScene(id, outlines[outlines.length - remaining + i], currentCount + 1, language);
          setCreatedScenesCount(existingScenes + i + 1);
          if ((i + 1) % 2 === 0 || i === remaining - 1) {
            setData(await apiClient.getClassroom(id));
          }
        } catch (sceneErr: any) {
          showError(sceneErr);
          console.warn(`[Background] 场景创建失败:`, sceneErr.message);
        }
      }
      setData(await apiClient.getClassroom(id));
    } finally {
      backgroundCreatingRef.current = false;
      setBackgroundCreating(false);
    }
  }

  async function loadClassroom() {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const classroomData = await apiClient.getClassroom(id);
      setData(classroomData);

      // 加载智能体配置 - 从 API 获取完整配置
      await loadAgents(classroomData);

      // 如果有待创建的场景，启动后台创建
      const pendingOutlinesParam = pendingOutlines;
      const pendingOutlinesFromAPI = classroomData.stage?.pendingOutlines;
      const remainingCountParam = remainingCount ? parseInt(remainingCount) : 0;

      // 关键：使用刚获取的 classroomData 判断场景数量
      const existingSceneCount = classroomData.scenes?.length || 0;
      const expectedTotal = totalScenes ? parseInt(totalScenes) : (pendingOutlinesFromAPI?.length || 0);

      console.log(`[LoadClassroom] existingSceneCount: ${existingSceneCount}, expectedTotal: ${expectedTotal}`);

      // 检查是否已完成所有场景创建（避免刷新时重复创建）
      if (expectedTotal > 0 && existingSceneCount >= expectedTotal) {
        console.log(`[LoadClassroom] 所有场景已创建完成 (${existingSceneCount}/${expectedTotal})，跳过后台创建`);
        setShowManualCreateHint(false);
        return;
      }

      // 优先使用从API获取的大纲（更可靠）
      if (pendingOutlinesFromAPI && pendingOutlinesFromAPI.length > 0 && !backgroundCreatingRef.current) {
        // 幂等保护：如果已有部分场景，说明上一次创建被中断，不要重新创建全部
        if (existingSceneCount > 0) {
          console.log(`[LoadClassroom] 已有 ${existingSceneCount} 个场景，pending_outlines 仍有 ${pendingOutlinesFromAPI.length} 项——可能创建中刷新，跳过重复创建`);
          setShowManualCreateHint(false);
          return;
        }
        console.log('[LoadClassroom] Starting parallel scene creation from API outlines...');
        setShowManualCreateHint(false);
        createAllScenesInBackground(pendingOutlinesFromAPI);
      } else if (pendingOutlinesParam && !backgroundCreatingRef.current) {
        // 有完整大纲数据（URL参数），解析后并行创建
        // 幂等保护：已有场景时跳过（创建中刷新场景）
        if (existingSceneCount > 0) {
          console.log(`[LoadClassroom] 已有 ${existingSceneCount} 个场景，URL 参数大纲跳过`);
          setShowManualCreateHint(false);
          return;
        }
        console.log('[LoadClassroom] Starting parallel scene creation from URL param...');
        setShowManualCreateHint(false);
        try {
          const decoded = JSON.parse(decodeURIComponent(pendingOutlinesParam));
          if (Array.isArray(decoded) && decoded.length > 0) {
            createAllScenesInBackground(decoded);
          }
        } catch (parseErr) {
          console.error('[LoadClassroom] JSON解析失败:', parseErr);
        }
      } else if (remainingCountParam > 0 && !backgroundCreatingRef.current) {
        // 只有剩余数量，显示手动创建提示
        console.log(`[LoadClassroom] ${remainingCountParam} scenes remaining, showing manual create hint`);
        setPendingScenesTotal(remainingCountParam);
        setShowManualCreateHint(true);
      } else {
        console.log('[LoadClassroom] No pending outlines to create');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadAgents(classroomData: ClassroomData) {
    // 定义统一的默认 fallback agents（4个）
    const defaultFallbackAgents: Agent[] = [
      { id: 'teacher', name: '张老师', role: 'teacher', color: '#5b9bd5', persona: '主讲教师，讲解清晰有条理', avatar: 'teacher.png', voiceConfig: { providerId: 'qwen', voiceId: 'longwanlong' } },
      { id: 'assistant', name: '李助教', role: 'assistant', color: '#10b981', persona: '辅助讲解，答疑解惑', avatar: 'assistant.png', voiceConfig: { providerId: 'qwen', voiceId: 'longzhiqi' } },
      { id: 'student1', name: '好奇小明', role: 'student', color: '#f59e0b', persona: '好奇心强，喜欢提问', avatar: 'student1.png', voiceConfig: { providerId: 'qwen', voiceId: 'longshuo' } },
      { id: 'student2', name: '学霸小红', role: 'student', color: '#8b5cf6', persona: '学霸型，理解能力强', avatar: 'student2.png', voiceConfig: { providerId: 'qwen', voiceId: 'longxiaochun' } },
    ];

    // 验证 agent 数据结构的辅助函数（强化验证）
    const validateAgent = (a: any): a is Agent => {
      if (!a || typeof a !== 'object') return false;

      // 有效的角色类型
      const validRoles = ['teacher', 'assistant', 'student'];

      // 验证必需字段存在且为非空字符串
      if (typeof a.id !== 'string' || a.id.length === 0) return false;
      if (typeof a.name !== 'string' || a.name.length === 0) return false;
      if (typeof a.role !== 'string' || !validRoles.includes(a.role)) return false;

      // 验证color字段（必须为字符串，格式验证在normalizeAgentColor中处理）
      if (typeof a.color !== 'string') return false;

      return true;
    };

    // 规范化 agent 颜色（确保格式正确）并补全 voiceConfig
    const DEFAULT_VOICE_MAP: Record<string, { providerId: string; voiceId: string }> = {
      teacher: { providerId: 'qwen', voiceId: 'longwanlong' },
      assistant: { providerId: 'qwen', voiceId: 'longzhiqi' },
      student: { providerId: 'qwen', voiceId: 'longshuo' },
    };
    const normalizeAgentColor = (a: Agent): Agent => {
      const validColor = isValidHexColor(a.color) ? a.color : '#888888';
      const voiceConfig = a.voiceConfig || DEFAULT_VOICE_MAP[a.role] || DEFAULT_VOICE_MAP.student;
      return { ...a, color: validColor, voiceConfig };
    };

    try {
      // 优先使用 stage.generatedAgentConfigs（生成时保存的配置）
      if (classroomData.stage?.generatedAgentConfigs && classroomData.stage.generatedAgentConfigs.length > 0) {
        const validAgents = classroomData.stage.generatedAgentConfigs.filter(validateAgent).map(normalizeAgentColor);
        if (validAgents.length > 0) {
          setAgents(validAgents);
          return;
        }
      }

      // 其次使用 API 返回的 agents（如果有）
      if (classroomData.agents && classroomData.agents.length > 0) {
        const validAgents = classroomData.agents.filter(validateAgent).map(normalizeAgentColor);
        if (validAgents.length > 0) {
          setAgents(validAgents);
          return;
        }
      }

      // 如果有 agent_ids，从默认 agents API 获取并按数量截取
      // 注意：agent_ids 是生成时指定的数量，而非具体 ID 列表
      const defaultAgents = await apiClient.getDefaultAgents('zh-CN');
      if (defaultAgents.agents && defaultAgents.agents.length > 0) {
        const validDefaultAgents = defaultAgents.agents.filter(validateAgent).map(normalizeAgentColor);
        const count = classroomData.stage?.agent_ids?.length ?? validDefaultAgents.length;
        setAgents(validDefaultAgents.slice(0, Math.min(count, validDefaultAgents.length)));
        return;
      }

      // API 失败，使用内置默认配置
      setAgents(defaultFallbackAgents);
    } catch (err) {
      showError(err);
      console.warn('Agent加载失败，使用默认:', err);
      // 降级到内置默认配置（保持一致的4个）
      setAgents(defaultFallbackAgents);
    }
  }

  // 初始化播放引擎
  const initPlaybackEngine = useCallback(() => {
    if (!data || !data.scenes) return;

    // 清理旧引擎
    if (playbackEngineRef.current) {
      playbackEngineRef.current.dispose();
    }

    // 创建新引擎（带 TTS 配置和视觉效果回调）
    playbackEngineRef.current = new PlaybackEngine(
      data.scenes,
      {
        onSceneChange: (index) => {
          setCurrentSceneIndex(index);
          // 更新已完成的场景数（当前场景之前的都算已完成）
          updateScenesCompleted(index);
          // 切换场景时清除视觉效果和交互状态（白板保留）
          setSpotlightElementId(null);
          setLaserElementId(null);
          setDiscussionHint(null);
          setAutoPlayVideoElementId(null);
        },
        onModeChange: (mode) => {
          setPlaybackMode(mode);
        },
        onComplete: () => {
          // 播放完成
        },
        onError: (error) => {
          console.error('[PlaybackEngine]', error);
        },
        onTTSGenerate: (audioId) => {
          console.log('[TTS] Generating...', audioId);
        },
        onTTSReady: (audioId) => {
          console.log('[TTS] Ready', audioId);
        },
        // 视觉效果回调
        onSpotlight: (elementId, _dimness) => {
          setSpotlightElementId(elementId);
          setLaserElementId(null); // 清除激光笔
        },
        onLaser: (elementId, color) => {
          setLaserElementId(elementId);
          setLaserOptions({ color: color || '#ff3b30' });
        },
        onClearEffects: () => {
          setSpotlightElementId(null);
          setLaserElementId(null);
        },
        // 白板回调（与Web端对齐）
        onWhiteboardAction: (action) => {
          if (whiteboardStore.isEmpty()) {
            console.log('[Whiteboard] First whiteboard action, resetting layout');
            mobileActionEngine.resetLayout();
          }
          mobileActionEngine.execute(action.type, action.data ?? {});
          setShowWhiteboard(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onWhiteboardOpen: () => {
          setShowWhiteboard(true);
        },
        onWhiteboardDelete: (elementId: string) => {
          whiteboardStore.deleteElement(elementId);
        },
        // onWhiteboardClear/onWhiteboardClose 已移除——白板不自动关闭/清空，由用户手动操作
        onDiscussionTrigger: (topic: string, prompt?: string, agentId?: string) => {
          // Show discussion hint badge — non-blocking
          setDiscussionHint({ topic, prompt, agentId });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onPlayVideo: (elementId: string) => {
          setAutoPlayVideoElementId(elementId);
        },
        // Widget actions — inject JS into InteractiveWebView
        onWidgetAction: (type: string, payload: Record<string, unknown>) => {
          interactiveWebViewRef.current?.sendWidgetMessage(type, payload);
        },
      },
      ttsConfig
    );
  }, [data]);

  // 当数据加载完成后初始化引擎
  useEffect(() => {
    if (data && !loading) {
      initPlaybackEngine();
    }
  }, [data, loading, initPlaybackEngine]);

  // 自动播放
  useEffect(() => {
    if (playbackEngineRef.current && autoPlayEnabled && playbackMode === 'idle' && data) {
      playbackEngineRef.current.playCurrentScene();
    }
  }, [autoPlayEnabled, playbackMode, data]);

  // 清理引擎和白板状态
  useEffect(() => {
    return () => {
      playbackEngineRef.current?.dispose();
      mobileActionEngine.resetLayout();
      whiteboardStore.clearAll();
    };
  }, []);

  // 当前场景（用于各种函数，必须在条件返回之前定义）
  // 注意：data 可能为 null，所以使用可选链
  const currentScene = data?.scenes?.[currentSceneIndex];

  // Interactive widget HTML — 仅在 widgetType 场景时计算
  const widgetHtml = useMemo(() => {
    if (currentScene?.type !== 'interactive') return null;
    const content = currentScene?.content as InteractiveContent;
    if (!content?.widgetType) return null;
    const params = content.widgetParams ?? getDefaultParams(content.widgetType);
    return renderWidget(content.widgetType, params);
  }, [currentScene]);

  function goToScene(index: number) {
    if (index !== currentSceneIndex) {
      // 重置 WebView 状态（防止场景切换时状态泄漏）
      interactiveWebViewRef.current?.reload();
      playbackEngineRef.current?.jumpToScene(index);
      setShowThumbnailNav(false);
      // 重置测验状态（新的场景会在useEffect中恢复持久化状态）
      setQuizFlow({ currentIndex: 0, questions: {}, phase: 'active', showAnalysis: false });
    }
  }

  // 统一的白板动作处理（Chat 和 Discussion 模式共用）
  const handleWhiteboardAction = useCallback((actionName: string, params: any, context: 'Chat' | 'Discussion') => {
    if (actionName === 'wb_clear') {
      // 不自动清空——只有用户手动清空才执行
      return;
    } else if (actionName === 'wb_close') {
      // 不自动关闭/清空——白板内容保留供学生回顾
      return;
    } else if (actionName.startsWith('wb_')) {
      // 如果是第一次添加白板内容，先重置布局
      if (whiteboardStore.isEmpty()) {
        console.log(`[${context}] First whiteboard action, resetting layout`);
        mobileActionEngine.resetLayout();
      }
      mobileActionEngine.execute(actionName, params);
      setShowWhiteboard(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  // Interactive/PBL 场景 WebView 回调
  const handleInteractiveComplete = useCallback((data: any) => {
    // 触觉反馈已在 InteractiveWebView 组件中触发，此处仅记录日志
  }, []);

  const handleInteractiveMessage = useCallback((data: any) => {
    // Message handled internally
  }, []);

  // 测验交互函数 - Duolingo 逐题模式

  // 选择题：选择后立即评分
  const handleAnswerChoice = (questionId: string, optionValue: string, isMultiple: boolean = false) => {
    const questions = (currentScene?.content as QuizContent)?.questions;
    if (!questions) return;
    const q = questions.find(qq => qq.id === questionId);
    if (!q) return;

    if (isMultiple) {
      // 多选题：切换选项，不立即评分
      const currentQState = quizFlow.questions[questionId];
      const currentAnswer = currentQState?.answer ?? [];
      const currentValues = toArray(currentAnswer);
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter(v => v !== optionValue)
        : [...currentValues, optionValue];

      setQuizFlow(prev => ({
        ...prev,
        questions: {
          ...prev.questions,
          [questionId]: { phase: 'answering', answer: newValues },
        },
      }));

      // 持久化草稿
      if (currentScene?.id) {
        const allDrafts: Record<string, string | string[]> = {};
        Object.entries(quizFlow.questions).forEach(([qId, qs]) => {
          if (qId !== questionId) allDrafts[qId] = qs.answer;
        });
        allDrafts[questionId] = newValues;
        writeDraft(currentScene.id, allDrafts);
      }
    } else {
      // 单选题：立即评分
      const userAnswer = [optionValue];
      const correctAnswer = toArray(q.answer);
      const correct = arraysEqual(userAnswer, correctAnswer);
      const pts = q.points ?? 1;

      let correctAnswerDisplay: string | undefined;
      if (q.options) {
        const matched = q.options.filter(o => correctAnswer.includes(o.value));
        correctAnswerDisplay = matched.map(o => o.label).join('、');
      }

      setQuizFlow(prev => {
        const updated: QuizFlowState = {
          ...prev,
          questions: {
            ...prev.questions,
            [questionId]: {
              phase: 'feedback' as const,
              answer: optionValue,
              result: { correct, earned: correct ? pts : 0, correctAnswer: correctAnswerDisplay },
            },
          },
        };
        // 持久化
        persistQuizProgress(updated.questions, questionId, optionValue, correct, correct ? pts : 0, correctAnswerDisplay);
        return updated;
      });

      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
    }
  };

  // 多选题：确认选择后评分
  const handleConfirmMultiple = (questionId: string) => {
    const questions = (currentScene?.content as QuizContent)?.questions;
    if (!questions) return;
    const q = questions.find(qq => qq.id === questionId);
    if (!q) return;
    const qState = quizFlow.questions[questionId];
    if (!qState || qState.phase !== 'answering') return;

    const userAnswer = toArray(qState.answer);
    if (userAnswer.length === 0) return;

    const correctAnswer = toArray(q.answer);
    const correct = arraysEqual(userAnswer, correctAnswer);
    const pts = q.points ?? 1;

    let correctAnswerDisplay: string | undefined;
    if (q.options) {
      const matched = q.options.filter(o => correctAnswer.includes(o.value));
      correctAnswerDisplay = matched.map(o => o.label).join('、');
    }

    setQuizFlow(prev => {
      const updated: QuizFlowState = {
        ...prev,
        questions: {
          ...prev.questions,
          [questionId]: {
            ...prev.questions[questionId],
            phase: 'feedback' as const,
            result: { correct, earned: correct ? pts : 0, correctAnswer: correctAnswerDisplay },
          },
        },
      };
      persistQuizProgress(updated.questions, questionId, qState.answer, correct, correct ? pts : 0, correctAnswerDisplay);
      return updated;
    });

    Haptics.notificationAsync(
      correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );
  };

  // 简答题：更新文本
  const handleShortAnswerInput = (questionId: string, text: string) => {
    setQuizFlow(prev => ({
      ...prev,
      questions: {
        ...prev.questions,
        [questionId]: { phase: 'answering', answer: text },
      },
    }));

    // 持久化草稿
    if (currentScene?.id) {
      const allDrafts: Record<string, string | string[]> = {};
      Object.entries(quizFlow.questions).forEach(([qId, qs]) => {
        if (qId !== questionId) allDrafts[qId] = qs.answer;
      });
      allDrafts[questionId] = text;
      writeDraft(currentScene.id, allDrafts);
    }
  };

  // 简答题：提交并调用AI评分
  const handleConfirmShortAnswer = async (questionId: string) => {
    const questions = (currentScene?.content as QuizContent)?.questions;
    if (!questions) return;
    const q = questions.find(qq => qq.id === questionId);
    if (!q) return;
    const qState = quizFlow.questions[questionId];
    if (!qState || qState.phase !== 'answering') return;

    const userAnswer = typeof qState.answer === 'string' ? qState.answer : '';
    if (!userAnswer.trim()) {
      showError('请输入答案后再提交');
      return;
    }

    // 进入评分阶段
    setQuizFlow(prev => ({
      ...prev,
      questions: {
        ...prev.questions,
        [questionId]: { ...prev.questions[questionId], phase: 'grading' },
      },
    }));

    const pts = q.points ?? 1;

    try {
      const lang = data?.stage?.language_directive?.includes('zh') ? 'zh-CN' : 'en-US';
      const res = await apiClient.post('/quiz-grade', {
        question: q.question,
        userAnswer,
        points: pts,
        commentPrompt: q.commentPrompt,
        language: lang,
      });

      const earned = Math.max(0, Math.min(pts, res.data?.score || 0));
      const correct = earned >= pts * 0.8;

      setQuizFlow(prev => {
        const updated: QuizFlowState = {
          ...prev,
          questions: {
            ...prev.questions,
            [questionId]: {
              ...prev.questions[questionId],
              phase: 'feedback' as const,
              result: { correct, earned, aiComment: res.data?.comment },
            },
          },
        };
        persistQuizProgress(updated.questions, questionId, qState.answer, correct, earned, undefined, res.data?.comment);
        return updated;
      });

      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
    } catch (error) {
      console.error('[Quiz] AI grading failed:', error);
      setQuizFlow(prev => {
        const updated: QuizFlowState = {
          ...prev,
          questions: {
            ...prev.questions,
            [questionId]: {
              ...prev.questions[questionId],
              phase: 'feedback' as const,
              result: { correct: false, earned: Math.round(pts * 0.5), aiComment: '评分服务暂时不可用，已给予基础分。' },
            },
          },
        };
        persistQuizProgress(updated.questions, questionId, qState.answer, false, Math.round(pts * 0.5), undefined, '评分服务暂时不可用');
        return updated;
      });
    }
  };

  // 前进到下一题
  const advanceToNextQuestion = (completedQuestionId: string) => {
    const questions = (currentScene?.content as QuizContent)?.questions;
    if (!questions) return;

    setQuizFlow(prev => {
      const updated = {
        ...prev,
        questions: {
          ...prev.questions,
          [completedQuestionId]: { ...prev.questions[completedQuestionId], phase: 'completed' as const },
        },
      };

      // 跳过已完成的题目，找到下一个未完成的
      let nextIndex = prev.currentIndex + 1;
      while (nextIndex < questions.length) {
        const nextQ = questions[nextIndex];
        const nextQS = updated.questions[nextQ.id];
        if (!nextQS || nextQS.phase === 'answering') break;
        nextIndex++;
      }

      if (nextIndex >= questions.length) {
        // 检查是否所有题目都已完成
        const allCompleted = questions.every(q => updated.questions[q.id]?.phase === 'completed' || updated.questions[q.id]?.phase === 'feedback');
        if (allCompleted) {
          return { ...updated, phase: 'summary' as const };
        }
        // 回到第一个未完成的题目
        const firstUnfinished = questions.findIndex(q => {
          const qs = updated.questions[q.id];
          return !qs || qs.phase === 'answering';
        });
        if (firstUnfinished >= 0) {
          return { ...updated, currentIndex: firstUnfinished };
        }
        return { ...updated, phase: 'summary' as const };
      }
      return { ...updated, currentIndex: nextIndex };
    });
  };

  // 持久化测验进度
  const persistQuizProgress = async (
    currentQuestions: Record<string, QuestionState>,
    questionId: string,
    answer: string | string[],
    correct: boolean,
    earned: number,
    correctAnswer?: string,
    aiComment?: string,
  ) => {
    if (!currentScene?.id) return;

    const allAnswers: Record<string, string | string[]> = {};
    const allResults: QuestionResult[] = [];
    Object.entries(currentQuestions).forEach(([qId, qs]) => {
      if (qs.phase !== 'answering' || qId === questionId) {
        allAnswers[qId] = qId === questionId ? answer : qs.answer;
      }
      if (qs.result && qId !== questionId) {
        allResults.push({ questionId: qId, correct: qs.result.correct, feedback: qs.result.aiComment });
      }
    });
    allAnswers[questionId] = answer;
    allResults.push({ questionId, correct, feedback: aiComment });

    await writeSubmittedAnswers(currentScene.id, allAnswers);
    await writeSubmittedResults(currentScene.id, allResults);
  };

  const resetQuiz = async () => {
    setQuizFlow({ currentIndex: 0, questions: {}, phase: 'active', showAnalysis: false });
    if (currentScene?.id) {
      await clearSubmitted(currentScene.id);
    }
  };

  async function sendMessage() {
    if (!chatMessage.trim() || !selectedAgent) return;

    setSendingMessage(true);
    const userMessage = chatMessage.trim();
    setChatMessage('');

    // 添加用户消息
    setChatHistory(prev => [...prev, { agent: '我', message: userMessage }]);

    // 切换到讨论模式（多个 Agent 自动参与）
    setDiscussionMode(true);
    setDiscussionRunning(true);

    try {
      // 构建配置 - 使用 discussion 模式，让多个 Agent 参与
      const agentRoleIds = agents.slice(0, 3).map(a => a.role);
      console.log('[Chat] AgentRoleIds:', agentRoleIds);

      // 确保角色不重复，并补齐缺失的角色
      const uniqueRoles = [...new Set(agentRoleIds)];
      const requiredRoles = ['teacher', 'student', 'assistant'];
      const finalRoles: string[] = [];

      // 先添加已有的角色
      uniqueRoles.forEach(r => {
        if (requiredRoles.includes(r)) finalRoles.push(r);
      });

      // 补齐缺失的角色
      requiredRoles.forEach(r => {
        if (!finalRoles.includes(r) && finalRoles.length < 3) finalRoles.push(r);
      });

      if (uniqueRoles.length !== agentRoleIds.length) {
        console.warn('[Chat] Duplicate roles detected, fixed to:', finalRoles);
      }
      console.log('[Chat] FinalRoles:', finalRoles);

      const config = {
        sessionType: 'discussion' as const,
        agentIds: finalRoles,
        discussionTopic: userMessage,
        discussionPrompt: userMessage,
      };

      // 建立角色 ID 到 Agent 信息映射
      const agentInfoMap: Record<string, { name: string; persona: string; color: string; voiceConfig?: { providerId: string; voiceId: string } }> = {};
      agents.slice(0, 3).forEach(a => {
        agentInfoMap[a.role] = { name: a.name, persona: a.persona || '', color: a.color, voiceConfig: a.voiceConfig };
      });

      // 构建上下文
      const storeState = {
        stage: { name: data?.stage?.name || '' },
        scene: {
          title: currentScene?.title || '',
          content: currentScene?.content || {},
        },
      };

      console.log('[Chat] Starting discussion:', { agentIds: agentRoleIds, topic: userMessage.slice(0, 30) });

      await apiClient.streamAgentChat(
        [], // 讨论模式不需要 messages
        config,
        storeState,
        // onEvent - 处理 SSE 事件
        (event) => {
          if (event.type === 'agent_start') {
            const agentId = event.agentId || '';
            const agentInfo = agentInfoMap[agentId];
            setSpeakingAgentId(agentId);
            currentAgentTextRef.current = ''; // 清空累积文本
            setChatHistory(prev => [...prev, {
              agent: agentInfo?.name || agentId,
              agentId: agentId,
              message: '',
              persona: agentInfo?.persona,
            }]);
          } else if (event.type === 'text_delta') {
            const chunk = cleanJsonFromText(event.content || '');
            const eventAgentId: string = event.agentId ?? (speakingAgentId || '');
            if (!chunk) return;
            currentAgentTextRef.current += chunk; // 累积文本
            setChatHistory(prev => {
              const lastEntry = prev[prev.length - 1];
              if (lastEntry && lastEntry.agentId === eventAgentId) {
                return [...prev.slice(0, -1), {
                  ...lastEntry,
                  message: lastEntry.message + chunk,
                }];
              }
              // 如果找不到对应的 agent，创建一个新的
              const agentInfo = agentInfoMap[eventAgentId];
              if (agentInfo) {
                return [...prev, {
                  agent: agentInfo.name,
                  agentId: eventAgentId,
                  message: chunk,
                  persona: agentInfo.persona,
                }];
              }
              return prev;
            });
          } else if (event.type === 'action') {
            const actionName = event.actionName || '';
            const params = event.params || {};
            console.log('[Chat] Action:', actionName);
            handleWhiteboardAction(actionName, params, 'Chat');
          } else if (event.type === 'agent_end') {
            const agentId = event.agentId || '';
            setSpeakingAgentId(null);
            // TTS播放Agent发言 — 统一使用课程音色
            const textToSpeak = cleanTTSContent(currentAgentTextRef.current.trim());
            if (textToSpeak) {
              console.log('[TTS] Speaking agent text:', textToSpeak.slice(0, 50));
              const agentVC = agentInfoMap[agentId]?.voiceConfig;
              if (agentVC?.voiceId) {
                // Agent 有独立 voiceConfig — 使用其音色
                playDiscussionTTS(textToSpeak, agentVC);
              } else {
                // 使用课程统一音色（PlaybackEngine 同款）
                playDiscussionTTS(textToSpeak, { providerId: ttsConfig.provider, voiceId: ttsConfig.voice });
              }
            }
            // 保存聊天记录
            if (currentScene && textToSpeak) {
              const entry: ChatEntry = {
                id: `${Date.now()}-${agentId}`,
                agent: agentInfoMap[agentId]?.name || agentId,
                agentId,
                message: textToSpeak,
                persona: agentInfoMap[agentId]?.persona,
                timestamp: Date.now(),
              };
              appendChatEntry(currentScene.id, entry).catch(err => {
                console.warn('[Chat] Failed to save history:', err);
              });
            }
          }
        },
        // onComplete
        () => {
          setSendingMessage(false);
          setDiscussionRunning(false);
          setDiscussionMode(false);
        },
        // onError
        (error) => {
          console.error('[Chat] Error:', error);
          setSendingMessage(false);
          setDiscussionRunning(false);
          setDiscussionMode(false);
          setChatHistory(prev => [...prev, {
            agent: '系统',
            message: `对话出错：${error}`,
          }]);
        }
      );
    } catch (err: any) {
      showError(err);
      console.error('[Chat] Failed:', err);
      setSendingMessage(false);
      setDiscussionRunning(false);
      setDiscussionMode(false);
      setChatHistory(prev => [...prev, {
        agent: '系统',
        message: `对话出错：${err.message || '网络错误'}`,
      }]);
    }
  }

  // 打开智能体聊天 - 加载历史记录
  async function openAgentChat(agent: Agent) {
    setSelectedAgent(agent);
    setDiscussionMode(false);
    setShowChatModal(true);
    // 加载当前场景的聊天历史
    if (currentScene?.id) {
      try {
        const history = await readChatHistory(currentScene.id);
        setChatHistory(history);
      } catch (err) {
        showError(err);
        console.warn('[Chat] Failed to load history:', err);
        setChatHistory([]);
      }
    }
  }

  // 构建讨论主题（包含场景上下文）
  function buildDiscussionTopic(scene: Scene | undefined): string {
    if (!scene) return '课程主题讨论';

    const title = scene.title;
    const interactiveContent = scene.type === 'interactive' ? (scene.content as InteractiveContent) : null;
    const description = interactiveContent?.description || '';
    const keyPoints = interactiveContent?.key_points || [];

    // 构建包含上下文的讨论主题
    let topic = title;
    if (description) {
      topic += `\n背景：${description}`;
    }
    if (keyPoints.length > 0) {
      topic += `\n讨论要点：${keyPoints.join('、')}`;
    }

    return topic;
  }

  // 加载讨论历史记录
  async function loadDiscussionHistory() {
    if (!currentScene) return;
    try {
      const history = await readDiscussionHistory(currentScene.id);
      if (history.length > 0) {
        setChatHistory(history.map(entry => ({
          agent: entry.agent,
          agentId: entry.agentId,
          message: entry.message,
          persona: entry.persona,
        })));
        setHasDiscussionHistory(true);
        setShowChatModal(true);
        setDiscussionMode(true);
      } else {
        showError('当前场景暂无讨论历史记录');
      }
    } catch (err) {
      showError(err);
      console.warn('[Discussion] Failed to load history:', err);
      showError('加载讨论历史失败');
    }
  }

// 开始多 Agent 讨论（分批调用，每个 agent 一次请求）
  async function startMultiAgentDiscussion(topic: string) {
    setDiscussionMode(true);
    setDiscussionRunning(true);
    setWaitingForAgent(true);
    setShowChatModal(true);
    setChatHistory([{ agent: '系统', message: `开始讨论：${topic.split('\n')[0]}\n\n正在等待智能体响应...` }]);
    setWhiteboardTextContent(null);

    // 只使用 2 个 agent，减少时间
    const discussionAgents = agents.slice(0, 2);

    // 建立角色信息映射
    const agentInfoMap: Record<string, { name: string; persona: string; color: string; voiceConfig?: { providerId: string; voiceId: string } }> = {};
    discussionAgents.forEach(a => {
      agentInfoMap[a.role] = { name: a.name, persona: a.persona || '', color: a.color, voiceConfig: a.voiceConfig };
    });

    // 场景上下文
    const interactiveCtx = currentScene?.type === 'interactive' ? (currentScene?.content as InteractiveContent) : null;
    const context = {
      scene_title: currentScene?.title || '',
      description: interactiveCtx?.description || '',
      key_points: interactiveCtx?.key_points || [],
    };

    console.log('[Discussion] Batch mode - agents:', discussionAgents.length);

    // 保存所有回复（用于后续 agent 的上下文）
    const allResponses: Array<{ agent: string; agentId: string; content: string }> = [];

    try {
      // 依次调用每个 agent（分批处理）
      for (const agent of discussionAgents) {
        const agentRole = agent.role;
        const agentInfo = agentInfoMap[agentRole];

        console.log('[Discussion] Calling agent:', agentRole);
        currentAgentTextRef.current = '';

        try {
          // 调用单 agent API
          await apiClient.streamSingleAgent(
            agentRole,
            agentRole,
            topic,
            allResponses,
            context,
            // onEvent
            (event) => {
              if (event.type === 'agent_start') {
                setWaitingForAgent(false);
                setSpeakingAgentId(agentRole);
                setChatHistory(prev => [...prev, {
                  agent: agentInfo?.name || agentRole,
                  agentId: agentRole,
                  message: '',
                  persona: agentInfo?.persona,
                }]);
              } else if (event.type === 'text_delta') {
                const chunk = cleanJsonFromText(event.content || '');
                if (!chunk) return;
                currentAgentTextRef.current += chunk;
                setChatHistory(prev => {
                  const lastEntry = prev[prev.length - 1];
                  if (lastEntry && lastEntry.agentId === agentRole) {
                    return [...prev.slice(0, -1), { ...lastEntry, message: lastEntry.message + chunk }];
                  }
                  return prev;
                });
              } else if (event.type === 'action') {
                handleDiscussionAction(event.actionName || '', event.params || {});
              } else if (event.type === 'agent_end') {
                setSpeakingAgentId(null);
                const text = cleanTTSContent(cleanJsonFromText(currentAgentTextRef.current.trim()));
                if (text) {
                  allResponses.push({ agent: agentInfo?.name || agentRole, agentId: agentRole, content: text });
                  // TTS — 统一使用课程音色
                  if (agentInfo?.voiceConfig?.voiceId) {
                    playDiscussionTTS(text, agentInfo.voiceConfig);
                  } else {
                    playDiscussionTTS(text, { providerId: ttsConfig.provider, voiceId: ttsConfig.voice });
                  }
                  // 保存历史
                  if (currentScene) {
                    appendDiscussionEntry(currentScene.id, {
                      id: `${Date.now()}-${agentRole}`,
                      agent: agentInfo?.name || agentRole,
                      agentId: agentRole,
                      message: text,
                      persona: agentInfo?.persona,
                      timestamp: Date.now(),
                    }).catch(() => {});
                  }
                }
              }
            },
            () => console.log('[Discussion] Agent done:', agentRole),
            (error) => {
              console.error('[Discussion] Agent error:', error);
              setChatHistory(prev => [...prev, { agent: '系统', message: `${agentInfo?.name} 响应出错` }]);
            }
          );
        } catch (err) {
          showError(err);
          console.error('[Discussion] Agent call failed:', err);
          setChatHistory(prev => [...prev, { agent: '系统', message: `${agentInfo?.name} 连接失败，继续下一个...` }]);
        }

        setWaitingForAgent(true);
        setSpeakingAgentId(null);
        await new Promise(r => setTimeout(r, 300));
      }

      // 完成
      setDiscussionRunning(false);
      setWaitingForAgent(false);
      setHasDiscussionHistory(true);
      setChatHistory(prev => [...prev, { agent: '系统', message: '讨论结束' }]);
    } catch (err: any) {
      showError(err);
      console.error('[Discussion] Batch failed:', err);
      setDiscussionRunning(false);
      setWaitingForAgent(false);
      setChatHistory(prev => [...prev, { agent: '系统', message: `讨论出错：${err.message}` }]);
    }
  }

  // 处理讨论中的 action
  function handleDiscussionAction(actionName: string, params: any) {
    handleWhiteboardAction(actionName, params, 'Discussion');
  }

  // 播放讨论 TTS — 统一使用课程音色和语速
  function playDiscussionTTS(text: string, voiceConfig: { providerId: string; voiceId: string }) {
    if (!discussionAudioPlayerRef.current) {
      discussionAudioPlayerRef.current = new AudioPlayer({ onPlayEnd: () => {}, onError: () => {} });
    }
    apiClient.generateTTS(text, `disc_${Date.now()}`, voiceConfig.providerId || ttsConfig.provider, voiceConfig.voiceId, ttsConfig.speed)
      .then(res => {
        if (res.success && res.base64) {
          Platform.OS === 'web'
            ? discussionAudioPlayerRef.current?.cacheAudio(res.audioId, res.base64, res.format)
            : saveAudioFile(res.audioId, res.base64, res.format);
          discussionAudioPlayerRef.current?.play(res.audioId, res.format);
        }
      }).catch(() => Speech.speak(text.slice(0, 200), { language: 'zh-CN' }));
  }  // 提取当前场景知识点
  async function extractKnowledge() {
    if (!currentScene) return;

    setExtractingKnowledge(true);
    try {
      const result = await apiClient.extractKnowledgeFromScene(currentScene.id);
      if (result.created_cards && result.created_cards.length > 0) {
        setExtractedCards(result.created_cards);
        setShowExtractResult(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        showError('未提取到新的知识点');
      }
    } catch (err: any) {
      showError(err.response?.data?.detail || 'AI服务暂时不可用');
    } finally {
      setExtractingKnowledge(false);
    }
  }

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5b9bd5" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>请先登录</Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.replace('/auth/login')}
        >
          <Text style={styles.loginButtonText}>去登录</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5b9bd5" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>加载失败: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadClassroom}>
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.container}>
        {/* 后台创建场景进度提示 */}
        {backgroundCreating && (
          <View style={styles.backgroundCreatingBanner}>
            <ActivityIndicator size="small" color={Colors.secondary.info} />
            <Text style={styles.backgroundCreatingText}>
              正在创建其他场景 ({createdScenesCount}/{pendingScenesTotal})...
            </Text>
          </View>
        )}

        {/* 手动创建提示（当大纲数据太大无法通过URL传递时） */}
        {showManualCreateHint && !backgroundCreating && (
          <View style={styles.manualCreateBanner}>
            <Ionicons name="information-circle" size={20} color={Colors.accent.main} />
            <Text style={styles.manualCreateText}>
              还有 {pendingScenesTotal} 个场景待创建
            </Text>
            <TouchableOpacity
              style={styles.manualCreateBtn}
              onPress={() => {
                confirmAction('创建剩余场景', `将创建 ${pendingScenesTotal} 个场景，预计需要 ${pendingScenesTotal * 3} 分钟`, () => {
                        setShowManualCreateHint(false);
                        showError('请返回创建页面重新生成课程，或手动添加场景');
                      }, '开始创建');
              }}
            >
              <Text style={styles.manualCreateBtnText}>查看详情</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 头部：标题 */}
        <View style={[styles.header, isLandscape && styles.headerLandscape, isCompactMode && styles.headerCompact]}>
          <Text style={[styles.title, isCompactMode && styles.titleCompact]}>{data.stage.name}</Text>
          {/* 后台讨论进行中的指示器 */}
          {discussionRunning && !showChatModal && (
            <TouchableOpacity
              style={styles.discussionRunningBadge}
              onPress={() => setShowChatModal(true)}
            >
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.discussionRunningBadgeText}>讨论进行中</Text>
            </TouchableOpacity>
          )}
          {discussionHint && !discussionRunning && !showChatModal && (
            <TouchableOpacity
              style={styles.discussionHintBadge}
              onPress={() => {
                startMultiAgentDiscussion(discussionHint.topic);
                setDiscussionHint(null);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubbles" size={16} color="#fff" />
              <Text style={styles.discussionHintText}>参与讨论</Text>
            </TouchableOpacity>
          )}
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>
              {currentSceneIndex + 1} / {data.scenes.length}
            </Text>
          </View>
        </View>

        {/* 场景内容 - 可滚动查看完整内容 */}
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentScrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <Animated.View style={[
            styles.contentInner,
            animatedStyle,
            isTablet && styles.contentInnerTablet
          ]}>
            {/* 课程完成场景：最后一个场景显示庆祝页面 */}
            {currentSceneIndex === (data?.scenes?.length ?? 0) - 1 && data?.scenes?.length > 1 ? (
              <ClassroomCompletePage
                scenes={data?.scenes || []}
                title={data?.stage?.name || ''}
                classroomId={id as string}
                quizAnswers={
                  (() => {
                    // 收集所有 quiz 场景的答题数据
                    const allAnswers: Record<string, Record<string, string | string[]>> = {};
                    for (const scene of (data?.scenes || [])) {
                      if (scene.type !== 'quiz') continue;
                      const qs = (scene.content as QuizContent)?.questions;
                      if (!qs) continue;
                      const sceneAnswers: Record<string, string | string[]> = {};
                      for (const q of qs) {
                        const qState = quizFlow.questions[q.id];
                        if (qState && qState.phase !== 'answering' && qState.answer !== undefined) {
                          sceneAnswers[q.id] = qState.answer;
                        }
                      }
                      if (Object.keys(sceneAnswers).length > 0) {
                        allAnswers[scene.id] = sceneAnswers;
                      }
                    }
                    return Object.keys(allAnswers).length > 0 ? allAnswers : undefined;
                  })()
                }
                onClose={() => goBack()}
              />
            ) : /* Slide类型：使用 ScreenCanvas 渲染 */
            currentScene?.type === 'slide' && (currentScene.content as any)?.canvas?.elements?.length > 0 ? (
              <ScreenCanvas
                elements={(currentScene.content as any)?.canvas?.elements || []}
                background={convertToSlideBackground((currentScene.content as any)?.canvas?.background)}
                theme={undefined}
                spotlightElementId={spotlightElementId}
                laserElementId={laserElementId}
                laserOptions={laserOptions}
                scrollable={true}  // 启用滚动模式，计算完整内容高度
              />
            ) : /* Quiz/Interactive 类型但有 canvas 内容：使用 ScreenCanvas 渲染 */ 
            currentScene?.type !== 'slide' && (currentScene?.content as any)?.canvas?.elements?.length > 0 && !((currentScene?.content as QuizContent)?.questions) ? (
              <View>
                <ScreenCanvas
                  elements={(currentScene?.content as any)?.canvas?.elements || []}
                  background={convertToSlideBackground((currentScene?.content as any)?.canvas?.background)}
                  theme={undefined}
                  spotlightElementId={spotlightElementId}
                  laserElementId={laserElementId}
                  laserOptions={laserOptions}
                  scrollable={true}
                />
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#9ca3af' }}>题目内容生成中，暂时展示幻灯片视图</Text>
                </View>
              </View>
            ) : (
          <View style={styles.emptySceneContainer}>
            <View style={styles.emptySceneCard}>
              <Ionicons
                name={
                  currentScene?.type === 'slide' ? 'document-text' :
                  currentScene?.type === 'quiz' ? 'help-circle' :
                  currentScene?.type === 'interactive' ? 'people' : 'bulb'
                }
                size={48}
                color={
                  currentScene?.type === 'slide' ? '#5b9bd5' :
                  currentScene?.type === 'quiz' ? '#f59e0b' :
                  currentScene?.type === 'interactive' ? '#10b981' : '#8b5cf6'
                }
              />
              <Text style={styles.emptySceneTitle}>{currentScene?.title}</Text>
              <Text style={styles.emptySceneHint}>
                {currentScene?.type === 'slide' ? '幻灯片内容' :
                 currentScene?.type === 'quiz' ? '测验场景' :
                 currentScene?.type === 'interactive' ? '互动场景' : '项目学习'}
              </Text>
            </View>
          </View>
        )}

        {/* Quiz 类型：Duolingo 逐题模式 */}
        {currentScene?.type === 'quiz' && (currentScene.content as QuizContent)?.questions && (() => {
          const quizQuestions = (currentScene?.content as QuizContent)?.questions as QuizQuestion[];
          const totalQuestions = quizQuestions.length;

          // 计算当前场景的得分（只统计当前场景的题目，避免多 quiz 场景数据串扰）
          const totalEarned = quizQuestions.reduce((sum, q) => sum + (quizFlow.questions[q.id]?.result?.earned ?? 0), 0);
          const totalPoints = quizQuestions.reduce((sum, q) => sum + (q.points ?? 1), 0);
          const correctCount = quizQuestions.filter(q => quizFlow.questions[q.id]?.result?.correct).length;

          // Summary 阶段：测验奖励效果卡片
          if (quizFlow.phase === 'summary') {
            const showAnalysis = quizFlow.showAnalysis;
            const percentage = totalPoints > 0 ? totalEarned / totalPoints : 0;
            const isPerfect = percentage >= 1;
            const isGreat = percentage >= 0.8;
            const isPass = percentage >= 0.6;

            // 根据得分率决定层级
            const level: QuizLevel = isPerfect ? 'perfect' : isGreat ? 'great' : isPass ? 'good' : 'retry';
            const config = QUIZ_LEVEL_CONFIG[level];

            return (
              <View style={styles.quizOverlay}>
                <ScrollView style={[styles.rewardCard, { borderColor: config.color }]} contentContainerStyle={styles.rewardCardContent} bounces={false}>
                  {/* 动画效果 */}
                  <View style={styles.rewardAnimationContainer}>
                    <Text style={styles.rewardEmoji}>{config.emoji}</Text>
                  </View>

                  {/* 激励标题 */}
                  <Text style={[styles.rewardTitle, { color: config.color }]}>{config.title}</Text>
                  <Text style={styles.rewardSubtitle}>{config.subtitle}</Text>

                  {/* 分数圆圈 */}
                  <View style={[styles.summaryScoreCircle, { borderColor: config.color, backgroundColor: config.bgColor }]}>
                    <Text style={[styles.summaryScoreText, { color: config.color }]}>{totalEarned}/{totalPoints}</Text>
                    <Text style={styles.summaryScoreLabel}>得分</Text>
                  </View>

                  {/* 正确率条 */}
                  <View style={styles.percentageBarContainer}>
                    <View style={styles.percentageBarBg}>
                      <View style={[styles.percentageBarFill, { width: `${Math.round(percentage * 100)}%`, backgroundColor: config.color }]} />
                    </View>
                    <Text style={[styles.percentageText, { color: config.color }]}>{Math.round(percentage * 100)}%</Text>
                  </View>

                  {/* 每题结果缩略 */}
                  <View style={styles.summaryQuestionGrid}>
                    {quizQuestions.map((q, idx) => {
                      const qState = quizFlow.questions[q.id];
                      const isCorrect = qState?.result?.correct;
                      return (
                        <TouchableOpacity
                          key={q.id}
                          style={[
                            styles.summaryQuestionChip,
                            { backgroundColor: isCorrect ? '#dcfce7' : '#fef2f2' },
                          ]}
                          onPress={() => setQuizFlow(prev => ({
                            ...prev,
                            currentIndex: idx,
                            phase: 'active',
                            questions: {
                              ...prev.questions,
                              [q.id]: { phase: 'answering', answer: prev.questions[q.id]?.answer ?? '' },
                            },
                          }))}
                        >
                          <Ionicons
                            name={isCorrect ? "checkmark-circle" : "close-circle"}
                            size={14}
                            color={isCorrect ? "#22c55e" : "#ef4444"}
                          />
                          <Text style={styles.summaryChipText}>{idx + 1}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* 展开的完整解析 */}
                  {showAnalysis && quizQuestions.map((q, idx) => {
                    const qState = quizFlow.questions[q.id];
                    const earned = qState?.result?.earned ?? 0;
                    const pts = q.points ?? 1;
                    const isCorrect = qState?.result?.correct;
                    const isShort = isShortAnswer(q);
                    const correctAnswers = toArray(q.answer);
                    const correctAnswerDisplay = !isShort && q.options
                      ? q.options.filter(o => correctAnswers.includes(o.value)).map(o => o.label).join('、')
                      : q.answer?.join('、');

                    return (
                      <View key={q.id} style={styles.analysisDetail}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Ionicons
                            name={isCorrect ? "checkmark-circle" : "close-circle"}
                            size={16}
                            color={isCorrect ? "#22c55e" : "#ef4444"}
                          />
                          <Text style={styles.analysisQuestionNum}>第{idx + 1}题</Text>
                          <Text style={styles.analysisPoints}>{earned}/{pts}</Text>
                        </View>
                        <Text style={styles.analysisQuestionText}>{q.question}</Text>

                        {isShort ? (
                          <>
                            <Text style={styles.analysisLabel}>你的答案</Text>
                            <Text style={styles.analysisValue}>{typeof qState?.answer === 'string' ? qState.answer : '未作答'}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.analysisLabel}>你的选择</Text>
                            <Text style={styles.analysisValue}>
                              {q.options?.filter(o => toArray(qState?.answer).includes(o.value)).map(o => o.label).join('、') || '未作答'}
                            </Text>
                          </>
                        )}

                        {!isCorrect && correctAnswerDisplay && (
                          <>
                            <Text style={styles.analysisLabel}>正确答案</Text>
                            <Text style={[styles.analysisValue, { color: '#16a34a' }]}>{correctAnswerDisplay}</Text>
                          </>
                        )}

                        {qState?.result?.aiComment && (
                          <>
                            <Text style={styles.analysisLabel}>AI 点评</Text>
                            <Text style={[styles.analysisValue, { color: '#2563eb' }]}>{qState.result.aiComment}</Text>
                          </>
                        )}

                        {q.analysis && (
                          <>
                            <Text style={styles.analysisLabel}>解析</Text>
                            <Text style={styles.analysisValue}>{q.analysis}</Text>
                          </>
                        )}
                      </View>
                    );
                  })}

                  {/* 操作按钮 */}
                  <TouchableOpacity
                    style={[styles.analysisButton, { backgroundColor: config.bgColor }]}
                    onPress={() => setQuizFlow(prev => ({ ...prev, showAnalysis: !prev.showAnalysis }))}
                  >
                    <Ionicons name={showAnalysis ? "chevron-up" : "document-text-outline"} size={18} color={config.color} />
                    <Text style={[styles.analysisButtonText, { color: config.color }]}>{showAnalysis ? '收起解析' : '查看完整解析'}</Text>
                  </TouchableOpacity>

                  <View style={styles.summaryActions}>
                    <TouchableOpacity style={styles.resetButton} onPress={resetQuiz}>
                      <Text style={styles.resetButtonText}>重新作答</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.continueButton, { backgroundColor: config.color }]} onPress={() => goToNextScene()}>
                      <Ionicons name="arrow-forward" size={18} color="white" />
                      <Text style={styles.continueButtonText}>继续学习</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            );
          }

          // Active 阶段：逐题卡片
          const currentQ = quizQuestions[quizFlow.currentIndex];
          if (!currentQ) return null;

          const qState = quizFlow.questions[currentQ.id];
          const phase = qState?.phase ?? 'answering';
          const isMultiple = isMultipleChoice(currentQ);
          const isShort = isShortAnswer(currentQ);
          const userAnswer = qState?.answer;
          const userAnswerArray = toArray(userAnswer);
          const result = qState?.result;

          return (
            <View style={styles.quizOverlay}>
              {/* 进度条 - 点击题号可跳回重答 */}
              <View style={styles.quizProgressBar}>
                {quizQuestions.map((q, idx) => {
                  const qs = quizFlow.questions[q.id];
                  let color = '#e5e7eb'; // 未答 - 灰色
                  if (qs?.phase === 'feedback' || qs?.phase === 'completed') {
                    color = qs?.result?.correct ? '#22c55e' : '#ef4444'; // 已答 - 绿/红
                  } else if (idx === quizFlow.currentIndex) {
                    color = '#3b82f6'; // 当前 - 蓝
                  } else if (qs?.phase === 'answering' || qs?.phase === 'grading') {
                    color = '#f59e0b'; // 进行中 - 黄色
                  }
                  return (
                    <TouchableOpacity
                      key={q.id}
                      style={[styles.quizProgressDot, { backgroundColor: color }]}
                      onPress={() => {
                        // 跳回该题重新作答
                        setQuizFlow(prev => ({
                          ...prev,
                          currentIndex: idx,
                          phase: 'active',
                          questions: {
                            ...prev.questions,
                            [q.id]: { phase: 'answering', answer: qs?.answer ?? '' },
                          },
                        }));
                      }}
                    >
                      {(qs?.phase === 'feedback' || qs?.phase === 'completed') && (
                        <Ionicons name={qs?.result?.correct ? "checkmark" : "close"} size={10} color="white" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.quizCard}>
                <View style={styles.quizHeader}>
                  <Ionicons name="help-circle" size={20} color="#f59e0b" />
                  <Text style={styles.quizTitle}>
                    第 {quizFlow.currentIndex + 1}/{totalQuestions} 题
                    {isMultiple && '（多选）'}
                    {isShort && '（简答）'}
                  </Text>
                </View>

                {/* 题目 */}
                <Text style={styles.questionText}>{currentQ.question}</Text>

                {/* answering 阶段：选择题选项 */}
                {phase === 'answering' && !isShort && currentQ.options?.map((opt, optIdx) => {
                  const optValue = typeof opt === 'string' ? opt : opt.value;
                  const optLabel = typeof opt === 'string' ? opt : opt.label;
                  const optSelected = isMultiple
                    ? userAnswerArray.includes(optValue)
                    : userAnswer === optValue;

                  return (
                    <TouchableOpacity
                      key={optValue ?? optIdx}
                      style={[
                        styles.optionButton,
                        optSelected && styles.optionSelected,
                      ]}
                      onPress={() => handleAnswerChoice(currentQ.id, optValue, isMultiple)}
                    >
                      <Text style={[styles.optionLabel, optSelected && styles.optionLabelSelected]}>
                        {String.fromCharCode(65 + optIdx)}.
                      </Text>
                      <Text style={[styles.optionText, optSelected && styles.optionTextSelected]}>
                        {optLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* 多选题确认按钮 */}
                {phase === 'answering' && isMultiple && userAnswerArray.length > 0 && (
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={() => handleConfirmMultiple(currentQ.id)}
                  >
                    <Text style={styles.submitButtonText}>确认选择</Text>
                  </TouchableOpacity>
                )}

                {/* answering 阶段：简答题输入 */}
                {phase === 'answering' && isShort && (
                  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <TextInput
                      style={styles.shortAnswerInput}
                      placeholder="请输入您的答案..."
                      placeholderTextColor="#9ca3af"
                      multiline
                      numberOfLines={4}
                      value={typeof userAnswer === 'string' ? userAnswer : ''}
                      onChangeText={(text) => handleShortAnswerInput(currentQ.id, text)}
                    />
                    <TouchableOpacity
                      style={styles.submitButton}
                      onPress={() => handleConfirmShortAnswer(currentQ.id)}
                    >
                      <Text style={styles.submitButtonText}>提交答案</Text>
                    </TouchableOpacity>
                  </KeyboardAvoidingView>
                )}

                {/* grading 阶段：AI 评分中 */}
                {phase === 'grading' && (
                  <View style={styles.gradingContainer}>
                    <ActivityIndicator size="small" color="#3b82f6" />
                    <Text style={styles.gradingText}>AI 正在批改...</Text>
                  </View>
                )}

                {/* feedback 阶段：显示结果 */}
                {phase === 'feedback' && (
                  <View style={styles.answerResultSection}>
                    {/* 正确/错误标记 */}
                    <View style={[styles.resultBadge, { backgroundColor: result?.correct ? '#dcfce7' : '#fef2f2' }]}>
                      <Text style={[styles.resultBadgeText, { color: result?.correct ? '#16a34a' : '#dc2626' }]}>
                        {result?.correct ? '✓ 正确' : '✗ 错误'}
                        {result?.earned !== undefined && result?.earned !== (currentQ.points ?? 1) && ` (${result.earned}分)`}
                      </Text>
                    </View>

                    {/* 选择题：显示选项对错 */}
                    {!isShort && phase === 'feedback' && currentQ.options?.map((opt, optIdx) => {
                      const optValue = typeof opt === 'string' ? opt : opt.value;
                      const optLabel = typeof opt === 'string' ? opt : opt.label;
                      const correctAnswers = toArray(currentQ.answer);
                      const optIsCorrect = correctAnswers.includes(optValue);
                      const optWasSelected = toArray(userAnswer).includes(optValue);

                      return (
                        <TouchableOpacity
                          key={optValue ?? optIdx}
                          style={[
                            styles.optionButton,
                            optIsCorrect && styles.optionCorrect,
                            optWasSelected && !optIsCorrect && styles.optionWrong,
                          ]}
                          disabled
                        >
                          <Text style={[styles.optionLabel, optIsCorrect && styles.optionLabelCorrect]}>
                            {String.fromCharCode(65 + optIdx)}.
                          </Text>
                          <Text style={styles.optionText}>{optLabel}</Text>
                          {optIsCorrect && <Ionicons name="checkmark-circle" size={16} color="#22c55e" style={styles.optionIcon} />}
                          {optWasSelected && !optIsCorrect && <Ionicons name="close-circle" size={16} color="#ef4444" style={styles.optionIcon} />}
                        </TouchableOpacity>
                      );
                    })}

                    {/* 简答题：显示用户答案 */}
                    {isShort && (
                      <View style={styles.userAnswerBox}>
                        <Text style={styles.userAnswerLabel}>你的答案</Text>
                        <Text style={styles.userAnswerText}>{typeof userAnswer === 'string' ? userAnswer : '未作答'}</Text>
                      </View>
                    )}

                    {/* 错误时显示正确答案 */}
                    {!result?.correct && result?.correctAnswer && (
                      <View style={styles.correctAnswerBox}>
                        <Text style={styles.correctAnswerLabel}>正确答案</Text>
                        <Text style={styles.correctAnswerText}>{result.correctAnswer}</Text>
                      </View>
                    )}

                    {/* AI 评语 */}
                    {result?.aiComment && (
                      <View style={styles.aiCommentBox}>
                        <Text style={styles.aiCommentLabel}>AI 点评</Text>
                        <Text style={styles.aiCommentText}>{result.aiComment}</Text>
                      </View>
                    )}

                    {/* 继续按钮 */}
                    <TouchableOpacity
                      style={styles.continueButton}
                      onPress={() => advanceToNextQuestion(currentQ.id)}
                    >
                      <Ionicons name="arrow-forward" size={18} color="white" />
                      <Text style={styles.continueButtonText}>
                        {quizFlow.currentIndex + 1 < totalQuestions ? '下一题' : '查看结果'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        })()}

        {/* Interactive 类型：widget 交互渲染（预构件模式） */}
        {currentScene?.type === 'interactive' && (() => {
          const content = currentScene?.content as any;

          // 优先路径：widgetType 存在 → 通过 widget-registry 渲染交互组件
          if (content?.widgetType && widgetHtml) {
            return (
              <View style={styles.webviewContainer}>
                <InteractiveWebView
                  ref={interactiveWebViewRef}
                  sceneId={currentScene.id}
                  htmlContent={widgetHtml}
                  onComplete={handleInteractiveComplete}
                  onMessage={handleInteractiveMessage}
                  style={styles.webview}
                />
              </View>
            );
          }

          // 兼容路径：旧数据有 url 或 html → 直接用 InteractiveWebView
          if (content?.url || content?.html) {
            return (
              <View style={styles.webviewContainer}>
                <InteractiveWebView
                  ref={interactiveWebViewRef}
                  sceneId={currentScene.id}
                  url={content.url}
                  htmlContent={content.html}
                  onComplete={handleInteractiveComplete}
                  onMessage={handleInteractiveMessage}
                  style={styles.webview}
                />
              </View>
            );
          }

          // 兼容路径：旧数据有 canvas → 用 ScreenCanvas 渲染
          if (content?.canvas?.elements?.length > 0) {
            return (
              <View style={{ flex: 1 }}>
                <ScreenCanvas
                  elements={content.canvas.elements || []}
                  background={convertToSlideBackground(content.canvas?.background)}
                  theme={undefined}
                  spotlightElementId={spotlightElementId}
                  laserElementId={laserElementId}
                  laserOptions={laserOptions}
                  scrollable={true}
                />
              </View>
            );
          }

          // Fallback：无内容 → 占位 + 继续按钮
          return (
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={48} color="#ccc" />
              <Text style={styles.emptySceneTitle}>{currentScene?.title || '互动场景'}</Text>
              <Text style={styles.emptySceneHint}>此场景内容正在准备中</Text>
              <TouchableOpacity style={styles.continueButton} onPress={() => goToNextScene()}>
                <Text style={styles.continueButtonText}>继续</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* PBL 类型：项目学习场景 */}
        {currentScene?.type === 'pbl' && (() => {
          const content = currentScene?.content as any;
          // 如果有 URL 或 HTML，渲染 WebView
          if (content?.url || content?.html) {
            return (
              <View style={styles.webviewContainer}>
                <InteractiveWebView
                  ref={interactiveWebViewRef}
                  sceneId={currentScene.id}
                  url={content.url}
                  htmlContent={content.html}
                  onComplete={handleInteractiveComplete}
                  onMessage={handleInteractiveMessage}
                  style={styles.webview}
                />
              </View>
            );
          }
          // 否则显示项目学习界面
          return (
          <View style={styles.pblOverlay}>
            <View style={styles.pblCard}>
                <View style={styles.pblHeader}>
                  <Ionicons name="bulb" size={24} color="#8b5cf6" />
                  <Text style={styles.pblTitle}>项目学习</Text>
                </View>
                <Text style={styles.pblTask}>{currentScene?.title}</Text>
                <Text style={styles.pblDesc}>{(currentScene?.content as any)?.description || '项目学习场景，点击下方按钮请求Agent指导'}</Text>

                {/* 项目步骤 */}
                {(currentScene?.content as any)?.steps?.length > 0 ? (
                  <View style={styles.projectSteps}>
                    {(currentScene?.content as any)?.steps?.map((step: any, idx: number) => (
                      <View key={idx} style={styles.projectStep}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{idx + 1}</Text>
                        </View>
                        <View style={styles.stepContent}>
                          <Text style={styles.stepTitle}>{step.title || step}</Text>
                          {step.description && (
                            <Text style={styles.stepDesc}>{step.description}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.projectPoints}>
                    <Text style={styles.projectLabel}>关键要点：</Text>
                    {(currentScene?.content as any)?.key_points?.map((point: string, idx: number) => (
                      <View key={idx} style={styles.projectItem}>
                        <Ionicons name="checkbox-outline" size={16} color="#8b5cf6" />
                        <Text style={styles.projectText}>{point}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* 请求指导按钮 */}
                <TouchableOpacity
                  style={styles.requestGuidanceBtn}
                  onPress={() => {
                    if (agents.length > 0) {
                      const teacherAgent = agents.find(a => a.role === 'teacher') || agents[0];
                      setSelectedAgent(teacherAgent);
                      setChatHistory([
                        { agent: teacherAgent.name, message: `欢迎开始${currentScene?.title}项目。让我为你介绍项目目标和步骤...` }
                      ]);
                      setShowChatModal(true);
                    }
                  }}
                >
                  <Ionicons name="school" size={20} color="white" />
                  <Text style={styles.requestGuidanceText}>请求Agent指导</Text>
                </TouchableOpacity>
              </View>
          </View>
          );
        })()}
      </Animated.View>
    </ScrollView>

    {/* 白板区域 - 全屏覆盖，白板优先；聊天面板可展开/收起 */}
      <WhiteboardOverlay
        visible={showWhiteboard}
        textContent={whiteboardTextContent}
        onClose={() => setShowWhiteboard(false)}
        chatVisible={showChatModal}
        onToggleChat={() => setShowChatModal(!showChatModal)}
        playbackMode={playbackMode}
        isLandscape={isLandscape}
        courseId={id}
        sceneId={currentScene?.id}
      />

      {/* 场景缩略图导航（可展开） */}
      <TouchableOpacity
        style={styles.thumbnailToggle}
        onPress={() => setShowThumbnailNav(!showThumbnailNav)}
      >
        <Ionicons name={showThumbnailNav ? "chevron-down" : "chevron-up"} size={20} color="#5b9bd5" />
        <Text style={styles.thumbnailToggleText}>场景导航</Text>
      </TouchableOpacity>

      {showThumbnailNav && (
        <ScrollView
          horizontal
          style={styles.thumbnailBar}
          showsHorizontalScrollIndicator={false}
        >
          {data.scenes.map((scene, index) => (
            <TouchableOpacity
              key={scene.id}
              style={[
                styles.thumbnailItem,
                index === currentSceneIndex && styles.thumbnailItemActive
              ]}
              onPress={() => goToScene(index)}
            >
              <View style={styles.thumbnailIcon}>
                <Ionicons
                  name={scene.type === 'slide' ? 'document-text' :
                       scene.type === 'quiz' ? 'help-circle' : 'layers'}
                  size={16}
                  color={index === currentSceneIndex ? '#5b9bd5' : '#666'}
                />
              </View>
              <Text style={[
                styles.thumbnailTitle,
                index === currentSceneIndex && styles.thumbnailTitleActive
              ]}>
                {scene.title.slice(0, 8)}
              </Text>
              <Text style={styles.thumbnailIndex}>#{index + 1}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 智能体头像栏 */}
      <View style={[styles.agentBar, isLandscape && styles.agentBarLandscape, isCompactMode && styles.agentBarCompact]}>
        {agents.length === 0 && (
          <Text style={{ color: '#999', fontSize: 12 }}>加载智能体...</Text>
        )}
        {agents.map(agent => (
          <TouchableOpacity
            key={agent.id}
            style={[styles.agentAvatarBtn, { backgroundColor: safeColorWithAlpha(agent.color, '20') }]}
            onPress={() => openAgentChat(agent)}
          >
            {/* 头像显示 - 使用 DiceBear 头像图片 */}
            <View style={[styles.agentAvatarCircle, { backgroundColor: agent.color }]}>
              {(() => {
                const img = getAvatarImage(agent.avatar);
                return img
                  ? <Image source={img} style={styles.agentAvatarImg} />
                  : <Text style={styles.agentAvatarInner}>{agent.name[0]}</Text>;
              })()}
            </View>
            <Text style={[styles.agentName, { color: agent.color }]} numberOfLines={1}>
              {agent.name.length > 4 ? agent.name.slice(0, 4) : agent.name}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => {
            if (agents.length > 0) {
              openAgentChat(agents[0]);
            }
          }}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#5b9bd5" />
          <Text style={styles.chatBtnText}>提问</Text>
        </TouchableOpacity>
      </View>

      {/* 工具栏 */}
      <View style={[styles.toolbar, isLandscape && styles.toolbarLandscape, isCompactMode && styles.toolbarCompact]}>
        <TouchableOpacity
          style={[styles.toolBtn, currentSceneIndex === 0 && styles.toolBtnDisabled]}
          onPress={goToPrevScene}
          disabled={currentSceneIndex === 0}
        >
          <Ionicons name="chevron-back" size={20} color={currentSceneIndex === 0 ? '#ccc' : '#5b9bd5'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, currentSceneIndex === data.scenes.length - 1 && styles.toolBtnDisabled]}
          onPress={goToNextScene}
          disabled={currentSceneIndex === data.scenes.length - 1}
        >
          <Ionicons name="chevron-forward" size={20} color={currentSceneIndex === data.scenes.length - 1 ? '#ccc' : '#5b9bd5'} />
        </TouchableOpacity>

        {/* 语音播放/暂停 */}
        <TouchableOpacity
          style={[styles.toolBtn, playbackMode === 'playing' && styles.toolBtnActive]}
          onPress={() => {
            if (playbackMode === 'playing') {
              playbackEngineRef.current?.pause();
            } else if (playbackMode === 'paused') {
              playbackEngineRef.current?.resume();
            } else {
              playbackEngineRef.current?.playCurrentScene();
            }
          }}
        >
          <Ionicons
            name={playbackMode === 'playing' ? "pause" : playbackMode === 'paused' ? "play" : "volume-high"}
            size={20}
            color={playbackMode === 'playing' ? 'white' : '#666'}
          />
        </TouchableOpacity>

        {/* 语速快捷调节 - 点击直接切换播放速率 */}
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={() => {
            const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
            const currentIndex = speeds.indexOf(ttsConfig.speed);
            const nextSpeed = speeds[(currentIndex + 1) % speeds.length];

            // 直接更新语速配置（播放中会自动调整播放速率）
            setTtsConfig({ ...ttsConfig, speed: nextSpeed });
            playbackEngineRef.current?.setTTSConfig({ speed: nextSpeed });
          }}
        >
          <Text style={styles.speedBtnText}>{ttsConfig.speed.toFixed(1)}x</Text>
        </TouchableOpacity>

        {/* 记笔记 */}
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowNoteModal(true);
          }}
        >
          <Ionicons name="create-outline" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, showWhiteboard && styles.toolBtnActive]}
          onPress={() => setShowWhiteboard(!showWhiteboard)}
        >
          <Ionicons name="pencil" size={20} color={showWhiteboard ? 'white' : '#666'} />
          {!showWhiteboard && !whiteboardStore.isEmpty() && (
            <View style={styles.toolBadge} />
          )}
        </TouchableOpacity>

        {/* 提取知识点 */}
        <TouchableOpacity
          style={[styles.toolBtn, extractingKnowledge && styles.toolBtnActive]}
          onPress={extractKnowledge}
          disabled={extractingKnowledge}
        >
          {extractingKnowledge ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="book-outline" size={20} color="#666" />
          )}
        </TouchableOpacity>
      </View>

      {/* 智能体聊天面板 - 白板打开时覆盖在白板底部 */}
      {showChatModal && showWhiteboard ? (
        <View style={styles.chatPanelOverWhiteboard}>
          {/* 头部 */}
          <View style={styles.chatPanelHeader}>
            {selectedAgent && (
              <View style={[styles.modalAgentAvatarSmall, { backgroundColor: selectedAgent.color }]}>
                {(() => { const img = getAvatarImage(selectedAgent.avatar); return img ? <Image source={img} style={styles.modalAgentAvatarImg} /> : <Text style={styles.modalAgentAvatarText}>{selectedAgent.name[0]}</Text>; })()}
              </View>
            )}
            <Text style={styles.chatPanelTitle}>{selectedAgent?.name || (discussionMode ? '多Agent讨论' : '对话')}</Text>
            <TouchableOpacity onPress={() => {
              setShowChatModal(false);
              if (!discussionMode) {
                Speech.stop();
              }
            }}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* 讨论参与者 */}
          {discussionMode && agents.length > 0 && (
            <View style={styles.participantsBarCompact}>
              <Text style={styles.participantsLabel}>参与者</Text>
              <View style={styles.participantsAvatars}>
                {agents.slice(0, 3).map(agent => {
                  const isCurrentSpeaker = agent.id === speakingAgentId;
                  return (
                    <View key={agent.id} style={[styles.participantAvatar, { backgroundColor: agent.color }, isCurrentSpeaker && styles.participantAvatarActive]}>
                      {(() => { const img = getAvatarImage(agent.avatar); return img ? <Image source={img} style={styles.participantAvatarImg} /> : <Text style={styles.participantAvatarText}>{agent.name[0]}</Text>; })()}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* 聊天历史 */}
          <ScrollView style={styles.chatHistoryCompact} keyboardShouldPersistTaps="handled">
            {chatHistory.map((item, index) => {
              const isSpeaking = discussionRunning && item.agentId && item.agentId === speakingAgentId;
              const stableKey = `${item.agentId || item.agent}-${index}`;
              const displayText = item.message.replace('[白板内容已显示]', '').replace('[引导思考待参与]', '').trim();
              return (
                <View key={stableKey} style={[styles.chatBubble, item.agent === '我' ? styles.chatBubbleUser : styles.chatBubbleAgent, isSpeaking && styles.chatBubbleSpeaking]}>
                  <View style={styles.chatBubbleHeader}>
                    <Text style={styles.chatBubbleAgentName}>{item.agent}</Text>
                    {isSpeaking && <Ionicons name="volume-high" size={12} color="#10b981" />}
                  </View>
                  {displayText ? <Text style={styles.chatBubbleText}>{displayText}</Text> : null}
                </View>
              );
            })}
          </ScrollView>

          {/* 输入框 */}
          {!discussionMode && (
            <View style={styles.chatInputAreaFixed}>
              <TextInput style={styles.chatInputFixed} placeholder="输入问题..." value={chatMessage} onChangeText={setChatMessage} />
              <TouchableOpacity style={[styles.sendBtnFixed, (!chatMessage.trim() || sendingMessage) && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!chatMessage.trim() || sendingMessage}>
                {sendingMessage ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="send" size={18} color="white" />}
              </TouchableOpacity>
            </View>
          )}

          {/* 讨论模式提示 */}
          {discussionMode && (
            <View style={styles.discussionModeHintCompact}>
              {discussionRunning ? <ActivityIndicator size="small" color="#10b981" /> : <Ionicons name="checkmark-circle" size={16} color="#10b981" />}
              <Text style={styles.discussionModeTextSmall}>{discussionRunning ? '讨论中...' : '已结束'}</Text>
            </View>
          )}
        </View>
      ) : showChatModal ? (
        // 常规 BottomSheetModal（无白板时）
        <BottomSheetModal
          visible={showChatModal}
          onClose={() => {
            setShowChatModal(false);
            // 不停止讨论，让讨论在后台继续进行
            // 只在非讨论模式下停止语音
            if (!discussionMode) {
              Speech.stop();
            }
          }}
          contentStyle={styles.modalContentCompact}
        >
          {/* 模态框头部 */}
          <View style={styles.modalHeaderCompact}>
            {selectedAgent && (
              <View style={[styles.modalAgentAvatarSmall, { backgroundColor: selectedAgent.color }]}>
                {(() => { const img = getAvatarImage(selectedAgent.avatar); return img ? <Image source={img} style={styles.modalAgentAvatarImg} /> : <Text style={styles.modalAgentAvatarText}>{selectedAgent.name[0]}</Text>; })()}
              </View>
            )}
            <Text style={styles.modalTitleCompact}>{selectedAgent?.name || (discussionMode ? '多Agent讨论' : '对话')}</Text>
            <TouchableOpacity onPress={() => {
              setShowChatModal(false);
              // 不停止讨论，让讨论在后台继续进行
              if (!discussionMode) {
                Speech.stop();
              }
            }}>
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>

          {/* 讨论参与者 */}
          {discussionMode && agents.length > 0 && (
            <View style={styles.participantsBar}>
              <Text style={styles.participantsLabel}>讨论参与者</Text>
              <View style={styles.participantsAvatars}>
                {agents.slice(0, 3).map(agent => {
                  const isCurrentSpeaker = agent.id === speakingAgentId;
                  return (
                    <View key={agent.id} style={[styles.participantAvatar, { backgroundColor: agent.color }, isCurrentSpeaker && styles.participantAvatarActive]}>
                      {(() => { const img = getAvatarImage(agent.avatar); return img ? <Image source={img} style={styles.participantAvatarImg} /> : <Text style={styles.participantAvatarText}>{agent.name[0]}</Text>; })()}
                      {isCurrentSpeaker && <View style={styles.speakingDot}><Ionicons name="volume-high" size={10} color="white" /></View>}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* 聊天历史 */}
          <ScrollView style={styles.chatHistory}>
            {/* 等待Agent响应的加载指示器 */}
            {waitingForAgent && (
              <View style={styles.waitingIndicator}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.waitingText}>正在等待智能体响应...</Text>
                <Text style={styles.waitingHint}>讨论需要一定时间生成，请耐心等待</Text>
              </View>
            )}
            {!waitingForAgent && chatHistory.length === 0 && <Text style={styles.chatHint}>开始提问吧</Text>}
            {chatHistory.map((item, index) => {
              const isSpeaking = discussionRunning && item.agentId && item.agentId === speakingAgentId;
              const stableKey = `${item.agentId || item.agent}-${index}`;
              const displayText = item.message.replace('[白板内容已显示]', '').replace('[引导思考待参与]', '').trim();
              return (
                <View key={stableKey} style={[styles.chatBubble, item.agent === '我' ? styles.chatBubbleUser : styles.chatBubbleAgent, isSpeaking && styles.chatBubbleSpeaking]}>
                  <View style={styles.chatBubbleHeader}>
                    <Text style={styles.chatBubbleAgentName}>{item.agent}</Text>
                    {isSpeaking && <View style={styles.speakingIndicator}><Ionicons name="volume-high" size={14} color="#10b981" /><Text style={styles.speakingText}>发言中</Text></View>}
                  </View>
                  {displayText ? <Text style={styles.chatBubbleText}>{displayText}</Text> : null}
                </View>
              );
            })}
          </ScrollView>

          {/* 输入框 */}
          {!discussionMode && (
            <View style={styles.chatInputArea}>
              <TextInput style={styles.chatInput} placeholder="输入问题..." value={chatMessage} onChangeText={setChatMessage} multiline />
              <TouchableOpacity style={[styles.sendBtn, (!chatMessage.trim() || sendingMessage) && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!chatMessage.trim() || sendingMessage}>
                {sendingMessage ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="send" size={20} color="white" />}
              </TouchableOpacity>
            </View>
          )}

          {/* 讨论模式提示 */}
          {discussionMode && (
            <View style={styles.discussionModeHint}>
              {discussionRunning ? <ActivityIndicator size="small" color="#10b981" /> : <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
              <Text style={styles.discussionModeText}>{discussionRunning ? '讨论中...' : '已结束'}</Text>
            </View>
          )}
        </BottomSheetModal>
      ) : null}

      {/* 知识提取结果弹窗 */}
      <BottomSheetModal
        visible={showExtractResult}
        onClose={() => setShowExtractResult(false)}
        contentStyle={styles.modalContent}
      >
        <View style={styles.modalHeader}>
          <Ionicons name="book" size={24} color="#5b9bd5" />
          <Text style={styles.modalTitle}>知识点已提取</Text>
          <TouchableOpacity onPress={() => setShowExtractResult(false)}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <Text style={styles.extractHint}>
          从当前场景提取了 {extractedCards.length} 个知识点，已保存到知识库
        </Text>

        <ScrollView style={styles.extractResults}>
          {extractedCards.map((card, _index) => (
            <View key={card.id} style={styles.extractCardItem}>
              <Text style={styles.extractCardTitle}>{card.title}</Text>
              <Text style={styles.extractCardCategory}>
                {card.skill_category || 'general'}
              </Text>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={styles.extractViewBtn}
          onPress={() => {
            setShowExtractResult(false);
            router.push('/(tabs)/knowledge' as any);
          }}
        >
          <Text style={styles.extractViewBtnText}>查看知识库</Text>
        </TouchableOpacity>
      </BottomSheetModal>

      {/* 首次进入课堂的手势操作提示 */}
      <HintToast
        visible={classroomGestureHint.visible}
        onClose={classroomGestureHint.dismiss}
        icon="swap-horizontal"
        text="左右滑动切场景 · 双指缩放画面"
        position="top"
      />

      {/* 笔记创建模态框 */}
      <NoteCreationModal
        visible={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        sceneData={{
          id: currentScene?.id || '',
          title: currentScene?.title || '',
          description: (currentScene?.type === 'interactive' ? (currentScene?.content as InteractiveContent) : null)?.description || '',
          key_points: (currentScene?.type === 'interactive' ? (currentScene?.content as InteractiveContent) : null)?.key_points || [],
          type: currentScene?.type || 'slide',
        }}
        courseId={id || ''}
      />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // 后台创建进度提示
  backgroundCreatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.secondary.info + '20',
    borderBottomWidth: 1,
    borderBottomColor: Colors.secondary.info + '40',
  },
  backgroundCreatingText: {
    marginLeft: Spacing.sm,
    fontSize: 14,
    color: Colors.secondary.info,
  },

  // 手动创建提示
  manualCreateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.accent.main + '20',
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent.main + '40',
  },
  manualCreateText: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 14,
    color: Colors.accent.main,
  },
  manualCreateBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.accent.main,
    borderRadius: Rounded.sm,
  },
  manualCreateBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },

  // 头部
  header: {
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center', color: Colors.neutral.textPrimary },
  progressBadge: {
    backgroundColor: Colors.primary.main,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Rounded.md,
  },
  progressText: { color: Colors.neutral.white, fontSize: 12, fontWeight: '500' },

  // 内容
  content: {
    flex: 1,
    padding: Spacing.sm + 3,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollContent: {
    flexGrow: 1,  // 让内容填充可用空间
    paddingHorizontal: Spacing.sm + 3,
    paddingBottom: 80, // 底部留出足够滚动空间，避免 quiz 提交按钮被聊天输入栏遮挡
  },
  contentInner: {
    width: '100%',  // 明确设置宽度为100%
    maxWidth: '100%',  // 限制最大宽度
    alignSelf: 'center',  // 居中显示
  },
  contentInnerTablet: {
    maxWidth: 800,  // 平板最大宽度
  },
  slideScroll: { flex: 1 },
  slideContainer: { flex: 1, alignItems: 'center' },
  slideCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: Rounded.lg,
    padding: Spacing.lg + 1,
    width: '100%',
    maxWidth: 800, // 平板最大宽度
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    minHeight: 400,
  },
  elementContainer: { marginVertical: Spacing.sm - 2 },
  firstElement: {
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: Spacing.sm + 7,
  },
  elementText: { fontSize: 16, color: '#444', lineHeight: 24 },
  lineElement: {
    height: 2,
    backgroundColor: '#e5e7eb',
    width: '100%',
    marginVertical: Spacing.sm,
  },
  slideImage: {
    width: 200,
    height: 150,
    borderRadius: Rounded.sm,
    marginVertical: Spacing.sm,
  },
  sceneText: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 },
  emptySlide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl + 20,
  },
  emptyText: { color: '#999', marginTop: Spacing.sm + 3, fontSize: 14 },

  // Empty scene fallback
  emptySceneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm + 3,
  },
  emptySceneCard: {
    backgroundColor: 'white',
    borderRadius: Rounded.lg,
    padding: Spacing.lg + 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  emptySceneTitle: { fontSize: 18, fontWeight: 'bold', marginTop: Spacing.sm + 3, color: '#333' },
  emptySceneHint: { fontSize: 14, color: '#666', marginTop: Spacing.sm },

  // Quiz overlay - 非绝对定位，跟随滚动内容
  quizOverlay: {
    backgroundColor: 'white',
    borderRadius: Rounded.lg,
    marginTop: Spacing.md,  // 与上方内容留出间距
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    width: '100%',
  },
  quizScroll: {
    // 不需要单独滚动，跟随主 ScrollView
  },
  quizCard: {
    padding: Spacing.md,  // 紧凑内边距
  },
  quizFooter: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: 'white',
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,  // 减小间距
    borderBottomWidth: 1,
    borderBottomColor: '#f59e0b20',
    paddingBottom: Spacing.sm,
  },
  quizTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: Spacing.sm, color: '#333' },
  questionContainer: { marginVertical: Spacing.sm },
  questionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  questionText: { fontSize: 15, color: '#333', flex: 1, fontWeight: '500' },
  questionTypeHint: { fontSize: 12, color: '#888', marginLeft: Spacing.xs },
  shortAnswerInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: Rounded.md,
    padding: Spacing.sm,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#f9fafb',
  },
  shortAnswerReview: {
    backgroundColor: '#f3f4f6',
    borderRadius: Rounded.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  shortAnswerLabel: { fontSize: 12, color: '#6b7280', marginBottom: Spacing.xs },
  shortAnswerText: { fontSize: 14, color: '#1f2937' },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: Spacing.sm - 2,  // 紧凑
    borderRadius: Rounded.sm,
    marginBottom: Spacing.xs + 2,  // 减小间距
  },
  optionLabel: { fontSize: 13, fontWeight: 'bold', color: '#5b9bd5', marginRight: Spacing.sm },
  optionText: { fontSize: 13, color: '#666' },
  // Quiz selection states
  optionSelected: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', borderWidth: 2 },
  optionCorrect: { backgroundColor: '#dcfce7', borderColor: '#22c55e', borderWidth: 2 },
  optionWrong: { backgroundColor: '#fef2f2', borderColor: '#ef4444', borderWidth: 2 },
  optionLabelSelected: { color: '#3b82f6' },
  optionLabelCorrect: { color: '#22c55e' },
  optionTextSelected: { color: '#3b82f6', fontWeight: '500' },
  optionIcon: { marginLeft: Spacing.sm },
  quizResult: { fontSize: 14, color: '#22c55e', fontWeight: 'bold', marginLeft: Spacing.sm },
  answerResultSection: { marginTop: Spacing.sm },
  resultBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Rounded.sm, alignSelf: 'flex-start', marginBottom: Spacing.xs },
  resultBadgeText: { fontSize: 12, fontWeight: '600' },
  userAnswerBox: { backgroundColor: '#f3f4f6', borderRadius: Rounded.md, padding: Spacing.sm, marginTop: Spacing.xs },
  userAnswerLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  userAnswerText: { fontSize: 14, color: '#1f2937' },
  correctAnswerBox: { backgroundColor: '#dcfce7', borderRadius: Rounded.md, padding: Spacing.sm, marginTop: Spacing.xs, borderWidth: 1, borderColor: '#bbf7d0' },
  correctAnswerLabel: { fontSize: 12, color: '#16a34a', fontWeight: '600', marginBottom: 2 },
  correctAnswerText: { fontSize: 14, color: '#15803d' },
  aiCommentBox: { backgroundColor: '#eff6ff', borderRadius: Rounded.md, padding: Spacing.sm, marginTop: Spacing.xs, borderWidth: 1, borderColor: '#bfdbfe' },
  aiCommentLabel: { fontSize: 12, color: '#2563eb', fontWeight: '600', marginBottom: 2 },
  aiCommentText: { fontSize: 13, color: '#1e40af', lineHeight: 18 },
  gradingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.md, backgroundColor: '#eff6ff', borderRadius: Rounded.md, marginTop: Spacing.sm },
  gradingText: { fontSize: 14, color: '#3b82f6', fontWeight: '500', marginRight: Spacing.sm },
  submitButton: { backgroundColor: '#3b82f6', padding: Spacing.sm + 2, borderRadius: Rounded.md, alignItems: 'center', flex: 1, marginRight: Spacing.sm },
  submitButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  resetButton: { backgroundColor: '#6b7280', padding: Spacing.sm + 2, borderRadius: Rounded.md, alignItems: 'center', flex: 1 },
  resetButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  // Duolingo 逐题模式新增样式
  quizProgressBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'white',
    borderTopLeftRadius: Rounded.lg,
    borderTopRightRadius: Rounded.lg,
  },
  quizProgressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButton: {
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm + 2,
    borderRadius: Rounded.md,
    marginTop: Spacing.md,
  },
  continueButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', marginLeft: Spacing.xs },
  summaryScoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0fdf4',
    borderWidth: 3,
    borderColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: Spacing.md,
  },
  summaryScoreText: { fontSize: 28, fontWeight: 'bold', color: '#16a34a' },
  summaryScoreLabel: { fontSize: 14, color: '#4ade80', marginTop: 2 },
  summaryActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  analysisDetail: {
    backgroundColor: '#f8fafc',
    borderRadius: Rounded.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.lg,
  },
  analysisLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  analysisValue: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  analysisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: Rounded.md,
    backgroundColor: '#eff6ff',
    flex: 1,
  },
  analysisButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
  // 奖励效果卡片样式
  rewardCard: {
    backgroundColor: 'white',
    borderRadius: Rounded.lg,
    borderWidth: 2,
    maxHeight: '85%',
  },
  rewardCardContent: {
    padding: Spacing.lg,
  },
  rewardAnimationContainer: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardEmoji: {
    fontSize: 64,
  },
  rewardTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  rewardSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  percentageBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  percentageBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  percentageBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 42,
    textAlign: 'right',
  },
  summaryQuestionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  summaryQuestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Rounded.full,
    gap: 2,
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  analysisQuestionNum: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 4,
    flex: 1,
  },
  analysisPoints: {
    fontSize: 12,
    color: '#9ca3af',
  },
  analysisQuestionText: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: Spacing.xs,
    lineHeight: 20,
  },
  quizHintContainer: { marginTop: Spacing.lg },
  quizHintText: { fontSize: 14, color: '#666', marginVertical: Spacing.xs + 1 },
  quizHint: { fontSize: 14, color: '#666', textAlign: 'center' },
  emptyQuiz: { alignItems: 'center', paddingVertical: Spacing.xl },

  // Interactive
  interactiveContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.sm + 3 },
  interactiveCard: {
    backgroundColor: 'white',
    borderRadius: Rounded.lg,
    padding: Spacing.lg + 1,
    width: '100%',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  interactiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#10b98120',
    paddingBottom: Spacing.sm + 7,
  },
  interactiveTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: Spacing.sm, color: '#333' },
  interactivePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  interactiveHint: { fontSize: 14, color: '#666', textAlign: 'center' },
  startInteractiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    padding: Spacing.sm + 3,
    borderRadius: Rounded.md,
    marginTop: Spacing.lg,
  },
  startInteractiveText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: Spacing.sm },

  // Interactive overlay (for interactive scenes) - 正常流布局，跟随滚动
  interactiveOverlay: {
    backgroundColor: 'white',
    borderRadius: Rounded.lg,
    marginTop: Spacing.md,  // 与上方内容留出间距
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    width: '100%',
  },
  interactiveScroll: {},  // 不需要单独样式，跟随主 ScrollView
  interactiveTopic: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: Spacing.xs },
  interactiveDesc: { fontSize: 13, color: '#666', marginBottom: Spacing.sm },
  discussionPoints: { marginBottom: Spacing.md },
  discussionLabel: { fontSize: 14, fontWeight: '600', color: '#10b981', marginBottom: Spacing.sm },
  discussionItem: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.xs },
  discussionText: { fontSize: 14, color: '#333', marginLeft: Spacing.sm, flex: 1 },
  startDiscussionBtn: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: Rounded.md,
    marginTop: Spacing.sm,
  },
  startDiscussionText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: Spacing.sm },
  startSingleChatBtn: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: Rounded.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  startSingleChatText: { color: '#10b981', fontSize: 14, fontWeight: '500', marginLeft: Spacing.sm },

  // PBL overlay (for project-based learning scenes) - 正常流布局，跟随滚动
  pblOverlay: {
    backgroundColor: 'white',
    borderRadius: Rounded.lg,
    marginTop: Spacing.md,  // 与上方内容留出间距
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    width: '100%',
  },
  pblScroll: {},  // 不需要单独样式，跟随主 ScrollView
  pblTask: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: Spacing.xs },
  projectSteps: { marginBottom: Spacing.md },
  projectStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: Rounded.full,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  stepContent: { flex: 1, marginLeft: Spacing.sm },
  stepTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  stepDesc: { fontSize: 12, color: '#666', marginTop: Spacing.xs },
  projectPoints: { marginBottom: Spacing.md },
  projectLabel: { fontSize: 14, fontWeight: '600', color: '#8b5cf6', marginBottom: Spacing.sm },
  projectItem: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.xs },
  projectText: { fontSize: 14, color: '#333', marginLeft: Spacing.sm, flex: 1 },
  requestGuidanceBtn: {
    backgroundColor: '#8b5cf6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: Rounded.md,
    marginTop: Spacing.sm,
  },
  requestGuidanceText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: Spacing.sm },

  // PBL (existing styles)
  pblContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.sm + 3 },
  pblCard: {
    backgroundColor: 'white',
    borderRadius: Rounded.lg,
    padding: Spacing.lg + 1,
    width: '100%',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  pblHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#8b5cf620',
    paddingBottom: Spacing.sm + 7,
  },
  pblTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: Spacing.sm, color: '#333' },
  pblPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  pblDesc: { fontSize: 14, color: '#666', marginLeft: Spacing.sm, flex: 1 },
  pblHint: { fontSize: 14, color: '#666', textAlign: 'center' },

  // 缩略图导航
  thumbnailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  thumbnailToggleText: { color: '#5b9bd5', marginLeft: Spacing.xs + 1 },
  thumbnailBar: {
    backgroundColor: 'white',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm + 3,
    maxHeight: 80,
  },
  thumbnailItem: {
    width: 70,
    alignItems: 'center',
    marginRight: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Rounded.sm,
    backgroundColor: '#f5f7fa',
  },
  thumbnailItemActive: { backgroundColor: '#e8f4fd', borderWidth: 2, borderColor: '#5b9bd5' },
  thumbnailIcon: { marginBottom: Spacing.xs + 1 },
  thumbnailTitle: { fontSize: 12, color: '#666', textAlign: 'center' },
  thumbnailTitleActive: { color: '#5b9bd5', fontWeight: '600' },
  thumbnailIndex: { fontSize: 10, color: '#999' },

  // 智能体栏
  agentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.neutral.backgroundAlt,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral.border,
  },
  agentAvatarBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  agentAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentAvatarInner: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.white,
  },
  agentAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  agentName: {
    fontSize: 10,
    marginTop: 2,
    maxWidth: 40,
    textAlign: 'center',
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
    backgroundColor: Colors.primary.main,
    marginLeft: 'auto',
  },
  chatBtnText: { color: Colors.neutral.white, marginLeft: Spacing.sm - 2, fontWeight: '500' },

  // 工具栏
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.neutral.backgroundAlt,
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: Rounded.lg + 6,
    backgroundColor: Colors.neutral.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.neutral.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: {
    backgroundColor: Colors.primary.main,
    borderWidth: 0,
  },
  toolBtnDisabled: { opacity: 0.5, backgroundColor: Colors.neutral.disabled },
  toolBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e74c3c',
  },

  // 模态框
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: Rounded.lg,
    padding: Spacing.lg,
    maxHeight: '70%',
  },
  // 凑版模态框样式 - 减少空白
  modalContentCompact: {
    backgroundColor: 'white',
    borderRadius: Rounded.lg,
    padding: Spacing.xs, // 减少 padding
    maxHeight: 350, // 固定最大高度，防止溢出
    minHeight: 200,
  },
  modalHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0, // 移除 margin
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalAgentAvatarSmall: {
    width: 24, // 缩小头像
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAgentAvatarText: {
    fontSize: 12, // 缩小头像文字
    color: 'white',
  },
  modalAgentAvatarImg: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  modalTitleCompact: {
    flex: 1,
    fontSize: 14, // 缩小标题字体
    fontWeight: '600',
    marginLeft: Spacing.xs, // 缩小边距
    color: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm + 3,
  },
  modalAgentAvatar: {
    width: 40,
    height: 40,
    borderRadius: Rounded.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', marginLeft: Spacing.sm },

  // 讨论参与者
  participantsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs, // 缩小 padding
    paddingHorizontal: Spacing.sm, // 缩小 padding
    backgroundColor: '#f5f7fa',
    borderRadius: Rounded.sm,
    marginBottom: Spacing.xs, // 缩小 margin
  },
  participantsLabel: {
    fontSize: 11, // 缩小字体
    color: '#666',
    marginRight: Spacing.xs, // 缩小边距
  },
  participantsAvatars: {
    flexDirection: 'row',
    gap: Spacing.xs, // 缩小间距
  },
  participantAvatar: {
    width: 26, // 缩小头像
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarActive: {
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  participantAvatarText: {
    fontSize: 12, // 缩小字体
    fontWeight: '600',
    color: 'white',
  },
  participantAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  speakingDot: {
    position: 'absolute',
    bottom: -3, // 调整位置
    right: -3,
    width: 14, // 缩小
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 聊天
  chatHistory: {
    flex: 1,
    minHeight: 120,
    maxHeight: 400, // 设置上限，避免内容太多时撑满
    marginBottom: Spacing.sm,
    overflow: 'hidden', // 防止内容溢出
  },
  chatHint: { color: '#999', textAlign: 'center', padding: Spacing.lg },
  chatBubble: {
    padding: Spacing.sm,
    borderRadius: Spacing.sm,
    marginBottom: Spacing.sm,
    maxWidth: '80%',
  },
  chatBubbleUser: { backgroundColor: '#5b9bd5', alignSelf: 'flex-end' },
  chatBubbleAgent: { backgroundColor: '#f5f7fa', alignSelf: 'flex-start' },
  chatBubbleSpeaking: {
    borderWidth: 2,
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  chatBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs - 1,
  },
  chatBubbleAgentName: { fontSize: 12, color: '#666', fontWeight: '600' },
  agentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatBubblePersona: {
    fontSize: 10,
    color: '#999',
    marginLeft: Spacing.xs,
    fontStyle: 'italic',
  },
  speakingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm - 2,
    paddingVertical: 2,
    backgroundColor: '#10b98120',
    borderRadius: Rounded.sm,
  },
  speakingText: {
    fontSize: 11,
    color: '#10b981',
    marginLeft: 2,
    fontWeight: '500',
  },
  chatBubbleText: { fontSize: 14, color: '#333' },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#f5f7fa',
    borderRadius: Rounded.sm,
  },
  actionHintText: {
    fontSize: 12,
    color: '#5b9bd5',
    marginLeft: Spacing.sm,
    fontWeight: '500',
  },
  chatInputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: 'white',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: Rounded.full,
    paddingHorizontal: Spacing.sm + 3,
    paddingVertical: Spacing.sm,
    maxHeight: 80,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: Rounded.full,
    backgroundColor: '#5b9bd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ccc' },

  // 聊天面板覆盖在白板底部（白板打开时使用）
  chatPanelOverWhiteboard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'white',
    borderTopLeftRadius: Rounded.lg,
    borderTopRightRadius: Rounded.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 110, // 在白板之上
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  chatPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  chatPanelTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: Spacing.sm,
    color: '#333',
  },
  participantsBarCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  chatHistoryCompact: {
    maxHeight: 200,
    minHeight: 80,
    marginBottom: Spacing.sm,
  },
  chatInputAreaFixed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  chatInputFixed: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: Rounded.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    height: 36,
  },
  sendBtnFixed: {
    width: 36,
    height: 36,
    borderRadius: Rounded.full,
    backgroundColor: '#5b9bd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discussionModeHintCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    backgroundColor: '#f0fdf4',
    borderRadius: Rounded.sm,
  },
  discussionModeTextSmall: {
    marginLeft: Spacing.xs,
    fontSize: 12,
    color: '#10b981',
  },

  // 讨论模式提示
  discussionModeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    backgroundColor: '#f0fdf4',
    borderRadius: Rounded.md,
  },
  discussionModeText: {
    marginLeft: Spacing.sm,
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },

  // 参与讨论按钮
  participateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    padding: Spacing.sm + 2,
    borderRadius: Rounded.md,
    marginTop: Spacing.sm,
  },
  participateBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },

  // 邀请讨论按钮
  inviteDiscussionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f4fd',
    borderWidth: 1,
    borderColor: '#10b981',
    padding: Spacing.sm,
    borderRadius: Rounded.md,
    marginTop: Spacing.sm,
  },
  inviteDiscussionText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: Spacing.sm,
  },

  // 错误/登录
  errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center', marginBottom: Spacing.lg },
  loginButton: { backgroundColor: '#5b9bd5', padding: Spacing.sm + 3, borderRadius: Rounded.sm },
  loginButtonText: { color: 'white', fontSize: 16 },
  retryButton: { backgroundColor: '#5b9bd5', padding: Spacing.sm + 3, borderRadius: Rounded.sm },
  retryButtonText: { color: 'white', fontSize: 16 },

  // 快捷语速按钮（工具栏）
  speedBtnText: { fontSize: 12, fontWeight: '600', color: '#666' },

  // 知识提取结果
  extractHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  extractResults: {
    maxHeight: 200,
    marginBottom: Spacing.md,
  },
  extractCardItem: {
    padding: Spacing.sm,
    borderRadius: Rounded.sm,
    backgroundColor: '#f5f7fa',
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  extractCardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  extractCardCategory: {
    fontSize: 12,
    color: '#5b9bd5',
  },
  extractViewBtn: {
    backgroundColor: '#5b9bd5',
    padding: Spacing.sm + 3,
    borderRadius: Rounded.md,
    alignItems: 'center',
  },
  extractViewBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // 后台讨论进行中指示器
  discussionRunningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Rounded.full,
    marginRight: Spacing.sm,
  },
  discussionRunningBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: Spacing.xs,
  },
  discussionHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Rounded.full,
    marginRight: Spacing.sm,
  },
  discussionHintText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: Spacing.xs,
  },

  // 查看讨论历史按钮
  viewHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: Rounded.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#10b981',
    backgroundColor: 'transparent',
  },
  viewHistoryText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: Spacing.sm,
  },

  // 等待Agent响应的加载指示器
  waitingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: '#f0fdf4',
    borderRadius: Rounded.lg,
    marginVertical: Spacing.md,
  },
  waitingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginTop: Spacing.sm,
  },
  waitingHint: {
    fontSize: 12,
    color: '#666',
    marginTop: Spacing.xs,
  },

  // 横屏布局样式
  headerLandscape: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  agentBarLandscape: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: Spacing.xs,
  },
  toolbarLandscape: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  contentLandscape: {
    flex: 1,
  },

  // iPad 分屏紧凑模式样式
  headerCompact: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  titleCompact: {
    fontSize: 14,
  },
  agentBarCompact: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  toolbarCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  toolBtnCompact: {
    padding: Spacing.xs,
    borderRadius: Rounded.sm,
  },

  // WebView 容器样式
  webviewContainer: {
    flex: 1,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    borderRadius: Rounded.lg,
    overflow: 'hidden',
    backgroundColor: Colors.neutral.background,
    minHeight: 400,
  },
  webview: {
    flex: 1,
  },
  // Widget 类型标识样式
  widgetBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  widgetBadgeText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
    marginLeft: 4,
  },
});