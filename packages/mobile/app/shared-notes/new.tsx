import { useState } from 'react';
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
import { useGoBack } from '@/lib/utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useHaptics } from '@/lib/hooks/use-haptics';
import TabPageWrapper from '@/lib/components/TabPageWrapper';
import { useResponsiveDimensions } from '@/lib/utils/responsive';
import { showError, showSuccess, confirmAction } from '@/lib/utils/error-toast';

const iOSColors = {
  bgSolid: '#f5f3f2',
  surface: 'rgba(255, 255, 255, 0.55)',
  fg: '#1a1a1a',
  muted: '#666666',
  border: 'rgba(230, 225, 220, 0.6)',
  accent: '#c45a1a',
  accentLight: '#fde8e0',
  secondary: '#1a8a8a',
  secondaryLight: '#e8f5f5',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
  gold: '#f59e0b',
  goldLight: '#fef3c7',
};

const MAX_TITLE_LENGTH = 50;
const MAX_CONTENT_LENGTH = 2000;

export default function NewSharedNoteScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const haptics = useHaptics();
  const { isTablet } = useResponsiveDimensions();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'paid'>('public');
  const [price, setPrice] = useState('10');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    // 验证
    if (!title.trim()) {
      showError('请输入笔记标题');
      return;
    }
    if (!content.trim()) {
      showError('请输入笔记内容');
      return;
    }
    if (title.length > MAX_TITLE_LENGTH) {
      showError(`标题不能超过${MAX_TITLE_LENGTH}个字符`);
      return;
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      showError(`内容不能超过${MAX_CONTENT_LENGTH}个字符`);
      return;
    }

    const priceNum = parseInt(price) || 0;
    if (visibility === 'paid' && priceNum < 1) {
      showError('付费笔记请设置价格');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.createSharedNote({
        title: title.trim(),
        content: content.trim(),
        visibility,
        price: visibility === 'paid' ? priceNum : 0,
        tags: tags.trim(),
      });

      haptics.medium();
      showSuccess('笔记已发布到共享市场');
      router.replace('/shared-notes' as any);
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      if (err.response?.status === 401) {
        confirmAction('需要登录', '请先登录后再发布笔记', () => router.push('/auth/login' as any));
      } else {
        showError(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TabPageWrapper hasHeader>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* 操作栏 */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
          </TouchableOpacity>
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

        <ScrollView
          style={[styles.scrollView, isTablet && styles.scrollViewTablet]}
          showsVerticalScrollIndicator={false}
        >
          {/* 标题输入 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>标题</Text>
              <Text style={styles.charCount}>{title.length}/{MAX_TITLE_LENGTH}</Text>
            </View>
            <TextInput
              style={styles.titleInput}
              placeholder="给笔记起个标题..."
              placeholderTextColor={iOSColors.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={MAX_TITLE_LENGTH}
            />
          </View>

          {/* 内容输入 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>内容</Text>
              <Text style={styles.charCount}>{content.length}/{MAX_CONTENT_LENGTH}</Text>
            </View>
            <TextInput
              style={styles.contentInput}
              placeholder="记录你的学习心得，分享有价值的内容..."
              placeholderTextColor={iOSColors.muted}
              multiline
              numberOfLines={10}
              value={content}
              onChangeText={setContent}
              maxLength={MAX_CONTENT_LENGTH}
              textAlignVertical="top"
            />
          </View>

          {/* 标签 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>标签（可选）</Text>
            <TextInput
              style={styles.tagsInput}
              placeholder="多个标签用逗号分隔，如：Python,数据分析"
              placeholderTextColor={iOSColors.muted}
              value={tags}
              onChangeText={setTags}
            />
          </View>

          {/* 可见范围 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>可见范围</Text>
            <View style={styles.visibilityRow}>
              <TouchableOpacity
                style={[
                  styles.visibilityBtn,
                  visibility === 'public' && styles.visibilityBtnActive,
                ]}
                onPress={() => {
                  haptics.light();
                  setVisibility('public');
                }}
              >
                <Ionicons
                  name="globe-outline"
                  size={20}
                  color={visibility === 'public' ? '#fff' : iOSColors.muted}
                />
                <View>
                  <Text
                    style={[
                      styles.visibilityText,
                      visibility === 'public' && styles.visibilityTextActive,
                    ]}
                  >
                    免费公开
                  </Text>
                  <Text
                    style={[
                      styles.visibilityHint,
                      visibility === 'public' && styles.visibilityHintActive,
                    ]}
                  >
                    所有人可查看
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.visibilityBtn,
                  visibility === 'paid' && styles.visibilityBtnActive,
                ]}
                onPress={() => {
                  haptics.light();
                  setVisibility('paid');
                }}
              >
                <Ionicons
                  name="diamond"
                  size={20}
                  color={visibility === 'paid' ? '#fff' : iOSColors.gold}
                />
                <View>
                  <Text
                    style={[
                      styles.visibilityText,
                      visibility === 'paid' && styles.visibilityTextActive,
                    ]}
                  >
                    付费笔记
                  </Text>
                  <Text
                    style={[
                      styles.visibilityHint,
                      visibility === 'paid' && styles.visibilityHintActive,
                    ]}
                  >
                    购买后可查看
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* 付费设置 */}
          {visibility === 'paid' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>定价（积分）</Text>
              <View style={styles.priceRow}>
                <TextInput
                  style={styles.priceInput}
                  placeholder="输入积分价格"
                  placeholderTextColor={iOSColors.muted}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="number-pad"
                  maxLength={5}
                />
                <View style={styles.priceInfo}>
                  <Ionicons name="diamond" size={24} color={iOSColors.gold} />
                  <Text style={styles.priceValue}>{price}</Text>
                </View>
              </View>
              <View style={styles.earningsInfo}>
                <Ionicons name="information-circle" size={16} color={iOSColors.accent} />
                <Text style={styles.earningsText}>
                  购买者支付 {price || 0} 积分，您将获得 {Math.floor((parseInt(price) || 0) * 0.7)} 积分收益（70%）
                </Text>
              </View>
            </View>
          )}

          {/* 发布提示 */}
          <View style={styles.tipsSection}>
            <Ionicons name="bulb" size={20} color={iOSColors.purple} />
            <View style={styles.tipsContent}>
              <Text style={styles.tipsTitle}>优质笔记建议</Text>
              <Text style={styles.tipsText}>• 标题简洁明了，突出主题</Text>
              <Text style={styles.tipsText}>• 内容有深度，分享真实经验</Text>
              <Text style={styles.tipsText}>• 使用合适的标签便于搜索</Text>
              <Text style={styles.tipsText}>• 付费笔记提供更高价值内容</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </TabPageWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
  },
  actionBar: {
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
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: iOSColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: iOSColors.fg,
    flex: 1,
  },
  publishBtn: {
    backgroundColor: iOSColors.accent,
    borderRadius: Rounded.sm,
    paddingVertical: 10,
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
  scrollViewTablet: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
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
    marginBottom: Spacing.xs,
  },
  charCount: {
    fontSize: 11,
    color: iOSColors.muted,
  },
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
  contentInput: {
    backgroundColor: iOSColors.bgSolid,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    fontSize: 14,
    color: iOSColors.fg,
    minHeight: 200,
    lineHeight: 22,
  },
  tagsInput: {
    backgroundColor: iOSColors.bgSolid,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    fontSize: 14,
    color: iOSColors.fg,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  visibilityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    backgroundColor: iOSColors.bgSolid,
  },
  visibilityBtnActive: {
    backgroundColor: iOSColors.accent,
    borderColor: iOSColors.accent,
  },
  visibilityText: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  visibilityTextActive: {
    color: '#fff',
  },
  visibilityHint: {
    fontSize: 11,
    color: iOSColors.muted,
    marginTop: 2,
  },
  visibilityHintActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  priceInput: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    fontSize: 16,
    fontWeight: '500',
    color: iOSColors.fg,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: iOSColors.goldLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Rounded.md,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: iOSColors.gold,
  },
  earningsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    backgroundColor: iOSColors.accentLight,
    padding: Spacing.sm,
    borderRadius: Rounded.sm,
  },
  earningsText: {
    flex: 1,
    fontSize: 12,
    color: iOSColors.accent,
  },
  tipsSection: {
    flexDirection: 'row',
    backgroundColor: iOSColors.purpleLight,
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
    color: iOSColors.purple,
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 12,
    color: iOSColors.purple,
    lineHeight: 18,
    marginTop: 2,
  },
});
