import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { showError } from '@/lib/utils/error-toast';
import { useGoBack } from '@/lib/utils/navigation';
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

// 联赛等级颜色
const LEAGUE_COLORS: Record<string, { bg: string; text: string }> = {
  bronze: { bg: '#CD7F32', text: '#FFFFFF' },
  silver: { bg: '#C0C0C0', text: '#000000' },
  gold: { bg: '#FFD700', text: '#000000' },
  platinum: { bg: '#E5E4E2', text: '#000000' },
  diamond: { bg: '#B9F2FF', text: '#000000' },
  master: { bg: '#FFD700', text: '#000000' },
  champion: { bg: '#FFD700', text: '#000000' },
};

export default function GamificationScreen() {
  const goBack = useGoBack();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const result = await apiClient.getGamificationOverview();
      setData(result);
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  if (isLoading) {
    return (
      <TabPageWrapper hasHeader>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary.main} />
          <Text style={styles.loadingText}>加载成长体系...</Text>
        </View>
      </TabPageWrapper>
    );
  }

  if (!data) {
    return (
      <TabPageWrapper hasHeader>
        <View style={styles.container}>
          <View style={styles.pageHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => goBack()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
            </TouchableOpacity>
            <Text style={styles.pageTitle}>成长体系</Text>
            <View style={styles.pageHeaderActions} />
          </View>
          <View style={styles.emptyState}>
            <Ionicons name="trending-up-outline" size={64} color={Colors.neutral.textSecondary} />
            <Text style={styles.emptyTitle}>加载失败</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
              <Text style={styles.retryBtnText}>重试</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TabPageWrapper>
    );
  }

  const { league, streak, tasks, achievements, buddy, points, motivation_message } = data;
  const leagueColor = LEAGUE_COLORS[league?.tier || 'bronze'];

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
        <View style={styles.pageHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>成长体系</Text>
          <View style={styles.pageHeaderActions} />
        </View>

        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* 联赛等级卡片 */}
          <View style={[styles.leagueCard, { backgroundColor: leagueColor.bg }]}>
            <View style={styles.leagueRow}>
              <Text style={styles.leagueIcon}>{league?.icon || '🥉'}</Text>
              <View style={styles.leagueInfo}>
                <Text style={[styles.leagueName, { color: leagueColor.text }]}>{league?.name || '铜牌'}</Text>
                <Text style={[styles.leaguePoints, { color: leagueColor.text }]}>{league?.current_points || 0} 积分</Text>
              </View>
              <Text style={[styles.leagueRank, { color: leagueColor.text }]}>排名 #{league?.rank || '-'}</Text>
            </View>
            {league?.points_to_next != null && league.points_to_next > 0 ? (
              <View style={styles.progressRow}>
                <Text style={[styles.progressText, { color: leagueColor.text }]}>
                  距{league.next_tier || '下一级'}还需 {league.points_to_next} 分
                </Text>
              </View>
            ) : (
              <Text style={[styles.progressText, { color: leagueColor.text }]}>已达最高等级！</Text>
            )}
          </View>

          {/* 今日学习状态 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>今日学习</Text>
            <View style={styles.statusGrid}>
              <View style={styles.statusCard}>
                <Text style={styles.statusValue}>{streak?.current || 0}</Text>
                <Text style={styles.statusLabel}>连续天</Text>
              </View>
              <View style={styles.statusCard}>
                <Text style={styles.statusValue}>{streak?.today_learning_minutes || 0}</Text>
                <Text style={styles.statusLabel}>今日分</Text>
              </View>
              <View style={styles.statusCard}>
                <Text style={styles.statusValue}>{streak?.streak_level || '起步'}</Text>
                <Text style={styles.statusLabel}>等级</Text>
              </View>
              <View style={styles.statusCard}>
                <Text style={styles.statusValue}>{buddy?.has_buddy ? '🤗' : '-'}</Text>
                <Text style={styles.statusLabel}>
                  {buddy?.has_buddy 
                    ? (buddy.buddy_also_learning_today ? '已学' : '未学')
                    : '无搭子'}
                </Text>
              </View>
            </View>

            {/* 7日日历条 */}
            <View style={styles.weekCalendar}>
              {['一', '二', '三', '四', '五', '六', '日'].map((day, i) => {
                const isActive = streak?.recent_dates?.includes(
                  new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0]
                );
                return (
                  <View key={i} style={styles.calendarDay}>
                    <View style={[styles.calendarDot, isActive && styles.calendarDotActive]} />
                    <Text style={styles.calendarLabel}>{day}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 今日任务 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                今日任务 ({tasks?.completed || 0}/{tasks?.total || 0})
              </Text>
              <Text style={styles.rewardSummary}>已获 {tasks?.reward_earned || 0} 分</Text>
            </View>
            <View style={styles.taskList}>
              {tasks?.items?.map((task: any) => (
                <View key={task.id} style={[styles.taskCard, task.completed && styles.taskCardCompleted]}>
                  <View style={styles.taskRow}>
                    <Text style={styles.taskIcon}>{task.icon}</Text>
                    <View style={styles.taskInfo}>
                      <Text style={[styles.taskName, task.completed && styles.taskNameCompleted]}>
                        {task.name}
                      </Text>
                      {!task.completed && (
                        <View style={styles.taskProgressRow}>
                          <Text style={styles.taskProgressText}>{task.progress}/{task.target}</Text>
                          <View style={styles.taskProgressBar}>
                            <View
                              style={[
                                styles.taskProgressFill,
                                { width: `${(task.progress / Math.max(task.target, 1)) * 100}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.taskProgressPercent}>
                            {Math.round((task.progress / Math.max(task.target, 1)) * 100)}%
                          </Text>
                        </View>
                      )}
                    </View>
                    {task.completed ? (
                      <Text style={styles.taskCompletedBadge}>✅</Text>
                    ) : (
                      <Text style={styles.taskReward}>+{task.reward_points}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* 成就 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                成就 ({achievements?.earned || 0}/{achievements?.total || 0})
              </Text>
            </View>
            
            {/* 即将达成 */}
            {achievements?.next_achievements?.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>即将达成</Text>
                <View style={styles.nextAchievementsGrid}>
                  {achievements.next_achievements.slice(0, 3).map((ach: any) => (
                    <View key={ach.id} style={styles.nextAchievementCard}>
                      <Text style={styles.achIcon}>{ach.icon}</Text>
                      <Text style={styles.achName}>{ach.name}</Text>
                      <View style={styles.achProgressBar}>
                        <View
                          style={[
                            styles.achProgressFill,
                            { width: `${ach.percentage || 0}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.achHint}>
                        {ach.percentage >= 100 ? '可解锁' : `进度 ${Math.round(ach.percentage || 0)}%`}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* 已获得 */}
            {achievements?.items?.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>已获得</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.earnedScroll}>
                  {achievements.items.map((ach: any) => (
                    <View key={ach.id} style={styles.earnedBadge}>
                      <Text style={styles.earnedIcon}>{ach.icon}</Text>
                      <Text style={styles.earnedName} numberOfLines={1}>{ach.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </View>

          {/* 积分 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>积分</Text>
            <View style={styles.pointsCard}>
              <Text style={styles.pointsBalance}>{points?.current_balance || 0}</Text>
              <Text style={styles.pointsLabel}>当前积分</Text>
              <View style={styles.pointsStats}>
                <Text style={styles.pointsStat}>今日 +{points?.today_earned || 0}</Text>
                <Text style={styles.pointsStat}>本周 +{points?.this_week_earned || 0}</Text>
              </View>
            </View>
          </View>

          {/* 激励消息 */}
          {motivation_message && (
            <View style={styles.motivationCard}>
              <Ionicons name="sparkles" size={20} color={Colors.primary.main} />
              <Text style={styles.motivationText}>{motivation_message}</Text>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.neutral.background },
  loadingText: { marginTop: Spacing.md, fontSize: 14, color: iOSColors.muted },
  
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
  pageHeaderActions: { flexDirection: 'row', gap: Spacing.xs },
  
  scrollView: { flex: 1, paddingHorizontal: Spacing.md },
  
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral.textPrimary, marginTop: Spacing.md },
  retryBtn: { backgroundColor: Colors.primary.main, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Rounded.full, marginTop: Spacing.lg },
  retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // 联赛卡片
  leagueCard: {
    borderRadius: Rounded.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  leagueRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  leagueIcon: { fontSize: 40, marginRight: Spacing.md },
  leagueInfo: { flex: 1 },
  leagueName: { fontSize: 20, fontWeight: '700' },
  leaguePoints: { fontSize: 16, fontWeight: '500', marginTop: 2 },
  leagueRank: { fontSize: 14, fontWeight: '600' },
  progressRow: { marginTop: Spacing.sm },
  progressText: { fontSize: 13, fontWeight: '500' },

  // 状态网格
  section: { backgroundColor: Colors.neutral.card, borderRadius: Rounded.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.neutral.border },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: iOSColors.fg, marginBottom: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  rewardSummary: { fontSize: 13, color: Colors.primary.main, fontWeight: '600' },
  
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statusCard: { width: '22%', backgroundColor: iOSColors.surface, borderRadius: Rounded.md, padding: Spacing.sm, alignItems: 'center' },
  statusValue: { fontSize: 18, fontWeight: '700', color: iOSColors.fg },
  statusLabel: { fontSize: 11, color: iOSColors.muted, marginTop: 2 },

  // 日历
  weekCalendar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md, paddingHorizontal: Spacing.xs },
  calendarDay: { alignItems: 'center' },
  calendarDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.neutral.border },
  calendarDotActive: { backgroundColor: Colors.primary.main },
  calendarLabel: { fontSize: 10, color: iOSColors.muted, marginTop: 4 },

  // 任务
  taskList: { gap: Spacing.xs },
  taskCard: { backgroundColor: iOSColors.surfaceSolid, borderRadius: Rounded.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.neutral.border },
  taskCardCompleted: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  taskRow: { flexDirection: 'row', alignItems: 'center' },
  taskIcon: { fontSize: 20, marginRight: Spacing.sm },
  taskInfo: { flex: 1 },
  taskName: { fontSize: 14, fontWeight: '500', color: iOSColors.fg },
  taskNameCompleted: { textDecorationLine: 'line-through', color: '#059669' },
  taskProgressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  taskProgressText: { fontSize: 11, color: iOSColors.muted, marginRight: 6 },
  taskProgressBar: { flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  taskProgressFill: { height: '100%', backgroundColor: Colors.primary.main, borderRadius: 3 },
  taskProgressPercent: { fontSize: 11, color: iOSColors.muted, marginLeft: 6 },
  taskCompletedBadge: { fontSize: 18, marginLeft: Spacing.sm },
  taskReward: { fontSize: 14, fontWeight: '600', color: '#F59E0B', marginLeft: Spacing.sm },

  // 成就
  subsectionTitle: { fontSize: 14, fontWeight: '600', color: iOSColors.muted, marginTop: Spacing.md, marginBottom: Spacing.sm },
  nextAchievementsGrid: { flexDirection: 'row', gap: Spacing.sm },
  nextAchievementCard: { flex: 1, backgroundColor: iOSColors.surface, borderRadius: Rounded.md, padding: Spacing.sm, alignItems: 'center' },
  achIcon: { fontSize: 28, marginBottom: 4 },
  achName: { fontSize: 13, fontWeight: '600', color: iOSColors.fg, textAlign: 'center' },
  achProgressBar: { width: '100%', height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  achProgressFill: { height: '100%', backgroundColor: Colors.primary.main, borderRadius: 3 },
  achHint: { fontSize: 11, color: iOSColors.muted, marginTop: 4 },
  
  earnedScroll: { marginTop: Spacing.sm },
  earnedBadge: { width: 70, alignItems: 'center', marginRight: Spacing.sm, backgroundColor: iOSColors.surface, borderRadius: Rounded.md, padding: Spacing.sm },
  earnedIcon: { fontSize: 24 },
  earnedName: { fontSize: 11, color: iOSColors.fg, textAlign: 'center', marginTop: 4 },

  // 积分
  pointsCard: { backgroundColor: '#FEF3C7', borderRadius: Rounded.lg, padding: Spacing.lg, alignItems: 'center' },
  pointsBalance: { fontSize: 32, fontWeight: '700', color: '#F59E0B' },
  pointsLabel: { fontSize: 14, color: '#B45309', marginTop: 2 },
  pointsStats: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
  pointsStat: { fontSize: 13, color: '#92400E', fontWeight: '500' },

  // 激励
  motivationCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary.light, padding: Spacing.md, borderRadius: Rounded.lg, gap: Spacing.sm },
  motivationText: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.primary.main },
});
