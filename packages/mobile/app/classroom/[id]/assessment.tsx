import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/lib/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

interface Result {
  score: number;
  mastery_level: string;
  passed: boolean;
  correct_count: number;
  total_questions: number;
  earned_points: number;
}

export default function AssessmentScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
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
      Alert.alert('错误', e.message || '创建测评失败');
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
      Alert.alert('错误', e.message || '提交失败');
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
              <Text style={styles.statItem}>错误: {result.total_questions - result.correct_count}</Text>
            </View>
            <Text style={styles.pointsText}>获得 {result.earned_points} 积分</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={() => {
            setResult(null);
            setAssessment(null);
            loadTypes();
          }}>
            <Text style={styles.buttonText}>再测一次</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonOutline} onPress={() => router.back()}>
            <Text style={styles.buttonText}>返回课程</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (assessment) {
    const question = assessment.questions[currentQuestion];
    const isLast = currentQuestion === assessment.questions.length - 1;
    const progress = ((currentQuestion + 1) / assessment.questions.length) * 100;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{assessment.config.name}</Text>
          <Text style={styles.progress}>第 {currentQuestion + 1}/{assessment.questions.length} 题</Text>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
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

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>返回课程</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 16 },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 20, fontWeight: 'bold' },
  progress: { fontSize: 14, color: '#666', marginTop: 4 },
  progressBar: { height: 4, backgroundColor: '#eee', marginHorizontal: 16 },
  progressFill: { height: 4, backgroundColor: '#3b82f6' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  headerDesc: { fontSize: 14, color: '#666', marginBottom: 24 },
  typeCard: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 12 },
  typeName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  typeDesc: { fontSize: 14, color: '#666', marginBottom: 8 },
  typeInfo: { fontSize: 12, color: '#888' },
  questionCard: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 16 },
  difficulty: { fontSize: 12, color: '#3b82f6', marginBottom: 8 },
  questionContent: { fontSize: 16, lineHeight: 24 },
  optionButton: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 8 },
  optionSelected: { backgroundColor: '#dbeafe', borderWidth: 2, borderColor: '#3b82f6' },
  optionText: { fontSize: 14 },
  footer: { padding: 16, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between' },
  navButton: { padding: 12, borderRadius: 8, backgroundColor: '#f0f0f0' },
  navButtonText: { fontSize: 14 },
  submitButton: { padding: 12, borderRadius: 8, backgroundColor: '#3b82f6' },
  submitButtonText: { fontSize: 14, color: '#fff' },
  resultCard: { backgroundColor: '#fff', padding: 24, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  scoreText: { fontSize: 48, fontWeight: 'bold', color: '#3b82f6' },
  masteryText: { fontSize: 20, color: '#666', marginTop: 8 },
  passText: { fontSize: 16, marginTop: 12 },
  statsRow: { flexDirection: 'row', marginTop: 16 },
  statItem: { fontSize: 14, marginHorizontal: 12 },
  pointsText: { fontSize: 14, color: '#f59e0b', marginTop: 16 },
  button: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  buttonOutline: { backgroundColor: '#fff', padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6' },
  buttonText: { fontSize: 16, color: '#fff' },
  backButton: { padding: 16, backgroundColor: '#fff', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee' },
  backButtonText: { fontSize: 16 },
});