/**
 * 移动端测验组件 - 支持单选、多选、简答题
 * 支持持久化，断点续答
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useI18n } from '@/lib/i18n';
import { useFirstTimeHint } from '@/lib/hooks/use-first-time-hint';
import { HintToast } from '@/components/common/HintToast';
import {
  readDraft,
  writeDraft,
  writeSubmittedAnswers,
  writeSubmittedResults,
  clearSubmitted,
  readSubmittedState,
} from '@/lib/quiz/persistence';

interface QuizQuestion {
  id: string;
  type: 'single' | 'multiple' | 'short';
  question: string;
  options?: string[];
  correctAnswer?: string | string[];
  userAnswer?: string | string[];
  aiAnalysis?: string;
}

interface QuizProps {
  questions: QuizQuestion[];
  sceneId: string; // 用于持久化
  onSubmit?: (answers: Record<string, string | string[]>) => void;
  onComplete?: (score: number) => void;
}

export function Quiz({ questions, sceneId, onSubmit, onComplete }: QuizProps) {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [grading, setGrading] = useState(false);
  const [score, setScore] = useState(0);
  const [initialized, setInitialized] = useState(false);

  // 首次答题提示：左右滑动切换题目（多题时才提示）
  const swipeHintStore = useFirstTimeHint('quiz.swipe', {
    enabled: questions.length > 1,
    delayMs: 600,
    autoHideMs: 3200,
  });

  // 加载持久化状态
  useEffect(() => {
    const loadState = async () => {
      const state = await readSubmittedState(sceneId);
      if (state) {
        setAnswers(state.answers);
        if (state.kind === 'reviewing') {
          setSubmitted(true);
          // 计算分数
          const correctCount = state.results.filter(r => r.correct === true).length;
          setScore(Math.round((correctCount / questions.length) * 100));
        }
      } else {
        // 加载草稿
        const draft = await readDraft(sceneId);
        if (Object.keys(draft).length > 0) {
          setAnswers(draft);
        }
      }
      setInitialized(true);
    };
    loadState();
  }, [sceneId, questions.length]);

  // 保存草稿 (debounced 500ms)
  useEffect(() => {
    if (!initialized || submitted) return;

    const timeoutId = setTimeout(() => {
      writeDraft(sceneId, answers);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [answers, sceneId, initialized, submitted]);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  // 滑动翻题动画
  const translateX = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleSingleSelect = (questionId: string, option: string) => {
    if (submitted) return;
    Haptics.selectionAsync();
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleMultipleSelect = (questionId: string, option: string) => {
    if (submitted) return;
    Haptics.selectionAsync();
    setAnswers((prev) => {
      const current = (prev[questionId] as string[]) || [];
      const isSelected = current.includes(option);
      const newSelection = isSelected
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [questionId]: newSelection };
    });
  };

  const handleShortAnswer = (questionId: string, text: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  };

  const handleOptionLongPress = (option: string) => {
    // 长按预览选项：中度震动提示，以后可扩展为气泡提示
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentIndex(currentIndex + 1);
    } else {
      // 到底：轻微回弹提示
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentIndex(currentIndex - 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  // 左右滑动手势：activeOffsetX 让垂直 ScrollView 不被截持
  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      'worklet';
      if (submitted) return;
      if (event.translationX < -50) {
        runOnJS(handleNext)();
      } else if (event.translationX > 50) {
        runOnJS(handlePrev)();
      }
    });

  const handleSubmit = async () => {
    setGrading(true);

    // 调用提交回调（实际会调用 API）
    onSubmit?.(answers);

    // 模拟 AI 批改
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 计算得分（简化版）
    let correctCount = 0;
    const results: Array<{ questionId: string; correct: boolean; feedback?: string }> = [];

    for (const q of questions) {
      const userAns = answers[q.id];
      let isCorrect = false;

      if (q.type === 'single' && userAns === q.correctAnswer) {
        correctCount++;
        isCorrect = true;
      } else if (q.type === 'multiple') {
        const correct = (q.correctAnswer as string[]) || [];
        const user = (userAns as string[]) || [];
        if (correct.length === user.length && correct.every((c) => user.includes(c))) {
          correctCount++;
          isCorrect = true;
        }
      }

      results.push({
        questionId: q.id,
        correct: isCorrect,
        feedback: isCorrect ? t('quiz.correct') : t('quiz.incorrect'),
      });
    }

    const finalScore = Math.round((correctCount / questions.length) * 100);
    setScore(finalScore);
    setGrading(false);
    setSubmitted(true);

    // 持久化提交结果
    await writeSubmittedAnswers(sceneId, answers);
    await writeSubmittedResults(sceneId, results);

    onComplete?.(finalScore);
  };

  const handleRetry = async () => {
    setAnswers({});
    setSubmitted(false);
    setScore(0);
    setCurrentIndex(0);
    // 清除持久化状态
    await clearSubmitted(sceneId);
  };

  const isOptionSelected = (questionId: string, option: string): boolean => {
    const ans = answers[questionId];
    if (Array.isArray(ans)) {
      return ans.includes(option);
    }
    return ans === option;
  };

  const isAnswerCorrect = (question: QuizQuestion): boolean => {
    const userAns = answers[question.id];
    if (question.type === 'single') {
      return userAns === question.correctAnswer;
    } else if (question.type === 'multiple') {
      const correct = (question.correctAnswer as string[]) || [];
      const user = (userAns as string[]) || [];
      return correct.length === user.length && correct.every((c) => user.includes(c));
    }
    return false;
  };

  if (grading) {
    return (
      <View style={styles.gradingContainer}>
        <Text style={styles.gradingText}>{t('quiz.aiGrading')}</Text>
        <View style={styles.progressDots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, styles.dotActive]} />
          ))}
        </View>
      </View>
    );
  }

  if (submitted) {
    return (
      <ScrollView style={styles.resultContainer}>
        <Text style={styles.resultTitle}>{t('quiz.score')}: {score}%</Text>

        {/* 结果列表 */}
        {questions.map((q, index) => (
          <View key={q.id} style={styles.resultItem}>
            <Text style={styles.resultQuestion}>{index + 1}. {q.question}</Text>
            <View style={styles.resultStatus}>
              <Text style={[styles.resultBadge, isAnswerCorrect(q) ? styles.correctBadge : styles.incorrectBadge]}>
                {isAnswerCorrect(q) ? t('quiz.correct') : t('quiz.incorrect')}
              </Text>
            </View>
            {q.aiAnalysis && (
              <Text style={styles.analysis}>{t('quiz.analysis')}{q.aiAnalysis}</Text>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>{t('quiz.retry')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {/* 进度指示 */}
      <View style={styles.progress}>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {questions.length}
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((currentIndex + 1) / questions.length) * 100}%` }]} />
        </View>
        <Text style={styles.swipeHint}>{t('quiz.swipeHint') || '左右滑动切换题目'}</Text>
      </View>

      {/* 问题内容 - 包裹在 GestureDetector 中支持左右滑动翻题 */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.questionOuter, animatedStyle]}>
          <ScrollView style={styles.questionContainer}>
            <Text style={styles.questionType}>
              {currentQuestion.type === 'single' ? t('quiz.singleChoice') :
               currentQuestion.type === 'multiple' ? t('quiz.multipleChoice') : t('quiz.shortAnswer')}
            </Text>
            <Text style={styles.questionText}>{currentQuestion.question}</Text>

            {/* 单选题 */}
            {currentQuestion.type === 'single' && currentQuestion.options?.map((option, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.option, isOptionSelected(currentQuestion.id, option) && styles.optionSelected]}
                onPress={() => handleSingleSelect(currentQuestion.id, option)}
                onLongPress={() => handleOptionLongPress(option)}
                delayLongPress={300}
              >
                <View style={[styles.optionRadio, isOptionSelected(currentQuestion.id, option) && styles.optionRadioSelected]}>
                  {isOptionSelected(currentQuestion.id, option) && <View style={styles.optionRadioInner} />}
                </View>
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            ))}

            {/* 多选题 */}
            {currentQuestion.type === 'multiple' && currentQuestion.options?.map((option, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.option, isOptionSelected(currentQuestion.id, option) && styles.optionSelected]}
                onPress={() => handleMultipleSelect(currentQuestion.id, option)}
                onLongPress={() => handleOptionLongPress(option)}
                delayLongPress={300}
              >
                <View style={[styles.optionCheckbox, isOptionSelected(currentQuestion.id, option) && styles.optionCheckboxSelected]}>
                  {isOptionSelected(currentQuestion.id, option) && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            ))}

            {/* 简答题 */}
            {currentQuestion.type === 'short' && (
              <TextInput
                style={styles.shortAnswerInput}
                multiline
                numberOfLines={4}
                placeholder={t('quiz.placeholder')}
                value={(answers[currentQuestion.id] as string) || ''}
                onChangeText={(text) => handleShortAnswer(currentQuestion.id, text)}
              />
            )}
          </ScrollView>
        </Animated.View>
      </GestureDetector>

      {/* 导航按钮 */}
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={handlePrev}
          disabled={currentIndex === 0}
        >
          <Text style={styles.navButtonText}>{t('quiz.prevQuestion')}</Text>
        </TouchableOpacity>

        {!isLastQuestion ? (
          <TouchableOpacity style={styles.navButton} onPress={handleNext}>
            <Text style={styles.navButtonText}>{t('quiz.nextQuestion')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>{t('quiz.submit')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 首次答题的滑动提示 */}
      <HintToast
        visible={swipeHintStore.visible}
        onClose={swipeHintStore.dismiss}
        icon="swap-horizontal"
        text={t('quiz.swipeHint') || '左右滑动切换题目'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  progress: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  progressText: { fontSize: 14, color: '#666', marginBottom: 8 },
  progressBar: { height: 4, backgroundColor: '#eee', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#007AFF', borderRadius: 2 },
  swipeHint: { fontSize: 11, color: '#999', textAlign: 'center', marginTop: 6 },
  questionOuter: { flex: 1 },
  questionContainer: { flex: 1, padding: 15 },
  questionType: { fontSize: 12, color: '#007AFF', marginBottom: 8 },
  questionText: { fontSize: 18, fontWeight: '500', marginBottom: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  optionSelected: { backgroundColor: '#e3f2fd', borderWidth: 1, borderColor: '#007AFF' },
  optionRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ccc' },
  optionRadioSelected: { borderColor: '#007AFF' },
  optionRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#007AFF' },
  optionCheckbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#ccc' },
  optionCheckboxSelected: { borderColor: '#007AFF', backgroundColor: '#007AFF' },
  checkMark: { color: '#fff', fontSize: 12, textAlign: 'center' },
  optionText: { fontSize: 16, marginLeft: 12 },
  shortAnswerInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  navButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  navButtonDisabled: { opacity: 0.5 },
  navButtonText: { fontSize: 16, color: '#333' },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  submitButtonText: { fontSize: 16, color: '#fff', fontWeight: '500' },
  gradingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  gradingText: { fontSize: 18, color: '#666', marginBottom: 20 },
  progressDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ccc' },
  dotActive: { backgroundColor: '#007AFF' },
  resultContainer: { flex: 1, padding: 15 },
  resultTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  resultItem: {
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  resultQuestion: { fontSize: 16, marginBottom: 8 },
  resultStatus: { marginBottom: 8 },
  resultBadge: { fontSize: 14, fontWeight: '500' },
  correctBadge: { color: '#4caf50' },
  incorrectBadge: { color: '#f44336' },
  analysis: { fontSize: 14, color: '#666' },
  retryButton: {
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  retryButtonText: { fontSize: 18, color: '#fff', fontWeight: '500' },
});