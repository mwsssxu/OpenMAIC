import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, TextInput, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';

interface KnowledgeCard {
  id: string;
  title: string;
  content: string;
  summary: string;
  key_points: string[];
  skill_category: string;
  skill_name: string;
  skill_icon: string;
  tags: string[];
  mastery_level: number;
  mastery_name: string;
  review_count: number;
  created_at: string;
}

interface SkillStats {
  category: string;
  category_name: string;
  card_count: number;
  avg_mastery: number;
}

// 使用 Ionicons 替代 emoji，符合扁平化设计规范
const SKILL_CATEGORIES = [
  { id: 'all', name: '全部', iconName: 'book-outline', color: Colors.secondary.slate },
  { id: 'programming', name: '编程', iconName: 'code-slash', color: Colors.primary.main },
  { id: 'data', name: '数据', iconName: 'bar-chart-outline', color: Colors.secondary.success },
  { id: 'business', name: '商业', iconName: 'trending-up-outline', color: Colors.accent.main },
  { id: 'language', name: '语言', iconName: 'language-outline', color: Colors.primary.light },
  { id: 'math', name: '数学', iconName: 'calculator-outline', color: Colors.secondary.info },
  { id: 'science', name: '科学', iconName: 'flask-outline', color: Colors.accent.dark },
];

// 使用主题颜色
const MASTER_COLORS: Record<number, string> = {
  1: Colors.feedback.errorText,
  2: Colors.accent.main,
  3: Colors.accent.light,
  4: Colors.secondary.success,
  5: Colors.primary.light,
};

export default function KnowledgeScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // 创建卡片表单
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [saving, setSaving] = useState(false);

  // 清理标记防止内存泄漏
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (!authLoading && isAuthenticated) {
      loadData();
    }
    return () => {
      cancelledRef.current = true;
    };
  }, [authLoading, isAuthenticated, selectedCategory]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const skillCategory = selectedCategory === 'all' ? undefined : selectedCategory;

      const [cardsData, statsData] = await Promise.all([
        apiClient.getKnowledgeCards(skillCategory),
        apiClient.getKnowledgeStats(),
      ]);

      if (!cancelledRef.current) {
        setCards(cardsData.cards || []);
        setStats(statsData);
      }
    } catch (error) {
      console.error('Load knowledge error:', error);
    } finally {
      if (!cancelledRef.current) {
        setIsLoading(false);
      }
    }
  }, [selectedCategory]);

  const onRefresh = useCallback(() => {
    loadData();
  }, [loadData]);

  async function handleSearch() {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const result = await apiClient.searchKnowledgeCards(searchQuery.trim(), selectedCategory === 'all' ? undefined : selectedCategory);
      if (!cancelledRef.current) {
        setCards(result.results || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      if (!cancelledRef.current) {
        setIsLoading(false);
        setShowSearch(false);
      }
    }
  }

  async function createCard() {
    if (!title.trim() || !content.trim()) {
      Alert.alert('错误', '标题和内容不能为空');
      return;
    }

    setSaving(true);
    try {
      await apiClient.createKnowledgeCard({
        title: title.trim(),
        content: content.trim(),
        skill_category: category,
      });

      setShowCreateModal(false);
      setTitle('');
      setContent('');
      setCategory('general');
      loadData();
      Alert.alert('成功', '知识卡片已创建');
    } catch (error: any) {
      Alert.alert('失败', error.response?.data?.detail || '创建失败');
    } finally {
      setSaving(false);
    }
  }

  const renderCard = ({ item }: { item: KnowledgeCard }) => (
    <TouchableOpacity
      style={styles.cardItem}
      onPress={() => router.push(`/knowledge/${item.id}` as any)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={[styles.masteryBadge, { backgroundColor: MASTER_COLORS[item.mastery_level] + '20' }]}>
          <Text style={[styles.masteryText, { color: MASTER_COLORS[item.mastery_level] }]}>
            Lv.{item.mastery_level}
          </Text>
        </View>
      </View>

      <Text style={styles.cardSummary} numberOfLines={2}>
        {item.summary || item.content.slice(0, 100)}
      </Text>

      <View style={styles.cardFooter}>
        <View style={styles.skillBadge}>
          <Text style={styles.skillIcon}>{item.skill_icon}</Text>
          <Text style={styles.skillName}>{item.skill_name}</Text>
        </View>
        <Text style={styles.reviewText}>
          复习 {item.review_count} 次
        </Text>
      </View>

      {item.key_points?.length > 0 && (
        <View style={styles.keyPoints}>
          {item.key_points.slice(0, 3).map((point, idx) => (
            <Text key={idx} style={styles.keyPointText}>• {point}</Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <>
      {/* 统计卡片 */}
      {stats && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>知识掌握度</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.total_cards || 0}</Text>
              <Text style={styles.statLabel}>知识卡片</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.avg_mastery?.toFixed(1) || '1.0'}</Text>
              <Text style={styles.statLabel}>平均掌握度</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.total_reviews || 0}</Text>
              <Text style={styles.statLabel}>复习次数</Text>
            </View>
          </View>

          {/* 雷达图简化显示 */}
          {stats?.by_category?.length > 0 && (
            <View style={styles.categoryStats}>
              {stats.by_category.slice(0, 4).map((cat: SkillStats) => (
                <View key={cat.category} style={styles.categoryItem}>
                  <Text style={styles.categoryName}>{cat.category_name}</Text>
                  <View style={styles.categoryBar}>
                    <View
                      style={[
                        styles.categoryBarFill,
                        { width: `${cat.avg_mastery * 20}%`, backgroundColor: Colors.primary.main }
                      ]}
                    />
                  </View>
                  <Text style={styles.categoryCount}>{cat.card_count}张</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* 分类筛选 */}
      <View style={styles.categoryFilter}>
        {SKILL_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryBtn,
              selectedCategory === cat.id && styles.categoryBtnActive,
              selectedCategory === cat.id && { backgroundColor: cat.color + '10', borderColor: cat.color }
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Ionicons name={cat.iconName as any} size={16} color={selectedCategory === cat.id ? cat.color : Colors.neutral.textSecondary} />
            <Text style={[
              styles.categoryText,
              selectedCategory === cat.id && { color: cat.color }
            ]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 搜索和创建 */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => setShowSearch(true)}
        >
          <Ionicons name="search-outline" size={20} color={Colors.primary.main} />
          <Text style={styles.searchBtnText}>搜索</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add-outline" size={20} color={Colors.neutral.textInverse} />
          <Text style={styles.createBtnText}>创建卡片</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons name="book-outline" size={48} color={Colors.neutral.textMuted} />
      <Text style={styles.emptyText}>暂无知识卡片</Text>
      <Text style={styles.emptyHint}>点击上方按钮创建你的第一个知识卡片</Text>
    </View>
  );

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.secondary.info} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>请先登录</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.replace('/auth/login')}>
          <Text style={styles.loginBtnText}>去登录</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={styles.container}
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
      />

      {/* 搜索弹窗 */}
      <Modal visible={showSearch} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>搜索知识卡片</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="输入关键词..."
              autoFocus
            />
            <TouchableOpacity style={styles.modalBtn} onPress={handleSearch}>
              <Text style={styles.modalBtnText}>搜索</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSearch(false)}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 创建弹窗 */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>创建知识卡片</Text>

              <Text style={styles.inputLabel}>标题</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="知识点标题"
              />

              <Text style={styles.inputLabel}>内容</Text>
              <TextInput
                style={[styles.input, styles.contentInput]}
                value={content}
                onChangeText={setContent}
                placeholder="详细描述这个知识点..."
                multiline
                numberOfLines={5}
              />

              <Text style={styles.inputLabel}>技能分类</Text>
              <View style={styles.categorySelect}>
                {SKILL_CATEGORIES.filter(c => c.id !== 'all').map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.selectBtn,
                      category === cat.id && { backgroundColor: cat.color + '10', borderColor: cat.color }
                    ]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Ionicons name={cat.iconName as any} size={14} color={category === cat.id ? cat.color : Colors.neutral.textSecondary} />
                    <Text style={[styles.selectText, category === cat.id && { color: cat.color }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.modalBtn, saving && styles.modalBtnDisabled]}
                onPress={createCard}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.neutral.textInverse} />
                ) : (
                  <Text style={styles.modalBtnText}>创建</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // 统计卡片
  statsCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    margin: Spacing.sm,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  statsTitle: { fontSize: 18, fontWeight: '600', marginBottom: Spacing.sm, color: Colors.neutral.textPrimary },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.md },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: Colors.primary.main },
  statLabel: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  categoryStats: { marginTop: Spacing.sm },
  categoryItem: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  categoryName: { fontSize: 14, color: Colors.neutral.textPrimary, width: 80 },
  categoryBar: { flex: 1, height: Spacing.sm, backgroundColor: Colors.neutral.border, borderRadius: Rounded.sm },
  categoryBarFill: { height: Spacing.sm, borderRadius: Rounded.sm },
  categoryCount: { fontSize: 12, color: Colors.neutral.textSecondary, marginLeft: Spacing.sm, width: 40 },

  // 分类筛选
  categoryFilter: {
    flexDirection: 'row',
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.neutral.card,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  categoryBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
    marginRight: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  categoryBtnActive: { borderWidth: 1 },
  categoryText: { fontSize: 14, color: Colors.neutral.textSecondary },

  // 操作按钮
  actionRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  searchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: Rounded.sm,
    backgroundColor: Colors.neutral.card,
    borderWidth: 1,
    borderColor: Colors.primary.main,
  },
  searchBtnText: { marginLeft: Spacing.xs, color: Colors.primary.main, fontWeight: '500' },
  createBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: Rounded.sm,
    backgroundColor: Colors.primary.main,
  },
  createBtnText: { marginLeft: Spacing.xs, color: Colors.neutral.textInverse, fontWeight: '600' },

  // 卡片列表
  listContent: { padding: Spacing.sm },
  cardItem: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 16, fontWeight: '600', flex: 1, color: Colors.neutral.textPrimary },
  masteryBadge: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Rounded.sm },
  masteryText: { fontSize: 12, fontWeight: '600' },
  cardSummary: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.sm, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  skillBadge: { flexDirection: 'row', alignItems: 'center' },
  skillIcon: { fontSize: 14 },
  skillName: { fontSize: 12, color: Colors.neutral.textSecondary, marginLeft: Spacing.xs },
  reviewText: { fontSize: 12, color: Colors.neutral.textSecondary },
  keyPoints: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.neutral.border },
  keyPointText: { fontSize: 13, color: Colors.neutral.textPrimary, lineHeight: 18 },

  // 空状态
  emptyState: { alignItems: 'center', padding: Spacing.xxl },
  emptyText: { fontSize: 16, color: Colors.neutral.textSecondary, marginTop: Spacing.sm },
  emptyHint: { fontSize: 14, color: Colors.neutral.textMuted, marginTop: Spacing.sm },

  // 弹窗
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalScroll: { maxHeight: '80%' },
  modalContent: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    marginHorizontal: Spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: Spacing.md, color: Colors.neutral.textPrimary },
  inputLabel: { fontSize: 14, color: Colors.neutral.textSecondary, marginBottom: Spacing.xs, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderRadius: Rounded.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: Colors.neutral.backgroundAlt,
    fontSize: 16,
    color: Colors.neutral.textPrimary,
  },
  contentInput: { minHeight: 100, textAlignVertical: 'top' },
  searchInput: {
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderRadius: Rounded.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: Colors.neutral.backgroundAlt,
    fontSize: 16,
  },
  categorySelect: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  selectBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  selectText: { fontSize: 12, color: Colors.neutral.textSecondary },
  modalBtn: {
    backgroundColor: Colors.primary.main,
    padding: Spacing.md,
    borderRadius: Rounded.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  modalBtnDisabled: { backgroundColor: '#ccc' },
  modalBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', marginTop: Spacing.sm, padding: Spacing.sm },
  cancelBtnText: { color: Colors.neutral.textSecondary, fontSize: 16 },

  // 错误/登录
  errorText: { color: Colors.feedback.errorText, fontSize: 16, marginBottom: Spacing.md },
  loginBtn: { backgroundColor: Colors.primary.main, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Rounded.sm },
  loginBtnText: { color: 'white', fontSize: 16 },
});