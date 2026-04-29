import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors } from '@/lib/constants/theme';
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

const SKILL_CATEGORIES = [
  { id: 'all', name: '全部', icon: '📚', color: '#607D8B' },
  { id: 'programming', name: '编程', icon: '💻', color: '#5b9bd5' },
  { id: 'data', name: '数据', icon: '📊', color: '#4CAF50' },
  { id: 'business', name: '商业', icon: '📈', color: '#FF9800' },
  { id: 'language', name: '语言', icon: '🌐', color: '#9C27B0' },
  { id: 'math', name: '数学', icon: '🔢', color: '#3F51B5' },
  { id: 'science', name: '科学', icon: '🔬', color: '#00BCD4' },
];

const MASTER_COLORS: Record<number, string> = {
  1: '#ef4444',  // 初学 - 红色
  2: '#f59e0b',  // 了解 - 橙色
  3: '#eab308',  // 熟悉 - 黄色
  4: '#22c55e',  // 掌握 - 绿色
  5: '#3b82f6',  // 精通 - 蓝色
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

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadData();
    }
  }, [authLoading, isAuthenticated, selectedCategory]);

  async function loadData() {
    setIsLoading(true);
    try {
      const skillCategory = selectedCategory === 'all' ? undefined : selectedCategory;

      const [cardsData, statsData] = await Promise.all([
        apiClient.getKnowledgeCards(skillCategory),
        apiClient.getKnowledgeStats(),
      ]);

      setCards(cardsData.cards || []);
      setStats(statsData);
    } catch (error) {
      console.error('Load knowledge error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const onRefresh = useCallback(() => {
    loadData();
  }, [selectedCategory]);

  async function handleSearch() {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const result = await apiClient.searchKnowledgeCards(searchQuery.trim(), selectedCategory === 'all' ? undefined : selectedCategory);
      setCards(result.results || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
      setShowSearch(false);
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

  const renderStatsCard = () => (
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
                    { width: `${cat.avg_mastery * 20}%`, backgroundColor: '#5b9bd5' }
                  ]}
                />
              </View>
              <Text style={styles.categoryCount}>{cat.card_count}张</Text>
            </View>
          ))}
        </View>
      )}
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
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
    >
      {/* 统计卡片 */}
      {stats && renderStatsCard()}

      {/* 分类筛选 */}
      <View style={styles.categoryFilter}>
        {SKILL_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryBtn,
              selectedCategory === cat.id && styles.categoryBtnActive,
              selectedCategory === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color }
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
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
          <Ionicons name="search" size={20} color={Colors.secondary.info} />
          <Text style={styles.searchBtnText}>搜索</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.createBtnText}>创建卡片</Text>
        </TouchableOpacity>
      </View>

      {/* 卡片列表 */}
      <FlatList
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>暂无知识卡片</Text>
            <Text style={styles.emptyHint}>点击上方按钮创建你的第一个知识卡片</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* 搜索弹窗 */}
      <Modal visible={showSearch} transparent animationType="slide">
        <View style={styles.modalContainer}>
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
        </View>
      </Modal>

      {/* 创建弹窗 */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalScroll}>
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
                      category === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color }
                    ]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Text style={styles.selectIcon}>{cat.icon}</Text>
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
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.modalBtnText}>创建</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // 统计卡片
  statsCard: {
    backgroundColor: Colors.neutral.card,
    padding: 16,
    margin: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  statsTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: Colors.neutral.textPrimary },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: Colors.secondary.info },
  statLabel: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: 4 },
  categoryStats: { marginTop: 8 },
  categoryItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  categoryName: { fontSize: 14, color: Colors.neutral.textPrimary, width: 80 },
  categoryBar: { flex: 1, height: 8, backgroundColor: '#e5e7eb', borderRadius: 4 },
  categoryBarFill: { height: 8, borderRadius: 4 },
  categoryCount: { fontSize: 12, color: Colors.neutral.textSecondary, marginLeft: 8, width: 40 },

  // 分类筛选
  categoryFilter: {
    flexDirection: 'row',
    padding: 10,
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: Colors.neutral.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  categoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  categoryBtnActive: { borderWidth: 1 },
  categoryIcon: { fontSize: 14, marginRight: 4 },
  categoryText: { fontSize: 14, color: Colors.neutral.textSecondary },

  // 操作按钮
  actionRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 10,
    gap: 10,
  },
  searchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.neutral.card,
    borderWidth: 1,
    borderColor: Colors.secondary.info,
  },
  searchBtnText: { marginLeft: 6, color: Colors.secondary.info, fontWeight: '500' },
  createBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.secondary.success,
  },
  createBtnText: { marginLeft: 6, color: 'white', fontWeight: '600' },

  // 卡片列表
  listContent: { padding: 12 },
  cardItem: {
    backgroundColor: Colors.neutral.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 16, fontWeight: '600', flex: 1, color: Colors.neutral.textPrimary },
  masteryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  masteryText: { fontSize: 12, fontWeight: '600' },
  cardSummary: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: 8, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  skillBadge: { flexDirection: 'row', alignItems: 'center' },
  skillIcon: { fontSize: 14 },
  skillName: { fontSize: 12, color: Colors.neutral.textSecondary, marginLeft: 4 },
  reviewText: { fontSize: 12, color: Colors.neutral.textSecondary },
  keyPoints: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.neutral.border },
  keyPointText: { fontSize: 13, color: Colors.neutral.textPrimary, lineHeight: 18 },

  // 空状态
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: Colors.neutral.textSecondary, marginTop: 12 },
  emptyHint: { fontSize: 14, color: '#999', marginTop: 8 },

  // 弹窗
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalScroll: { maxHeight: '80%' },
  modalContent: {
    backgroundColor: Colors.neutral.card,
    padding: 20,
    borderRadius: 20,
    marginHorizontal: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, color: Colors.neutral.textPrimary },
  inputLabel: { fontSize: 14, color: Colors.neutral.textSecondary, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    backgroundColor: Colors.neutral.backgroundAlt,
    fontSize: 16,
    color: Colors.neutral.textPrimary,
  },
  contentInput: { minHeight: 100, textAlignVertical: 'top' },
  searchInput: {
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    backgroundColor: Colors.neutral.backgroundAlt,
    fontSize: 16,
  },
  categorySelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  selectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  selectIcon: { fontSize: 12, marginRight: 4 },
  selectText: { fontSize: 12, color: Colors.neutral.textSecondary },
  modalBtn: {
    backgroundColor: Colors.secondary.success,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalBtnDisabled: { backgroundColor: '#ccc' },
  modalBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', marginTop: 12, padding: 10 },
  cancelBtnText: { color: Colors.neutral.textSecondary, fontSize: 16 },

  // 错误/登录
  errorText: { color: Colors.feedback.errorText, fontSize: 16, marginBottom: 20 },
  loginBtn: { backgroundColor: Colors.secondary.info, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginBtnText: { color: 'white', fontSize: 16 },
});