import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

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
                Alert.alert('成功', 'Token 已充值！');
                loadData();
              } catch (error) {
                Alert.alert('失败', '支付失败');
              }
            },
          },
        ]
      );
    } catch (error: any) {
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
  container: { padding: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  packagesList: { marginBottom: 20 },
  packageItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#5b9bd5',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  packageName: { fontSize: 16, fontWeight: '500' },
  packageTokens: { fontSize: 18, fontWeight: 'bold', color: '#5b9bd5' },
  packagePrice: { fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  packageBonus: { fontSize: 12, color: '#4CAF50', marginTop: 5 },
  packageDesc: { fontSize: 12, color: '#666', marginTop: 5 },
  orderItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 8,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderAmount: { fontSize: 16, fontWeight: '500' },
  orderStatus: { fontSize: 14 },
  paidStatus: { color: '#4CAF50' },
  pendingStatus: { color: '#FF9800' },
  orderMeta: { fontSize: 12, color: '#666', marginTop: 5 },
  emptyText: { color: '#999', textAlign: 'center', padding: 20 },
});