import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth/auth-context';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';

// 步骤定义 - 参考Web端：需求输入 → 大纲生成 → 智能体生成 → 确认创建
const STEPS = ['需求输入', '大纲生成', '智能体生成', '确认创建'];

// 默认大纲（当生成失败时使用）
const DEFAULT_OUTLINES: SceneOutline[] = [
  { id: '1', type: 'slide', title: '课程介绍', description: '介绍课程主题和学习目标', key_points: ['主题概述', '学习目标', '课程安排'], order: 1 },
  { id: '2', type: 'slide', title: '核心内容', description: '讲解核心知识点', key_points: ['概念定义', '原理说明', '示例演示'], order: 2 },
  { id: '3', type: 'quiz', title: '知识检测', description: '检验学习效果', key_points: ['基础题目', '进阶题目'], order: 3 },
  { id: '4', type: 'slide', title: '总结回顾', description: '回顾课程要点', key_points: ['要点总结', '延伸思考', '课后作业'], order: 4 },
];

interface AgentProfile {
  id: string;
  name: string;
  role: 'teacher' | 'assistant' | 'student';
  persona: string;
  avatar?: string;
  color?: string;
  priority?: number;
  enabled: boolean;
  voiceConfig?: {
    providerId: string;
    voiceId: string;
  };
}

interface SceneOutline {
  id: string;
  type: 'slide' | 'quiz' | 'interactive' | 'pbl';
  title: string;
  description: string;
  key_points: string[];
  order: number;
}

export default function CreateClassroomScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { onSuccess, onError } = useFeedback();

  // 步骤状态
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 步骤1: 需求输入
  const [requirement, setRequirement] = useState('');
  const [language, setLanguage] = useState<'zh-CN' | 'en-US'>('zh-CN');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // 步骤2: 智能体（LLM根据课程信息实时生成）
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [generatingAgents, setGeneratingAgents] = useState(false);

  // 步骤3: 大纲（SSE流式生成）
  const [outlines, setOutlines] = useState<SceneOutline[]>([]);
  const [generatingOutlines, setGeneratingOutlines] = useState(false);
  const outlinesRef = useRef<SceneOutline[]>([]); // 用于在回调中获取实时状态

  // 步骤4: 创建结果
  const [createdClassroomId, setCreatedClassroomId] = useState<string | null>(null);

  // 检查认证
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [authLoading, isAuthenticated]);

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.secondary.info} />
      </View>
    );
  }

  // 步骤1: 提交需求，进入大纲生成（参考Web端顺序）
  const handleStep1Next = () => {
    if (!requirement.trim()) {
      setError('请输入课程需求');
      return;
    }
    setError(null);
    setCurrentStep(1);
    // 自动开始生成大纲
    generateOutlines();
  };

  // 生成大纲（与Web端一致：使用流式endpoint，实时显示进度）
  // 大纲生成完成后自动生成Agent（与Web端一致）
  const generateOutlines = async () => {
    setGeneratingOutlines(true);
    setError(null);
    setOutlines([]);

    try {
      // 使用流式endpoint（与Web端一致）
      // Web端: /api/generate/scene-outlines-stream SSE
      // 移动端: /generate/outlines-stream SSE
      await apiClient.generateOutlinesStream(
        requirement,
        language,
        agents.length > 0 ? agents.map(a => ({
          id: a.id,
          name: a.name,
          role: a.role,
          persona: a.persona || '',
        })) : undefined,
        webSearchEnabled,
        // onOutline: 实时添加每个大纲（真正的流式体验）
        (outline) => {
          outlinesRef.current = [...outlinesRef.current, outline];
          setOutlines(outlinesRef.current);
        },
        // onComplete: 生成完成后自动生成Agent（与Web端一致）
        async (count) => {
          setGeneratingOutlines(false);
          if (count > 0) {
            setError(null);
            // 自动进入步骤2（Agent生成），不需要用户手动点击
            setCurrentStep(2);
            // 自动生成Agent（与Web端一致：大纲生成完成后立即生成Agent）
            await generateAgents(outlinesRef.current);
          }
        },
        // onError: 错误处理
        (errorMsg) => {
          setError(errorMsg);
          setGeneratingOutlines(false);
        },
      );

      // 如果没有生成大纲，使用默认大纲
      if (outlinesRef.current.length === 0) {
        outlinesRef.current = DEFAULT_OUTLINES;
        setOutlines(DEFAULT_OUTLINES);
        // 默认大纲也自动生成Agent
        setCurrentStep(2);
        await generateAgents(DEFAULT_OUTLINES);
      }
    } catch (err: any) {
      const errorMsg = err.message || '大纲生成失败';
      setError(errorMsg);

      // 失败时使用默认大纲
      outlinesRef.current = DEFAULT_OUTLINES;
      setOutlines(DEFAULT_OUTLINES);
      setGeneratingOutlines(false);
      // 默认大纲也自动生成Agent
      setCurrentStep(2);
      await generateAgents(DEFAULT_OUTLINES);
    }
  };

  // 生成智能体（LLM根据课程信息和大纲生成 - 参考Web端）
  // Agent生成完成后自动进入步骤3（确认创建）
  const generateAgents = async (outlinesData: SceneOutline[]) => {
    setGeneratingAgents(true);
    setError(null);

    try {
      // 参考Web端：传递大纲给Agent生成，让LLM根据大纲内容设计agent
      const result = await apiClient.generateAgentProfiles(
        { name: requirement.slice(0, 50), description: requirement },
        language,
        outlinesData, // 传递大纲（参考Web端）
        undefined,
        undefined,
        undefined
      );
      const generatedAgents = result.agents || [];
      setAgents(generatedAgents.map((a: AgentProfile) => ({ ...a, enabled: true })));
      // Agent生成完成后自动进入步骤3（确认创建）
      setCurrentStep(3);
    } catch (err: any) {
      console.warn('Agent生成失败，使用默认配置:', err);
      // 失败时获取默认配置
      try {
        const defaultResult = await apiClient.getDefaultAgents(language);
        setAgents((defaultResult.agents || []).map((a: AgentProfile) => ({ ...a, enabled: true })));
        // 即使失败也进入步骤3
        setCurrentStep(3);
      } catch {
        setAgents([]);
        setCurrentStep(3);
      }
    } finally {
      setGeneratingAgents(false);
    }
  };

  // 步骤4: 开始创建课程（优化体验：创建第一个场景后立即跳转）
  const handleCreate = async () => {
    setLoading(true);
    setLoadingMessage('正在创建课程记录...');
    setError(null);

    try {
      // 传递完整的智能体配置，而非仅ID（去除UI状态属性）
      const enabledAgents = agents.filter(a => a.enabled);
      const cleanAgentConfigs = enabledAgents.map(a => ({
        id: a.id,
        name: a.name,
        role: a.role as 'teacher' | 'assistant' | 'student',
        color: a.color,
        persona: a.persona,
        avatar: a.avatar,
        priority: a.priority,
        voiceConfig: a.voiceConfig,
      }));

      // 1. 创建课程记录（不生成场景，后端将全部大纲存入 pending_outlines）
      const result = await apiClient.createFullClassroom(
        requirement.slice(0, 50),
        requirement,
        outlines,
        enabledAgents.map(a => a.id),
        language,
        cleanAgentConfigs
      );
      
      // 2. 立即跳转到课堂页，由 classroom 页面接管所有场景生成（用户不再等待 200-300s 首场景生成）
      setLoadingMessage(null);
      setCreatedClassroomId(result.id);
      onSuccess();
      
      // classroom 页通过 getClassroom 拿到 stage.pendingOutlines 后自动启动后台创建
      router.replace(`/classroom/${result.id}?totalScenes=${outlines.length}`);

    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || '创建失败');
      onError();
    } finally {
      setLoading(false);
      setLoadingMessage(null);
    }
  };

  // 切换智能体启用状态
  const toggleAgent = (agentId: string) => {
    setAgents(agents.map(a =>
      a.id === agentId ? { ...a, enabled: !a.enabled } : a
    ));
  };

  // 渲染步骤指示器
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => (
        <View key={step} style={styles.stepItem}>
          <View style={[
            styles.stepCircle,
            index <= currentStep && styles.stepCircleActive
          ]}>
            <Text style={[
              styles.stepNumber,
              index <= currentStep && styles.stepNumberActive
            ]}>{index + 1}</Text>
          </View>
          <Text style={[
            styles.stepLabel,
            index === currentStep && styles.stepLabelActive
          ]}>{step}</Text>
          {index < STEPS.length - 1 && (
            <View style={[
              styles.stepLine,
              index < currentStep && styles.stepLineActive
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  // 渲染步骤1: 需求输入
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>输入课程需求</Text>
      <Text style={styles.stepHint}>描述您想创建的课程主题、目标受众、学习目标等</Text>

      <TextInput
        style={styles.requirementInput}
        placeholder="例如：为初中生创建一个关于光合作用的生物课程，包含基本概念讲解、实验演示和知识检测..."
        value={requirement}
        onChangeText={setRequirement}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      <View style={styles.optionsSection}>
        <Text style={styles.label}>课程语言</Text>
        <View style={styles.languageButtons}>
          <TouchableOpacity
            style={[styles.langBtn, language === 'zh-CN' && styles.langBtnActive]}
            onPress={() => setLanguage('zh-CN')}
          >
            <Text style={[styles.langText, language === 'zh-CN' && styles.langTextActive]}>中文</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, language === 'en-US' && styles.langBtnActive]}
            onPress={() => setLanguage('en-US')}
          >
            <Text style={[styles.langText, language === 'en-US' && styles.langTextActive]}>英文</Text>
          </TouchableOpacity>
        </View>

        {/* 网络搜索选项 */}
        <View style={styles.webSearchOption}>
          <TouchableOpacity
            style={[styles.checkbox, webSearchEnabled && styles.checkboxActive]}
            onPress={() => setWebSearchEnabled(!webSearchEnabled)}
          >
            {webSearchEnabled && <Ionicons name="checkmark" size={14} color="white" />}
          </TouchableOpacity>
          <Text style={styles.webSearchLabel}>启用网络搜索增强内容</Text>
        </View>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity style={styles.nextBtn} onPress={handleStep1Next}>
        <Text style={styles.nextBtnText}>生成智能体</Text>
      </TouchableOpacity>
    </View>
  );

  // 渲染步骤2: 智能体生成（LLM实时生成）
  const renderStepAgent = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>课堂智能体</Text>
      <Text style={styles.stepHint}>AI正在根据您的课程需求生成互动角色...</Text>

      {generatingAgents ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.secondary.info} />
          <Text style={styles.generatingText}>正在生成智能体配置...</Text>
        </View>
      ) : agents.length > 0 ? (
        <ScrollView style={styles.agentList}>
          {agents.map(agent => (
            <TouchableOpacity
              key={agent.id}
              style={[styles.agentCard, agent.enabled && styles.agentCardActive]}
              onPress={() => toggleAgent(agent.id)}
            >
              <View style={[styles.agentAvatar, { backgroundColor: agent.color ? agent.color + '20' : Colors.secondary.info + '20' }]}>
                {agent.avatar ? (
                  <Text style={styles.avatarEmoji}>
                    {agent.avatar.includes('teacher') ? '👨‍🏫' :
                     agent.avatar.includes('assist') ? '👨‍💼' :
                     agent.avatar.includes('curious') ? '🧐' :
                     agent.avatar.includes('thinker') ? '🤔' :
                     agent.avatar.includes('note-taker') ? '📝' : '🧑'}
                  </Text>
                ) : (
                  <Ionicons name="person" size={24} color={agent.color || Colors.secondary.info} />
                )}
              </View>
              <View style={styles.agentInfo}>
                <Text style={styles.agentName}>{agent.name}</Text>
                <View style={styles.agentRoleRow}>
                  <Text style={styles.agentRoleType}>
                    {agent.role === 'teacher' ? '主讲老师' :
                     agent.role === 'assistant' ? '助教' : '学生'}
                  </Text>
                  {agent.voiceConfig && (
                    <View style={styles.voiceBadge}>
                      <Ionicons name="volume-high" size={12} color={Colors.secondary.success} />
                      <Text style={styles.voiceBadgeText}>语音已配置</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.agentPersona} numberOfLines={2}>{agent.persona}</Text>
                {agent.priority && (
                  <Text style={styles.agentPriority}>优先级: {agent.priority}</Text>
                )}
              </View>
              <View style={[styles.agentCheckbox, agent.enabled && styles.agentCheckboxActive]}>
                {agent.enabled && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>智能体生成失败</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => generateAgents(outlines)}>
            <Text style={styles.retryText}>重新生成</Text>
          </TouchableOpacity>
        </View>
      )}

      {!generatingAgents && agents.length > 0 && (
        <Text style={styles.selectedCount}>
          已选择 {agents.filter(a => a.enabled).length} 个智能体参与课堂
        </Text>
      )}

      {error && !generatingAgents && agents.length > 0 && <Text style={styles.errorText}>{error}</Text>}

      {/* Agent生成完成后自动进入步骤3，此步骤不需要手动点击按钮 */}
      {generatingAgents ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.secondary.info} />
          <Text style={styles.generatingText}>正在生成智能体...</Text>
        </View>
      ) : (
        <View style={styles.stepButtons}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentStep(1)}>
            <Text style={styles.backBtnText}>返回修改大纲</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // 渲染步骤1: 大纲生成（流式生成，完成后自动进入Agent生成）
  const renderStepOutline = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>课程大纲</Text>
      <Text style={styles.stepHint}>
        {generatingOutlines ? 'AI正在流式生成课程结构...' : 'AI已生成以下课程大纲'}
      </Text>

      {generatingOutlines && outlines.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.secondary.info} />
          <Text style={styles.generatingText}>正在规划课程结构...</Text>
        </View>
      ) : (
        <ScrollView style={styles.outlineList}>
          {outlines.map((outline, index) => (
            <View
              key={outline.id}
              style={styles.outlineCard}
            >
              <View style={styles.outlineHeader}>
                <View style={[styles.outlineTypeBadge,
                  outline.type === 'slide' && styles.badgeSlide,
                  outline.type === 'quiz' && styles.badgeQuiz,
                  outline.type === 'interactive' && styles.badgeInteractive,
                  outline.type === 'pbl' && styles.badgePbl,
                ]}>
                  <Text style={styles.outlineTypeText}>
                    {outline.type === 'slide' ? '幻灯片' :
                     outline.type === 'quiz' ? '测验' :
                     outline.type === 'interactive' ? '互动' : 'PBL'}
                  </Text>
                </View>
                <Text style={styles.outlineOrder}>#{index + 1}</Text>
              </View>
              <Text style={styles.outlineTitle}>{outline.title}</Text>
              <Text style={styles.outlineDesc}>{outline.description}</Text>
              {outline.key_points && outline.key_points.length > 0 && (
                <View style={styles.keyPoints}>
                  {outline.key_points.map((point, i) => (
                    <Text key={i} style={styles.keyPointText}>• {point}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
          {generatingOutlines && (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#5b9bd5" />
              <Text style={styles.loadingMoreText}>继续生成...</Text>
            </View>
          )}
        </ScrollView>
      )}

      {error && !generatingOutlines && <Text style={styles.errorText}>{error}</Text>}

      {/* 大纲生成完成后自动进入Agent生成，此步骤不需要手动点击按钮 */}
      {generatingOutlines ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.secondary.info} />
          <Text style={styles.generatingText}>大纲生成完成后将自动生成智能体...</Text>
        </View>
      ) : (
        <View style={styles.stepButtons}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentStep(0)}>
            <Text style={styles.backBtnText}>返回修改需求</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // 渲染步骤3: 确认创建
  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>确认创建</Text>
      <Text style={styles.stepHint}>检查配置信息，点击创建开始生成课程内容</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>课程配置摘要</Text>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>课程名称</Text>
          <Text style={styles.summaryValue}>{requirement.slice(0, 50)}...</Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>语言</Text>
          <Text style={styles.summaryValue}>{language === 'zh-CN' ? '中文' : '英文'}</Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>场景数量</Text>
          <Text style={styles.summaryValue}>{outlines.length} 个场景</Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>智能体</Text>
          <Text style={styles.summaryValue}>
            {agents.filter(a => a.enabled).map(a => a.name).join(', ')}
          </Text>
        </View>

        {webSearchEnabled && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>网络搜索</Text>
            <Text style={styles.summaryValue}>已启用</Text>
          </View>
        )}
      </View>

      {createdClassroomId && (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={48} color={Colors.secondary.success} />
          <Text style={styles.successText}>课程创建成功！</Text>
          <Text style={styles.successId}>ID: {createdClassroomId}</Text>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.stepButtons}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentStep(2)}>
          <Text style={styles.backBtnText}>返回</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.createBtn, (loading || createdClassroomId) && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={loading || !!createdClassroomId}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="white" size="small" />
              {loadingMessage && <Text style={styles.loadingText}>{loadingMessage}</Text>}
            </View>
          ) : (
            <Text style={styles.createBtnText}>开始创建课程</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {renderStepIndicator()}

      {currentStep === 0 && renderStep1()}
      {currentStep === 1 && renderStepOutline()}
      {currentStep === 2 && renderStepAgent()}
      {currentStep === 3 && renderStep4()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.md },
  centerContent: { alignItems: 'center', paddingVertical: Spacing.xxl },

  // 步骤指示器
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm + 4,
  },
  stepItem: { alignItems: 'center' },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: Rounded.full,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: { backgroundColor: Colors.primary.main },
  stepNumber: { color: '#666', fontSize: 14, fontWeight: '600' },
  stepNumberActive: { color: 'white' },
  stepLabel: { fontSize: 12, color: '#666', marginTop: Spacing.xs },
  stepLabelActive: { color: Colors.primary.main, fontWeight: '600' },
  stepLine: { width: 30, height: 2, backgroundColor: '#ddd', marginHorizontal: Spacing.xs },
  stepLineActive: { backgroundColor: Colors.primary.main },

  // 步骤内容
  stepContent: { padding: Spacing.md },
  stepTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: Spacing.sm },
  stepHint: { fontSize: 14, color: '#666', marginBottom: Spacing.md },

  // 步骤1 - 需求输入
  requirementInput: {
    backgroundColor: Colors.neutral.card,
    borderRadius: Rounded.sm,
    padding: Spacing.sm + 4,
    fontSize: 16,
    minHeight: 150,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: Spacing.sm },
  optionsSection: { marginTop: Spacing.md },
  languageButtons: { flexDirection: 'row', gap: Spacing.sm },
  langBtn: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: Rounded.sm,
    backgroundColor: '#e5e7eb',
  },
  langBtnActive: { backgroundColor: Colors.primary.main },
  langText: { fontSize: 14, color: '#666' },
  langTextActive: { color: 'white', fontWeight: '600' },
  webSearchOption: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: Spacing.xs,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: Colors.primary.main, borderColor: Colors.primary.main },
  webSearchLabel: { fontSize: 14, color: '#666', marginLeft: Spacing.sm },

  // 步骤2 - 智能体
  agentList: { maxHeight: 350 },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.card,
    padding: Spacing.sm + 4,
    borderRadius: Rounded.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  agentCardActive: { borderColor: Colors.primary.main, backgroundColor: Colors.primary.transparent },
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: Rounded.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: { fontSize: 20 },
  agentInfo: { flex: 1, marginLeft: Spacing.sm },
  agentName: { fontSize: 16, fontWeight: '600', color: '#333' },
  agentRoleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  agentRoleType: { fontSize: 12, color: Colors.primary.main },
  voiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary.success + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  voiceBadgeText: { fontSize: 10, color: Colors.secondary.success, marginLeft: Spacing.xs },
  agentPersona: { fontSize: 13, color: '#666', marginTop: Spacing.xs },
  agentPriority: { fontSize: 11, color: '#888', marginTop: Spacing.xs },
  agentCheckbox: {
    width: 24,
    height: 24,
    borderRadius: Rounded.full,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentCheckboxActive: { backgroundColor: Colors.primary.main, borderColor: Colors.primary.main },
  selectedCount: { fontSize: 14, color: Colors.primary.main, textAlign: 'center', marginTop: Spacing.sm },
  retryBtn: { marginTop: Spacing.md, padding: Spacing.sm + 4, backgroundColor: Colors.primary.main, borderRadius: Rounded.sm },
  retryText: { color: 'white', fontSize: 14 },

  // 步骤3 - 大纲流式生成
  outlineList: { maxHeight: 400 },
  outlineCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.sm + 4,
    borderRadius: Rounded.sm,
    marginBottom: Spacing.sm,
  },
  outlineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  outlineTypeBadge: { paddingHorizontal: 10, paddingVertical: Spacing.xs, borderRadius: Spacing.xs },
  badgeSlide: { backgroundColor: Colors.primary.light },
  badgeQuiz: { backgroundColor: Colors.primary.main },
  badgeInteractive: { backgroundColor: Colors.secondary.success },
  badgePbl: { backgroundColor: Colors.accent.main },
  outlineTypeText: { fontSize: 12, color: 'white', fontWeight: '500' },
  outlineOrder: { fontSize: 14, color: '#666' },
  outlineTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  outlineDesc: { fontSize: 14, color: '#666', marginTop: Spacing.xs },
  keyPoints: { marginTop: Spacing.sm },
  keyPointText: { fontSize: 13, color: '#555', lineHeight: 20 },
  generatingText: { marginTop: Spacing.md, color: '#666', fontSize: 14 },
  loadingMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.sm + 4 },
  loadingMoreText: { marginLeft: Spacing.sm, color: '#666', fontSize: 14 },

  // 步骤4 - 确认创建
  summaryCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.sm,
    marginBottom: Spacing.md,
  },
  summaryTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: Spacing.md },
  summaryItem: { flexDirection: 'row', marginBottom: Spacing.sm },
  summaryLabel: { width: 80, fontSize: 14, color: '#666' },
  summaryValue: { flex: 1, fontSize: 14, color: '#333' },
  successBox: {
    alignItems: 'center',
    padding: Spacing.xxl,
    backgroundColor: '#f0fff4',
    borderRadius: Rounded.sm,
    marginBottom: Spacing.md,
  },
  successText: { fontSize: 18, fontWeight: 'bold', color: Colors.secondary.success, marginTop: Spacing.sm },
  successId: { fontSize: 12, color: '#666', marginTop: Spacing.xs },

  // 按钮
  errorText: { color: Colors.feedback.errorText, fontSize: 14, textAlign: 'center', marginBottom: Spacing.md },
  stepButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  backBtn: {
    flex: 1,
    padding: Spacing.sm + 4,
    borderRadius: Rounded.sm,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  backBtnText: { color: '#666', fontSize: 16 },
  nextBtn: {
    flex: 1,
    padding: Spacing.sm + 4,
    borderRadius: Rounded.sm,
    backgroundColor: Colors.primary.main,
    alignItems: 'center',
  },
  nextBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  createBtn: {
    flex: 1,
    padding: Spacing.sm + 4,
    borderRadius: Rounded.sm,
    backgroundColor: Colors.secondary.success,
    alignItems: 'center',
  },
  createBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  loadingText: { color: 'white', fontSize: 14, marginLeft: Spacing.sm },
  btnDisabled: { backgroundColor: '#ccc' },
});