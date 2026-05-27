import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
import { Scene, Agent as LibAgent } from '@/lib/types/scene';
import { ScreenCanvas, SlideBackground } from '@/components/slide';
import { WhiteboardOverlay } from '@/components/classroom/WhiteboardOverlay';
import { BottomSheetModal } from '@/components/common/BottomSheetModal';
import { HintToast } from '@/components/common/HintToast';
import { useFirstTimeHint } from '@/lib/hooks/use-first-time-hint';
import { mobileActionEngine } from '@/lib/whiteboard/action-engine';
import { whiteboardStore } from '@/lib/whiteboard/element-store';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
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

// 清理 JSON 残留内容的辅助函数
function cleanJsonFromText(text: string): string {
  if (!text) return '';

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

  // 检测是否包含 JSON 结构片段
  if (text.includes('{"type"') || text.includes('[{"type"') || text.includes('"content":')) {
    let cleaned = text;
    // 移除完整的 JSON 数组
    cleaned = cleaned.replace(/\[\s*\{.*?\}\s*(?:,\s*\{.*?\}\s*)*\]/g, '');
    // 移除单个 JSON 对象
    cleaned = cleaned.replace(/\{\s*"type"\s*:\s*"[^"]*"[^}]*\}/g, '');
    // 移除 JSON 字段残留
    cleaned = cleaned.replace(/"(?:type|content|name|params|x|y|width|height|fontSize|color)"\s*:\s*"[^"]*"/g, '');
    cleaned = cleaned.replace(/"(?:x|y|width|height|fontSize)"\s*:\s*\d+/g, '');
    // 移除符号残留
    cleaned = cleaned.replace(/[\[\]{},]/g, '');
    // 清理多余空白
    cleaned = cleaned.replace(/\n\s*\n/g, '\n\n').trim();
    return cleaned;
  }
  return text;
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

// Quiz 内容类型（类型安全）
interface QuizContent {
  questions: Array<{
    id: string;
    question: string;
    options: Array<{ value: string; label: string }>;
    answer: string | string[];
  }>;
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

export default function ClassroomScreen() {
  const { id, pendingOutlines, totalScenes, remainingCount } = useLocalSearchParams<{ id: string; pendingOutlines?: string; totalScenes?: string; remainingCount?: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<ClassroomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

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

  // 教学工具状态
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showPointer, setShowPointer] = useState(false);
  const [showThumbnailNav, setShowThumbnailNav] = useState(false);

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

  // TTS 配置
  const [ttsConfig, setTtsConfig] = useState<TTSConfig>({
    provider: 'qwen',
    voice: 'Cherry',
    speed: 1.0,
    model: 'qwen3-tts-flash',
  });
  const [showTtsSettings, setShowTtsSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<Record<string, Array<{ id: string; name: string }>>>({});

  // 知识提取
  const [extractingKnowledge, setExtractingKnowledge] = useState(false);
  const [showExtractResult, setShowExtractResult] = useState(false);
  const [extractedCards, setExtractedCards] = useState<any[]>([]);

  // 测验交互状态
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, boolean>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // ScrollView refs - 用于滚动定位
  const quizScrollRef = useRef<ScrollView>(null);

  // 场景切换动画 - 使用 Reanimated
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const screenWidth = Dimensions.get('window').width - 40;

  useEffect(() => {
    if (!authLoading && isAuthenticated && id) {
      loadClassroom();
    }
  }, [id, authLoading, isAuthenticated]);

  // Quiz场景状态恢复 - 当切换到Quiz场景时加载持久化状态
  // 注意：必须在所有条件返回之前声明（遵循 React Hooks 规则）
  useEffect(() => {
    const scene = data?.scenes?.[currentSceneIndex];
    if (scene?.type === 'quiz' && scene?.id) {
      const loadQuizState = async () => {
        const submittedState = await readSubmittedState(scene.id);
        if (submittedState) {
          if (submittedState.kind === 'reviewing') {
            // 已提交并批改 - 转换类型：QuizAnswers是string | string[]，单选转为string
            const answers: Record<string, string> = {};
            Object.entries(submittedState.answers).forEach(([key, value]) => {
              answers[key] = typeof value === 'string' ? value : value[0] || '';
            });
            setSelectedAnswers(answers);
            const resultsMap: Record<string, boolean> = {};
            submittedState.results.forEach(r => {
              resultsMap[r.questionId] = r.correct === true;
            });
            setSubmittedAnswers(resultsMap);
            setQuizSubmitted(true);
          } else if (submittedState.kind === 'answering') {
            // 已提交但未批改
            const answers: Record<string, string> = {};
            Object.entries(submittedState.answers).forEach(([key, value]) => {
              answers[key] = typeof value === 'string' ? value : value[0] || '';
            });
            setSelectedAnswers(answers);
            setQuizSubmitted(true);
          }
        } else {
          // 没有提交状态，加载草稿
          const draft = await readDraft(scene.id);
          if (draft && Object.keys(draft).length > 0) {
            const answers: Record<string, string> = {};
            Object.entries(draft).forEach(([key, value]) => {
              answers[key] = typeof value === 'string' ? value : value[0] || '';
            });
            setSelectedAnswers(answers);
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
          console.warn('[Chat] Failed to load history:', err);
        }
      };
      loadChatHistory();
    }
  }, [data, currentSceneIndex]);

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
  async function startBackgroundSceneCreationFromAPI(outlines: SceneOutline[]) {
    if (!id || !outlines || outlines.length === 0 || backgroundCreatingRef.current) return;

    backgroundCreatingRef.current = true;
    setBackgroundCreating(true);
    setPendingScenesTotal(outlines.length);
    setCreatedScenesCount(0);

    console.log(`[Background] 开始创建 ${outlines.length} 个剩余场景（从API获取）`);

    // 获取已有场景数量（在调用此函数时 data 可能还未设置，使用 1 作为默认值）
    const existingCount = 1;

    // 获取课程语言设置
    const language = data?.stage?.language_directive || 'zh-CN';

    // 逐个创建剩余场景
    for (let i = 0; i < outlines.length; i++) {
      const outline = outlines[i];
      const orderIndex = existingCount + i + 1;
      console.log(`[Background] 创建场景 ${orderIndex}/${existingCount + outlines.length}: ${outline.title}`);

      try {
        await apiClient.createScene(id, outline, orderIndex, language);
        setCreatedScenesCount(i + 1);

        // 创建成功后刷新课程数据（每 2 个场景刷新一次）
        if ((i + 1) % 2 === 0 || i === outlines.length - 1) {
          const updatedData = await apiClient.getClassroom(id);
          setData(updatedData);
        }
      } catch (sceneErr: any) {
        console.warn(`[Background] 场景 ${outline.title} 创建失败:`, sceneErr.message);
      }
    }

    // 最终刷新并清除 pendingOutlines
    const finalData = await apiClient.getClassroom(id);
    setData(finalData);
    console.log(`[Background] 所有场景创建完成`);

    backgroundCreatingRef.current = false;
    setBackgroundCreating(false);
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
        console.log('[LoadClassroom] Starting background scene creation from API outlines...');
        setShowManualCreateHint(false);
        startBackgroundSceneCreationFromAPI(pendingOutlinesFromAPI);
      } else if (pendingOutlinesParam && !backgroundCreatingRef.current) {
        // 有完整大纲数据（URL参数），自动后台创建
        console.log('[LoadClassroom] Starting background scene creation from URL param...');
        setShowManualCreateHint(false);
        startBackgroundSceneCreation();
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

  // 后台创建剩余场景（优化用户体验）
  async function startBackgroundSceneCreation() {
    if (!id || !pendingOutlines || backgroundCreatingRef.current) return;

    try {
      // 解码 URL 参数
      const decodedOutlines = decodeURIComponent(pendingOutlines);

      // 解析 JSON（可能失败）
      let outlines: SceneOutline[];
      try {
        outlines = JSON.parse(decodedOutlines);
      } catch (parseErr) {
        console.error('[Background] JSON解析失败:', parseErr);
        setBackgroundCreating(false);
        return;
      }

      if (!Array.isArray(outlines) || outlines.length === 0) {
        console.warn('[Background] 无有效大纲数据');
        setBackgroundCreating(false);
        return;
      }

      backgroundCreatingRef.current = true;
      setBackgroundCreating(true);
      setPendingScenesTotal(outlines.length);
      setCreatedScenesCount(0);

      console.log(`[Background] 开始创建 ${outlines.length} 个剩余场景`);

      // 获取已有场景数量（第一个场景已创建，顺序从 2 开始）
      const existingCount = 1; // 第一个场景在创建页面已生成

      // 获取课程语言设置
      const language = data?.stage?.language_directive || 'zh-CN';

      // 逐个创建剩余场景
      for (let i = 0; i < outlines.length; i++) {
        const outline = outlines[i];
        const orderIndex = existingCount + i + 1; // 第一个场景是 1，剩余场景从 2 开始
        console.log(`[Background] 创建场景 ${orderIndex}/${totalScenes || outlines.length + existingCount}: ${outline.title}`);

        try {
          await apiClient.createScene(id, outline, orderIndex, language);
          setCreatedScenesCount(i + 1);

          // 创建成功后刷新课程数据（每 2 个场景刷新一次，避免频繁请求）
          if ((i + 1) % 2 === 0 || i === outlines.length - 1) {
            const updatedData = await apiClient.getClassroom(id);
            setData(updatedData);
          }
        } catch (sceneErr: any) {
          console.warn(`[Background] 场景 ${outline.title} 创建失败:`, sceneErr.message);
        }
      }

      // 最终刷新
      const finalData = await apiClient.getClassroom(id);
      setData(finalData);
      console.log(`[Background] 所有场景创建完成`);

    } catch (err) {
      console.error('[Background] 后台创建失败:', err);
    } finally {
      setBackgroundCreating(false);
    }
  }

  async function loadAgents(classroomData: ClassroomData) {
    // 定义统一的默认 fallback agents（4个）
    const defaultFallbackAgents: Agent[] = [
      { id: 'teacher', name: '张老师', role: 'teacher', color: '#5b9bd5', persona: '主讲教师，讲解清晰有条理', avatar: 'teacher.png' },
      { id: 'assistant', name: '李助教', role: 'assistant', color: '#10b981', persona: '辅助讲解，答疑解惑', avatar: 'assistant.png' },
      { id: 'student1', name: '好奇小明', role: 'student', color: '#f59e0b', persona: '好奇心强，喜欢提问', avatar: 'student1.png' },
      { id: 'student2', name: '学霸小红', role: 'student', color: '#8b5cf6', persona: '学霸型，理解能力强', avatar: 'student2.png' },
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

    // 规范化 agent 颜色（确保格式正确）
    const normalizeAgentColor = (a: Agent): Agent => {
      const validColor = isValidHexColor(a.color) ? a.color : '#888888';
      return { ...a, color: validColor };
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
          // 切换场景时清除视觉效果和白板
          setSpotlightElementId(null);
          setLaserElementId(null);
          setShowWhiteboard(false);
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
          console.log('[Whiteboard] Action:', action.type);
        },
        onWhiteboardOpen: () => {
          setShowWhiteboard(true);
        },
      },
      ttsConfig
    );
  }, [data, ttsConfig]);

  // 加载可用语音列表
  useEffect(() => {
    async function loadVoices() {
      try {
        const voices = await apiClient.getTTSVoices();
        setAvailableVoices(voices);
      } catch (err) {
        console.warn('[TTS] Failed to load voices:', err);
      }
    }
    loadVoices();
  }, []);

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
      whiteboardStore.clear();
    };
  }, []);

  // 当前场景（用于各种函数，必须在条件返回之前定义）
  // 注意：data 可能为 null，所以使用可选链
  const currentScene = data?.scenes?.[currentSceneIndex];

  function goToScene(index: number) {
    if (index !== currentSceneIndex) {
      playbackEngineRef.current?.jumpToScene(index);
      setShowThumbnailNav(false);
      // 重置测验状态（新的场景会在useEffect中恢复持久化状态）
      setSelectedAnswers({});
      setSubmittedAnswers({});
      setQuizSubmitted(false);
    }
  }

  // 测验交互函数
  const selectAnswer = (questionId: string, optionValue: string) => {
    const newAnswers = { ...selectedAnswers, [questionId]: optionValue };
    setSelectedAnswers(newAnswers);
    // 持久化草稿答案
    if (currentScene?.id) {
      writeDraft(currentScene.id, newAnswers);
    }
  };

  const submitQuiz = async () => {
    const scene = currentScene;
    if (!scene) return;
    if (!(scene.content as any)?.questions) return;

    const questions = (scene.content as any).questions;

    // 检查是否所有问题都已选择答案
    const unanswered = questions.filter((q: any) => !selectedAnswers[q.id]);
    if (unanswered.length > 0) {
      Alert.alert('提示', `还有 ${unanswered.length} 个问题未作答，请完成所有问题后再提交`);
      return;
    }

    const results: Record<string, boolean> = {};
    const questionResults: QuestionResult[] = [];

    // 检查答案
    questions.forEach((q: any) => {
      const correctAnswer = q.answer?.[0] || q.answer;
      const isCorrect = selectedAnswers[q.id] === correctAnswer;
      results[q.id] = isCorrect;
      questionResults.push({
        questionId: q.id,
        correct: isCorrect,
        feedback: isCorrect ? '回答正确' : `正确答案是: ${correctAnswer}`,
      });
    });

    setSubmittedAnswers(results);
    setQuizSubmitted(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // 持久化提交答案和结果
    if (currentScene?.id) {
      await writeSubmittedAnswers(currentScene.id, selectedAnswers);
      await writeSubmittedResults(currentScene.id, questionResults);
    }

    // 如果有错误答案，请求 Agent 解析（可选）
    const wrongQuestions = questions.filter((q: any) => !results[q.id]);
    if (wrongQuestions.length > 0 && agents.length > 0) {
      const teacherAgent = agents.find(a => a.role === 'teacher') || agents[0];
      setSelectedAgent(teacherAgent);
      const wrongSummary = wrongQuestions.map((q: any) => q.question).join('\n');
      setChatHistory([
        { agent: '系统', message: `你在以下问题上有错误：\n${wrongSummary}` },
        { agent: teacherAgent.name, message: '让我帮你分析一下这些问题的正确答案...' }
      ]);
      setShowChatModal(true);
    }
  };

  const resetQuiz = async () => {
    setSelectedAnswers({});
    setSubmittedAnswers({});
    setQuizSubmitted(false);
    // 清除持久化数据
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
      console.log('[Chat] Agents:', agents.slice(0, 3).map(a => ({ id: a.id, name: a.name, role: a.role })));
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

            if (actionName === 'wb_open') {
              setShowWhiteboard(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (actionName === 'wb_clear') {
              whiteboardStore.clear();
              setWhiteboardTextContent(null);
            } else if (actionName === 'wb_close') {
              setShowWhiteboard(false);
              whiteboardStore.clear();
              setWhiteboardTextContent(null);
            } else if (actionName.startsWith('wb_')) {
              mobileActionEngine.execute(actionName, params);
              setShowWhiteboard(true);
            }
          } else if (event.type === 'agent_end') {
            const agentId = event.agentId || '';
            setSpeakingAgentId(null);
            // TTS播放Agent发言
            const textToSpeak = currentAgentTextRef.current.trim();
            if (textToSpeak) {
              console.log('[TTS] Speaking agent text:', textToSpeak.slice(0, 50));
              Speech.speak(textToSpeak, { language: 'zh-CN', rate: 1.0 });
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
        console.log('[Chat] Loaded history for scene:', currentScene.id, history.length, 'entries');
      } catch (err) {
        console.warn('[Chat] Failed to load history:', err);
        setChatHistory([]);
      }
    }
  }

  // 构建讨论主题（包含场景上下文）
  function buildDiscussionTopic(scene: Scene | undefined): string {
    if (!scene) return '课程主题讨论';

    const title = scene.title;
    const description = (scene.content as any)?.description || '';
    const keyPoints = (scene.content as any)?.key_points || [];

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
        Alert.alert('提示', '当前场景暂无讨论历史记录');
      }
    } catch (err) {
      console.warn('[Discussion] Failed to load history:', err);
      Alert.alert('提示', '加载讨论历史失败');
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
    const context = {
      scene_title: currentScene?.title || '',
      description: (currentScene?.content as any)?.description || '',
      key_points: (currentScene?.content as any)?.key_points || [],
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
                const text = cleanJsonFromText(currentAgentTextRef.current.trim());
                if (text) {
                  allResponses.push({ agent: agentInfo?.name || agentRole, agentId: agentRole, content: text });
                  // TTS
                  if (agentInfo?.voiceConfig?.voiceId) {
                    playDiscussionTTS(text, agentInfo.voiceConfig);
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
      console.error('[Discussion] Batch failed:', err);
      setDiscussionRunning(false);
      setWaitingForAgent(false);
      setChatHistory(prev => [...prev, { agent: '系统', message: `讨论出错：${err.message}` }]);
    }
  }

  // 处理讨论中的 action
  function handleDiscussionAction(actionName: string, params: any) {
    if (actionName === 'wb_open' || actionName.startsWith('wb_')) {
      setShowWhiteboard(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (actionName === 'wb_clear') {
      whiteboardStore.clear();
      setWhiteboardTextContent(null);
    } else if (actionName === 'wb_close') {
      whiteboardStore.clear();
      setWhiteboardTextContent(null);
    } else if (actionName.startsWith('wb_')) {
      mobileActionEngine.execute(actionName, params);
    }
  }

  // 播放讨论 TTS
  function playDiscussionTTS(text: string, voiceConfig: { providerId: string; voiceId: string }) {
    if (!discussionAudioPlayerRef.current) {
      discussionAudioPlayerRef.current = new AudioPlayer({ onPlayEnd: () => {}, onError: () => {} });
    }
    apiClient.generateTTS(text.slice(0, 200), `disc_${Date.now()}`, voiceConfig.providerId || 'qwen', voiceConfig.voiceId, 1.0)
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
        Alert.alert('提示', '未提取到新的知识点');
      }
    } catch (err: any) {
      Alert.alert('提取失败', err.response?.data?.detail || 'AI服务暂时不可用');
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
                Alert.alert(
                  '创建剩余场景',
                  `将创建 ${pendingScenesTotal} 个场景，预计需要 ${pendingScenesTotal * 3} 分钟`,
                  [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '开始创建',
                      onPress: () => {
                        setShowManualCreateHint(false);
                        // 跳转回创建页面重新生成（最简单方案）
                        Alert.alert('提示', '请返回创建页面重新生成课程，或手动添加场景');
                      }
                    }
                  ]
                );
              }}
            >
              <Text style={styles.manualCreateBtnText}>查看详情</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 头部：标题 + 返回按钮 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#c45a1a" />
          </TouchableOpacity>
          <Text style={styles.title}>{data.stage.name}</Text>
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
          <Animated.View style={[styles.contentInner, animatedStyle]}>
            {/* Slide类型：使用 ScreenCanvas 渲染 */}
            {currentScene?.type === 'slide' && (currentScene.content as any)?.canvas?.elements?.length > 0 ? (
              <ScreenCanvas
                elements={(currentScene.content as any)?.canvas?.elements || []}
                background={convertToSlideBackground((currentScene.content as any)?.canvas?.background)}
                theme={undefined}
                spotlightElementId={spotlightElementId}
                laserElementId={laserElementId}
                laserOptions={laserOptions}
                scrollable={true}  // 启用滚动模式，计算完整内容高度
              />
            ) : (
          /* 没有 canvas 内容时的降级显示 */
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

        {/* Quiz 类型：测验问题 - 跟随滚动 */}
        {currentScene?.type === 'quiz' && (currentScene.content as QuizContent)?.questions && (() => {
          const quizQuestions = (currentScene.content as QuizContent).questions;
          const totalQuestions = quizQuestions.length;
          const correctCount = Object.values(submittedAnswers).filter(v => v).length;

          return (
          <View style={styles.quizOverlay}>
            <View style={styles.quizCard}>
              <View style={styles.quizHeader}>
                <Ionicons name="help-circle" size={20} color="#f59e0b" />
                <Text style={styles.quizTitle}>测验</Text>
                {quizSubmitted && (
                  <Text style={styles.quizResult}>
                    {correctCount}/{totalQuestions} 正确
                  </Text>
                )}
              </View>
              {quizQuestions.map((q, idx) => {
                const correctAnswer = q.answer?.[0] || q.answer;

                return (
                  <View key={q.id || idx} style={styles.questionContainer}>
                    <Text style={styles.questionText}>{q.question}</Text>
                    {q.options?.map((opt, optIdx) => {
                      const optSelected = selectedAnswers[q.id] === opt.value;
                      const optIsCorrect = opt.value === correctAnswer;
                      const showResult = quizSubmitted && submittedAnswers[q.id] !== undefined;

                      return (
                        <TouchableOpacity
                          key={opt.value ?? optIdx}
                          style={[
                            styles.optionButton,
                            optSelected && styles.optionSelected,
                            showResult && optIsCorrect && styles.optionCorrect,
                            showResult && optSelected && !optIsCorrect && styles.optionWrong,
                          ]}
                          onPress={() => !quizSubmitted && selectAnswer(q.id, opt.value)}
                          disabled={quizSubmitted}
                        >
                          <Text style={[
                            styles.optionLabel,
                            optSelected && styles.optionLabelSelected,
                            showResult && optIsCorrect && styles.optionLabelCorrect,
                          ]}>{String.fromCharCode(65 + optIdx)}.</Text>
                          <Text style={[
                            styles.optionText,
                            optSelected && styles.optionTextSelected,
                          ]}>{opt.label}</Text>
                          {showResult && optIsCorrect && (
                            <Ionicons name="checkmark-circle" size={16} color="#22c55e" style={styles.optionIcon} />
                          )}
                          {showResult && optSelected && !optIsCorrect && (
                            <Ionicons name="close-circle" size={16} color="#ef4444" style={styles.optionIcon} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    {quizSubmitted && !submittedAnswers[q.id] && (
                      <Text style={styles.explanationText}>
                        正确答案：{q.options?.find(o => o.value === correctAnswer)?.label || correctAnswer}
                      </Text>
                    )}
                  </View>
                );
              })}

              {/* 提交按钮区域 */}
              {!quizSubmitted && Object.keys(selectedAnswers).length > 0 && (
                <TouchableOpacity style={styles.submitButton} onPress={submitQuiz}>
                  <Text style={styles.submitButtonText}>提交答案</Text>
                </TouchableOpacity>
              )}

              {quizSubmitted && (
                <TouchableOpacity style={styles.resetButton} onPress={resetQuiz}>
                  <Text style={styles.resetButtonText}>重新作答</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          );
        })()}

        {/* Interactive 类型：互动讨论场景 */}
        {currentScene?.type === 'interactive' && (
          <View style={styles.interactiveOverlay}>
            <View style={styles.interactiveCard}>
              <View style={styles.interactiveHeader}>
                <Ionicons name="people" size={24} color="#10b981" />
                <Text style={styles.interactiveTitle}>互动讨论</Text>
              </View>
              <Text style={styles.interactiveTopic}>{currentScene?.title}</Text>
              <Text style={styles.interactiveDesc}>{(currentScene?.content as any)?.description || '互动讨论场景，点击下方按钮开始与Agent互动'}</Text>

              {/* 关键讨论点 */}
              {(currentScene?.content as any)?.key_points?.length > 0 && (
                <View style={styles.discussionPoints}>
                  <Text style={styles.discussionLabel}>讨论要点：</Text>
                  {(currentScene?.content as any)?.key_points?.map((point: string, idx: number) => (
                    <View key={idx} style={styles.discussionItem}>
                      <Ionicons name="chatbubble-outline" size={16} color="#10b981" />
                      <Text style={styles.discussionText}>{point}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 多 Agent 讨论按钮 */}
              <TouchableOpacity
                style={styles.startDiscussionBtn}
                onPress={() => startMultiAgentDiscussion(buildDiscussionTopic(currentScene))}
                disabled={discussionRunning}
              >
                {discussionRunning ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="chatbubbles" size={20} color="white" />
                )}
                <Text style={styles.startDiscussionText}>
                  {discussionRunning ? '讨论进行中...' : '开始多Agent讨论'}
                </Text>
              </TouchableOpacity>

              {/* 查看讨论历史按钮 */}
              {hasDiscussionHistory && !discussionRunning && (
                <TouchableOpacity
                  style={styles.viewHistoryBtn}
                  onPress={loadDiscussionHistory}
                >
                  <Ionicons name="time-outline" size={20} color="#10b981" />
                  <Text style={styles.viewHistoryText}>查看讨论历史</Text>
                </TouchableOpacity>
              )}

              {/* 单 Agent 对话按钮 */}
              <TouchableOpacity
                style={styles.startSingleChatBtn}
                onPress={() => {
                  if (agents.length > 0) {
                    const teacherAgent = agents.find(a => a.role === 'teacher') || agents[0];
                    setSelectedAgent(teacherAgent);
                    setChatHistory([]);
                    setDiscussionMode(false);
                    setShowChatModal(true);
                  }
                }}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#10b981" />
                <Text style={styles.startSingleChatText}>单Agent对话</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* PBL 类型：项目学习场景 */}
        {currentScene?.type === 'pbl' && (
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
        )}
      </Animated.View>
    </ScrollView>

    {/* 白板区域 - 使用 absolute 定位，与聊天同时显示 */}
      <WhiteboardOverlay
        visible={showWhiteboard}
        textContent={whiteboardTextContent}
        onClose={() => setShowWhiteboard(false)}
        useAbsolute={showChatModal}
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
      <View style={styles.agentBar}>
        {agents.length === 0 && (
          <Text style={{ color: '#999', fontSize: 12 }}>加载智能体...</Text>
        )}
        {agents.map(agent => (
          <TouchableOpacity
            key={agent.id}
            style={[styles.agentAvatarBtn, { backgroundColor: safeColorWithAlpha(agent.color, '20') }]}
            onPress={() => openAgentChat(agent)}
          >
            {/* 头像显示 - 使用 emoji 或首字母 */}
            <View style={[styles.agentAvatarCircle, { backgroundColor: agent.color }]}>
              <Text style={styles.agentAvatarInner}>
                {agent.avatar === 'teacher.png' ? '👨‍🏫' :
                 agent.avatar === 'assistant.png' ? '👨‍💼' :
                 agent.avatar?.startsWith('student') ? '👨' :
                 agent.avatar ? '👤' : agent.name[0]}
              </Text>
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
      <View style={styles.toolbar}>
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

        {/* TTS 设置 */}
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={() => setShowTtsSettings(true)}
        >
          <Ionicons name="settings-outline" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, showWhiteboard && styles.toolBtnActive]}
          onPress={() => setShowWhiteboard(!showWhiteboard)}
        >
          <Ionicons name="pencil" size={20} color={showWhiteboard ? 'white' : '#666'} />
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

      {/* 智能体聊天面板 - 白板打开时使用固定底部布局 */}
      {showChatModal && showWhiteboard ? (
        <View style={styles.chatPanelFixed}>
          {/* 头部 */}
          <View style={styles.chatPanelHeader}>
            {selectedAgent && (
              <View style={[styles.modalAgentAvatarSmall, { backgroundColor: selectedAgent.color }]}>
                <Text style={styles.modalAgentAvatarText}>
                  {selectedAgent.avatar === 'teacher.png' ? '👨‍🏫' :
                   selectedAgent.avatar === 'assistant.png' ? '👨‍💼' :
                   selectedAgent.avatar?.startsWith('student') ? '👨' :
                   selectedAgent.avatar ? '👤' : selectedAgent.name[0]}
                </Text>
              </View>
            )}
            <Text style={styles.chatPanelTitle}>{selectedAgent?.name || (discussionMode ? '多Agent讨论' : '对话')}</Text>
            <TouchableOpacity onPress={() => {
              setShowChatModal(false);
              // 不停止讨论，让讨论在后台继续进行
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
                      <Text style={styles.participantAvatarText}>
                        {agent.avatar === 'teacher.png' ? '👨‍🏫' : agent.avatar === 'assistant.png' ? '👨‍💼' : agent.avatar?.startsWith('student') ? '👨' : agent.avatar ? '👤' : agent.name[0]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* 聊天历史 */}
          <ScrollView style={styles.chatHistoryCompact}>
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
                <Text style={styles.modalAgentAvatarText}>
                  {selectedAgent.avatar === 'teacher.png' ? '👨‍🏫' :
                   selectedAgent.avatar === 'assistant.png' ? '👨‍💼' :
                   selectedAgent.avatar?.startsWith('student') ? '👨' :
                   selectedAgent.avatar ? '👤' : selectedAgent.name[0]}
                </Text>
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
              <Ionicons name="close" size={22} color="#666" />
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
                      <Text style={styles.participantAvatarText}>
                        {agent.avatar === 'teacher.png' ? '👨‍🏫' : agent.avatar === 'assistant.png' ? '👨‍💼' : agent.avatar?.startsWith('student') ? '👨' : agent.avatar ? '👤' : agent.name[0]}
                      </Text>
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

      {/* TTS 设置模态框 */}
      <BottomSheetModal
        visible={showTtsSettings}
        onClose={() => setShowTtsSettings(false)}
        contentStyle={styles.modalContent}
      >
        <View style={styles.modalHeader}>
          <Ionicons name="settings" size={24} color="#5b9bd5" />
          <Text style={styles.modalTitle}>语音设置</Text>
          <TouchableOpacity onPress={() => setShowTtsSettings(false)}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.ttsSettingsContent}>
          {/* Provider 选择 */}
          <Text style={styles.ttsSettingLabel}>语音服务商</Text>
          <View style={styles.ttsOptionsRow}>
            {['qwen', 'openai', 'minimax'].map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.ttsOptionBtn, ttsConfig.provider === p && styles.ttsOptionActive]}
                onPress={() => {
                  const defaultVoices: Record<string, string> = {
                    qwen: 'Cherry',
                    openai: 'alloy',
                    minimax: 'female-yujie',
                  };
                  setTtsConfig({ ...ttsConfig, provider: p as any, voice: defaultVoices[p] });
                }}
              >
                <Text style={[styles.ttsOptionText, ttsConfig.provider === p && styles.ttsOptionTextActive]}>
                  {p === 'qwen' ? '阿里云' : p === 'openai' ? 'OpenAI' : 'MiniMax'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Voice 选择 */}
          <Text style={styles.ttsSettingLabel}>语音角色</Text>
          <ScrollView horizontal style={styles.voiceScroll} showsHorizontalScrollIndicator={false}>
            {(availableVoices[ttsConfig.provider] || []).map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.voiceBtn, ttsConfig.voice === v.id && styles.voiceBtnActive]}
                onPress={() => setTtsConfig({ ...ttsConfig, voice: v.id })}
              >
                <Text style={[styles.voiceText, ttsConfig.voice === v.id && styles.voiceTextActive]}>
                  {v.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Speed 选择 */}
          <Text style={styles.ttsSettingLabel}>语速: {ttsConfig.speed.toFixed(1)}x</Text>
          <View style={styles.speedSlider}>
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.speedBtn, ttsConfig.speed === s && styles.speedBtnActive]}
                onPress={() => setTtsConfig({ ...ttsConfig, speed: s })}
              >
                <Text style={[styles.speedText, ttsConfig.speed === s && styles.speedTextActive]}>
                  {s}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.ttsSaveBtn}
          onPress={() => {
            playbackEngineRef.current?.setTTSConfig(ttsConfig);
            setShowTtsSettings(false);
          }}
        >
          <Text style={styles.ttsSaveBtnText}>应用设置</Text>
        </TouchableOpacity>
      </BottomSheetModal>

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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary.transparent,
    padding: Spacing.sm,
    borderRadius: Rounded.lg,
  },
  backText: { color: Colors.primary.main, fontSize: 14, fontWeight: '500' },
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
    paddingBottom: Spacing.md, // 底部留出滚动空间
  },
  contentInner: {
    width: '100%',  // 明确设置宽度为100%
    maxWidth: '100%',  // 限制最大宽度
    alignSelf: 'center',  // 居中显示
  },
  slideScroll: { flex: 1 },
  slideContainer: { flex: 1, alignItems: 'center' },
  slideCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: Rounded.lg,
    padding: Spacing.lg + 1,
    width: '100%',
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
  questionText: { fontSize: 15, color: '#333', marginBottom: Spacing.xs, fontWeight: '500' },
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
  explanationText: { fontSize: 13, color: '#ef4444', marginTop: Spacing.sm, padding: Spacing.sm, backgroundColor: '#fef2f2', borderRadius: Rounded.sm },
  submitButton: { backgroundColor: '#3b82f6', padding: Spacing.sm + 2, borderRadius: Rounded.md, alignItems: 'center', flex: 1, marginRight: Spacing.sm },
  submitButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  resetButton: { backgroundColor: '#6b7280', padding: Spacing.sm + 2, borderRadius: Rounded.md, alignItems: 'center', flex: 1 },
  resetButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
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
    padding: Spacing.sm, // 减少 padding
    maxHeight: 350, // 固定最大高度，防止溢出
    minHeight: 200,
  },
  modalHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs, // 减少 margin
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalAgentAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAgentAvatarText: {
    fontSize: 14,
    color: 'white',
  },
  modalTitleCompact: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: Spacing.sm,
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
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#f5f7fa',
    borderRadius: Rounded.sm,
    marginBottom: Spacing.sm,
  },
  participantsLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: Spacing.sm,
  },
  participantsAvatars: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  speakingDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
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

  // 固定底部聊天面板样式（白板打开时使用）
  chatPanelFixed: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '33%', // 占屏幕 1/3
    backgroundColor: 'white',
    borderTopLeftRadius: Rounded.lg,
    borderTopRightRadius: Rounded.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 20,
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
    maxHeight: 150, // 固定最大高度，防止溢出
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

  // TTS 设置模态框
  ttsSettingsContent: { flex: 1, paddingVertical: Spacing.sm + 3 },
  ttsSettingLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: Spacing.sm },
  ttsOptionsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  ttsOptionBtn: {
    paddingHorizontal: Spacing.sm + 3,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.sm,
    backgroundColor: '#f5f7fa',
  },
  ttsOptionActive: { backgroundColor: '#5b9bd5' },
  ttsOptionText: { fontSize: 14, color: '#666' },
  ttsOptionTextActive: { color: 'white', fontWeight: '600' },
  voiceScroll: { marginBottom: Spacing.lg },
  voiceBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.lg,
    backgroundColor: '#f5f7fa',
    marginRight: Spacing.sm,
  },
  voiceBtnActive: { backgroundColor: '#e8f4fd', borderWidth: 1, borderColor: '#5b9bd5' },
  voiceText: { fontSize: 12, color: '#666' },
  voiceTextActive: { color: '#5b9bd5', fontWeight: '600' },
  speedSlider: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  speedBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Rounded.sm,
    backgroundColor: '#f5f7fa',
  },
  speedBtnActive: { backgroundColor: '#5b9bd5' },
  speedText: { fontSize: 12, color: '#666' },
  speedTextActive: { color: 'white' },
  // 快捷语速按钮（工具栏）
  speedBtnText: { fontSize: 12, fontWeight: '600', color: '#666' },
  ttsSaveBtn: {
    backgroundColor: '#5b9bd5',
    padding: Spacing.sm + 3,
    borderRadius: Rounded.md,
    alignItems: 'center',
  },
  ttsSaveBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },

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
});