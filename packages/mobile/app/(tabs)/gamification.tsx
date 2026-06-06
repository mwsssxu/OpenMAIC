import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { showError } from '@/lib/utils/error-toast';

export default function GamificationScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const data = await apiClient.getGamificationOverview();
      setProfile(data);
    } catch (error) {
      showError(error);
      console.error('Load gamification error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.primary.main} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>成长体系</Text>
        <View style={styles.navRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
      >
        {profile ? (
          <>
            {/* 等级信息 */}
            <View style={styles.levelCard}>
              <View style={styles.levelIcon}>
                <Ionicons name="trophy" size={32} color={Colors.primary.main} />
              </View>
              <Text style={styles.levelText}>Lv.{profile.level || 1}</Text>
              <Text style={styles.xpText}>{profile.xp || 0} XP</Text>
              <Text style={styles.xpNextText}>
                下一级还需 {(profile.xp_to_next_level || 100) - (profile.xp || 0)} XP
              </Text>
            </View>

            {/* 成就 */}
            {profile.badges?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>成就徽章</Text>
                <View style={styles.badgeRow}>
                  {profile.badges.map((badge: any, idx: number) => (
                    <View key={idx} style={styles.badge}>
                      <Ionicons name={badge.icon || 'star'} size={24} color={Colors.primary.main} />
                      <Text style={styles.badgeName}>{badge.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 统计 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>学习统计</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.study_streak || 0}</Text>
                  <Text style={styles.statLabel}>连续学习天数</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.total_study_hours || 0}</Text>
                  <Text style={styles.statLabel}>累计学习小时</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.courses_completed || 0}</Text>
                  <Text style={styles.statLabel}>完成课程</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="trending-up-outline" size={64} color={Colors.neutral.textSecondary} />
            <Text style={styles.emptyTitle}>开始你的成长之旅</Text>
            <Text style={styles.emptyDesc}>学习课程获取经验值</Text>
          </View>
        )}

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
  levelCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.lg,
    borderRadius: Rounded.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  levelIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  levelText: { fontSize: 28, fontWeight: '700', color: Colors.primary.main },
  xpText: { fontSize: 16, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  xpNextText: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  section: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: Spacing.md, color: Colors.neutral.textPrimary },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  badge: {
    alignItems: 'center',
    width: 70,
  },
  badgeName: {
    fontSize: 11,
    color: Colors.neutral.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: Colors.primary.main },
  statLabel: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
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