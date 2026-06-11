import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import TabPageWrapper from '@/lib/components/TabPageWrapper';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { apiClient } from '@/lib/api-client';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { showError } from '@/lib/utils/error-toast';
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
  gold: '#f59e0b',
  goldLight: '#fef3c7',
  blue: '#2563eb',
  blueLight: '#dbeafe',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
  green: '#10b981',
  greenLight: '#d1fae5',
};

// 颜色映射
const colorMap: Record<string, { bg: string; text: string; stroke: string }> = {
  coral: { bg: '#fce8e0', text: '#c45a1a', stroke: iOSColors.accent },
  mint: { bg: '#e8f5f5', text: '#1a8a8a', stroke: iOSColors.secondary },
  gold: { bg: '#fef3c7', text: '#b45309', stroke: iOSColors.gold },
  blue: { bg: '#dbeafe', text: '#1d4ed8', stroke: iOSColors.blue },
  purple: { bg: '#ede9fe', text: '#7c3aed', stroke: iOSColors.purple },
};

// 笔记项接口（个人笔记+共享笔记统一）
interface MyNoteItem {
  id: string;
  title: string;
  content: string;
  preview?: string;
  course?: string;
  category?: string;
  starred?: boolean;
  color?: string;
  tags?: string[];
  visibility?: string;
  price?: number;
  rating?: number;
  rating_count?: number;
  purchase_count?: number;
  is_personal?: boolean;
  created_at: string;
}

// 格式化时间显示
function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return '刚刚';
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays === 7) return '一周前';

    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  } catch {
    return dateStr;
  }
}

// 格式化日期显示
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch {
    return dateStr;
  }
}

export default function NotesPage() {
  const router = useRouter();
  const haptics = useHaptics();
  const { t } = useI18n();

  const [notes, setNotes] = useState<MyNoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // 加载笔记（用户所有笔记：个人+共享）
  const loadNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getPersonalNotes(1, 100, undefined, undefined, true);
      setNotes(data?.notes || []);
    } catch (err: any) {
      setError(err.message || '加载失败');
      console.error('Load notes error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 页面聚焦时加载
  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  // 刷新
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotes();
    setIsRefreshing(false);
  };

  // 搜索过滤
  const filteredNotes = notes.filter(note => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return note.title.toLowerCase().includes(query) ||
           (note.preview || note.content || '').toLowerCase().includes(query);
  });

  // 按时间分组
  const todayNotes = filteredNotes.filter(note => {
    const date = new Date(note.created_at);
    const now = new Date();
    return date.toDateString() === now.toDateString();
  });

  const weekNotes = filteredNotes.filter(note => {
    const date = new Date(note.created_at);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo && date.toDateString() !== now.toDateString();
  });

  // 笔记卡片组件
  const NoteCard = ({ note, colorKey = 'coral' }: { note: MyNoteItem; colorKey?: string }) => {
    const colors = colorMap[colorKey] || colorMap.coral;

    return (
      <TouchableOpacity
        style={styles.noteItem}
        onPress={() => {
          haptics.light();
          const source = note.is_personal ? 'personal' : 'shared';
          router.push(`/note/${note.id}?source=${source}` as any);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.noteThumb, { backgroundColor: colors.bg }]}>
          <Ionicons name="document-text" size={24} color={colors.stroke} />
        </View>
        <View style={styles.noteBody}>
          <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
          <Text style={styles.notePreview} numberOfLines={2}>
            {note.preview || note.content?.slice(0, 80) || ''}
          </Text>
          <View style={styles.noteMeta}>
            <View style={[styles.noteTag, { backgroundColor: colors.bg }]}>
              <Text style={[styles.noteTagText, { color: colors.text }]}>
                {note.visibility === 'paid' ? `${note.price ?? 0}积分` : '免费'}
              </Text>
            </View>
            <Text style={styles.noteTime}>{formatTime(note.created_at)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.noteStar}
          onPress={() => haptics.light()}
          activeOpacity={0.7}
        >
          <Ionicons
            name={(note.rating ?? 0) > 0 ? 'star' : 'star-outline'}
            size={14}
            color={(note.rating ?? 0) > 0 ? iOSColors.gold : iOSColors.muted}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // 加载状态
  if (isLoading && !isRefreshing) {
    return (
      <TabPageWrapper hasHeader>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={iOSColors.accent} />
          <Text style={styles.loadingText}>加载笔记...</Text>
        </View>
      </TabPageWrapper>
    );
  }

  // 错误状态
  if (error && notes.length === 0) {
    return (
      <TabPageWrapper hasHeader>
        <View style={styles.errorContainer}>
          <Ionicons name="document-text-outline" size={48} color={iOSColors.muted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadNotes} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>重新加载</Text>
          </TouchableOpacity>
        </View>
      </TabPageWrapper>
    );
  }

  // 计算颜色分配
  const getColorKey = (index: number) => {
    const keys = ['coral', 'mint', 'gold', 'blue', 'purple'];
    return keys[index % keys.length];
  };

  return (
    <TabPageWrapper hasHeader>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={iOSColors.accent}
          />
        }
      >
        {/* Banner */}
        <LinearGradient
          colors={['#fce8e0', '#f5f3f2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.notesBanner}
        >
          <View style={styles.notesBannerText}>
            <Text style={styles.notesBannerTitle}>
              {t('note.count', { count: notes.length })}
            </Text>
            <Text style={styles.notesBannerDesc}>
              {todayNotes.length > 0
                ? `今天写了 ${todayNotes.length} 条，继续保持！`
                : '开始记录你的学习笔记'
              }
            </Text>
          </View>
          {/* 插图区域 */}
          <View style={styles.notesBannerIllustration}>
            <Ionicons name="book" size={40} color={iOSColors.accent} />
          </View>
        </LinearGradient>

        {/* 搜索栏 */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={iOSColors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索笔记内容..."
            placeholderTextColor={iOSColors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={iOSColors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* 筛选标签 */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]}
            onPress={() => { haptics.light(); setActiveFilter('all'); }}
          >
            <Text style={[styles.filterTabText, activeFilter === 'all' && styles.filterTabTextActive]}>
              全部
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'free' && styles.filterTabActive]}
            onPress={() => { haptics.light(); setActiveFilter('free'); }}
          >
            <Text style={[styles.filterTabText, activeFilter === 'free' && styles.filterTabTextActive]}>
              免费
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'paid' && styles.filterTabActive]}
            onPress={() => { haptics.light(); setActiveFilter('paid'); }}
          >
            <Text style={[styles.filterTabText, activeFilter === 'paid' && styles.filterTabTextActive]}>
              付费
            </Text>
          </TouchableOpacity>
        </View>

        {/* 今天 */}
        {todayNotes.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionTitle}>今天</Text>
              <Text style={styles.sectionCount}>{todayNotes.length} 条</Text>
            </View>
            <View style={styles.notesList}>
              {todayNotes.map((note, index) => (
                <NoteCard key={note.id} note={note} colorKey={getColorKey(index)} />
              ))}
            </View>
          </View>
        )}

        {/* 本周 */}
        {weekNotes.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionTitle}>本周</Text>
              <Text style={styles.sectionCount}>{weekNotes.length} 条</Text>
            </View>
            <View style={styles.notesList}>
              {weekNotes.map((note, index) => (
                <NoteCard key={note.id} note={note} colorKey={getColorKey(index + todayNotes.length)} />
              ))}
            </View>
          </View>
        )}

        {/* 全部笔记（无分组时直接显示） */}
        {todayNotes.length === 0 && weekNotes.length === 0 && filteredNotes.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionTitle}>我的笔记</Text>
              <Text style={styles.sectionCount}>{filteredNotes.length} 条</Text>
            </View>
            <View style={styles.notesList}>
              {filteredNotes.map((note, index) => (
                <NoteCard key={note.id} note={note} colorKey={getColorKey(index)} />
              ))}
            </View>
          </View>
        )}

        {/* 空状态 */}
        {filteredNotes.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={iOSColors.muted} />
            <Text style={styles.emptyTitle}>暂无笔记</Text>
            <Text style={styles.emptyDesc}>
              {searchQuery ? '没有找到匹配的笔记' : '点击右上角开始写笔记'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => {
                  haptics.light();
                  router.push('/notes/new' as any);
                }}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyButtonText}>写笔记</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 底部占位 */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 悬浮新建按钮 */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => {
          haptics.medium();
          router.push('/notes/new' as any);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </TabPageWrapper>
  );
}

const styles = StyleSheet.create({
  // 容器
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: Spacing.sm,
  },
  errorText: {
    fontSize: 16,
    color: iOSColors.fg,
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

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },

  // Banner
  notesBanner: {
    borderRadius: Rounded.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 100,
  },
  notesBannerText: {
    flex: 1,
  },
  notesBannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: iOSColors.fg,
    marginBottom: 4,
  },
  notesBannerDesc: {
    fontSize: 13,
    color: iOSColors.muted,
    lineHeight: 18,
  },
  notesBannerIllustration: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 搜索栏
  searchBar: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    padding: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    minHeight: 44,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: iOSColors.fg,
  },

  // 筛选标签
  filterTabs: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: iOSColors.surface,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
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

  // 区块
  sectionBlock: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  sectionCount: {
    fontSize: 12,
    color: iOSColors.accent,
    fontWeight: '500',
  },

  // 笔记列表
  notesList: {
    gap: Spacing.sm,
  },

  // 笔记卡片
  noteItem: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
    minHeight: 44,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
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
    marginBottom: 3,
  },
  notePreview: {
    fontSize: 12,
    color: iOSColors.muted,
    lineHeight: 16,
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 6,
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
  },

  // 空状态
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: iOSColors.fg,
    marginTop: Spacing.md,
  },
  emptyDesc: {
    fontSize: 13,
    color: iOSColors.muted,
    marginTop: 4,
  },
  emptyButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Rounded.md,
    backgroundColor: iOSColors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // 悬浮按钮
  fabButton: {
    position: 'absolute',
    right: Spacing.md,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: iOSColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});