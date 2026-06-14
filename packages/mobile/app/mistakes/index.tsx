/**
 * 我的错题本
 *
 * UX 设计：
 * - 顶部：迷你看板（总/掌握/待复习/掌握率）
 * - Tab 切换：未掌握 / 已掌握
 * - 列表：每张卡片显示题目+错误次数+状态徽章
 * - 主 CTA：去复习（仅未掌握>0 时）
 *
 * 移动端适配：
 * - safe-area top 边
 * - Tab bar 横向滑动友好（44pt 触控区）
 * - FlatList 长列表性能
 * - 空态友好
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiClient } from '@/lib/api-client';
import { showError } from '@/lib/utils/error-toast';
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

type Tab = 'unmastered' | 'mastered';

export default function MistakeBookScreen() {
  const router = useRouter();
  const haptics = useHaptics();

  const [tab, setTab] = useState<Tab>('unmastered');
  const [stats, setStats] = useState({ total: 0, mastered_count: 0, due_count: 0 });
  const [items, setItems] = useState<MistakeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [statsData, listData] = await Promise.all([
        apiClient.getMistakeStats(),
        apiClient.getMistakeList({ only_unmastered: tab === 'unmastered', limit: 100 }),
      ]);
      setStats(statsData);
      setItems(listData.items);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(false);
  };

  const masteryRate = stats.total > 0 ? Math.round((stats.mastered_count / stats.total) * 100) : 0;

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
            未掌握 {stats.total - stats.mastered_count > 0 ? `· ${stats.total - stats.mastered_count}` : ''}
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
            已掌握 {stats.mastered_count > 0 ? `· ${stats.mastered_count}` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ec5b13" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>{tab === 'mastered' ? '🌟' : '🎉'}</Text>
          <Text style={styles.emptyTitle}>
            {tab === 'mastered' ? '还没有掌握的题目' : '暂无错题，继续保持'}
          </Text>
          <Text style={styles.emptyDesc}>
            {tab === 'mastered' ? '连续答对 2 次，题目就会出现在这里' : '完成测评后，错题会自动出现在这里'}
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

function MistakeCard({ item }: { item: MistakeListItem }) {
  const [expanded, setExpanded] = useState(false);
  const haptics = useHaptics();
  const q = item.question || {};
  const isDue = !item.mastered && item.next_review_at && new Date(item.next_review_at) <= new Date();

  const optionEntries = parseOptions(q.options);
  const correctKey = pickedToKey(optionEntries, q.correct_answer);
  const correctLabel = optionEntries.find(([k]) => k === correctKey)?.[1] ?? q.correct_answer ?? '';

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

      {/* 折叠态：正解一行提示 */}
      {!expanded && correctLabel && (
        <Text style={cardStyles.answer} numberOfLines={1}>
          <Text style={cardStyles.answerLabel}>正解：</Text>
          <Text style={cardStyles.answerText}>
            {correctKey ? `${correctKey}. ` : ''}{correctLabel}
          </Text>
        </Text>
      )}

      {/* 展开态：完整选项 + 解析 */}
      {expanded && (
        <View style={cardStyles.detail}>
          {optionEntries.length > 0 ? (
            <View style={cardStyles.optionsList}>
              {optionEntries.map(([key, label]) => {
                const isCorrect = key === correctKey;
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
          ) : correctLabel ? (
            <View style={cardStyles.fillAnswer}>
              <Text style={cardStyles.fillLabel}>正确答案</Text>
              <Text style={cardStyles.fillValue}>{correctLabel}</Text>
            </View>
          ) : null}
          {q.explanation && (
            <View style={cardStyles.explanationBlock}>
              <Text style={cardStyles.explanationLabel}>解析</Text>
              <Text style={cardStyles.explanationText}>{q.explanation}</Text>
            </View>
          )}
        </View>
      )}

      {/* 展开/收起 hint */}
      <View style={cardStyles.footer}>
        <Text style={cardStyles.footerHint}>{expanded ? '收起' : '展开详情'}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#94a3b8" />
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
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
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
  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
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
  fillAnswer: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  fillLabel: { fontSize: 11, color: '#10b981', fontWeight: '600', marginBottom: 2 },
  fillValue: { fontSize: 14, color: '#065f46', fontWeight: '500' },
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
