import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGoBack } from '@/lib/utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { apiClient } from '@/lib/api-client';
import TabPageWrapper from '@/lib/components/TabPageWrapper';
import { useResponsiveDimensions } from '@/lib/utils/responsive';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { showError, confirmAction } from '@/lib/utils/error-toast';

const iOSColors = {
  bgSolid: '#f5f3f2',
  surface: 'rgba(255, 255, 255, 0.55)',
  surfaceSolid: '#FFFFFF',
  fg: '#1a1a1a',
  muted: '#666666',
  border: 'rgba(230, 225, 220, 0.6)',
  accent: '#c45a1a',
  accentLight: '#fde8e0',
  gold: '#f59e0b',
  goldLight: '#fef3c7',
  green: '#10b981',
  greenLight: '#d1fae5',
};

interface NoteDetail {
  id: string;
  user_id: string;
  title: string;
  content: string;
  course_id?: string;
  visibility: string;
  price: number;
  tags: string;
  rating: number;
  rating_count: number;
  purchase_count: number;
  is_purchased: boolean;
  is_author: boolean;
  user_rating?: number;
  preview?: string;
  message?: string;
  created_at: string;
}

export default function SharedNoteDetailScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const params = useLocalSearchParams();
  const haptics = useHaptics();
  const { isTablet } = useResponsiveDimensions();

  const noteId = params.id as string;

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [userRating, setUserRating] = useState(0);

  useEffect(() => {
    loadNoteDetail();
  }, [noteId]);

    async function loadNoteDetail() {
    try {
      setIsLoading(true);
      const data = await apiClient.getSharedNoteDetail(noteId);
      setNote(data);
      // 从服务器获取用户评分
      if (data.user_rating) {
        setUserRating(data.user_rating);
      }
    } catch (err) {
      console.error('Load note detail error:', err);
      showError('加载笔记失败');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePurchase() {
    if (!note) return;

    haptics.medium();
    confirmAction('确认购买', `将花费 ${note.price} 积分购买此笔记\n作者将获得 ${Math.floor(note.price * 0.7)} 积分`, async () => {
            try {
              setIsPurchasing(true);
              const result = await apiClient.purchaseSharedNote(noteId);
              showError(result.message || '可以查看完整内容');
              await loadNoteDetail();
            } catch (err: any) {
              console.error('Purchase error:', err);
              showError(err?.response?.data?.detail || '请稍后重试');
            } finally {
              setIsPurchasing(false);
            }
          });
  }

  async function handleRating(rating: number) {
    if (!note || note.is_author) return;

    try {
      await apiClient.rateSharedNote(noteId, rating);
      setUserRating(rating);
      haptics.light();
      showError('感谢您的评分');
      await loadNoteDetail();
    } catch (err: any) {
      console.error('Rating error:', err);
      showError(err?.response?.data?.detail || '请稍后重试');
    }
  }

  if (isLoading) {
    return (
      <TabPageWrapper hasHeader>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={iOSColors.accent} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </TabPageWrapper>
    );
  }

  if (!note) {
    return (
      <TabPageWrapper hasHeader>
        <View style={styles.errorContainer}>
          <Ionicons name="document-text-outline" size={48} color={iOSColors.muted} />
          <Text style={styles.errorText}>笔记不存在</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => goBack()}>
            <Text style={styles.backBtnText}>返回</Text>
          </TouchableOpacity>
        </View>
      </TabPageWrapper>
    );
  }

  const isPaid = note.visibility === 'paid' && note.price > 0;
  const canViewFull = note.is_author || note.is_purchased || !isPaid;
  const displayContent = canViewFull ? note.content : (note.preview || note.content.slice(0, 200) + '...');

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
        {/* 导航栏 */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>笔记详情</Text>
          <View style={styles.navRight} />
        </View>

        <ScrollView
          style={[styles.scrollView, isTablet && styles.scrollViewTablet]}
          showsVerticalScrollIndicator={false}
        >
          {/* 标题区域 */}
          <View style={styles.headerSection}>
            <Text style={styles.title}>{note.title}</Text>
            <View style={styles.metaRow}>
              {isPaid && (
                <View style={styles.priceTag}>
                  <Ionicons name="diamond" size={14} color={iOSColors.gold} />
                  <Text style={styles.priceText}>{note.price} 积分</Text>
                </View>
              )}
              {!isPaid && (
                <View style={styles.freeTag}>
                  <Text style={styles.freeText}>免费</Text>
                </View>
              )}
              {note.rating > 0 && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={14} color={iOSColors.gold} />
                  <Text style={styles.ratingText}>{note.rating.toFixed(1)}</Text>
                  <Text style={styles.ratingCount}>({note.rating_count})</Text>
                </View>
              )}
              <Text style={styles.purchaseCount}>{note.purchase_count} 人购买</Text>
            </View>
            {note.is_author && (
              <View style={styles.authorBadge}>
                <Ionicons name="person" size={12} color={iOSColors.accent} />
                <Text style={styles.authorText}>我的笔记</Text>
              </View>
            )}
          </View>

          {/* 内容区域 */}
          <View style={styles.contentSection}>
            <Text style={styles.contentText}>{displayContent}</Text>
          </View>

          {/* 未购买提示 */}
          {!canViewFull && (
            <View style={styles.purchasePrompt}>
              <View style={styles.purchasePromptIcon}>
                <Ionicons name="lock-closed" size={32} color={iOSColors.accent} />
              </View>
              <Text style={styles.purchasePromptTitle}>付费笔记</Text>
              <Text style={styles.purchasePromptDesc}>
                购买后可查看完整内容{'\n'}
                作者将获得 {Math.floor(note.price * 0.7)} 积分收益
              </Text>
              <TouchableOpacity
                style={styles.purchaseBtn}
                onPress={handlePurchase}
                disabled={isPurchasing}
                activeOpacity={0.8}
              >
                {isPurchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="diamond" size={18} color="#fff" />
                    <Text style={styles.purchaseBtnText}>{note.price} 积分购买</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* 评分区域（已购买且非作者） */}
          {(note.is_purchased && !note.is_author) && (
            <View style={styles.ratingSection}>
              <Text style={styles.ratingTitle}>为笔记评分</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleRating(star)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={star <= userRating ? 'star' : 'star-outline'}
                      size={32}
                      color={iOSColors.gold}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 标签 */}
          {note.tags && (
            <View style={styles.tagsSection}>
              <Text style={styles.tagsTitle}>标签</Text>
              <View style={styles.tagsRow}>
                {note.tags.split(',').map((tag, idx) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={styles.tagText}>{tag.trim()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </TabPageWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  scrollViewTablet: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },

  // Loading & Error
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: iOSColors.muted,
    marginTop: Spacing.sm,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: iOSColors.muted,
    marginTop: Spacing.sm,
  },
  backBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Rounded.md,
    backgroundColor: iOSColors.accent,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Header
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: iOSColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  navRight: {
    width: 44,
  },
  headerSection: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: iOSColors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: iOSColors.fg,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: iOSColors.goldLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '600',
    color: iOSColors.gold,
  },
  freeTag: {
    backgroundColor: iOSColors.greenLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  freeText: {
    fontSize: 13,
    fontWeight: '500',
    color: iOSColors.green,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: iOSColors.gold,
  },
  ratingCount: {
    fontSize: 12,
    color: iOSColors.muted,
  },
  purchaseCount: {
    fontSize: 12,
    color: iOSColors.muted,
  },
  authorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    backgroundColor: iOSColors.accentLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  authorText: {
    fontSize: 12,
    fontWeight: '500',
    color: iOSColors.accent,
  },

  // Content
  contentSection: {
    paddingVertical: Spacing.lg,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 24,
    color: iOSColors.fg,
  },

  // Purchase Prompt
  purchasePrompt: {
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: Rounded.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    marginVertical: Spacing.md,
    borderWidth: 1,
    borderColor: iOSColors.accent,
  },
  purchasePromptIcon: {
    marginBottom: Spacing.sm,
  },
  purchasePromptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: Spacing.xs,
  },
  purchasePromptDesc: {
    fontSize: 14,
    color: iOSColors.muted,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  purchaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: iOSColors.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Rounded.md,
  },
  purchaseBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Rating
  ratingSection: {
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: Rounded.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  ratingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: Spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },

  // Tags
  tagsSection: {
    paddingVertical: Spacing.md,
  },
  tagsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: iOSColors.muted,
    marginBottom: Spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  tag: {
    backgroundColor: iOSColors.surface,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: iOSColors.muted,
  },
});