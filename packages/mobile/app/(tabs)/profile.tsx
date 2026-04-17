import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { apiClient } from '@/lib/api-client';

interface BalanceState {
  tokenBalance: number;
  pointsBalance: number;
  isLoading: boolean;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [balance, setBalance] = useState<BalanceState>({
    tokenBalance: 0,
    pointsBalance: 0,
    isLoading: true,
  });

  useEffect(() => {
    loadBalance();
  }, []);

  async function loadBalance() {
    try {
      const [tokenData, pointsData] = await Promise.all([
        apiClient.getTokenBalance(),
        apiClient.getPointsBalance(),
      ]);
      setBalance({
        tokenBalance: tokenData.balance || 0,
        pointsBalance: pointsData.balance || 0,
        isLoading: false,
      });
    } catch (error) {
      console.error('Load balance error:', error);
      setBalance({ ...balance, isLoading: false });
    }
  }

  const handleLogout = async () => {
    Alert.alert('退出登录', '确定要退出吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const handleExchange = async () => {
    if (balance.pointsBalance < 100) {
      Alert.alert('积分不足', '需要至少100积分才能兑换');
      return;
    }
    Alert.alert('兑换Token', `将100积分兑换为10Token?`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: async () => {
          try {
            await apiClient.exchangeTokens(100);
            loadBalance();
            Alert.alert('成功', '兑换成功');
          } catch (error) {
            Alert.alert('失败', '兑换失败，请稍后重试');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.nickname}>{user?.nickname || '用户'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Token/积分余额卡片 */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Token余额</Text>
          <Text style={styles.balanceValue}>{balance.tokenBalance}</Text>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>积分余额</Text>
          <Text style={styles.balanceValue}>{balance.pointsBalance}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.exchangeButton} onPress={handleExchange}>
        <Text style={styles.exchangeButtonText}>积分兑换Token</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <TouchableOpacity style={styles.item} onPress={() => router.push('/wallet')}>
          <Text style={styles.itemText}>钱包详情</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item}>
          <Text style={styles.itemText}>设置</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item}>
          <Text style={styles.itemText}>帮助</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item} onPress={handleLogout}>
          <Text style={[styles.itemText, styles.logoutText]}>退出登录</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, backgroundColor: 'white', marginBottom: 10 },
  nickname: { fontSize: 24, fontWeight: 'bold' },
  email: { fontSize: 14, color: '#666', marginTop: 5 },
  balanceCard: {
    backgroundColor: 'white',
    marginHorizontal: 10,
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  balanceItem: { alignItems: 'center' },
  balanceLabel: { fontSize: 14, color: '#666' },
  balanceValue: { fontSize: 28, fontWeight: 'bold', color: '#5b9bd5' },
  balanceDivider: { width: 1, height: 50, backgroundColor: '#eee' },
  exchangeButton: {
    backgroundColor: '#5b9bd5',
    marginHorizontal: 10,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  exchangeButtonText: { color: 'white', fontSize: 16, fontWeight: '500' },
  section: { backgroundColor: 'white' },
  item: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  itemText: { fontSize: 16 },
  logoutText: { color: 'red' },
});