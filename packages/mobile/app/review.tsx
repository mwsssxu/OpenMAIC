/**
 * 每日错题复习（重写版）
 *
 * 业务逻辑：
 * 1. 先加载今日到期错题（当天做错的题）
 * 2. 全部答对后，从错题本随机抽取未掌握的题目继续复习
 * 3. 支持单选和多选题
 *
 * UX 设计：
 * - 一屏一题，底部按钮控制翻页
 * - QuoteHeader + 返回按钮
 * - 选项支持多选（multiple 类型）
 * - 答完即时反馈：正确/错误 + 解析
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiClient } from '@/lib/api-client';
import { Colors as RawColors, Rounded, Spacing } from '@/lib/constants/theme';
import { difficultyLabel } from '@/lib/utils/question';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { QuoteHeader } from '@/lib/components/QuoteHeader';
import { showError } from '@/lib/utils/error-toast';
import { useAuth } from '@/lib/auth/auth-context';

const Colors = {
  primary: RawColors.primary.main,
  primaryLight: RawColors.primary.transparent,
  success: RawColors.secondary.success,
  danger: RawColors.semantic.red,
  background: RawColors.neutral.background,
  card: RawColors.neutral.card,
  border: RawColors.neutral.border,
  text: RawColors.neutral.textPrimary,
  textMuted: RawColors.neutral.textMuted,
};

type MistakeItem = {
  id: string;
  course_id: string | null;
  question_id: string;
  question: {
    id: string;
    type?: string;
    content?: string;
    options?: any;
    correct_answer?: string | string[];
    explanation?: string;
    difficulty?: string;
    points?: number;
  };
  attempt_count: number;
  wrong_count: number;
  correct_streak: number;
};

type AnswerResult = {
  is_correct: boolean;
  correct_answer: string | string[];
  explanation: string | null;
  mastered: boolean;
  correct_streak: number;
};

// ====================== 选项解析 ======================

/**
 * 把 question.options 解析成 [key, label][] 结构
 * 兼容多种格式：
 *   - [{label: "A", value: "xxx"}, ...]  （课堂 quiz 格式）
 *   - {A: "内容", B: "内容"}             （dict 格式）
 *   - ["选项1", "选项2"]                  （纯数组）
 */
function parseOptions(options: any): [string, string][] {
  if (!options) return [];

  // dict 格式: {A: "内容", B: "内容"}
  if (typeof options === 'object' && !Array.isArray(options)) {
    return Object.entries(options).map(([k, v]) => [String(k), String(v ?? '')]);
  }

  // 数组格式
  if (Array.isArray(options)) {
    // [{label: "xxx", value: "yyy"}, ...]
    if (options.length > 0 && typeof options[0] === 'object' && options[0] !== null) {
      return options.map((v: any, i: number) => {
        const label = v.label ?? String.fromCharCode(65 + i);
        const value = v.value ?? v.content ?? v.text ?? '';
        // key 用字母 A/B/C/D，展示文案用 label
        return [String.fromCharCode(65 + i), String(label)];
      });
    }
    // ["选项1", "选项2"]
    return options.map((v: any, i: number) => [String.fromCharCode(65 + i), String(v ?? '')]);
  }

  return [];
}

/**
 * 判断是否为多选题
 */
function isMultipleChoice(question: MistakeItem['question']): boolean {
  if (question.type === 'multiple') return true;
  // correct_answer 是数组且长度 > 1 → 多选
  if (Array.isArray(question.correct_answer) && question.correct_answer.length > 1) return true;
  return false;
}

/**
 * 归一化 correct_answer 为数组
 */
function normalizeCorrectAnswer(ca: string | string[] | undefined): string[] {
  if (!ca) return [];
  if (Array.isArray(ca)) return ca;
  // 可能是逗号分隔的字符串 "A,B" 或单个字母 "A"
  if (typeof ca === 'string' && ca.includes(',')) return ca.split(',').map(s => s.trim());
  return [ca];
}

/**
 * 将选项 value 转为字母 key
 */
function valueToKey(entries: [string, string][], val: string): string {
  // 先按 key 匹配
  const byKey = entries.find(([k]) => k === val);
  if (byKey) return byKey[0];
  // 再按 value 匹配
  const byVal = entries.find(([, l]) => l === val);
  if (byVal) return byVal[0];
  return val;
}

export default function ReviewScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const { width } = useWindowDimensions();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [items, setItems] = useState<MistakeItem[]>([]);
  const [stats, setStats] = useState({ total: 0, mastered_count: 0, due_count: 0 });
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<'today' | 'random'>('today'); // 今天错题 / 随机错题
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { picked: string[]; result: AnswerResult }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [correctTotal, setCorrectTotal] = useState(0);

  const listRef = useRef<FlatList<MistakeItem>>(null);
  const answeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    loadToday();
  }, [authLoading, isAuthenticated]);

  async function loadToday() {
    try {
      setLoading(true);
      setPhase('today');
      const data = await apiClient.getTodayMistakes(20);
      setItems(data.items || []);
      setStats(data.stats);
      // 重置答题状态
      setAnswers({});
      setCompleted(0);
      setCorrectTotal(0);
      setCurrentIndex(0);
      answeredRef.current.clear();
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadRandom() {
    try {
      setLoading(true);
      setPhase('random');
      const data = await apiClient.getAllMistakes(10);
      // 随机打乱
      const shuffled = [...(data.items || [])].sort(() => Math.random() - 0.5);
      setItems(shuffled);
      setAnswers({});
      setCompleted(0);
      setCorrectTotal(0);
      setCurrentIndex(0);
      answeredRef.current.clear();
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  // 提交答题
  const handleSubmit = useCallback(
    async (item: MistakeItem, picked: string[]) => {
      if (submitting) return;
      if (answeredRef.current.has(item.id)) return;
      answeredRef.current.add(item.id);
      try {
        setSubmitting(true);
        haptics.light();

        // 多选答案用逗号拼接提交
        const answerStr = picked.sort().join(',');
        const result = await apiClient.answerMistake(item.id, answerStr);

        setAnswers((prev) => ({ ...prev, [item.id]: { picked, result } }));
        setCompleted((n) => n + 1);
        if (result.is_correct) {
          setCorrectTotal((n) => n + 1);
          haptics.success();
        } else {
          haptics.warning();
        }
      } catch (e) {
        answeredRef.current.delete(item.id);
        showError(e);
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, haptics],
  );

  const goNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    }
  }, [items, currentIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      listRef.current?.scrollToIndex({ index: prev, animated: true });
    }
  }, [currentIndex]);

  const handleBack = useCallback(() => {
    // 用 replace 而非 back，确保有历史可回退
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  }, []);

  // ============ Loading ============
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <QuoteHeader />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>加载错题中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============ 空态 ============
  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <QuoteHeader />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>每日复习</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>今天没有要复习的题</Text>
          <Text style={styles.emptyDesc}>
            {stats.total === 0 ? '完成测评后，做错的题会自动进入这里' : `已掌握 ${stats.mastered_count}/${stats.total} 道`}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/courses')}>
            <Text style={styles.primaryBtnText}>去学习</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const allDone = completed >= items.length;

  // ============ 全部答完 ============
  if (allDone) {
    const accuracy = items.length > 0 ? Math.round((correctTotal / items.length) * 100) : 0;
    const masteredJustNow = items.filter((it) => answers[it.id]?.result.mastered).length;
    const isTodayPhase = phase === 'today';
    const allCorrect = correctTotal === items.length;

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <QuoteHeader />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>复习完成</Text>
          <View style={styles.iconBtn} />
        </View>
        <ScrollView contentContainerStyle={styles.completeScroll}>
          <Text style={styles.completeEmoji}>🎯</Text>
          <Text style={styles.completeTitle}>本轮复习完成！</Text>
          <View style={styles.completeStats}>
            <View style={styles.completeStatItem}>
              <Text style={styles.completeStatValue}>{items.length}</Text>
              <Text style={styles.completeStatLabel}>本轮题数</Text>
            </View>
            <View style={styles.completeStatDivider} />
            <View style={styles.completeStatItem}>
              <Text style={[styles.completeStatValue, { color: Colors.success }]}>{correctTotal}</Text>
              <Text style={styles.completeStatLabel}>答对</Text>
            </View>
            <View style={styles.completeStatDivider} />
            <View style={styles.completeStatItem}>
              <Text style={[styles.completeStatValue, { color: Colors.primary }]}>{accuracy}%</Text>
              <Text style={styles.completeStatLabel}>正确率</Text>
            </View>
          </View>
          {masteredJustNow > 0 && (
            <View style={styles.masteredBadge}>
              <Ionicons name="star" size={18} color="#f59e0b" />
              <Text style={styles.masteredBadgeText}>新掌握 {masteredJustNow} 道，已退出错题本</Text>
            </View>
          )}

          {/* 今日错题全部答对 → 可以继续做随机错题 */}
          {isTodayPhase && allCorrect && (
            <TouchableOpacity style={styles.primaryBtn} onPress={loadRandom}>
              <Ionicons name="shuffle" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>继续复习更多错题</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack}>
            <Text style={styles.secondaryBtnText}>完成</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tertiaryBtn}
            onPress={() => {
              answeredRef.current.clear();
              setAnswers({});
              setCompleted(0);
              setCorrectTotal(0);
              setCurrentIndex(0);
              loadToday();
            }}
          >
            <Ionicons name="refresh" size={18} color={Colors.primary} />
            <Text style={styles.tertiaryBtnText}>再来一轮</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============ 答题中 ============
  const progress = items.length > 0 ? (completed / items.length) * 100 : 0;
  const currentItem = items[currentIndex];
  const currentAnswered = !!answers[currentItem?.id];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <QuoteHeader />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {phase === 'today' ? '今日错题' : '随机练习'} · {currentIndex + 1}/{items.length}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {/* 进度条 */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {/* 题目 FlatList */}
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(it) => it.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        renderItem={({ item, index }) => (
          <QuestionCard
            item={item}
            width={width}
            answer={answers[item.id]}
            onSubmit={(picked) => handleSubmit(item, picked)}
            onNext={index < items.length - 1 ? goNext : undefined}
            submitting={submitting}
          />
        )}
      />

      {/* 底部导航 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.footerBtn, currentIndex === 0 && styles.footerBtnDisabled]}
          onPress={goPrev}
          disabled={currentIndex === 0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={currentIndex === 0 ? Colors.textMuted : Colors.text} />
          <Text style={[styles.footerBtnText, currentIndex === 0 && { color: Colors.textMuted }]}>上一题</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerBtn, !currentAnswered && styles.footerBtnDisabled]}
          onPress={() => {
            if (currentAnswered && currentIndex < items.length - 1) {
              goNext();
            }
          }}
          disabled={!currentAnswered}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.footerBtnText, !currentAnswered && { color: Colors.textMuted }]}>
            {currentIndex >= items.length - 1 ? '查看结果' : '下一题'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={!currentAnswered ? Colors.textMuted : Colors.text} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ====================== 单题卡片 ======================

function QuestionCard({
  item,
  width,
  answer,
  onSubmit,
  onNext,
  submitting,
}: {
  item: MistakeItem;
  width: number;
  answer?: { picked: string[]; result: AnswerResult };
  onSubmit: (picked: string[]) => void;
  onNext?: () => void;
  submitting: boolean;
}) {
  const q = item.question;
  const multi = isMultipleChoice(q);
  const isShortAnswer = q.type === 'short_answer' || (!multi && parseOptions(q.options).length === 0);
  const optionEntries = parseOptions(q.options);
  const [selected, setSelected] = useState<string[]>([]);
  const [shortAnswer, setShortAnswer] = useState('');

  const answered = !!answer;
  const isCorrect = answer?.result.is_correct;
  const correctKeys = normalizeCorrectAnswer(answer?.result.correct_answer ?? q.correct_answer)
    .map(ca => valueToKey(optionEntries, ca));
  const userPickedKeys = answer?.picked.map(p => valueToKey(optionEntries, p)) ?? [];

  const toggleOption = (key: string) => {
    if (answered) return;
    if (multi) {
      setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    } else {
      setSelected(prev => prev.includes(key) ? [] : [key]);
    }
  };

  const handleSubmitAnswer = () => {
    if (submitting || answered) return;
    if (isShortAnswer) {
      if (!shortAnswer.trim()) return;
      onSubmit([shortAnswer.trim()]);
    } else {
      if (selected.length === 0) return;
      onSubmit(selected);
    }
  };

  const canSubmit = isShortAnswer ? shortAnswer.trim().length > 0 : selected.length > 0;

  return (
    <View style={[questionStyles.page, { width }]}>
      <ScrollView contentContainerStyle={questionStyles.scroll} showsVerticalScrollIndicator={false}>
        {/* meta */}
        <View style={questionStyles.metaRow}>
          {q.difficulty && <Text style={questionStyles.metaTag}>{difficultyLabel(q.difficulty)}</Text>}
          {multi && <Text style={questionStyles.metaTagMulti}>多选</Text>}
          {isShortAnswer && <Text style={questionStyles.metaTagShort}>问答</Text>}
          <Text style={questionStyles.metaWrong}>共错 {item.wrong_count} 次</Text>
          {item.correct_streak > 0 && (
            <Text style={questionStyles.metaStreak}>已连对 {item.correct_streak}/2</Text>
          )}
        </View>

        {/* 题干 */}
        <Text style={questionStyles.stem}>{q.content || '（题干缺失）'}</Text>

        {/* 选项 */}
        {optionEntries.length > 0 ? (
          <View style={questionStyles.options}>
            {optionEntries.map(([key, label]) => {
              const isSelected = answered ? userPickedKeys.includes(key) : selected.includes(key);
              const isRight = answered && correctKeys.includes(key);
              const isWrongPick = answered && userPickedKeys.includes(key) && !correctKeys.includes(key);
              const isMissed = answered && !userPickedKeys.includes(key) && correctKeys.includes(key);

              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    questionStyles.option,
                    isSelected && !answered && questionStyles.optionPicked,
                    isRight && questionStyles.optionRight,
                    isWrongPick && questionStyles.optionWrong,
                    isMissed && questionStyles.optionMissed,
                  ]}
                  disabled={answered}
                  onPress={() => toggleOption(key)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    questionStyles.optionCheckbox,
                    isSelected && !answered && questionStyles.optionCheckboxPicked,
                    isRight && questionStyles.optionCheckboxRight,
                    isWrongPick && questionStyles.optionCheckboxWrong,
                    isMissed && questionStyles.optionCheckboxMissed,
                  ]}>
                    {isSelected && !answered && <Ionicons name="checkmark" size={14} color="#fff" />}
                    {isRight && <Ionicons name="checkmark" size={14} color="#fff" />}
                    {isWrongPick && <Ionicons name="close" size={14} color="#fff" />}
                    {isMissed && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={[
                    questionStyles.optionKey,
                  ]}>
                    {key}
                  </Text>
                  <Text
                    style={[
                      questionStyles.optionText,
                      isRight && { color: Colors.success, fontWeight: '600' },
                      isWrongPick && { color: Colors.danger, textDecorationLine: 'line-through' },
                      isMissed && { color: Colors.success, fontWeight: '500' },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : isShortAnswer ? (
          // 问答题：文本输入框
          !answered ? (
            <View style={questionStyles.shortAnswerWrap}>
              <TextInput
                style={questionStyles.shortAnswerInput}
                placeholder="请输入你的答案..."
                placeholderTextColor={Colors.textMuted}
                value={shortAnswer}
                onChangeText={setShortAnswer}
                multiline
                maxLength={500}
                editable={!submitting}
                autoFocus
              />
              <Text style={questionStyles.shortAnswerHint}>{shortAnswer.length}/500</Text>
            </View>
          ) : (
            // 已答：显示用户答案 + 正确答案
            <View style={questionStyles.shortAnswerResult}>
              <View style={questionStyles.shortAnswerUserWrap}>
                <Text style={questionStyles.shortAnswerLabel}>你的答案</Text>
                <Text style={[questionStyles.shortAnswerValue, !isCorrect && { color: Colors.danger }]}>
                  {answer?.picked[0] || '未作答'}
                </Text>
              </View>
              {!isCorrect && (
                <View style={questionStyles.fillAnswer}>
                  <Text style={questionStyles.fillLabel}>正确答案</Text>
                  <Text style={questionStyles.fillValue}>
                    {normalizeCorrectAnswer(q.correct_answer).join('、')}
                  </Text>
                </View>
              )}
            </View>
          )
        ) : null}

        {/* 反馈区 */}
        {answered && (
          <View
            style={[
              questionStyles.feedback,
              isCorrect ? questionStyles.feedbackOk : questionStyles.feedbackBad,
            ]}
          >
            <View style={questionStyles.feedbackHeader}>
              <Ionicons
                name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={isCorrect ? Colors.success : Colors.danger}
              />
              <Text
                style={[
                  questionStyles.feedbackTitle,
                  { color: isCorrect ? Colors.success : Colors.danger },
                ]}
              >
                {isCorrect ? (answer!.result.mastered ? '太棒了，已掌握 🎉' : '答对了！') : '答错了'}
              </Text>
            </View>
            {!isCorrect && correctKeys.length > 0 && optionEntries.length > 0 && (
              <Text style={questionStyles.feedbackCorrectHint}>
                正解：<Text style={{ color: Colors.success, fontWeight: '600' }}>
                  {correctKeys.map(k => {
                    const entry = optionEntries.find(([ek]) => ek === k);
                    return entry ? `${k}. ${entry[1]}` : k;
                  }).join('、')}
                </Text>
              </Text>
            )}
            {q.explanation && (
              <Text style={questionStyles.feedbackText}>
                <Text style={questionStyles.feedbackLabel}>解析：</Text>
                {q.explanation}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* 底部 CTA */}
      {!answered ? (
        <View style={questionStyles.submitWrap}>
          <TouchableOpacity
            style={[questionStyles.submitBtn, !canSubmit && questionStyles.submitBtnDisabled]}
            disabled={!canSubmit || submitting}
            onPress={handleSubmitAnswer}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={questionStyles.submitBtnText}>
                {multi && selected.length > 0 ? `提交（已选${selected.length}项）` : '提交答案'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : onNext ? (
        <View style={questionStyles.submitWrap}>
          <TouchableOpacity
            style={[questionStyles.submitBtn, !isCorrect && questionStyles.submitBtnWrong]}
            onPress={onNext}
            activeOpacity={0.85}
          >
            <Text style={questionStyles.submitBtnText}>
              {isCorrect ? '下一题' : '记住了，下一题'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

// ====================== 样式 ======================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: Colors.textMuted, marginBottom: 24, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: Rounded.lg,
    minWidth: 200,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Rounded.lg,
    minWidth: 200,
  },
  secondaryBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  tertiaryBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tertiaryBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '500' },
  completeScroll: {
    padding: 24,
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  completeEmoji: { fontSize: 64, marginBottom: 12 },
  completeTitle: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 24 },
  completeStats: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Rounded.lg,
    padding: 20,
    marginBottom: 16,
    width: '100%',
    maxWidth: 360,
  },
  completeStatItem: { flex: 1, alignItems: 'center' },
  completeStatDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  completeStatValue: { fontSize: 28, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  completeStatLabel: { fontSize: 12, color: Colors.textMuted },
  masteredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Rounded.full,
    marginBottom: 24,
  },
  masteredBadgeText: { marginLeft: 6, fontSize: 13, color: '#92400e', fontWeight: '500' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  footerBtnDisabled: { opacity: 0.4 },
  footerBtnText: { fontSize: 15, color: Colors.text, marginHorizontal: 4 },
});

const questionStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    paddingBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  metaTag: {
    fontSize: 12,
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaTagMulti: {
    fontSize: 12,
    color: '#9333ea',
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaTagShort: {
    fontSize: 12,
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaWrong: {
    fontSize: 12,
    color: Colors.danger,
  },
  metaStreak: {
    fontSize: 12,
    color: Colors.success,
  },
  stem: {
    fontSize: 18,
    lineHeight: 28,
    color: Colors.text,
    marginBottom: 24,
    fontWeight: '500',
  },
  options: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: Rounded.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    minHeight: 56,
  },
  optionPicked: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  optionRight: {
    borderColor: Colors.success,
    backgroundColor: '#ecfdf5',
  },
  optionWrong: {
    borderColor: Colors.danger,
    backgroundColor: '#fef2f2',
  },
  optionMissed: {
    borderColor: Colors.success,
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  optionCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#f9fafb',
  },
  optionCheckboxPicked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionCheckboxRight: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  optionCheckboxWrong: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  optionCheckboxMissed: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  optionKey: {
    width: 24,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    marginRight: 8,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  feedback: {
    marginTop: 20,
    padding: 14,
    borderRadius: Rounded.md,
    borderWidth: 1,
  },
  feedbackOk: { borderColor: Colors.success, backgroundColor: '#ecfdf5' },
  feedbackBad: { borderColor: Colors.danger, backgroundColor: '#fef2f2' },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  feedbackTitle: { fontSize: 15, fontWeight: '600' },
  feedbackText: { fontSize: 14, color: Colors.text, lineHeight: 22 },
  feedbackLabel: { fontWeight: '600' },
  feedbackCorrectHint: {
    fontSize: 14,
    color: Colors.text,
    marginTop: 6,
    lineHeight: 20,
  },
  fillAnswer: {
    marginTop: 16,
    padding: 14,
    borderRadius: Rounded.md,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: Colors.success,
  },
  fillLabel: { fontSize: 12, color: Colors.success, fontWeight: '600', marginBottom: 4 },
  fillValue: { fontSize: 15, color: Colors.text, fontWeight: '500', lineHeight: 22 },
  shortAnswerWrap: {
    marginTop: 8,
  },
  shortAnswerInput: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Rounded.lg,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  shortAnswerHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  shortAnswerResult: {
    marginTop: 8,
    gap: 12,
  },
  shortAnswerUserWrap: {
    padding: 14,
    borderRadius: Rounded.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shortAnswerLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  shortAnswerValue: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  submitWrap: {
    padding: 16,
    paddingBottom: 20,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Rounded.lg,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  submitBtnDisabled: { backgroundColor: Colors.border },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  submitBtnWrong: { backgroundColor: Colors.danger },
});
