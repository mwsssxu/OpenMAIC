import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

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

export default function GamificationScreen() {
  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [streakInfo, setStreakInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [leagueData, tasksData, streakData] = await Promise.all([
        apiClient.getMyLeague(),
        apiClient.getDailyTasks(),
        apiClient.getStreakRewards(),
      ]);
      setLeague(leagueData);
      setTasks(tasksData.tasks || []);
      setStreakInfo(streakData);
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
      const result = await apiClient.updateTaskProgress(taskId, 1);
      if (result.reward_issued) {
        Alert.alert('任务完成', `获得 ${result.reward_points} 积分！`);
        loadData();
      }
    } catch (error) {
      Alert.alert('失败', '操作失败，请稍后重试');
    }
  };

  const renderTask = ({ item }: { item: DailyTask }) => (
    <View style={[styles.taskItem, item.completed && styles.completedTask]}>
      <View style={styles.taskLeft}>
        <Text style={styles.taskName}>{item.name}</Text>
        <Text style={styles.taskDesc}>{item.description}</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${item.percentage}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {item.progress}/{item.target}
          </Text>
        </View>
      </View>
      <View style={styles.taskRight}>
        <Text style={styles.rewardText}>+{item.reward_points}</Text>
        {!item.completed && (
          <TouchableOpacity
            style={styles.taskButton}
            onPress={() => completeTask(item.id)}
          >
            <Text style={styles.taskButtonText}>完成</Text>
          </TouchableOpacity>
        )}
        {item.completed && (
          <Text style={styles.completedText}>✓ 已完成</Text>
        )}
      </View>
    </View>
  );

  return (
    <FlatList
      data={tasks}
      renderItem={renderTask}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          {/* 联赛等级 */}
          {league && (
            <View style={styles.leagueCard}>
              <Text style={styles.leagueIcon}>{league.icon}</Text>
              <Text style={styles.leagueName}>{league.name}</Text>
              <Text style={styles.leaguePoints}>
                {league.current_points} 积分
              </Text>
              {league.next_tier && (
                <Text style={styles.nextTier}>
                  还需 {league.points_to_next} 积分升至下一级
                </Text>
              )}
              <Text style={styles.rank}>全服排名 #{league.rank}</Text>
            </View>
          )}

          {/* 打卡奖励预览 */}
          {streakInfo && (
            <View style={styles.streakCard}>
              <Text style={styles.streakTitle}>连续打卡奖励</Text>
              <Text style={styles.streakDays}>
                当前: 第 {streakInfo.current_streak} 天
              </Text>
              <Text style={styles.streakReward}>
                今日奖励: {streakInfo.current_reward} 积分
              </Text>
              {streakInfo.next_reward_info && (
                <Text style={styles.nextReward}>
                  明日奖励: {streakInfo.next_reward_info.next_reward} 积分
                </Text>
              )}
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
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { padding: 10 },
  leagueCard: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 20,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  leagueIcon: { fontSize: 40 },
  leagueName: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  leaguePoints: { fontSize: 16, color: 'white', marginTop: 5 },
  nextTier: { fontSize: 14, color: '#ddd', marginTop: 5 },
  rank: { fontSize: 14, color: '#ddd', marginTop: 5 },
  streakCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  streakTitle: { fontSize: 16, fontWeight: '600' },
  streakDays: { fontSize: 14, color: '#666', marginTop: 5 },
  streakReward: { fontSize: 14, color: '#5b9bd5', marginTop: 5 },
  nextReward: { fontSize: 12, color: '#999', marginTop: 5 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  taskCount: { fontSize: 14, color: '#666' },
  taskItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
  },
  completedTask: { backgroundColor: '#f0f9f0' },
  taskLeft: { flex: 1 },
  taskName: { fontSize: 16, fontWeight: '500' },
  taskDesc: { fontSize: 12, color: '#666', marginTop: 4 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  progressBar: {
    width: 100,
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
  },
  progressFill: {
    height: 8,
    backgroundColor: '#5b9bd5',
    borderRadius: 4,
  },
  progressText: { fontSize: 12, color: '#666', marginLeft: 10 },
  taskRight: { alignItems: 'center', paddingLeft: 15 },
  rewardText: { fontSize: 16, fontWeight: '600', color: '#FFD700' },
  taskButton: {
    backgroundColor: '#5b9bd5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginTop: 8,
  },
  taskButtonText: { color: 'white', fontSize: 12 },
  completedText: { color: '#4CAF50', marginTop: 8 },
  emptyText: { color: '#999', textAlign: 'center', padding: 20 },
});