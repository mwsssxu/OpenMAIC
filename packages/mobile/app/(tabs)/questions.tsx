import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { apiClient } from '@/lib/api-client';

interface Question {
  id: string;
  user_id: string;
  title: string;
  content: string;
  bounty: number;
  bounty_status: string;
  tags: string;
  view_count: number;
  answer_count: number;
  created_at: string;
}

export default function QuestionsScreen() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState('recent');

  useEffect(() => {
    loadQuestions();
  }, [sort]);

  async function loadQuestions() {
    setIsLoading(true);
    try {
      const data = await apiClient.getQuestions(1, 20, sort);
      setQuestions(data.items || []);
    } catch (error) {
      console.error('Load questions error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const onRefresh = useCallback(() => {
    loadQuestions();
  }, [sort]);

  const renderQuestion = ({ item }: { item: Question }) => (
    <TouchableOpacity
      style={styles.questionItem}
      onPress={() => router.push(`/questions/${item.id}`)}
    >
      <View style={styles.questionHeader}>
        <Text style={styles.questionTitle} numberOfLines={2}>{item.title}</Text>
        {item.bounty > 0 && (
          <View style={styles.bountyBadge}>
            <Text style={styles.bountyText}>{item.bounty}积分</Text>
          </View>
        )}
      </View>
      <Text style={styles.questionContent} numberOfLines={3}>{item.content}</Text>
      <View style={styles.questionFooter}>
        <Text style={styles.questionMeta}>
          {item.answer_count} 回答 · {item.view_count} 浏览
        </Text>
        <Text style={styles.questionTime}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 排序切换 */}
      <View style={styles.sortContainer}>
        <TouchableOpacity
          style={[styles.sortButton, sort === 'recent' && styles.activeSort]}
          onPress={() => setSort('recent')}
        >
          <Text style={[styles.sortText, sort === 'recent' && styles.activeSortText]}>
            最新
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sort === 'bounty' && styles.activeSort]}
          onPress={() => setSort('bounty')}
        >
          <Text style={[styles.sortText, sort === 'bounty' && styles.activeSortText]}>
            高悬赏
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sort === 'unanswered' && styles.activeSort]}
          onPress={() => setSort('unanswered')}
        >
          <Text style={[styles.sortText, sort === 'unanswered' && styles.activeSortText]}>
            待回答
          </Text>
        </TouchableOpacity>
      </View>

      {/* 问题列表 */}
      <FlatList
        data={questions}
        renderItem={renderQuestion}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无问题</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* 发布问题按钮 */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push('/questions/create')}
      >
        <Text style={styles.createButtonText}>发布问题</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  sortContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 10,
  },
  sortButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  activeSort: { backgroundColor: '#5b9bd5' },
  sortText: { fontSize: 14, color: '#666' },
  activeSortText: { color: 'white', fontWeight: '500' },
  listContent: { padding: 10, paddingBottom: 80 },
  questionItem: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  questionTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  bountyBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  bountyText: { fontSize: 12, fontWeight: '600', color: '#333' },
  questionContent: { fontSize: 14, color: '#666', marginTop: 8 },
  questionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  questionMeta: { fontSize: 12, color: '#999' },
  questionTime: { fontSize: 12, color: '#999' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 16 },
  createButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#5b9bd5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  createButtonText: { color: 'white', fontSize: 16, fontWeight: '500' },
});