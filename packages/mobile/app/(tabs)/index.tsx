import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import TabPageWrapper from '@/lib/components/TabPageWrapper';
import { ResponsiveGrid } from '@/lib/components/ResponsiveGrid';
import { useResponsiveDimensions, responsiveValue } from '@/lib/utils/responsive';

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

// 快捷功能配置（10个）
const quickFunctions = [
  { key: 'courses', titleKey: 'home.myCourses', icon: 'book', color: '#f45a1a', bgColor: '#fce8e0', route: '/courses' },
  { key: 'qa', titleKey: 'home.qaBounty', icon: 'help-circle', color: '#d97706', bgColor: '#fef3c7', route: '/questions' },
  { key: 'notes', titleKey: 'home.sharedNotes', icon: 'document-text', color: '#14b8a6', bgColor: '#e8f5f5', route: '/notes' },
  { key: 'buddy', titleKey: 'home.studyBuddy', icon: 'happy', color: '#2563eb', bgColor: '#dbeafe', route: '/buddy' },
  { key: 'matching', titleKey: 'home.studyMatching', icon: 'people', color: '#8b5cf6', bgColor: '#ede9fe', route: '/matching' },
  { key: 'growth', titleKey: 'home.growthSystem', icon: 'trending-up', color: '#f45a1a', bgColor: '#fce8e0', route: '/gamification' },
  { key: 'invite', titleKey: 'home.inviteRewards', icon: 'gift', color: '#d97706', bgColor: '#fef3c7', route: '/invite' },
  { key: 'recharge', titleKey: 'home.recharge', icon: 'card', color: '#14b8a6', bgColor: '#e8f5f5', route: '/payment' },
  { key: 'wallet', titleKey: 'home.wallet', icon: 'cash', color: '#2563eb', bgColor: '#dbeafe', route: '/wallet' },
  { key: 'enterprise', titleKey: 'home.enterpriseServices', icon: 'briefcase', color: '#8b5cf6', bgColor: '#ede9fe', route: '/enterprise' },
];

// 近期课程数据
const recentCourses = [
  { id: 1, name: '数据分析基础', section: '第 12 节 · 数据可视化', progress: 68, icon: '📊', color: '#fce8e0' },
  { id: 2, name: 'Python 编程入门', section: '第 8 节 · 函数与模块', progress: 45, icon: '💻', color: '#dbeafe' },
  { id: 3, name: 'UI 设计原理', section: '第 5 节 · 色彩与排版', progress: 28, icon: '🎨', color: '#ede9fe' },
];

// 推荐课程数据
const recommendedCourses = [
  { id: 1, name: '机器学习概论', category: '人工智能', icon: '🧮' },
  { id: 2, name: '商业数据分析', category: '商业分析', icon: '📈' },
  { id: 3, name: '写作与表达', category: '人文素养', icon: '📝' },
  { id: 4, name: '科学思维方法', category: '思维方式', icon: '🔬' },
];

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
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      style={styles.quickFnBtn}
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
function CourseItem({ course }: { course: typeof recentCourses[0] }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.courseItem}
      onPress={() => router.push(`/course/${course.id}` as any)}
      activeOpacity={0.85}
    >
      <View style={[styles.courseIcon, { backgroundColor: course.color }]}>
        <Text style={styles.courseIconText}>{course.icon}</Text>
      </View>
      <View style={styles.courseInfo}>
        <Text style={styles.courseName}>{course.name}</Text>
        <Text style={styles.courseMeta}>{course.section}</Text>
        <View style={styles.courseProgress}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${course.progress}%` }]} />
          </View>
          <Text style={styles.progressNum}>{course.progress}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// 推荐课程卡片组件
function RecommendedCard({ course, cardWidth }: { course: typeof recommendedCourses[0]; cardWidth: number }) {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={() => router.push(`/course/${course.id}` as any)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.recommendedCard, { width: cardWidth, transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.recIcon, { backgroundColor: iOSColors.accentLight }]}>
          <Text style={styles.recIconText}>{course.icon}</Text>
        </View>
        <Text style={styles.recName}>{course.name}</Text>
        <Text style={styles.recCat}>{course.category}</Text>
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
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      style={styles.noteCard}
      onPress={() => {
        if (note.key === 'new') {
          router.push('/notes/new' as any);
        } else {
          router.push('/notes' as any);
        }
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <Text style={styles.noteIcon}>{note.icon}</Text>
        <Text style={styles.noteLabel}>{t(note.titleKey)}</Text>
        {note.count && <Text style={styles.noteCount}>{note.count}</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { onPress } = useFeedback();
  const haptics = useHaptics();
  const { t } = useI18n();
  const [notifExpanded, setNotifExpanded] = useState(false);
  const { breakpoint } = useResponsiveDimensions();

  // Responsive sizes
  const quickFnIconSize = responsiveValue({ compact: 14, regular: 16, medium: 18, large: 20 }, breakpoint);
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
            <Text style={styles.userName}>{user?.nickname || user?.email?.split('@')[0] || '林小雨'}</Text>
            <Text style={styles.userStats}>
              <Text style={styles.statValue}>23</Text>{t('home.days')} ·
              <Text style={styles.statValue}>8</Text>{t('home.courses')} ·
              <Text style={styles.statValue}>156</Text>{t('home.hours')}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/profile')}>
            <Ionicons name="settings-outline" size={18} color={iOSColors.fg} />
          </TouchableOpacity>
        </View>

        {/* Streak 连续学习卡片 - 渐变背景 */}
        <View style={styles.streakCardContainer}>
          <View style={styles.streakCardGradient}>
            <View style={styles.streakCard}>
              <View>
                <Text style={styles.streakNumber}>23</Text>
                <Text style={styles.streakText}>{t('home.streakDays')}</Text>
              </View>
              <View style={styles.streakDots}>
                {[1,2,3,4,5,6,7].map(i => (
                  <View key={i} style={[styles.dot, i <= 5 && styles.dotActive]} />
                ))}
              </View>
            </View>
          </View>
        </View>

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
            {recentCourses.map(course => (
              <CourseItem key={course.id} course={course} />
            ))}
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
            {recommendedCourses.map(course => (
              <RecommendedCard key={course.id} course={course} cardWidth={recCardWidth} />
            ))}
          </ScrollView>
        </View>

        {/* Notes 我的笔记 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>我的笔记</Text>
            <TouchableOpacity onPress={() => router.push('/notes')}>
              <Text style={styles.sectionLink}>全部</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.notesGrid}>
            {notesCategories.map(note => (
              <NoteCard key={note.key} note={note} t={t} />
            ))}
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
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickFnLabel: {
    fontSize: 10,
    color: iOSColors.muted,
    marginTop: 4,
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