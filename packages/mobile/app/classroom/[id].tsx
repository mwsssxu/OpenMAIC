import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth/auth-context';
import { PlaybackEngine, EngineMode, TTSConfig } from '@/lib/playback/engine';
import { Scene, Agent as LibAgent } from '@/lib/types/scene';
import { ScreenCanvas, SlideBackground } from '@/components/slide';
import { WhiteboardOverlay } from '@/components/classroom/WhiteboardOverlay';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';

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
    agent_ids?: string[];
    generatedAgentConfigs?: Agent[];
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<ClassroomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  // 教学工具状态
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showPointer, setShowPointer] = useState(false);
  const [showThumbnailNav, setShowThumbnailNav] = useState(false);

  // 智能体互动
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ agent: string; message: string }>>([]);
  const [sendingMessage, setSendingMessage] = useState(false);

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

  async function loadClassroom() {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const classroomData = await apiClient.getClassroom(id);
      setData(classroomData);

      // 加载智能体配置 - 从 API 获取完整配置
      await loadAgents(classroomData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
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
          // 切换场景时清除视觉效果
          setSpotlightElementId(null);
          setLaserElementId(null);
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
        onSpotlight: (elementId, dimness) => {
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

  // 清理引擎
  useEffect(() => {
    return () => {
      playbackEngineRef.current?.dispose();
    };
  }, []);

  function goToScene(index: number) {
    if (index !== currentSceneIndex) {
      playbackEngineRef.current?.jumpToScene(index);
      setShowThumbnailNav(false);
      // 重置测验状态
      setSelectedAnswers({});
      setSubmittedAnswers({});
      setQuizSubmitted(false);
    }
  }

  // 测验交互函数
  const selectAnswer = (questionId: string, optionValue: string) => {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: optionValue }));
  };

  const submitQuiz = async () => {
    if (!currentScene?.content?.questions) return;

    const questions = (currentScene.content as any).questions;

    // 检查是否所有问题都已选择答案
    const unanswered = questions.filter((q: any) => !selectedAnswers[q.id]);
    if (unanswered.length > 0) {
      Alert.alert('提示', `还有 ${unanswered.length} 个问题未作答，请完成所有问题后再提交`);
      return;
    }

    const results: Record<string, boolean> = {};

    // 检查答案
    questions.forEach((q: any) => {
      const correctAnswer = q.answer?.[0] || q.answer;
      results[q.id] = selectedAnswers[q.id] === correctAnswer;
    });

    setSubmittedAnswers(results);
    setQuizSubmitted(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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

  const resetQuiz = () => {
    setSelectedAnswers({});
    setSubmittedAnswers({});
    setQuizSubmitted(false);
  };

  async function sendMessage() {
    if (!chatMessage.trim() || !selectedAgent) return;

    setSendingMessage(true);
    const userMessage = chatMessage.trim();
    setChatMessage('');

    // 添加用户消息
    setChatHistory(prev => [...prev, { agent: '我', message: userMessage }]);

    try {
      // 使用 SSE 流式对话（与Web端一致）
      // 构建消息格式
      const messages = [{ role: 'user', content: userMessage }];

      // 构建配置 - 包含 agent IDs 和 personas
      const agentPersonas: Record<string, string> = {};
      if (selectedAgent.persona) {
        agentPersonas[selectedAgent.id] = selectedAgent.persona;
      }

      const config = {
        agentIds: [selectedAgent.id],
        agentPersonas,
      };

      // 构建上下文
      const storeState = {
        stage: { name: data?.stage?.name || '' },
        scene: { title: currentScene?.title || '' },
      };

      await apiClient.streamAgentChat(
        messages,
        config,
        storeState,
        // onEvent - 流式更新（可用于实时显示）
        (event) => {
          if (event.type === 'text_delta' && event.text) {
            // 可在此处实现实时流式显示（可选优化）
          }
        },
        // onComplete - 完成时添加到历史
        (response) => {
          setChatHistory(prev => [...prev, {
            agent: selectedAgent.name,
            message: response || '让我来为你讲解...'
          }]);
          setSendingMessage(false);
        },
        // onError
        (error) => {
          console.warn('[Agent Chat] SSE error:', error);
          // 降级回复
          setChatHistory(prev => [...prev, {
            agent: selectedAgent.name,
            message: `${selectedAgent.role === 'teacher' ? '这是一个很好的问题！让我来为你讲解...' : '我也有同样的疑问，让我们一起探讨...'}`
          }]);
          setSendingMessage(false);
        }
      );
    } catch (err: any) {
      // SSE 失败时降级到 REST API
      console.warn('[Agent Chat] SSE failed, using REST fallback:', err);
      try {
        const response = await apiClient.chatWithPersona(
          selectedAgent.id,
          userMessage,
          currentScene?.title,
          'teaching',
          selectedAgent.persona
        );
        const agentResponse = response.response || '收到你的问题了，让我思考一下...';
        setChatHistory(prev => [...prev, { agent: selectedAgent.name, message: agentResponse }]);
      } catch (fallbackErr: any) {
        setChatHistory(prev => [...prev, {
          agent: selectedAgent.name,
          message: `${selectedAgent.role === 'teacher' ? '这是一个很好的问题！让我来为你讲解...' : '我也有同样的疑问，让我们一起探讨...'}`
        }]);
      } finally {
        setSendingMessage(false);
      }
    }
  }

  // 打开智能体聊天
  function openAgentChat(agent: Agent) {
    setSelectedAgent(agent);
    setChatHistory([]);
    setShowChatModal(true);
  }

  // 提取当前场景知识点
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

  const currentScene = data.scenes[currentSceneIndex];

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.container}>
        {/* 头部：标题 + 返回按钮 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#5b9bd5" />
            <Text style={styles.backText}>返回</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{data.stage.name}</Text>
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>
              {currentSceneIndex + 1} / {data.scenes.length}
            </Text>
          </View>
        </View>

        {/* 场景内容 */}
        <Animated.View style={[styles.content, animatedStyle]}>
        {/* Slide类型：使用 ScreenCanvas 渲染 */}
        {currentScene?.type === 'slide' && (currentScene.content as any)?.canvas?.elements?.length > 0 ? (
          <ScreenCanvas
            elements={(currentScene.content as any)?.canvas?.elements || []}
            background={convertToSlideBackground((currentScene.content as any)?.canvas?.background)}
            theme={undefined}
            spotlightElementId={spotlightElementId}
            laserElementId={laserElementId}
            laserOptions={laserOptions}
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

        {/* Quiz 类型：额外显示测验问题 */}
        {currentScene?.type === 'quiz' && (currentScene.content as any)?.questions && (
          <View style={styles.quizOverlay}>
            <ScrollView style={styles.quizScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <View style={styles.quizCard}>
                <View style={styles.quizHeader}>
                  <Ionicons name="help-circle" size={24} color="#f59e0b" />
                  <Text style={styles.quizTitle}>测验</Text>
                  {quizSubmitted && (
                    <Text style={styles.quizResult}>
                      {Object.values(submittedAnswers).filter(v => v).length}/{Object.keys(submittedAnswers).length} 正确
                    </Text>
                  )}
                </View>
                {(currentScene.content as any)?.questions?.map((q: any, idx: number) => {
                  const correctAnswer = q.answer?.[0] || q.answer;

                  return (
                    <View key={q.id || idx} style={styles.questionContainer}>
                      <Text style={styles.questionText}>{q.question}</Text>
                      {q.options?.map((opt: any, optIdx: number) => {
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
                              <Ionicons name="checkmark-circle" size={18} color="#22c55e" style={styles.optionIcon} />
                            )}
                            {showResult && optSelected && !optIsCorrect && (
                              <Ionicons name="close-circle" size={18} color="#ef4444" style={styles.optionIcon} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      {quizSubmitted && !submittedAnswers[q.id] && (
                        <Text style={styles.explanationText}>
                          正确答案：{q.options?.find((o: any) => o.value === correctAnswer)?.label || correctAnswer}
                        </Text>
                      )}
                    </View>
                  );
                })}

                {/* 提交按钮 */}
                {!quizSubmitted && Object.keys(selectedAnswers).length > 0 && (
                  <TouchableOpacity style={styles.submitButton} onPress={submitQuiz}>
                    <Text style={styles.submitButtonText}>提交答案</Text>
                  </TouchableOpacity>
                )}

                {/* 重试按钮 */}
                {quizSubmitted && (
                  <TouchableOpacity style={styles.resetButton} onPress={resetQuiz}>
                    <Text style={styles.resetButtonText}>重新作答</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Interactive 类型：互动讨论场景 */}
        {currentScene?.type === 'interactive' && (
          <View style={styles.interactiveOverlay}>
            <ScrollView style={styles.interactiveScroll} nestedScrollEnabled>
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

                {/* 开始讨论按钮 */}
                <TouchableOpacity
                  style={styles.startDiscussionBtn}
                  onPress={() => {
                    if (agents.length > 0) {
                      const teacherAgent = agents.find(a => a.role === 'teacher') || agents[0];
                      setSelectedAgent(teacherAgent);
                      setChatHistory([]);
                      setShowChatModal(true);
                    }
                  }}
                >
                  <Ionicons name="chatbubbles" size={20} color="white" />
                  <Text style={styles.startDiscussionText}>开始互动讨论</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}

        {/* PBL 类型：项目学习场景 */}
        {currentScene?.type === 'pbl' && (
          <View style={styles.pblOverlay}>
            <ScrollView style={styles.pblScroll} nestedScrollEnabled>
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
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* 白板覆盖层 - 从 scene.actions 中获取 wb_draw actions */}
      <WhiteboardOverlay
        visible={showWhiteboard}
        actions={(currentScene?.actions as any[])?.filter(
          (a: any) => a.type === 'wb_draw_text' || a.type === 'wb_draw_shape'
        ) || []}
        onClose={() => setShowWhiteboard(false)}
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

        {/* 自动播放开关 */}
        <TouchableOpacity
          style={[styles.toolBtn, autoPlayEnabled && styles.toolBtnActive]}
          onPress={() => setAutoPlayEnabled(!autoPlayEnabled)}
        >
          <Ionicons name={autoPlayEnabled ? "play" : "play-outline"} size={20} color={autoPlayEnabled ? 'white' : '#666'} />
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

        <TouchableOpacity
          style={[styles.toolBtn, showPointer && styles.toolBtnActive]}
          onPress={() => setShowPointer(!showPointer)}
        >
          <Ionicons name="radio-button-on" size={20} color={showPointer ? 'white' : '#666'} />
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

      {/* 智能体聊天模态框 */}
      <Modal
        visible={showChatModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowChatModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* 模态框头部 */}
            <View style={styles.modalHeader}>
              {selectedAgent && (
                <View style={[styles.modalAgentAvatar, { backgroundColor: safeColorWithAlpha(selectedAgent.color, '20') }]}>
                  <Ionicons name="person" size={32} color={selectedAgent.color} />
                </View>
              )}
              <Text style={styles.modalTitle}>
                {selectedAgent ? `与 ${selectedAgent.name} 对话` : '智能体对话'}
              </Text>
              <TouchableOpacity onPress={() => setShowChatModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* 聊天历史 */}
            <ScrollView style={styles.chatHistory}>
              {chatHistory.length === 0 && (
                <Text style={styles.chatHint}>开始提问吧，{selectedAgent?.name} 会帮助你理解课程内容</Text>
              )}
              {chatHistory.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.chatBubble,
                    item.agent === '我' ? styles.chatBubbleUser : styles.chatBubbleAgent
                  ]}
                >
                  <Text style={styles.chatBubbleAgentName}>{item.agent}</Text>
                  <Text style={styles.chatBubbleText}>{item.message}</Text>
                </View>
              ))}
            </ScrollView>

            {/* 输入框 */}
            <View style={styles.chatInputArea}>
              <TextInput
                style={styles.chatInput}
                placeholder="输入你的问题..."
                value={chatMessage}
                onChangeText={setChatMessage}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!chatMessage.trim() || sendingMessage) && styles.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!chatMessage.trim() || sendingMessage}
              >
                {sendingMessage ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="send" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* TTS 设置模态框 */}
      <Modal
        visible={showTtsSettings}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTtsSettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
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
          </View>
        </View>
      </Modal>

      {/* 知识提取结果弹窗 */}
      <Modal
        visible={showExtractResult}
        animationType="slide"
        transparent
        onRequestClose={() => setShowExtractResult(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
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
              {extractedCards.map((card, index) => (
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
          </View>
        </View>
      </Modal>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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

  // Quiz overlay (shown above slide when quiz questions exist)
  quizOverlay: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.sm + 3,
    right: Spacing.sm + 3,
    maxHeight: 300,
  },
  quizScroll: {
    maxHeight: 280,
  },
  quizCard: {
    backgroundColor: 'white',
    borderRadius: Rounded.lg,
    padding: Spacing.lg + 1,
    width: '100%',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#f59e0b20',
    paddingBottom: Spacing.sm + 7,
  },
  quizTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: Spacing.sm, color: '#333' },
  questionContainer: { marginVertical: Spacing.sm + 3 },
  questionText: { fontSize: 16, color: '#333', marginBottom: Spacing.sm, fontWeight: '500' },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: Spacing.sm,
    borderRadius: Rounded.sm,
    marginBottom: Spacing.sm,
  },
  optionLabel: { fontSize: 14, fontWeight: 'bold', color: '#5b9bd5', marginRight: Spacing.sm },
  optionText: { fontSize: 14, color: '#666' },
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
  submitButton: { backgroundColor: '#3b82f6', padding: Spacing.md, borderRadius: Rounded.md, marginTop: Spacing.md, alignItems: 'center' },
  submitButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  resetButton: { backgroundColor: '#6b7280', padding: Spacing.md, borderRadius: Rounded.md, marginTop: Spacing.md, alignItems: 'center' },
  resetButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
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

  // Interactive overlay (for interactive scenes)
  interactiveOverlay: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.sm,
    right: Spacing.sm,
    maxHeight: 200,
  },
  interactiveScroll: { flex: 1 },
  interactiveTopic: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: Spacing.sm },
  interactiveDesc: { fontSize: 14, color: '#666', marginBottom: Spacing.md },
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

  // PBL overlay (for project-based learning scenes)
  pblOverlay: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.sm,
    right: Spacing.sm,
    maxHeight: 200,
  },
  pblScroll: { flex: 1 },
  pblTask: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: Spacing.sm },
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
    maxHeight: '80%',
    minHeight: '50%',
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

  // 聊天
  chatHistory: { flex: 1, marginBottom: Spacing.sm + 3 },
  chatHint: { color: '#999', textAlign: 'center', padding: Spacing.lg },
  chatBubble: {
    padding: Spacing.sm,
    borderRadius: Spacing.sm,
    marginBottom: Spacing.sm,
    maxWidth: '80%',
  },
  chatBubbleUser: { backgroundColor: '#5b9bd5', alignSelf: 'flex-end' },
  chatBubbleAgent: { backgroundColor: '#f5f7fa', alignSelf: 'flex-start' },
  chatBubbleAgentName: { fontSize: 12, color: '#666', marginBottom: Spacing.xs - 1 },
  chatBubbleText: { fontSize: 14, color: '#333' },
  chatInputArea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
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
});