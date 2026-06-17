/**
 * 我的错题本
 *
 * 两级视图：
 *   1. 课程汇总（默认）：按课程聚合的卡片列表 + 搜索筛选 + 顶部统计 + 主 CTA
 *   2. 课程详情：选中某门课后展示该课程的错题列表（未掌握 / 已掌握 Tab）
 *
 * 移动端适配：
 *   - safe-area top 边
 *   - FlatList 长列表性能
 *   - 空态友好
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useFocusEffect } from 'expo-router';
import { apiClient } from '@/lib/api-client';
import { showError, showSuccess } from '@/lib/utils/error-toast';
import { parseOptions, pickedToKey, difficultyLabel } from '@/lib/utils/question';
import { useHaptics } from '@/lib/hooks/use-haptics';

type MistakeListItem = {
  id: string;
  course_id: string | null;
  question_id: string;
  question: any;
  attempt_count: number;
  wrong_count: number;
  correct_streak: number;
  mastered: boolean;
  next_review_at: string | null;
  last_reviewed_at: string | null;
  first_wrong_at: string | null;
};

type CourseSummary = {
  course_id: string | null;
  course_name: string;
  total_count: number;
  unmastered_count: number;
  mastered_count: number;
  due_count: number;
};

type Tab = 'unmastered' | 'mastered';
// 课程详情视图的特殊 sentinel：course_id === null 表示"未分类"
const UNCATEGORIZED_SENTINEL = '__uncategorized__';

function normalizeCorrectAnswer(answer: any): string[] {
  if (answer == null) return [];
  if (Array.isArray(answer)) return answer.map(String);
  if (typeof answer === 'string' && answer.includes(',')) {
    return answer.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [String(answer)];
}

function getQuestionCorrectAnswer(question: any): any {
  return question?.correct_answer ?? question?.answer;
}

function getQuestionExplanation(question: any): string {
  return question?.explanation ?? question?.analysis ?? '';
}

function formatCorrectAnswer(optionEntries: [string, string][], correctAnswer: any): string {
  const values = normalizeCorrectAnswer(correctAnswer);
  if (optionEntries.length === 0) return values.join('、');
  return values.map(value => {
    const key = pickedToKey(optionEntries, value);
    const label = optionEntries.find(([k]) => k === key)?.[1] ?? value;
    return key ? `${key}. ${label}` : label;
  }).join('、');
}

export default function MistakeBookScreen() {
  const router = useRouter();
  const haptics = useHaptics();

  // 顶部统计（始终显示）
  const [stats, setStats] = useState({ total: 0, mastered_count: 0, due_count: 0 });
  // 课程汇总
  const [courseSummary, setCourseSummary] = useState<CourseSummary[]>([]);
  // 课程筛选输入
  const [search, setSearch] = useState('');
  // 选中的课程（null = 列表视图，非 null = 详情视图）
  const [selectedCourse, setSelectedCourse] = useState<CourseSummary | null>(null);

  // 详情视图状态
  const [tab, setTab] = useState<Tab>('unmastered');
  const [items, setItems] = useState<MistakeListItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const detailRequestSeq = useRef(0);

  const loadSummary = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [statsData, coursesData] = await Promise.all([
        apiClient.getMistakeStats(),
        apiClient.getMistakesByCourse(),
      ]);
      setStats(statsData);
      setCourseSummary(coursesData);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadCourseDetail = useCallback(
    async (course: CourseSummary, currentTab: Tab) => {
      const requestSeq = ++detailRequestSeq.current;
      try {
        setDetailLoading(true);
        const pageSize = 200;
        const params: any = {
          only_unmastered: currentTab === 'unmastered',
          limit: pageSize,
        };
        if (course.course_id) {
          params.course_id = course.course_id;
        } else {
          params.uncategorized = true;
        }
        const allItems: MistakeListItem[] = [];
        let offset = 0;
        while (true) {
          const listData = await apiClient.getMistakeList({ ...params, offset });
          allItems.push(...listData.items);
          if (listData.items.length < pageSize) break;
          offset += pageSize;
        }
        if (requestSeq !== detailRequestSeq.current) return;
        // 后端 only_unmastered=false 表示“全部”，已掌握 Tab 需要客户端再过滤 mastered=true。
        const filtered = currentTab === 'mastered'
          ? allItems.filter(it => it.mastered)
          : allItems.filter(it => !it.mastered);
        setItems(filtered);
      } catch (e) {
        if (requestSeq === detailRequestSeq.current) showError(e);
      } finally {
        if (requestSeq === detailRequestSeq.current) setDetailLoading(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      loadSummary(false);
    }, [loadSummary]),
  );

  // 切换 tab 或选中课程时重新拉详情列表
  useEffect(() => {
    if (selectedCourse) {
      loadCourseDetail(selectedCourse, tab);
    }
  }, [selectedCourse, tab, loadCourseDetail]);

  const onRefresh = () => {
    setRefreshing(true);
    if (selectedCourse) {
      loadCourseDetail(selectedCourse, tab).finally(() => setRefreshing(false));
    } else {
      loadSummary(false);
    }
  };

  const masteryRate = stats.total > 0 ? Math.round((stats.mastered_count / stats.total) * 100) : 0;

  // 课程列表筛选（按 course_name 模糊匹配）
  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courseSummary;
    return courseSummary.filter(c => c.course_name.toLowerCase().includes(q));
  }, [search, courseSummary]);

  // ============ 详情视图 ============
  if (selectedCourse) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setSelectedCourse(null);
              setItems([]);
            }}
            style={styles.iconBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {selectedCourse.course_name}
          </Text>
          <View style={styles.iconBtn} />
        </View>

        {/* 课程级统计条 */}
        <View style={styles.courseDetailStats}>
          <Text style={styles.courseDetailStatItem}>
            共 <Text style={styles.courseDetailStatValue}>{selectedCourse.total_count}</Text> 题
          </Text>
          <View style={styles.courseDetailStatDot} />
          <Text style={styles.courseDetailStatItem}>
            待复习{' '}
            <Text style={[styles.courseDetailStatValue, { color: '#ea580c' }]}>
              {selectedCourse.due_count}
            </Text>
          </Text>
          <View style={styles.courseDetailStatDot} />
          <Text style={styles.courseDetailStatItem}>
            已掌握{' '}
            <Text style={[styles.courseDetailStatValue, { color: '#10b981' }]}>
              {selectedCourse.mastered_count}
            </Text>
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'unmastered' && styles.tabActive]}
            onPress={() => {
              haptics.light();
              setTab('unmastered');
            }}
          >
            <Text style={[styles.tabText, tab === 'unmastered' && styles.tabTextActive]}>
              未掌握 {selectedCourse.unmastered_count > 0 ? `· ${selectedCourse.unmastered_count}` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'mastered' && styles.tabActive]}
            onPress={() => {
              haptics.light();
              setTab('mastered');
            }}
          >
            <Text style={[styles.tabText, tab === 'mastered' && styles.tabTextActive]}>
              已掌握 {selectedCourse.mastered_count > 0 ? `· ${selectedCourse.mastered_count}` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        {detailLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#ec5b13" />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>{tab === 'mastered' ? '🌟' : '🎉'}</Text>
            <Text style={styles.emptyTitle}>
              {tab === 'mastered' ? '该课程还没有掌握的题目' : '该课程暂无未掌握错题'}
            </Text>
            <Text style={styles.emptyDesc}>
              {tab === 'mastered' ? '连续答对 2 次，题目就会出现在这里' : '继续保持，再接再厉'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec5b13" />
            }
            renderItem={({ item }) => <MistakeCard item={item} />}
          />
        )}
      </SafeAreaView>
    );
  }

  // ============ 课程汇总视图 ============
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>我的错题本</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>累计错题</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, { color: '#ea580c' }]}>{stats.due_count}</Text>
          <Text style={styles.statLabel}>待复习</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.mastered_count}</Text>
          <Text style={styles.statLabel}>已掌握</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>{masteryRate}%</Text>
          <Text style={styles.statLabel}>掌握率</Text>
        </View>
      </View>

      {/* CTA */}
      {stats.due_count > 0 && (
        <TouchableOpacity
          style={styles.cta}
          onPress={() => {
            haptics.light();
            router.push('/review' as any);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="flash" size={18} color="#fff" />
          <Text style={styles.ctaText}>立即复习 {stats.due_count} 道</Text>
        </TouchableOpacity>
      )}

      {/* 搜索框 */}
      {courseSummary.length > 0 && (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索课程..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 课程列表 */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ec5b13" />
        </View>
      ) : courseSummary.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>暂无错题，继续保持</Text>
          <Text style={styles.emptyDesc}>完成测评后，错题会按课程自动归档到这里</Text>
        </View>
      ) : filteredCourses.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>没有匹配的课程</Text>
          <Text style={styles.emptyDesc}>试试别的关键词</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCourses}
          keyExtractor={(c) => c.course_id ?? UNCATEGORIZED_SENTINEL}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec5b13" />
          }
          renderItem={({ item }) => (
            <CourseCard
              summary={item}
              onPress={() => {
                haptics.light();
                setTab(item.unmastered_count > 0 ? 'unmastered' : 'mastered');
                setSelectedCourse(item);
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ====================== 课程汇总卡片 ======================

function CourseCard({
  summary,
  onPress,
}: {
  summary: CourseSummary;
  onPress: () => void;
}) {
  const masteryRate =
    summary.total_count > 0
      ? Math.round((summary.mastered_count / summary.total_count) * 100)
      : 0;
  return (
    <TouchableOpacity style={courseCardStyles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={courseCardStyles.header}>
        <View style={courseCardStyles.iconWrap}>
          <Ionicons name="book" size={20} color="#ec5b13" />
        </View>
        <View style={courseCardStyles.titleWrap}>
          <Text style={courseCardStyles.title} numberOfLines={1}>
            {summary.course_name}
          </Text>
          <Text style={courseCardStyles.subtitle}>
            共 {summary.total_count} 题 · 掌握率 {masteryRate}%
          </Text>
        </View>
        {summary.due_count > 0 && (
          <View style={courseCardStyles.dueBadge}>
            <Ionicons name="flash" size={10} color="#ea580c" />
            <Text style={courseCardStyles.dueBadgeText}>{summary.due_count}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
      </View>

      <View style={courseCardStyles.metaRow}>
        <View style={courseCardStyles.metaItem}>
          <View style={[courseCardStyles.dot, { backgroundColor: '#ef4444' }]} />
          <Text style={courseCardStyles.metaText}>未掌握 {summary.unmastered_count}</Text>
        </View>
        <View style={courseCardStyles.metaItem}>
          <View style={[courseCardStyles.dot, { backgroundColor: '#10b981' }]} />
          <Text style={courseCardStyles.metaText}>已掌握 {summary.mastered_count}</Text>
        </View>
        {summary.due_count > 0 && (
          <View style={courseCardStyles.metaItem}>
            <View style={[courseCardStyles.dot, { backgroundColor: '#ea580c' }]} />
            <Text style={[courseCardStyles.metaText, { color: '#ea580c' }]}>
              待复习 {summary.due_count}
            </Text>
          </View>
        )}
      </View>

      {/* 进度条 */}
      <View style={courseCardStyles.progressBar}>
        <View
          style={[
            courseCardStyles.progressFill,
            { width: `${masteryRate}%` },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

// ====================== 错题卡片（详情视图内） ======================

function MistakeCard({ item }: { item: MistakeListItem }) {
  const [expanded, setExpanded] = useState(false);
  const haptics = useHaptics();
  const q = item.question || {};
  const isDue = !item.mastered && item.next_review_at && new Date(item.next_review_at) <= new Date();

  const optionEntries = parseOptions(q.options);
  const correctAnswer = getQuestionCorrectAnswer(q);
  const correctValues = normalizeCorrectAnswer(correctAnswer);
  const correctKeys = correctValues.map(value => pickedToKey(optionEntries, value)).filter(Boolean) as string[];
  const correctAnswerText = formatCorrectAnswer(optionEntries, correctAnswer);
  const correctAnswerEntries = optionEntries.length > 0
    ? correctKeys.map((key) => {
      const entry = optionEntries.find(([entryKey]) => entryKey === key);
      return { key, label: entry?.[1] ?? key };
    })
    : [];
  const explanationText = getQuestionExplanation(q);

  const copyText = async (text: string, label: string) => {
    if (!text.trim()) return;
    try {
      await Clipboard.setStringAsync(text);
      showSuccess(`${label}已复制`);
    } catch (e) {
      showError(e);
    }
  };

  return (
    <TouchableOpacity
      style={cardStyles.card}
      activeOpacity={0.85}
      onPress={() => {
        haptics.light();
        setExpanded(e => !e);
      }}
    >
      <View style={cardStyles.header}>
        <View style={cardStyles.metaRow}>
          {q.difficulty && <Text style={cardStyles.metaTag}>{difficultyLabel(q.difficulty)}</Text>}
          <Text style={cardStyles.metaWrong}>错 {item.wrong_count} 次</Text>
          {item.correct_streak > 0 && !item.mastered && (
            <Text style={cardStyles.metaStreak}>连对 {item.correct_streak}/2</Text>
          )}
        </View>
        {item.mastered && (
          <View style={cardStyles.badge}>
            <Ionicons name="checkmark-circle" size={12} color="#10b981" />
            <Text style={cardStyles.badgeText}>已掌握</Text>
          </View>
        )}
        {isDue && (
          <View style={[cardStyles.badge, { backgroundColor: '#fff5ed' }]}>
            <Ionicons name="flash" size={12} color="#ea580c" />
            <Text style={[cardStyles.badgeText, { color: '#ea580c' }]}>待复习</Text>
          </View>
        )}
      </View>
      <Text style={cardStyles.content} numberOfLines={expanded ? 0 : 3}>
        {q.content || '（题干缺失）'}
      </Text>

      {!expanded && correctAnswerText && (
        <Text style={cardStyles.answer} numberOfLines={1}>
          <Text style={cardStyles.answerLabel}>正解：</Text>
          <Text style={cardStyles.answerText}>{correctAnswerText}</Text>
        </Text>
      )}

      {expanded && (
        <View style={cardStyles.detail}>
          {optionEntries.length > 0 ? (
            <View style={cardStyles.optionsList}>
              {optionEntries.map(([key, label]) => {
                const isCorrect = correctKeys.includes(key);
                return (
                  <View
                    key={key}
                    style={[
                      cardStyles.optionRow,
                      isCorrect && cardStyles.optionRowCorrect,
                    ]}
                  >
                    <Text style={[cardStyles.optionKey, isCorrect && cardStyles.optionKeyCorrect]}>
                      {key}.
                    </Text>
                    <Text
                      style={[cardStyles.optionLabel, isCorrect && cardStyles.optionLabelCorrect]}
                      numberOfLines={3}
                    >
                      {label}
                    </Text>
                    {isCorrect && <Ionicons name="checkmark-circle" size={16} color="#10b981" />}
                  </View>
                );
              })}
            </View>
          ) : null}

          {correctAnswerText && (
            <View style={cardStyles.answerBlock}>
              <View style={cardStyles.blockHeader}>
                <Text style={cardStyles.fillLabel}>正确答案</Text>
                <TouchableOpacity
                  style={cardStyles.copyBtn}
                  activeOpacity={0.8}
                  onPress={() => copyText(correctAnswerText, '正确答案')}
                >
                  <Ionicons name="copy-outline" size={13} color="#2f6fed" />
                  <Text style={cardStyles.copyText}>复制</Text>
                </TouchableOpacity>
              </View>
              {correctAnswerEntries.length > 0 ? (
                <View style={cardStyles.answerOptionList}>
                  {correctAnswerEntries.map((entry) => (
                    <View key={entry.key} style={cardStyles.answerOptionRow}>
                      <Text style={cardStyles.answerOptionKey}>{entry.key}</Text>
                      <Text style={cardStyles.answerOptionText}>{entry.label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={cardStyles.fillValue}>{correctAnswerText}</Text>
              )}
            </View>
          )}

          {explanationText && (
            <View style={cardStyles.explanationBlock}>
              <View style={cardStyles.blockHeader}>
                <Text style={cardStyles.explanationLabel}>解析</Text>
                <TouchableOpacity
                  style={cardStyles.copyBtn}
                  activeOpacity={0.8}
                  onPress={() => copyText(explanationText, '解析')}
                >
                  <Ionicons name="copy-outline" size={13} color="#2f6fed" />
                  <Text style={cardStyles.copyText}>复制</Text>
                </TouchableOpacity>
              </View>
              <Text style={cardStyles.explanationText}>{explanationText}</Text>
            </View>
          )}
        </View>
      )}

      <View style={cardStyles.footer}>
        <Text style={cardStyles.footerHint}>{expanded ? '收起' : '查看答案'}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'eye-outline'} size={14} color="#94a3b8" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f6f6' },
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
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1, textAlign: 'center', paddingHorizontal: 8 },
  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statBlock: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#f1f5f9' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#94a3b8' },
  // CTA
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ec5b13',
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 6,
    minHeight: 48,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    padding: 0,
  },
  // Course detail header sub-stats
  courseDetailStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 4,
    gap: 8,
  },
  courseDetailStatItem: { fontSize: 12, color: '#64748b' },
  courseDetailStatValue: { fontWeight: '600', color: '#0f172a' },
  courseDetailStatDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#cbd5e1' },
  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    minHeight: 44,
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#fff' },
  // Empty / loading
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  // List
  listContent: { padding: 16, paddingBottom: 32 },
});

const courseCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff5ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  subtitle: { fontSize: 11, color: '#94a3b8' },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 2,
  },
  dueBadgeText: { fontSize: 11, fontWeight: '600', color: '#ea580c' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    marginBottom: 10,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  metaText: { fontSize: 12, color: '#64748b' },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, flex: 1 },
  metaTag: {
    fontSize: 11,
    color: '#3b82f6',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  metaWrong: { fontSize: 12, color: '#ef4444' },
  metaStreak: { fontSize: 12, color: '#10b981' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#10b981' },
  content: { fontSize: 14, lineHeight: 20, color: '#0f172a', marginBottom: 8 },
  answer: { fontSize: 12, color: '#64748b' },
  answerLabel: { fontWeight: '600' },
  answerText: { color: '#10b981', fontWeight: '500' },
  detail: { marginTop: 10, gap: 8 },
  optionsList: { gap: 6 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    gap: 8,
  },
  optionRowCorrect: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  optionKey: { fontSize: 13, fontWeight: '600', color: '#475569', minWidth: 20 },
  optionKeyCorrect: { color: '#065f46' },
  optionLabel: { fontSize: 13, flex: 1, color: '#475569', lineHeight: 18 },
  optionLabelCorrect: { color: '#065f46', fontWeight: '500' },
  answerBlock: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  fillAnswer: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  fillLabel: { fontSize: 11, color: '#10b981', fontWeight: '600' },
  fillValue: { fontSize: 14, color: '#065f46', fontWeight: '500', lineHeight: 20 },
  answerOptionList: {
    gap: 8,
  },
  answerOptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  answerOptionKey: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '700',
    fontSize: 12,
  },
  answerOptionText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: '#065f46',
    fontWeight: '500',
    lineHeight: 19,
  },
  copyBtn: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
  },
  copyText: { fontSize: 12, color: '#2f6fed', fontWeight: '600' },
  explanationBlock: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  explanationLabel: { fontSize: 11, fontWeight: '600', color: '#3b82f6', marginBottom: 3 },
  explanationText: { fontSize: 13, lineHeight: 19, color: '#334155' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 4,
  },
  footerHint: { fontSize: 11, color: '#94a3b8' },
});
