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
  language_directive?: string;
  created_at: string;
  updated_at?: string;
}

interface Scene {
  id: string;
  type: string;
  title: string;
  order_index: number;
  content?: any;
  actions?: any;
  whiteboards?: any;
}

interface ClassroomData {
  stage: {
    id: string;
    name: string;
    description?: string;
    language_directive?: string;
    style?: string;
    tags?: string[];  // 课程标签
    agent_ids?: string[];
    generated_agent_configs?: any[];
    pending_outlines?: any[];
  };
  scenes: Scene[];
  agents?: any[];
}

// 模拟课程数据（后续接入真实数据）
const mockCourseData = {
  instructor: { name: '陈教授', avatar: '陈' },
  students: 12847,
  rating: 4.8,
  tags: ['数据科学', 'Python', '可视化', '统计学'],
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
function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// 章节课程项组件（基于Scene）
function SceneItem({ scene, index, total }: { scene: Scene; index: number; total: number }) {
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

  // 模拟完成状态（后续接入真实数据）
  const status = index < Math.floor(total * 0.6) ? 'completed' :
                 index === Math.floor(total * 0.6) ? 'current' : 'locked';

  const statusStyle = status === 'completed'
    ? { backgroundColor: iOSColors.secondary, color: '#fff', text: '✓' }
    : status === 'current'
    ? { backgroundColor: iOSColors.accent, color: '#fff', text: String(index + 1) }
    : { backgroundColor: 'rgba(230, 225, 220, 0.5)', color: iOSColors.muted, text: '🔒' };

  const typeIcon = scene.type === 'slide' ? 'document-text' :
                   scene.type === 'quiz' ? 'help-circle' :
                   scene.type === 'interactive' ? 'hand-left' : 'layers';

  return (
    <TouchableOpacity
      onPress={() => {
        if (status !== 'locked') {
          router.push(`/classroom/${scene.id}` as any);
        }
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      disabled={status === 'locked'}
    >
      <Animated.View style={[
        styles.lessonItem,
        { transform: [{ scale: scaleAnim }] },
        status === 'current' && styles.lessonItemCurrent,
        status === 'locked' && styles.lessonItemLocked,
      ]}>
        <View style={[styles.lessonNum, { backgroundColor: statusStyle.backgroundColor }]}>
          <Text style={[styles.lessonNumText, { color: statusStyle.color }]}>
            {statusStyle.text}
          </Text>
        </View>
        <View style={styles.lessonBody}>
          <Text style={styles.lessonName}>{scene.title}</Text>
          <View style={styles.lessonMeta}>
            <View style={styles.lessonType}>
              <Ionicons name={typeIcon as any} size={10} color={iOSColors.muted} />
              <Text style={styles.lessonTypeText}>
                {scene.type === 'slide' ? '幻灯片' : scene.type === 'quiz' ? '测验' : scene.type === 'interactive' ? '互动' : '场景'}
              </Text>
            </View>
            <Text style={styles.lessonIndex}>#{scene.order_index + 1}</Text>
            {status === 'current' && (
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
  const [classroom, setClassroom] = useState<ClassroomData | null>(null);
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

  const stage = classroom.stage;
  const scenes = classroom.scenes || [];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 课程Hero Banner */}
        <CourseHero />

        {/* 课程信息 */}
        <View style={styles.courseInfo}>
          <Text style={styles.courseTitle}>{stage.name}</Text>
          <Text style={styles.courseSubtitle}>
            {stage.description || '掌握完整的分析工作流'}
          </Text>

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
          <StatCard value={scenes.length} label="场景" />
          <StatCard value={`${Math.ceil(scenes.length * 15 / 60)}h`} label="预计时长" />
          <StatCard value="L2" label="难度" />
        </View>

        {/* 标签 */}
        <View style={styles.tagsRow}>
          {stage.tags && stage.tags.length > 0 ? (
            stage.tags.map((tag: string, index: number) => (
              <View key={tag} style={[styles.tag, index >= 2 && styles.tagSecondary]}>
                <Text style={[styles.tagText, index >= 2 && styles.tagTextSecondary]}>{tag}</Text>
              </View>
            ))
          ) : (
            mockCourseData.tags.map((tag, index) => (
              <View key={tag} style={[styles.tag, index >= 2 && styles.tagSecondary]}>
                <Text style={[styles.tagText, index >= 2 && styles.tagTextSecondary]}>{tag}</Text>
              </View>
            ))
          )}
        </View>

        {/* 课程简介 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>课程简介</Text>
        </View>
        <View style={styles.courseDescCard}>
          <Text style={[styles.courseDescText, !descExpanded && styles.courseDescTextTruncated]}>
            {stage.description || '本课程从基础概念出发，系统讲解完整的工作流程。通过实战案例帮助你建立专业的思维方式。'}
          </Text>
          <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
            <Text style={styles.descExpand}>{descExpanded ? '收起' : '展开全部'}</Text>
          </TouchableOpacity>
        </View>

        {/* 课程目录 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>课程目录</Text>
          <Text style={styles.sectionLink}>共 {scenes.length} 节</Text>
        </View>

        {/* 场景列表 */}
        <View style={styles.chapterGroup}>
          <View style={styles.chapterLessons}>
            {scenes.map((scene, index) => (
              <SceneItem key={scene.id} scene={scene} index={index} total={scenes.length} />
            ))}
          </View>
        </View>

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
  lessonIndex: {
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