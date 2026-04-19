import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth/auth-context';

// 步骤定义
const STEPS = ['需求输入', '智能体配置', '大纲生成', '确认创建'];

// 默认智能体配置
const DEFAULT_AGENTS = [
  { id: 'teacher', name: '老师', role: '主讲', color: '#5b9bd5', avatar: 'teacher.png', enabled: true },
  { id: 'assistant', name: '助教', role: '辅助讲解', color: '#10b981', avatar: 'assist.png', enabled: true },
  { id: 'curious', name: '好奇同学', role: '提问互动', color: '#f59e0b', avatar: 'curious.png', enabled: true },
  { id: 'thinker', name: '思考者', role: '深度分析', color: '#8b5cf6', avatar: 'thinker.png', enabled: false },
  { id: 'notetaker', name: '笔记员', role: '总结归纳', color: '#06b6d4', avatar: 'note-taker.png', enabled: false },
];

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

  // 步骤状态
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 步骤1: 需求输入
  const [requirement, setRequirement] = useState('');
  const [language, setLanguage] = useState<'zh-CN' | 'en-US'>('zh-CN');

  // 步骤2: 智能体配置
  const [agents, setAgents] = useState(DEFAULT_AGENTS);

  // 步骤3: 大纲
  const [outlines, setOutlines] = useState<SceneOutline[]>([]);
  const [generatingOutlines, setGeneratingOutlines] = useState(false);

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
        <ActivityIndicator size="large" color="#5b9bd5" />
      </View>
    );
  }

  // 步骤1: 提交需求，进入智能体配置
  const handleStep1Next = () => {
    if (!requirement.trim()) {
      setError('请输入课程需求');
      return;
    }
    setError(null);
    setCurrentStep(1);
  };

  // 步骤2: 配置智能体，进入大纲生成
  const handleStep2Next = async () => {
    setCurrentStep(2);
    setGeneratingOutlines(true);
    setError(null);

    try {
      // 调用生成大纲API
      const result = await apiClient.generateOutlines(requirement, {
        language,
        agent_ids: agents.filter(a => a.enabled).map(a => a.id),
      });
      setOutlines(result.outlines || result);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || '大纲生成失败');
      // 如果大纲生成失败，创建默认大纲
      setOutlines([
        { id: '1', type: 'slide', title: '课程介绍', description: '介绍课程主题和学习目标', key_points: ['主题概述', '学习目标', '课程安排'], order: 1 },
        { id: '2', type: 'slide', title: '核心内容', description: '讲解核心知识点', key_points: ['概念定义', '原理说明', '示例演示'], order: 2 },
        { id: '3', type: 'quiz', title: '知识检测', description: '检验学习效果', key_points: ['基础题目', '进阶题目'], order: 3 },
        { id: '4', type: 'slide', title: '总结回顾', description: '回顾课程要点', key_points: ['要点总结', '延伸思考', '课后作业'], order: 4 },
      ]);
    } finally {
      setGeneratingOutlines(false);
    }
  };

  // 步骤3: 编辑大纲后，确认创建
  const handleStep3Next = () => {
    setCurrentStep(3);
  };

  // 步骤4: 开始创建课程
  const handleCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      // 创建课程
      const result = await apiClient.createClassroom(
        `课程: ${requirement.slice(0, 50)}...`,
        requirement
      );

      setCreatedClassroomId(result.id);

      // 显示成功提示
      if (Platform.OS === 'web') {
        window.alert('课程创建成功！');
      } else {
        Alert.alert('成功', '课程创建成功！', [
          { text: '查看课程', onPress: () => router.replace(`/classroom/${result.id}`) }
        ]);
      }

      // 跳转到课程详情
      setTimeout(() => {
        router.replace(`/classroom/${result.id}`);
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || '创建失败');
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

      <View style={styles.languageSelector}>
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
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity style={styles.nextBtn} onPress={handleStep1Next}>
        <Text style={styles.nextBtnText}>下一步：配置智能体</Text>
      </TouchableOpacity>
    </View>
  );

  // 渲染步骤2: 智能体配置
  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>配置课堂智能体</Text>
      <Text style={styles.stepHint}>选择参与课堂互动的AI角色（同学/助教）</Text>

      <ScrollView style={styles.agentList}>
        {agents.map(agent => (
          <TouchableOpacity
            key={agent.id}
            style={[styles.agentCard, agent.enabled && styles.agentCardActive]}
            onPress={() => toggleAgent(agent.id)}
          >
            <View style={[styles.agentAvatar, { backgroundColor: agent.color + '20' }]}>
              <Ionicons name="person" size={24} color={agent.color} />
            </View>
            <View style={styles.agentInfo}>
              <Text style={styles.agentName}>{agent.name}</Text>
              <Text style={styles.agentRole}>{agent.role}</Text>
            </View>
            <View style={[styles.agentCheckbox, agent.enabled && styles.agentCheckboxActive]}>
              {agent.enabled && <Ionicons name="checkmark" size={16} color="white" />}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.selectedCount}>
        已选择 {agents.filter(a => a.enabled).length} 个智能体
      </Text>

      <View style={styles.stepButtons}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentStep(0)}>
          <Text style={styles.backBtnText}>返回</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={handleStep2Next}>
          <Text style={styles.nextBtnText}>生成大纲</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // 渲染步骤3: 大纲预览
  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>课程大纲</Text>
      <Text style={styles.stepHint}>AI已根据您的需求生成以下课程结构</Text>

      {generatingOutlines ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#5b9bd5" />
          <Text style={styles.generatingText}>正在生成大纲...</Text>
        </View>
      ) : (
        <ScrollView style={styles.outlineList}>
          {outlines.map((outline, index) => (
            <View key={outline.id} style={styles.outlineCard}>
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
              {outline.key_points.length > 0 && (
                <View style={styles.keyPoints}>
                  {outline.key_points.map((point, i) => (
                    <Text key={i} style={styles.keyPointText}>• {point}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {error && !generatingOutlines && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.stepButtons}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentStep(1)}>
          <Text style={styles.backBtnText}>返回</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, generatingOutlines && styles.btnDisabled]}
          onPress={handleStep3Next}
          disabled={generatingOutlines}
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
      <Text style={styles.stepHint}>检查配置信息，点击创建开始生成课程</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>课程配置摘要</Text>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>需求</Text>
          <Text style={styles.summaryValue}>{requirement.slice(0, 100)}...</Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>语言</Text>
          <Text style={styles.summaryValue}>{language === 'zh-CN' ? '中文' : '英文'}</Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>智能体</Text>
          <Text style={styles.summaryValue}>
            {agents.filter(a => a.enabled).map(a => a.name).join(', ')}
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>场景数</Text>
          <Text style={styles.summaryValue}>{outlines.length} 个</Text>
        </View>
      </View>

      {createdClassroomId && (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={48} color="#10b981" />
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
  container: { flex: 1, backgroundColor: '#f5f7fa' },
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
  stepCircleActive: { backgroundColor: '#5b9bd5' },
  stepNumber: { color: '#666', fontSize: 14, fontWeight: '600' },
  stepNumberActive: { color: 'white' },
  stepLabel: { fontSize: 12, color: '#666', marginTop: 5 },
  stepLabelActive: { color: '#5b9bd5', fontWeight: '600' },
  stepLine: { width: 30, height: 2, backgroundColor: '#ddd', marginHorizontal: 5 },
  stepLineActive: { backgroundColor: '#5b9bd5' },

  // 步骤内容
  stepContent: { padding: 20 },
  stepTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  stepHint: { fontSize: 14, color: '#666', marginBottom: 20 },

  // 步骤1
  requirementInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 150,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 10 },
  languageSelector: { marginTop: 20 },
  languageButtons: { flexDirection: 'row', gap: 10 },
  langBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  langBtnActive: { backgroundColor: '#5b9bd5' },
  langText: { fontSize: 14, color: '#666' },
  langTextActive: { color: 'white', fontWeight: '600' },

  // 步骤2
  agentList: { maxHeight: 300 },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  agentCardActive: { borderColor: '#5b9bd5', backgroundColor: '#f0f7ff' },
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentInfo: { flex: 1, marginLeft: 12 },
  agentName: { fontSize: 16, fontWeight: '600', color: '#333' },
  agentRole: { fontSize: 14, color: '#666' },
  agentCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentCheckboxActive: { backgroundColor: '#5b9bd5', borderColor: '#5b9bd5' },
  selectedCount: { fontSize: 14, color: '#5b9bd5', textAlign: 'center', marginTop: 10 },

  // 步骤3
  outlineList: { maxHeight: 400 },
  outlineCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  outlineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  outlineTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeSlide: { backgroundColor: '#5b9bd5' },
  badgeQuiz: { backgroundColor: '#f59e0b' },
  badgeInteractive: { backgroundColor: '#10b981' },
  badgePbl: { backgroundColor: '#8b5cf6' },
  outlineTypeText: { fontSize: 12, color: 'white', fontWeight: '500' },
  outlineOrder: { fontSize: 14, color: '#666' },
  outlineTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  outlineDesc: { fontSize: 14, color: '#666', marginTop: 5 },
  keyPoints: { marginTop: 10 },
  keyPointText: { fontSize: 13, color: '#555', lineHeight: 20 },
  generatingText: { marginTop: 15, color: '#666', fontSize: 14 },

  // 步骤4
  summaryCard: {
    backgroundColor: 'white',
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
  successText: { fontSize: 18, fontWeight: 'bold', color: '#10b981', marginTop: 10 },
  successId: { fontSize: 12, color: '#666', marginTop: 5 },

  // 按钮
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 15 },
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
    backgroundColor: '#5b9bd5',
    alignItems: 'center',
  },
  nextBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  createBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  createBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  btnDisabled: { backgroundColor: '#ccc' },
});