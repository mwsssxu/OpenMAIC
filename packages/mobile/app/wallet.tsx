import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export default function WalletScreen() {
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
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  balanceHeader: {
    backgroundColor: 'white',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  balanceBox: { alignItems: 'center' },
  balanceLabel: { fontSize: 14, color: '#666' },
  balanceValue: { fontSize: 32, fontWeight: 'bold', color: '#5b9bd5' },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginTop: 10,
  },
  tab: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#5b9bd5' },
  tabText: { fontSize: 16, color: '#666' },
  activeTabText: { color: '#5b9bd5', fontWeight: '500' },
  listContent: { padding: 10 },
  transactionItem: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 8,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transactionLeft: { flex: 1 },
  transactionType: { fontSize: 14, fontWeight: '500' },
  transactionDesc: { fontSize: 12, color: '#666', marginTop: 4 },
  transactionTime: { fontSize: 12, color: '#999', marginTop: 4 },
  transactionAmount: { fontSize: 18, fontWeight: 'bold' },
  positive: { color: '#4CAF50' },
  negative: { color: '#f44336' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 16 },
});