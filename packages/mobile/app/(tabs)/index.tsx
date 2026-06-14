import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Modal } from 'react-native';
import { USE_NATIVE_DRIVER } from '@/lib/configs/animation';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { useRef, useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import TabPageWrapper from '@/lib/components/TabPageWrapper';
import { ResponsiveGrid } from '@/lib/components/ResponsiveGrid';
import { useResponsiveDimensions, responsiveValue } from '@/lib/utils/responsive';
import { apiClient, UserStats } from '@/lib/api-client';
import { showError } from '@/lib/utils/error-toast';

// iOS 风格颜色系统 - 与静态页一致
const iOSColors = {
  bg: 'transparent',
  bgSolid: '#f5f3f2',
  surface: 'rgba(255, 255, 255, 0.55)', // 半透明白色，与静态页 --surface 一致
  surfaceSolid: '#FFFFFF',
  fg: '#1a1a1a',
  muted: '#666666',
  border: 'rgba(230, 225, 220, 0.6)',
  accent: '#c45a1a',
  accentLight: '#fde8e0',
  secondary: '#1a8a8a',
  secondaryLight: '#e8f5f5',
  // Streak 渐变颜色（静态页 oklch 转换）
  streakGradientStart: '#b85a1a', // oklch(55% 0.14 35)
  streakGradientEnd: '#a84817', // oklch(50% 0.12 40)
};

// 快捷功能配置（10个）- 教学优先+社交核心
const quickFunctions = [
  { key: 'courses', titleKey: 'home.myCourses', icon: 'book', color: '#f45a1a', bgColor: '#fce8e0', route: '/courses' },
  { key: 'buddy', titleKey: 'home.studyBuddy', icon: 'chatbubbles', color: '#8b5cf6', bgColor: '#ede9fe', route: '/buddy' },
  { key: 'review', titleKey: 'home.mistakeReview', icon: 'refresh-circle', color: '#ef4444', bgColor: '#fef2f2', route: '/review' },
  { key: 'qa', titleKey: 'home.qaBounty', icon: 'help-circle', color: '#d97706', bgColor: '#fef3c7', route: '/questions' },
  { key: 'notes', titleKey: 'home.sharedNotes', icon: 'document-text', color: '#14b8a6', bgColor: '#e8f5f5', route: '/shared-notes' },
  { key: 'matching', titleKey: 'home.studyMatching', icon: 'people', color: '#2563eb', bgColor: '#dbeafe', route: '/matching' },
  { key: 'knowledge', titleKey: 'home.knowledgeCards', icon: 'bulb', color: '#6366f1', bgColor: '#eef2ff', route: '/knowledge' },
  { key: 'growth', titleKey: 'home.growthSystem', icon: 'trending-up', color: '#f45a1a', bgColor: '#fce8e0', route: '/gamification' },
  { key: 'invite', titleKey: 'home.inviteRewards', icon: 'gift', color: '#d97706', bgColor: '#fef3c7', route: '/invite' },
  { key: 'recharge', titleKey: 'home.recharge', icon: 'card', color: '#14b8a6', bgColor: '#e8f5f5', route: '/payment' },
];

// 推荐课程类型
interface SharedCourse {
  stage_id: string;
  share_code: string;
  title: string;
  description?: string;
  author?: string;
  style?: string;
  view_count: number;
  like_count: number;
  avg_rating: number;
  rating_count: number;
}

// 笔记分类数据
const notesCategories = [
  { key: 'all', titleKey: 'home.allNotes', icon: '📝', count: '32 条' },
  { key: 'fav', titleKey: 'home.favorites', icon: '⭐', count: '12 条' },
  { key: 'today', titleKey: 'home.today', icon: '📅', count: '3 条' },
  { key: 'new', titleKey: 'home.quickRecord', icon: '➕', count: '' },
];

// 快捷功能按钮组件
function QuickFunctionBtn({ item, onPress, t, iconSize }: { item: typeof quickFunctions[0]; onPress: () => void; t: (key: string) => string; iconSize: number }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      style={styles.quickFnBtn}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <View style={[styles.quickFnIcon, { backgroundColor: item.bgColor }]}>
          <Ionicons name={item.icon as any} size={iconSize} color={item.color} />
        </View>
        <Text style={styles.quickFnLabel}>{t(item.titleKey)}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// 课程项组件（近期课程列表）
function CourseItem({ course }: { course: { id: string; name: string; description?: string; language_directive?: string } }) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <TouchableOpacity
      style={styles.courseItem}
      onPress={() => router.push(`/course/${course.id}` as any)}
      activeOpacity={0.85}
    >
      <View style={[styles.courseIcon, { backgroundColor: iOSColors.accentLight }]}>
        <Text style={styles.courseIconText}>📚</Text>
      </View>
      <View style={styles.courseInfo}>
        <Text style={styles.courseName}>{course.name}</Text>
        <Text style={styles.courseMeta}>{course.description || t('home.myCourses')}</Text>
      </View>
    </TouchableOpacity>
  );
}

// 推荐课程卡片组件
function RecommendedCard({ course, cardWidth, onRate }: { course: SharedCourse; cardWidth: number; onRate: (shareCode: string) => void }) {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  // 评分星星展示
  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? "star" : "star-outline"}
          size={10}
          color={i <= Math.round(rating) ? "#f59e0b" : "#d1d5db"}
        />
      );
    }
    return stars;
  };

  // 课程风格对应图标
  const styleIcon: Record<string, string> = {
    academic: '🎓', formal: '📐', casual: '💬', creative: '🎨',
  };

  return (
    <TouchableOpacity
      onPress={() => router.push(`/course/${course.stage_id}` as any)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.recommendedCard, { width: cardWidth, transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.recIcon, { backgroundColor: iOSColors.accentLight }]}>
          <Text style={styles.recIconText}>{styleIcon[course.style || ''] || '📚'}</Text>
        </View>
        <Text style={styles.recName} numberOfLines={1}>{course.title}</Text>
        <Text style={styles.recCat} numberOfLines={1}>{course.author || '匿名'}</Text>
        {/* 评分行 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          <View style={{ flexDirection: 'row' }}>{renderStars(course.avg_rating)}</View>
          {course.rating_count > 0 && (
            <Text style={{ fontSize: 9, color: '#9ca3af', marginLeft: 2 }}>({course.rating_count})</Text>
          )}
        </View>
        {/* 打分按钮 */}
        <TouchableOpacity
          style={{ marginTop: 4, alignSelf: 'flex-start' }}
          onPress={(e) => { e.stopPropagation(); onRate(course.share_code); }}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={{ fontSize: 10, color: iOSColors.accent }}>打分</Text>
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

// 笔记卡片组件
function NoteCard({ note, t }: { note: typeof notesCategories[0]; t: (key: string) => string }) {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  return (
    <TouchableOpacity
      style={styles.noteCard}
      onPress={() => {
        if (note.key === 'new') {
          router.push('/notes/new' as any);
        } else {
          // 切换到笔记 tab 而不是 push 独立页面
          router.navigate('/(tabs)/notes' as any);
        }
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <Text style={styles.noteIcon}>{note.icon}</Text>
        <Text style={styles.noteLabel}>{t(note.titleKey)}</Text>
        {!!note.count && <Text style={styles.noteCount}>{note.count}</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
}

// Dashboard stats state interface
interface DashboardStats {
  days: number;
  courses: number;
  hours: number;
  streak: number;
}

// Default placeholder stats (used when API data is not available)
const defaultStats: DashboardStats = {
  days: 23,
  courses: 8,
  hours: 156,
  streak: 23,
};

// Recent course type
interface RecentCourse {
  id: string;
  name: string;
  description?: string;
  language_directive?: string;
  created_at: string;
  updated_at: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { onPress } = useFeedback();
  const haptics = useHaptics();
  const { t } = useI18n();
  const [notifExpanded, setNotifExpanded] = useState(false);
  const { breakpoint } = useResponsiveDimensions();

  // Dashboard stats state
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [statsLoading, setStatsLoading] = useState(true);

  // Recent courses state
  const [recentCourses, setRecentCourses] = useState<RecentCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  // 推荐课程（公开分享）
  const [sharedCourses, setSharedCourses] = useState<SharedCourse[]>([]);
  const [ratingShareCode, setRatingShareCode] = useState<string | null>(null);
  const [userRating, setUserRating] = useState(0);

  // 我的笔记统计
  const [recentNotes, setRecentNotes] = useState<{ total: number; todayCount: number; weekCount: number }>({ total: 0, todayCount: 0, weekCount: 0 });

  // 错题复习 Banner（due_count > 0 时显示）
  const [mistakeStats, setMistakeStats] = useState<{ total: number; mastered_count: number; due_count: number }>({ total: 0, mastered_count: 0, due_count: 0 });

  // Fetch dashboard stats and recent courses on mount
  useEffect(() => {
    const fetchData = async () => {
      // Fetch stats
      setStatsLoading(true);
      try {
        const userStats: UserStats = await apiClient.getStats();
        setStats({
          days: userStats.total_chat_sessions || defaultStats.days,
          courses: userStats.total_classrooms || defaultStats.courses,
          hours: Math.round((userStats.total_scenes || 0) * 0.5) || defaultStats.hours,
          streak: defaultStats.streak,
        });
      } catch (error) {
        showError(error);
        console.warn('Failed to fetch dashboard stats:', error);
        setStats(defaultStats);
      } finally {
        setStatsLoading(false);
      }

      // Fetch recent courses
      setCoursesLoading(true);
      try {
        const classrooms = await apiClient.getClassrooms();
        // Get the 3 most recent courses
        const recent = (classrooms || []).slice(0, 3);
        setRecentCourses(recent);
      } catch (error) {
        showError(error);
        console.warn('Failed to fetch recent courses:', error);
        setRecentCourses([]);
      } finally {
        setCoursesLoading(false);
      }

      // Fetch recent notes stats
      try {
        const notesData = await apiClient.getPersonalNotes(1, 5);
        const allItems = [...(notesData.today || []), ...(notesData.this_week || [])];
        setRecentNotes({
          total: notesData.total || allItems.length,
          todayCount: notesData.today?.length || 0,
          weekCount: notesData.this_week?.length || 0,
        });
      } catch (error) {
        console.warn('Failed to fetch notes:', error);
      }

      // Fetch shared courses (推荐)
      try {
        const result = await apiClient.discoverSharedClassrooms(10);
        setSharedCourses(result?.classrooms || []);
      } catch (error) {
        showError(error);
        console.warn('Failed to fetch shared courses:', error);
        setSharedCourses([]);
      }

      // Fetch mistake stats（决定是否显示复习 Banner）
      try {
        const ms = await apiClient.getMistakeStats();
        setMistakeStats(ms);
      } catch (error) {
        // 静默失败：错题统计不可用不影响首页
        console.warn('Failed to fetch mistake stats:', error);
      }
    };

    fetchData();
  }, []);

  // Responsive sizes
  const quickFnIconSize = responsiveValue({ compact: 28, regular: 32, medium: 36, large: 40 }, breakpoint);
  const recCardWidth = responsiveValue({ compact: 120, regular: 140, medium: 160, large: 180 }, breakpoint);

  const handlePress = (route: string) => {
    haptics.light();
    onPress();
    router.push(route as any);
  };

  return (
    <TabPageWrapper>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header 用户区 */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.nickname || user?.email || '用户').charAt(0)}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userGreeting}>
              {(() => {
                const h = new Date().getHours();
                if (h < 6) return '🌙 夜深了';
                if (h < 12) return '☀️ 早上好';
                if (h < 14) return '🌤 中午好';
                if (h < 18) return '🌇 下午好';
                return '🌙 晚上好';
              })()}，{user?.nickname || user?.email?.split('@')[0] || '同学'}
            </Text>
            <Text style={styles.userName}>{user?.nickname || user?.email?.split('@')[0] || '林小雨'}</Text>
            <Text style={styles.userStats}>
              {statsLoading ? (
                t('home.loading') || 'Loading...'
              ) : (
                `${stats.days}${t('home.days')} · ${stats.courses}${t('home.courses')} · ${stats.hours}${t('home.hours')}`
              )}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/profile')}>
            <Ionicons name="settings-outline" size={18} color={iOSColors.fg} />
          </TouchableOpacity>
        </View>

        {/* Streak 连续学习卡片 - 渐变背景 */}
        <TouchableOpacity
          style={styles.streakCardContainer}
          onPress={() => {
            haptics.light();
            router.push('/gamification');
          }}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`${t('home.streak')}: ${statsLoading ? '-' : stats.streak} ${t('home.streakDays')}`}
          accessibilityHint={t('home.viewDetails')}
        >
          <View style={styles.streakCardGradient}>
            <View style={styles.streakCard}>
              <View>
                <Text style={styles.streakNumber}>
                  {statsLoading ? '-' : stats.streak}
                </Text>
                <Text style={styles.streakText}>{t('home.streakDays')}</Text>
              </View>
              <View style={styles.streakRight}>
                <View style={styles.streakDots}>
                  {[1,2,3,4,5,6,7].map(i => (
                    <View key={i} style={[styles.dot, i <= 5 && styles.dotActive]} />
                  ))}
                </View>
                <Text style={styles.viewDetailsText}>{t('home.viewDetails')}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* 错题复习 Banner（仅 due_count>0 时显示） */}
        {mistakeStats.due_count > 0 && (
          <TouchableOpacity
            style={styles.reviewBanner}
            onPress={() => {
              haptics.light();
              router.push('/review' as any);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`今日有 ${mistakeStats.due_count} 道错题待复习`}
          >
            <View style={styles.reviewBannerIcon}>
              <Text style={styles.reviewBannerIconEmoji}>📌</Text>
            </View>
            <View style={styles.reviewBannerBody}>
              <Text style={styles.reviewBannerTitle}>今日复习 · {mistakeStats.due_count} 道错题</Text>
              <Text style={styles.reviewBannerDesc}>
                {mistakeStats.mastered_count > 0
                  ? `已掌握 ${mistakeStats.mastered_count} 道，再来一轮巩固`
                  : '5 分钟搞定，养成日活习惯'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={iOSColors.muted} />
          </TouchableOpacity>
        )}

        {/* Notification 通知卡片 */}
        <TouchableOpacity
          style={[styles.notificationCard, notifExpanded && styles.notificationCardExpanded]}
          onPress={() => setNotifExpanded(!notifExpanded)}
          activeOpacity={0.9}
        >
          <View style={styles.notifHeader}>
            <View style={styles.notifIcon}>
              <Text style={styles.notifIconEmoji}>🔔</Text>
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>3</Text>
              </View>
            </View>
            <View style={styles.notifSummary}>
              <Text style={styles.notifTitle}>{t('home.newLessonReminder')} · 数据分析基础</Text>
              <Text style={styles.notifTime}>5分钟前</Text>
            </View>
            <View style={styles.notifChevron}>
              <Ionicons
                name={notifExpanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={iOSColors.muted}
              />
            </View>
          </View>
          {notifExpanded && (
            <View style={styles.notifDetail}>
              <Text style={styles.notifBody}>
                第 13 节「交互式仪表盘」已更新，包含 2 个实战案例和 1 个随堂测验。完成本节后你将解锁下一章「高级筛选」。
              </Text>
              <View style={styles.notifActions}>
                <TouchableOpacity style={styles.notifActionPrimary} onPress={() => router.push('/courses')}>
                  <Text style={styles.notifActionPrimaryText}>{t('home.startLearning')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.notifActionSecondary}>
                  <Text style={styles.notifActionSecondaryText}>{t('home.remindLater')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Quick Functions 快捷功能 */}
        <View style={styles.quickFunctions}>
          <ResponsiveGrid
            columns={{ compact: 5, regular: 5, medium: 5, large: 10 }}
            gap="sm"
          >
            {quickFunctions.map((item) => (
              <QuickFunctionBtn
                key={item.key}
                item={item}
                onPress={() => handlePress(item.route)}
                t={t}
                iconSize={quickFnIconSize}
              />
            ))}
          </ResponsiveGrid>
        </View>

        {/* Recent Courses 近期课程 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.recentCourses')}</Text>
            <TouchableOpacity onPress={() => router.push('/courses')}>
              <Text style={styles.sectionLink}>全部</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.courseList}>
            {coursesLoading ? (
              <Text style={styles.loadingText}>{t('home.loading')}</Text>
            ) : recentCourses.length > 0 ? (
              recentCourses.map(course => (
                <CourseItem key={course.id} course={course} />
              ))
            ) : (
              <Text style={styles.emptyText}>暂无课程，去创建一门吧！</Text>
            )}
          </View>
        </View>

        {/* Recommended 推荐课程 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.recommendedCourses')}</Text>
            <TouchableOpacity onPress={() => router.push('/courses')}>
              <Text style={styles.sectionLink}>更多</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.recommendedScroll}
          >
            {sharedCourses.length > 0 ? (
              sharedCourses.map(course => (
                <RecommendedCard 
                  key={course.stage_id} 
                  course={course} 
                  cardWidth={recCardWidth} 
                  onRate={(shareCode) => { setRatingShareCode(shareCode); setUserRating(0); }}
                />
              ))
            ) : (
              <Text style={{ color: '#9ca3af', fontSize: 13, padding: 16 }}>暂无公开课程</Text>
            )}
          </ScrollView>
        </View>

        {/* 评分弹窗 */}
        <Modal
          visible={!!ratingShareCode}
          transparent
          animationType="fade"
          onRequestClose={() => setRatingShareCode(null)}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: 280, alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '600', marginBottom: 16 }}>给课程打分</Text>
              <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <TouchableOpacity key={i} onPress={() => setUserRating(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={i <= userRating ? "star" : "star-outline"} size={36} color={i <= userRating ? "#f59e0b" : "#d1d5db"} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={() => setRatingShareCode(null)} style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f3f4f6' }}>
                  <Text style={{ color: '#6b7280' }}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    if (userRating > 0 && ratingShareCode) {
                      try {
                        await apiClient.rateSharedClassroom(ratingShareCode, userRating);
                        // 刷新推荐课程
                        const result = await apiClient.discoverSharedClassrooms(10);
                        setSharedCourses(result?.classrooms || []);
                      } catch (e) {
                        showError(e);
                        console.warn('Rating failed:', e);
                      }
                    }
                    setRatingShareCode(null);
                  }}
                  style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: userRating > 0 ? iOSColors.accent : '#e5e7eb' }}
                >
                  <Text style={{ color: userRating > 0 ? '#fff' : '#9ca3af' }}>提交</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Notes 我的笔记 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>我的笔记</Text>
            <TouchableOpacity onPress={() => router.navigate('/(tabs)/notes' as any)}>
              <Text style={styles.sectionLink}>全部 ({recentNotes.total})</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.notesGrid}>
            <TouchableOpacity
              style={styles.noteCard}
              onPress={() => router.navigate('/(tabs)/notes' as any)}
              activeOpacity={0.9}
            >
              <Text style={styles.noteIcon}>📝</Text>
              <Text style={styles.noteLabel}>{t('home.allNotes')}</Text>
              <Text style={styles.noteCount}>{recentNotes.total} 条</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.noteCard}
              onPress={() => router.push('/notes/new' as any)}
              activeOpacity={0.9}
            >
              <Text style={styles.noteIcon}>✏️</Text>
              <Text style={styles.noteLabel}>{t('home.writeNote')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.noteCard}
              onPress={() => router.navigate('/(tabs)/notes' as any)}
              activeOpacity={0.9}
            >
              <Text style={styles.noteIcon}>📅</Text>
              <Text style={styles.noteLabel}>{t('home.todayNotes')}</Text>
              <Text style={styles.noteCount}>{recentNotes.todayCount} 条</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.noteCard}
              onPress={() => router.navigate('/(tabs)/notes' as any)}
              activeOpacity={0.9}
            >
              <Text style={styles.noteIcon}>📆</Text>
              <Text style={styles.noteLabel}>{t('home.weekNotes')}</Text>
              <Text style={styles.noteCount}>{recentNotes.weekCount} 条</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </TabPageWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  // Header 用户区
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: iOSColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
  },
  userGreeting: {
    fontSize: 13,
    color: iOSColors.muted,
    marginBottom: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: iOSColors.fg,
    letterSpacing: -0.3,
  },
  userStats: {
    fontSize: 12,
    color: iOSColors.muted,
    marginTop: 2,
  },
  statValue: {
    color: iOSColors.accent,
    fontWeight: '600',
  },
  loadingText: {
    color: iOSColors.muted,
    fontStyle: 'italic',
  },
  emptyText: {
    color: iOSColors.muted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  // Streak 连续学习 - 渐变效果
  streakCardContainer: {
    marginBottom: Spacing.lg,
    borderRadius: Rounded.lg,
    overflow: 'hidden',
  },
  streakCardGradient: {
    backgroundColor: iOSColors.streakGradientStart,
  },
  streakCard: {
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  streakText: {
    fontSize: 11,
    color: '#fff',
    opacity: 0.85,
    marginTop: 2,
  },
  streakDots: {
    flexDirection: 'row',
    gap: 5,
  },
  streakRight: {
    alignItems: 'flex-end',
  },
  viewDetailsText: {
    fontSize: 11,
    color: '#fff',
    opacity: 0.8,
    marginTop: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: '#fff',
  },
  // Notification 通知卡片
  notificationCard: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  // 错题复习 Banner（橙色品牌色，强调感）
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5ed',
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: Spacing.lg,
    gap: 12,
    minHeight: 56,
  },
  reviewBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBannerIconEmoji: { fontSize: 18 },
  reviewBannerBody: { flex: 1 },
  reviewBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9a3412',
    marginBottom: 2,
  },
  reviewBannerDesc: {
    fontSize: 12,
    color: '#c2410c',
  },
  notificationCardExpanded: {
    // 展开时保持相同的半透明背景
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    minHeight: 44,
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: iOSColors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifIconEmoji: {
    fontSize: 16,
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: iOSColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  notifSummary: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: 1,
  },
  notifTime: {
    fontSize: 10,
    color: iOSColors.muted,
    opacity: 0.7,
  },
  notifChevron: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDetail: {
    padding: Spacing.sm,
    paddingLeft: Spacing.md + 36 + Spacing.sm,
  },
  notifBody: {
    fontSize: 12,
    color: iOSColors.muted,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  notifActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  notifActionPrimary: {
    backgroundColor: iOSColors.accent,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifActionPrimaryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  notifActionSecondary: {
    backgroundColor: iOSColors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifActionSecondaryText: {
    color: iOSColors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  // Quick Functions 快捷功能
  quickFunctions: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.lg,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  quickFnBtn: {
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: Spacing.sm,
  },
  quickFnIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickFnLabel: {
    fontSize: 13,
    color: iOSColors.muted,
    marginTop: 8,
    textAlign: 'center',
  },
  // Section 通用
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  sectionLink: {
    fontSize: 12,
    color: iOSColors.accent,
    fontWeight: '500',
  },
  // Courses 课程列表
  courseList: {
    gap: Spacing.sm,
  },
  courseItem: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  courseIcon: {
    width: 44,
    height: 44,
    borderRadius: Rounded.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseIconText: {
    fontSize: 18,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: 3,
  },
  courseMeta: {
    fontSize: 11,
    color: iOSColors.muted,
  },
  courseProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 6,
  },
  progressBar: {
    flex: 1,
    maxWidth: 64,
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
  progressNum: {
    fontSize: 11,
    color: iOSColors.muted,
    minWidth: 32,
    textAlign: 'right',
  },
  // Recommended 推荐课程
  recommendedScroll: {
    marginBottom: Spacing.lg,
  },
  recommendedCard: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  recIcon: {
    width: 36,
    height: 36,
    borderRadius: Rounded.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  recIconText: {
    fontSize: 15,
  },
  recName: {
    fontSize: 13,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: 2,
  },
  recCat: {
    fontSize: 11,
    color: iOSColors.muted,
  },
  // Notes 笔记网格
  notesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  noteCard: {
    width: '48%',
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.md,
    alignItems: 'center',
    minHeight: 80,
  },
  noteIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  noteCount: {
    fontSize: 11,
    color: iOSColors.muted,
    marginTop: 1,
  },
});