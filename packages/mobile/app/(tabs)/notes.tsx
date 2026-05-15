import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, TextInput, Animated, Alert } from 'react-native';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing, SecondaryColorMap } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useHaptics } from '@/lib/hooks/use-haptics';

interface Note {
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

export default function NotesScreen() {
  const router = useRouter();
  const { onSuccess, onError } = useFeedback();
  const haptics = useHaptics();
  const [notes, setNotes] = useState<Note[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState('recent');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [price, setPrice] = useState('0');
  const fabScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();
  }, [sort]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [notesData, earningsData] = await Promise.all([
        apiClient.getNotes(1, 20, sort),
        apiClient.getMyNoteEarnings(),
      ]);
      setNotes(notesData.items || []);
      setEarnings(earningsData);
    } catch (error) {
      console.error('Load notes error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const onRefresh = useCallback(() => {
    loadData();
  }, [sort]);

  const purchaseNote = (noteId: string, notePrice: number) => {
    Alert.alert(
      '确认购买',
      `将花费 ${notePrice} 积分购买此笔记，确认吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认购买',
          onPress: async () => {
            haptics.medium();
            try {
              await apiClient.purchaseNote(noteId);
              haptics.success();
              onSuccess();
              loadData();
            } catch (error: any) {
              haptics.error();
              onError();
            }
          }
        }
      ]
    );
  };

  const publishNote = async () => {
    if (!title.trim() || !content.trim()) {
      haptics.error();
      onError();
      return;
    }

    haptics.light();
    try {
      await apiClient.publishNote(
        title.trim(),
        content.trim(),
        parseInt(price) > 0 ? 'paid' : 'public',
        parseInt(price) || 0
      );
      setShowPublishModal(false);
      setTitle('');
      setContent('');
      setPrice('0');
      haptics.success();
      onSuccess();
      loadData();
    } catch (error) {
      haptics.error();
      onError();
    }
  };

  const handleFabPressIn = () => {
    Animated.spring(fabScale, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handleFabPressOut = () => {
    Animated.spring(fabScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const renderNote = ({ item, index }: { item: Note; index: number }) => {
    const cardAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View
        style={[
          styles.noteItem,
          {
            opacity: cardAnim,
            transform: [
              {
                translateY: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.push(`/notes/${item.id}` as any)}
          activeOpacity={0.7}
        >
          <View style={styles.noteHeader}>
            <Text style={styles.noteTitle} numberOfLines={2}>{item.title}</Text>
            {item.price > 0 && (
              <View style={[styles.priceBadge, { backgroundColor: SecondaryColorMap.notes + '20', borderColor: SecondaryColorMap.notes }]}>
                <Ionicons name="diamond" size={12} color={SecondaryColorMap.notes} />
                <Text style={[styles.priceText, { color: SecondaryColorMap.notes }]}>{item.price}</Text>
              </View>
            )}
          </View>
          <View style={styles.noteStats}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={14} color={Colors.semantic.amber} />
              <Text style={styles.statText}>{item.rating.toFixed(1)}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="people" size={14} color={Colors.neutral.textMuted} />
              <Text style={styles.statText}>{item.purchase_count}</Text>
            </View>
            {item.rating_count > 0 && (
              <Text style={styles.ratingCount}>({item.rating_count}评)</Text>
            )}
          </View>
          {!item.is_purchased && item.price > 0 && (
            <TouchableOpacity
              style={[styles.buyButton, { backgroundColor: SecondaryColorMap.notes }]}
              onPress={() => purchaseNote(item.id, item.price)}
              activeOpacity={0.7}
            >
              <Ionicons name="cart" size={14} color={Colors.neutral.white} />
              <Text style={styles.buyButtonText}>购买</Text>
            </TouchableOpacity>
          )}
          {item.is_purchased && (
            <View style={[styles.purchasedBadge, { backgroundColor: Colors.semantic.green + '20' }]}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.semantic.green} />
              <Text style={[styles.purchasedText, { color: Colors.semantic.green }]}>已购买</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="document-text" size={24} color={SecondaryColorMap.notes} />
          <Text style={styles.headerTitle}>共享笔记</Text>
        </View>
      </View>

      {/* 我的收益卡片 */}
      {earnings && (
        <View style={[styles.earningsCard, { backgroundColor: SecondaryColorMap.notes }]}>
          <View style={styles.earningsDecor}>
            <Ionicons name="trending-up" size={60} color={Colors.neutral.white} style={{ opacity: 0.15 }} />
          </View>
          <Text style={styles.earningsTitle}>我的笔记收益</Text>
          <View style={styles.earningsStats}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsValue}>{earnings.total_earnings || 0}</Text>
              <Text style={styles.earningsLabel}>总收益</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsItem}>
              <Text style={styles.earningsValue}>{earnings.total_purchases || 0}</Text>
              <Text style={styles.earningsLabel}>购买次数</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsItem}>
              <Text style={styles.earningsValue}>{earnings.notes_count || 0}</Text>
              <Text style={styles.earningsLabel}>发布笔记</Text>
            </View>
          </View>
        </View>
      )}

      {/* 排序切换 */}
      <View style={styles.sortContainer}>
        {[
          { key: 'recent', label: '最新', icon: 'time' },
          { key: 'popular', label: '热门', icon: 'flame' },
          { key: 'rating', label: '高分', icon: 'star' },
        ].map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[
              styles.sortButton,
              sort === s.key && styles.activeSort,
              { backgroundColor: sort === s.key ? SecondaryColorMap.notes : Colors.neutral.backgroundAlt },
            ]}
            onPress={() => {
              haptics.light();
              setSort(s.key);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name={s.icon as any} size={14} color={sort === s.key ? Colors.neutral.white : Colors.neutral.textSecondary} />
            <Text style={[styles.sortText, sort === s.key && styles.activeSortText]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 笔记列表 */}
      <FlatList
        data={notes}
        renderItem={renderNote}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} colors={[SecondaryColorMap.notes]} />}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: SecondaryColorMap.notes + '15' }]}>
              <Ionicons name="document-text-outline" size={44} color={SecondaryColorMap.notes} />
            </View>
            <Text style={styles.emptyTitle}>暂无笔记</Text>
            <Text style={styles.emptyHint}>点击下方按钮分享你的第一条笔记</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* 发布按钮 FAB */}
      <TouchableOpacity
        style={styles.fabContainer}
        onPress={() => {
          haptics.medium();
          setShowPublishModal(true);
        }}
        onPressIn={handleFabPressIn}
        onPressOut={handleFabPressOut}
        activeOpacity={0.9}
      >
        <Animated.View style={[styles.fab, { backgroundColor: SecondaryColorMap.notes, transform: [{ scale: fabScale }] }]}>
          <Ionicons name="add" size={28} color={Colors.neutral.white} />
        </Animated.View>
      </TouchableOpacity>

      {/* 发布弹窗 */}
      <Modal visible={showPublishModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { backgroundColor: SecondaryColorMap.notes + '15' }]}>
              <Ionicons name="document-text" size={24} color={SecondaryColorMap.notes} />
              <Text style={styles.modalTitle}>发布笔记</Text>
            </View>

            <Text style={styles.inputLabel}>标题</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="笔记标题"
              placeholderTextColor={Colors.neutral.textMuted}
            />

            <Text style={styles.inputLabel}>内容</Text>
            <TextInput
              style={[styles.input, styles.contentInput]}
              value={content}
              onChangeText={setContent}
              placeholder="分享你的学习心得..."
              placeholderTextColor={Colors.neutral.textMuted}
              multiline
              numberOfLines={5}
            />

            <Text style={styles.inputLabel}>价格 (积分，0为免费)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              placeholderTextColor={Colors.neutral.textMuted}
              keyboardType="numeric"
            />

            <TouchableOpacity style={[styles.publishModalButton, { backgroundColor: SecondaryColorMap.notes }]} onPress={publishNote}>
              <Ionicons name="send" size={16} color={Colors.neutral.white} />
              <Text style={styles.publishModalButtonText}>发布</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => {
              haptics.light();
              setShowPublishModal(false);
            }}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },

  // 头部
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    backgroundColor: Colors.neutral.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral.textPrimary,
    marginLeft: Spacing.sm,
  },

  // 收益卡片
  earningsCard: {
    margin: Spacing.md,
    borderRadius: Rounded.lg,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  earningsDecor: {
    position: 'absolute',
    right: -10,
    top: -10,
  },
  earningsTitle: {
    fontSize: 14,
    color: Colors.neutral.white,
    opacity: 0.9,
  },
  earningsStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.md,
  },
  earningsItem: {
    alignItems: 'center',
  },
  earningsDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.neutral.white + '33',
  },
  earningsValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.neutral.white
  },
  earningsLabel: {
    fontSize: 12,
    color: Colors.neutral.white,
    opacity: 0.8,
    marginTop: Spacing.xs
  },

  // 排序
  sortContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: Rounded.full,
    marginRight: Spacing.sm,
  },
  activeSort: {
    shadowColor: SecondaryColorMap.notes,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sortText: {
    fontSize: 13,
    color: Colors.neutral.textSecondary,
    marginLeft: 4,
  },
  activeSortText: {
    color: Colors.neutral.white,
    fontWeight: '600'
  },

  // 列表
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl + 16
  },
  noteItem: {
    backgroundColor: Colors.neutral.card,
    marginBottom: Spacing.sm,
    borderRadius: Rounded.lg,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    overflow: 'hidden',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: Colors.neutral.textPrimary
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Rounded.sm,
    borderWidth: 1,
    marginLeft: Spacing.sm,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  noteStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  statText: {
    fontSize: 12,
    color: Colors.neutral.textSecondary,
    marginLeft: 2,
  },
  ratingCount: {
    fontSize: 12,
    color: Colors.neutral.textMuted,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: Rounded.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  buyButtonText: {
    color: Colors.neutral.white,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
  purchasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: Rounded.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  purchasedText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },

  // 空状态
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl + 16,
    paddingHorizontal: Spacing.lg,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyHint: {
    fontSize: 13,
    color: Colors.neutral.textMuted,
    textAlign: 'center',
  },

  // FAB
  fabContainer: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SecondaryColorMap.notes,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // Modal
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.lg,
    borderRadius: Rounded.lg,
    marginHorizontal: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Rounded.sm,
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.textPrimary,
    marginLeft: Spacing.sm,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.neutral.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '500'
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderRadius: Rounded.sm,
    padding: Spacing.md - 2,
    marginBottom: Spacing.sm + 3,
    backgroundColor: Colors.neutral.backgroundAlt,
    color: Colors.neutral.textPrimary,
    fontSize: 16,
  },
  contentInput: {
    height: 100,
    textAlignVertical: 'top'
  },
  publishModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm + 2,
    borderRadius: Rounded.sm,
  },
  publishModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.white,
    marginLeft: Spacing.sm,
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    padding: Spacing.sm,
  },
  cancelButtonText: {
    color: Colors.neutral.textSecondary,
    fontSize: 16
  },
});