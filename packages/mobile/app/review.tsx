/**
 * 每日错题复习
 *
 * 交互：
 * 1. 默认按课程汇总展示今日复习错题卡片
 * 2. 卡片展示课程名称、今日题数、已答/答对/待复习情况
 * 3. 点击课程进入该课程逐题答题；答完题仍保留在列表中，可继续查看答案/解析
 * 4. 答案与解析支持复制
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { apiClient } from '@/lib/api-client';
import { Colors as RawColors, Rounded } from '@/lib/constants/theme';
import { difficultyLabel } from '@/lib/utils/question';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { QuoteHeader } from '@/lib/components/QuoteHeader';
import { showError, showSuccess } from '@/lib/utils/error-toast';
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

const UNCATEGORIZED_SENTINEL = '__uncategorized__';

function courseKey(courseId: string | null | undefined): string {
  return courseId ?? UNCATEGORIZED_SENTINEL;
}

function isReviewedToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const reviewedAt = new Date(iso);
  const now = new Date();
  const utcStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0,
  ));
  return reviewedAt >= utcStart;
}

function getQuestionCorrectAnswer(question: { correct_answer?: string | string[]; answer?: string | string[] }): string | string[] | undefined {
  return question.correct_answer ?? question.answer;
}

function getQuestionExplanation(question: { explanation?: string; analysis?: string }): string | undefined {
  return question.explanation ?? question.analysis;
}

function createReadOnlyAnswer(item: MistakeItem): { picked: string[]; result: AnswerResult } | undefined {
  if (!isReviewedToday(item.last_reviewed_at)) return undefined;
  const correctAnswer = getQuestionCorrectAnswer(item.question) ?? [];
  return {
    picked: normalizeCorrectAnswer(correctAnswer),
    result: {
      is_correct: true,
      correct_answer: correctAnswer,
      explanation: getQuestionExplanation(item.question) ?? null,
      mastered: !!item.mastered,
      correct_streak: item.correct_streak,
      reviewed_only: true,
    },
  };
}

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
    answer?: string | string[];
    explanation?: string;
    analysis?: string;
    difficulty?: string;
    points?: number;
  };
  attempt_count: number;
  wrong_count: number;
  correct_streak: number;
  mastered?: boolean;
  next_review_at?: string | null;
  last_reviewed_at?: string | null;
  first_wrong_at?: string | null;
};

type AnswerResult = {
  is_correct: boolean;
  correct_answer: string | string[];
  explanation: string | null;
  mastered: boolean;
  correct_streak: number;
  reviewed_only?: boolean;
};

type CourseSummary = {
  course_id: string | null;
  course_name: string;
  total_count: number;
  unmastered_count: number;
  mastered_count: number;
  due_count: number;
  reviewed_today_count?: number;
};

type AnswerState = Record<string, { picked: string[]; result: AnswerResult }>;

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

  if (typeof options === 'object' && !Array.isArray(options)) {
    return Object.entries(options).map(([k, v]) => [String(k), String(v ?? '')]);
  }

  if (Array.isArray(options)) {
    if (options.length > 0 && typeof options[0] === 'object' && options[0] !== null) {
      const isKeyLike = (value: any) => /^[A-Z]$/.test(String(value ?? '').trim()) || /^\d+$/.test(String(value ?? '').trim());
      return options.map((v: any, i: number) => {
        const fallbackKey = String.fromCharCode(65 + i);
        const label = v.label;
        const value = v.value;
        let key = v.key ?? v.id ?? fallbackKey;
        let text = v.content ?? v.text ?? v.title;

        if (text == null && label != null && value != null) {
          if (isKeyLike(label) && !isKeyLike(value)) {
            key = label;
            text = value;
          } else if (isKeyLike(value) && !isKeyLike(label)) {
            key = value;
            text = label;
          } else {
            key = v.key ?? value ?? label ?? fallbackKey;
            text = label ?? value;
          }
        } else if (text == null) {
          text = label ?? value ?? '';
        }

        return [String(key), String(text)];
      });
    }
    return options.map((v: any, i: number) => [String.fromCharCode(65 + i), String(v ?? '')]);
  }

  return [];
}

function isMultipleChoice(question: MistakeItem['question']): boolean {
  const correctAnswer = getQuestionCorrectAnswer(question);
  if (question.type === 'multiple') return true;
  if (Array.isArray(correctAnswer) && correctAnswer.length > 1) return true;
  return false;
}

function normalizeCorrectAnswer(ca: string | string[] | undefined): string[] {
  if (!ca) return [];
  if (Array.isArray(ca)) return ca;
  if (typeof ca === 'string' && ca.includes(',')) return ca.split(',').map(s => s.trim());
  return [ca];
}

function valueToKey(entries: [string, string][], val: string): string {
  const byKey = entries.find(([k]) => k === val);
  if (byKey) return byKey[0];
  const byVal = entries.find(([, l]) => l === val);
  if (byVal) return byVal[0];
  return val;
}

function formatCorrectAnswer(item: MistakeItem, result?: AnswerResult): string {
  const q = item.question;
  const entries = parseOptions(q.options);
  const correctAnswer = result?.correct_answer ?? getQuestionCorrectAnswer(q);
  const correctKeys = normalizeCorrectAnswer(correctAnswer)
    .map(ca => valueToKey(entries, ca));

  if (entries.length > 0) {
    return correctKeys.map(k => {
      const entry = entries.find(([ek]) => ek === k);
      return entry ? `${k}. ${entry[1]}` : k;
    }).join('、');
  }

  return normalizeCorrectAnswer(correctAnswer).join('、');
}

export default function ReviewScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [courseQuery, setCourseQuery] = useState('');
  const [stats, setStats] = useState({ total: 0, mastered_count: 0, due_count: 0 });
  const [selectedCourse, setSelectedCourse] = useState<CourseSummary | null>(null);
  const [items, setItems] = useState<MistakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [courseProgress, setCourseProgress] = useState<Record<string, { answered: number; correct: number }>>({});
  const [submitting, setSubmitting] = useState(false);

  const answeredRef = useRef<Set<string>>(new Set());

  const handleBack = useCallback(() => {
    if (selectedCourse) {
      setSelectedCourse(null);
      setItems([]);
      setCurrentIndex(0);
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  }, [router, selectedCourse]);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, coursesData] = await Promise.all([
        apiClient.getMistakeStats(),
        apiClient.getMistakesByCourse({ today_scope: true }),
      ]);
      setStats(statsData);
      setCourses(coursesData);
      setCourseProgress({});
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCourseItems = useCallback(async (course: CourseSummary) => {
    try {
      setDetailLoading(true);
      const pageSize = 200;
      const params: any = { today_scope: true, only_unmastered: false, limit: pageSize };
      if (course.course_id) {
        params.course_id = course.course_id;
      } else {
        params.uncategorized = true;
      }
      const allItems: MistakeItem[] = [];
      let offset = 0;
      while (true) {
        const data = await apiClient.getMistakeList({ ...params, offset });
        allItems.push(...data.items);
        if (data.items.length < pageSize) break;
        offset += pageSize;
      }
      setItems(allItems);
      setCurrentIndex(0);
    } catch (e) {
      showError(e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    loadSummary();
  }, [authLoading, isAuthenticated, loadSummary, router]);

  const handleSelectCourse = useCallback((course: CourseSummary) => {
    haptics.light();
    setCurrentIndex(0);
    setItems([]);
    setSelectedCourse(course);
    loadCourseItems(course);
  }, [haptics, loadCourseItems]);

  const handleSubmit = useCallback(
    async (item: MistakeItem, picked: string[]) => {
      if (submitting) return;
      if (answeredRef.current.has(item.id)) return;
      answeredRef.current.add(item.id);
      try {
        setSubmitting(true);
        haptics.light();

        const answerStr = [...picked].sort().join(',');
        const result = await apiClient.answerMistake(item.id, answerStr);

        setAnswers((prev) => ({ ...prev, [item.id]: { picked, result } }));
        setCourseProgress((prev) => {
          const key = courseKey(item.course_id);
          const old = prev[key] ?? { answered: 0, correct: 0 };
          return {
            ...prev,
            [key]: {
              answered: old.answered + 1,
              correct: old.correct + (result.is_correct ? 1 : 0),
            },
          };
        });
        if (result.is_correct) {
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
      setCurrentIndex(currentIndex + 1);
    }
  }, [items.length, currentIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const summaryProgress = useMemo(() => {
    const map: Record<string, { answered: number; correct: number }> = {};
    for (const course of courses) {
      const key = courseKey(course.course_id);
      const local = courseProgress[key] ?? { answered: 0, correct: 0 };
      map[key] = {
        answered: (course.reviewed_today_count ?? 0) + local.answered,
        correct: local.correct,
      };
    }
    return map;
  }, [courseProgress, courses]);

  const filteredCourses = useMemo(() => {
    const keyword = courseQuery.trim().toLowerCase();
    if (!keyword) return courses;
    return courses.filter((course) => course.course_name.toLowerCase().includes(keyword));
  }, [courseQuery, courses]);

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

  // ============ 课程汇总 ============
  if (!selectedCourse) {
    const todayTotal = courses.reduce((sum, c) => sum + c.total_count, 0);
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <QuoteHeader />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>每日复习</Text>
          <TouchableOpacity onPress={loadSummary} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="refresh" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{todayTotal}</Text>
            <Text style={styles.statLabel}>今日题数</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: Colors.primary }]}>{courses.length}</Text>
            <Text style={styles.statLabel}>课程</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: Colors.success }]}>{stats.mastered_count}</Text>
            <Text style={styles.statLabel}>已掌握</Text>
          </View>
        </View>

        {courses.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyTitle}>今天没有要复习的题</Text>
            <Text style={styles.emptyDesc}>
              {stats.total === 0 ? '完成测评后，做错的题会自动进入这里' : `错题本共有 ${stats.total} 道，已掌握 ${stats.mastered_count} 道`}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/courses')}>
              <Text style={styles.primaryBtnText}>去学习</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.courseFilterWrap}>
              <Ionicons name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.courseFilterInput}
                value={courseQuery}
                onChangeText={setCourseQuery}
                placeholder="按课程名称筛选"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {courseQuery.trim().length > 0 && (
                <TouchableOpacity
                  style={styles.filterClearBtn}
                  onPress={() => setCourseQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {filteredCourses.length === 0 ? (
              <View style={styles.filterEmpty}>
                <Text style={styles.filterEmptyTitle}>没有匹配的课程</Text>
                <Text style={styles.filterEmptyDesc}>换个课程名称关键词试试</Text>
              </View>
            ) : (
              <FlatList
                data={filteredCourses}
                keyExtractor={(item) => item.course_id ?? UNCATEGORIZED_SENTINEL}
                contentContainerStyle={styles.courseListContent}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const key = courseKey(item.course_id);
                  const progress = summaryProgress[key] ?? { answered: item.reviewed_today_count ?? 0, correct: 0 };
                  return (
                    <ReviewCourseCard
                      course={item}
                      answered={Math.min(progress.answered, item.total_count)}
                      correct={progress.correct}
                      onPress={() => handleSelectCourse(item)}
                    />
                  );
                }}
              />
            )}
          </>
        )}
      </SafeAreaView>
    );
  }

  // ============ 课程答题详情 ============
  const answeredCount = items.filter((it) => answers[it.id] || isReviewedToday(it.last_reviewed_at)).length;
  const itemIds = new Set(items.map((it) => it.id));
  const correctCount = Object.entries(answers).filter(([id, a]) => itemIds.has(id) && a.result.is_correct).length;
  const progress = items.length > 0 ? (answeredCount / items.length) * 100 : 0;
  const currentItem = items[currentIndex];
  const currentAnswered = !!answers[currentItem?.id];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <QuoteHeader />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {selectedCourse.course_name} · {items.length === 0 ? 0 : currentIndex + 1}/{items.length}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.detailStatsBar}>
        <Text style={styles.detailStatText}>已答 {answeredCount}/{items.length}</Text>
        <View style={styles.detailStatDot} />
        <Text style={styles.detailStatText}>本次答对 {correctCount}</Text>
        <View style={styles.detailStatDot} />
        <Text style={styles.detailStatText}>错题会一直保留可查看</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {detailLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>加载课程错题中...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>这门课今天没有要复习的题</Text>
          <Text style={styles.emptyDesc}>返回课程列表看看其他课程吧</Text>
        </View>
      ) : (
        <>
          <View style={styles.questionArea}>
            {currentItem && (
              <QuestionCard
                key={currentItem.id}
                item={currentItem}
                answer={answers[currentItem.id] ?? createReadOnlyAnswer(currentItem)}
                onSubmit={(picked) => handleSubmit(currentItem, picked)}
                onNext={currentIndex < items.length - 1 ? goNext : undefined}
                submitting={submitting}
              />
            )}
          </View>

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
              style={[styles.footerBtn, currentIndex >= items.length - 1 && styles.footerBtnDisabled]}
              onPress={goNext}
              disabled={currentIndex >= items.length - 1}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.footerBtnText, currentIndex >= items.length - 1 && { color: Colors.textMuted }]}>
                下一题
              </Text>
              <Ionicons name="chevron-forward" size={20} color={currentIndex >= items.length - 1 ? Colors.textMuted : Colors.text} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// ====================== 课程卡片 ======================

function ReviewCourseCard({
  course,
  answered,
  correct,
  onPress,
}: {
  course: CourseSummary;
  answered: number;
  correct: number;
  onPress: () => void;
}) {
  const progress = course.total_count > 0 ? Math.round((answered / course.total_count) * 100) : 0;
  return (
    <TouchableOpacity style={courseCardStyles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={courseCardStyles.header}>
        <View style={courseCardStyles.iconWrap}>
          <Ionicons name="book" size={20} color={Colors.primary} />
        </View>
        <View style={courseCardStyles.titleWrap}>
          <Text style={courseCardStyles.title} numberOfLines={1}>{course.course_name}</Text>
          <Text style={courseCardStyles.subtitle}>今日 {course.total_count} 题 · 待复习 {course.due_count} 题</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
      </View>

      <View style={courseCardStyles.statusRow}>
        <View style={courseCardStyles.statusPill}>
          <Text style={courseCardStyles.statusLabel}>已答</Text>
          <Text style={courseCardStyles.statusValue}>{answered}/{course.total_count}</Text>
        </View>
        <View style={[courseCardStyles.statusPill, { backgroundColor: '#ecfdf5' }]}>
          <Text style={[courseCardStyles.statusLabel, { color: Colors.success }]}>本次答对</Text>
          <Text style={[courseCardStyles.statusValue, { color: Colors.success }]}>{correct}</Text>
        </View>
        <View style={[courseCardStyles.statusPill, { backgroundColor: '#fff7ed' }]}>
          <Text style={[courseCardStyles.statusLabel, { color: Colors.primary }]}>进度</Text>
          <Text style={[courseCardStyles.statusValue, { color: Colors.primary }]}>{progress}%</Text>
        </View>
      </View>

      <View style={courseCardStyles.progressBar}>
        <View style={[courseCardStyles.progressFill, { width: `${progress}%` }]} />
      </View>
    </TouchableOpacity>
  );
}

// ====================== 单题卡片 ======================

function QuestionCard({
  item,
  answer,
  onSubmit,
  onNext,
  submitting,
}: {
  item: MistakeItem;
  answer?: { picked: string[]; result: AnswerResult };
  onSubmit: (picked: string[]) => void;
  onNext?: () => void;
  submitting: boolean;
}) {
  const haptics = useHaptics();
  const q = item.question;
  const multi = isMultipleChoice(q);
  const isShortAnswer = q.type === 'short_answer' || (!multi && parseOptions(q.options).length === 0);
  const optionEntries = parseOptions(q.options);
  const [selected, setSelected] = useState<string[]>([]);
  const [shortAnswer, setShortAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);

  const revealedAnswer = useMemo(() => {
    if (!revealed || answer) return undefined;
    const correctAnswer = getQuestionCorrectAnswer(q) ?? [];
    return {
      picked: [] as string[],
      result: {
        is_correct: true,
        correct_answer: correctAnswer,
        explanation: getQuestionExplanation(q) ?? null,
        mastered: !!item.mastered,
        correct_streak: item.correct_streak,
        reviewed_only: true,
      },
    };
  }, [revealed, answer, q, item.mastered, item.correct_streak]);

  const visibleAnswer = answer ?? revealedAnswer;
  const answered = !!visibleAnswer;
  const isCorrect = visibleAnswer?.result.is_correct;
  const correctKeys = normalizeCorrectAnswer(visibleAnswer?.result.correct_answer ?? getQuestionCorrectAnswer(q))
    .map(ca => valueToKey(optionEntries, ca));
  const userPickedKeys = visibleAnswer?.picked.map(p => valueToKey(optionEntries, p)) ?? [];
  const correctAnswerText = formatCorrectAnswer(item, visibleAnswer?.result);
  const correctAnswerEntries = optionEntries.length > 0
    ? correctKeys.map((key) => {
      const entry = optionEntries.find(([entryKey]) => entryKey === key);
      return { key, label: entry?.[1] ?? key };
    })
    : [];
  const explanationText = visibleAnswer?.result.explanation ?? getQuestionExplanation(q) ?? '';

  const copyText = async (text: string, label: string) => {
    if (!text.trim()) return;
    try {
      await Clipboard.setStringAsync(text);
      showSuccess(`${label}已复制`);
    } catch (e) {
      showError(e);
    }
  };

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
    <View style={questionStyles.page}>
      <ScrollView
        style={questionStyles.scrollView}
        contentContainerStyle={questionStyles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={questionStyles.metaRow}>
          {q.difficulty && <Text style={questionStyles.metaTag}>{difficultyLabel(q.difficulty)}</Text>}
          {multi && <Text style={questionStyles.metaTagMulti}>多选</Text>}
          {isShortAnswer && <Text style={questionStyles.metaTagShort}>问答</Text>}
          <Text style={questionStyles.metaWrong}>共错 {item.wrong_count} 次</Text>
          {item.correct_streak > 0 && (
            <Text style={questionStyles.metaStreak}>已连对 {item.correct_streak}/2</Text>
          )}
        </View>

        <Text style={questionStyles.stem}>{q.content || '（题干缺失）'}</Text>

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
                  <Text style={questionStyles.optionKey}>{key}</Text>
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
            <View style={questionStyles.shortAnswerResult}>
              <View style={questionStyles.shortAnswerUserWrap}>
                <Text style={questionStyles.shortAnswerLabel}>你的答案</Text>
                <Text style={[questionStyles.shortAnswerValue, !isCorrect && { color: Colors.danger }]}>
                  {visibleAnswer?.picked[0] || '未作答'}
                </Text>
              </View>
            </View>
          )
        ) : null}

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
                {visibleAnswer!.result.reviewed_only ? (revealed && !answer ? '已查看答案，可复制答案与解析' : '今天已复习，可继续查看答案') : (isCorrect ? (visibleAnswer!.result.mastered ? '太棒了，已掌握 🎉' : '答对了！') : '答错了')}
              </Text>
            </View>

            {correctAnswerText && (
              <View style={questionStyles.copyBlock}>
                <View style={questionStyles.copyBlockHeader}>
                  <Text style={questionStyles.feedbackLabel}>正确答案</Text>
                  <TouchableOpacity
                    style={questionStyles.copyBtn}
                    onPress={() => copyText(correctAnswerText, '正确答案')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                    <Text style={questionStyles.copyBtnText}>复制</Text>
                  </TouchableOpacity>
                </View>
                {correctAnswerEntries.length > 0 ? (
                  <View style={questionStyles.answerOptionList}>
                    {correctAnswerEntries.map((entry) => (
                      <View key={entry.key} style={questionStyles.answerOptionRow}>
                        <Text style={questionStyles.answerOptionKey}>{entry.key}</Text>
                        <Text style={questionStyles.answerOptionText}>{entry.label}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={questionStyles.feedbackCorrectHint}>{correctAnswerText}</Text>
                )}
              </View>
            )}

            {explanationText && (
              <View style={questionStyles.copyBlock}>
                <View style={questionStyles.copyBlockHeader}>
                  <Text style={questionStyles.feedbackLabel}>解析</Text>
                  <TouchableOpacity
                    style={questionStyles.copyBtn}
                    onPress={() => copyText(explanationText, '解析')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                    <Text style={questionStyles.copyBtnText}>复制</Text>
                  </TouchableOpacity>
                </View>
                <Text style={questionStyles.feedbackText}>{explanationText}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {!answered ? (
        <View style={questionStyles.submitWrap}>
          <View style={questionStyles.actionRow}>
            <TouchableOpacity
              style={questionStyles.revealBtn}
              onPress={() => {
                haptics.light();
                setRevealed(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="eye-outline" size={16} color={Colors.primary} />
              <Text style={questionStyles.revealBtnText}>查看答案</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[questionStyles.submitBtn, questionStyles.submitBtnInRow, !canSubmit && questionStyles.submitBtnDisabled]}
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
      ) : (
        <View style={questionStyles.submitWrap}>
          <View style={questionStyles.doneHint}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={questionStyles.doneHintText}>本题已作答，可继续查看答案与解析</Text>
          </View>
        </View>
      )}
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
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 8,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Rounded.lg,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statBlock: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.border },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  statLabel: { fontSize: 12, color: Colors.textMuted },
  courseListContent: {
    padding: 16,
    paddingBottom: 32,
  },
  courseFilterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: Rounded.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    gap: 8,
  },
  courseFilterInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  filterClearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  filterEmptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  filterEmptyDesc: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  detailStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  detailStatText: { fontSize: 12, color: Colors.textMuted },
  detailStatDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.border },
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
  questionArea: {
    flex: 1,
    minHeight: 0,
  },
  questionPager: {
    flex: 1,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
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

const courseCardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 10 },
  statusPill: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  statusLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  statusValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
});

const questionStyles = StyleSheet.create({
  page: {
    flex: 1,
    width: '100%',
    minWidth: 0,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    // 题卡下面还有外层“上一题/下一题”footer。
    // 答案/解析较长时必须给底部留出滚动缓冲，否则最后一段内容会被 footer 视觉遮挡。
    paddingBottom: 112,
    flexGrow: 1,
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
    width: '100%',
  },
  option: {
    width: '100%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginRight: 10,
    marginTop: 2,
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
    flexShrink: 0,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    marginRight: 8,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  feedback: {
    marginTop: 20,
    padding: 14,
    borderRadius: Rounded.md,
    borderWidth: 1,
    gap: 12,
  },
  feedbackOk: { borderColor: Colors.success, backgroundColor: '#ecfdf5' },
  feedbackBad: { borderColor: Colors.danger, backgroundColor: '#fef2f2' },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedbackTitle: { fontSize: 15, fontWeight: '600' },
  feedbackText: { fontSize: 14, color: Colors.text, lineHeight: 22 },
  feedbackLabel: { fontWeight: '600', color: Colors.text, fontSize: 13 },
  feedbackCorrectHint: {
    fontSize: 14,
    color: Colors.success,
    lineHeight: 20,
    fontWeight: '500',
  },
  answerOptionList: {
    gap: 8,
  },
  answerOptionRow: {
    width: '100%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  answerOptionKey: {
    minWidth: 28,
    flexShrink: 0,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.success,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '700',
    fontSize: 13,
  },
  answerOptionText: {
    flex: 1,
    minWidth: 0,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  copyBlock: {
    gap: 6,
  },
  copyBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.card,
  },
  copyBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  revealBtn: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: Rounded.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  revealBtnText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  submitBtnInRow: {
    flex: 1,
  },
  submitBtnDisabled: { backgroundColor: Colors.border },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  submitBtnWrong: { backgroundColor: Colors.danger },
  doneHint: {
    minHeight: 48,
    borderRadius: Rounded.lg,
    backgroundColor: '#ecfdf5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  doneHintText: { color: Colors.success, fontSize: 14, fontWeight: '500' },
});
