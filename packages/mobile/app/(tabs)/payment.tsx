import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, RefreshControl } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/lib/api-client';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';

const C = {
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
  blue: '#3b82f6',
  blueLight: '#dbeafe',
  red: '#ef4444',
};

interface SubPlan {
  id: string;
  name: string;
  type: 'subscription';
  period: string; // monthly | yearly
  price: number;
  price_label: string;
  features: string[];
  popular?: boolean;
}

interface TokenPkg {
  id: string;
  name: string;
  type: 'token';
  tokens: number;
  price: number;
  bonus: number;
  total_tokens: number;
  price_per_token: number;
}

type Package = SubPlan | TokenPkg;

interface Order {
  id: string;
  amount: number;
  token_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
}

interface Overview {
  token_balance: number;
  subscription: {
    plan_type: string;
    status: string;
    expires_at: string | null;
    is_pro: boolean;
  };
  usage_today: {
    [key: string]: { used: number; limit: number; remaining: number };
  };
  recent_spends: { amount: number; description: string; time: string }[];
}

// 30秒轮询余额
const POLL_INTERVAL = 30_000;

export default function PaymentScreen() {
  const { onSuccess, onError } = useFeedback();
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadData();
    // 启动余额轮询
    pollRef.current = setInterval(pollBalance, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [packagesData, ordersData, overviewData] = await Promise.all([
        apiClient.getPaymentPackages(),
        apiClient.getPaymentOrders(),
        apiClient.getAccountOverview(),
      ]);
      // API 返回 {token_packages: [], subscription_packages: []}，需要展开
      const pkgs = packagesData || {};
      const flatPkgs = [
        ...(pkgs.subscription_packages || []),
        ...(pkgs.token_packages || []),
      ];
      setPackages(flatPkgs);
      setOrders(ordersData.items || []);
      setOverview(overviewData);
    } catch (error) {
      console.error('Load payment data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const pollBalance = useCallback(async () => {
    try {
      const data = await apiClient.getAccountOverview();
      setOverview(data);
    } catch {
      // 静默失败，不干扰用户
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const isSubPlan = (pkg: Package): pkg is SubPlan => pkg.type === 'subscription';
  const isTokenPkg = (pkg: Package): pkg is TokenPkg => pkg.type === 'token';

  const purchasePackage = (pkg: Package) => {
    if (isSubPlan(pkg)) {
      const label = pkg.period === 'monthly' ? '月' : '年';
      Alert.alert(
        `订阅 ${pkg.name}`,
        `${pkg.price_label}/${label}\n${pkg.features.join('\n')}`,
        [
          { text: '取消', style: 'cancel' },
          { text: '微信支付', onPress: () => createOrder(pkg.id, 'wechat', 'subscription') },
          { text: '支付宝', onPress: () => createOrder(pkg.id, 'alipay', 'subscription') },
        ]
      );
    } else {
      Alert.alert(
        `购买 ${pkg.name}`,
        `${pkg.total_tokens} Token = ¥${pkg.price}`,
        [
          { text: '取消', style: 'cancel' },
          { text: '微信支付', onPress: () => createOrder(pkg.id, 'wechat', 'token') },
          { text: '支付宝', onPress: () => createOrder(pkg.id, 'alipay', 'token') },
        ]
      );
    }
  };

  const createOrder = async (packageId: string, method: string, type: 'token' | 'subscription') => {
    try {
      const result = await apiClient.createPaymentOrder(packageId, method, type);

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
                Alert.alert('成功', type === 'subscription' ? '订阅已激活！' : 'Token 已充值！');
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
    if (status === 'paid') return C.green;
    if (status === 'created') return C.gold;
    return C.muted;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'paid') return '已完成';
    if (status === 'created') return '待支付';
    return status;
  };

  // 将 packages 分为订阅计划和 Token 包
  const subPlans = packages.filter(isSubPlan);
  const tokenPkgs = packages.filter(isTokenPkg);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.navBtn} onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={C.fg} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>账户中心</Text>
          <View style={styles.navRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="card-outline" size={48} color={C.muted} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={C.fg} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>账户中心</Text>
        <View style={styles.navRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ========== 余额监控卡片 ========== */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceIconWrap}>
              <Ionicons name="wallet" size={22} color={C.accent} />
            </View>
            <View style={styles.balanceHeaderText}>
              <Text style={styles.balanceLabel}>Token 余额</Text>
              {overview?.subscription?.is_pro && (
                <View style={styles.proBadge}>
                  <Ionicons name="star" size={10} color="#fff" />
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>实时</Text>
            </View>
          </View>
          <Text style={styles.balanceNumber}>{overview?.token_balance ?? 0}</Text>
          {overview?.subscription?.is_pro && overview?.subscription?.expires_at && (
            <Text style={styles.expiryHint}>
              Pro 到期：{new Date(overview.subscription.expires_at).toLocaleDateString()}
            </Text>
          )}
        </View>

        {/* ========== 今日用量 ========== */}
        {overview?.usage_today && (
          <View style={styles.usageCard}>
            <Text style={styles.sectionTitle}>今日用量</Text>
            <View style={styles.usageGrid}>
              {Object.entries(overview.usage_today).map(([key, info]) => {
                const labels: Record<string, string> = {
                  ai_interaction: 'AI问答',
                  discussion: '讨论模式',
                  course_generation: '课程生成',
                  buddy_chat: '学习搭子',
                };
                const isUnlimited = info.remaining === -1;
                const pct = isUnlimited ? 0.15 : (info.limit > 0 ? Math.min(info.used / info.limit, 1) : 0);
                const isLow = !isUnlimited && info.remaining <= 1 && info.limit > 0;
                return (
                  <View key={key} style={styles.usageItem}>
                    <Text style={styles.usageName}>{labels[key] || key}</Text>
                    <View style={styles.usageBarBg}>
                      <View style={[
                        styles.usageBarFill,
                        { width: `${pct * 100}%`, backgroundColor: isLow ? C.red : C.accent },
                      ]} />
                    </View>
                    <Text style={[styles.usageCount, isLow && { color: C.red }]}>
                      {info.used}{isUnlimited ? '' : `/${info.limit}`}
                      {isUnlimited ? ' ∞' : (info.remaining > 0 ? ` (剩${info.remaining})` : '')}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ========== 最近消耗 ========== */}
        {overview?.recent_spends && overview.recent_spends.length > 0 && (
          <View style={styles.spendsCard}>
            <Text style={styles.sectionTitle}>最近消耗</Text>
            {overview.recent_spends.map((sp, i) => (
              <View key={i} style={styles.spendItem}>
                <Text style={styles.spendDesc} numberOfLines={1}>{sp.description}</Text>
                <Text style={styles.spendAmount}>-{sp.amount}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ========== 订阅计划 ========== */}
        {subPlans.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>订阅计划</Text>
            <View style={styles.subGrid}>
              {subPlans.map((plan) => {
                const isCurrent = overview?.subscription?.is_pro;
                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[styles.subCard, plan.popular && styles.subCardPopular]}
                    onPress={() => purchasePackage(plan)}
                    activeOpacity={0.85}
                  >
                    {plan.popular && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularBadgeText}>推荐</Text>
                      </View>
                    )}
                    <Ionicons
                      name={plan.period === 'yearly' ? 'calendar' : 'today'}
                      size={24}
                      color={plan.popular ? '#fff' : C.purple}
                    />
                    <Text style={[styles.subName, plan.popular && styles.subNamePopular]}>
                      {plan.name}
                    </Text>
                    <Text style={[styles.subPrice, plan.popular && styles.subPricePopular]}>
                      {plan.price_label}
                    </Text>
                    <Text style={[styles.subPeriod, plan.popular && styles.subPeriodPopular]}>
                      /{plan.period === 'monthly' ? '月' : '年'}
                    </Text>
                    {plan.features.slice(0, 3).map((f, i) => (
                      <View key={i} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={12} color={plan.popular ? '#fff' : C.green} />
                        <Text style={[styles.featureText, plan.popular && styles.featureTextPopular]} numberOfLines={1}>
                          {f}
                        </Text>
                      </View>
                    ))}
                    <View style={[styles.subBtn, plan.popular ? styles.subBtnPopular : styles.subBtnDefault]}>
                      <Text style={[styles.subBtnText, plan.popular && styles.subBtnTextPopular]}>
                        {isCurrent ? '已订阅' : '立即订阅'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* ========== Token 包 ========== */}
        {tokenPkgs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Token 充值</Text>
            <View style={styles.tokenGrid}>
              {tokenPkgs.map((pkg, index) => (
                <TouchableOpacity
                  key={pkg.id}
                  style={[styles.tokenCard, index === 1 && styles.tokenCardFeatured]}
                  onPress={() => purchasePackage(pkg)}
                  activeOpacity={0.85}
                >
                  {pkg.bonus > 0 && (
                    <View style={styles.bonusBadge}>
                      <Text style={styles.bonusText}>送 {pkg.bonus}</Text>
                    </View>
                  )}
                  <View style={styles.tokenIcon}>
                    <Ionicons
                      name={index === 0 ? "leaf" : index === 1 ? "rocket" : "diamond"}
                      size={24}
                      color={index === 1 ? '#fff' : C.accent}
                    />
                  </View>
                  <Text style={[styles.tokenName, index === 1 && styles.tokenNameFeatured]}>
                    {pkg.name}
                  </Text>
                  <Text style={[styles.tokenAmount, index === 1 && styles.tokenAmountFeatured]}>
                    {pkg.total_tokens} Token
                  </Text>
                  <Text style={[styles.tokenPrice, index === 1 && styles.tokenPriceFeatured]}>
                    ¥{pkg.price}
                  </Text>
                  {pkg.bonus > 0 && (
                    <Text style={[styles.tokenBonus, index === 1 && styles.tokenBonusFeatured]}>
                      额外赠送 {pkg.bonus} Token
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ========== 购买记录 ========== */}
        <Text style={styles.sectionTitle}>购买记录</Text>
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={C.muted} />
            <Text style={styles.emptyText}>暂无购买记录</Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderTokenInfo}>
                    <Ionicons name="diamond" size={18} color={C.purple} />
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
    backgroundColor: C.bgSolid,
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
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: C.border,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: C.fg,
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
    color: C.muted,
    marginTop: Spacing.sm,
  },

  // ===== 余额卡片 =====
  balanceCard: {
    backgroundColor: C.surfaceSolid,
    borderRadius: Rounded.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 0.5,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  balanceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  balanceHeaderText: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: C.muted,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.purple,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },
  liveText: {
    fontSize: 10,
    color: C.green,
    fontWeight: '500',
  },
  balanceNumber: {
    fontSize: 40,
    fontWeight: '800',
    color: C.fg,
    letterSpacing: -1,
  },
  expiryHint: {
    fontSize: 12,
    color: C.purple,
    marginTop: 4,
    fontWeight: '500',
  },

  // ===== 用量卡片 =====
  usageCard: {
    backgroundColor: C.surfaceSolid,
    borderRadius: Rounded.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  usageGrid: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  usageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  usageName: {
    fontSize: 13,
    color: C.muted,
    width: 64,
    fontWeight: '500',
  },
  usageBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accentLight,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  usageCount: {
    fontSize: 12,
    color: C.fg,
    fontWeight: '600',
    width: 72,
    textAlign: 'right',
  },

  // ===== 最近消耗 =====
  spendsCard: {
    backgroundColor: C.surfaceSolid,
    borderRadius: Rounded.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  spendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  spendDesc: {
    fontSize: 13,
    color: C.muted,
    flex: 1,
    marginRight: Spacing.sm,
  },
  spendAmount: {
    fontSize: 13,
    color: C.red,
    fontWeight: '600',
  },

  // ===== 分区标题 =====
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.fg,
    marginBottom: Spacing.sm,
  },

  // ===== 订阅计划 =====
  subGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  subCard: {
    flex: 1,
    backgroundColor: C.surfaceSolid,
    borderRadius: Rounded.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  subCardPopular: {
    backgroundColor: C.purple,
    borderColor: C.purple,
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: C.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  subName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.muted,
    marginTop: Spacing.xs,
  },
  subNamePopular: {
    color: 'rgba(255,255,255,0.8)',
  },
  subPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: C.purple,
    marginTop: Spacing.xs,
  },
  subPricePopular: {
    color: '#fff',
  },
  subPeriod: {
    fontSize: 12,
    color: C.muted,
  },
  subPeriodPopular: {
    color: 'rgba(255,255,255,0.7)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    width: '100%',
  },
  featureText: {
    fontSize: 11,
    color: C.muted,
    flex: 1,
  },
  featureTextPopular: {
    color: 'rgba(255,255,255,0.85)',
  },
  subBtn: {
    marginTop: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  subBtnDefault: {
    backgroundColor: C.purpleLight,
  },
  subBtnPopular: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  subBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.purple,
  },
  subBtnTextPopular: {
    color: '#fff',
  },

  // ===== Token 包 =====
  tokenGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tokenCard: {
    backgroundColor: C.surfaceSolid,
    borderRadius: Rounded.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    position: 'relative',
  },
  tokenCardFeatured: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  bonusBadge: {
    position: 'absolute',
    top: -4,
    right: Spacing.sm,
    backgroundColor: C.green,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  bonusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  tokenIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  tokenName: {
    fontSize: 14,
    fontWeight: '500',
    color: C.muted,
  },
  tokenNameFeatured: {
    color: 'rgba(255,255,255,0.8)',
  },
  tokenAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: C.fg,
    marginTop: Spacing.xs,
  },
  tokenAmountFeatured: {
    color: '#fff',
  },
  tokenPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: C.accent,
    marginTop: Spacing.xs,
  },
  tokenPriceFeatured: {
    color: '#fff',
  },
  tokenBonus: {
    fontSize: 12,
    color: C.green,
    marginTop: Spacing.xs,
    fontWeight: '500',
  },
  tokenBonusFeatured: {
    color: 'rgba(255,255,255,0.8)',
  },

  // ===== 购买记录 =====
  ordersList: {
    gap: Spacing.sm,
  },
  orderCard: {
    backgroundColor: C.surfaceSolid,
    borderRadius: Rounded.md,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: C.border,
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
    color: C.fg,
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
    color: C.muted,
  },
  orderPrice: {
    fontSize: 12,
    fontWeight: '500',
    color: C.accent,
  },
  orderDate: {
    fontSize: 12,
    color: C.muted,
    marginLeft: 'auto',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: C.surfaceSolid,
    borderRadius: Rounded.lg,
  },
  emptyText: {
    fontSize: 14,
    color: C.muted,
    marginTop: Spacing.sm,
  },
});
