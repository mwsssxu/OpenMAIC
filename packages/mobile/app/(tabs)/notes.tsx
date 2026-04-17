import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { apiClient } from '@/lib/api-client';

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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  earningsCard: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
  },
  earningsTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  earningsStats: { flexDirection: 'row', justifyContent: 'space-around' },
  earningsItem: { alignItems: 'center' },
  earningsValue: { fontSize: 24, fontWeight: 'bold', color: '#5b9bd5' },
  earningsLabel: { fontSize: 12, color: '#666' },
  sortContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 10,
    marginBottom: 10,
  },
  sortButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  activeSort: { backgroundColor: '#5b9bd5' },
  sortText: { fontSize: 14, color: '#666' },
  publishButton: {
    backgroundColor: '#FFD700',
    marginHorizontal: 10,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  publishButtonText: { fontSize: 16, fontWeight: '600' },
  listContent: { padding: 10 },
  noteItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  noteTitle: { fontSize: 16, fontWeight: '500', flex: 1 },
  priceBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priceText: { fontSize: 12, fontWeight: '600' },
  noteStats: {
    flexDirection: 'row',
    marginTop: 10,
  },
  statText: { fontSize: 12, color: '#666', marginRight: 15 },
  buyButton: {
    backgroundColor: '#5b9bd5',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  buyButtonText: { color: 'white', fontSize: 14 },
  purchasedText: { color: '#4CAF50', marginTop: 10 },
  emptyText: { color: '#999', textAlign: 'center', padding: 20 },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 20 },
  inputLabel: { fontSize: 14, color: '#666', marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  contentInput: { height: 100 },
  publishModalButton: {
    backgroundColor: '#FFD700',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  publishModalButtonText: { fontSize: 16, fontWeight: '600' },
  cancelButton: { alignItems: 'center', marginTop: 10 },
  cancelButtonText: { color: '#666', fontSize: 16 },
});