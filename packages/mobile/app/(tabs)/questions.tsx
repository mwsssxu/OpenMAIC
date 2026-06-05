import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from 'react-native';
import { USE_NATIVE_DRIVER } from '@/lib/configs/animation';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Rounded, Spacing, Colors } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useHaptics } from '@/lib/hooks/use-haptics';
import TabPageWrapper from '@/lib/components/TabPageWrapper';
import { useResponsiveDimensions, responsiveValue } from '@/lib/utils/responsive';
import { useI18n } from '@/lib/i18n';

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
  secondary: '#1a8a8a',
  secondaryLight: '#e8f5f5',
  questions: '#8b5cf6', // 紫色主题
  questionsLight: '#f3e8ff',
};

interface Question {
  id: string;
  user_id: string;
  user_nickname: string;
  title: string;
  content: string;
  bounty: number;
  bounty_status: string;
  tags: string;
  view_count: number;
  answer_count: number;
  has_accepted: boolean;
  created_at: string;
}

// 状态标签配置
const statusConfig = {
  'unanswered': { label: '待回答', bgColor: iOSColors.accentLight, textColor: iOSColors.accent },
  'answered': { label: '已回答', bgColor: iOSColors.secondaryLight, textColor: iOSColors.secondary },
  'resolved': { label: '已解决', bgColor: '#dcfce7', textColor: '#16a34a' },
};

export default function QuestionsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { onPress } = useFeedback();
  const haptics = useHaptics();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 筛选状态
  const [activeFilter, setActiveFilter] = useState('all');

  // 排序状态
  const [sort, setSort] = useState('recent');

  // 视图模式（列表/网格）- 平板默认网格
  const { breakpoint, isTablet } = useResponsiveDimensions();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(isTablet ? 'grid' : 'list');

  // 响应式尺寸
  const cardThumbSize = responsiveValue({ compact: 56, regular: 64, medium: 72, large: 80 }, breakpoint);

  // 页面获得焦点时刷新数据
  useFocusEffect(
    useCallback(() => {
      loadQuestions();
    }, [sort])
  );

  useEffect(() => {
    loadQuestions();
  }, [sort]);

  // 筛选问题
  const filteredQuestions = useMemo(() => {
    if (activeFilter === 'all') return questions;

    // 根据回答数筛选
    return questions.filter((q) => {
      if (activeFilter === 'unanswered') return q.answer_count === 0;
      if (activeFilter === 'answered') return q.answer_count > 0;
      if (activeFilter === 'bounty') return q.bounty > 0;
      return true;
    });
  }, [questions, activeFilter]);

  // 统计各状态数量
  const questionStats = useMemo(() => {
    const total = questions.length;
    const unanswered = questions.filter(q => q.answer_count === 0).length;
    const answered = questions.filter(q => q.answer_count > 0).length;
    const bounty = questions.filter(q => q.bounty > 0).length;
    return { total, unanswered, answered, bounty };
  }, [questions]);

  const loadQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getQuestions(1, 20, sort);
      setQuestions(data.items || []);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
  };

  // 相对时间
  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return '刚刚';
    if (diffHours < 24) return `${diffHours}小时前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}天前`;
    return formatDate(dateStr);
  };

  // 获取缩略图颜色（根据索引循环）
  const getThumbColor = (index: number) => {
    const colors = ['purple', 'blue', 'teal', 'amber', 'rose'];
    return colors[index % colors.length];
  };

  // 问题状态缓存
  const questionStatusCacheRef = useRef<Record<string, string>>({});

  // 获取问题状态
  function getQuestionStatus(question: Question) {
    if (!questionStatusCacheRef.current[question.id]) {
      questionStatusCacheRef.current[question.id] = question.answer_count === 0 ? 'unanswered' : 'answered';
    }
    return questionStatusCacheRef.current[question.id];
  }

  // 解析标签
  const parseTags = (tagsStr: string) => {
    if (!tagsStr) return [];
    try {
      return JSON.parse(tagsStr);
    } catch {
      return tagsStr.split(',').filter(t => t.trim());
    }
  };

  // 问题卡片组件
  function QuestionCard({ question, index, mode }: { question: Question; index: number; mode: 'list' | 'grid' }) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const thumbColor = getThumbColor(index);
    const status = getQuestionStatus(question);
    const tags = parseTags(question.tags);
    const statusInfo = statusConfig[status as keyof typeof statusConfig];

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    };

    if (mode === 'grid') {
      // 网格模式
      return (
        <TouchableOpacity
          style={styles.gridCardWrapper}
          onPress={() => router.push(`/questions/${question.id}` as any)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
        >
          <Animated.View style={[styles.gridCard, { transform: [{ scale: scaleAnim }] }]}>
            {/* 缩略图 */}
            <View style={[
              styles.gridThumb,
              {
                backgroundColor: thumbColor === 'purple' ? '#8b5cf6' :
                  thumbColor === 'blue' ? '#2563eb' :
                  thumbColor === 'teal' ? '#14b8a6' :
                  thumbColor === 'amber' ? '#f59e0b' : '#f43f5e'
              }
            ]}>
              <Text style={styles.gridThumbIcon}>
                {thumbColor === 'purple' ? '❓' :
                  thumbColor === 'blue' ? '💡' :
                  thumbColor === 'teal' ? '🎓' :
                  thumbColor === 'amber' ? '⚡' : '🔥'}
              </Text>
            </View>

            {/* 悬赏徽章 */}
            {question.bounty > 0 && (
              <View style={styles.gridBountyBadge}>
                <Ionicons name="diamond" size={12} color={iOSColors.questions} />
                <Text style={styles.gridBountyText}>{question.bounty}</Text>
              </View>
            )}

            {/* 问题信息 */}
            <Text style={styles.gridTitle} numberOfLines={2}>{question.title}</Text>
            <Text style={styles.gridContent} numberOfLines={2}>{question.content}</Text>

            {/* 标签 */}
            {tags.length > 0 && (
              <View style={styles.gridTags}>
                {tags.slice(0, 2).map((tag: string, i: number) => (
                  <View key={i} style={styles.gridTag}>
                    <Text style={styles.gridTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 底部信息 */}
            <View style={styles.gridFooter}>
              <View style={styles.gridMeta}>
                <Ionicons name="chatbubble-outline" size={12} color={iOSColors.muted} />
                <Text style={styles.gridMetaText}>{question.answer_count}</Text>
                <Ionicons name="eye-outline" size={12} color={iOSColors.muted} style={{ marginLeft: 8 }} />
                <Text style={styles.gridMetaText}>{question.view_count}</Text>
              </View>
              <View style={[styles.gridStatus, { backgroundColor: statusInfo.bgColor }]}>
                <Text style={[styles.gridStatusText, { color: statusInfo.textColor }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>
          </Animated.View>
        </TouchableOpacity>
      );
    }

    // 列表模式
    return (
      <TouchableOpacity
        onPress={() => router.push(`/questions/${question.id}` as any)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <Animated.View style={[styles.questionCard, { transform: [{ scale: scaleAnim }] }]}>
          {/* 缩略图 */}
          <View style={[
            styles.questionThumb,
            {
              width: cardThumbSize,
              height: cardThumbSize,
              backgroundColor: thumbColor === 'purple' ? '#8b5cf6' :
                thumbColor === 'blue' ? '#2563eb' :
                thumbColor === 'teal' ? '#14b8a6' :
                thumbColor === 'amber' ? '#f59e0b' : '#f43f5e'
            }
          ]}>
            <Text style={styles.questionThumbIcon}>
              {thumbColor === 'purple' ? '❓' :
                thumbColor === 'blue' ? '💡' :
                thumbColor === 'teal' ? '🎓' :
                thumbColor === 'amber' ? '⚡' : '🔥'}
            </Text>
            {/* 悬赏徽章 */}
            {question.bounty > 0 && (
              <View style={styles.thumbBountyBadge}>
                <Ionicons name="diamond" size={8} color="#fff" />
              </View>
            )}
          </View>

          {/* 问题信息 */}
          <View style={styles.questionBody}>
            <View style={styles.questionTop}>
              <Text style={styles.questionTitle} numberOfLines={1}>{question.title}</Text>
              {question.bounty > 0 && (
                <View style={styles.bountyBadge}>
                  <Ionicons name="diamond" size={10} color={iOSColors.questions} />
                  <Text style={styles.bountyText}>{question.bounty}</Text>
                </View>
              )}
            </View>

            <Text style={styles.questionContent} numberOfLines={1}>{question.content}</Text>

            {/* 标签 */}
            {tags.length > 0 && (
              <View style={styles.tagRow}>
                {tags.slice(0, 3).map((tag: string, i: number) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.questionBottom}>
              <View style={styles.metaRow}>
                <Ionicons name="chatbubble-outline" size={12} color={iOSColors.muted} />
                <Text style={styles.metaText}>{question.answer_count}</Text>
                <Ionicons name="eye-outline" size={12} color={iOSColors.muted} style={{ marginLeft: 8 }} />
                <Text style={styles.metaText}>{question.view_count}</Text>
                <Text style={styles.timeText}>{getRelativeTime(question.created_at)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                <Text style={[styles.statusText, { color: statusInfo.textColor }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.center} accessibilityRole="text" accessibilityLabel={t('accessibility.loading')}>
        <ActivityIndicator size="large" color={iOSColors.questions} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center} accessibilityRole="text" accessibilityLabel={t('accessibility.error')}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={loadQuestions}
          accessibilityLabel={t('common.retry')}
        >
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
        {/* 页面头部 */}
        <View style={styles.pageHeader}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.push('/(tabs)' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>问答悬赏</Text>
          <View style={styles.pageHeaderActions}>
            <TouchableOpacity
              style={styles.headerAction}
              onPress={() => {
                haptics.light();
                onPress();
                // 后续添加搜索功能
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={18} color={iOSColors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 筛选标签 */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]}
            onPress={() => {
              haptics.light();
              setActiveFilter('all');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, activeFilter === 'all' && styles.filterTabTextActive]}>
              全部 <Text style={{ opacity: 0.6 }}>({questionStats.total})</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'unanswered' && styles.filterTabActive]}
            onPress={() => {
              haptics.light();
              setActiveFilter('unanswered');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, activeFilter === 'unanswered' && styles.filterTabTextActive]}>
              待回答 <Text style={{ opacity: 0.6 }}>({questionStats.unanswered})</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'answered' && styles.filterTabActive]}
            onPress={() => {
              haptics.light();
              setActiveFilter('answered');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, activeFilter === 'answered' && styles.filterTabTextActive]}>
              已回答 <Text style={{ opacity: 0.6 }}>({questionStats.answered})</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'bounty' && styles.filterTabActive]}
            onPress={() => {
              haptics.light();
              setActiveFilter('bounty');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, activeFilter === 'bounty' && styles.filterTabTextActive]}>
              有悬赏 <Text style={{ opacity: 0.6 }}>({questionStats.bounty})</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* 排序栏 */}
        <View style={styles.sortBar}>
          <Text style={styles.questionCount}>共 {filteredQuestions.length} 个问题</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            {/* 视图切换按钮 - 仅平板显示 */}
            {isTablet && (
              <View style={{ flexDirection: 'row', gap: 4, backgroundColor: iOSColors.surface, borderRadius: 8, padding: 2 }}>
                <TouchableOpacity
                  style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
                  onPress={() => setViewMode('list')}
                >
                  <Ionicons name="list" size={16} color={viewMode === 'list' ? iOSColors.questions : iOSColors.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewModeBtn, viewMode === 'grid' && styles.viewModeBtnActive]}
                  onPress={() => setViewMode('grid')}
                >
                  <Ionicons name="grid" size={16} color={viewMode === 'grid' ? iOSColors.questions : iOSColors.muted} />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={styles.sortBtn}
              onPress={() => {
                haptics.light();
                // 切换排序
                const sorts = ['recent', 'bounty', 'hot'];
                const currentIndex = sorts.indexOf(sort);
                const nextSort = sorts[(currentIndex + 1) % sorts.length];
                setSort(nextSort);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.sortBtnText}>
                {sort === 'recent' ? '最新发布' : sort === 'bounty' ? '最高悬赏' : '最热门'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={iOSColors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 问题列表 */}
        <FlatList
          data={filteredQuestions}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode}
          renderItem={({ item, index }) => <QuestionCard question={item} index={index} mode={viewMode} />}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="help-circle-outline" size={28} color={iOSColors.questions} />
              </View>
              <Text style={styles.emptyTitle}>暂无问题</Text>
              <Text style={styles.emptyDesc}>点击下方按钮发布你的第一个问题</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadQuestions}
              colors={[iOSColors.questions]}
              tintColor={iOSColors.questions}
            />
          }
          contentContainerStyle={styles.questionList}
          showsVerticalScrollIndicator={false}
        />

        {/* 发布问题 FAB */}
        <TouchableOpacity
          style={styles.fabContainer}
          onPress={() => {
            haptics.medium();
            router.push('/questions/create' as any);
          }}
          activeOpacity={0.9}
        >
          <Animated.View style={[styles.fab, { backgroundColor: iOSColors.questions }]}>
            <Ionicons name="add" size={28} color={Colors.neutral.white} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </TabPageWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
  },

  // 页面头部
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: iOSColors.fg,
    letterSpacing: -0.3,
    flex: 1,
  },
  pageHeaderActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },

  // 筛选标签
  filterTabs: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    backgroundColor: iOSColors.surface,
  },
  filterTabActive: {
    backgroundColor: iOSColors.questions,
    borderColor: iOSColors.questions,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: iOSColors.muted,
  },
  filterTabTextActive: {
    color: '#fff',
  },

  // 排序栏
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  questionCount: {
    fontSize: 12,
    color: iOSColors.muted,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  sortBtnText: {
    fontSize: 12,
    color: iOSColors.muted,
  },

  // 视图切换
  viewModeBtn: {
    padding: 6,
    borderRadius: 6,
  },
  viewModeBtnActive: {
    backgroundColor: iOSColors.questionsLight,
  },

  // 问题列表
  questionList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl + 16,
    gap: Spacing.sm,
  },

  // 问题卡片 - 列表模式
  questionCard: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  questionThumb: {
    borderRadius: Rounded.sm,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  questionThumbIcon: {
    fontSize: 24,
  },
  thumbBountyBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: iOSColors.questions,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  questionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  questionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.fg,
    flex: 1,
    letterSpacing: -0.1,
  },
  bountyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: iOSColors.questionsLight,
  },
  bountyText: {
    fontSize: 10,
    fontWeight: '600',
    color: iOSColors.questions,
    marginLeft: 2,
  },
  questionContent: {
    fontSize: 12,
    color: iOSColors.muted,
    marginTop: 2,
  },

  // 标签
  tagRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  tag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  tagText: {
    fontSize: 10,
    color: iOSColors.questions,
  },

  questionBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 10,
    color: iOSColors.muted,
    marginLeft: 2,
  },
  timeText: {
    fontSize: 10,
    color: iOSColors.muted,
    marginLeft: 8,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // 网格模式
  gridRow: {
    gap: Spacing.sm,
  },
  gridCardWrapper: {
    flex: 1,
  },
  gridCard: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
  },
  gridThumb: {
    width: '100%',
    height: 80,
    borderRadius: Rounded.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    position: 'relative',
  },
  gridThumbIcon: {
    fontSize: 28,
  },
  gridBountyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  gridBountyText: {
    fontSize: 10,
    fontWeight: '600',
    color: iOSColors.questions,
    marginLeft: 2,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: 2,
  },
  gridContent: {
    fontSize: 11,
    color: iOSColors.muted,
    marginBottom: Spacing.xs,
  },
  gridTags: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  gridTag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  gridTagText: {
    fontSize: 9,
    color: iOSColors.questions,
  },
  gridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridMetaText: {
    fontSize: 10,
    color: iOSColors.muted,
    marginLeft: 2,
  },
  gridStatus: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  gridStatusText: {
    fontSize: 9,
    fontWeight: '600',
  },

  // 空状态
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: iOSColors.bgSolid,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: iOSColors.questionsLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: iOSColors.muted,
    lineHeight: 20,
  },

  // 错误状态
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginTop: 10,
  },
  retryBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: iOSColors.questions,
    borderRadius: Rounded.sm,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // FAB
  fabContainer: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: iOSColors.questions,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
