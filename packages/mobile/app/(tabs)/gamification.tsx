import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, Animated, Dimensions } from 'react-native';
import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { CelebrationPopup } from '@/components/common/CelebrationPopup';
import { Colors } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';

interface DailyTask {
  id: string;
  name: string;
  description: string;
  reward_points: number;
  type: string;
  completed: boolean;
  progress: number;
  target: number;
  percentage: number;
  icon?: string;
  animation?: string;
}

interface LeagueInfo {
  tier: string;
  name: string;
  icon: string;
  current_points: number;
  next_tier: string | null;
  points_to_next: number | null;
  rank: number;
}

interface CelebrationConfig {
  animation: string;
  duration: number;
  sound: string;
  vibration: string;
  message: string;
  color: string;
  particles?: {
    count: number;
    colors: string[];
    spread: number;
    origin: { y: number };
  };
}

export default function GamificationScreen() {
  const { onSuccess, onError } = useFeedback();
  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [streakInfo, setStreakInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationConfig, setCelebrationConfig] = useState<CelebrationConfig | null>(null);
  const [celebrationPoints, setCelebrationPoints] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();
  }, []);

  // 激励卡片脉冲动画
  useEffect(() => {
    if (overview?.pending_milestones?.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [overview]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [leagueData, tasksData, streakData, overviewData] = await Promise.all([
        apiClient.getMyLeague(),
        apiClient.getDailyTasks(),
        apiClient.getStreakRewards(),
        apiClient.getGamificationOverview(),
      ]);
      setLeague(leagueData);
      setTasks(tasksData.tasks || []);
      setStreakInfo(streakData);
      setOverview(overviewData);
    } catch (error) {
      console.error('Load gamification data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const onRefresh = useCallback(() => {
    loadData();
  }, []);

  const completeTask = async (taskId: string) => {
    try {
      const result = await apiClient.completeTaskWithCelebration(taskId, 1);
      if (result.reward_issued && result.celebration) {
        // 显示庆典效果
        setCelebrationConfig(result.celebration);
        setCelebrationPoints(result.reward_points);
        setCelebrationVisible(true);

        // 刷新数据
        loadData();
      } else if (result.completed) {
        Alert.alert('任务完成', `获得 ${result.reward_points} 积分！`);
        loadData();
      }
    } catch (error) {
      Alert.alert('失败', '操作失败，请稍后重试');
    }
  };

  const checkHiddenAchievements = async (triggerType: string) => {
    try {
      const result = await apiClient.checkHiddenAchievements(triggerType, {});
      if (result.unlocked_count > 0) {
        // 显示隐藏成就庆典
        const achievement = result.unlocked_achievements[0];
        setCelebrationConfig(achievement.celebration);
        setCelebrationPoints(achievement.reward_points);
        setCelebrationVisible(true);
        loadData();
      }
    } catch (error) {
      console.error('Check hidden achievements error:', error);
    }
  };

  const renderTask = ({ item }: { item: DailyTask }) => {
    const taskAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(taskAnim, {
        toValue: 1,
        duration: 300,
        delay: parseInt(item.id.slice(-1)) * 100 || 0,
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View
        style={[
          styles.taskItem,
          item.completed && styles.completedTask,
          {
            transform: [
              {
                scale: taskAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.8, 1.05, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.taskLeft}>
          <View style={styles.taskHeader}>
            <Text style={styles.taskIcon}>{item.icon || '📋'}</Text>
            <Text style={styles.taskName}>{item.name}</Text>
          </View>
          <Text style={styles.taskDesc}>{item.description}</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: `${item.percentage}%`,
                    backgroundColor: item.completed ? Colors.secondary.success : Colors.primary.main,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {item.progress}/{item.target}
            </Text>
          </View>
        </View>
        <View style={styles.taskRight}>
          <Text style={[styles.rewardText, item.completed && styles.rewardCompleted]}>
            +{item.reward_points}
          </Text>
          {!item.completed ? (
            <TouchableOpacity
              style={[styles.taskButton, { backgroundColor: Colors.primary.main }]}
              onPress={() => completeTask(item.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.taskButtonText}>完成</Text>
            </TouchableOpacity>
          ) : (
            <Animated.View style={styles.completedBadge}>
              <Text style={styles.completedText}>✓</Text>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    );
  };

  const renderMilestoneCard = (milestone: any) => (
    <Animated.View
      key={milestone.id}
      style={[
        styles.milestoneCard,
        {
          transform: [{ scale: pulseAnim }],
          borderColor: milestone.rarity === 'legendary' ? Colors.primary.main : milestone.rarity === 'epic' ? Colors.secondary.wisdom : Colors.secondary.info,
        },
      ]}
    >
      <Text style={styles.milestoneIcon}>{milestone.icon}</Text>
      <Text style={styles.milestoneName}>{milestone.name}</Text>
      <Text style={styles.milestoneHint}>连续打卡 {milestone.streak_target} 天可解锁</Text>
      <TouchableOpacity
        style={styles.unlockButton}
        onPress={() => checkHiddenAchievements('streak')}
      >
        <Text style={styles.unlockButtonText}>检查解锁</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            {/* 激励总览 */}
            {overview && (
              <View style={styles.motivationCard}>
                <Text style={styles.motivationMessage}>{overview.motivation_message}</Text>
              </View>
            )}

            {/* 联赛等级 */}
            {league && (
              <View style={[styles.leagueCard, { backgroundColor: league.tier === 'champion' ? Colors.feedback.warningBg : Colors.primary.main }]}>
                <Text style={styles.leagueIcon}>{league.icon}</Text>
                <Text style={styles.leagueName}>{league.name}</Text>
                <Text style={styles.leaguePoints}>
                  {league.current_points} 积分
                </Text>
                {league.next_tier && (
                  <View style={styles.progressContainer}>
                    <View style={styles.nextTierBar}>
                      <View
                        style={[
                          styles.nextTierProgress,
                          { width: `${Math.min(100, (league.current_points / (league.points_to_next || 1)) * 100)}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.nextTier}>
                      还需 {league.points_to_next} 积分升至下一级
                    </Text>
                  </View>
                )}
                <Text style={styles.rank}>全服排名 #{league.rank}</Text>
              </View>
            )}

            {/* 打卡奖励预览 */}
            {streakInfo && (
              <View style={styles.streakCard}>
                <View style={styles.streakHeader}>
                  <Text style={styles.streakTitle}>连续打卡奖励</Text>
                  <Text style={styles.streakFire}>🔥</Text>
                </View>
                <Text style={styles.streakDays}>
                  当前: 第 {streakInfo.current_streak} 天
                </Text>
                <Text style={styles.streakReward}>
                  今日奖励: {streakInfo.current_reward} 积分
                </Text>
                {streakInfo.next_reward_info && (
                  <Text style={styles.nextReward}>
                    明日奖励: {streakInfo.next_reward_info.next_reward} 积分
                    {streakInfo.next_reward_info.reward_increase > 0 &&
                      ` (+${streakInfo.next_reward_info.reward_increase})`}
                  </Text>
                )}
                {/* 7天奖励预览 */}
                <View style={styles.rewardPreview}>
                  {streakInfo.reward_preview?.slice(0, 7).map((day: any, i: number) => (
                    <View key={i} style={styles.previewDay}>
                      <Text style={styles.previewDayNum}>D{day.day}</Text>
                      <Text style={[styles.previewReward, day.is_cycle_end && styles.cycleEndReward]}>
                        {day.reward}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 待解锁里程碑 */}
            {overview?.pending_milestones?.length > 0 && (
              <View style={styles.milestoneSection}>
                <Text style={styles.milestoneSectionTitle}>待解锁里程碑</Text>
                <View style={styles.milestoneList}>
                  {overview.pending_milestones.map(renderMilestoneCard)}
                </View>
              </View>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>每日任务</Text>
              <Text style={styles.taskCount}>
                {tasks.filter(t => t.completed).length}/{tasks.length} 已完成
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>暂无任务</Text>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* 庆典弹窗 */}
      <CelebrationPopup
        visible={celebrationVisible}
        config={celebrationConfig}
        rewardPoints={celebrationPoints}
        onClose={() => setCelebrationVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  listContent: { padding: 12, paddingBottom: 20 },

  // 激励总览
  motivationCard: {
    backgroundColor: Colors.neutral.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderLeftWidth: 4,
    borderLeftColor: Colors.secondary.success,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  motivationMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.textPrimary,
  },

  // 联赛卡片
  leagueCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  leagueIcon: { fontSize: 40 },
  leagueName: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  leaguePoints: { fontSize: 16, color: 'white', marginTop: 5 },
  progressContainer: {
    width: '100%',
    marginTop: 10,
  },
  nextTierBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  nextTierProgress: {
    height: 8,
    backgroundColor: 'white',
    borderRadius: 4,
  },
  nextTier: { fontSize: 14, color: '#ddd', marginTop: 5 },
  rank: { fontSize: 14, color: '#ddd', marginTop: 5 },

  // 打卡卡片
  streakCard: {
    backgroundColor: Colors.neutral.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakTitle: { fontSize: 16, fontWeight: '600', color: Colors.neutral.textPrimary },
  streakFire: { fontSize: 24 },
  streakDays: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: 5 },
  streakReward: { fontSize: 14, color: Colors.primary.main, marginTop: 5, fontWeight: '600' },
  nextReward: { fontSize: 12, color: Colors.neutral.textMuted, marginTop: 5 },
  rewardPreview: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'space-between',
  },
  previewDay: {
    alignItems: 'center',
  },
  previewDayNum: {
    fontSize: 10,
    color: Colors.neutral.textMuted,
  },
  previewReward: {
    fontSize: 12,
    color: Colors.primary.main,
  },
  cycleEndReward: {
    color: Colors.primary.main,
    fontWeight: 'bold',
  },

  // 里程碑
  milestoneSection: {
    marginTop: 10,
    marginBottom: 12,
  },
  milestoneSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: Colors.neutral.textPrimary,
  },
  milestoneList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  milestoneCard: {
    backgroundColor: Colors.neutral.card,
    padding: 15,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    width: 150,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  milestoneIcon: {
    fontSize: 30,
  },
  milestoneName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
    color: Colors.neutral.textPrimary,
  },
  milestoneHint: {
    fontSize: 12,
    color: Colors.neutral.textMuted,
    marginTop: 5,
    textAlign: 'center',
  },
  unlockButton: {
    marginTop: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: Colors.primary.main,
    borderRadius: 15,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  unlockButtonText: {
    color: Colors.neutral.white,
    fontSize: 12,
    fontWeight: '600',
  },

  // 任务列表
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginBottom: 10,
    marginTop: 5,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral.textPrimary },
  taskCount: { fontSize: 14, color: Colors.neutral.textSecondary },
  taskItem: {
    backgroundColor: Colors.neutral.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  completedTask: { backgroundColor: Colors.neutral.backgroundAlt, borderColor: Colors.secondary.success },
  taskLeft: { flex: 1 },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  taskName: { fontSize: 16, fontWeight: '600', color: Colors.neutral.textPrimary },
  taskDesc: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: 4 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  progressBar: {
    width: 100,
    height: 8,
    backgroundColor: Colors.neutral.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  progressText: { fontSize: 12, color: Colors.neutral.textMuted, marginLeft: 10 },
  taskRight: { alignItems: 'center', paddingLeft: 15 },
  rewardText: { fontSize: 16, fontWeight: '600', color: Colors.feedback.warningText },
  rewardCompleted: { color: Colors.secondary.success },
  taskButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  taskButtonText: { color: Colors.neutral.white, fontSize: 12, fontWeight: '600' },
  completedBadge: {
    marginTop: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.secondary.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedText: { color: Colors.neutral.white, fontWeight: 'bold' },
  emptyText: { color: Colors.neutral.textMuted, textAlign: 'center', padding: 20 },
});
