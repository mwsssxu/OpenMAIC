import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { showError } from '@/lib/utils/error-toast';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import TabPageWrapper from '@/lib/components/TabPageWrapper';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useGoBack } from '@/lib/utils/navigation';

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

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export default function WalletScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const [tokenBalance, setTokenBalance] = useState(0);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [tokenTransactions, setTokenTransactions] = useState<Transaction[]>([]);
  const [pointsTransactions, setPointsTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'token' | 'points'>('token');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [tokenBal, pointsBal, tokenTx, pointsTx] = await Promise.all([
        apiClient.getTokenBalance(),
        apiClient.getPointsBalance(),
        apiClient.getTokenTransactions(50),
        apiClient.getPointsTransactions(50),
      ]);
      setTokenBalance(tokenBal.balance || 0);
      setPointsBalance(pointsBal.balance || 0);
      setTokenTransactions(tokenTx.transactions || []);
      setPointsTransactions(pointsTx.transactions || []);
    } catch (error) {
      showError(error);
      console.error('Load wallet data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const onRefresh = useCallback(() => {
    loadData();
  }, []);

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionLeft}>
        <Text style={styles.transactionType}>{item.type}</Text>
        <Text style={styles.transactionDesc}>{item.description}</Text>
        <Text style={styles.transactionTime}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Text
        style={[
          styles.transactionAmount,
          item.amount > 0 ? styles.positive : styles.negative,
        ]}
      >
        {item.amount > 0 ? '+' : ''}{item.amount}
      </Text>
    </View>
  );

  const transactions = activeTab === 'token' ? tokenTransactions : pointsTransactions;

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
      <View style={styles.pageHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>钱包</Text>
        <View style={styles.pageHeaderActions} />
      </View>
      {/* 余额显示 */}
      <View style={styles.balanceHeader}>
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Token</Text>
          <Text style={styles.balanceValue}>{tokenBalance}</Text>
        </View>
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>积分</Text>
          <Text style={styles.balanceValue}>{pointsBalance}</Text>
        </View>
      </View>

      {/* Tab切换 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'token' && styles.activeTab]}
          onPress={() => setActiveTab('token')}
        >
          <Text style={[styles.tabText, activeTab === 'token' && styles.activeTabText]}>
            Token交易
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'points' && styles.activeTab]}
          onPress={() => setActiveTab('points')}
        >
          <Text style={[styles.tabText, activeTab === 'points' && styles.activeTabText]}>
            积分记录
          </Text>
        </TouchableOpacity>
      </View>

      {/* 交易列表 */}
      {isLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="small" color={Colors.primary.main} />
        </View>
      ) : (
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无交易记录</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
      )}
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
  balanceHeader: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  balanceBox: { alignItems: 'center' },
  balanceLabel: { fontSize: 14, color: Colors.neutral.textSecondary },
  balanceValue: { fontSize: 32, fontWeight: 'bold', color: Colors.primary.main, marginTop: Spacing.sm },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral.card,
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.sm,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  tab: {
    flex: 1,
    padding: Spacing.sm + 7,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    borderRadius: Rounded.md,
  },
  activeTab: {
    borderBottomColor: Colors.primary.main,
    backgroundColor: Colors.primary.transparent,
  },
  tabText: { fontSize: 16, color: Colors.neutral.textSecondary },
  activeTabText: { color: Colors.primary.main, fontWeight: '600' },
  listContent: { padding: Spacing.sm },
  transactionItem: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Rounded.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  transactionLeft: { flex: 1 },
  transactionType: { fontSize: 14, fontWeight: '600', color: Colors.neutral.textPrimary },
  transactionDesc: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  transactionTime: { fontSize: 12, color: Colors.neutral.textMuted, marginTop: Spacing.sm - 2 },
  transactionAmount: { fontSize: 18, fontWeight: 'bold' },
  positive: { color: Colors.secondary.success },
  negative: { color: Colors.feedback.errorText },
  empty: { padding: Spacing.xl + 8, alignItems: 'center' },
  emptyText: { color: Colors.neutral.textMuted, fontSize: 16 },
});
