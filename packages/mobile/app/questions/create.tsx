import { useState, useEffect } from 'react';
import { showError, confirmAction } from '@/lib/utils/error-toast';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { useAuth } from '@/lib/auth/auth-context';
import { goBack } from '@/lib/utils/navigation';

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

// 常用标签
const SUGGESTED_TAGS = [
  'Python', 'JavaScript', 'React', 'Node.js', 'TypeScript',
  '算法', '数据结构', '数据库', '机器学习', '人工智能',
  '前端', '后端', '移动开发', 'DevOps', '架构设计',
];

export default function CreateQuestionScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [bounty, setBounty] = useState('0');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 真实积分余额（从后端 point_accounts 拉取）
  const [userBalance, setUserBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // 加载余额（认证后再拉，避免无 token 报错）
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.getPointsBalance();
        if (!cancelled) setUserBalance(Number(data?.balance ?? 0));
      } catch (e) {
        // 余额拉取失败不阻塞用户提问，保留 0 占位
        console.warn('[CreateQuestion] load balance failed:', e);
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated]);

  // 检查登录状态，未登录跳转到登录页
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      confirmAction('需要登录', '请先登录后再发布问题', () => router.replace('/auth/login' as any));
    }
  }, [authLoading, isAuthenticated]);

  const handleAddTag = (tag: string) => {
    haptics.light();
    if (!selectedTags.includes(tag) && selectedTags.length < 5) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    haptics.light();
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const handleAddCustomTag = () => {
    const tag = customTag.trim();
    if (tag && !selectedTags.includes(tag) && selectedTags.length < 5) {
      setSelectedTags([...selectedTags, tag]);
      setCustomTag('');
    }
  };

  const handleSubmit = async () => {
    console.log('handleSubmit called, title:', title.length, 'content:', content.length);

    // 验证
    if (!title.trim()) {
      showError('请输入问题标题');
      return;
    }
    if (!content.trim()) {
      showError('请输入问题描述');
      return;
    }
    if (title.length < 10) {
      showError('标题至少10个字符');
      return;
    }
    if (content.length < 20) {
      showError('问题描述至少20个字符');
      return;
    }

    const bountyNum = parseInt(bounty) || 0;
    if (bountyNum > 0 && bountyNum < 10) {
      showError('最小悬赏积分为10');
      return;
    }
    if (bountyNum > userBalance) {
      showError('积分余额不足');
      return;
    }

    setSubmitting(true);
    try {
      console.log('Creating question...');
      const tagsStr = selectedTags.length > 0 ? JSON.stringify(selectedTags) : '';
      await apiClient.createQuestion(
        title.trim(),
        content.trim(),
        bountyNum,
        tagsStr
      );

      console.log('Question created successfully');
      haptics.medium();
      // 返回问题列表页
      router.replace('/(tabs)/questions' as any);
    } catch (err: any) {
      showError(err);
      console.log('Error:', err.message);
      const errorMsg = getErrorMessage(err);
      // 如果是认证错误，提示用户登录
      if (err.response?.status === 401 || errorMsg.includes('登录') || errorMsg.includes('认证')) {
        confirmAction('需要登录', '请先登录后再发布问题', () => router.push('/login' as any));
      } else {
        showError(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const quickBountyAmounts = [0, 10, 50, 100, 200];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* 页面头部 */}
      <View style={styles.pageHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/(tabs)/questions' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={20} color={iOSColors.fg} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>发布问题</Text>
        <TouchableOpacity
          style={[styles.publishBtn, submitting && styles.publishBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.publishBtnText}>发布</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 标题输入 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>问题标题 *</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="简要描述你的问题"
            placeholderTextColor={iOSColors.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={255}
          />
          <Text style={styles.charCount}>{title.length}/255</Text>
        </View>

        {/* 内容输入 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>问题描述 *</Text>
          <TextInput
            style={styles.contentInput}
            placeholder="详细描述你遇到的问题，包括你尝试过的方法..."
            placeholderTextColor={iOSColors.muted}
            multiline
            numberOfLines={6}
            value={content}
            onChangeText={setContent}
            maxLength={5000}
          />
          <Text style={styles.charCount}>{content.length}/5000</Text>
        </View>

        {/* 悬赏积分 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>悬赏积分</Text>
            <Text style={styles.balanceText}>余额: {userBalance}</Text>
          </View>
          <Text style={styles.hint}>设置悬赏可以吸引更多人回答你的问题</Text>

          {/* 快速选择 */}
          <View style={styles.quickBountyRow}>
            {quickBountyAmounts.map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.quickBountyBtn,
                  parseInt(bounty) === amount && styles.quickBountyBtnActive,
                ]}
                onPress={() => {
                  haptics.light();
                  setBounty(amount.toString());
                }}
              >
                <Text
                  style={[
                    styles.quickBountyText,
                    parseInt(bounty) === amount && styles.quickBountyTextActive,
                  ]}
                >
                  {amount === 0 ? '无悬赏' : amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 自定义积分 */}
          <View style={styles.customBountyRow}>
            <TextInput
              style={styles.bountyInput}
              placeholder="自定义积分"
              placeholderTextColor={iOSColors.muted}
              value={bounty}
              onChangeText={setBounty}
              keyboardType="number-pad"
              maxLength={5}
            />
            <Ionicons name="diamond" size={20} color={iOSColors.questions} />
          </View>
        </View>

        {/* 标签选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>标签 (最多5个)</Text>
          <Text style={styles.hint}>选择合适的标签帮助他人找到你的问题</Text>

          {/* 已选标签 */}
          {selectedTags.length > 0 && (
            <View style={styles.selectedTagsRow}>
              {selectedTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.selectedTag}
                  onPress={() => handleRemoveTag(tag)}
                >
                  <Text style={styles.selectedTagText}>{tag}</Text>
                  <Ionicons name="close-circle" size={16} color={iOSColors.questions} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 推荐标签 */}
          <View style={styles.tagsGrid}>
            {SUGGESTED_TAGS.filter(t => !selectedTags.includes(t)).map((tag) => (
              <TouchableOpacity
                key={tag}
                style={styles.suggestedTag}
                onPress={() => handleAddTag(tag)}
                disabled={selectedTags.length >= 5}
              >
                <Text style={styles.suggestedTagText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 自定义标签 */}
          <View style={styles.customTagRow}>
            <TextInput
              style={styles.customTagInput}
              placeholder="添加自定义标签"
              placeholderTextColor={iOSColors.muted}
              value={customTag}
              onChangeText={setCustomTag}
              maxLength={20}
              onSubmitEditing={handleAddCustomTag}
            />
            <TouchableOpacity
              style={[
                styles.addTagBtn,
                (selectedTags.length >= 5 || !customTag.trim()) && styles.addTagBtnDisabled,
              ]}
              onPress={handleAddCustomTag}
              disabled={selectedTags.length >= 5 || !customTag.trim()}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 提示信息 */}
        <View style={styles.tipsSection}>
          <Ionicons name="information-circle" size={20} color={iOSColors.questions} />
          <View style={styles.tipsContent}>
            <Text style={styles.tipsTitle}>发布提示</Text>
            <Text style={styles.tipsText}>• 标题要清晰简洁，突出核心问题</Text>
            <Text style={styles.tipsText}>• 描述要详细，包括问题背景和尝试过的方法</Text>
            <Text style={styles.tipsText}>• 设置悬赏可以获得更高质量的回答</Text>
            <Text style={styles.tipsText}>• 选择准确的标签让更多人看到你的问题</Text>
          </View>
        </View>
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
  publishBtn: {
    backgroundColor: iOSColors.questions,
    borderRadius: Rounded.sm,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  publishBtnDisabled: {
    opacity: 0.6,
  },
  publishBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  scrollView: {
    flex: 1,
  },

  // 区块
  section: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: Spacing.sm,
  },
  hint: {
    fontSize: 12,
    color: iOSColors.muted,
    marginBottom: Spacing.sm,
  },
  charCount: {
    fontSize: 11,
    color: iOSColors.muted,
    textAlign: 'right',
    marginTop: 4,
  },

  // 标题输入
  titleInput: {
    backgroundColor: iOSColors.bgSolid,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    fontSize: 16,
    fontWeight: '500',
    color: iOSColors.fg,
  },

  // 内容输入
  contentInput: {
    backgroundColor: iOSColors.bgSolid,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    fontSize: 14,
    color: iOSColors.fg,
    minHeight: 150,
    lineHeight: 22,
  },

  // 悬赏
  balanceText: {
    fontSize: 12,
    color: iOSColors.questions,
  },
  quickBountyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  quickBountyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Rounded.sm,
    backgroundColor: iOSColors.bgSolid,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    alignItems: 'center',
  },
  quickBountyBtnActive: {
    backgroundColor: iOSColors.questionsLight,
    borderColor: iOSColors.questions,
  },
  quickBountyText: {
    fontSize: 13,
    color: iOSColors.muted,
  },
  quickBountyTextActive: {
    color: iOSColors.questions,
    fontWeight: '600',
  },
  customBountyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bountyInput: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    fontSize: 14,
    color: iOSColors.fg,
  },

  // 标签
  selectedTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: iOSColors.questionsLight,
  },
  selectedTagText: {
    fontSize: 13,
    color: iOSColors.questions,
    fontWeight: '500',
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  suggestedTag: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: iOSColors.bgSolid,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  suggestedTagText: {
    fontSize: 12,
    color: iOSColors.muted,
  },
  customTagRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  customTagInput: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    fontSize: 14,
    color: iOSColors.fg,
  },
  addTagBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: iOSColors.questions,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTagBtnDisabled: {
    opacity: 0.4,
  },

  // 提示
  tipsSection: {
    flexDirection: 'row',
    backgroundColor: iOSColors.questionsLight,
    borderRadius: Rounded.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  tipsContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.questions,
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 12,
    color: iOSColors.questions,
    lineHeight: 18,
    marginTop: 2,
  },
});
