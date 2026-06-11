import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { showError, showSuccess } from '@/lib/utils/error-toast';
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

export default function MatchingScreen() {
  const goBack = useGoBack();
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
      showError(error);
      console.error('Load matching error:', error);
    } finally {
      setIsLoading(false);
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
        <View style={styles.pageHeaderActions} />
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
            <TouchableOpacity
              style={styles.searchButton}
              onPress={async () => {
                try {
                  const results = await apiClient.searchMatches();
                  if (results?.matches?.length > 0) {
                    setPartners(results.matches);
                  } else {
                    showSuccess('暂无新的匹配，请稍后再试');
                  }
                } catch (error) {
                  showError(error);
                }
              }}
            >
              <Ionicons name="search" size={16} color="#fff" />
              <Text style={styles.searchButtonText}>搜索匹配</Text>
            </TouchableOpacity>
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
  pageHeaderActions: { flexDirection: 'row', gap: Spacing.xs },
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
  searchButton: {
    backgroundColor: Colors.primary.main,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Rounded.full,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  searchButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});