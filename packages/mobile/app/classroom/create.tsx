import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth/auth-context';
import { Colors } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';

// 步骤定义 - 按照原逻辑：需求输入 → 智能体生成 → 大纲生成 → 确认创建
const STEPS = ['需求输入', '智能体生成', '大纲生成', '确认创建'];

interface AgentProfile {
  id: string;
  name: string;
  role: string;
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

  // 步骤1: 提交需求，进入智能体生成
  const handleStep1Next = () => {
    if (!requirement.trim()) {
      setError('请输入课程需求');
      return;
    }
    setError(null);
    setCurrentStep(1);
    // 自动开始生成智能体
    generateAgents();
  };

  // 生成智能体（LLM根据课程信息实时生成 - 在大纲之前）
  const generateAgents = async () => {
    setGeneratingAgents(true);
    setError(null);

    try {
      // 使用新的 API 格式传递完整参数
      const result = await apiClient.generateAgentProfiles(
        { name: requirement.slice(0, 50), description: requirement }, // stageInfo 对象
        language, // 语言
        [], // sceneOutlines - 大纲还未生成
        undefined, // availableAvatars - 使用默认头像
        undefined, // avatarDescriptions - 可选
        undefined // availableVoices - 可选
      );
      const generatedAgents = result.agents || [];
      setAgents(generatedAgents.map((a: AgentProfile) => ({ ...a, enabled: true })));
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || '智能体生成失败');
      // 失败时获取默认配置
      try {
        const defaultResult = await apiClient.getDefaultAgents(language);
        setAgents((defaultResult.agents || []).map((a: AgentProfile) => ({ ...a, enabled: true })));
      } catch {
        setAgents([]);
      }
    } finally {
      setGeneratingAgents(false);
    }
  };

  // 步骤2: 智能体确认后，进入大纲生成
  const handleStep2Next = async () => {
    setCurrentStep(2);
    await generateOutlines();
  };

  // 生成大纲（真正的流式生成）
  const generateOutlines = async () => {
    setGeneratingOutlines(true);
    setError(null);
    setOutlines([]);
    outlinesRef.current = []; // 重置 ref

    try {
      // 使用真正的 SSE 流式生成
      await apiClient.generateOutlinesStream(
        requirement,
        language,
        agents.filter(a => a.enabled),
        webSearchEnabled,
        // 每个大纲生成时的回调
        (outline) => {
          outlinesRef.current = [...outlinesRef.current, outline];
          setOutlines(outlinesRef.current);
        },
        // 完成时的回调
        (count) => {
          setGeneratingOutlines(false);
          // 成功完成后清除错误
          if (count > 0) {
            setError(null);
          }
        },
        // 错误时的回调（只有在真正失败时才显示）
        (errorMsg) => {
          // 如果没有任何大纲生成，说明完全失败
          if (outlinesRef.current.length === 0) {
            setError(errorMsg);
            // 失败时使用默认大纲
            const defaultOutlines: SceneOutline[] = [
              { id: '1', type: 'slide', title: '课程介绍', description: '介绍课程主题和学习目标', key_points: ['主题概述', '学习目标', '课程安排'], order: 1 },
              { id: '2', type: 'slide', title: '核心内容', description: '讲解核心知识点', key_points: ['概念定义', '原理说明', '示例演示'], order: 2 },
              { id: '3', type: 'quiz', title: '知识检测', description: '检验学习效果', key_points: ['基础题目', '进阶题目'], order: 3 },
              { id: '4', type: 'slide', title: '总结回顾', description: '回顾课程要点', key_points: ['要点总结', '延伸思考', '课后作业'], order: 4 },
            ];
            
            outlinesRef.current = defaultOutlines;
            setOutlines(defaultOutlines);
          }
          setGeneratingOutlines(false);
        }
      );
    } catch (err: any) {
      // 错误已在回调中处理
      setGeneratingOutlines(false);
    }
  };

  // 步骤3: 大纲确认后，进入创建确认
  const handleStep3Next = () => {
    setCurrentStep(3);
  };

  // 步骤4: 开始创建课程（包含幻灯片生成）
  const handleCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      // 使用完整课程创建接口（包含大纲生成幻灯片）
      const result = await apiClient.createFullClassroom(
        requirement.slice(0, 50),
        requirement,
        outlines,
        agents.filter(a => a.enabled).map(a => a.id),
        language
      );

      setCreatedClassroomId(result.id);
      onSuccess();

      // 显示成功消息并跳转
      Alert.alert('成功', `课程创建成功！已生成 ${result.scenes_count} 个幻灯片`, [
        { text: '查看课程', onPress: () => router.replace(`/classroom/${result.id}`) }
      ]);

      setTimeout(() => {
        router.replace(`/classroom/${result.id}`);
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || '创建失败');
      onError();
    } finally {
      setLoading(false);
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
  const renderStep2 = () => (
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
          <TouchableOpacity style={styles.retryBtn} onPress={generateAgents}>
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

      <View style={styles.stepButtons}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentStep(0)}>
          <Text style={styles.backBtnText}>返回</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, (generatingAgents || agents.length === 0) && styles.btnDisabled]}
          onPress={handleStep2Next}
          disabled={generatingAgents || agents.length === 0}
        >
          <Text style={styles.nextBtnText}>生成大纲</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // 渲染步骤3: 大纲生成（流式生成）
  const renderStep3 = () => (
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

      <View style={styles.stepButtons}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentStep(1)}>
          <Text style={styles.backBtnText}>返回</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, (generatingOutlines || outlines.length === 0) && styles.btnDisabled]}
          onPress={handleStep3Next}
          disabled={generatingOutlines || outlines.length === 0}
        >
          <Text style={styles.nextBtnText}>确认大纲</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // 渲染步骤4: 确认创建
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
            <ActivityIndicator color="white" />
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
      {currentStep === 1 && renderStep2()}
      {currentStep === 2 && renderStep3()}
      {currentStep === 3 && renderStep4()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  centerContent: { alignItems: 'center', paddingVertical: 40 },

  // 步骤指示器
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 15,
  },
  stepItem: { alignItems: 'center' },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: { backgroundColor: Colors.secondary.info },
  stepNumber: { color: '#666', fontSize: 14, fontWeight: '600' },
  stepNumberActive: { color: 'white' },
  stepLabel: { fontSize: 12, color: '#666', marginTop: 5 },
  stepLabelActive: { color: Colors.secondary.info, fontWeight: '600' },
  stepLine: { width: 30, height: 2, backgroundColor: '#ddd', marginHorizontal: 5 },
  stepLineActive: { backgroundColor: Colors.secondary.info },

  // 步骤内容
  stepContent: { padding: 20 },
  stepTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  stepHint: { fontSize: 14, color: '#666', marginBottom: 20 },

  // 步骤1 - 需求输入
  requirementInput: {
    backgroundColor: Colors.neutral.card,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 150,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 10 },
  optionsSection: { marginTop: 20 },
  languageButtons: { flexDirection: 'row', gap: 10 },
  langBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  langBtnActive: { backgroundColor: Colors.secondary.info },
  langText: { fontSize: 14, color: '#666' },
  langTextActive: { color: 'white', fontWeight: '600' },
  webSearchOption: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: Colors.secondary.info, borderColor: Colors.secondary.info },
  webSearchLabel: { fontSize: 14, color: '#666', marginLeft: 10 },

  // 步骤2 - 智能体
  agentList: { maxHeight: 350 },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.card,
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  agentCardActive: { borderColor: Colors.secondary.info, backgroundColor: Colors.secondary.infoLight },
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: { fontSize: 20 },
  agentInfo: { flex: 1, marginLeft: 12 },
  agentName: { fontSize: 16, fontWeight: '600', color: '#333' },
  agentRoleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  agentRoleType: { fontSize: 12, color: Colors.secondary.info },
  voiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary.success + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  voiceBadgeText: { fontSize: 10, color: Colors.secondary.success, marginLeft: 2 },
  agentPersona: { fontSize: 13, color: '#666', marginTop: 4 },
  agentPriority: { fontSize: 11, color: '#888', marginTop: 2 },
  agentCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentCheckboxActive: { backgroundColor: Colors.secondary.info, borderColor: Colors.secondary.info },
  selectedCount: { fontSize: 14, color: Colors.secondary.info, textAlign: 'center', marginTop: 10 },
  retryBtn: { marginTop: 15, padding: 15, backgroundColor: Colors.secondary.info, borderRadius: 8 },
  retryText: { color: 'white', fontSize: 14 },

  // 步骤3 - 大纲流式生成
  outlineList: { maxHeight: 400 },
  outlineCard: {
    backgroundColor: Colors.neutral.card,
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  outlineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  outlineTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  badgeSlide: { backgroundColor: Colors.secondary.info },
  badgeQuiz: { backgroundColor: Colors.primary.main },
  badgeInteractive: { backgroundColor: Colors.secondary.success },
  badgePbl: { backgroundColor: Colors.secondary.wisdom },
  outlineTypeText: { fontSize: 12, color: 'white', fontWeight: '500' },
  outlineOrder: { fontSize: 14, color: '#666' },
  outlineTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  outlineDesc: { fontSize: 14, color: '#666', marginTop: 5 },
  keyPoints: { marginTop: 10 },
  keyPointText: { fontSize: 13, color: '#555', lineHeight: 20 },
  generatingText: { marginTop: 15, color: '#666', fontSize: 14 },
  loadingMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15 },
  loadingMoreText: { marginLeft: 10, color: '#666', fontSize: 14 },

  // 步骤4 - 确认创建
  summaryCard: {
    backgroundColor: Colors.neutral.card,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  summaryTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  summaryItem: { flexDirection: 'row', marginBottom: 10 },
  summaryLabel: { width: 80, fontSize: 14, color: '#666' },
  summaryValue: { flex: 1, fontSize: 14, color: '#333' },
  successBox: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#f0fff4',
    borderRadius: 12,
    marginBottom: 20,
  },
  successText: { fontSize: 18, fontWeight: 'bold', color: Colors.secondary.success, marginTop: 10 },
  successId: { fontSize: 12, color: '#666', marginTop: 5 },

  // 按钮
  errorText: { color: Colors.feedback.errorText, fontSize: 14, textAlign: 'center', marginBottom: 15 },
  stepButtons: { flexDirection: 'row', gap: 15, marginTop: 20 },
  backBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  backBtnText: { color: '#666', fontSize: 16 },
  nextBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    backgroundColor: Colors.secondary.info,
    alignItems: 'center',
  },
  nextBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  createBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    backgroundColor: Colors.secondary.success,
    alignItems: 'center',
  },
  createBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  btnDisabled: { backgroundColor: '#ccc' },
});