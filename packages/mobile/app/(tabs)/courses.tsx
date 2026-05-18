import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { useRef } from 'react';

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
  created_at: string;
  updated_at?: string;
  scene_count?: number;
}

// 模拟课程进度和状态数据（后续可接入真实数据）
const mockCourseData = {
  progress: Math.floor(Math.random() * 100),
  status: ['in-progress', 'completed', 'not-started'][Math.floor(Math.random() * 3)],
  category: ['数据科学', '编程基础', '设计基础', '人工智能', '商业分析', '人文素养', '思维方式', '语言学习', '数学基础', '产品设计', '前端框架'][Math.floor(Math.random() * 11)],
  totalSections: Math.floor(Math.random() * 30) + 10,
  completedSections: Math.floor(Math.random() * 20),
};

// 状态标签配置
const statusConfig = {
  'in-progress': { label: '学习中', bgColor: iOSColors.accentLight, textColor: iOSColors.accent },
  'completed': { label: '已完成', bgColor: iOSColors.secondaryLight, textColor: iOSColors.secondary },
  'not-started': { label: '未开始', bgColor: 'rgba(230, 225, 220, 0.4)', textColor: iOSColors.muted },
};

export default function CoursesScreen() {
  const router = useRouter();
  const { onPress } = useFeedback();
  const haptics = useHaptics();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 筛选状态
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    loadClassrooms();
  }, []);

  // 筛选课程
  const filteredClassrooms = useMemo(() => {
    if (activeFilter === 'all') return classrooms;

    // 根据模拟状态筛选（后续替换为真实数据）
    return classrooms.filter(() => {
      const status = mockCourseData.status;
      if (activeFilter === 'progress') return status === 'in-progress';
      if (activeFilter === 'completed') return status === 'completed';
      if (activeFilter === 'notstarted') return status === 'not-started';
      return true;
    });
  }, [classrooms, activeFilter]);

  // 统计各状态数量（模拟数据）
  const courseStats = useMemo(() => {
    const total = classrooms.length;
    const inProgress = Math.floor(total * 0.4);
    const completed = Math.floor(total * 0.35);
    const notStarted = total - inProgress - completed;
    return { total, inProgress, completed, notStarted };
  }, [classrooms]);

  const loadClassrooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getClassrooms();
      setClassrooms(data);
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

  // 获取缩略图颜色（根据索引循环）
  const getThumbColor = (index: number) => {
    const colors = ['coral', 'mint', 'gold', 'blue', 'purple'];
    return colors[index % colors.length];
  };

  // 课程卡片组件
  function CourseCard({ classroom, index }: { classroom: Classroom; index: number }) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const thumbColor = getThumbColor(index);

    // 模拟课程数据（后续替换为真实数据）
    const progress = mockCourseData.progress;
    const status = mockCourseData.status;
    const category = mockCourseData.category;
    const totalSections = mockCourseData.totalSections;
    const completedSections = Math.floor(totalSections * progress / 100);

    const statusInfo = statusConfig[status as keyof typeof statusConfig];

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
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
        onPress={() => router.push(`/course/${classroom.id}` as any)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <Animated.View style={[styles.courseCard, { transform: [{ scale: scaleAnim }] }]}>
          {/* 缩略图 */}
          <View style={[styles.courseThumb, { backgroundColor: thumbColor === 'coral' ? '#f45a1a' : thumbColor === 'mint' ? '#14b8a6' : thumbColor === 'gold' ? '#f59e0b' : thumbColor === 'blue' ? '#2563eb' : '#8b5cf6' }]}>
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
              <Text style={styles.courseCat}>{category} · 共 {totalSections} 节</Text>
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={iOSColors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadClassrooms}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 页面头部 */}
      <View style={styles.pageHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>我的课程</Text>
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
            全部 <Text style={{ opacity: 0.6 }}>({courseStats.total})</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'progress' && styles.filterTabActive]}
          onPress={() => {
            haptics.light();
            setActiveFilter('progress');
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterTabText, activeFilter === 'progress' && styles.filterTabTextActive]}>
            学习中 <Text style={{ opacity: 0.6 }}>({courseStats.inProgress})</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'completed' && styles.filterTabActive]}
          onPress={() => {
            haptics.light();
            setActiveFilter('completed');
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterTabText, activeFilter === 'completed' && styles.filterTabTextActive]}>
            已完成 <Text style={{ opacity: 0.6 }}>({courseStats.completed})</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'notstarted' && styles.filterTabActive]}
          onPress={() => {
            haptics.light();
            setActiveFilter('notstarted');
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterTabText, activeFilter === 'notstarted' && styles.filterTabTextActive]}>
            未开始 <Text style={{ opacity: 0.6 }}>({courseStats.notStarted})</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* 排序栏 */}
      <View style={styles.sortBar}>
        <Text style={styles.courseCount}>共 {filteredClassrooms.length} 门课程</Text>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => {
            haptics.light();
            onPress();
            // 后续添加排序功能
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.sortBtnText}>最近更新</Text>
          <Ionicons name="chevron-down" size={14} color={iOSColors.muted} />
        </TouchableOpacity>
      </View>

      {/* 课程列表 */}
      <FlatList
        data={filteredClassrooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <CourseCard classroom={item} index={index} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="folder-open-outline" size={28} color={iOSColors.accent} />
            </View>
            <Text style={styles.emptyTitle}>暂无课程</Text>
            <Text style={styles.emptyDesc}>创建你的第一个课程开始学习</Text>
          </View>
        }
        refreshing={loading}
        onRefresh={loadClassrooms}
        contentContainerStyle={styles.courseList}
        showsVerticalScrollIndicator={false}
      />
    </View>
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