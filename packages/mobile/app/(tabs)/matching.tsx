import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { showError, showSuccess } from '@/lib/utils/error-toast';
import { useGoBack } from '@/lib/utils/navigation';
import { useRouter } from 'expo-router';
import TabPageWrapper from '@/lib/components/TabPageWrapper';

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
};

// 偏好选项配置
const GOAL_TAGS = [
  { key: 'career', label: '职业发展', icon: 'briefcase' as const },
  { key: 'exam', label: '考试备考', icon: 'school' as const },
  { key: 'skill', label: '技能提升', icon: 'construct' as const },
  { key: 'finance', label: '理财投资', icon: 'trending-up' as const },
  { key: 'language', label: '语言学习', icon: 'chatbubbles' as const },
  { key: 'health', label: '健康养生', icon: 'heart' as const },
  { key: 'tech', label: '科技编程', icon: 'code-slash' as const },
  { key: 'creative', label: '创意设计', icon: 'color-palette' as const },
];

const PROGRESS_LEVELS = [
  { key: 'beginner', label: '入门' },
  { key: 'intermediate', label: '进阶' },
  { key: 'advanced', label: '高级' },
];

const SCHEDULE_OPTIONS = [
  { key: 'morning', label: '上午', icon: 'sunny' as const },
  { key: 'afternoon', label: '下午', icon: 'partly-sunny' as const },
  { key: 'evening', label: '晚间', icon: 'moon' as const },
  { key: 'flexible', label: '灵活', icon: 'time' as const },
];

export default function MatchingScreen() {
  const goBack = useGoBack();
  const router = useRouter();
  const [partners, setPartners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 偏好状态
  const [goalTags, setGoalTags] = useState<string[]>([]);
  const [progressLevel, setProgressLevel] = useState('beginner');
  const [schedulePreference, setSchedulePreference] = useState('flexible');
  const [isPrefsLoaded, setIsPrefsLoaded] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [showPrefs, setShowPrefs] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [matchData, prefsData] = await Promise.all([
        apiClient.getAcceptedMatches(),
        apiClient.getMatchingPreferences(),
      ]);
      setPartners(matchData.partners || []);

      // 加载已有偏好
      if (prefsData && !prefsData.is_default) {
        setGoalTags(prefsData.goal_tags || []);
        setProgressLevel(prefsData.progress_level || 'beginner');
        setSchedulePreference(prefsData.schedule_preference || 'flexible');
        // 有偏好且有伙伴时默认折叠偏好区
        setShowPrefs(matchData.partners?.length === 0);
      } else {
        // 没设过偏好，展开偏好区
        setShowPrefs(true);
      }
      setIsPrefsLoaded(true);
    } catch (error) {
      showError(error);
      console.error('Load matching error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const toggleGoalTag = useCallback((tag: string) => {
    setGoalTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  async function savePreferences() {
    if (goalTags.length === 0) {
      showError('请至少选择一个学习目标');
      return;
    }
    setIsSavingPrefs(true);
    try {
      await apiClient.setMatchingPreferences(goalTags, [], progressLevel, schedulePreference);
      showSuccess('偏好已保存');
      setShowPrefs(false);
    } catch (error) {
      showError(error);
    } finally {
      setIsSavingPrefs(false);
    }
  }

  async function handleSearch() {
    if (!isPrefsLoaded) return;
    // 检查偏好是否已设置
    if (goalTags.length === 0) {
      setShowPrefs(true);
      showError('请先设置学习偏好');
      return;
    }
    try {
      const results = await apiClient.searchMatches();
      if (results?.matches?.length > 0) {
        // 刷新伙伴列表
        const matchData = await apiClient.getAcceptedMatches();
        setPartners(matchData.partners || []);
        showSuccess(`找到 ${results.matches.length} 个匹配`);
      } else {
        showSuccess('暂无新的匹配，请稍后再试');
      }
    } catch (error) {
      showError(error);
    }
  }

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
      <View style={styles.pageHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>学习匹配</Text>
        <TouchableOpacity style={styles.buddyBtn} onPress={() => router.navigate('/buddy')} activeOpacity={0.7}>
          <Ionicons name="happy" size={18} color={iOSColors.accent} />
          <Text style={styles.buddyBtnText}>学习搭子</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
      >
        {/* 偏好设置区域 */}
        {isPrefsLoaded && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowPrefs(!showPrefs)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="settings-outline" size={18} color={iOSColors.accent} />
                <Text style={styles.sectionTitle}>匹配偏好</Text>
              </View>
              <Ionicons
                name={showPrefs ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={iOSColors.muted}
              />
            </TouchableOpacity>

            {showPrefs && (
              <View style={styles.prefsContent}>
                {/* 学习目标 */}
                <Text style={styles.fieldLabel}>学习目标</Text>
                <View style={styles.tagGrid}>
                  {GOAL_TAGS.map(tag => {
                    const selected = goalTags.includes(tag.key);
                    return (
                      <TouchableOpacity
                        key={tag.key}
                        style={[styles.tagChip, selected && styles.tagChipSelected]}
                        onPress={() => toggleGoalTag(tag.key)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={tag.icon}
                          size={14}
                          color={selected ? '#fff' : iOSColors.accent}
                        />
                        <Text style={[styles.tagLabel, selected && styles.tagLabelSelected]}>
                          {tag.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 进度等级 */}
                <Text style={styles.fieldLabel}>学习阶段</Text>
                <View style={styles.optionRow}>
                  {PROGRESS_LEVELS.map(level => {
                    const selected = progressLevel === level.key;
                    return (
                      <TouchableOpacity
                        key={level.key}
                        style={[styles.optionChip, selected && styles.optionChipSelected]}
                        onPress={() => setProgressLevel(level.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                          {level.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 时间偏好 */}
                <Text style={styles.fieldLabel}>学习时间</Text>
                <View style={styles.optionRow}>
                  {SCHEDULE_OPTIONS.map(opt => {
                    const selected = schedulePreference === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.scheduleChip, selected && styles.scheduleChipSelected]}
                        onPress={() => setSchedulePreference(opt.key)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={14}
                          color={selected ? '#fff' : iOSColors.secondary}
                        />
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 保存按钮 */}
                <TouchableOpacity
                  style={[styles.saveButton, isSavingPrefs && styles.saveButtonDisabled]}
                  onPress={savePreferences}
                  disabled={isSavingPrefs}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.saveButtonText}>
                    {isSavingPrefs ? '保存中...' : '保存偏好'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* 搜索匹配按钮 */}
        {isPrefsLoaded && goalTags.length > 0 && (
          <TouchableOpacity style={styles.searchCard} onPress={handleSearch} activeOpacity={0.7}>
            <View style={styles.searchCardLeft}>
              <View style={styles.searchIconBg}>
                <Ionicons name="search" size={20} color={iOSColors.accent} />
              </View>
              <View>
                <Text style={styles.searchCardTitle}>搜索学习伙伴</Text>
                <Text style={styles.searchCardDesc}>
                  {goalTags.length}个目标 · {PROGRESS_LEVELS.find(l => l.key === progressLevel)?.label} · {SCHEDULE_OPTIONS.find(s => s.key === schedulePreference)?.label}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={iOSColors.muted} />
          </TouchableOpacity>
        )}

        {/* 学习伙伴列表 */}
        {partners.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>学习伙伴 ({partners.length})</Text>
            {partners.map((p: any) => (
              <View key={p.match_id} style={styles.partnerCard}>
                <View style={styles.partnerAvatar}>
                  <Ionicons name="person" size={24} color={Colors.primary.main} />
                </View>
                <View style={styles.partnerInfo}>
                  <Text style={styles.partnerName}>{p.nickname || '匿名用户'}</Text>
                  {p.common_tags?.length > 0 && (
                    <Text style={styles.partnerTags}>共同目标: {p.common_tags.join(', ')}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.studyTogetherBtn}
                  onPress={() => router.navigate('/buddy' as any)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chatbubbles-outline" size={14} color="#fff" />
                  <Text style={styles.studyTogetherText}>互动</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 空状态（已设偏好但无伙伴） */}
        {isPrefsLoaded && partners.length === 0 && goalTags.length > 0 && !showPrefs && (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={64} color={Colors.neutral.textSecondary} />
            <Text style={styles.emptyTitle}>还没有学习伙伴</Text>
            <Text style={styles.emptyDesc}>点击上方搜索按钮寻找匹配</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      </View>
    </TabPageWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
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
  pageTitle: { fontSize: 18, fontWeight: '600', color: iOSColors.fg, letterSpacing: -0.3, flex: 1 },
  buddyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: iOSColors.accentLight,
    borderRadius: Rounded.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(196, 90, 26, 0.2)',
  },
  buddyBtnText: { fontSize: 13, fontWeight: '600', color: iOSColors.accent },
  scrollView: { flex: 1, paddingHorizontal: Spacing.md },

  // Section
  section: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral.textPrimary },

  // Preferences
  prefsContent: {
    marginTop: Spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: iOSColors.muted,
    marginBottom: 8,
    marginTop: Spacing.sm,
  },

  // Goal tags
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Rounded.full,
    backgroundColor: iOSColors.accentLight,
    borderWidth: 1,
    borderColor: 'rgba(196, 90, 26, 0.15)',
  },
  tagChipSelected: {
    backgroundColor: iOSColors.accent,
    borderColor: iOSColors.accent,
  },
  tagLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: iOSColors.accent,
  },
  tagLabelSelected: {
    color: '#fff',
  },

  // Option chips (progress & schedule)
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: Rounded.full,
    backgroundColor: Colors.neutral.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  optionChipSelected: {
    backgroundColor: iOSColors.secondary,
    borderColor: iOSColors.secondary,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral.textPrimary,
  },
  optionLabelSelected: {
    color: '#fff',
  },

  // Schedule chips
  scheduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Rounded.full,
    backgroundColor: iOSColors.secondaryLight,
    borderWidth: 1,
    borderColor: 'rgba(26, 138, 138, 0.15)',
  },
  scheduleChipSelected: {
    backgroundColor: iOSColors.secondary,
    borderColor: iOSColors.secondary,
  },

  // Save button
  saveButton: {
    backgroundColor: iOSColors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Rounded.full,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Search card
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    marginBottom: Spacing.md,
  },
  searchCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  searchIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: iOSColors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.textPrimary,
  },
  searchCardDesc: {
    fontSize: 12,
    color: Colors.neutral.textSecondary,
    marginTop: 2,
  },

  // Partner list
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Rounded.md,
    backgroundColor: Colors.neutral.backgroundAlt,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  partnerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  partnerInfo: { flex: 1 },
  partnerName: { fontSize: 16, fontWeight: '600', color: Colors.neutral.textPrimary },
  partnerTags: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  studyTogetherBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.primary.main, borderRadius: 14,
  },
  studyTogetherText: { fontSize: 12, color: '#fff', fontWeight: '500' },

  // Empty state
  emptyCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.xl,
    borderRadius: Rounded.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral.textPrimary, marginTop: Spacing.md },
  emptyDesc: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
});
