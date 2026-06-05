import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { showError } from '@/lib/utils/error-toast';
import { useFeedback } from '@/lib/hooks/use-feedback';

export default function InviteScreen() {
  const { onSuccess, onError } = useFeedback();
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [codeData, statsData] = await Promise.all([
        apiClient.getMyInviteCode(),
        apiClient.getInvitationStats(),
      ]);
      setInviteCode(codeData.invite_code || '');
      setStats(statsData);
    } catch (error) {
      showError(error);
      console.error('Load invite data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const shareInvite = async () => {
    try {
      onSuccess();
      await Share.share({
        message: `快来加入 OpenMAIC！使用我的邀请码 ${inviteCode} 注册，你可获得 100 Token，我也能获得奖励哦~`,
      });
    } catch (error) {
      onError();
      Alert.alert('分享失败');
    }
  };

  const applyCode = async () => {
    Alert.prompt(
      '输入邀请码',
      '输入朋友的邀请码获得奖励',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async (code?: string) => {
            if (!code) return;
            try {
              await apiClient.applyInviteCode(code);
              Alert.alert('成功', '已获得邀请奖励！');
              loadData();
            } catch (error: any) {
              Alert.alert('失败', error.response?.data?.detail || '邀请码无效');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.primary.main} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>邀请奖励</Text>
        <View style={styles.navRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
      >
        {/* 邀请码卡片 */}
        <View style={styles.codeCard}>
          <Text style={styles.cardTitle}>我的邀请码</Text>
          <Text style={styles.inviteCode}>{inviteCode || '加载中...'}</Text>
          <TouchableOpacity style={styles.shareButton} onPress={shareInvite}>
            <Text style={styles.shareButtonText}>分享邀请码</Text>
          </TouchableOpacity>
        </View>

        {/* 邀请统计 */}
        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.cardTitle}>邀请统计</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_invites || 0}</Text>
                <Text style={styles.statLabel}>总邀请</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.level1_count || 0}</Text>
                <Text style={styles.statLabel}>一级邀请</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.level2_count || 0}</Text>
                <Text style={styles.statLabel}>二级邀请</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_points || 0}</Text>
                <Text style={styles.statLabel}>获得积分</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_tokens || 0}</Text>
                <Text style={styles.statLabel}>获得Token</Text>
              </View>
            </View>
          </View>
        )}

        {/* 奖励说明 */}
        <View style={styles.rewardCard}>
          <Text style={styles.cardTitle}>邀请奖励</Text>
          <View style={styles.rewardItem}>
            <Text style={styles.rewardText}>一级邀请: 20积分 + 50 Token</Text>
            <Text style={styles.rewardDesc}>被邀请人获得 100 Token</Text>
          </View>
          <View style={styles.rewardItem}>
            <Text style={styles.rewardText}>二级邀请: 10积分</Text>
          </View>
          <View style={styles.rewardItem}>
            <Text style={styles.rewardText}>三级邀请: 5积分</Text>
          </View>
        </View>

        {/* 应用邀请码 */}
        <TouchableOpacity style={styles.applyButton} onPress={applyCode}>
          <Text style={styles.applyButtonText}>输入邀请码</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.neutral.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  navTitle: { fontSize: 17, fontWeight: '600', color: Colors.neutral.textPrimary },
  navRight: { width: 44 },
  scrollView: { flex: 1, paddingHorizontal: Spacing.md },
  codeCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.lg,
    borderRadius: Rounded.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: Spacing.sm, color: Colors.neutral.textSecondary },
  inviteCode: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary.main,
    letterSpacing: 4,
    marginBottom: Spacing.md,
  },
  shareButton: {
    backgroundColor: Colors.primary.main,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
  },
  shareButtonText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },
  statsCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: Colors.primary.main },
  statLabel: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  rewardCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  rewardItem: { marginBottom: Spacing.sm, paddingLeft: Spacing.sm, borderLeftWidth: 3, borderLeftColor: Colors.primary.main },
  rewardText: { fontSize: 14, fontWeight: '600', color: Colors.neutral.textPrimary },
  rewardDesc: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  applyButton: {
    backgroundColor: Colors.primary.main,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    alignItems: 'center',
  },
  applyButtonText: { fontSize: 16, fontWeight: '600', color: Colors.neutral.white },
});