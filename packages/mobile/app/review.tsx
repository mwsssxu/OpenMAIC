/**
 * 每日错题复习
 *
 * UX 设计：
 * - 一屏一题，FlatList 横向分页（pagingEnabled），不滑动靠按钮控制
 * - 顶部进度条 + N/M 计数 + 关闭按钮
 * - 题干 + 选项卡片，单选大块点击区
 * - 答完即时反馈：✓ 绿色 + 解析；✗ 红色 + 正确答案
 * - 答对触发 RewardToast (api-client tapReward 自动)
 * - 全部完成显示完成卡片：✓ 你今天攻克了 N 道错题
 *
 * 移动端适配：
 * - safe-area-context 顶部刘海/灵动岛
 * - useWindowDimensions 适配横屏
 * - 大字号 18+，行间距 1.5，主按钮 hit area >= 48px
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiClient } from '@/lib/api-client';
import { Colors as RawColors, Rounded, Spacing } from '@/lib/constants/theme';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { showError } from '@/lib/utils/error-toast';
import { useAuth } from '@/lib/auth/auth-context';

// 平铺一份本页用的色板别名（theme.ts 是嵌套的）
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
    options?: string[];
    correct_answer?: string;
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
  correct_answer: string;
  explanation: string | null;
  mastered: boolean;
  correct_streak: number;
};

export default function ReviewScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const { width } = useWindowDimensions();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [items, setItems] = useState<MistakeItem[] | null>(null);
  const [stats, setStats] = useState({ total: 0, mastered_count: 0, due_count: 0 });
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  // 每题答题状态：mistakeId → { picked, result }
  const [answers, setAnswers] = useState<Record<string, { picked: string; result: AnswerResult }>>({});
  const [submitting, setSubmitting] = useState(false);
  // 全部答完
  const [completed, setCompleted] = useState(0); // 已完成数（含答错）
  const [correctTotal, setCorrectTotal] = useState(0); // 答对总数

  const listRef = useRef<FlatList<MistakeItem>>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    load();
  }, [authLoading, isAuthenticated]);

  async function load() {
    try {
      setLoading(true);
      const data = await apiClient.getTodayMistakes(20);
      setItems(data.items);
      setStats(data.stats);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  // 提交答题
  const handleSubmit = useCallback(
    async (item: MistakeItem, picked: string) => {
      if (submitting) return;
      // 已答过的题不重复提交
      if (answers[item.id]) return;
      try {
        setSubmitting(true);
        haptics.light();
        const result = await apiClient.answerMistake(item.id, picked);
        setAnswers((prev) => ({ ...prev, [item.id]: { picked, result } }));
        setCompleted((n) => n + 1);
        if (result.is_correct) {
          setCorrectTotal((n) => n + 1);
          haptics.success();
        } else {
          haptics.warning();
        }
        // 答完后等用户读完反馈再手动下一题（更可控）
      } catch (e) {
        showError(e);
      } finally {
        setSubmitting(false);
      }
    },
    [answers, submitting, haptics],
  );

  const goNext = useCallback(() => {
    if (!items) return;
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

  // ============ Loading ============
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>加载错题中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============ 空态 ============
  if (!items || items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={Colors.text} />
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
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.iconBtn} />
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
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>完成</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              setAnswers({});
              setCompleted(0);
              setCorrectTotal(0);
              setCurrentIndex(0);
              load();
            }}
          >
            <Text style={styles.secondaryBtnText}>再来一轮</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============ 答题中 ============
  const progress = items.length > 0 ? (completed / items.length) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentIndex + 1} / {items.length}
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
        renderItem={({ item }) => (
          <QuestionCard
            item={item}
            width={width}
            answer={answers[item.id]}
            onSubmit={(picked) => handleSubmit(item, picked)}
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
          style={[styles.footerBtn, !answers[items[currentIndex].id] && styles.footerBtnDisabled]}
          onPress={() => {
            if (currentIndex >= items.length - 1) {
              // 不需要做什么——allDone 会自动接管
              return;
            }
            goNext();
          }}
          disabled={!answers[items[currentIndex].id]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.footerBtnText, !answers[items[currentIndex].id] && { color: Colors.textMuted }]}>
            {currentIndex >= items.length - 1 ? '查看结果' : '下一题'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={!answers[items[currentIndex].id] ? Colors.textMuted : Colors.text} />
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
  submitting,
}: {
  item: MistakeItem;
  width: number;
  answer?: { picked: string; result: AnswerResult };
  onSubmit: (picked: string) => void;
  submitting: boolean;
}) {
  const q = item.question;
  const options = q.options || [];
  const [picked, setPicked] = useState<string | null>(null);

  const answered = !!answer;
  const isCorrect = answer?.result.is_correct;
  const correctAnswer = answer?.result.correct_answer ?? q.correct_answer;

  return (
    <View style={[questionStyles.page, { width }]}>
      <ScrollView contentContainerStyle={questionStyles.scroll} showsVerticalScrollIndicator={false}>
        {/* meta */}
        <View style={questionStyles.metaRow}>
          {q.difficulty && <Text style={questionStyles.metaTag}>{difficultyLabel(q.difficulty)}</Text>}
          <Text style={questionStyles.metaWrong}>共错 {item.wrong_count} 次</Text>
          {item.correct_streak > 0 && (
            <Text style={questionStyles.metaStreak}>已连对 {item.correct_streak}/2</Text>
          )}
        </View>

        {/* 题干 */}
        <Text style={questionStyles.stem}>{q.content || '（题干缺失）'}</Text>

        {/* 选项 */}
        <View style={questionStyles.options}>
          {options.map((opt, idx) => {
            const isPicked = answered ? answer.picked === opt : picked === opt;
            const isRight = answered && opt === correctAnswer;
            const isWrongPick = answered && answer.picked === opt && !answer.result.is_correct;

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  questionStyles.option,
                  isPicked && !answered && questionStyles.optionPicked,
                  isRight && questionStyles.optionRight,
                  isWrongPick && questionStyles.optionWrong,
                ]}
                disabled={answered}
                onPress={() => setPicked(opt)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    questionStyles.optionLabel,
                    isPicked && !answered && questionStyles.optionLabelPicked,
                    isRight && questionStyles.optionLabelRight,
                    isWrongPick && questionStyles.optionLabelWrong,
                  ]}
                >
                  {String.fromCharCode(65 + idx)}
                </Text>
                <Text
                  style={[
                    questionStyles.optionText,
                    isRight && { color: Colors.success, fontWeight: '600' },
                    isWrongPick && { color: Colors.danger },
                  ]}
                >
                  {opt}
                </Text>
                {isRight && <Ionicons name="checkmark-circle" size={20} color={Colors.success} />}
                {isWrongPick && <Ionicons name="close-circle" size={20} color={Colors.danger} />}
              </TouchableOpacity>
            );
          })}
        </View>

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
                {isCorrect ? (answer.result.mastered ? '太棒了，已掌握 🎉' : '答对了！') : '答错了'}
              </Text>
            </View>
            {q.explanation && (
              <Text style={questionStyles.feedbackText}>
                <Text style={questionStyles.feedbackLabel}>解析：</Text>
                {q.explanation}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* 提交按钮——未答时显示 */}
      {!answered && (
        <View style={questionStyles.submitWrap}>
          <TouchableOpacity
            style={[questionStyles.submitBtn, !picked && questionStyles.submitBtnDisabled]}
            disabled={!picked || submitting}
            onPress={() => picked && onSubmit(picked)}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={questionStyles.submitBtnText}>提交答案</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function difficultyLabel(d: string): string {
  switch (d) {
    case 'easy':
      return '简单';
    case 'medium':
      return '中等';
    case 'hard':
      return '困难';
    case 'basic':
      return '基础';
    case 'advanced':
      return '进阶';
    default:
      return d;
  }
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
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  // 完成页
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
  completeStatDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 8 },
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
  // footer
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
  footerBtnDisabled: { opacity: 0.5 },
  footerBtnText: { fontSize: 15, color: Colors.text, marginHorizontal: 4 },
});

const questionStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    paddingBottom: 100,
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
  optionLabel: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '600',
    fontSize: 13,
    marginRight: 12,
  },
  optionLabelPicked: {
    backgroundColor: Colors.primary,
    color: '#fff',
  },
  optionLabelRight: {
    backgroundColor: Colors.success,
    color: '#fff',
  },
  optionLabelWrong: {
    backgroundColor: Colors.danger,
    color: '#fff',
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
  submitWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
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
  },
  submitBtnDisabled: { backgroundColor: Colors.border },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
