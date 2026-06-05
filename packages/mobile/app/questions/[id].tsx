1|import { useState, useEffect } from 'react';
import { showError } from '@/lib/utils/error-toast';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Rounded, Spacing } from '@/lib/constants/theme';
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
  questions: '#8b5cf6',
  questionsLight: '#f3e8ff',
};

interface Question {
  id: string;
  user_id: string;
  user_nickname: string;
  title: string;
  content: string;
  bounty: number;
  bounty_status: string;
  tags: string;
  view_count: number;
  answer_count: number;
  accepted_answer_id: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface Answer {
  id: string;
  question_id: string;
  user_id: string;
  user_nickname: string;
  content: string;
  rating: number;
  vote_count: number;
  is_accepted: boolean;
  accepted_at: string | null;
  created_at: string;
}

export default function QuestionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const questionId = params.id as string;
  const haptics = useHaptics();

  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [answerContent, setAnswerContent] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    loadQuestionDetail();
  }, [questionId]);

  useEffect(() => {
    if (question) {
      loadAnswers();
    }
  }, [question, sortBy]);

  const loadQuestionDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getQuestion(questionId);
      setQuestion(data);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAnswers = async () => {
    try {
      const data = await apiClient.getAnswers(questionId);
      setAnswers(data.items || []);
    } catch (err: any) {
      showError(err);
      console.error('Load answers error:', err);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answerContent.trim()) {
      Alert.alert('提示', '请输入回答内容');
      return;
    }

    setSubmittingAnswer(true);
    try {
      await apiClient.createAnswer(questionId, answerContent.trim());
      setAnswerContent('');
      haptics.medium();
      Alert.alert('成功', '回答已提交');
      loadAnswers();
      loadQuestionDetail(); // 更新回答数
    } catch (err: any) {
      Alert.alert('错误', err.message || '提交失败');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleVoteAnswer = async (answerId: string, vote: number) => {
    haptics.light();
    try {
      await apiClient.voteAnswer(answerId, vote);
      loadAnswers();
    } catch (err: any) {
      Alert.alert('提示', err.message || '投票失败');
    }
  };

  const handleAcceptAnswer = async (answerId: string) => {
    Alert.alert(
      '采纳答案',
      '确定采纳此答案？采纳后将关闭问题并发放悬赏积分。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            try {
              const result = await apiClient.acceptAnswer(answerId);
              haptics.medium();
              Alert.alert('成功', `答案已采纳！获得 ${result.author_reward} 积分`);
              loadAnswers();
              loadQuestionDetail();
            } catch (err: any) {
              Alert.alert('错误', err.message || '采纳失败');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return '刚刚';
    if (diffHours < 24) return `${diffHours}小时前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}天前`;
    return formatDate(dateStr);
  };

  const parseTags = (tagsStr: string) => {
    if (!tagsStr) return [];
    try {
      return JSON.parse(tagsStr);
    } catch {
      return tagsStr.split(',').filter(t => t.trim());
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={iOSColors.questions} />
      </View>
    );
  }

  if (error || !question) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error || '问题不存在'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadQuestionDetail}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tags = parseTags(question.tags);
  const isClosed = question.bounty_status === 'closed';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* 页面头部 */}
      <View style={styles.pageHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
        </TouchableOpacity>
        <Text style={styles.pageTitle} numberOfLines={1}>问题详情</Text>
        <View style={styles.pageHeaderActions}>
          <TouchableOpacity style={styles.headerAction} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={18} color={iOSColors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 问题卡片 */}
        <View style={styles.questionCard}>
          {/* 标题和悬赏 */}
          <View style={styles.questionHeader}>
            <Text style={styles.questionTitle}>{question.title}</Text>
            {question.bounty > 0 && (
              <View style={styles.bountyBadge}>
                <Ionicons name="diamond" size={14} color={iOSColors.questions} />
                <Text style={styles.bountyText}>{question.bounty}</Text>
              </View>
            )}
          </View>

          {/* 标签 */}
          {tags.length > 0 && (
            <View style={styles.tagRow}>
              {tags.map((tag: string, i: number) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 内容 */}
          <Text style={styles.questionContent}>{question.content}</Text>

          {/* 状态和统计 */}
          <View style={styles.questionFooter}>
            <View style={styles.statsRow}>
              <Ionicons name="chatbubble-outline" size={14} color={iOSColors.muted} />
              <Text style={styles.statsText}>{question.answer_count} 回答</Text>
              <Ionicons name="eye-outline" size={14} color={iOSColors.muted} style={{ marginLeft: 12 }} />
              <Text style={styles.statsText}>{question.view_count} 浏览</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isClosed ? '#dcfce7' : iOSColors.accentLight }]}>
              <Text style={[styles.statusText, { color: isClosed ? '#16a34a' : iOSColors.accent }]}>
                {isClosed ? '已解决' : '待回答'}
              </Text>
            </View>
          </View>

          {/* 作者信息 */}
          <View style={styles.authorRow}>
            <Ionicons name="person-circle-outline" size={20} color={iOSColors.muted} />
            <Text style={styles.authorText}>{question.user_nickname}</Text>
            <Text style={styles.timeText}>{getRelativeTime(question.created_at)}</Text>
          </View>
        </View>

        {/* 回答排序 */}
        <View style={styles.answerSortBar}>
          <Text style={styles.answerCount}>共 {answers.length} 个回答</Text>
          <View style={styles.sortButtons}>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'recent' && styles.sortBtnActive]}
              onPress={() => {
                haptics.light();
                setSortBy('recent');
              }}
            >
              <Text style={[styles.sortBtnText, sortBy === 'recent' && styles.sortBtnTextActive]}>
                最新
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'votes' && styles.sortBtnActive]}
              onPress={() => {
                haptics.light();
                setSortBy('votes');
              }}
            >
              <Text style={[styles.sortBtnText, sortBy === 'votes' && styles.sortBtnTextActive]}>
                最高票
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'accepted' && styles.sortBtnActive]}
              onPress={() => {
                haptics.light();
                setSortBy('accepted');
              }}
            >
              <Text style={[styles.sortBtnText, sortBy === 'accepted' && styles.sortBtnTextActive]}>
                已采纳
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 回答列表 */}
        {answers.length === 0 ? (
          <View style={styles.emptyAnswers}>
            <Ionicons name="chatbubble-ellipses-outline" size={40} color={iOSColors.muted} />
            <Text style={styles.emptyText}>暂无回答</Text>
            <Text style={styles.emptyHint}>成为第一个回答者吧！</Text>
          </View>
        ) : (
          answers.map((answer) => (
            <View key={answer.id} style={styles.answerCard}>
              {/* 采纳标记 */}
              {answer.is_accepted && (
                <View style={styles.acceptedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                  <Text style={styles.acceptedText}>已采纳</Text>
                </View>
              )}

              {/* 回答内容 */}
              <Text style={styles.answerContent}>{answer.content}</Text>

              {/* 回答底部 */}
              <View style={styles.answerFooter}>
                {/* 投票 */}
                <View style={styles.voteRow}>
                  <TouchableOpacity
                    style={styles.voteBtn}
                    onPress={() => handleVoteAnswer(answer.id, 1)}
                  >
                    <Ionicons name="thumbs-up-outline" size={18} color={iOSColors.accent} />
                  </TouchableOpacity>
                  <Text style={styles.voteCount}>{answer.vote_count}</Text>
                  <TouchableOpacity
                    style={styles.voteBtn}
                    onPress={() => handleVoteAnswer(answer.id, -1)}
                  >
                    <Ionicons name="thumbs-down-outline" size={18} color={iOSColors.muted} />
                  </TouchableOpacity>
                </View>

                {/* 作者和时间 */}
                <View style={styles.answerAuthorRow}>
                  <Ionicons name="person-circle-outline" size={16} color={iOSColors.muted} />
                  <Text style={styles.answerAuthorText}>{answer.user_nickname}</Text>
                  <Text style={styles.answerTimeText}>{getRelativeTime(answer.created_at)}</Text>
                </View>

                {/* 采纳按钮 */}
                {!answer.is_accepted && !isClosed && (
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => handleAcceptAnswer(answer.id)}
                  >
                    <Ionicons name="checkmark-done" size={16} color={iOSColors.questions} />
                    <Text style={styles.acceptBtnText}>采纳</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}

        {/* 回答输入框 */}
        {!isClosed && (
          <View style={styles.answerInputSection}>
            <Text style={styles.answerInputLabel}>提交你的回答</Text>
            <TextInput
              style={styles.answerInput}
              placeholder="写下你的回答..."
              placeholderTextColor={iOSColors.muted}
              multiline
              numberOfLines={4}
              value={answerContent}
              onChangeText={setAnswerContent}
              editable={!submittingAnswer}
            />
            <TouchableOpacity
              style={[styles.submitBtn, submittingAnswer && styles.submitBtnDisabled]}
              onPress={handleSubmitAnswer}
              disabled={submittingAnswer}
            >
              {submittingAnswer ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>提交回答</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
  },

  // 页面头部
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: iOSColors.bgSolid,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: iOSColors.fg,
    letterSpacing: -0.3,
    flex: 1,
  },
  pageHeaderActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },

  scrollView: {
    flex: 1,
  },

  // 问题卡片
  questionCard: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: iOSColors.fg,
    flex: 1,
    letterSpacing: -0.2,
  },
  bountyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: iOSColors.questionsLight,
  },
  bountyText: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.questions,
    marginLeft: 4,
  },

  // 标签
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  tagText: {
    fontSize: 12,
    color: iOSColors.questions,
  },

  questionContent: {
    fontSize: 14,
    color: iOSColors.fg,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },

  questionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: iOSColors.border,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 12,
    color: iOSColors.muted,
    marginLeft: 4,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  authorText: {
    fontSize: 12,
    color: iOSColors.muted,
    marginLeft: 6,
  },
  timeText: {
    fontSize: 12,
    color: iOSColors.muted,
    marginLeft: 12,
  },

  // 回答排序
  answerSortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  answerCount: {
    fontSize: 12,
    color: iOSColors.muted,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: iOSColors.surface,
  },
  sortBtnActive: {
    backgroundColor: iOSColors.questionsLight,
  },
  sortBtnText: {
    fontSize: 12,
    color: iOSColors.muted,
  },
  sortBtnTextActive: {
    color: iOSColors.questions,
    fontWeight: '500',
  },

  // 回答卡片
  answerCard: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  acceptedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
    marginLeft: 4,
  },
  answerContent: {
    fontSize: 14,
    color: iOSColors.fg,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  answerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: iOSColors.border,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: iOSColors.surfaceSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteCount: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  answerAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  answerAuthorText: {
    fontSize: 12,
    color: iOSColors.muted,
    marginLeft: 4,
  },
  answerTimeText: {
    fontSize: 12,
    color: iOSColors.muted,
    marginLeft: 8,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: iOSColors.questionsLight,
  },
  acceptBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: iOSColors.questions,
    marginLeft: 4,
  },

  // 空回答
  emptyAnswers: {
    alignItems: 'center',
    paddingVertical: 48,
    marginHorizontal: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: iOSColors.fg,
    marginTop: Spacing.sm,
  },
  emptyHint: {
    fontSize: 13,
    color: iOSColors.muted,
    marginTop: 4,
  },

  // 回答输入
  answerInputSection: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  answerInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: Spacing.sm,
  },
  answerInput: {
    backgroundColor: iOSColors.bgSolid,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    fontSize: 14,
    color: iOSColors.fg,
    minHeight: 100,
    marginBottom: Spacing.sm,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: iOSColors.questions,
    borderRadius: Rounded.sm,
    paddingVertical: 10,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },

  // 加载和错误
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: iOSColors.bgSolid,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginTop: 10,
  },
  retryBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: iOSColors.questions,
    borderRadius: Rounded.sm,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});