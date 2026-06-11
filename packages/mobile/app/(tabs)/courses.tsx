import { useState, useEffect, useMemo, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { useGoBack } from '@/lib/utils/navigation';
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
};

interface Classroom {
  id: string;
  name: string;
  description?: string;
  language_directive?: string;
  tags?: string[];
  created_at: string;
  updated_at?: string;
  progress?: {
    scenes_completed: number;
    total_scenes: number;
    percentage: number;
    status: 'completed' | 'in-progress' | 'not-started';
  };
}

// 状态标签配置 - label will be resolved at render time via t()
const statusConfig = {
  'in-progress': { labelKey: 'courses.statusInProgress', bgColor: iOSColors.accentLight, textColor: iOSColors.accent },
  'completed': { labelKey: 'courses.statusCompleted', bgColor: iOSColors.secondaryLight, textColor: iOSColors.secondary },
  'not-started': { labelKey: 'courses.statusNotStarted', bgColor: 'rgba(230, 225, 220, 0.4)', textColor: iOSColors.muted },
};

export default function CoursesScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const goBack = useGoBack();
  const { onPress } = useFeedback();
  const haptics = useHaptics();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 筛选状态
  const [activeFilter, setActiveFilter] = useState('all');

  // 视图模式（列表/网格）- 平板默认网格
  const { breakpoint, isTablet } = useResponsiveDimensions();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(isTablet ? 'grid' : 'list');

  // 响应式尺寸
  const cardThumbSize = responsiveValue({ compact: 56, regular: 64, medium: 72, large: 80 }, breakpoint);

  useEffect(() => {
    loadClassrooms();
  }, []);

  // 筛选课程（基于真实进度数据）
  const filteredClassrooms = useMemo(() => {
    if (activeFilter === 'all') return classrooms;
    return classrooms.filter(c => {
      const status = c.progress?.status || 'not-started';
      if (activeFilter === 'progress') return status === 'in-progress';
      if (activeFilter === 'completed') return status === 'completed';
      if (activeFilter === 'notstarted') return status === 'not-started';
      return true;
    });
  }, [classrooms, activeFilter]);

  // 统计各状态数量（基于真实数据）
  const courseStats = useMemo(() => {
    const inProgress = classrooms.filter(c => (c.progress?.status || 'not-started') === 'in-progress').length;
    const completed = classrooms.filter(c => c.progress?.status === 'completed').length;
    const notStarted = classrooms.filter(c => (c.progress?.status || 'not-started') === 'not-started').length;
    return { total: classrooms.length, inProgress, completed, notStarted };
  }, [classrooms]);

  const loadClassrooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getClassrooms();
      setClassrooms(data);
    } catch (err: any) {
      setError(err.message || t('courses.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
  };

  // 获取缩略图颜色（根据索引循环）
  const getThumbColor = (index: number) => {
    const colors = ['coral', 'mint', 'gold', 'blue', 'purple'];
    return colors[index % colors.length];
  };

  // 获取缩略图颜色（根据索引循环）
  function CourseCard({ classroom, index, mode }: { classroom: Classroom; index: number; mode: 'list' | 'grid' }) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const thumbColor = getThumbColor(index);

    // 使用真实进度数据
    const progress = classroom.progress?.percentage ?? 0;
    const status = classroom.progress?.status ?? 'not-started';

    const totalSections = classroom.progress?.total_scenes ?? 0;
    const completedSections = classroom.progress?.scenes_completed ?? 0;

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
      // 网格模式 - 卡片式布局
      return (
        <TouchableOpacity
          style={styles.gridCardWrapper}
          onPress={() => router.push(`/course/${classroom.id}` as any)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          accessibilityLabel={t('accessibility.courseProgressLabel', { name: classroom.name, status: t(statusInfo.labelKey), percent: progress })}
          accessibilityHint={t('accessibility.tapToViewCourse')}
          accessibilityRole="button"
        >
          <Animated.View style={[styles.gridCard, { transform: [{ scale: scaleAnim }] }]}>
            {/* 缩略图 */}
            <View style={[styles.gridThumb, { backgroundColor: thumbColor === 'coral' ? '#f45a1a' : thumbColor === 'mint' ? '#14b8a6' : thumbColor === 'gold' ? '#f59e0b' : thumbColor === 'blue' ? '#2563eb' : '#8b5cf6' }]}>
              <Text style={styles.gridThumbIcon}>
                {thumbColor === 'coral' ? '📊' : thumbColor === 'mint' ? '💻' : thumbColor === 'gold' ? '📈' : thumbColor === 'blue' ? '🧮' : '🎨'}
              </Text>
            </View>
            {/* 课程信息 */}
            <Text style={styles.gridName} numberOfLines={2}>{classroom.name}</Text>
            <Text style={styles.gridCat}>{classroom.description ? classroom.description.slice(0, 20) : `${totalSections} ${t('courses.sectionsCount', { count: totalSections })}`}</Text>
            <View style={styles.gridProgress}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.gridPct}>{progress}%</Text>
            </View>
            <View style={[styles.gridStatus, { backgroundColor: statusInfo.bgColor }]}>
              <Text style={[styles.gridStatusText, { color: statusInfo.textColor }]}>
                {t(statusInfo.labelKey)}
              </Text>
            </View>
          </Animated.View>
        </TouchableOpacity>
      );
    }

    // 列表模式
    return (
      <TouchableOpacity
        onPress={() => router.push(`/course/${classroom.id}` as any)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        accessibilityLabel={t('accessibility.courseProgressLabel', { name: classroom.name, status: t(statusInfo.labelKey), percent: progress })}
        accessibilityHint={t('accessibility.tapToViewCourse')}
        accessibilityRole="button"
      >
        <Animated.View style={[styles.courseCard, { transform: [{ scale: scaleAnim }] }]}>
          {/* 缩略图 */}
          <View style={[styles.courseThumb, { width: cardThumbSize, height: cardThumbSize, backgroundColor: thumbColor === 'coral' ? '#f45a1a' : thumbColor === 'mint' ? '#14b8a6' : thumbColor === 'gold' ? '#f59e0b' : thumbColor === 'blue' ? '#2563eb' : '#8b5cf6' }]}>
            <Text style={styles.courseThumbIcon}>
              {thumbColor === 'coral' ? '📊' : thumbColor === 'mint' ? '💻' : thumbColor === 'gold' ? '📈' : thumbColor === 'blue' ? '🧮' : '🎨'}
            </Text>
            {/* Overlay */}
            <View style={styles.courseThumbOverlay}>
              {status === 'completed' ? (
                <Text style={styles.courseThumbOverlayText}>✓</Text>
              ) : (
                <Text style={styles.courseThumbOverlayText}>{completedSections}/{totalSections}</Text>
              )}
            </View>
          </View>

          {/* 课程信息 */}
          <View style={styles.courseBody}>
            <View style={styles.courseTop}>
              <Text style={styles.courseName} numberOfLines={1}>{classroom.name}</Text>
              <Text style={styles.courseCat}>{t('courses.sectionsCount', { count: totalSections })}</Text>
            </View>
            <View style={styles.courseBottom}>
              <Text style={styles.courseTime}>{formatDate(classroom.created_at)}</Text>
              <View style={styles.courseProgress}>
                <View style={styles.progressTrack}>
                  <View style={[
                    styles.progressFill,
                    { width: `${progress}%` },
                    status === 'completed' && styles.progressFillComplete
                  ]} />
                </View>
                <Text style={styles.progressPct}>{progress}%</Text>
              </View>
              <View style={[styles.courseStatus, { backgroundColor: statusInfo.bgColor }]}>
                <Text style={[styles.courseStatusText, { color: statusInfo.textColor }]}>
                  {t(statusInfo.labelKey)}
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
        <ActivityIndicator size="large" color={iOSColors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center} accessibilityRole="text" accessibilityLabel={t('accessibility.error')}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" accessibilityRole="image" accessibilityLabel={t('accessibility.errorIcon')} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={loadClassrooms}
          accessibilityLabel={t('common.retry')}
          accessibilityHint={t('accessibility.errorHint')}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>{t('courses.retry')}</Text>
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
          onPress={() => goBack()}
          activeOpacity={0.7}
          accessibilityLabel={t('accessibility.backButton')}
          accessibilityHint={t('accessibility.backButtonHint')}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={20} color={iOSColors.fg} accessibilityRole="image" accessibilityLabel={t('accessibility.backArrowIcon')} />
        </TouchableOpacity>
        <Text style={styles.pageTitle} accessibilityRole="header">{t('courses.pageTitle')}</Text>
        <View style={styles.pageHeaderActions}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => {
              haptics.light();
              onPress();
              // 后续添加搜索功能
            }}
            activeOpacity={0.7}
            accessibilityLabel={t('accessibility.searchButton')}
            accessibilityHint={t('accessibility.searchButtonHint')}
            accessibilityRole="button"
          >
            <Ionicons name="search-outline" size={18} color={iOSColors.muted} accessibilityRole="image" accessibilityLabel={t('accessibility.searchIcon')} />
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
          accessibilityLabel={t('accessibility.filterAll')}
          accessibilityHint={t('accessibility.filterHint', { status: t('accessibility.filterAll') })}
          accessibilityRole="button"
          accessibilityState={{ selected: activeFilter === 'all' }}
        >
          <Text style={[styles.filterTabText, activeFilter === 'all' && styles.filterTabTextActive]}>
            {t('courses.filterAll')} <Text style={{ opacity: 0.6 }}>({courseStats.total})</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'progress' && styles.filterTabActive]}
          onPress={() => {
            haptics.light();
            setActiveFilter('progress');
          }}
          activeOpacity={0.7}
          accessibilityLabel={t('accessibility.filterInProgress')}
          accessibilityHint={t('accessibility.filterHint', { status: t('accessibility.filterInProgress') })}
          accessibilityRole="button"
          accessibilityState={{ selected: activeFilter === 'progress' }}
        >
          <Text style={[styles.filterTabText, activeFilter === 'progress' && styles.filterTabTextActive]}>
            {t('courses.filterInProgress')} <Text style={{ opacity: 0.6 }}>({courseStats.inProgress})</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'completed' && styles.filterTabActive]}
          onPress={() => {
            haptics.light();
            setActiveFilter('completed');
          }}
          activeOpacity={0.7}
          accessibilityLabel={t('accessibility.filterCompleted')}
          accessibilityHint={t('accessibility.filterHint', { status: t('accessibility.filterCompleted') })}
          accessibilityRole="button"
          accessibilityState={{ selected: activeFilter === 'completed' }}
        >
          <Text style={[styles.filterTabText, activeFilter === 'completed' && styles.filterTabTextActive]}>
            {t('courses.filterCompleted')} <Text style={{ opacity: 0.6 }}>({courseStats.completed})</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'notstarted' && styles.filterTabActive]}
          onPress={() => {
            haptics.light();
            setActiveFilter('notstarted');
          }}
          activeOpacity={0.7}
          accessibilityLabel={t('accessibility.filterNotStarted')}
          accessibilityHint={t('accessibility.filterHint', { status: t('accessibility.filterNotStarted') })}
          accessibilityRole="button"
          accessibilityState={{ selected: activeFilter === 'notstarted' }}
        >
          <Text style={[styles.filterTabText, activeFilter === 'notstarted' && styles.filterTabTextActive]}>
            {t('courses.filterNotStarted')} <Text style={{ opacity: 0.6 }}>({courseStats.notStarted})</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* 排序栏 */}
      <View style={styles.sortBar}>
        <Text style={styles.courseCount} accessibilityRole="text">{t('courses.courseCount', { count: filteredClassrooms.length })}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          {/* 视图切换按钮 - 仅平板显示 */}
          {isTablet && (
            <View style={{ flexDirection: 'row', gap: 4, backgroundColor: iOSColors.surface, borderRadius: 8, padding: 2 }} accessibilityRole="tablist">
              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
                onPress={() => setViewMode('list')}
                accessibilityLabel={t('accessibility.viewModeList')}
                accessibilityHint={t('accessibility.viewModeHint', { mode: t('accessibility.viewModeList') })}
                accessibilityRole="button"
                accessibilityState={{ selected: viewMode === 'list' }}
              >
                <Ionicons name="list" size={16} color={viewMode === 'list' ? iOSColors.accent : iOSColors.muted} accessibilityRole="image" accessibilityLabel={t('accessibility.listIcon')} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === 'grid' && styles.viewModeBtnActive]}
                onPress={() => setViewMode('grid')}
                accessibilityLabel={t('accessibility.viewModeGrid')}
                accessibilityHint={t('accessibility.viewModeHint', { mode: t('accessibility.viewModeGrid') })}
                accessibilityRole="button"
                accessibilityState={{ selected: viewMode === 'grid' }}
              >
                <Ionicons name="grid" size={16} color={viewMode === 'grid' ? iOSColors.accent : iOSColors.muted} accessibilityRole="image" accessibilityLabel={t('accessibility.gridIcon')} />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => {
              haptics.light();
              onPress();
              // 后续添加排序功能
            }}
            activeOpacity={0.7}
            accessibilityLabel={t('courses.sortLabel')}
            accessibilityHint={t('courses.sortRecentUpdateHint')}
            accessibilityRole="button"
          >
            <Text style={styles.sortBtnText}>{t('courses.sortRecentUpdate')}</Text>
            <Ionicons name="chevron-down" size={14} color={iOSColors.muted} accessibilityRole="image" accessibilityLabel={t('accessibility.dropdownArrow')} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 课程列表 */}
      <FlatList
        data={filteredClassrooms}
        keyExtractor={(item) => item.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode} // Force re-render when view mode changes
        renderItem={({ item, index }) => <CourseCard classroom={item} index={index} mode={viewMode} />}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        // 性能优化
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyState} accessibilityRole="text" accessibilityLabel={t('accessibility.empty')}>
            <View style={styles.emptyIcon} accessibilityRole="image" accessibilityLabel={t('accessibility.emptyFolderIcon')}>
              <Ionicons name="folder-open-outline" size={28} color={iOSColors.accent} />
            </View>
            <Text style={styles.emptyTitle}>{t('courses.emptyTitle')}</Text>
            <Text style={styles.emptyDesc}>{t('courses.emptyDesc')}</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadClassrooms} colors={[Colors.primary.main]} tintColor={Colors.primary.main} />}
        contentContainerStyle={styles.courseList}
        showsVerticalScrollIndicator={false}
      />
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
    backgroundColor: iOSColors.accent,
    borderColor: iOSColors.accent,
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
  courseCount: {
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

  // 课程列表
  courseList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },

  // 课程卡片
  courseCard: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  courseThumb: {
    width: 64,
    height: 64,
    borderRadius: Rounded.sm,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  courseThumbIcon: {
    fontSize: 24,
  },
  courseThumbOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  courseThumbOverlayText: {
    fontSize: 9,
    fontWeight: '700',
    color: iOSColors.fg,
  },
  courseBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  courseTop: {
    gap: 3,
  },
  courseName: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.fg,
    letterSpacing: -0.1,
  },
  courseCat: {
    fontSize: 11,
    color: iOSColors.muted,
  },
  courseBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 4,
  },
  courseTime: {
    fontSize: 10,
    color: iOSColors.muted,
    opacity: 0.7,
  },
  courseProgress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: iOSColors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: iOSColors.accent,
    borderRadius: 2,
  },
  progressFillComplete: {
    backgroundColor: iOSColors.secondary,
  },
  progressPct: {
    fontSize: 11,
    color: iOSColors.muted,
    minWidth: 32,
    textAlign: 'right',
  },
  courseStatus: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  courseStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // 视图切换
  viewModeBtn: {
    padding: 6,
    borderRadius: 6,
  },
  viewModeBtnActive: {
    backgroundColor: iOSColors.accentLight,
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
  },
  gridThumbIcon: {
    fontSize: 28,
  },
  gridName: {
    fontSize: 13,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: 2,
  },
  gridCat: {
    fontSize: 11,
    color: iOSColors.muted,
    marginBottom: Spacing.xs,
  },
  gridProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  gridPct: {
    fontSize: 10,
    color: iOSColors.muted,
  },
  gridStatus: {
    alignSelf: 'flex-start',
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
    backgroundColor: iOSColors.accentLight,
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
    backgroundColor: iOSColors.accent,
    borderRadius: Rounded.sm,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
