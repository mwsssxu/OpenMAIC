import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { SecondaryColorMap } from '@/lib/constants/theme';

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
  const { onPress } = useFeedback();
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
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  sortContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral.card,
    padding: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  sortButton: {
    paddingHorizontal: Spacing.sm + 7,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
    marginRight: Spacing.sm,
    backgroundColor: Colors.neutral.backgroundAlt,
  },
  activeSort: {
    backgroundColor: Colors.primary.main,
  },
  sortText: { fontSize: 14, color: Colors.neutral.textSecondary },
  activeSortText: { color: Colors.neutral.white, fontWeight: '600' },
  listContent: { padding: Spacing.sm, paddingBottom: Spacing.xl + 32 },
  questionItem: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.sm + 3,
    marginBottom: Spacing.sm,
    borderRadius: Rounded.lg,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  questionTitle: { fontSize: 16, fontWeight: '600', flex: 1, color: Colors.neutral.textPrimary },
  bountyBadge: {
    backgroundColor: Colors.feedback.warningBg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Rounded.sm,
    borderWidth: 1,
    borderColor: Colors.feedback.warningBorder,
  },
  bountyText: { fontSize: 12, fontWeight: '600', color: Colors.feedback.warningText },
  questionContent: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.sm },
  questionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  questionMeta: { fontSize: 12, color: Colors.neutral.textMuted },
  questionTime: { fontSize: 12, color: Colors.neutral.textMuted },
  empty: { padding: Spacing.xl + 8, alignItems: 'center' },
  emptyText: { color: Colors.neutral.textSecondary, fontSize: 16 },
  createButton: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.primary.main,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
  },
  createButtonText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },
});
