import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useHaptics } from '@/lib/hooks/use-haptics';

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

// 模拟课程数据（后续接入真实数据）
const mockCourseData = {
  instructor: { name: '陈教授', avatar: '陈' },
  students: 12847,
  rating: 4.8,
  totalHours: 24,
  totalDuration: '18h',
  level: 'L2',
  tags: ['数据科学', 'Python', '可视化', '统计学'],
  description: '本课程从数据分析的基础概念出发，系统讲解数据采集、清洗、探索性分析、统计推断到数据可视化的完整工作流。使用 Python 生态中的 pandas、numpy、matplotlib 等核心工具，通过 12 个真实业务场景的实战案例，帮助你建立数据驱动的思维方式。课程结束后，你将能够独立完成从原始数据到洞察报告的全流程。',
  chapters: [
    {
      id: 1,
      title: '第一章：数据分析导论',
      lessons: 4,
      duration: '2h15m',
      completedLessons: 4,
      items: [
        { id: 1, title: '什么是数据分析', type: 'video', duration: '25分钟', status: 'completed' },
        { id: 2, title: '数据分析工作流概览', type: 'video', duration: '32分钟', status: 'completed' },
        { id: 3, title: 'Python 环境搭建', type: 'video', duration: '40分钟', status: 'completed' },
        { id: 4, title: '第一章测验', type: 'quiz', duration: '15分钟', status: 'completed' },
      ]
    },
    {
      id: 2,
      title: '第二章：数据获取与清洗',
      lessons: 5,
      duration: '3h30m',
      completedLessons: 3,
      items: [
        { id: 5, title: '数据源类型与采集策略', type: 'video', duration: '35分钟', status: 'completed' },
        { id: 6, title: 'pandas 数据结构', type: 'video', duration: '45分钟', status: 'completed' },
        { id: 7, title: '缺失值处理与异常检测', type: 'video', duration: '42分钟', status: 'completed' },
        { id: 8, title: '数据转换与特征工程基础', type: 'video', duration: '50分钟', status: 'current' },
        { id: 9, title: '第二章实战：电商数据清洗', type: 'practice', duration: '38分钟', status: 'locked' },
      ]
    },
    {
      id: 3,
      title: '第三章：探索性数据分析',
      lessons: 6,
      duration: '4h10m',
      completedLessons: 0,
      items: [
        { id: 10, title: '描述性统计与分布', type: 'video', duration: '40分钟', status: 'locked' },
      ]
    },
  ]
};

// 课程Hero组件
function CourseHero() {
  return (
    <View style={styles.courseHero}>
      <View style={styles.heroPattern} />
      <TouchableOpacity
        style={styles.heroBackBtn}
        onPress={() => useRouter().back()}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={18} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.heroShareBtn}
        onPress={() => {
          // 后续添加分享功能
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="share-outline" size={16} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.heroEmoji}>📊</Text>
    </View>
  );
}

// 统计卡片组件
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// 章节课程项组件
function LessonItem({ lesson }: { lesson: typeof mockCourseData.chapters[0]['items'][0] }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const router = useRouter();

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

  const statusStyle = lesson.status === 'completed'
    ? { backgroundColor: iOSColors.secondary, color: '#fff', text: '✓' }
    : lesson.status === 'current'
    ? { backgroundColor: iOSColors.accent, color: '#fff', text: String(lesson.id) }
    : { backgroundColor: 'rgba(230, 225, 220, 0.5)', color: iOSColors.muted, text: '🔒' };

  const typeIcon = {
    video: 'play-circle',
    quiz: 'help-circle',
    practice: 'code-working',
  }[lesson.type] || 'document-text';

  return (
    <TouchableOpacity
      onPress={() => {
        if (lesson.status !== 'locked') {
          // 跳转到课堂互动页
          router.push(`/classroom/lesson1` as any);
        }
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      disabled={lesson.status === 'locked'}
    >
      <Animated.View style={[
        styles.lessonItem,
        { transform: [{ scale: scaleAnim }] },
        lesson.status === 'current' && styles.lessonItemCurrent,
        lesson.status === 'locked' && styles.lessonItemLocked,
      ]}>
        <View style={[styles.lessonNum, { backgroundColor: statusStyle.backgroundColor }]}>
          <Text style={[styles.lessonNumText, { color: statusStyle.color }]}>
            {statusStyle.text}
          </Text>
        </View>
        <View style={styles.lessonBody}>
          <Text style={styles.lessonName}>{lesson.title}</Text>
          <View style={styles.lessonMeta}>
            <View style={styles.lessonType}>
              <Ionicons name={typeIcon as any} size={10} color={iOSColors.muted} />
              <Text style={styles.lessonTypeText}>
                {lesson.type === 'video' ? '视频' : lesson.type === 'quiz' ? '测验' : '实战'}
              </Text>
            </View>
            <Text style={styles.lessonDuration}>{lesson.duration}</Text>
            {lesson.status === 'current' && (
              <Text style={styles.lessonCurrentLabel}>← 当前</Text>
            )}
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const haptics = useHaptics();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    loadClassroom();
  }, [id]);

  const loadClassroom = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getClassroom(id as string);
      setClassroom(data);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={iOSColors.accent} />
      </View>
    );
  }

  if (error || !classroom) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error || '课程不存在'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadClassroom}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 课程Hero Banner */}
        <CourseHero />

        {/* 课程信息 */}
        <View style={styles.courseInfo}>
          <Text style={styles.courseTitle}>{classroom.name}</Text>
          <Text style={styles.courseSubtitle}>{classroom.description || mockCourseData.description.slice(0, 60)}</Text>

          <View style={styles.courseMetaRow}>
            <View style={styles.instructor}>
              <View style={styles.instructorAvatar}>
                <Text style={styles.instructorAvatarText}>{mockCourseData.instructor.avatar}</Text>
              </View>
              <Text style={styles.instructorName}>{mockCourseData.instructor.name}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaStat}>
              <Ionicons name="people-outline" size={12} color={iOSColors.muted} />
              <Text style={styles.metaStatText}>{mockCourseData.students}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaStat}>
              <Ionicons name="star-outline" size={12} color={iOSColors.muted} />
              <Text style={styles.metaStatText}>{mockCourseData.rating}</Text>
            </View>
          </View>
        </View>

        {/* 统计网格 */}
        <View style={styles.statsGrid}>
          <StatCard value={String(mockCourseData.totalHours)} label="课时" />
          <StatCard value={mockCourseData.totalDuration} label="总时长" />
          <StatCard value={mockCourseData.level} label="难度" />
        </View>

        {/* 标签 */}
        <View style={styles.tagsRow}>
          {mockCourseData.tags.slice(0, 4).map((tag, index) => (
            <View key={tag} style={[styles.tag, index >= 2 && styles.tagSecondary]}>
              <Text style={[styles.tagText, index >= 2 && styles.tagTextSecondary]}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* 课程简介 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>课程简介</Text>
        </View>
        <View style={styles.courseDescCard}>
          <Text style={[styles.courseDescText, !descExpanded && styles.courseDescTextTruncated]}>
            {mockCourseData.description}
          </Text>
          <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
            <Text style={styles.descExpand}>{descExpanded ? '收起' : '展开全部'}</Text>
          </TouchableOpacity>
        </View>

        {/* 课程目录 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>课程目录</Text>
          <TouchableOpacity onPress={() => {
            // 后续添加收起/展开功能
          }}>
            <Text style={styles.sectionLink}>收起 ▾</Text>
          </TouchableOpacity>
        </View>

        {/* 章节列表 */}
        {mockCourseData.chapters.map((chapter) => (
          <View key={chapter.id} style={styles.chapterGroup}>
            <View style={styles.chapterHeader}>
              <Text style={styles.chapterGroupTitle}>{chapter.title}</Text>
              <Text style={styles.chapterGroupCount}>{chapter.lessons} 节 · {chapter.duration}</Text>
            </View>
            <View style={styles.chapterLessons}>
              {chapter.items.map((lesson) => (
                <LessonItem key={lesson.id} lesson={lesson} />
              ))}
            </View>
          </View>
        ))}

        {/* 占位空间（为底部操作栏留空） */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => {
            haptics.medium();
            router.push(`/classroom/${id}` as any);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="play-circle" size={18} color="#fff" />
          <Text style={styles.btnPrimaryText}>继续学习</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => {
            haptics.light();
            // 后续添加下载功能
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="download-outline" size={20} color={iOSColors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
  },
  scrollView: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: iOSColors.bgSolid,
  },

  // Hero Banner
  courseHero: {
    width: '100%',
    height: 220,
    backgroundColor: '#c45a1a',
    position: 'relative',
    overflow: 'hidden',
  },
  heroPattern: {
    position: 'absolute',
    inset: 0,
    opacity: 0.08,
    backgroundColor: '#fff',
  },
  heroBackBtn: {
    position: 'absolute',
    top: 58,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heroShareBtn: {
    position: 'absolute',
    top: 58,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heroEmoji: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    fontSize: 48,
    zIndex: 2,
  },

  // 课程信息
  courseInfo: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  courseTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: iOSColors.fg,
    letterSpacing: -0.4,
    lineHeight: 28,
    marginBottom: Spacing.xs,
  },
  courseSubtitle: {
    fontSize: 13,
    color: iOSColors.muted,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  courseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  instructor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  instructorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructorAvatarText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  instructorName: {
    fontSize: 13,
    fontWeight: '500',
    color: iOSColors.fg,
  },
  metaDivider: {
    width: 1,
    height: 14,
    backgroundColor: iOSColors.border,
  },
  metaStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaStatText: {
    fontSize: 12,
    color: iOSColors.muted,
  },

  // 统计网格
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: iOSColors.accent,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 10,
    color: iOSColors.muted,
    marginTop: 2,
  },

  // 标签
  tagsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: iOSColors.accentLight,
  },
  tagSecondary: {
    backgroundColor: iOSColors.secondaryLight,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
    color: iOSColors.accent,
  },
  tagTextSecondary: {
    color: iOSColors.secondary,
  },

  // 章节标题
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: iOSColors.fg,
    letterSpacing: -0.2,
  },
  sectionLink: {
    fontSize: 12,
    color: iOSColors.accent,
  },

  // 课程简介
  courseDescCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  courseDescText: {
    fontSize: 13,
    color: iOSColors.fg,
    lineHeight: 22,
  },
  courseDescTextTruncated: {
    maxHeight: 66,
    overflow: 'hidden',
  },
  descExpand: {
    fontSize: 12,
    color: iOSColors.accent,
    marginTop: Spacing.xs,
  },

  // 章节列表
  chapterGroup: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  chapterGroupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  chapterGroupCount: {
    fontSize: 11,
    color: iOSColors.muted,
  },
  chapterLessons: {
    gap: Spacing.xs,
  },

  // 课程项
  lessonItem: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  lessonItemCurrent: {
    borderColor: iOSColors.accent,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  lessonItemLocked: {
    opacity: 0.65,
  },
  lessonNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lessonBody: {
    flex: 1,
  },
  lessonName: {
    fontSize: 13,
    fontWeight: '500',
    color: iOSColors.fg,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  lessonType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  lessonTypeText: {
    fontSize: 11,
    color: iOSColors.muted,
  },
  lessonDuration: {
    fontSize: 11,
    color: iOSColors.muted,
  },
  lessonCurrentLabel: {
    fontSize: 11,
    color: iOSColors.accent,
  },

  // 底部操作栏
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderTopWidth: 0.5,
    borderTopColor: iOSColors.border,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btnPrimary: {
    flex: 1,
    height: 48,
    borderRadius: Rounded.md,
    backgroundColor: iOSColors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  btnSecondary: {
    width: 48,
    height: 48,
    borderRadius: Rounded.md,
    backgroundColor: iOSColors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
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