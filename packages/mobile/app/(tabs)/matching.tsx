import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';

export default function MatchingScreen() {
  const router = useRouter();
  const [partners, setPartners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const data = await apiClient.getAcceptedMatches();
      setPartners(data.partners || []);
    } catch (error) {
      console.error('Load matching error:', error);
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
        <Text style={styles.navTitle}>学习匹配</Text>
        <View style={styles.navRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
      >
        {partners.length > 0 ? (
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
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={64} color={Colors.neutral.textSecondary} />
            <Text style={styles.emptyTitle}>还没有学习伙伴</Text>
            <Text style={styles.emptyDesc}>设置偏好并搜索匹配</Text>
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
  section: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: Spacing.md, color: Colors.neutral.textPrimary },
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