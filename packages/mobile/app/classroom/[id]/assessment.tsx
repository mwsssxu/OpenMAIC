import React, { useState, useEffect } from 'react';
import { showError } from '@/lib/utils/error-toast';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/lib/constants/theme';

interface Question {
  id: string;
  type: string;
  content: string;
  options: string[];
  difficulty: string;
  points: number;
}

interface Assessment {
  assessment_id: string;
  config: { name: string; duration_minutes: number };
  questions: Question[];
  duration_minutes: number;
  status: string;
}

interface QuestionResult {
  question_id: string;
  content: string;
  type: string;
  options?: any;
  user_answer: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
  points: number;
  difficulty?: string;
}

interface Result {
  score: number;
  mastery_level: string;
  passed: boolean;
  correct_count: number;
  total_questions: number;
  earned_points: number;
  question_results?: QuestionResult[];
}

function QuestionResultCard({ qr, index }: { qr: QuestionResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const correct = qr.is_correct;
  const accent = correct ? '#10b981' : '#ef4444';
  const bg = correct ? '#ecfdf5' : '#fef2f2';
  const border = correct ? '#a7f3d0' : '#fecaca';

  // 选项渲染（支持单选选项映射）
  const renderOption = (key: string, value: string, isUserPick: boolean, isCorrectAns: boolean) => {
    let optStyle = qrCardStyles.optionDefault;
    let textStyle = qrCardStyles.optionTextDefault;
    if (isCorrectAns) {
      optStyle = qrCardStyles.optionCorrect;
      textStyle = qrCardStyles.optionTextCorrect;
    } else if (isUserPick && !isCorrectAns) {
      optStyle = qrCardStyles.optionWrong;
      textStyle = qrCardStyles.optionTextWrong;
    }
    return (
      <View key={key} style={[qrCardStyles.option, optStyle]}>
        <Text style={[qrCardStyles.optionKey, textStyle]}>{key}.</Text>
        <Text style={[qrCardStyles.optionText, textStyle]} numberOfLines={3}>{value}</Text>
        {isCorrectAns && <Ionicons name="checkmark-circle" size={16} color="#10b981" />}
        {isUserPick && !isCorrectAns && <Ionicons name="close-circle" size={16} color="#ef4444" />}
      </View>
    );
  };

  // options 可能是 dict {A:"x", B:"y"} 或 array
  const optionEntries: Array<[string, string]> = qr.options
    ? Array.isArray(qr.options)
      ? qr.options.map((v: any, i: number) => [String.fromCharCode(65 + i), String(v)])
      : Object.entries(qr.options).map(([k, v]) => [k, String(v)])
    : [];

  return (
    <TouchableOpacity
      style={[qrCardStyles.card, { backgroundColor: bg, borderColor: border }]}
      activeOpacity={0.85}
      onPress={() => setExpanded(e => !e)}
    >
      <View style={qrCardStyles.header}>
        <View style={qrCardStyles.indexBadge}>
          <Text style={qrCardStyles.indexText}>{index}</Text>
        </View>
        <Text style={qrCardStyles.content} numberOfLines={expanded ? 0 : 2}>{qr.content}</Text>
        <View style={[qrCardStyles.statusBadge, { backgroundColor: accent }]}>
          <Ionicons name={correct ? 'checkmark' : 'close'} size={14} color="#fff" />
        </View>
      </View>
      {expanded && (
        <View style={qrCardStyles.body}>
          {optionEntries.length > 0 ? (
            <View style={qrCardStyles.optionsList}>
              {optionEntries.map(([k, v]) =>
                renderOption(k, v, qr.user_answer === k, qr.correct_answer === k)
              )}
            </View>
          ) : (
            <View style={qrCardStyles.answerBlock}>
              <Text style={qrCardStyles.answerLabel}>你的答案：
                <Text style={{ color: correct ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                  {qr.user_answer || '（未作答）'}
                </Text>
              </Text>
              {!correct && (
                <Text style={qrCardStyles.answerLabel}>正确答案：
                  <Text style={{ color: '#10b981', fontWeight: '600' }}>{qr.correct_answer}</Text>
                </Text>
              )}
            </View>
          )}
          {qr.explanation ? (
            <View style={qrCardStyles.explanationBlock}>
              <Text style={qrCardStyles.explanationLabel}>解析</Text>
              <Text style={qrCardStyles.explanationText}>{qr.explanation}</Text>
            </View>
          ) : null}
        </View>
      )}
      <View style={qrCardStyles.footer}>
        <Text style={qrCardStyles.expandHint}>{expanded ? '收起' : '展开查看详情'}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#94a3b8" />
      </View>
    </TouchableOpacity>
  );
}

export default function AssessmentScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const goBack = () => router.back();
  const courseId = params.id as string;

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<any[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  useEffect(() => {
    loadToken();
  }, []);

  useEffect(() => {
    if (token && !assessment && !result) {
      loadTypes();
    }
  }, [token]);

  async function loadToken() {
    const t = await AsyncStorage.getItem('auth_token');
    apiClient.setToken(t);
    setToken(t);
  }

  async function loadTypes() {
    try {
      const data = await apiClient.getAssessmentTypes();
      setTypes(data.types || []);
      setLoading(false);
    } catch (e) {
      showError(e);
      setLoading(false);
    }
  }

  async function startAssessment(type: string) {
    try {
      setLoading(true);
      const data = await apiClient.createAssessment(courseId, type);
      setAssessment(data);
      setAnswers({});
      setCurrentQuestion(0);
      setLoading(false);
    } catch (e: any) {
      showError(e.message || '创建测评失败');
      setLoading(false);
    }
  }

  function selectAnswer(questionId: string, answer: string) {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  }

  async function submitAssessment() {
    if (!assessment) return;

    const answerList = Object.entries(answers).map(([qId, ans]) => ({
      question_id: qId,
      answer: ans,
    }));

    try {
      setLoading(true);
      const data = await apiClient.submitAssessment(assessment.assessment_id, answerList);
      setResult(data);
      setLoading(false);
    } catch (e: any) {
      showError(e.message || '提交失败');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (result) {
    const wrongCount = result.total_questions - result.correct_count;
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content}>
          <View style={styles.resultCard}>
            <Text style={styles.scoreText}>{result.score}%</Text>
            <Text style={styles.masteryText}>掌握程度: {result.mastery_level}</Text>
            <Text style={styles.passText}>
              {result.passed ? '✓ 通过测评' : '✗ 未通过，建议复习'}
            </Text>
            <View style={styles.statsRow}>
              <Text style={styles.statItem}>正确: {result.correct_count}</Text>
              <Text style={styles.statItem}>错误: {wrongCount}</Text>
            </View>
            <Text style={styles.pointsText}>获得 {result.earned_points} 积分</Text>
          </View>

          {wrongCount > 0 && (
            <TouchableOpacity
              style={reviewCtaStyles.cta}
              onPress={() => router.push('/review' as any)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`立即复习 ${wrongCount} 道错题`}
            >
              <View style={reviewCtaStyles.ctaIcon}>
                <Text style={reviewCtaStyles.ctaIconEmoji}>📌</Text>
              </View>
              <View style={reviewCtaStyles.ctaBody}>
                <Text style={reviewCtaStyles.ctaTitle}>立即复习 {wrongCount} 道错题</Text>
                <Text style={reviewCtaStyles.ctaDesc}>趁热打铁，5 分钟搞定</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ea580c" />
            </TouchableOpacity>
          )}

          {/* 逐题回顾 */}
          {result.question_results && result.question_results.length > 0 && (
            <View style={reviewCtaStyles.reviewSection}>
              <Text style={reviewCtaStyles.reviewSectionTitle}>答题回顾</Text>
              {result.question_results.map((qr, idx) => (
                <QuestionResultCard key={qr.question_id} qr={qr} index={idx + 1} />
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={() => {
            setResult(null);
            setAssessment(null);
            loadTypes();
          }}>
            <Text style={styles.buttonText}>再测一次</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonOutline} onPress={() => goBack()}>
            <Ionicons name="chevron-back" size={20} color="#3b82f6" />
            <Text style={[styles.buttonText, { marginLeft: 8 }]}>返回课程</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (assessment) {
    const question = assessment.questions[currentQuestion];
    const isLast = currentQuestion === assessment.questions.length - 1;
    const progress = (currentQuestion + 1) / assessment.questions.length;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{assessment.config.name}</Text>
          <Text style={styles.progress}>第 {currentQuestion + 1}/{assessment.questions.length} 题</Text>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { flex: progress }]} />
          <View style={{ flex: 1 - progress }} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.questionCard}>
            <Text style={styles.difficulty}>{question.difficulty}</Text>
            <Text style={styles.questionContent}>{question.content}</Text>
          </View>

          {question.options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.optionButton,
                answers[question.id] === String.fromCharCode(65 + i) && styles.optionSelected,
              ]}
              onPress={() => selectAnswer(question.id, String.fromCharCode(65 + i))}
            >
              <Text style={styles.optionText}>
                {String.fromCharCode(65 + i)}. {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
            disabled={currentQuestion === 0}
          >
            <Text style={styles.navButtonText}>上一题</Text>
          </TouchableOpacity>

          {isLast ? (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={submitAssessment}
              disabled={Object.keys(answers).length < assessment.questions.length}
            >
              <Text style={styles.submitButtonText}>提交答案</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setCurrentQuestion(currentQuestion + 1)}
            >
              <Text style={styles.navButtonText}>下一题</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.headerTitle}>学习效果测评</Text>
        <Text style={styles.headerDesc}>完成课程后测评，量化知识掌握程度</Text>

        {types.map(type => (
          <TouchableOpacity key={type.id} style={styles.typeCard} onPress={() => startAssessment(type.id)}>
            <Text style={styles.typeName}>{type.name}</Text>
            <Text style={styles.typeDesc}>{type.description}</Text>
            <Text style={styles.typeInfo}>
              ⏱ {type.duration_minutes}分钟 | 📝 {type.questions_count}题
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.backButton} onPress={() => goBack()}>
        <Ionicons name="chevron-back" size={20} color="#c45a1a" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 16 },
  header: { padding: 16, backgroundColor: Colors.neutral.card, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 20, fontWeight: 'bold' },
  progress: { fontSize: 14, color: '#666', marginTop: 4 },
  progressBar: { height: 4, backgroundColor: '#eee', marginHorizontal: 16, flexDirection: 'row' },
  progressFill: { height: 4, backgroundColor: '#3b82f6' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  headerDesc: { fontSize: 14, color: '#666', marginBottom: 24 },
  typeCard: { backgroundColor: Colors.neutral.card, padding: 16, borderRadius: 8, marginBottom: 12 },
  typeName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  typeDesc: { fontSize: 14, color: '#666', marginBottom: 8 },
  typeInfo: { fontSize: 12, color: '#888' },
  questionCard: { backgroundColor: Colors.neutral.card, padding: 16, borderRadius: 8, marginBottom: 16 },
  difficulty: { fontSize: 12, color: '#3b82f6', marginBottom: 8 },
  questionContent: { fontSize: 16, lineHeight: 24 },
  optionButton: { backgroundColor: Colors.neutral.card, padding: 16, borderRadius: 8, marginBottom: 8 },
  optionSelected: { backgroundColor: '#dbeafe', borderWidth: 2, borderColor: '#3b82f6' },
  optionText: { fontSize: 14 },
  footer: { padding: 16, backgroundColor: Colors.neutral.card, flexDirection: 'row', justifyContent: 'space-between' },
  navButton: { padding: 12, borderRadius: 8, backgroundColor: '#f0f0f0' },
  navButtonText: { fontSize: 14 },
  submitButton: { padding: 12, borderRadius: 8, backgroundColor: '#3b82f6' },
  submitButtonText: { fontSize: 14, color: '#fff' },
  resultCard: { backgroundColor: Colors.neutral.card, padding: 24, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  scoreText: { fontSize: 48, fontWeight: 'bold', color: '#3b82f6' },
  masteryText: { fontSize: 20, color: '#666', marginTop: 8 },
  passText: { fontSize: 16, marginTop: 12 },
  statsRow: { flexDirection: 'row', marginTop: 16 },
  statItem: { fontSize: 14, marginHorizontal: 12 },
  pointsText: { fontSize: 14, color: '#f59e0b', marginTop: 16 },
  button: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  buttonOutline: { backgroundColor: Colors.neutral.card, padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6', flexDirection: 'row', justifyContent: 'center' },
  buttonText: { fontSize: 16, color: '#3b82f6' },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.neutral.card, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 16 },
});

const reviewCtaStyles = StyleSheet.create({
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5ed',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 12,
    minHeight: 60,
  },
  ctaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaIconEmoji: { fontSize: 20 },
  ctaBody: { flex: 1 },
  ctaTitle: { fontSize: 15, fontWeight: '600', color: '#9a3412', marginBottom: 2 },
  ctaDesc: { fontSize: 12, color: '#c2410c' },
  reviewSection: { marginBottom: 16 },
  reviewSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 10,
    marginTop: 4,
  },
});

const qrCardStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  indexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  indexText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  content: { flex: 1, fontSize: 14, lineHeight: 20, color: '#0f172a' },
  statusBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { marginTop: 12, gap: 8 },
  optionsList: { gap: 6 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
  },
  optionKey: { fontSize: 13, fontWeight: '600', minWidth: 18 },
  optionText: { fontSize: 13, flex: 1 },
  optionDefault: { backgroundColor: '#fff', borderColor: '#e2e8f0' },
  optionTextDefault: { color: '#475569' },
  optionCorrect: { backgroundColor: '#ecfdf5', borderColor: '#10b981' },
  optionTextCorrect: { color: '#065f46', fontWeight: '500' },
  optionWrong: { backgroundColor: '#fef2f2', borderColor: '#ef4444' },
  optionTextWrong: { color: '#991b1b', textDecorationLine: 'line-through' },
  answerBlock: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  answerLabel: { fontSize: 13, color: '#475569' },
  explanationBlock: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  explanationLabel: { fontSize: 12, fontWeight: '600', color: '#3b82f6', marginBottom: 4 },
  explanationText: { fontSize: 13, lineHeight: 19, color: '#334155' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 4,
  },
  expandHint: { fontSize: 11, color: '#94a3b8' },
});
