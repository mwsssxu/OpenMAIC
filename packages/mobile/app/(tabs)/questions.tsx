import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Animated } from 'react-native';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing, SecondaryColorMap } from '@/lib/constants/theme';
import { useHaptics } from '@/lib/hooks/use-haptics';

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
  const haptics = useHaptics();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState('recent');
  const fabScale = useRef(new Animated.Value(1)).current;

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return '刚刚';
    if (diffHours < 24) return `${diffHours}小时前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString();
  };

  const renderQuestion = ({ item, index }: { item: Question; index: number }) => {
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
          styles.questionItem,
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
          onPress={() => router.push(`/questions/${item.id}` as any)}
          activeOpacity={0.7}
        >
          <View style={styles.questionHeader}>
            <Text style={styles.questionTitle} numberOfLines={2}>{item.title}</Text>
            {item.bounty > 0 && (
              <View style={[styles.bountyBadge, { backgroundColor: SecondaryColorMap.questions + '20', borderColor: SecondaryColorMap.questions }]}>
                <Ionicons name="diamond" size={12} color={SecondaryColorMap.questions} />
                <Text style={[styles.bountyText, { color: SecondaryColorMap.questions }]}>{item.bounty}</Text>
              </View>
            )}
          </View>
          <Text style={styles.questionContent} numberOfLines={2}>{item.content}</Text>
          <View style={styles.questionFooter}>
            <View style={styles.metaRow}>
              <Ionicons name="chatbubble-outline" size={14} color={Colors.neutral.textMuted} />
              <Text style={styles.questionMeta}>{item.answer_count}</Text>
              <Ionicons name="eye-outline" size={14} color={Colors.neutral.textMuted} style={{ marginLeft: Spacing.sm }} />
              <Text style={styles.questionMeta}>{item.view_count}</Text>
            </View>
            <Text style={styles.questionTime}>{formatDate(item.created_at)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 头部标题 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="chatbubble-ellipses" size={24} color={SecondaryColorMap.questions} />
          <Text style={styles.headerTitle}>问答悬赏</Text>
        </View>
      </View>

      {/* 排序切换 */}
      <View style={styles.sortContainer}>
        {[
          { key: 'recent', label: '最新', icon: 'time' },
          { key: 'bounty', label: '高悬赏', icon: 'diamond' },
          { key: 'unanswered', label: '待回答', icon: 'help-circle' },
        ].map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[
              styles.sortButton,
              sort === s.key && styles.activeSort,
              { backgroundColor: sort === s.key ? SecondaryColorMap.questions : Colors.neutral.backgroundAlt },
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

      {/* 问题列表 */}
      <FlatList
        data={questions}
        renderItem={renderQuestion}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} colors={[SecondaryColorMap.questions]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: SecondaryColorMap.questions + '15' }]}>
              <Ionicons name="help-circle-outline" size={44} color={SecondaryColorMap.questions} />
            </View>
            <Text style={styles.emptyTitle}>暂无问题</Text>
            <Text style={styles.emptyHint}>点击下方按钮发布你的第一个问题</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* 发布问题 FAB */}
      <TouchableOpacity
        style={styles.fabContainer}
        onPress={() => {
          haptics.medium();
          router.push('/questions/create' as any);
        }}
        onPressIn={handleFabPressIn}
        onPressOut={handleFabPressOut}
        activeOpacity={0.9}
      >
        <Animated.View style={[styles.fab, { backgroundColor: SecondaryColorMap.questions, transform: [{ scale: fabScale }] }]}>
          <Ionicons name="add" size={28} color={Colors.neutral.white} />
        </Animated.View>
      </TouchableOpacity>
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

  // 排序
  sortContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
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
    shadowColor: SecondaryColorMap.questions,
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
    padding: Spacing.md,
    paddingBottom: Spacing.xxl + 16
  },
  questionItem: {
    backgroundColor: Colors.neutral.card,
    marginBottom: Spacing.sm,
    borderRadius: Rounded.lg,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    overflow: 'hidden',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: Colors.neutral.textPrimary
  },
  bountyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Rounded.sm,
    borderWidth: 1,
    marginLeft: Spacing.sm,
  },
  bountyText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  questionContent: {
    fontSize: 14,
    color: Colors.neutral.textSecondary,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  questionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral.border,
    paddingTop: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionMeta: {
    fontSize: 12,
    color: Colors.neutral.textMuted,
    marginLeft: 4,
  },
  questionTime: {
    fontSize: 12,
    color: Colors.neutral.textMuted
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
    shadowColor: SecondaryColorMap.questions,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});