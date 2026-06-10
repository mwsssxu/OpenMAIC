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
import * as DocumentPicker from 'expo-document-picker';
import { apiClient } from '@/lib/api-client';
import { showError } from '@/lib/utils/error-toast';
import { useAuth } from '@/lib/auth/auth-context';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// iOS 风格颜色系统
const iOSColors = {
  bgSolid: '#f5f3f2',
  surface: 'rgba(255, 255, 255, 0.55)',
  surfaceSolid: '#FFFFFF',
  fg: '#1a1a1a',
  muted: '#666666',
  border: 'rgba(230, 225, 220, 0.6)',
  accent: '#c45a1a',
  accentLight: '#fde8e0',
  accentDark: '#a04a15',
  secondary: '#1a8a8a',
  secondaryLight: '#e8f5f5',
  success: '#22c55e',
  successLight: '#dcfce7',
  gold: '#f59e0b',
  goldLight: '#fef3c7',
  blue: '#2563eb',
  blueLight: '#dbeafe',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
};

// 步骤定义
const STEPS = [
  { name: '需求', icon: '📝' },
  { name: '大纲', icon: '📚' },
  { name: '角色', icon: '👥' },
  { name: '确认', icon: '✅' },
];

// 默认大纲
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
  voiceConfig?: { providerId: string; voiceId: string };
}

interface SceneOutline {
  id: string;
  type: 'slide' | 'quiz' | 'interactive' | 'pbl';
  title: string;
  description: string;
  key_points: string[];
  order: number;
}

// 步骤指示器组件
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <View style={stepIndicatorStyles.container}>
      {STEPS.map((step, index) => (
        <View key={step.name} style={stepIndicatorStyles.stepItem}>
          <View style={[
            stepIndicatorStyles.stepCircle,
            index <= currentStep && stepIndicatorStyles.stepCircleActive
          ]}>
            <Text style={stepIndicatorStyles.stepIcon}>{step.icon}</Text>
          </View>
          <Text style={[
            stepIndicatorStyles.stepLabel,
            index === currentStep && stepIndicatorStyles.stepLabelActive
          ]}>{step.name}</Text>
          {index < STEPS.length - 1 && (
            <View style={[
              stepIndicatorStyles.stepLine,
              index < currentStep && stepIndicatorStyles.stepLineActive
            ]} />
          )}
        </View>
      ))}
    </View>
  );
}

const stepIndicatorStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  stepItem: { alignItems: 'center' },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: iOSColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: iOSColors.accent,
    shadowColor: iOSColors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  stepIcon: { fontSize: 16 },
  stepLabel: { fontSize: 12, color: iOSColors.muted, marginTop: 4 },
  stepLabelActive: { color: iOSColors.accent, fontWeight: '600' },
  stepLine: { width: 24, height: 2, backgroundColor: iOSColors.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: iOSColors.accentLight },
});

// 大纲卡片组件
function OutlineCard({ outline, index }: { outline: SceneOutline; index: number }) {
  const typeStyles = {
    slide: { bg: iOSColors.accentLight, color: iOSColors.accent, label: '幻灯' },
    quiz: { bg: iOSColors.blueLight, color: iOSColors.blue, label: '测验' },
    interactive: { bg: iOSColors.secondaryLight, color: iOSColors.secondary, label: '互动' },
    pbl: { bg: iOSColors.purpleLight, color: iOSColors.purple, label: 'PBL' },
  };
  const style = typeStyles[outline.type] || typeStyles.slide;

  return (
    <View style={outlineCardStyles.container}>
      <View style={outlineCardStyles.header}>
        <View style={[outlineCardStyles.badge, { backgroundColor: style.bg }]}>
          <Text style={[outlineCardStyles.badgeText, { color: style.color }]}>{style.label}</Text>
        </View>
        <Text style={outlineCardStyles.order}>#{index + 1}</Text>
      </View>
      <Text style={outlineCardStyles.title}>{outline.title}</Text>
      <Text style={outlineCardStyles.desc}>{outline.description}</Text>
      {outline.key_points?.length > 0 && (
        <View style={outlineCardStyles.keyPoints}>
          {outline.key_points.map((point, i) => (
            <View key={i} style={outlineCardStyles.keyPointRow}>
              <Text style={outlineCardStyles.keyPointDot}>•</Text>
              <Text style={outlineCardStyles.keyPointText}>{point}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const outlineCardStyles = StyleSheet.create({
  container: {
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  order: { fontSize: 13, color: iOSColors.muted, fontWeight: '500' },
  title: { fontSize: 15, fontWeight: '600', color: iOSColors.fg },
  desc: { fontSize: 13, color: iOSColors.muted, marginTop: 4, lineHeight: 18 },
  keyPoints: { marginTop: 10 },
  keyPointRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  keyPointDot: { fontSize: 12, color: iOSColors.accent, marginRight: 6 },
  keyPointText: { fontSize: 12, color: iOSColors.fg, flex: 1 },
});

// Agent卡片组件
function AgentCard({ agent, onToggle }: { agent: AgentProfile; onToggle: () => void }) {
  const roleStyles = {
    teacher: { icon: '👨‍🏫', label: '主讲' },
    assistant: { icon: '👨‍💼', label: '助教' },
    student: { icon: '👨‍🎓', label: '学生' },
  };
  const roleStyle = roleStyles[agent.role] || roleStyles.teacher;

  return (
    <TouchableOpacity
      style={[agentCardStyles.container, agent.enabled && agentCardStyles.containerActive]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[agentCardStyles.avatar, { backgroundColor: agent.color ? agent.color + '20' : iOSColors.accentLight }]}>
        <Text style={agentCardStyles.avatarEmoji}>{roleStyle.icon}</Text>
      </View>
      <View style={agentCardStyles.info}>
        <Text style={agentCardStyles.name}>{agent.name}</Text>
        <Text style={agentCardStyles.role}>{roleStyle.label}</Text>
        <Text style={agentCardStyles.persona} numberOfLines={2}>{agent.persona}</Text>
      </View>
      <View style={[agentCardStyles.checkbox, agent.enabled && agentCardStyles.checkboxActive]}>
        {agent.enabled && <Ionicons name="checkmark" size={14} color="white" />}
      </View>
    </TouchableOpacity>
  );
}

const agentCardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: iOSColors.border,
  },
  containerActive: {
    borderColor: iOSColors.accent,
    backgroundColor: iOSColors.accentLight + '40',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 22 },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '600', color: iOSColors.fg },
  role: { fontSize: 12, color: iOSColors.accent, marginTop: 2 },
  persona: { fontSize: 12, color: iOSColors.muted, marginTop: 4, lineHeight: 16 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: iOSColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: iOSColors.accent,
    borderColor: iOSColors.accent,
  },
});

export default function CreateClassroomScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { onSuccess, onError } = useFeedback();
  const insets = useSafeAreaInsets();

  // 步骤状态
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 步骤1: 需求输入
  const [requirement, setRequirement] = useState('');
  const [language, setLanguage] = useState<'zh-CN' | 'en-US'>('zh-CN');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // PDF 上传
  const [pdfFile, setPdfFile] = useState<{ uri: string; name: string; size?: number } | null>(null);
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [parsingPdf, setParsingPdf] = useState(false);

  // 步骤2: 智能体
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [generatingAgents, setGeneratingAgents] = useState(false);

  // 步骤3: 大纲
  const [outlines, setOutlines] = useState<SceneOutline[]>([]);
  const [generatingOutlines, setGeneratingOutlines] = useState(false);
  const outlinesRef = useRef<SceneOutline[]>([]);

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
        <ActivityIndicator size="large" color={iOSColors.accent} />
      </View>
    );
  }

  // 选择 PDF 文件
  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      // 大小限制 50MB
      if (asset.size && asset.size > 50 * 1024 * 1024) {
        Alert.alert('文件过大', 'PDF 文件不能超过 50MB');
        return;
      }

      setPdfFile({ uri: asset.uri, name: asset.name, size: asset.size });
      setPdfContent(null); // 需要重新解析
    } catch (err: any) {
      console.warn('[PDF] Picker error:', err);
    }
  };

  // 解析 PDF 为文本
  const handleParsePdf = async () => {
    if (!pdfFile) return;
    setParsingPdf(true);
    setError(null);
    try {
      const result = await apiClient.parsePdf(pdfFile.uri, pdfFile.name);
      if (result.success && result.text) {
        setPdfContent(result.text);
        onSuccess();
      } else {
        setError('PDF 解析失败，请重试或直接输入课程需求');
      }
    } catch (err: any) {
      console.warn('[PDF] Parse error:', err);
      setError('PDF 解析失败：' + (err.message || '网络错误'));
    } finally {
      setParsingPdf(false);
    }
  };

  // 移除 PDF
  const handleRemovePdf = () => {
    setPdfFile(null);
    setPdfContent(null);
  };

  // 步骤1: 提交需求
  const handleStep1Next = () => {
    if (!requirement.trim() && !pdfContent) {
      setError('请输入课程需求或上传 PDF 文件');
      return;
    }
    setError(null);
    setCurrentStep(1);
    generateOutlines();
  };

  // 生成大纲
  const generateOutlines = async () => {
    setGeneratingOutlines(true);
    setError(null);
    setOutlines([]);

    // 当 requirement 为空但有 PDF 时，用文件名构造默认需求
    const effectiveRequirement = requirement.trim() || (pdfFile ? `基于文档「${pdfFile.name}」创建课程` : '');

    try {
      await apiClient.generateOutlinesStream(
        effectiveRequirement,
        language,
        agents.length > 0 ? agents.map(a => ({ id: a.id, name: a.name, role: a.role, persona: a.persona || '' })) : undefined,
        webSearchEnabled,
        (outline) => {
          outlinesRef.current = [...outlinesRef.current, outline];
          setOutlines(outlinesRef.current);
        },
        async (count) => {
          setGeneratingOutlines(false);
          if (count > 0) {
            setError(null);
            setCurrentStep(2);
            await generateAgents(outlinesRef.current);
          }
        },
        (errorMsg) => {
          setError(errorMsg);
          setGeneratingOutlines(false);
        },
        pdfContent || undefined,
      );

      if (outlinesRef.current.length === 0) {
        outlinesRef.current = DEFAULT_OUTLINES;
        setOutlines(DEFAULT_OUTLINES);
        setCurrentStep(2);
        await generateAgents(DEFAULT_OUTLINES);
      }
    } catch (err: any) {
      const errorMsg = err.message || '大纲生成失败';
      setError(errorMsg);
      outlinesRef.current = DEFAULT_OUTLINES;
      setOutlines(DEFAULT_OUTLINES);
      setGeneratingOutlines(false);
      setCurrentStep(2);
      await generateAgents(DEFAULT_OUTLINES);
    }
  };

  // 生成智能体
  const generateAgents = async (outlinesData: SceneOutline[]) => {
    setGeneratingAgents(true);
    setError(null);

    try {
      const result = await apiClient.generateAgentProfiles(
        { name: requirement.slice(0, 50), description: requirement },
        language,
        outlinesData,
        undefined,
        undefined,
        undefined
      );
      const generatedAgents = result.agents || [];
      setAgents(generatedAgents.map((a: AgentProfile) => ({ ...a, enabled: true })));
      setCurrentStep(3);
    } catch (err: any) {
      console.warn('Agent生成失败，使用默认配置:', err);
      try {
        const defaultResult = await apiClient.getDefaultAgents(language);
        setAgents((defaultResult.agents || []).map((a: AgentProfile) => ({ ...a, enabled: true })));
        setCurrentStep(3);
      } catch {
        setAgents([]);
        setCurrentStep(3);
      }
    } finally {
      setGeneratingAgents(false);
    }
  };

  // 创建课程
  const handleCreate = async () => {
    setLoading(true);
    setLoadingMessage('正在创建课程...');
    setError(null);

    try {
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

      const result = await apiClient.createFullClassroom(
        requirement.slice(0, 50),
        requirement,
        outlines,
        enabledAgents.map(a => a.id),
        language,
        cleanAgentConfigs
      );

      setLoadingMessage(null);
      setCreatedClassroomId(result.id);
      onSuccess();
      router.replace(`/classroom/${result.id}?totalScenes=${outlines.length}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || '创建失败');
      onError();
    } finally {
      setLoading(false);
      setLoadingMessage(null);
    }
  };

  const toggleAgent = (agentId: string) => {
    setAgents(agents.map(a => a.id === agentId ? { ...a, enabled: !a.enabled } : a));
  };

  // 渲染步骤1: 需求输入
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>创建新课程</Text>
      <Text style={styles.stepHint}>描述您想创建的课程主题、目标受众、学习目标等</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>课程需求</Text>
        <TextInput
          style={styles.requirementInput}
          placeholder="例如：为初中生创建一个关于光合作用的生物课程，包含基本概念讲解、实验演示和知识检测..."
          value={requirement}
          onChangeText={setRequirement}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          placeholderTextColor="#aaa"
        />
      </View>

      {/* PDF 上传区域 */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>上传 PDF（可选）</Text>
        {pdfFile ? (
          <View style={styles.pdfFileInfo}>
            <View style={styles.pdfFileInfoLeft}>
              <View style={styles.pdfIcon}>
                <Ionicons name="document-text" size={20} color={iOSColors.accent} />
              </View>
              <View style={styles.pdfFileInfoText}>
                <Text style={styles.pdfFileName} numberOfLines={1}>{pdfFile.name}</Text>
                {pdfFile.size && (
                  <Text style={styles.pdfFileSize}>{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</Text>
                )}
              </View>
            </View>
            <View style={styles.pdfFileActions}>
              {!pdfContent && !parsingPdf && (
                <TouchableOpacity style={styles.pdfParseBtn} onPress={handleParsePdf}>
                  <Text style={styles.pdfParseBtnText}>解析</Text>
                </TouchableOpacity>
              )}
              {parsingPdf && <ActivityIndicator size="small" color={iOSColors.accent} />}
              {pdfContent && (
                <Ionicons name="checkmark-circle" size={20} color={iOSColors.success} />
              )}
              <TouchableOpacity onPress={handleRemovePdf} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={18} color="#999" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.pdfUploadArea} onPress={handlePickPdf} activeOpacity={0.7}>
            <Ionicons name="cloud-upload-outline" size={28} color={iOSColors.muted} />
            <Text style={styles.pdfUploadText}>点击选择 PDF 文件</Text>
            <Text style={styles.pdfUploadHint}>支持 .pdf，最大 50MB</Text>
          </TouchableOpacity>
        )}
        {pdfContent && (
          <Text style={styles.pdfParsedHint}>✅ PDF 已解析，内容将用于辅助大纲生成</Text>
        )}
      </View>

      <View style={styles.optionsSection}>
        <Text style={styles.inputLabel}>课程语言</Text>
        <View style={styles.languageButtons}>
          <TouchableOpacity
            style={[styles.langBtn, language === 'zh-CN' && styles.langBtnActive]}
            onPress={() => setLanguage('zh-CN')}
            activeOpacity={0.7}
          >
            <Text style={[styles.langText, language === 'zh-CN' && styles.langTextActive]}>🇨🇳 中文</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, language === 'en-US' && styles.langBtnActive]}
            onPress={() => setLanguage('en-US')}
            activeOpacity={0.7}
          >
            <Text style={[styles.langText, language === 'en-US' && styles.langTextActive]}>🇺🇸 英文</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.webSearchOption}>
          <TouchableOpacity
            style={[styles.checkbox, webSearchEnabled && styles.checkboxActive]}
            onPress={() => setWebSearchEnabled(!webSearchEnabled)}
            activeOpacity={0.7}
          >
            {webSearchEnabled && <Ionicons name="checkmark" size={14} color="white" />}
          </TouchableOpacity>
          <Text style={styles.webSearchLabel}>🌐 启用网络搜索增强内容</Text>
        </View>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity style={styles.primaryBtn} onPress={handleStep1Next} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>✨ 开始生成课程大纲</Text>
      </TouchableOpacity>
    </View>
  );

  // 渲染步骤2: 大纲生成
  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>课程大纲</Text>
      <Text style={styles.stepHint}>
        {generatingOutlines ? 'AI 正在智能规划课程结构...' : 'AI 已为您生成以下课程大纲'}
      </Text>

      {generatingOutlines && outlines.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={iOSColors.accent} />
          <Text style={styles.generatingText}>正在规划课程结构...</Text>
        </View>
      ) : (
        <ScrollView style={styles.outlineList} showsVerticalScrollIndicator={false}>
          {outlines.map((outline, index) => (
            <OutlineCard key={outline.id} outline={outline} index={index} />
          ))}
          {generatingOutlines && (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={iOSColors.accent} />
              <Text style={styles.loadingMoreText}>继续生成...</Text>
            </View>
          )}
        </ScrollView>
      )}

      {error && !generatingOutlines && <Text style={styles.errorText}>{error}</Text>}

      {generatingOutlines ? (
        <View style={styles.centerContent}>
          <Text style={styles.generatingHint}>大纲生成完成后将自动生成课堂角色...</Text>
        </View>
      ) : (
        <View style={styles.centerButton}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCurrentStep(0)} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={iOSColors.muted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // 渲染步骤3: 智能体生成
  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>课堂角色</Text>
      <Text style={styles.stepHint}>AI 正在根据课程内容生成互动角色...</Text>

      {generatingAgents ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={iOSColors.accent} />
          <Text style={styles.generatingText}>正在生成角色配置...</Text>
        </View>
      ) : agents.length > 0 ? (
        <ScrollView style={styles.agentList} showsVerticalScrollIndicator={false}>
          {agents.map(agent => (
            <AgentCard key={agent.id} agent={agent} onToggle={() => toggleAgent(agent.id)} />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>角色生成失败</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => generateAgents(outlines)} activeOpacity={0.7}>
            <Text style={styles.retryBtnText}>重新生成</Text>
          </TouchableOpacity>
        </View>
      )}

      {!generatingAgents && agents.length > 0 && (
        <Text style={styles.selectedCount}>
          已选择 {agents.filter(a => a.enabled).length} 个角色参与课堂
        </Text>
      )}

      {error && !generatingAgents && agents.length > 0 && <Text style={styles.errorText}>{error}</Text>}

      {generatingAgents ? (
        <View style={styles.centerContent}>
          <Text style={styles.generatingHint}>角色生成完成后将进入确认页面...</Text>
        </View>
      ) : (
        <View style={styles.centerButton}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCurrentStep(1)} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={iOSColors.muted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // 渲染步骤4: 确认创建
  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>确认创建</Text>
      <Text style={styles.stepHint}>检查配置信息，点击创建开始生成课程内容</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>📋 课程配置摘要</Text>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>课程名称</Text>
          <Text style={styles.summaryValue}>{requirement.slice(0, 40)}...</Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>语言</Text>
          <Text style={styles.summaryValue}>{language === 'zh-CN' ? '中文' : '英文'}</Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>场景数量</Text>
          <Text style={styles.summaryValue}>{outlines.length} 个</Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>课堂角色</Text>
          <Text style={styles.summaryValue}>{agents.filter(a => a.enabled).map(a => a.name).join('、')}</Text>
        </View>

        {webSearchEnabled && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>网络搜索</Text>
            <Text style={[styles.summaryValue, { color: iOSColors.accent }]}>已启用</Text>
          </View>
        )}
      </View>

      {createdClassroomId && (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={48} color={iOSColors.success} />
          <Text style={styles.successText}>课程创建成功！</Text>
          <Text style={styles.successId}>ID: {createdClassroomId}</Text>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.secondaryBtnHalf} onPress={() => setCurrentStep(2)} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={iOSColors.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.createBtn, (loading || createdClassroomId) && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={loading || !!createdClassroomId}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="white" size="small" />
              {loadingMessage && <Text style={styles.loadingBtnText}>{loadingMessage}</Text>}
            </View>
          ) : (
            <Text style={styles.createBtnText}>🚀 开始创建课程</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 步骤指示器 */}
        <StepIndicator currentStep={currentStep} />

        {/* 步骤内容 */}
        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}
        {currentStep === 3 && renderStep4()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxWidth: 720, // 平板最大宽度
    alignSelf: 'center',
    width: '100%',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: iOSColors.bgSolid,
  },
  centerContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  centerButton: {
    alignItems: 'center',
    marginTop: 16,
  },

  // 步骤内容
  stepContent: {
    marginTop: 8,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: iOSColors.fg,
    marginBottom: 6,
  },
  stepHint: {
    fontSize: 14,
    color: iOSColors.muted,
    marginBottom: 20,
    lineHeight: 20,
  },

  // 输入组
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: iOSColors.muted,
    marginBottom: 8,
  },
  requirementInput: {
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 140,
    borderWidth: 1.5,
    borderColor: iOSColors.border,
    color: iOSColors.fg,
  },

  // 选项区
  optionsSection: {
    marginTop: 20,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  langBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: iOSColors.surfaceSolid,
    borderWidth: 1.5,
    borderColor: iOSColors.border,
  },
  langBtnActive: {
    backgroundColor: iOSColors.accent,
    borderColor: iOSColors.accent,
    shadowColor: iOSColors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  langText: { fontSize: 14, color: iOSColors.muted },
  langTextActive: { color: 'white', fontWeight: '600' },
  webSearchOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: iOSColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: iOSColors.surfaceSolid,
  },
  checkboxActive: {
    backgroundColor: iOSColors.accent,
    borderColor: iOSColors.accent,
  },
  webSearchLabel: { fontSize: 14, color: iOSColors.muted, marginLeft: 10 },

  // 按钮
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: iOSColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: iOSColors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  primaryBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: iOSColors.surfaceSolid,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: iOSColors.border,
  },
  secondaryBtnHalf: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: iOSColors.surfaceSolid,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: iOSColors.border,
  },
  createBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: iOSColors.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: iOSColors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  createBtnText: { color: 'white', fontSize: 15, fontWeight: '600' },
  btnDisabled: { backgroundColor: '#ccc' },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  loadingBtnText: { color: 'white', fontSize: 14, marginLeft: 8 },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 12,
  },

  // 列表
  outlineList: { maxHeight: 320 },
  agentList: { maxHeight: 280 },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingMoreText: { marginLeft: 8, color: iOSColors.muted, fontSize: 14 },

  // 文本
  generatingText: { marginTop: 16, color: iOSColors.muted, fontSize: 14 },
  generatingHint: { marginTop: 12, color: iOSColors.muted, fontSize: 12 },
  selectedCount: { fontSize: 14, color: iOSColors.accent, textAlign: 'center', marginTop: 12, fontWeight: '500' },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center', marginBottom: 16 },

  // 重试
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: iOSColors.accent,
    marginTop: 16,
  },
  retryBtnText: { color: 'white', fontSize: 14, fontWeight: '600' },

  // 摘要卡片
  summaryCard: {
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  summaryTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16, color: iOSColors.fg },
  summaryItem: { flexDirection: 'row', marginBottom: 10 },
  summaryLabel: { width: 80, fontSize: 14, color: iOSColors.muted },
  summaryValue: { flex: 1, fontSize: 14, color: iOSColors.fg },

  // 成功
  successBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: iOSColors.successLight,
    borderRadius: 12,
    marginBottom: 20,
  },
  successText: { fontSize: 18, fontWeight: '600', color: iOSColors.success, marginTop: 12 },
  successId: { fontSize: 12, color: iOSColors.muted, marginTop: 4 },

  // PDF 上传样式
  pdfUploadArea: {
    borderWidth: 2,
    borderColor: iOSColors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: iOSColors.surface,
  },
  pdfUploadText: {
    fontSize: 14,
    color: iOSColors.fg,
    fontWeight: '500',
    marginTop: 8,
  },
  pdfUploadHint: {
    fontSize: 12,
    color: iOSColors.muted,
    marginTop: 4,
  },
  pdfFileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: iOSColors.border,
  },
  pdfFileInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pdfIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: iOSColors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfFileInfoText: {
    marginLeft: 10,
    flex: 1,
  },
  pdfFileName: {
    fontSize: 14,
    fontWeight: '500',
    color: iOSColors.fg,
  },
  pdfFileSize: {
    fontSize: 12,
    color: iOSColors.muted,
    marginTop: 2,
  },
  pdfFileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pdfParseBtn: {
    backgroundColor: iOSColors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pdfParseBtnText: {
    fontSize: 12,
    color: iOSColors.accent,
    fontWeight: '600',
  },
  pdfParsedHint: {
    fontSize: 12,
    color: iOSColors.success,
    marginTop: 8,
  },
});
