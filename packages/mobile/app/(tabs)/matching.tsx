import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';

interface Match {
  match_id: string;
  user_id: string;
  nickname: string;
  avatar_url: string;
  score: number;
  common_courses: string[];
  common_tags: string[];
  expires_at: string;
}

interface Partner {
  match_id: string;
  user_id: string;
  nickname: string;
  avatar_url: string;
  common_courses: string[];
  common_tags: string[];
}

export default function MatchingScreen() {
  const { onSuccess, onError } = useFeedback();
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [preferences, setPreferences] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  const [goalTags, setGoalTags] = useState('');
  const [progressLevel, setProgressLevel] = useState('beginner');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [pendingData, partnersData, prefsData] = await Promise.all([
        apiClient.getPendingMatches(),
        apiClient.getAcceptedMatches(),
        apiClient.getMatchingPreferences(),
      ]);
      setPendingMatches(pendingData.matches || []);
      setPartners(partnersData.partners || []);
      setPreferences(prefsData);
      setGoalTags(prefsData.goal_tags?.join(',') || '');
      setProgressLevel(prefsData.progress_level || 'beginner');
    } catch (error) {
      console.error('Load matching data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const onRefresh = useCallback(() => {
    loadData();
  }, []);

  const searchMatches = async () => {
    try {
      const result = await apiClient.searchMatches();
      Alert.alert('搜索完成', `找到 ${result.matches?.length || 0} 个匹配`);
      loadData();
    } catch (error: any) {
      Alert.alert('失败', error.response?.data?.detail || '搜索失败');
    }
  };

  const acceptMatch = async (matchId: string) => {
    try {
      await apiClient.acceptMatch(matchId);
      onSuccess();
      Alert.alert('成功', '匹配已接受');
      loadData();
    } catch (error) {
      onError();
      Alert.alert('失败', '操作失败');
    }
  };

  const rejectMatch = async (matchId: string) => {
    try {
      await apiClient.rejectMatch(matchId);
      onSuccess();
      loadData();
    } catch (error) {
      onError();
      Alert.alert('失败', '操作失败');
    }
  };

  const savePreferences = async () => {
    try {
      await apiClient.setMatchingPreferences(
        goalTags.split(',').map(t => t.trim()).filter(t => t),
        [],
        progressLevel,
        'flexible'
      );
      setShowPrefsModal(false);
      loadData();
      onSuccess();
      Alert.alert('成功', '偏好已更新');
    } catch (error) {
      onError();
      Alert.alert('失败', '保存失败');
    }
  };

  const renderPendingMatch = ({ item }: { item: Match }) => (
    <View style={styles.matchItem}>
      <View style={styles.matchInfo}>
        <Text style={styles.matchName}>{item.nickname || '匿名用户'}</Text>
        <Text style={styles.matchScore}>匹配度: {item.score}分</Text>
        {item.common_tags.length > 0 && (
          <Text style={styles.matchTags}>
            共同目标: {item.common_tags.join(', ')}
          </Text>
        )}
      </View>
      <View style={styles.matchActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => acceptMatch(item.match_id)}
        >
          <Text style={styles.acceptText}>接受</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => rejectMatch(item.match_id)}
        >
          <Text style={styles.rejectText}>拒绝</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPartner = ({ item }: { item: Partner }) => (
    <View style={styles.partnerItem}>
      <Text style={styles.partnerName}>{item.nickname}</Text>
      {item.common_tags.length > 0 && (
        <Text style={styles.partnerTags}>
          共同目标: {item.common_tags.join(', ')}
        </Text>
      )}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
    >
      {/* 偏好设置 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>匹配偏好</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowPrefsModal(true)}
          >
            <Text style={styles.settingsText}>设置</Text>
          </TouchableOpacity>
        </View>
        {preferences && (
          <View style={styles.prefsCard}>
            <Text style={styles.prefsText}>
              进度等级: {preferences.progress_level}
            </Text>
            {preferences.goal_tags?.length > 0 && (
              <Text style={styles.prefsText}>
                学习目标: {preferences.goal_tags.join(', ')}
              </Text>
            )}
          </View>
        )}
        <TouchableOpacity style={styles.searchButton} onPress={searchMatches}>
          <Text style={styles.searchButtonText}>搜索匹配</Text>
        </TouchableOpacity>
      </View>

      {/* 待处理匹配 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>待处理匹配 ({pendingMatches.length})</Text>
        <FlatList
          data={pendingMatches}
          renderItem={renderPendingMatch}
          keyExtractor={(item) => item.match_id}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>暂无待处理匹配</Text>
          }
        />
      </View>

      {/* 学习伙伴 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>学习伙伴 ({partners.length})</Text>
        <FlatList
          data={partners}
          renderItem={renderPartner}
          keyExtractor={(item) => item.match_id}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>暂无学习伙伴</Text>
          }
        />
      </View>

      {/* 偏好设置弹窗 */}
      <Modal visible={showPrefsModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>设置匹配偏好</Text>

            <Text style={styles.inputLabel}>学习目标标签</Text>
            <TextInput
              style={styles.input}
              value={goalTags}
              onChangeText={setGoalTags}
              placeholder="如: 数学,编程,英语"
            />

            <Text style={styles.inputLabel}>进度等级</Text>
            <View style={styles.levelOptions}>
              {['beginner', 'intermediate', 'advanced'].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.levelButton,
                    progressLevel === level && styles.activeLevel,
                  ]}
                  onPress={() => setProgressLevel(level)}
                >
                  <Text style={[styles.levelText, progressLevel === level && styles.activeLevelText]}>{level}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={savePreferences}>
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowPrefsModal(false)}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  section: {
    backgroundColor: Colors.neutral.card,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    marginHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral.textPrimary },
  settingsButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    backgroundColor: Colors.neutral.backgroundAlt,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  settingsText: { color: Colors.primary.main, fontSize: 14, fontWeight: '500' },
  prefsCard: {
    backgroundColor: Colors.neutral.backgroundAlt,
    padding: Spacing.sm,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  prefsText: { fontSize: 14, color: Colors.neutral.textSecondary },
  searchButton: {
    backgroundColor: Colors.primary.main,
    padding: Spacing.sm + 6,
    borderRadius: Rounded.lg,
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  searchButtonText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },
  matchItem: {
    padding: Spacing.md,
    borderRadius: Rounded.md,
    backgroundColor: Colors.neutral.backgroundAlt,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  matchInfo: { marginBottom: Spacing.sm },
  matchName: { fontSize: 16, fontWeight: '600', color: Colors.neutral.textPrimary },
  matchScore: { fontSize: 14, color: Colors.primary.main, marginTop: Spacing.xs, fontWeight: '600' },
  matchTags: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  matchActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  acceptButton: {
    backgroundColor: Colors.secondary.success,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
    marginRight: Spacing.sm,
  },
  acceptText: { color: Colors.neutral.white, fontSize: 14, fontWeight: '600' },
  rejectButton: {
    backgroundColor: Colors.feedback.errorText,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
  },
  rejectText: { color: Colors.neutral.white, fontSize: 14, fontWeight: '600' },
  partnerItem: {
    padding: Spacing.md,
    borderRadius: Rounded.md,
    backgroundColor: Colors.neutral.backgroundAlt,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  partnerName: { fontSize: 16, fontWeight: '600', color: Colors.neutral.textPrimary },
  partnerTags: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  emptyText: { color: Colors.neutral.textMuted, textAlign: 'center', padding: Spacing.lg + 4 },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.lg,
    borderRadius: Rounded.lg,
    width: '80%',
  },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: Spacing.lg, color: Colors.neutral.textPrimary },
  inputLabel: { fontSize: 14, color: Colors.neutral.textSecondary, marginBottom: Spacing.sm, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderRadius: Rounded.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: Colors.neutral.backgroundAlt,
    color: Colors.neutral.textPrimary,
    fontSize: 16,
  },
  levelOptions: { flexDirection: 'row', marginBottom: Spacing.lg },
  levelButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    backgroundColor: Colors.neutral.backgroundAlt,
  },
  activeLevel: {
    backgroundColor: Colors.primary.main,
    borderColor: Colors.primary.main,
  },
  levelText: { fontSize: 14, color: Colors.neutral.textSecondary },
  activeLevelText: { color: Colors.neutral.white },
  saveButton: {
    backgroundColor: Colors.primary.main,
    padding: Spacing.sm + 6,
    borderRadius: Rounded.lg,
    alignItems: 'center',
  },
  saveButtonText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },
  cancelButton: {
    padding: Spacing.sm + 6,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  cancelButtonText: { color: Colors.neutral.textSecondary, fontSize: 16 },
});
