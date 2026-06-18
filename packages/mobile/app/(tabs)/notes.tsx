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
import { showError, showSuccess } from '@/lib/utils/error-toast';
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

// 个人笔记接口
interface MyNoteItem {
  id: string;
  title: string;
  content: string;
  preview?: string;
  course?: string;
  course_id?: string;
  scene_id?: string;
  scene_title?: string;
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

// 共享笔记接口
interface SharedNoteItem {
  id: string;
  user_id: string;
  title: string;
  visibility: string;
  price: number;
  tags: string;
  rating: number;
  rating_count: number;
  purchase_count: number;
  is_purchased: boolean;
  created_at: string;
}

// 我共享出去的笔记接口
interface MyShareItem {
  id: string;
  title: string;
  visibility: string;
  price: number;
  rating: number;
  rating_count: number;
  purchase_count: number;
  status: string;
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

    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  } catch {
    return dateStr;
  }
}

const getColorKey = (index: number) => {
  const keys = ['coral', 'mint', 'gold', 'blue', 'purple'];
  return keys[index % keys.length];
};

export default function NotesPage() {
  const router = useRouter();
  const haptics = useHaptics();
  const { t } = useI18n();

  const [myNotes, setMyNotes] = useState<MyNoteItem[]>([]);
  const [sharedNotes, setSharedNotes] = useState<SharedNoteItem[]>([]);
  const [mySharedNotes, setMySharedNotes] = useState<MyShareItem[]>([]);
  const [totalNotesCount, setTotalNotesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'my' | 'market'>('my');

  // 加载数据
  const loadNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      // 我的笔记：只用个人笔记（不含共享）
      // 共享市场：市场笔记 + 我共享出去的笔记
      const [personalData, sharedMarketData, mySharedData] = await Promise.all([
        apiClient.getPersonalNotes(1, 100, undefined, undefined, false).catch(() => ({ today: [], this_week: [] })),
        apiClient.getSharedNotes({ page: 1, limit: 20 }).catch(() => ({ items: [] })),
        apiClient.getMySharedNotes().catch(() => ({ shares: [] })),
      ]);
      // 后端返回 today + this_week 两个数组，合并为完整列表
      const todayArr = personalData?.today || [];
      const weekArr = personalData?.this_week || [];
      setMyNotes([...todayArr, ...weekArr]);
      setTotalNotesCount(personalData?.total || 0);
      setSharedNotes(sharedMarketData?.items || []);
      setMySharedNotes(mySharedData?.shares || []);
    } catch (err: any) {
      console.error('Load notes error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotes();
    setIsRefreshing(false);
  };

  // 搜索过滤 - 我的笔记
  const filteredMyNotes = myNotes.filter(note => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return note.title.toLowerCase().includes(query) ||
           (note.preview || note.content || '').toLowerCase().includes(query);
  });

  // 搜索过滤 - 共享笔记
  const filteredSharedNotes = sharedNotes.filter(note => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return note.title.toLowerCase().includes(query);
  });

  // 我的笔记按时间分组
  const todayNotes = filteredMyNotes.filter(note => {
    const date = new Date(note.created_at);
    return date.toDateString() === new Date().toDateString();
  });

  const weekNotes = filteredMyNotes.filter(note => {
    const date = new Date(note.created_at);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo && date.toDateString() !== now.toDateString();
  });

  // 我的笔记卡片组件
  const MyNoteCard = ({ note, colorKey = 'coral' }: { note: MyNoteItem; colorKey?: string }) => {
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
              <Text style={[styles.noteTagText, { color: colors.text }]} numberOfLines={1}>
                {note.course || note.category || '学习笔记'}
              </Text>
            </View>
            {note.scene_title && (
              <View style={styles.noteSceneTag}>
                <Ionicons name="albums-outline" size={11} color={iOSColors.accent} />
                <Text style={styles.noteSceneText} numberOfLines={1}>{note.scene_title}</Text>
              </View>
            )}
            <Text style={styles.noteTime}>{formatTime(note.created_at)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.noteStar} onPress={() => haptics.light()} activeOpacity={0.7}>
          <Ionicons
            name={(note.rating ?? 0) > 0 ? 'star' : 'star-outline'}
            size={14}
            color={(note.rating ?? 0) > 0 ? iOSColors.gold : iOSColors.muted}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // 共享笔记卡片
  const SharedNoteCard = ({ note, index }: { note: SharedNoteItem; index: number }) => {
    const isPaid = note.visibility === 'paid' && note.price > 0;
    const colors = colorMap[getColorKey(index)] || colorMap.coral;
    return (
      <TouchableOpacity
        style={styles.noteItem}
        onPress={() => {
          haptics.light();
          router.push(`/note/${note.id}?source=shared` as any);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.noteThumb, { backgroundColor: isPaid ? iOSColors.goldLight : colors.bg }]}>
          <Ionicons name={isPaid ? 'diamond' : 'document-text'} size={24} color={isPaid ? iOSColors.gold : colors.stroke} />
        </View>
        <View style={styles.noteBody}>
          <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
          <View style={styles.noteMeta}>
            <View style={[styles.noteTag, { backgroundColor: isPaid ? iOSColors.goldLight : colors.bg }]}>
              <Text style={[styles.noteTagText, { color: isPaid ? '#b45309' : colors.text }]}>
                {isPaid ? `${note.price}积分` : '免费'}
              </Text>
            </View>
            {note.rating > 0 && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color={iOSColors.gold} />
                <Text style={styles.ratingText}>{note.rating.toFixed(1)}</Text>
              </View>
            )}
            <Text style={styles.noteTime}>{note.purchase_count}人购买</Text>
            {note.is_purchased && (
              <View style={styles.purchasedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={iOSColors.green} />
                <Text style={styles.purchasedText}>已购</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={iOSColors.muted} />
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
              {totalNotesCount} 篇笔记
            </Text>
            <Text style={styles.notesBannerDesc}>
              {todayNotes.length > 0
                ? `今天写了 ${todayNotes.length} 条，继续保持！`
                : '开始记录你的学习笔记'}
            </Text>
          </View>
          <View style={styles.notesBannerIllustration}>
            <Ionicons name="book" size={36} color={iOSColors.accent} />
            <TouchableOpacity
              style={styles.bannerWriteBtn}
              onPress={() => {
                haptics.medium();
                router.push('/notes/new' as any);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.bannerWriteBtnText}>写笔记</Text>
            </TouchableOpacity>
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

        {/* Tab切换：我的笔记 / 共享市场 */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'my' && styles.tabBtnActive]}
            onPress={() => { haptics.light(); setActiveTab('my'); }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'my' ? 'book' : 'book-outline'}
              size={16}
              color={activeTab === 'my' ? '#fff' : iOSColors.muted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'my' && styles.tabBtnTextActive]}>
              我的笔记
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'market' && styles.tabBtnActive]}
            onPress={() => { haptics.light(); setActiveTab('market'); }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'market' ? 'storefront' : 'storefront-outline'}
              size={16}
              color={activeTab === 'market' ? '#fff' : iOSColors.muted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'market' && styles.tabBtnTextActive]}>
              共享市场
            </Text>
          </TouchableOpacity>
        </View>

        {/* ====== 我的笔记 Tab ====== */}
        {activeTab === 'my' && (
          <>
            {todayNotes.length > 0 && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionLabel}>
                  <Text style={styles.sectionTitle}>今天</Text>
                  <Text style={styles.sectionCount}>{todayNotes.length} 条</Text>
                </View>
                <View style={styles.notesList}>
                  {todayNotes.map((note, index) => (
                    <MyNoteCard key={note.id} note={note} colorKey={getColorKey(index)} />
                  ))}
                </View>
              </View>
            )}

            {weekNotes.length > 0 && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionLabel}>
                  <Text style={styles.sectionTitle}>本周</Text>
                  <Text style={styles.sectionCount}>{weekNotes.length} 条</Text>
                </View>
                <View style={styles.notesList}>
                  {weekNotes.map((note, index) => (
                    <MyNoteCard key={note.id} note={note} colorKey={getColorKey(index + todayNotes.length)} />
                  ))}
                </View>
              </View>
            )}

            {todayNotes.length === 0 && weekNotes.length === 0 && filteredMyNotes.length > 0 && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionLabel}>
                  <Text style={styles.sectionTitle}>我的笔记</Text>
                  <Text style={styles.sectionCount}>{filteredMyNotes.length} 条</Text>
                </View>
                <View style={styles.notesList}>
                  {filteredMyNotes.map((note, index) => (
                    <MyNoteCard key={note.id} note={note} colorKey={getColorKey(index)} />
                  ))}
                </View>
              </View>
            )}

            {filteredMyNotes.length === 0 && !isLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={64} color={iOSColors.muted} />
                <Text style={styles.emptyTitle}>暂无笔记</Text>
                <Text style={styles.emptyDesc}>
                  {searchQuery ? '没有找到匹配的笔记' : '点击右下角开始写笔记'}
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
          </>
        )}

        {/* ====== 共享市场 Tab ====== */}
        {activeTab === 'market' && (
          <>
            {/* 我共享出去的笔记 */}
            {mySharedNotes.length > 0 && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionLabel}>
                  <Text style={styles.sectionTitle}>我共享的</Text>
                  <Text style={styles.sectionCount}>{mySharedNotes.length} 条</Text>
                </View>
                <View style={styles.notesList}>
                  {mySharedNotes.map((note, index) => {
                    const isPaid = note.visibility === 'paid' && note.price > 0;
                    return (
                      <TouchableOpacity
                        key={note.id || index}
                        style={styles.noteItem}
                        onPress={() => {
                          haptics.light();
                          router.push(`/note/${note.id}?source=shared` as any);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.noteThumb, { backgroundColor: isPaid ? iOSColors.goldLight : iOSColors.greenLight }]}>
                          <Ionicons name={isPaid ? 'diamond' : 'share'} size={22} color={isPaid ? iOSColors.gold : iOSColors.green} />
                        </View>
                        <View style={styles.noteBody}>
                          <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
                          <View style={styles.noteMeta}>
                            <View style={[styles.noteTag, { backgroundColor: isPaid ? iOSColors.goldLight : iOSColors.greenLight }]}>
                              <Text style={[styles.noteTagText, { color: isPaid ? '#b45309' : iOSColors.green }]}>
                                {isPaid ? `${note.price}积分` : '免费'}
                              </Text>
                            </View>
                            <View style={styles.statItem}>
                              <Ionicons name="cart-outline" size={12} color={iOSColors.muted} />
                              <Text style={styles.statText}>{note.purchase_count}</Text>
                            </View>
                            {note.rating > 0 && (
                              <View style={styles.statItem}>
                                <Ionicons name="star-outline" size={12} color={iOSColors.muted} />
                                <Text style={styles.statText}>{note.rating.toFixed(1)}</Text>
                              </View>
                            )}
                            <Text style={styles.noteTime}>{formatTime(note.created_at)}</Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={iOSColors.muted} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 市场热门笔记 */}
            {filteredSharedNotes.length > 0 && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionLabel}>
                  <Text style={styles.sectionTitle}>热门笔记</Text>
                  <Text style={styles.sectionCount}>{filteredSharedNotes.length} 条</Text>
                </View>
                <View style={styles.notesList}>
                  {filteredSharedNotes.map((note, index) => (
                    <SharedNoteCard key={note.id} note={note} index={index} />
                  ))}
                </View>
              </View>
            )}

            {filteredSharedNotes.length === 0 && mySharedNotes.length === 0 && !isLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="storefront-outline" size={64} color={iOSColors.muted} />
                <Text style={styles.emptyTitle}>暂无共享笔记</Text>
                <Text style={styles.emptyDesc}>
                  {searchQuery ? '没有找到匹配的笔记' : '成为第一个分享笔记的人'}
                </Text>
              </View>
            )}
          </>
        )}

        {/* 底部占位 */}
        <View style={{ height: 100 }} />
      </ScrollView>
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
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bannerWriteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: iOSColors.accent,
    borderRadius: Rounded.full,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  bannerWriteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
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

  // Tab切换
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.full,
    padding: 3,
    marginBottom: Spacing.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Rounded.full,
  },
  tabBtnActive: {
    backgroundColor: iOSColors.accent,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.muted,
  },
  tabBtnTextActive: {
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
    alignItems: 'center',
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
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 6,
  },
  noteTag: {
    maxWidth: '100%',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  noteSceneTag: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: iOSColors.accentLight,
  },
  noteSceneText: {
    maxWidth: 140,
    fontSize: 10,
    fontWeight: '500',
    color: iOSColors.accent,
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

  // 共享笔记特有样式
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '600',
    color: iOSColors.gold,
  },
  purchasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  purchasedText: {
    fontSize: 10,
    fontWeight: '500',
    color: iOSColors.green,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statText: {
    fontSize: 10,
    color: iOSColors.muted,
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
});
