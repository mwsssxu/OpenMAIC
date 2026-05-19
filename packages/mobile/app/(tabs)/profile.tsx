import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Animated } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { useI18n, Locale } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';

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
  gold: '#f59e0b',
  goldLight: '#fef3c7',
  blue: '#2563eb',
  blueLight: '#dbeafe',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
};

// 成就徽章数据
const achievementsData = [
  { id: '1', name: '连续7天', icon: 'flame', color: 'coral', earned: true },
  { id: '2', name: '完成5课', icon: 'book', color: 'mint', earned: true },
  { id: '3', name: '笔记达人', icon: 'star', color: 'gold', earned: true },
  { id: '4', name: '百小时', icon: 'time', color: 'blue', earned: true },
  { id: '5', name: '连续30天', icon: 'lock-closed', color: 'muted', earned: false },
  { id: '6', name: '完成10课', icon: 'lock-closed', color: 'muted', earned: false },
];

// 周学习数据
const weeklyData = [
  { day: '一', hours: 1.2, active: true },
  { day: '二', hours: 2.1, active: true },
  { day: '三', hours: 0.8, active: true },
  { day: '四', hours: 2.5, active: true },
  { day: '五', hours: 1.5, active: true },
  { day: '六', hours: 3.0, active: true, today: true },
  { day: '日', hours: 0, active: false },
];

// 设置项数据
const settingsData = [
  { id: 'profile', title: '编辑个人资料', icon: 'person', color: 'coral', badge: null },
  { id: 'notifications', title: '通知设置', icon: 'notifications', color: 'mint', badge: '2' },
  { id: 'preferences', title: '学习偏好', icon: 'settings', color: 'gold', badge: null },
  { id: 'darkmode', title: '深色模式', icon: 'moon', color: 'blue', badge: null },
  { id: 'help', title: '帮助与反馈', icon: 'help-circle', color: 'purple', badge: null },
  { id: 'logout', title: '退出登录', icon: 'log-out', color: 'coral', badge: null },
];

interface BalanceState {
  tokenBalance: number;
  pointsBalance: number;
  isLoading: boolean;
}

// 成就徽章组件
function AchievementBadge({ achievement }: { achievement: typeof achievementsData[0] }) {
  const colorStyles = {
    coral: { bg: iOSColors.accentLight, icon: iOSColors.accent },
    mint: { bg: iOSColors.secondaryLight, icon: iOSColors.secondary },
    gold: { bg: iOSColors.goldLight, icon: iOSColors.gold },
    blue: { bg: iOSColors.blueLight, icon: iOSColors.blue },
    muted: { bg: iOSColors.border, icon: iOSColors.muted },
  };
  const colors = colorStyles[achievement.color as keyof typeof colorStyles];

  return (
    <View style={styles.achievement}>
      <View style={[styles.achievementIcon, { backgroundColor: colors.bg }, !achievement.earned && styles.achievementLocked]}>
        <Ionicons name={achievement.icon as any} size={28} color={colors.icon} />
      </View>
      <Text style={styles.achievementName}>{achievement.name}</Text>
    </View>
  );
}

// 周学习柱状图组件
function WeeklyBar({ data }: { data: typeof weeklyData[0] }) {
  const maxHours = 3.5;
  const heightPercent = (data.hours / maxHours) * 100;

  return (
    <View style={styles.weeklyBarWrapper}>
      <View style={[
        styles.weeklyBar,
        { height: `${heightPercent}%` },
        data.active && !data.today && { backgroundColor: iOSColors.accentLight },
        data.today && styles.weeklyBarToday,
        !data.active && { backgroundColor: iOSColors.border },
      ]}>
        {data.active && (
          <Text style={styles.weeklyBarValue}>{data.hours.toFixed(1)}h</Text>
        )}
      </View>
      <Text style={[styles.weeklyBarLabel, data.today && styles.weeklyBarLabelToday]}>{data.day}</Text>
    </View>
  );
}

// 设置项组件
function SettingsItem({ item, onPress }: { item: typeof settingsData[0]; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const colorStyles = {
    coral: { bg: iOSColors.accentLight, icon: iOSColors.accent },
    mint: { bg: iOSColors.secondaryLight, icon: iOSColors.secondary },
    gold: { bg: iOSColors.goldLight, icon: iOSColors.gold },
    blue: { bg: iOSColors.blueLight, icon: iOSColors.blue },
    purple: { bg: iOSColors.purpleLight, icon: iOSColors.purple },
  };
  const colors = colorStyles[item.color as keyof typeof colorStyles];

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.settingsItem, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.settingsIcon, { backgroundColor: colors.bg }]}>
          <Ionicons name={item.icon as any} size={16} color={colors.icon} />
        </View>
        <Text style={styles.settingsText}>{item.title}</Text>
        {item.badge && (
          <View style={styles.settingsBadge}>
            <Text style={styles.settingsBadgeText}>{item.badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={iOSColors.muted} style={{ opacity: 0.5 }} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { onSuccess, onError } = useFeedback();
  const haptics = useHaptics();
  const { t, locale, setLocale, availableLocales } = useI18n();
  const [balance, setBalance] = useState<BalanceState>({
    tokenBalance: 0,
    pointsBalance: 0,
    isLoading: true,
  });
  const [showLanguageModal, setShowLanguageModal] = useState(false);

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

  const handleLogout = () => {
    haptics.medium();
    logout();
    router.replace('/auth/login');
  };

  const handleLanguageChange = (newLocale: Locale) => {
    haptics.light();
    setLocale(newLocale);
    setShowLanguageModal(false);
    onSuccess();
  };

  // 计算本周总学习时长
  const weeklyTotal = weeklyData.reduce((sum, d) => sum + d.hours, 0);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 个人资料头部 */}
        <View style={styles.profileHeader}>
          {/* 卡通头像 */}
          <View style={styles.avatarLarge}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{user?.nickname || user?.email?.split('@')[0] || '林小雨'}</Text>
          <Text style={styles.profileBio}>全栈学习ing · 数据分析方向</Text>
          <View style={styles.profileLevel}>
            <Text style={styles.profileLevelText}>⭐ Lv.12 · 学习达人</Text>
          </View>
        </View>

        {/* 学习统计三栏 */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: iOSColors.accent }]}>23</Text>
            <Text style={styles.statLabel}>连续天数</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: iOSColors.secondary }]}>8</Text>
            <Text style={styles.statLabel}>在学课程</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: iOSColors.gold }]}>156h</Text>
            <Text style={styles.statLabel}>学习时长</Text>
          </View>
        </View>

        {/* 本周学习 */}
        <Text style={styles.sectionTitle}>本周学习</Text>
        <View style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyTitle}>学习时长</Text>
            <Text style={styles.weeklyTotal}>本周累计 {weeklyTotal.toFixed(1)}h</Text>
          </View>
          <View style={styles.weeklyChart}>
            {weeklyData.map((data, idx) => (
              <WeeklyBar key={idx} data={data} />
            ))}
          </View>
        </View>

        {/* 成就徽章 */}
        <Text style={styles.sectionTitle}>成就徽章</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.achievementsScroll}
        >
          {achievementsData.map(achievement => (
            <AchievementBadge key={achievement.id} achievement={achievement} />
          ))}
        </ScrollView>

        {/* 设置列表 */}
        <Text style={styles.sectionTitle}>设置</Text>
        <View style={styles.settingsList}>
          {settingsData.map(item => (
            <SettingsItem
              key={item.id}
              item={item}
              onPress={() => {
                haptics.light();
                if (item.id === 'profile') {
                  // 编辑个人资料
                } else if (item.id === 'notifications') {
                  // 通知设置
                } else if (item.id === 'logout') {
                  handleLogout();
                }
              }}
            />
          ))}
        </View>

        {/* 占位 */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 语言选择弹窗 */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLanguageModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('profile.languageSettings')}</Text>
            {availableLocales.map(lang => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.languageOption, locale === lang.code && styles.languageOptionActive]}
                onPress={() => handleLanguageChange(lang.code)}
                activeOpacity={0.7}
              >
                <Text style={[styles.languageOptionText, locale === lang.code && styles.languageOptionTextActive]}>
                  {lang.name}
                </Text>
                {locale === lang.code && (
                  <Ionicons name="checkmark" size={20} color={iOSColors.accent} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowLanguageModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
  },
  scrollView: {
    flex: 1,
  },

  // Profile Header
  profileHeader: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  avatarLarge: {
    marginBottom: Spacing.sm,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: iOSColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 40,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: iOSColors.fg,
    letterSpacing: -0.02,
    marginBottom: 2,
  },
  profileBio: {
    fontSize: 13,
    color: iOSColors.muted,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  profileLevel: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: iOSColors.accent,
  },
  profileLevelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.03,
  },
  statLabel: {
    fontSize: 11,
    color: iOSColors.muted,
    marginTop: 2,
  },

  // Section Title
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: iOSColors.fg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },

  // Weekly Chart
  weeklyCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
  },
  weeklyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  weeklyTotal: {
    fontSize: 12,
    color: iOSColors.accent,
    fontWeight: '500',
  },
  weeklyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 80,
  },
  weeklyBarWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  weeklyBar: {
    width: '100%',
    borderRadius: 4,
    backgroundColor: iOSColors.accentLight,
    minHeight: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  weeklyBarToday: {
    backgroundColor: iOSColors.accent,
  },
  weeklyBarValue: {
    fontSize: 9,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: 2,
  },
  weeklyBarLabel: {
    fontSize: 10,
    color: iOSColors.muted,
    marginTop: 4,
  },
  weeklyBarLabelToday: {
    color: iOSColors.accent,
    fontWeight: '600',
  },

  // Achievements
  achievementsScroll: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  achievement: {
    width: 80,
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  achievementIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  achievementLocked: {
    opacity: 0.35,
  },
  achievementName: {
    fontSize: 10,
    color: iOSColors.muted,
    textAlign: 'center',
    lineHeight: 14,
  },

  // Settings List
  settingsList: {
    marginHorizontal: Spacing.md,
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    borderBottomWidth: 0.5,
    borderBottomColor: iOSColors.border,
  },
  settingsIcon: {
    width: 32,
    height: 32,
    borderRadius: Rounded.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsText: {
    flex: 1,
    fontSize: 14,
    color: iOSColors.fg,
  },
  settingsBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: iOSColors.accent,
  },
  settingsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: Rounded.lg,
    padding: Spacing.md,
    width: '85%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: iOSColors.fg,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Rounded.sm,
    marginBottom: Spacing.sm,
  },
  languageOptionActive: {
    backgroundColor: iOSColors.accentLight,
  },
  languageOptionText: {
    flex: 1,
    fontSize: 16,
    color: iOSColors.fg,
  },
  languageOptionTextActive: {
    fontWeight: '600',
    color: iOSColors.accent,
  },
  modalCancelButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Rounded.sm,
    backgroundColor: iOSColors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: iOSColors.muted,
  },
});