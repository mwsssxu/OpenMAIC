import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  gold: '#f59e0b',
  goldLight: '#fef3c7',
  blue: '#2563eb',
  blueLight: '#dbeafe',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
};

// 笔记数据
const notesData = {
  today: [
    { id: '1', title: '数据可视化最佳实践', preview: '柱状图适合对比分类数据，折线图适合展示趋势变化。避免使用饼图展示超过5个分类...', category: '数据分析', color: 'coral', starred: true, time: '2小时前' },
    { id: '2', title: 'Python 装饰器笔记', preview: '@staticmethod 和 @classmethod 的区别：前者不接收隐式参数，后者接收 cls 作为第一个参数...', category: 'Python', color: 'mint', starred: false, time: '5小时前' },
    { id: '3', title: '色彩理论：暖色调运用', preview: '暖色（红橙黄）在UI中能传达活力与亲近感，但需注意大面积使用可能造成视觉疲劳...', category: 'UI 设计', color: 'gold', starred: false, time: '昨天 18:30' },
  ],
  thisWeek: [
    { id: '4', title: 'SQL JOIN 类型总结', preview: 'INNER JOIN 返回两表交集，LEFT JOIN 返回左表全部，RIGHT JOIN 返回右表全部...', category: '数据库', color: 'blue', starred: true, time: '周一' },
    { id: '5', title: '设计模式：观察者模式', preview: '定义一对多依赖，当一个对象状态改变时所有依赖者自动收到通知。适用于事件系统...', category: '架构', color: 'purple', starred: false, time: '周日' },
  ],
};

// 筛选标签
const filterTabs = [
  { key: 'all', label: '全部' },
  { key: 'data', label: '数据分析' },
  { key: 'python', label: 'Python' },
  { key: 'ui', label: 'UI 设计' },
  { key: 'fav', label: '收藏' },
];

// 颜色映射
const colorMap = {
  coral: { bg: iOSColors.accentLight, stroke: iOSColors.accent, tagBg: '#fce8e0', tagText: '#c45a1a', icon: 'bar-chart' },
  mint: { bg: iOSColors.secondaryLight, stroke: iOSColors.secondary, tagBg: '#e8f5f5', tagText: '#1a8a8a', icon: 'code' },
  gold: { bg: iOSColors.goldLight, stroke: iOSColors.gold, tagBg: '#fef3c7', tagText: '#f59e0b', icon: 'sunny' },
  blue: { bg: iOSColors.blueLight, stroke: iOSColors.blue, tagBg: '#dbeafe', tagText: '#2563eb', icon: 'server' },
  purple: { bg: iOSColors.purpleLight, stroke: iOSColors.purple, tagBg: '#ede9fe', tagText: '#8b5cf6', icon: 'book' },
};

// 笔记项组件
function NoteItem({ note, onPress }: { note: typeof notesData.today[0]; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [starred, setStarred] = useState(note.starred);
  const haptics = useHaptics();
  const colors = colorMap[note.color as keyof typeof colorMap];

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

  const toggleStar = () => {
    haptics.light();
    setStarred(!starred);
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.noteItem, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.noteThumb, { backgroundColor: colors.bg }]}>
          <Ionicons name={colors.icon as any} size={20} color={colors.stroke} />
        </View>
        <View style={styles.noteBody}>
          <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
          <Text style={styles.notePreview} numberOfLines={2}>{note.preview}</Text>
          <View style={styles.noteMeta}>
            <View style={[styles.noteTag, { backgroundColor: colors.tagBg }]}>
              <Text style={[styles.noteTagText, { color: colors.tagText }]}>{note.category}</Text>
            </View>
            <Text style={styles.noteTime}>{note.time}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.noteStar} onPress={toggleStar} activeOpacity={0.7}>
          <Ionicons
            name={starred ? 'star' : 'star-outline'}
            size={18}
            color={starred ? iOSColors.gold : iOSColors.muted}
          />
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

// 筛选标签组件
function FilterTab({ tab, active, onPress }: { tab: typeof filterTabs[0]; active: boolean; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const haptics = useHaptics();

  const handlePress = () => {
    haptics.light();
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
    onPress();
    setTimeout(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }, 100);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <Animated.View style={[
        styles.filterTab,
        active && styles.filterTabActive,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
          {tab.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function NotesScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const totalNotes = notesData.today.length + notesData.thisWeek.length;

  const onRefresh = () => {
    setRefreshing(true);
    // 后续接入真实数据加载
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 笔记本Banner */}
        <View style={styles.notesBanner}>
          <View style={styles.notesBannerText}>
            <Text style={styles.notesBannerTitle}>{totalNotes} 条笔记</Text>
            <Text style={styles.notesBannerDesc}>今天写了 {notesData.today.length} 条，继续保持！</Text>
          </View>
          <View style={styles.notesBannerIcon}>
            <Text style={styles.notesBannerEmoji}>📝</Text>
            <Text style={styles.notesBannerPencil}>✏️</Text>
          </View>
        </View>

        {/* 搜索栏 */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={iOSColors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索笔记内容..."
            placeholderTextColor={iOSColors.muted}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* 筛选标签 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterTabsScroll}
        >
          <View style={styles.filterTabs}>
            {filterTabs.map(tab => (
              <FilterTab
                key={tab.key}
                tab={tab}
                active={activeFilter === tab.key}
                onPress={() => setActiveFilter(tab.key)}
              />
            ))}
          </View>
        </ScrollView>

        {/* 今天 */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>今天</Text>
          <Text style={styles.sectionCount}>{notesData.today.length} 条</Text>
        </View>
        <View style={styles.notesList}>
          {notesData.today.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              onPress={() => router.push(`/note/${note.id}` as any)}
            />
          ))}
        </View>

        {/* 本周 */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>本周</Text>
          <Text style={styles.sectionCount}>{notesData.thisWeek.length} 条</Text>
        </View>
        <View style={styles.notesList}>
          {notesData.thisWeek.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              onPress={() => router.push(`/note/${note.id}` as any)}
            />
          ))}
        </View>

        {/* 占位 */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 新建笔记按钮 */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          haptics.medium();
          router.push('/notes/new' as any);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
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
    paddingHorizontal: Spacing.md,
  },

  // Banner
  notesBanner: {
    borderRadius: Rounded.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 100,
    backgroundColor: '#fce8e0',
  },
  notesBannerText: {
    flex: 1,
  },
  notesBannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: iOSColors.fg,
    letterSpacing: -0.02,
    marginBottom: 4,
  },
  notesBannerDesc: {
    fontSize: 13,
    color: iOSColors.muted,
    lineHeight: 20,
  },
  notesBannerIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notesBannerEmoji: {
    fontSize: 32,
  },
  notesBannerPencil: {
    fontSize: 20,
    marginLeft: -8,
    marginTop: 16,
  },

  // Search
  searchBar: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: iOSColors.fg,
  },

  // Filter Tabs
  filterTabsScroll: {
    marginBottom: Spacing.md,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: Spacing.xs,
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
    fontSize: 13,
    fontWeight: '500',
    color: iOSColors.muted,
  },
  filterTabTextActive: {
    color: '#fff',
  },

  // Section
  sectionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: iOSColors.fg,
    letterSpacing: -0.01,
  },
  sectionCount: {
    fontSize: 12,
    color: iOSColors.accent,
    fontWeight: '500',
  },

  // Notes List
  notesList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  noteItem: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  noteThumb: {
    width: 44,
    height: 44,
    borderRadius: Rounded.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBody: {
    flex: 1,
    minWidth: 0,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.fg,
    letterSpacing: -0.005,
    marginBottom: 3,
  },
  notePreview: {
    fontSize: 12,
    color: iOSColors.muted,
    lineHeight: 18,
    marginBottom: 6,
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteTag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  noteTagText: {
    fontSize: 10,
    fontWeight: '500',
  },
  noteTime: {
    fontSize: 10,
    color: iOSColors.muted,
    opacity: 0.7,
  },
  noteStar: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 2,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: iOSColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: iOSColors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});