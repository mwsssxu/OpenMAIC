import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { showError } from '@/lib/utils/error-toast';

export default function BuddyScreen() {
  const router = useRouter();
  const [buddy, setBuddy] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const data = await apiClient.getMyBuddyConfig();
      setBuddy(data);
    } catch (error) {
      showError(error);
      console.error('Load buddy error:', error);
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
        <Text style={styles.navTitle}>学习搭子</Text>
        <View style={styles.navRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
      >
        {buddy ? (
          <View style={styles.buddyCard}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color={Colors.primary.main} />
            </View>
            <Text style={styles.buddyName}>{buddy.name || '学习搭子'}</Text>
            <Text style={styles.buddyInfo}>学习进度: {buddy.progress || 0}%</Text>
            <Text style={styles.buddyInfo}>已学习: {buddy.study_days || 0} 天</Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={64} color={Colors.neutral.textSecondary} />
            <Text style={styles.emptyTitle}>还没有学习搭子</Text>
            <Text style={styles.emptyDesc}>完成匹配后可以找到学习搭子</Text>
            <TouchableOpacity
              style={styles.matchButton}
              onPress={() => router.push('/matching' as any)}
            >
              <Text style={styles.matchButtonText}>去匹配</Text>
            </TouchableOpacity>
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
  buddyCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.lg,
    borderRadius: Rounded.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  buddyName: { fontSize: 20, fontWeight: '600', color: Colors.neutral.textPrimary, marginBottom: Spacing.sm },
  buddyInfo: { fontSize: 14, color: Colors.neutral.textSecondary, marginBottom: Spacing.xs },
  emptyCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.xl,
    borderRadius: Rounded.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral.textPrimary, marginTop: Spacing.md },
  emptyDesc: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.md },
  matchButton: {
    backgroundColor: Colors.primary.main,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
  },
  matchButtonText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },
});