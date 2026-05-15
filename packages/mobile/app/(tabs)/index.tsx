import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, SecondaryColorMap, Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { useRef } from 'react';

// 统计数据配置
const statsData = [
  { key: 'students', label: '活跃学员', value: '864', trend: '+12%', trendUp: true, icon: 'people', color: Colors.semantic.blue },
  { key: 'hours', label: '课时完成', value: '452h', trend: '+5%', trendUp: true, icon: 'time', color: Colors.semantic.orange },
  { key: 'renewal', label: '续费率', value: '92%', trend: '-2%', trendUp: false, icon: 'refresh', color: Colors.semantic.green },
  { key: 'loss', label: '流失率', value: '4.5%', trend: '-1%', trendUp: false, icon: 'trending-down', color: Colors.semantic.purple },
];

// 快捷操作配置 - 使用主题色
const quickActions = [
  { title: '查看课程', icon: 'book', color: SecondaryColorMap.courses, route: '/courses' },
  { title: '发布问题', icon: 'help-circle', color: SecondaryColorMap.questions, route: '/questions' },
  { title: '写笔记', icon: 'create', color: SecondaryColorMap.notes, route: '/notes' },
];

// 功能入口配置 - 使用语义颜色
const workbenchItems = [
  { key: 'courses', title: '我的课程', icon: 'book', color: SecondaryColorMap.courses, route: '/courses' },
  { key: 'questions', title: '问答悬赏', icon: 'chatbubble-ellipses', color: SecondaryColorMap.questions, route: '/questions' },
  { key: 'notes', title: '共享笔记', icon: 'document-text', color: SecondaryColorMap.notes, route: '/notes' },
  { key: 'buddy', title: '学习搭子', icon: 'happy', color: SecondaryColorMap.buddy, route: '/buddy' },
  { key: 'matching', title: '学习匹配', icon: 'people', color: SecondaryColorMap.matching, route: '/matching' },
  { key: 'gamification', title: '成长体系', icon: 'trophy', color: SecondaryColorMap.gamification, route: '/gamification' },
  { key: 'invite', title: '邀请奖励', icon: 'gift', color: SecondaryColorMap.invite, route: '/invite' },
  { key: 'payment', title: '充值中心', icon: 'card', color: SecondaryColorMap.payment, route: '/payment' },
  { key: 'wallet', title: '钱包', icon: 'cash', color: SecondaryColorMap.wallet, route: '/wallet' },
  { key: 'enterprise', title: '企业服务', icon: 'briefcase', color: SecondaryColorMap.enterprise, route: '/enterprise' },
];

// 单个统计卡片组件
function StatCard({ item, isFirst }: { item: typeof statsData[0]; isFirst: boolean }) {
  return (
    <View style={[styles.statCard, isFirst ? styles.statCardFirst : styles.statCardSecond]}>
      <View style={[styles.statIconBox, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon as any} size={22} color={item.color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statLabel}>{item.label}</Text>
        <View style={styles.statValueRow}>
          <Text style={styles.statValue}>{item.value}</Text>
          <Text style={[styles.statTrend, { color: item.trendUp ? Colors.semantic.green : Colors.semantic.red }]}>
            {item.trend}
          </Text>
        </View>
      </View>
    </View>
  );
}

// 功能入口按钮组件
function FeatureButton({ item, onPress, index }: { item: typeof workbenchItems[0]; onPress: () => void; index: number }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // 根据索引计算位置（每行5个）
  const row = Math.floor(index / 5);
  const col = index % 5;
  const isFirst = col === 0;
  const isLast = col === 4;
  const isLastRow = row === Math.floor((workbenchItems.length - 1) / 5);

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      style={[
        styles.featureBtn,
        isFirst && styles.featureBtnFirst,
        isLast && styles.featureBtnLast,
        isLastRow && styles.featureBtnLastRow,
      ]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <View style={[styles.featureIconBox, { backgroundColor: item.color + '20' }]}>
          <Ionicons name={item.icon as any} size={24} color={item.color} />
        </View>
        <Text style={styles.featureTitle}>{item.title}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function WorkbenchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { onPress } = useFeedback();
  const haptics = useHaptics();

  // 获取当前时间问候语
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 12) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  const handlePress = (route: string) => {
    haptics.light();
    onPress();
    router.push(route as any);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 欢迎区域 */}
      <View style={styles.welcomeSection}>
        <View style={styles.welcomeHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={28} color={Colors.neutral.white} />
            </View>
          </View>
          <View style={styles.welcomeText}>
            <Text style={styles.greetingLabel}>个人工作台</Text>
            <Text style={styles.greetingText}>{getGreeting()}, {user?.nickname || user?.email || '用户'} 👋</Text>
            <Text style={styles.greetingHint}>今天要完成什么任务？</Text>
          </View>
        </View>
      </View>

      {/* 统计卡片网格 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>数据概览</Text>
        <View style={styles.statsGrid}>
          {/* 第一行 */}
          <View style={styles.statsRow}>
            <StatCard item={statsData[0]} isFirst={true} />
            <StatCard item={statsData[1]} isFirst={false} />
          </View>
          {/* 第二行 */}
          <View style={styles.statsRow}>
            <StatCard item={statsData[2]} isFirst={true} />
            <StatCard item={statsData[3]} isFirst={false} />
          </View>
        </View>
      </View>

      {/* 快捷操作 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>快捷操作</Text>
        <View style={styles.quickActions}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={action.title}
              style={[
                styles.quickBtn,
                { backgroundColor: action.color },
                index === 0 && styles.quickBtnFirst,
                index === quickActions.length - 1 && styles.quickBtnLast,
              ]}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.8}
            >
              <Ionicons name={action.icon as any} size={20} color={Colors.neutral.white} />
              <Text style={styles.quickBtnText}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 功能入口网格 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>常用功能</Text>
        <View style={styles.featuresGrid}>
          {workbenchItems.map((item, index) => (
            <FeatureButton
              key={item.key}
              item={item}
              index={index}
              onPress={() => handlePress(item.route)}
            />
          ))}
        </View>
      </View>

      {/* 渐变卡片 - 活跃学员 */}
      <View style={styles.section}>
        <View style={styles.gradientCard}>
          <View style={styles.gradientDecor}>
            <Ionicons name="school" size={80} color={Colors.neutral.white} style={{ opacity: 0.15 }} />
          </View>
          <Text style={styles.gradientLabel}>本月活跃学员</Text>
          <Text style={styles.gradientValue}>864</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>月度目标达成</Text>
              <Text style={styles.progressPercent}>78%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '78%' }]} />
            </View>
          </View>
          <TouchableOpacity style={styles.gradientBtn} activeOpacity={0.8}>
            <Text style={styles.gradientBtnText}>查看详情</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral.background,
  },
  // 欢迎区域
  welcomeSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    flex: 1,
  },
  greetingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary.main,
    marginBottom: 2,
    letterSpacing: 1,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.neutral.textPrimary,
    marginBottom: 2,
  },
  greetingHint: {
    fontSize: 14,
    color: Colors.neutral.textSecondary,
  },
  // Section 通用
  section: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.textPrimary,
    marginBottom: Spacing.sm,
  },
  // 统计卡片 - 使用 flexWrap 替代 gap
  statsGrid: {
    backgroundColor: Colors.neutral.card,
    borderRadius: Rounded.lg,
    padding: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.neutral.background,
    borderRadius: Rounded.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCardFirst: {
    marginRight: Spacing.sm,
  },
  statCardSecond: {
    marginLeft: 0,
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: Rounded.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.neutral.textSecondary,
    marginBottom: 2,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral.textPrimary,
    marginRight: 4,
  },
  statTrend: {
    fontSize: 12,
    fontWeight: '600',
  },
  // 快捷操作
  quickActions: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral.card,
    borderRadius: Rounded.lg,
    padding: Spacing.md,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Rounded.sm,
    flex: 1,
    justifyContent: 'center',
  },
  quickBtnFirst: {
    marginRight: Spacing.sm,
  },
  quickBtnLast: {
    marginLeft: 0,
  },
  quickBtnText: {
    marginLeft: Spacing.xs,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.white,
  },
  // 功能入口 - 使用精确布局
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.neutral.card,
    borderRadius: Rounded.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  featureBtn: {
    width: '20%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  featureBtnFirst: {
    paddingLeft: 0,
  },
  featureBtnLast: {
    paddingRight: 0,
  },
  featureBtnLastRow: {
    paddingBottom: 0,
  },
  featureIconBox: {
    width: 48,
    height: 48,
    borderRadius: Rounded.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  featureTitle: {
    fontSize: 12,
    color: Colors.neutral.textPrimary,
    textAlign: 'center',
    fontWeight: '500',
  },
  // 渐变卡片
  gradientCard: {
    backgroundColor: Colors.primary.main,
    borderRadius: Rounded.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  gradientDecor: {
    position: 'absolute',
    right: -20,
    top: -20,
  },
  gradientLabel: {
    fontSize: 14,
    color: Colors.neutral.white,
    opacity: 0.8,
  },
  gradientValue: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.neutral.white,
    marginTop: 4,
  },
  progressContainer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.neutral.white,
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 12,
    color: Colors.neutral.white,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: Rounded.full,
  },
  progressFill: {
    height: 8,
    backgroundColor: Colors.neutral.white,
    borderRadius: Rounded.full,
  },
  gradientBtn: {
    marginTop: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: Rounded.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  gradientBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.white,
  },
});