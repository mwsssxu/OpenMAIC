import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';

interface Package {
  id: string;
  name: string;
  tokens: number;
  price: number;
  bonus: number;
  description: string;
}

interface Order {
  id: string;
  amount: number;
  token_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
}

export default function PaymentScreen() {
  const { onSuccess, onError } = useFeedback();
  const [packages, setPackages] = useState<Package[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [packagesData, ordersData] = await Promise.all([
        apiClient.getPaymentPackages(),
        apiClient.getPaymentOrders(),
      ]);
      setPackages(packagesData.packages || []);
      setOrders(ordersData.orders || []);
    } catch (error) {
      console.error('Load payment data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const purchasePackage = (pkg: Package) => {
    Alert.alert(
      `购买 ${pkg.name}`,
      `${pkg.tokens} Token = ${pkg.price / 100}元`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '微信支付',
          onPress: () => createOrder(pkg.id, 'wechat'),
        },
        {
          text: '支付宝',
          onPress: () => createOrder(pkg.id, 'alipay'),
        },
      ]
    );
  };

  const createOrder = async (packageId: string, method: string) => {
    try {
      const result = await apiClient.createPaymentOrder(packageId, method);

      // 测试环境: 模拟支付
      Alert.alert(
        '模拟支付',
        '测试环境将自动完成支付',
        [
          {
            text: '支付',
            onPress: async () => {
              try {
                await apiClient.mockPayment(result.order_id);
                onSuccess();
                Alert.alert('成功', 'Token 已充值！');
                loadData();
              } catch (error) {
                onError();
                Alert.alert('失败', '支付失败');
              }
            },
          },
        ]
      );
    } catch (error: any) {
      onError();
      Alert.alert('失败', error.response?.data?.detail || '创建订单失败');
    }
  };

  const renderPackage = ({ item }: { item: Package }) => (
    <TouchableOpacity
      style={styles.packageItem}
      onPress={() => purchasePackage(item)}
    >
      <View style={styles.packageHeader}>
        <Text style={styles.packageName}>{item.name}</Text>
        <Text style={styles.packageTokens}>{item.tokens} Token</Text>
      </View>
      <Text style={styles.packagePrice}>{item.price / 100} 元</Text>
      {item.bonus > 0 && (
        <Text style={styles.packageBonus}>额外赠送 {item.bonus} Token</Text>
      )}
      <Text style={styles.packageDesc}>{item.description}</Text>
    </TouchableOpacity>
  );

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderItem}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderAmount}>{item.token_amount} Token</Text>
        <Text style={[
          styles.orderStatus,
          item.status === 'paid' && styles.paidStatus,
          item.status === 'created' && styles.pendingStatus,
        ]}>
          {item.status === 'paid' ? '已完成' : '待支付'}
        </Text>
      </View>
      <Text style={styles.orderMeta}>
        {item.payment_method} · {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </View>
  );

  return (
    <FlatList
      data={orders}
      renderItem={renderOrder}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          <Text style={styles.sectionTitle}>Token 购买套餐</Text>
          <FlatList
            data={packages}
            renderItem={renderPackage}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.packagesList}
          />
          <Text style={styles.sectionTitle}>购买记录</Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>暂无购买记录</Text>
      }
      contentContainerStyle={styles.container}
      style={{ backgroundColor: '#f5f5f5' }}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.sm + 3, backgroundColor: Colors.neutral.background },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: Spacing.sm, color: Colors.neutral.textPrimary },
  packagesList: { marginBottom: Spacing.lg },
  packageItem: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary.main,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageName: { fontSize: 16, fontWeight: '500', color: Colors.neutral.textPrimary },
  packageTokens: { fontSize: 18, fontWeight: 'bold', color: Colors.primary.main },
  packagePrice: { fontSize: 24, fontWeight: 'bold', marginTop: Spacing.sm, color: Colors.neutral.textPrimary },
  packageBonus: { fontSize: 12, color: Colors.secondary.success, marginTop: Spacing.sm - 2, fontWeight: '500' },
  packageDesc: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.sm - 2 },
  orderItem: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderAmount: { fontSize: 16, fontWeight: '500', color: Colors.neutral.textPrimary },
  orderStatus: { fontSize: 14 },
  paidStatus: { color: Colors.secondary.success, fontWeight: '600' },
  pendingStatus: { color: Colors.feedback.warningText, fontWeight: '600' },
  orderMeta: { fontSize: 12, color: Colors.neutral.textMuted, marginTop: Spacing.sm - 2 },
  emptyText: { color: Colors.neutral.textMuted, textAlign: 'center', padding: Spacing.lg + 4 },
});
