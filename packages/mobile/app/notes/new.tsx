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
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useHaptics } from '@/lib/hooks/use-haptics';

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
};

const MAX_TITLE_LENGTH = 50;
const MAX_CONTENT_LENGTH = 1000;

// Web 兼容的 Alert
const showAlert = (title: string, message?: string, buttons?: any[]) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 0) {
      const result = (globalThis as any).window?.confirm(`${title}\n${message || ''}`);
      if (result && buttons[1]?.onPress) {
        buttons[1].onPress();
      }
    } else {
      (globalThis as any).window?.alert(`${title}${message ? '\n' + message : ''}`);
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

export default function NewNoteScreen() {
  const router = useRouter();
  const haptics = useHaptics();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'paid'>('public');
  const [price, setPrice] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  const categories = ['数据分析', 'Python', 'UI设计', '前端', '后端', '机器学习', '其他'];

  const handleSubmit = async () => {
    // 验证
    if (!title.trim()) {
      showAlert('提示', '请输入笔记标题');
      return;
    }
    if (!content.trim()) {
      showAlert('提示', '请输入笔记内容');
      return;
    }
    if (title.length > MAX_TITLE_LENGTH) {
      showAlert('提示', `标题不能超过${MAX_TITLE_LENGTH}个字符`);
      return;
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      showAlert('提示', `内容不能超过${MAX_CONTENT_LENGTH}个字符`);
      return;
    }

    const priceNum = parseInt(price) || 0;
    if (visibility === 'paid' && priceNum < 1) {
      showAlert('提示', '付费笔记请设置价格');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.publishNote(
        title.trim(),
        content.trim(),
        visibility,
        visibility === 'paid' ? priceNum : 0,
        category
      );

      haptics.medium();
      showAlert('成功', '笔记已发布');
      router.replace('/(tabs)/notes' as any);
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      if (err.response?.status === 401) {
        showAlert('需要登录', '请先登录后再发布笔记', [
          { text: '取消', style: 'cancel' },
          { text: '去登录', onPress: () => router.push('/auth/login' as any) },
        ]);
      } else {
        showAlert('发布失败', errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* 页面头部 */}
      <View style={styles.pageHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/(tabs)/notes' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={20} color={iOSColors.fg} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>写笔记</Text>
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
            placeholder="记录你的学习心得..."
            placeholderTextColor={iOSColors.muted}
            multiline
            numberOfLines={8}
            value={content}
            onChangeText={setContent}
            maxLength={MAX_CONTENT_LENGTH}
            textAlignVertical="top"
          />
        </View>

        {/* 分类选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>分类</Text>
          <View style={styles.categoryRow}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryBtn,
                  category === cat && styles.categoryBtnActive,
                ]}
                onPress={() => {
                  haptics.light();
                  setCategory(cat);
                }}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === cat && styles.categoryTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
                size={16}
                color={visibility === 'public' ? '#fff' : iOSColors.muted}
              />
              <Text
                style={[
                  styles.visibilityText,
                  visibility === 'public' && styles.visibilityTextActive,
                ]}
              >
                公开
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.visibilityBtn,
                visibility === 'private' && styles.visibilityBtnActive,
              ]}
              onPress={() => {
                haptics.light();
                setVisibility('private');
              }}
            >
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={visibility === 'private' ? '#fff' : iOSColors.muted}
              />
              <Text
                style={[
                  styles.visibilityText,
                  visibility === 'private' && styles.visibilityTextActive,
                ]}
              >
                私有
              </Text>
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
                name="diamond-outline"
                size={16}
                color={visibility === 'paid' ? '#fff' : iOSColors.muted}
              />
              <Text
                style={[
                  styles.visibilityText,
                  visibility === 'paid' && styles.visibilityTextActive,
                ]}
              >
                付费
              </Text>
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
              <Ionicons name="diamond" size={20} color={iOSColors.purple} />
            </View>
            <Text style={styles.hint}>购买者支付积分后可查看完整内容，你将获得70%收益</Text>
          </View>
        )}

        {/* 提示 */}
        <View style={styles.tipsSection}>
          <Ionicons name="information-circle" size={20} color={iOSColors.purple} />
          <View style={styles.tipsContent}>
            <Text style={styles.tipsTitle}>发布提示</Text>
            <Text style={styles.tipsText}>• 标题简洁明了，突出主题</Text>
            <Text style={styles.tipsText}>• 内容真实有价值，避免抄袭</Text>
            <Text style={styles.tipsText}>• 选择合适的分类便于他人发现</Text>
            <Text style={styles.tipsText}>• 优质笔记可获得平台推荐</Text>
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
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
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
    flex: 1,
  },
  publishBtn: {
    backgroundColor: iOSColors.purple,
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
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
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
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    backgroundColor: iOSColors.bgSolid,
  },
  categoryBtnActive: {
    backgroundColor: iOSColors.purple,
    borderColor: iOSColors.purple,
  },
  categoryText: {
    fontSize: 13,
    color: iOSColors.muted,
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    backgroundColor: iOSColors.bgSolid,
  },
  visibilityBtnActive: {
    backgroundColor: iOSColors.purple,
    borderColor: iOSColors.purple,
  },
  visibilityText: {
    fontSize: 13,
    color: iOSColors.muted,
  },
  visibilityTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  priceInput: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    fontSize: 14,
    color: iOSColors.fg,
  },
  hint: {
    fontSize: 12,
    color: iOSColors.muted,
    marginTop: Spacing.xs,
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
