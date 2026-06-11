import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { USE_NATIVE_DRIVER } from '@/lib/configs/animation';
import { Animated } from 'react-native';
import { Rounded, Spacing, Colors } from '@/lib/constants/theme';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { apiClient } from '@/lib/api-client';
import { showError, showSuccess } from '@/lib/utils/error-toast';
import TabPageWrapper from '@/lib/components/TabPageWrapper';
import { useGoBack } from '@/lib/utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveDimensions } from '@/lib/utils/responsive';

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
  gold: '#f59e0b',
  goldLight: '#fef3c7',
  green: '#10b981',
  greenLight: '#d1fae5',
  blue: '#2563eb',
  blueLight: '#dbeafe',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
  codeBg: '#1e1e2e',
  codeText: '#cdd6f4',
};

// 颜色映射
const colorMap: Record<string, { bg: string; stroke: string; tagBg: string; tagText: string }> = {
  coral: { bg: iOSColors.accentLight, stroke: iOSColors.accent, tagBg: '#fce8e0', tagText: '#c45a1a' },
  mint: { bg: iOSColors.secondaryLight, stroke: iOSColors.secondary, tagBg: '#e8f5f5', tagText: '#1a8a8a' },
  gold: { bg: iOSColors.goldLight, stroke: iOSColors.gold, tagBg: '#fef3c7', tagText: '#f59e0b' },
  blue: { bg: iOSColors.blueLight, stroke: iOSColors.blue, tagBg: '#dbeafe', tagText: '#2563eb' },
  purple: { bg: iOSColors.purpleLight, stroke: iOSColors.purple, tagBg: '#ede9fe', tagText: '#8b5cf6' },
};

// 格式化日期
function formatNoteDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}`;
  } catch {
    return dateStr;
  }
}

// 统一笔记数据
interface UnifiedNote {
  id: string;
  title: string;
  content: string;
  course?: string;
  category?: string;
  starred?: boolean;
  color?: string;
  tags?: string[];
  created_at: string;
  related_notes?: Array<{ id: string; title: string; date: string; course: string; color: string }>;
  // 共享笔记字段
  visibility?: string;
  price?: number;
  rating?: number;
  rating_count?: number;
  purchase_count?: number;
  is_purchased?: boolean;
  is_author?: boolean;
  user_rating?: number;
}

// 代码块
function CodeBlock({ code }: { code: string }) {
  return (
    <View style={styles.codeBlock}>
      <Text style={styles.codeText} selectable>{code}</Text>
    </View>
  );
}

// 高亮块
function HighlightBlock({ text }: { text: string }) {
  return (
    <View style={styles.highlightBlock}>
      <Ionicons name="bulb-outline" size={16} color={iOSColors.accent} style={styles.highlightIcon} />
      <Text style={styles.highlightText}>{text}</Text>
    </View>
  );
}

// 相关笔记卡片
function RelatedNoteCard({ note, onPress }: { note: { id: string; title: string; date: string; course: string; color: string }; onPress: () => void }) {
  const haptics = useHaptics();
  const colors = colorMap[note.color] || colorMap.coral;
  return (
    <TouchableOpacity style={styles.relatedItem} onPress={() => { haptics.light(); onPress(); }} activeOpacity={0.7}>
      <View style={[styles.relatedIcon, { backgroundColor: colors.bg }]}>
        <Ionicons name="document-text" size={16} color={colors.stroke} />
      </View>
      <View style={styles.relatedText}>
        <Text style={styles.relatedTitle} numberOfLines={1}>{note.title}</Text>
        <Text style={styles.relatedMeta}>{note.date} · {note.course}</Text>
      </View>
    </TouchableOpacity>
  );
}

// 导航按钮
function NavButton({ icon, accent, onPress }: { icon: keyof typeof Ionicons.glyphMap; accent?: boolean; onPress: () => void }) {
  const scaleAnim = useState(new Animated.Value(1))[0];
  const haptics = useHaptics();
  return (
    <TouchableOpacity
      onPress={() => { haptics.light(); onPress(); }}
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: USE_NATIVE_DRIVER }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: USE_NATIVE_DRIVER }).start()}
      activeOpacity={0.8}
    >
      <Animated.View style={[styles.navBtn, accent && styles.navBtnAccent, { transform: [{ scale: scaleAnim }] }]}>
        <Ionicons name={icon} size={20} color={accent ? '#fff' : iOSColors.fg} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function NoteDetailScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const params = useLocalSearchParams();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveDimensions();

  const noteId = params.id as string;
  const source = (params.source as string) || 'personal'; // 'personal' | 'shared'

  const [note, setNote] = useState<UnifiedNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [userRating, setUserRating] = useState(0);

  const isShared = source === 'shared';
  const isPaid = isShared && note?.visibility === 'paid' && (note?.price ?? 0) > 0;
  const canViewFull = !isShared || !isPaid || note?.is_author || note?.is_purchased;

  // 加载笔记
  const loadNote = useCallback(async () => {
    if (!noteId) return;
    try {
      setIsLoading(true);
      setError(null);
      let data: any;
      if (isShared) {
        data = await apiClient.getSharedNoteDetail(noteId);
        if (data.user_rating) setUserRating(data.user_rating);
      } else {
        data = await apiClient.getPersonalNote(noteId);
      }
      setNote(data as UnifiedNote);
    } catch (err: any) {
      setError(err.message || '加载失败');
      console.error('Load note error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [noteId, isShared]);

  useEffect(() => { loadNote(); }, [loadNote]);

  const onRefresh = async () => { setRefreshing(true); await loadNote(); setRefreshing(false); };

  // 解析内容
  const parseContent = (raw: string) => {
    if (!raw) return [];
    const elements: Array<{ type: string; content: string }> = [];
    const lines = raw.split('\n');
    let currentParagraph = '';
    let inCodeBlock = false;
    let codeContent = '';

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push({ type: 'code', content: codeContent.trim() });
          codeContent = '';
          inCodeBlock = false;
        } else {
          if (currentParagraph) { elements.push({ type: 'text', content: currentParagraph.trim() }); currentParagraph = ''; }
          inCodeBlock = true;
        }
        continue;
      }
      if (inCodeBlock) { codeContent += (codeContent ? '\n' : '') + line; continue; }
      if (line.startsWith('> ') || line.startsWith('💡 ') || line.startsWith('⚡ ')) {
        if (currentParagraph) { elements.push({ type: 'text', content: currentParagraph.trim() }); currentParagraph = ''; }
        elements.push({ type: 'highlight', content: line.replace(/^> |^💡 |^⚡ /, '') });
        continue;
      }
      if (line.trim() === '') {
        if (currentParagraph) { elements.push({ type: 'text', content: currentParagraph.trim() }); currentParagraph = ''; }
        continue;
      }
      currentParagraph += (currentParagraph ? '\n' : '') + line;
    }
    if (inCodeBlock && codeContent) elements.push({ type: 'code', content: codeContent.trim() });
    if (currentParagraph) elements.push({ type: 'text', content: currentParagraph.trim() });
    return elements;
  };

  const contentElements = note ? parseContent(note.content) : [];
  const noteColors = colorMap[note?.color || 'coral'] || colorMap.coral;

  // 购买
  async function handlePurchase() {
    if (!note) return;
    haptics.medium();
    Alert.alert('确认购买', `将花费 ${note.price} 积分购买此笔记\n作者将获得 ${Math.floor((note.price || 0) * 0.7)} 积分`, [
      { text: '取消', style: 'cancel' },
      { text: '购买', onPress: async () => {
        try {
          setIsPurchasing(true);
          const result = await apiClient.purchaseSharedNote(noteId);
          showSuccess(result.message || '购买成功');
          await loadNote();
        } catch (err: any) {
          showError(err?.response?.data?.detail || '购买失败');
        } finally { setIsPurchasing(false); }
      }},
    ]);
  }

  // 评分
  async function handleRating(rating: number) {
    if (!note || note.is_author) return;
    try {
      await apiClient.rateSharedNote(noteId, rating);
      setUserRating(rating);
      haptics.light();
      showSuccess('感谢您的评分');
      await loadNote();
    } catch (err: any) {
      showError(err?.response?.data?.detail || '评分失败');
    }
  }

  // 收藏切换
  async function handleToggleStar() {
    if (!note || isShared) return;
    try {
      await apiClient.toggleNoteStar(noteId);
      haptics.light();
      await loadNote();
    } catch (err) {
      showError(err);
    }
  }

  // ---- 渲染 ----

  // 加载状态
  if (isLoading && !refreshing) {
    return (
      <TabPageWrapper hasHeader>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={iOSColors.accent} />
          <Text style={styles.loadingText}>加载笔记...</Text>
        </View>
      </TabPageWrapper>
    );
  }

  // 错误状态
  if (error || !note) {
    return (
      <TabPageWrapper hasHeader>
        <View style={styles.centerContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={iOSColors.accent} />
          <Text style={styles.errorText}>{error || '笔记不存在'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadNote} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>重新加载</Text>
          </TouchableOpacity>
        </View>
      </TabPageWrapper>
    );
  }

  const displayContent = canViewFull ? note.content : (note.content?.slice(0, 200) + '...');
  const displayElements = canViewFull ? contentElements : parseContent(displayContent);

  // 标签列表：个人笔记用 tags[]，共享笔记用 tags(string, 逗号分隔)
  const tagList: string[] = isShared
    ? (note.tags as any || '').split(',').map((t: string) => t.trim()).filter(Boolean)
    : (Array.isArray(note.tags) ? note.tags : []);

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
        {/* 导航栏 */}
        <View style={[styles.navBar, { paddingTop: Math.max(insets.top, 44) - 44 + 4 }]}>
          <View style={styles.navLeft}>
            <NavButton icon="chevron-back" onPress={() => goBack()} />
          </View>
          <View style={styles.navRight}>
            {/* 个人笔记：编辑+分享 */}
            {!isShared && (
              <>
                <NavButton icon="share-outline" onPress={() => router.push(`/shared-notes/new?noteId=${noteId}` as any)} />
                <NavButton icon="pencil" accent onPress={() => router.push(`/notes/new?edit=${noteId}` as any)} />
              </>
            )}
            {/* 共享笔记且是作者：编辑 */}
            {isShared && note.is_author && (
              <NavButton icon="pencil" accent onPress={() => router.push(`/notes/new?edit=${noteId}` as any)} />
            )}
            {/* 共享笔记且非作者：收藏 */}
            {isShared && !note.is_author && (
              <NavButton icon={note.starred ? 'star' : 'star-outline'} onPress={handleToggleStar} />
            )}
          </View>
        </View>

        {/* 内容 */}
        <ScrollView
          style={[styles.scrollView, isTablet && styles.scrollViewTablet]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary.main]} tintColor={Colors.primary.main} />}
        >
          {/* 标题 */}
          <View style={styles.noteHeader}>
            <Text style={styles.noteTitle}>{note.title}</Text>
            <View style={styles.noteHeaderMeta}>
              {/* 课程/分类标签 */}
              {(note.course || note.category) && (
                <View style={[styles.courseTag, { backgroundColor: noteColors.tagBg }]}>
                  <Text style={[styles.courseTagText, { color: noteColors.tagText }]}>{note.course || note.category}</Text>
                </View>
              )}
              {/* 共享笔记：价格标签 */}
              {isShared && isPaid && (
                <View style={styles.priceTag}>
                  <Ionicons name="diamond" size={12} color={iOSColors.gold} />
                  <Text style={styles.priceText}>{note.price} 积分</Text>
                </View>
              )}
              {isShared && !isPaid && (
                <View style={styles.freeTag}>
                  <Text style={styles.freeText}>免费</Text>
                </View>
              )}
              {/* 共享笔记：评分 */}
              {isShared && (note.rating ?? 0) > 0 && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={14} color={iOSColors.gold} />
                  <Text style={styles.ratingText}>{note.rating!.toFixed(1)}</Text>
                  <Text style={styles.ratingCount}>({note.rating_count})</Text>
                </View>
              )}
              {/* 个人笔记：收藏 */}
              {!isShared && (
                <TouchableOpacity onPress={handleToggleStar} activeOpacity={0.7}>
                  <Ionicons name={note.starred ? 'star' : 'star-outline'} size={18} color={note.starred ? iOSColors.gold : iOSColors.muted} />
                </TouchableOpacity>
              )}
              {/* 日期 */}
              <Text style={styles.noteDate}>{formatNoteDate(note.created_at)}</Text>
            </View>
            {/* 共享笔记：作者标识 */}
            {isShared && note.is_author && (
              <View style={styles.authorBadge}>
                <Ionicons name="person" size={12} color={iOSColors.accent} />
                <Text style={styles.authorText}>我的笔记</Text>
              </View>
            )}
          </View>

          {/* 插图区域 */}
          <View style={[styles.illustration, { backgroundColor: noteColors.bg }]}>
            <View style={styles.chartBars}>
              <View style={[styles.chartBar, { height: 40, opacity: 0.7, backgroundColor: noteColors.stroke }]} />
              <View style={[styles.chartBar, { height: 60, backgroundColor: noteColors.stroke }]} />
              <View style={[styles.chartBar, { height: 75, opacity: 0.8, backgroundColor: noteColors.stroke }]} />
              <View style={[styles.chartBar, { height: 50, opacity: 0.6, backgroundColor: noteColors.stroke }]} />
            </View>
            <Ionicons name="stats-chart" size={40} color={noteColors.stroke} style={styles.chartOverlayIcon} />
          </View>

          {/* 笔记内容 */}
          <View style={styles.noteContent}>
            {displayElements.map((element, idx) => {
              if (element.type === 'code') return <CodeBlock key={idx} code={element.content} />;
              if (element.type === 'highlight') return <HighlightBlock key={idx} text={element.content} />;
              return <Text key={idx} style={styles.contentText}>{element.content}</Text>;
            })}
          </View>

          {/* 未购买提示 */}
          {isShared && !canViewFull && (
            <View style={styles.purchasePrompt}>
              <Ionicons name="lock-closed" size={32} color={iOSColors.accent} />
              <Text style={styles.purchasePromptTitle}>付费笔记</Text>
              <Text style={styles.purchasePromptDesc}>
                购买后可查看完整内容{'\n'}作者将获得 {Math.floor((note.price || 0) * 0.7)} 积分收益
              </Text>
              <TouchableOpacity style={styles.purchaseBtn} onPress={handlePurchase} disabled={isPurchasing} activeOpacity={0.8}>
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
          {isShared && note.is_purchased && !note.is_author && (
            <View style={styles.ratingSection}>
              <Text style={styles.ratingTitle}>为笔记评分</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity key={star} onPress={() => handleRating(star)} activeOpacity={0.7}>
                    <Ionicons name={star <= userRating ? 'star' : 'star-outline'} size={32} color={iOSColors.gold} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 标签 */}
          {tagList.length > 0 && (
            <View style={styles.tagsRow}>
              {tagList.map((tag, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}># {tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 操作按钮 */}
          <View style={styles.actionButtons}>
            {!isShared ? (
              <>
                <TouchableOpacity
                  style={styles.actionBtnPrimary}
                  onPress={() => {
                    haptics.light();
                    Alert.alert('导出笔记', '选择导出格式', [
                      { text: 'PDF', onPress: () => showError('PDF导出功能开发中') },
                      { text: 'Markdown', onPress: () => showError('Markdown导出功能开发中') },
                      { text: '取消', style: 'cancel' },
                    ]);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={styles.actionBtnPrimaryText}>导出</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtnSecondary}
                  onPress={() => { haptics.light(); router.push(`/shared-notes/new?noteId=${noteId}` as any); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-outline" size={18} color={iOSColors.fg} />
                  <Text style={styles.actionBtnSecondaryText}>分享</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.actionBtnPrimary}
                  onPress={() => { haptics.light(); router.push(`/shared-notes/new?noteId=${noteId}` as any); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-outline" size={18} color="#fff" />
                  <Text style={styles.actionBtnPrimaryText}>分享</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtnSecondary}
                  onPress={() => { haptics.light(); handleToggleStar(); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={note.starred ? 'star' : 'star-outline'} size={18} color={note.starred ? iOSColors.gold : iOSColors.fg} />
                  <Text style={styles.actionBtnSecondaryText}>{note.starred ? '已收藏' : '收藏'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* 相关笔记 */}
          {note.related_notes && note.related_notes.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.relatedSectionTitle}>相关笔记</Text>
              {note.related_notes.map((rn) => (
                <RelatedNoteCard key={rn.id} note={rn} onPress={() => router.push(`/note/${rn.id}` as any)} />
              ))}
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </TabPageWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: iOSColors.bgSolid },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 16, color: iOSColors.muted, marginTop: Spacing.sm },
  errorText: { fontSize: 16, color: iOSColors.muted, textAlign: 'center' },
  retryButton: { marginTop: Spacing.md, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: iOSColors.accent, borderRadius: Rounded.md },
  retryButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // 导航栏
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
  },
  navLeft: { flexDirection: 'row', gap: Spacing.xs },
  navRight: { flexDirection: 'row', gap: Spacing.xs },
  navBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.5)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: iOSColors.border,
  },
  navBtnAccent: {
    backgroundColor: iOSColors.accent, borderColor: iOSColors.accent,
  },

  // ScrollView
  scrollView: { flex: 1 },
  scrollViewTablet: { maxWidth: 800, alignSelf: 'center', width: '100%' },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.xs },

  // 标题
  noteHeader: { marginBottom: Spacing.md },
  noteTitle: { fontSize: 22, fontWeight: '700', color: iOSColors.fg, letterSpacing: -0.025, lineHeight: 30, marginBottom: Spacing.xs },
  noteHeaderMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  courseTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  courseTagText: { fontSize: 12, fontWeight: '500' },
  priceTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: iOSColors.goldLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  priceText: { fontSize: 13, fontWeight: '600', color: iOSColors.gold },
  freeTag: { backgroundColor: iOSColors.greenLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  freeText: { fontSize: 13, fontWeight: '500', color: iOSColors.green },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 13, fontWeight: '600', color: iOSColors.gold },
  ratingCount: { fontSize: 12, color: iOSColors.muted },
  noteDate: { fontSize: 12, color: iOSColors.muted },
  authorBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.xs,
    backgroundColor: iOSColors.accentLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, alignSelf: 'flex-start',
  },
  authorText: { fontSize: 12, fontWeight: '500', color: iOSColors.accent },

  // 插图
  illustration: {
    borderRadius: Rounded.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    alignItems: 'center', justifyContent: 'center', minHeight: 120,
  },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginRight: 20 },
  chartBar: { width: 18, borderRadius: 4 },
  chartOverlayIcon: { position: 'absolute', right: 20, bottom: 16, opacity: 0.3 },

  // 内容
  noteContent: { marginBottom: Spacing.lg },
  contentText: { fontSize: 15, lineHeight: 26, color: iOSColors.fg, marginBottom: Spacing.sm },
  codeBlock: {
    backgroundColor: iOSColors.codeBg, borderRadius: Rounded.md,
    padding: Spacing.sm + 4, marginVertical: Spacing.sm, overflow: 'hidden',
  },
  codeText: { fontFamily: 'Courier', fontSize: 13, lineHeight: 20, color: iOSColors.codeText },
  highlightBlock: {
    backgroundColor: iOSColors.accentLight, borderLeftWidth: 3, borderLeftColor: iOSColors.accent,
    borderRadius: 4, padding: Spacing.sm + 2, marginVertical: Spacing.sm,
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
  },
  highlightIcon: { marginTop: 2 },
  highlightText: { flex: 1, fontSize: 14, lineHeight: 22, color: iOSColors.fg },

  // 购买提示
  purchasePrompt: {
    backgroundColor: iOSColors.surfaceSolid, borderRadius: Rounded.lg,
    padding: Spacing.lg, alignItems: 'center', marginVertical: Spacing.md,
    borderWidth: 1, borderColor: iOSColors.accent,
  },
  purchasePromptTitle: { fontSize: 18, fontWeight: '600', color: iOSColors.fg, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  purchasePromptDesc: { fontSize: 14, color: iOSColors.muted, textAlign: 'center', marginBottom: Spacing.md },
  purchaseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: iOSColors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Rounded.md,
  },
  purchaseBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  // 评分
  ratingSection: { alignItems: 'center', marginVertical: Spacing.md, paddingVertical: Spacing.md, borderTopWidth: 0.5, borderTopColor: iOSColors.border },
  ratingTitle: { fontSize: 15, fontWeight: '600', color: iOSColors.fg, marginBottom: Spacing.sm },
  starsRow: { flexDirection: 'row', gap: Spacing.sm },

  // 标签
  tagsRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', marginBottom: Spacing.lg },
  tag: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14,
    backgroundColor: iOSColors.surface, borderWidth: 0.5, borderColor: iOSColors.border,
  },
  tagText: { fontSize: 12, fontWeight: '500', color: iOSColors.muted },

  // 操作按钮
  actionButtons: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  actionBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.sm + 2, borderRadius: Rounded.md,
    backgroundColor: iOSColors.accent, minHeight: 44,
  },
  actionBtnPrimaryText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  actionBtnSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.sm + 2, borderRadius: Rounded.md,
    backgroundColor: iOSColors.surface, borderWidth: 0.5, borderColor: iOSColors.border, minHeight: 44,
  },
  actionBtnSecondaryText: { fontSize: 14, fontWeight: '600', color: iOSColors.fg },

  // 相关笔记
  relatedSection: { marginBottom: Spacing.lg },
  relatedSectionTitle: { fontSize: 15, fontWeight: '600', color: iOSColors.fg, marginBottom: Spacing.sm },
  relatedItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: iOSColors.surface, borderWidth: 0.5, borderColor: iOSColors.border,
    borderRadius: Rounded.md, padding: Spacing.sm, marginBottom: Spacing.xs, minHeight: 44,
  },
  relatedIcon: { width: 32, height: 32, borderRadius: Rounded.sm, alignItems: 'center', justifyContent: 'center' },
  relatedText: { flex: 1 },
  relatedTitle: { fontSize: 13, fontWeight: '600', color: iOSColors.fg },
  relatedMeta: { fontSize: 11, color: iOSColors.muted },
});
