import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { showError } from '@/lib/utils/error-toast';

interface KnowledgeCardDetail {
  id: string;
  title: string;
  content: string;
  summary: string;
  key_points: string[];
  source_type: string;
  source_id: string;
  scene_id: string;
  source_name: string | null;  // 来源课程名称
  skill_category: string;
  skill_name: string;
  tags: string[];
  mastery_level: number;
  mastery_name: string;
  review_count: number;
  last_reviewed_at: string | null;
  created_at: string;
  relations: Array<{
    relation_id: string;
    to_card_id: string;
    to_card_title: string;
    relation_type: string;
  }>;
}

const MASTER_COLORS: Record<number, string> = {
  1: Colors.feedback.errorText,
  2: Colors.accent.main,
  3: Colors.accent.light,
  4: Colors.secondary.success,
  5: Colors.primary.light,
};

export default function KnowledgeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [card, setCard] = useState<KnowledgeCardDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRelateModal, setShowRelateModal] = useState(false);

  // 编辑表单
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  // 关联表单
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [relationType, setRelationType] = useState('related');

  useEffect(() => {
    if (id) {
      loadCard();
    }
  }, [id]);

  const loadCard = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getKnowledgeCard(id as string);
      setCard(data);
      setEditTitle(data.title);
      setEditContent(data.content);
    } catch (error) {
      console.error('Load card error:', error);
      Alert.alert('错误', '加载知识卡片失败');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  async function handleReview(masteryChange: number) {
    try {
      const result = await apiClient.reviewKnowledgeCard(id as string, masteryChange);
      Alert.alert('复习完成', `掌握度从 ${result.old_mastery} 提升到 ${result.new_mastery}`);
      loadCard();
    } catch (error) {
      Alert.alert('失败', '复习记录更新失败');
    }
  }

  async function handleEdit() {
    if (!editTitle.trim() || !editContent.trim()) {
      Alert.alert('错误', '标题和内容不能为空');
      return;
    }

    setSaving(true);
    try {
      await apiClient.updateKnowledgeCard(id as string, {
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      setShowEditModal(false);
      loadCard();
      Alert.alert('成功', '知识卡片已更新');
    } catch (error) {
      Alert.alert('失败', '更新失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    Alert.alert(
      '确认删除',
      '删除后无法恢复，是否继续？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteKnowledgeCard(id as string);
              Alert.alert('已删除');
              router.back();
            } catch (error) {
              Alert.alert('失败', '删除失败');
            }
          },
        },
      ]
    );
  }

  async function searchCards() {
    if (!searchQuery.trim()) return;
    try {
      const result = await apiClient.searchKnowledgeCards(searchQuery.trim());
      setSearchResults(result.results || []);
    } catch (error) {
      showError(error);
      console.error('Search error:', error);
    }
  }

  async function createRelation() {
    if (!selectedCard) {
      Alert.alert('错误', '请选择要关联的卡片');
      return;
    }

    try {
      await apiClient.relateKnowledgeCards(id as string, selectedCard, relationType);
      setShowRelateModal(false);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedCard(null);
      loadCard();
      Alert.alert('成功', '关联已创建');
    } catch (error: any) {
      Alert.alert('失败', error.response?.data?.detail || '创建关联失败');
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.secondary.info} />
      </View>
    );
  }

  if (!card) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>知识卡片不存在</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary.main} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowEditModal(true)}>
            <Ionicons name="create-outline" size={20} color={Colors.primary.main} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={Colors.feedback.errorText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 主卡片 */}
      <View style={styles.mainCard}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{card.title}</Text>
          <View style={[styles.masteryBadge, { backgroundColor: MASTER_COLORS[card.mastery_level] + '20' }]}>
            <Text style={[styles.masteryText, { color: MASTER_COLORS[card.mastery_level] }]}>
              Lv.{card.mastery_level} {card.mastery_name}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.skillBadge}>
            <Text style={styles.skillName}>{card.skill_name}</Text>
          </View>
          <Text style={styles.metaText}>复习 {card.review_count} 次</Text>
        </View>

        {card.summary && (
          <View style={styles.summarySection}>
            <Text style={styles.summaryLabel}>摘要</Text>
            <Text style={styles.summaryText}>{card.summary}</Text>
          </View>
        )}

        <View style={styles.contentSection}>
          <Text style={styles.contentLabel}>内容</Text>
          <Text style={styles.contentText}>{card.content}</Text>
        </View>

        {card.key_points?.length > 0 && (
          <View style={styles.keyPointsSection}>
            <Text style={styles.keyPointsLabel}>关键要点</Text>
            {card.key_points.map((point, idx) => (
              <View key={idx} style={styles.keyPointItem}>
                <Text style={styles.keyPointBullet}>•</Text>
                <Text style={styles.keyPointText}>{point}</Text>
              </View>
            ))}
          </View>
        )}

        {card.tags?.length > 0 && (
          <View style={styles.tagsSection}>
            {card.tags.map((tag, idx) => (
              <View key={idx} style={styles.tagBadge}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 复习操作 */}
      <View style={styles.reviewSection}>
        <Text style={styles.sectionTitle}>复习掌握度</Text>
        <View style={styles.reviewBtns}>
          <TouchableOpacity style={styles.reviewBtnDown} onPress={() => handleReview(-1)}>
            <Ionicons name="arrow-down" size={20} color={Colors.feedback.errorText} />
            <Text style={styles.reviewBtnTextDown}>下降</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reviewBtnUp} onPress={() => handleReview(1)}>
            <Ionicons name="arrow-up" size={20} color={Colors.neutral.textInverse} />
            <Text style={styles.reviewBtnTextUp}>提升</Text>
          </TouchableOpacity>
        </View>
        {card.last_reviewed_at && (
          <Text style={styles.lastReviewText}>
            上次复习: {new Date(card.last_reviewed_at).toLocaleDateString()}
          </Text>
        )}
      </View>

      {/* 关联知识 */}
      <View style={styles.relationsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>关联知识</Text>
          <TouchableOpacity style={styles.addRelationBtn} onPress={() => setShowRelateModal(true)}>
            <Ionicons name="add-outline" size={20} color={Colors.primary.main} />
          </TouchableOpacity>
        </View>

        {card.relations?.length > 0 ? (
          card.relations.map((rel) => (
            <TouchableOpacity
              key={rel.relation_id}
              style={styles.relationItem}
              onPress={() => router.push(`/knowledge/${rel.to_card_id}` as any)}
            >
              <Text style={styles.relationType}>{rel.relation_type}</Text>
              <Text style={styles.relationTitle}>{rel.to_card_title}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.neutral.textSecondary} />
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>暂无关联知识</Text>
        )}
      </View>

      {/* 来源信息 */}
      {card.source_type !== 'manual' && (
        <View style={styles.sourceSection}>
          <Text style={styles.sectionTitle}>来源</Text>
          {card.source_name ? (
            <TouchableOpacity
              style={styles.sourceLink}
              onPress={() => {
                if (card.source_id) {
                  router.push(`/course/${card.source_id}` as any);
                }
              }}
            >
              <Ionicons name="book-outline" size={16} color={Colors.primary.main} />
              <Text style={styles.sourceLinkText}>{card.source_name}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.neutral.textSecondary} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.sourceText}>
              {card.source_type === 'course' ? '来自课程场景' : '来自笔记'}
            </Text>
          )}
        </View>
      )}

      {/* 编辑弹窗 */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>编辑知识卡片</Text>

            <Text style={styles.inputLabel}>标题</Text>
            <TextInput
              style={styles.input}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="知识点标题"
            />

            <Text style={styles.inputLabel}>内容</Text>
            <TextInput
              style={[styles.input, styles.contentInput]}
              value={editContent}
              onChangeText={setEditContent}
              placeholder="详细描述..."
              multiline
              numberOfLines={5}
            />

            <TouchableOpacity
              style={[styles.modalBtn, saving && styles.modalBtnDisabled]}
              onPress={handleEdit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.neutral.textInverse} />
              ) : (
                <Text style={styles.modalBtnText}>保存</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 关联弹窗 */}
      <Modal visible={showRelateModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContentLarge}>
            <Text style={styles.modalTitle}>关联知识卡片</Text>

            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="搜索要关联的卡片..."
            />
            <TouchableOpacity style={styles.searchBtn} onPress={searchCards}>
              <Text style={styles.searchBtnText}>搜索</Text>
            </TouchableOpacity>

            {searchResults.length > 0 && (
              <ScrollView style={styles.searchResults}>
                {searchResults.map((result) => (
                  <TouchableOpacity
                    key={result.id}
                    style={[
                      styles.resultItem,
                      selectedCard === result.id && styles.resultItemSelected,
                    ]}
                    onPress={() => setSelectedCard(result.id)}
                  >
                    <Text style={styles.resultTitle}>{result.title}</Text>
                    <Text style={styles.resultCategory}>{result.skill_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={styles.inputLabel}>关联类型</Text>
            <View style={styles.relationTypeSelect}>
              {['prerequisite', 'related', 'extends'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeBtn,
                    relationType === type && styles.typeBtnActive,
                  ]}
                  onPress={() => setRelationType(type)}
                >
                  <Text style={[
                    styles.typeBtnText,
                    relationType === type && styles.typeBtnTextActive,
                  ]}>
                    {type === 'prerequisite' ? '前置' : type === 'related' ? '相关' : '延伸'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.modalBtn} onPress={createRelation}>
              <Text style={styles.modalBtnText}>创建关联</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRelateModal(false)}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // 头部
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.neutral.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  backBtn: { padding: Spacing.sm },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { padding: Spacing.sm },

  // 主卡片
  mainCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    margin: Spacing.md,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 20, fontWeight: '700', flex: 1, color: Colors.neutral.textPrimary },
  masteryBadge: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Rounded.sm },
  masteryText: { fontSize: 12, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  skillBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Rounded.sm,
    backgroundColor: Colors.primary.light + '20',
  },
  skillName: { fontSize: 12, color: Colors.primary.main },
  metaText: { fontSize: 12, color: Colors.neutral.textSecondary },

  summarySection: { marginTop: Spacing.md },
  summaryLabel: { fontSize: 14, fontWeight: '600', color: Colors.neutral.textSecondary },
  summaryText: { fontSize: 14, color: Colors.neutral.textPrimary, marginTop: Spacing.sm, lineHeight: 20 },

  contentSection: { marginTop: Spacing.md },
  contentLabel: { fontSize: 14, fontWeight: '600', color: Colors.neutral.textSecondary },
  contentText: { fontSize: 15, color: Colors.neutral.textPrimary, marginTop: Spacing.sm, lineHeight: 24 },

  keyPointsSection: { marginTop: Spacing.md },
  keyPointsLabel: { fontSize: 14, fontWeight: '600', color: Colors.neutral.textSecondary },
  keyPointItem: { flexDirection: 'row', marginTop: Spacing.sm },
  keyPointBullet: { fontSize: 14, color: Colors.primary.main, marginRight: Spacing.sm },
  keyPointText: { fontSize: 14, color: Colors.neutral.textPrimary, flex: 1 },

  tagsSection: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.md },
  tagBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Rounded.full,
    backgroundColor: Colors.neutral.backgroundAlt,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tagText: { fontSize: 12, color: Colors.neutral.textSecondary },

  // 复习操作
  reviewSection: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.neutral.textPrimary },
  reviewBtns: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.md },
  reviewBtnDown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.sm,
    borderWidth: 1,
    borderColor: Colors.feedback.errorText,
  },
  reviewBtnTextDown: { marginLeft: Spacing.sm, color: Colors.feedback.errorText, fontWeight: '500' },
  reviewBtnUp: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.sm,
    backgroundColor: Colors.primary.main,
  },
  reviewBtnTextUp: { marginLeft: Spacing.sm, color: Colors.neutral.textInverse, fontWeight: '600' },
  lastReviewText: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.sm, textAlign: 'center' },

  // 关联知识
  relationsSection: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addRelationBtn: { padding: Spacing.sm },
  relationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  relationType: { fontSize: 12, color: Colors.primary.main, width: 60 },
  relationTitle: { fontSize: 14, color: Colors.neutral.textPrimary, flex: 1 },
  emptyText: { fontSize: 14, color: Colors.neutral.textMuted, marginTop: Spacing.sm },

  // 来源
  sourceSection: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  sourceText: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.sm },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  sourceLinkText: {
    fontSize: 14,
    color: Colors.primary.main,
    marginLeft: Spacing.xs,
    flex: 1,
  },

  // 弹窗
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    marginHorizontal: Spacing.md,
  },
  modalContentLarge: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    marginHorizontal: Spacing.md,
    maxHeight: '80%',
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
    marginBottom: Spacing.sm,
    backgroundColor: Colors.neutral.backgroundAlt,
    fontSize: 16,
  },
  searchBtn: {
    backgroundColor: Colors.secondary.info,
    padding: Spacing.sm,
    borderRadius: Rounded.sm,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  searchBtnText: { color: Colors.neutral.textInverse, fontWeight: '500' },
  searchResults: { maxHeight: 200, marginBottom: Spacing.md },
  resultItem: {
    padding: Spacing.sm,
    borderRadius: Rounded.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    marginBottom: Spacing.sm,
  },
  resultItemSelected: { backgroundColor: Colors.primary.light + '10', borderColor: Colors.primary.main },
  resultTitle: { fontSize: 14, fontWeight: '500', color: Colors.neutral.textPrimary },
  resultCategory: { fontSize: 12, color: Colors.neutral.textSecondary },
  relationTypeSelect: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  typeBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  typeBtnActive: { backgroundColor: Colors.primary.main, borderColor: Colors.primary.main },
  typeBtnText: { fontSize: 14, color: Colors.neutral.textSecondary },
  typeBtnTextActive: { color: Colors.neutral.textInverse },
  modalBtn: {
    backgroundColor: Colors.primary.main,
    padding: Spacing.md,
    borderRadius: Rounded.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  modalBtnDisabled: { backgroundColor: '#ccc' },
  modalBtnText: { color: Colors.neutral.textInverse, fontSize: 16, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', marginTop: Spacing.sm, padding: Spacing.sm },
  cancelBtnText: { color: Colors.neutral.textSecondary, fontSize: 16 },

  errorText: { color: Colors.feedback.errorText, fontSize: 16 },
});