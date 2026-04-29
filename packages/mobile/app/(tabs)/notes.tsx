import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { SecondaryColorMap } from '@/lib/constants/theme';

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
  const { onPress, onSuccess, onError } = useFeedback();
  const [notes, setNotes] = useState<Note[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState('recent');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [price, setPrice] = useState('0');

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

  const purchaseNote = async (noteId: string, notePrice: number) => {
    Alert.alert(
      '购买笔记',
      `确定花费 ${notePrice} 积分购买此笔记？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            try {
              await apiClient.purchaseNote(noteId);
              Alert.alert('成功', '笔记已购买，可以查看完整内容');
              loadData();
            } catch (error: any) {
              Alert.alert('失败', error.response?.data?.detail || '购买失败');
            }
          },
        },
      ]
    );
  };

  const publishNote = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('错误', '标题和内容不能为空');
      return;
    }

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
      loadData();
      Alert.alert('成功', '笔记已发布');
    } catch (error) {
      Alert.alert('失败', '发布失败');
    }
  };

  const renderNote = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={styles.noteItem}
      onPress={() => router.push(`/notes/${item.id}`)}
    >
      <View style={styles.noteHeader}>
        <Text style={styles.noteTitle} numberOfLines={2}>{item.title}</Text>
        {item.price > 0 && (
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>{item.price}积分</Text>
          </View>
        )}
      </View>
      <View style={styles.noteStats}>
        <Text style={styles.statText}>
          ⭐ {item.rating.toFixed(1)} ({item.rating_count})
        </Text>
        <Text style={styles.statText}>
          购买 {item.purchase_count}
        </Text>
      </View>
      {!item.is_purchased && item.price > 0 && (
        <TouchableOpacity
          style={styles.buyButton}
          onPress={() => purchaseNote(item.id, item.price)}
        >
          <Text style={styles.buyButtonText}>购买</Text>
        </TouchableOpacity>
      )}
      {item.is_purchased && (
        <Text style={styles.purchasedText}>已购买 ✓</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
    >
      {/* 我的收益 */}
      {earnings && (
        <View style={styles.earningsCard}>
          <Text style={styles.earningsTitle}>我的笔记收益</Text>
          <View style={styles.earningsStats}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsValue}>{earnings.total_earnings || 0}</Text>
              <Text style={styles.earningsLabel}>总收益</Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsValue}>{earnings.total_purchases || 0}</Text>
              <Text style={styles.earningsLabel}>购买次数</Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsValue}>{earnings.notes_count || 0}</Text>
              <Text style={styles.earningsLabel}>发布笔记</Text>
            </View>
          </View>
        </View>
      )}

      {/* 排序切换 */}
      <View style={styles.sortContainer}>
        <TouchableOpacity
          style={[styles.sortButton, sort === 'recent' && styles.activeSort]}
          onPress={() => setSort('recent')}
        >
          <Text style={styles.sortText}>最新</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sort === 'popular' && styles.activeSort]}
          onPress={() => setSort('popular')}
        >
          <Text style={styles.sortText}>热门</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sort === 'rating' && styles.activeSort]}
          onPress={() => setSort('rating')}
        >
          <Text style={styles.sortText}>高分</Text>
        </TouchableOpacity>
      </View>

      {/* 发布按钮 */}
      <TouchableOpacity
        style={styles.publishButton}
        onPress={() => setShowPublishModal(true)}
      >
        <Text style={styles.publishButtonText}>发布笔记</Text>
      </TouchableOpacity>

      {/* 笔记列表 */}
      <FlatList
        data={notes}
        renderItem={renderNote}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>暂无笔记</Text>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* 发布弹窗 */}
      <Modal visible={showPublishModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>发布笔记</Text>

            <Text style={styles.inputLabel}>标题</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="笔记标题"
            />

            <Text style={styles.inputLabel}>内容</Text>
            <TextInput
              style={[styles.input, styles.contentInput]}
              value={content}
              onChangeText={setContent}
              placeholder="笔记内容"
              multiline
              numberOfLines={5}
            />

            <Text style={styles.inputLabel}>价格 (积分)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0为免费"
              keyboardType="numeric"
            />

            <TouchableOpacity style={styles.publishModalButton} onPress={publishNote}>
              <Text style={styles.publishModalButtonText}>发布</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowPublishModal(false)}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  earningsCard: {
    backgroundColor: Colors.neutral.card,
    padding: 16,
    margin: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    shadowColor: Colors.secondary.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  earningsTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: Colors.neutral.textPrimary },
  earningsStats: { flexDirection: 'row', justifyContent: 'space-around' },
  earningsItem: { alignItems: 'center' },
  earningsValue: { fontSize: 24, fontWeight: 'bold', color: Colors.secondary.success },
  earningsLabel: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: 4 },
  sortContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral.card,
    padding: 10,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  sortButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: Colors.neutral.backgroundAlt,
  },
  activeSort: {
    backgroundColor: Colors.secondary.success,
    shadowColor: Colors.secondary.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sortText: { fontSize: 14, color: Colors.neutral.textSecondary },
  sortTextActive: { color: Colors.neutral.white, fontWeight: '600' },
  publishButton: {
    backgroundColor: Colors.secondary.success,
    marginHorizontal: 12,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: Colors.secondary.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  publishButtonText: { fontSize: 16, fontWeight: '600', color: Colors.neutral.white },
  listContent: { padding: 12 },
  noteItem: {
    backgroundColor: Colors.neutral.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  noteTitle: { fontSize: 16, fontWeight: '600', flex: 1, color: Colors.neutral.textPrimary },
  priceBadge: {
    backgroundColor: Colors.feedback.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.feedback.warningBorder,
  },
  priceText: { fontSize: 12, fontWeight: '600', color: Colors.feedback.warningText },
  noteStats: {
    flexDirection: 'row',
    marginTop: 12,
  },
  statText: { fontSize: 12, color: Colors.neutral.textSecondary, marginRight: 15 },
  buyButton: {
    backgroundColor: Colors.secondary.success,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12,
    alignSelf: 'flex-end',
    shadowColor: Colors.secondary.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  buyButtonText: { color: Colors.neutral.white, fontSize: 14, fontWeight: '600' },
  purchasedText: { color: Colors.secondary.success, marginTop: 12, fontWeight: '600' },
  emptyText: { color: Colors.neutral.textSecondary, textAlign: 'center', padding: 20 },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Colors.neutral.card,
    padding: 20,
    borderRadius: 20,
    marginHorizontal: 20,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 20, color: Colors.neutral.textPrimary },
  inputLabel: { fontSize: 14, color: Colors.neutral.textSecondary, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    backgroundColor: Colors.neutral.backgroundAlt,
    color: Colors.neutral.textPrimary,
    fontSize: 16,
  },
  contentInput: { height: 100, textAlignVertical: 'top' },
  publishModalButton: {
    backgroundColor: Colors.secondary.success,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.secondary.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  publishModalButtonText: { fontSize: 16, fontWeight: '600', color: Colors.neutral.white },
  cancelButton: {
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
  },
  cancelButtonText: { color: Colors.neutral.textSecondary, fontSize: 16 },
});
