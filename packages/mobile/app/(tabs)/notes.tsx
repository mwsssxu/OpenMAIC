import { useState, useRef, useCallback } from 'react';
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
import { USE_NATIVE_DRIVER } from '@/lib/configs/animation';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Rounded, Spacing, Colors } from '@/lib/constants/theme';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { apiClient } from '@/lib/api-client';
import TabPageWrapper from '@/lib/components/TabPageWrapper';
import { showError } from '@/lib/utils/error-toast';
import { useResponsiveDimensions } from '@/lib/utils/responsive';

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

interface NoteItem {
  id: string;
  title: string;
  preview: string;
  category: string;
  starred: boolean;
  color: string;
  time: string;
  course_id?: string;
}

interface NotesData {
  today: NoteItem[];
  this_week: NoteItem[];
  total: number;
  today_count: number;
  week_count: number;
}

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
function NoteItem({ note, onPress, onStarToggle }: { note: NoteItem; onPress: () => void; onStarToggle: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [starred, setStarred] = useState(note.starred);
  const haptics = useHaptics();
  const colors = colorMap[note.color as keyof typeof colorMap] || colorMap.coral;

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

  const toggleStar = () => {
    haptics.light();
    setStarred(!starred);
    onStarToggle();
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
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    onPress();
    setTimeout(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
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
  const { isTablet } = useResponsiveDimensions();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [notesData, setNotesData] = useState<NotesData>({
    today: [],
    this_week: [],
    total: 0,
    today_count: 0,
    week_count: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 页面获得焦点时刷新（只使用useFocusEffect，避免与useEffect重复调用）
  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [activeFilter])
  );

  // 移除了useEffect，避免双重调用

  async function loadNotes() {
    try {
      setIsLoading(true);
      setError(null);
      const starredOnly = activeFilter === 'fav';
      const filter = activeFilter === 'all' || activeFilter === 'fav' ? undefined : activeFilter;
      const data = await apiClient.getPersonalNotes(1, 50, filter, starredOnly);
      setNotesData({
        today: data.today || [],
        this_week: data.this_week || [],
        total: data.total || 0,
        today_count: data.today_count || 0,
        week_count: data.week_count || 0,
      });
    } catch (err) {
      showError(err);
      console.error('Load notes error:', err);
      setError('加载笔记失败，请下拉重试');
    } finally {
      setIsLoading(false);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotes();
    setRefreshing(false);
  };

  const handleToggleStar = async (noteId: string) => {
    try {
      await apiClient.toggleNoteStar(noteId);
      // Refresh to get updated data
      await loadNotes();
    } catch (error) {
      showError(error);
      console.error('Toggle star error:', error);
    }
  };

  const totalNotes = notesData.today.length + notesData.this_week.length;

  // Loading state
  if (isLoading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="document-text-outline" size={48} color={iOSColors.muted} />
          <Text style={styles.loadingText}>加载笔记...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error && totalNotes === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={iOSColors.accent} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadNotes} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>重新加载</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
      <ScrollView
        style={[styles.scrollView, isTablet && styles.scrollViewTablet]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary.main]} tintColor={Colors.primary.main} />
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
              onStarToggle={() => handleToggleStar(note.id)}
            />
          ))}
        </View>

        {/* 本周 */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>本周</Text>
          <Text style={styles.sectionCount}>{notesData.this_week.length} 条</Text>
        </View>
        <View style={styles.notesList}>
          {notesData.this_week.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              onPress={() => router.push(`/note/${note.id}` as any)}
              onStarToggle={() => handleToggleStar(note.id)}
            />
          ))}
        </View>

        {/* 占位 */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 新建笔记按钮 */}
      {/* TODO: When implementing the note creation dialog/screen, add character limit hints:
          - Title: maxLength={50}, display "标题 ({title.length}/50)"
          - Content: maxLength={1000}, display "内容 ({content.length}/1000)"
      */}
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
  scrollViewTablet: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
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

  // Loading & Error
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  loadingText: {
    fontSize: 16,
    color: iOSColors.muted,
    marginTop: Spacing.sm,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  errorText: {
    fontSize: 16,
    color: iOSColors.fg,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Rounded.md,
    backgroundColor: iOSColors.accent,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});