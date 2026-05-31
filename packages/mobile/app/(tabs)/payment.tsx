import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/lib/api-client';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';

const iOSColors = {
  bgSolid: '#f5f3f2',
  surface: 'rgba(255, 255, 255, 0.55)',
  surfaceSolid: '#FFFFFF',
  fg: '#1a1a1a',
  muted: '#666666',
  border: 'rgba(230, 225, 220, 0.6)',
  accent: '#c45a1a',
  accentLight: '#fde8e0',
  gold: '#f59e0b',
  goldLight: '#fef3c7',
  green: '#10b981',
  greenLight: '#d1fae5',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
};

interface Package {
  id: string;
  name: string;
  tokens: number;
  price: number;
  bonus: number;
  total_tokens: number;
  price_per_token: number;
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
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      setPackages(packagesData || []);
      setOrders(ordersData.items || []);
    } catch (error) {
      console.error('Load payment data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const purchasePackage = (pkg: Package) => {
    Alert.alert(
      `购买 ${pkg.name}`,
      `${pkg.total_tokens} Token = ${pkg.price}元`,
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

  const getMethodLabel = (method: string) => {
    if (method === 'wechat') return '微信支付';
    if (method === 'alipay') return '支付宝';
    return method;
  };

  const getStatusColor = (status: string) => {
    if (status === 'paid') return iOSColors.green;
    if (status === 'created') return iOSColors.gold;
    return iOSColors.muted;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'paid') return '已完成';
    if (status === 'created') return '待支付';
    return status;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.navBtn} onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>充值中心</Text>
          <View style={styles.navRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="card-outline" size={48} color={iOSColors.muted} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>充值中心</Text>
        <View style={styles.navRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 顶部Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="diamond" size={32} color={iOSColors.accent} />
          </View>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>Token 充值</Text>
            <Text style={styles.bannerDesc}>购买Token用于解锁付费内容</Text>
          </View>
        </View>

        {/* 套餐列表 */}
        <Text style={styles.sectionTitle}>选择套餐</Text>
        <View style={styles.packagesGrid}>
          {packages.map((pkg, index) => (
            <TouchableOpacity
              key={pkg.id}
              style={[styles.packageCard, index === 1 && styles.packageCardFeatured]}
              onPress={() => purchasePackage(pkg)}
              activeOpacity={0.85}
            >
              {pkg.bonus > 0 && (
                <View style={styles.bonusBadge}>
                  <Text style={styles.bonusText}>送 {pkg.bonus}</Text>
                </View>
              )}
              <View style={styles.packageIcon}>
                <Ionicons
                  name={index === 0 ? "leaf" : index === 1 ? "rocket" : "diamond"}
                  size={24}
                  color={index === 1 ? '#fff' : iOSColors.accent}
                />
              </View>
              <Text style={[styles.packageName, index === 1 && styles.packageNameFeatured]}>
                {pkg.name}
              </Text>
              <Text style={[styles.packageTokens, index === 1 && styles.packageTokensFeatured]}>
                {pkg.total_tokens} Token
              </Text>
              <Text style={[styles.packagePrice, index === 1 && styles.packagePriceFeatured]}>
                ¥{pkg.price}
              </Text>
              {pkg.bonus > 0 && (
                <Text style={styles.packageBonus}>额外赠送 {pkg.bonus} Token</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* 购买记录 */}
        <Text style={styles.sectionTitle}>购买记录</Text>
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={iOSColors.muted} />
            <Text style={styles.emptyText}>暂无购买记录</Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderTokenInfo}>
                    <Ionicons name="diamond" size={18} color={iOSColors.purple} />
                    <Text style={styles.orderTokens}>{order.token_amount} Token</Text>
                  </View>
                  <View style={[styles.orderStatus, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                    <Text style={[styles.orderStatusText, { color: getStatusColor(order.status) }]}>
                      {getStatusLabel(order.status)}
                    </Text>
                  </View>
                </View>
                <View style={styles.orderMeta}>
                  <Text style={styles.orderMethod}>{getMethodLabel(order.payment_method)}</Text>
                  <Text style={styles.orderPrice}>¥{order.amount}</Text>
                  <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
  },
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
    backgroundColor: iOSColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  navRight: {
    width: 44,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: iOSColors.muted,
    marginTop: Spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: iOSColors.accentLight,
    borderRadius: Rounded.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  bannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: iOSColors.surfaceSolid,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: iOSColors.fg,
  },
  bannerDesc: {
    fontSize: 13,
    color: iOSColors.muted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: Spacing.sm,
  },
  packagesGrid: {
    marginBottom: Spacing.lg,
  },
  packageCard: {
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: Rounded.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: iOSColors.border,
    alignItems: 'center',
  },
  packageCardFeatured: {
    backgroundColor: iOSColors.accent,
    borderColor: iOSColors.accent,
  },
  bonusBadge: {
    position: 'absolute',
    top: -4,
    right: Spacing.sm,
    backgroundColor: iOSColors.green,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  bonusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  packageIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: iOSColors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  packageName: {
    fontSize: 14,
    fontWeight: '500',
    color: iOSColors.muted,
  },
  packageNameFeatured: {
    color: 'rgba(255,255,255,0.8)',
  },
  packageTokens: {
    fontSize: 24,
    fontWeight: '700',
    color: iOSColors.fg,
    marginTop: Spacing.xs,
  },
  packageTokensFeatured: {
    color: '#fff',
  },
  packagePrice: {
    fontSize: 28,
    fontWeight: '700',
    color: iOSColors.accent,
    marginTop: Spacing.xs,
  },
  packagePriceFeatured: {
    color: '#fff',
  },
  packageBonus: {
    fontSize: 12,
    color: iOSColors.green,
    marginTop: Spacing.xs,
    fontWeight: '500',
  },
  ordersList: {
    gap: Spacing.sm,
  },
  orderCard: {
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: Rounded.md,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  orderTokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  orderTokens: {
    fontSize: 16,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  orderStatus: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  orderMethod: {
    fontSize: 12,
    color: iOSColors.muted,
  },
  orderPrice: {
    fontSize: 12,
    fontWeight: '500',
    color: iOSColors.accent,
  },
  orderDate: {
    fontSize: 12,
    color: iOSColors.muted,
    marginLeft: 'auto',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: Rounded.lg,
  },
  emptyText: {
    fontSize: 14,
    color: iOSColors.muted,
    marginTop: Spacing.sm,
  },
});