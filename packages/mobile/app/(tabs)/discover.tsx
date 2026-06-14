import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiClient } from '@/lib/api-client';
import { showError } from '@/lib/utils/error-toast';
import { useState, useCallback, useEffect } from 'react';
import TabPageWrapper from '@/lib/components/TabPageWrapper';

interface CourseItem {
  id: string;
  name: string;
  description?: string;
  scenes_count?: number;
  completion_status?: string;
  is_shared?: boolean;
}

const CATEGORY_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  'AI': { icon: 'hardware-chip', color: '#6366f1' },
  '编程': { icon: 'code-slash', color: '#3b82f6' },
  '数据': { icon: 'bar-chart', color: '#10b981' },
  '设计': { icon: 'brush', color: '#f59e0b' },
  '语言': { icon: 'language', color: '#ef4444' },
  '数学': { icon: 'calculator', color: '#8b5cf6' },
  '商业': { icon: 'briefcase', color: '#06b6d4' },
};

function guessCategory(name: string): string {
  const lower = name.toLowerCase();
  if (/ai|人工智能|机器学习|深度学习|llm/.test(lower)) return 'AI';
  if (/编程|代码|python|java|react|开发/.test(lower)) return '编程';
  if (/数据|分析|sql|pandas|统计/.test(lower)) return '数据';
  if (/设计|ui|ux|产品/.test(lower)) return '设计';
  if (/英语|语言|日语/.test(lower)) return '语言';
  if (/数学|微积分|线性/.test(lower)) return '数学';
  if (/商业|营销|管理|金融/.test(lower)) return '商业';
  return 'AI';
}

export default function DiscoverScreen() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [sharedCourses, setSharedCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [myRes, sharedRes] = await Promise.allSettled([
        apiClient.getClassrooms(),
        apiClient.discoverSharedClassrooms(10),
      ]);
      if (myRes.status === 'fulfilled') {
        setCourses(Array.isArray(myRes.value) ? myRes.value : myRes.value?.classrooms || []);
      }
      if (sharedRes.status === 'fulfilled') {
        setSharedCourses(Array.isArray(sharedRes.value) ? sharedRes.value : []);
      }
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const openCourse = (id: string) => {
    router.navigate(`/course/${id}` as any);
  };

  // 按分类聚合
  const byCategory = courses.reduce<Record<string, CourseItem[]>>((acc, c) => {
    const cat = guessCategory(c.name);
    (acc[cat] ||= []).push(c);
    return acc;
  }, {});
  const categories = Object.keys(byCategory);

  if (loading) {
    return (
      <TabPageWrapper>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary.main} />
        </View>
      </TabPageWrapper>
    );
  }

  return (
    <TabPageWrapper>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.main} />}
      >
        {/* 头部 */}
        <View style={styles.header}>
          <Ionicons name="compass" size={40} color={Colors.primary.main} />
          <Text style={styles.title}>发现课程</Text>
          <Text style={styles.subtitle}>{courses.length} 门课程等你探索</Text>
        </View>

        {/* 共享课堂精选 */}
        {sharedCourses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>精选共享</Text>
            {sharedCourses.slice(0, 5).map((c) => (
              <TouchableOpacity key={c.id} style={styles.listItem} onPress={() => openCourse(c.id)} activeOpacity={0.7}>
                <Ionicons name="star" size={18} color={Colors.accent.main} />
                <View style={styles.listContent}>
                  <Text style={styles.listText} numberOfLines={1}>{c.name}</Text>
                  {c.description ? <Text style={styles.listDesc} numberOfLines={1}>{c.description}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.neutral.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 按分类展示 */}
        {categories.map((cat) => {
          const cfg = CATEGORY_ICONS[cat] || CATEGORY_ICONS['AI'];
          const items = byCategory[cat];
          return (
            <View key={cat} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.catIcon, { backgroundColor: cfg.color + '18' }]}>
                  <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                </View>
                <Text style={styles.sectionTitle}>{cat}</Text>
                <Text style={styles.countBadge}>{items.length}</Text>
              </View>
              <View style={styles.cardGrid}>
                {items.slice(0, 4).map((c) => (
                  <TouchableOpacity key={c.id} style={styles.card} onPress={() => openCourse(c.id)} activeOpacity={0.7}>
                    <View style={[styles.cardIcon, { backgroundColor: cfg.color + '18' }]}>
                      <Ionicons name={cfg.icon} size={24} color={cfg.color} />
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={2}>{c.name}</Text>
                    {c.scenes_count != null && (
                      <Text style={styles.cardDesc}>{c.scenes_count} 个场景</Text>
                    )}
                    {c.completion_status === 'completed' && (
                      <View style={styles.doneBadge}>
                        <Text style={styles.doneText}>已学完</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        {/* 空态 */}
        {courses.length === 0 && sharedCourses.length === 0 && (
          <View style={styles.emptyWrap}>
            <Ionicons name="school-outline" size={64} color={Colors.neutral.textMuted} />
            <Text style={styles.emptyTitle}>还没有课程</Text>
            <Text style={styles.emptyDesc}>去课程 Tab 创建你的第一门课吧</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.navigate('/(tabs)/courses' as any)}>
              <Text style={styles.emptyBtnText}>去看课程</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </TabPageWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: Spacing.lg,
    alignItems: 'center',
    backgroundColor: Colors.neutral.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.neutral.textPrimary, marginTop: Spacing.sm },
  subtitle: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  section: {
    margin: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.neutral.card,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: Colors.neutral.textPrimary },
  catIcon: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  countBadge: {
    marginLeft: 6, paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: Colors.neutral.border, borderRadius: 10,
    fontSize: 11, color: Colors.neutral.textSecondary, overflow: 'hidden',
  },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%', padding: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: Colors.neutral.background, borderRadius: Rounded.md,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.neutral.border,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm,
  },
  cardTitle: { fontSize: 13, fontWeight: '500', color: Colors.neutral.textPrimary, textAlign: 'center' },
  cardDesc: { fontSize: 11, color: Colors.neutral.textSecondary, marginTop: 2 },
  doneBadge: {
    marginTop: 4, paddingHorizontal: 6, paddingVertical: 1,
    backgroundColor: '#dcfce7', borderRadius: 4,
  },
  doneText: { fontSize: 10, color: '#16a34a', fontWeight: '500' },
  listItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, backgroundColor: Colors.neutral.background,
    borderRadius: Rounded.sm, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.neutral.border,
  },
  listContent: { flex: 1, marginLeft: Spacing.sm },
  listText: { fontSize: 14, color: Colors.neutral.textPrimary, fontWeight: '500' },
  listDesc: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral.textPrimary, marginTop: Spacing.md },
  emptyDesc: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  emptyBtn: {
    marginTop: Spacing.lg, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: Colors.primary.main, borderRadius: Rounded.md,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
