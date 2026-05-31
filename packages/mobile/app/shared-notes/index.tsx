import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { apiClient } from '@/lib/api-client';
import TabPageWrapper from '@/lib/components/TabPageWrapper';
import { useResponsiveDimensions } from '@/lib/utils/responsive';
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
  green: '#10b981',
  greenLight: '#d1fae5',
};

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

interface MyShareItem {
  share_code: string;
  title: string;
  original_name: string;
  is_public: boolean;
  view_count: number;
  like_count: number;
  created_at: string;
}

interface EarningsInfo {
  total_earnings: number;
  total_purchases: number;
  notes_count: number;
}

// 筛选标签
const marketFilters = [
  { key: 'all', label: '全部' },
  { key: 'public', label: '免费' },
  { key: 'paid', label: '付费' },
];

const sortOptions = [
  { key: 'recent', label: '最新' },
  { key: 'popular', label: '热门' },
  { key: 'rating', label: '评分' },
];

// 笔记卡片组件
function NoteCard({ note, onPress }: { note: SharedNoteItem; onPress: () => void }) {
  const scaleAnim = useState(new Animated.Value(1))[0];
  const haptics = useHaptics();

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

  const isPaid = note.visibility === 'paid' && note.price > 0;

  return (
    <TouchableOpacity
      onPress={() => { haptics.light(); onPress(); }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.noteCard, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.noteCardHeader}>
          <Text style={styles.noteCardTitle} numberOfLines={2}>{note.title}</Text>
          {isPaid && (
            <View style={styles.priceTag}>
              <Ionicons name="diamond" size={12} color={iOSColors.gold} />
              <Text style={styles.priceText}>{note.price}</Text>
            </View>
          )}
          {!isPaid && (
            <View style={styles.freeTag}>
              <Text style={styles.freeText}>免费</Text>
            </View>
          )}
        </View>
        <View style={styles.noteCardMeta}>
          {note.rating > 0 && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color={iOSColors.gold} />
              <Text style={styles.ratingText}>{note.rating.toFixed(1)}</Text>
            </View>
          )}
          <Text style={styles.purchaseText}>{note.purchase_count} 人购买</Text>
          {note.is_purchased && (
            <View style={styles.purchasedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={iOSColors.green} />
              <Text style={styles.purchasedText}>已购买</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// 我的笔记卡片
function MyNoteCard({ note, onPress }: { note: MyShareItem; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View style={styles.myNoteCard}>
        <View style={styles.myNoteHeader}>
          <Text style={styles.myNoteTitle} numberOfLines={2}>{note.title}</Text>
          <View style={[styles.statusTag, note.is_public ? styles.publicTag : styles.privateTag]}>
            <Text style={[styles.statusText, note.is_public ? styles.publicText : styles.privateText]}>
              {note.is_public ? '公开' : '私有'}
            </Text>
          </View>
        </View>
        <View style={styles.myNoteMeta}>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={14} color={iOSColors.muted} />
            <Text style={styles.statText}>{note.view_count}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={14} color={iOSColors.muted} />
            <Text style={styles.statText}>{note.like_count}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SharedNotesScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const { isTablet } = useResponsiveDimensions();

  const [activeTab, setActiveTab] = useState<'market' | 'mine'>('market');
  const [marketFilter, setMarketFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 市场数据
  const [marketNotes, setMarketNotes] = useState<SharedNoteItem[]>([]);
  const [marketPage, setMarketPage] = useState(1); // 用于后续分页加载

  // 我的数据
  const [myNotes, setMyNotes] = useState<MyShareItem[]>([]);
  const [earnings, setEarnings] = useState<EarningsInfo | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'market') {
        loadMarketNotes();
      } else {
        loadMyNotes();
      }
    }, [activeTab, marketFilter, sortBy])
  );

  async function loadMarketNotes() {
    try {
      setIsLoading(true);
      const data = await apiClient.getSharedNotes({
        page: 1,
        limit: 50,
        visibility: marketFilter === 'all' ? undefined : marketFilter,
        sort: sortBy,
        search: searchText.trim() || undefined,
      });
      setMarketNotes(data.items || []);
      setMarketPage(1);
    } catch (err) {
      console.error('Load market notes error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMyNotes() {
    try {
      setIsLoading(true);
      const [sharesData, earningsData] = await Promise.all([
        apiClient.getMySharedNotes(),
        apiClient.getMyEarnings(),
      ]);
      setMyNotes(sharesData.shares || []);
      setEarnings(earningsData);
    } catch (err) {
      console.error('Load my notes error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'market') {
      await loadMarketNotes();
    } else {
      await loadMyNotes();
    }
    setRefreshing(false);
  };

  const handleNotePress = (noteId: string) => {
    router.push(`/shared-notes/${noteId}` as any);
  };

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
        {/* 导航栏 */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.replace('/(tabs)' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>共享笔记</Text>
          <View style={styles.navRight} />
        </View>

        {/* 双Tab切换 */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'market' && styles.tabButtonActive]}
            onPress={() => { haptics.light(); setActiveTab('market'); }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'market' ? 'storefront' : 'storefront-outline'}
              size={18}
              color={activeTab === 'market' ? iOSColors.accent : iOSColors.muted}
            />
            <Text style={[styles.tabText, activeTab === 'market' && styles.tabTextActive]}>
              市场
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'mine' && styles.tabButtonActive]}
            onPress={() => { haptics.light(); setActiveTab('mine'); }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'mine' ? 'folder' : 'folder-outline'}
              size={18}
              color={activeTab === 'mine' ? iOSColors.accent : iOSColors.muted}
            />
            <Text style={[styles.tabText, activeTab === 'mine' && styles.tabTextActive]}>
              我的
            </Text>
          </TouchableOpacity>
        </View>

        {/* 市场Tab */}
        {activeTab === 'market' && (
          <ScrollView
            style={[styles.scrollView, isTablet && styles.scrollViewTablet]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* 搜索栏 */}
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={iOSColors.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="搜索笔记..."
                placeholderTextColor={iOSColors.muted}
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>

            {/* 筛选和排序 */}
            <View style={styles.filtersRow}>
              <View style={styles.filterTabs}>
                {marketFilters.map(filter => (
                  <TouchableOpacity
                    key={filter.key}
                    style={[styles.filterTab, marketFilter === filter.key && styles.filterTabActive]}
                    onPress={() => { haptics.light(); setMarketFilter(filter.key); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterText, marketFilter === filter.key && styles.filterTextActive]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.sortSelect}>
                {sortOptions.map(sort => (
                  <TouchableOpacity
                    key={sort.key}
                    style={[styles.sortBtn, sortBy === sort.key && styles.sortBtnActive]}
                    onPress={() => { haptics.light(); setSortBy(sort.key); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.sortText, sortBy === sort.key && styles.sortTextActive]}>
                      {sort.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 笔记列表 */}
            <View style={styles.notesGrid}>
              {marketNotes.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onPress={() => handleNotePress(note.id)}
                />
              ))}
              {marketNotes.length === 0 && !isLoading && (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={48} color={iOSColors.muted} />
                  <Text style={styles.emptyText}>暂无笔记</Text>
                </View>
              )}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* 我的Tab */}
        {activeTab === 'mine' && (
          <ScrollView
            style={[styles.scrollView, isTablet && styles.scrollViewTablet]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* 收益统计卡片 */}
            {earnings && (
              <View style={styles.earningsCard}>
                <View style={styles.earningsHeader}>
                  <Ionicons name="diamond" size={20} color={iOSColors.gold} />
                  <Text style={styles.earningsTitle}>收益统计</Text>
                </View>
                <View style={styles.earningsStats}>
                  <View style={styles.earningsStat}>
                    <Text style={styles.earningsValue}>{earnings.total_earnings}</Text>
                    <Text style={styles.earningsLabel}>总收益（积分）</Text>
                  </View>
                  <View style={styles.earningsDivider} />
                  <View style={styles.earningsStat}>
                    <Text style={styles.earningsValue}>{earnings.total_purchases}</Text>
                    <Text style={styles.earningsLabel}>购买次数</Text>
                  </View>
                  <View style={styles.earningsDivider} />
                  <View style={styles.earningsStat}>
                    <Text style={styles.earningsValue}>{earnings.notes_count}</Text>
                    <Text style={styles.earningsLabel}>已发布</Text>
                  </View>
                </View>
              </View>
            )}

            {/* 我的笔记列表 */}
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionTitle}>我发布的笔记</Text>
            </View>
            <View style={styles.myNotesList}>
              {myNotes.map((note, index) => (
                <MyNoteCard
                  key={note.share_code || index}
                  note={note}
                  onPress={() => {}}
                />
              ))}
              {myNotes.length === 0 && !isLoading && (
                <View style={styles.emptyState}>
                  <Ionicons name="cloud-upload-outline" size={48} color={iOSColors.muted} />
                  <Text style={styles.emptyText}>还没有发布笔记</Text>
                  <Text style={styles.emptyHint}>点击下方按钮发布第一条笔记</Text>
                </View>
              )}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* 发布按钮 */}
        {activeTab === 'mine' && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              haptics.medium();
              router.push('/shared-notes/new' as any);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </TabPageWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
  },

  // Navigation
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: iOSColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  navRight: {
    width: 44,
  },

  // Tab切换
  tabSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Rounded.md,
    backgroundColor: iOSColors.surface,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  tabButtonActive: {
    backgroundColor: iOSColors.accentLight,
    borderColor: iOSColors.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: iOSColors.muted,
  },
  tabTextActive: {
    color: iOSColors.accent,
  },

  // ScrollView
  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  scrollViewTablet: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },

  // 搜索栏
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

  // 筛选和排序
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: iOSColors.surface,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  filterTabActive: {
    backgroundColor: iOSColors.accent,
    borderColor: iOSColors.accent,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '500',
    color: iOSColors.muted,
  },
  filterTextActive: {
    color: '#fff',
  },
  sortSelect: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  sortBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Rounded.sm,
  },
  sortBtnActive: {
    backgroundColor: iOSColors.secondaryLight,
  },
  sortText: {
    fontSize: 11,
    color: iOSColors.muted,
  },
  sortTextActive: {
    color: iOSColors.secondary,
    fontWeight: '500',
  },

  // 笔记网格
  notesGrid: {
    gap: Spacing.sm,
  },

  // 笔记卡片
  noteCard: {
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: Rounded.md,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  noteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  noteCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: iOSColors.fg,
    flex: 1,
    marginRight: Spacing.sm,
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: iOSColors.goldLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '600',
    color: iOSColors.gold,
  },
  freeTag: {
    backgroundColor: iOSColors.secondaryLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  freeText: {
    fontSize: 12,
    fontWeight: '500',
    color: iOSColors.secondary,
  },
  noteCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '500',
    color: iOSColors.gold,
  },
  purchaseText: {
    fontSize: 12,
    color: iOSColors.muted,
  },
  purchasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  purchasedText: {
    fontSize: 12,
    fontWeight: '500',
    color: iOSColors.green,
  },

  // 收益卡片
  earningsCard: {
    backgroundColor: iOSColors.goldLight,
    borderRadius: Rounded.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  earningsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  earningsStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningsStat: {
    flex: 1,
    alignItems: 'center',
  },
  earningsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: iOSColors.gold,
  },
  earningsLabel: {
    fontSize: 11,
    color: iOSColors.muted,
    marginTop: 2,
  },
  earningsDivider: {
    width: 1,
    height: 40,
    backgroundColor: iOSColors.border,
  },

  // 我的笔记列表
  sectionLabel: {
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  myNotesList: {
    gap: Spacing.sm,
  },

  // 我的笔记卡片
  myNoteCard: {
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: Rounded.md,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  myNoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  myNoteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.fg,
    flex: 1,
  },
  statusTag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  publicTag: {
    backgroundColor: iOSColors.greenLight,
  },
  privateTag: {
    backgroundColor: iOSColors.border,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  publicText: {
    color: iOSColors.green,
  },
  privateText: {
    color: iOSColors.muted,
  },
  myNoteMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: iOSColors.muted,
  },

  // 空状态
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: iOSColors.muted,
    marginTop: Spacing.sm,
  },
  emptyHint: {
    fontSize: 13,
    color: iOSColors.muted,
    marginTop: Spacing.xs,
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