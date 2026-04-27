import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { apiClient } from '@/lib/api-client';

interface BalanceState {
  tokenBalance: number;
  pointsBalance: number;
  isLoading: boolean;
}

interface AlertState {
  visible: boolean;
  message: string;
}

interface ConfirmState {
  visible: boolean;
  message: string;
  onConfirm: (() => Promise<void>) | null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [balance, setBalance] = useState<BalanceState>({
    tokenBalance: 0,
    pointsBalance: 0,
    isLoading: true,
  });
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    message: '',
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    visible: false,
    message: '',
    onConfirm: null,
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

  const showAlert = (message: string) => {
    setAlertState({ visible: true, message });
  };

  const hideAlert = () => {
    setAlertState({ visible: false, message: '' });
  };

  const showConfirm = (message: string, onConfirm: () => Promise<void>) => {
    setConfirmState({ visible: true, message, onConfirm });
  };

  const hideConfirm = () => {
    setConfirmState({ visible: false, message: '', onConfirm: null });
  };

  const handleConfirmYes = async () => {
    hideConfirm();
    if (confirmState.onConfirm) {
      try {
        await confirmState.onConfirm();
      } catch (error) {
        console.error('Confirm action error:', error);
      }
    }
  };

  const handleLogout = () => {
    showConfirm('确定要退出登录吗？', async () => {
      console.log('开始退出登录...');
      await logout();
      console.log('退出登录成功');
      router.replace('/auth/login');
    });
  };

  const handleExchange = () => {
    if (balance.pointsBalance < 100) {
      showAlert('需要至少100积分才能兑换');
      return;
    }

    showConfirm('将100积分兑换为10Token？', async () => {
      try {
        await apiClient.exchangeTokens(100);
        loadBalance();
        showAlert('兑换成功');
      } catch (error) {
        showAlert('兑换失败，请稍后重试');
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* 用户信息 */}
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

      {/* 兑换按钮 */}
      <TouchableOpacity style={styles.exchangeButton} onPress={handleExchange}>
        <Text style={styles.exchangeButtonText}>积分兑换Token</Text>
      </TouchableOpacity>

      {/* 菜单列表 */}
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

      {/* 确认弹窗 */}
      <Modal
        visible={confirmState.visible}
        transparent
        animationType="fade"
        onRequestClose={hideConfirm}
      >
        <Pressable style={styles.modalOverlay} onPress={hideConfirm}>
          <View style={styles.modalContent}>
            <Text style={styles.modalMessage}>{confirmState.message}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonCancel} onPress={hideConfirm}>
                <Text style={styles.modalButtonCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonConfirm} onPress={handleConfirmYes}>
                <Text style={styles.modalButtonConfirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* 提示弹窗 */}
      <Modal
        visible={alertState.visible}
        transparent
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <Pressable style={styles.modalOverlay} onPress={hideAlert}>
          <View style={styles.modalContent}>
            <Text style={styles.modalMessage}>{alertState.message}</Text>
            <TouchableOpacity style={styles.modalButtonSingle} onPress={hideAlert}>
              <Text style={styles.modalButtonConfirmText}>知道了</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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

  // Modal 样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    minWidth: 280,
    alignItems: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  modalButtonCancel: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  modalButtonCancelText: {
    fontSize: 16,
    color: '#666',
  },
  modalButtonConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#5b9bd5',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    color: 'white',
  },
  modalButtonSingle: {
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
    backgroundColor: '#5b9bd5',
  },
});