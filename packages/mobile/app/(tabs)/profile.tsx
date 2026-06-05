import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Animated, Switch, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { USE_NATIVE_DRIVER } from '@/lib/configs/animation';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { useI18n, Locale } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import TabPageWrapper from '@/lib/components/TabPageWrapper';
import { useResponsiveDimensions } from '@/lib/utils/responsive';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { showError, confirmAction } from '@/lib/utils/error-toast';

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

interface Achievement {
  id: string;
  name: string;
  icon: string;
  color: string;
  earned: boolean;
}

interface WeeklyData {
  day: string;
  hours: number;
  active: boolean;
  today: boolean;
}

interface ProfileData {
  user: {
    nickname: string;
    avatar_url?: string;
  };
  stats: {
    streak_days: number;
    total_courses: number;  // 用户自己的课程数
    learned_courses?: number;  // 用户已学习的课程
    total_hours: number;
    active_courses?: number;  // 兼容旧数据
  };
  level: {
    level: number;
    title: string;
  };
  weekly_study: {
    total_hours: number;
    daily_data: WeeklyData[];
  };
  achievements: Achievement[];
}

interface BalanceState {
  tokenBalance: number;
  pointsBalance: number;
  isLoading: boolean;
}

// 成就徽章组件
function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const colorStyles = {
    coral: { bg: iOSColors.accentLight, icon: iOSColors.accent },
    mint: { bg: iOSColors.secondaryLight, icon: iOSColors.secondary },
    gold: { bg: iOSColors.goldLight, icon: iOSColors.gold },
    blue: { bg: iOSColors.blueLight, icon: iOSColors.blue },
    purple: { bg: iOSColors.purpleLight, icon: iOSColors.purple },
    muted: { bg: iOSColors.border, icon: iOSColors.muted },
  };
  const colors = colorStyles[achievement.color as keyof typeof colorStyles] || colorStyles.muted;

  // 检查是否是emoji图标（更精确的判断）
  // Emoji通常不在ASCII范围内，且不包含常见的Ionicons名称
  const commonIonicons = ['flame', 'fire', 'crown', 'book', 'library', 'star', 'time', 'rocket', 'checkmark-circle'];
  const isEmoji = !commonIonicons.includes(achievement.icon) && /[^\x00-\x7F]/.test(achievement.icon);

  return (
    <View style={styles.achievement}>
      <View style={[styles.achievementIcon, { backgroundColor: colors.bg }, !achievement.earned && styles.achievementLocked]}>
        {isEmoji ? (
          <Text style={styles.achievementEmoji}>{achievement.icon}</Text>
        ) : (
          <Ionicons name={achievement.icon as any} size={28} color={colors.icon} />
        )}
      </View>
      <Text style={styles.achievementName}>{achievement.name}</Text>
    </View>
  );
}

// 周学习柱状图组件
function WeeklyBar({ data }: { data: WeeklyData }) {
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

interface SettingsItem {
  id: string;
  titleKey: string;
  icon: string;
  color: string;
  badge?: string | null;
  hasSwitch?: boolean;
}

const settingsData: SettingsItem[] = [
  { id: 'profile', titleKey: 'editProfile', icon: 'person', color: 'coral', badge: null },
  { id: 'notifications', titleKey: 'notificationSettings', icon: 'notifications', color: 'mint', badge: '2' },
  { id: 'preferences', titleKey: 'learningPreferences', icon: 'settings', color: 'gold', badge: null },
  { id: 'darkmode', titleKey: 'darkMode', icon: 'moon', color: 'blue', badge: null, hasSwitch: true },
  { id: 'help', titleKey: 'helpAndFeedback', icon: 'help-circle', color: 'purple', badge: null },
  { id: 'logout', titleKey: 'logout', icon: 'log-out', color: 'coral', badge: null },
];

// 设置项组件
function SettingsItem({ item, onPress, switchValue, onSwitchChange }: { 
  item: SettingsItem; 
  onPress: () => void; 
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
}) {
  const { t } = useI18n();
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
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      disabled={item.hasSwitch}
    >
      <Animated.View style={[styles.settingsItem, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.settingsIcon, { backgroundColor: colors.bg }]}>
          <Ionicons name={item.icon as any} size={16} color={colors.icon} />
        </View>
        <Text style={styles.settingsText}>{t(`profile.${item.titleKey}`)}</Text>
        {item.badge && (
          <View style={styles.settingsBadge}>
            <Text style={styles.settingsBadgeText}>{item.badge}</Text>
          </View>
        )}
        {item.hasSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: iOSColors.border, true: iOSColors.blue }}
            thumbColor="#fff"
          />
        ) : (
          <Ionicons name="chevron-forward" size={16} color={iOSColors.muted} style={{ opacity: 0.5 }} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { onSuccess } = useFeedback();
  const haptics = useHaptics();
  const { t, locale, setLocale, availableLocales } = useI18n();
  const { isTablet } = useResponsiveDimensions();
  const [balance, setBalance] = useState<BalanceState>({
    tokenBalance: 0,
    pointsBalance: 0,
    isLoading: true,
  });
  const [profileData, setProfileData] = useState<ProfileData>({
    user: { nickname: '' },
    stats: { streak_days: 0, total_courses: 0, learned_courses: 0, total_hours: 0 },
    level: { level: 1, title: '初学者' },
    weekly_study: { total_hours: 0, daily_data: [] },
    achievements: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showPrefModal, setShowPrefModal] = useState(false);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [dailyGoal, setDailyGoal] = useState('30');

  useEffect(() => {
    loadProfileData();
    loadDarkModePreference();
  }, []);

  async function loadDarkModePreference() {
    try {
      const saved = await AsyncStorage.getItem('darkModeEnabled');
      if (saved !== null) {
        setDarkModeEnabled(saved === 'true');
      }
    } catch {
      // Ignore storage errors
    }
  }

  async function toggleDarkMode(value: boolean) {
    haptics.light();
    setDarkModeEnabled(value);
    try {
      await AsyncStorage.setItem('darkModeEnabled', String(value));
    } catch {
      // Ignore storage errors
    }
    onSuccess(t(value ? 'profile.darkModeEnabled' : 'profile.darkModeDisabled'));
  }

  async function loadProfileData() {
    try {
      setIsLoading(true);
      setError(null);
      const [profile, tokenData, pointsData] = await Promise.all([
        apiClient.getProfileOverview(),
        apiClient.getTokenBalance(),
        apiClient.getPointsBalance(),
      ]);
      setProfileData(profile);
      setBalance({
        tokenBalance: tokenData.balance || 0,
        pointsBalance: pointsData.balance || 0,
        isLoading: false,
      });
    } catch (err) {
      console.error('Load profile error:', err);
      setError('加载资料失败，请下拉重试');
      setBalance({ ...balance, isLoading: false });
    } finally {
      setIsLoading(false);
    }
  }

  const handleLogout = () => {
    haptics.medium();
    const doLogout = async () => {
      await logout();
      router.dismissAll();
      router.replace('/auth/login');
    };
    confirmAction('退出登录', '确定要退出当前账号吗？', doLogout, '退出');
  };

  const handleHelp = () => {
    const helpUrl = 'https://openmaic.com/help';
    Linking.openURL(helpUrl).catch(() => {
      onSuccess(t('profile.comingSoon'));
    });
  };

  const handleLanguageChange = (newLocale: Locale) => {
    haptics.light();
    setLocale(newLocale);
    setShowLanguageModal(false);
    onSuccess();
  };

  // 计算本周总学习时长
  const weeklyTotal = profileData.weekly_study.total_hours;

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="person-outline" size={48} color={iOSColors.muted} />
          <Text style={styles.loadingText}>加载资料...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={iOSColors.accent} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProfileData} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>重新加载</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
      <ScrollView
        style={[styles.scrollView, isTablet && styles.scrollViewTablet]}
        showsVerticalScrollIndicator={false}
      >
        {/* 个人资料头部 */}
        <View style={styles.profileHeader}>
          {/* 卡通头像 */}
          <View style={styles.avatarLarge}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{profileData.user.nickname || user?.nickname || user?.email?.split('@')[0] || '学习者'}</Text>
          <Text style={styles.profileBio}>全栈学习ing · 数据分析方向</Text>
          <View style={styles.profileLevel}>
            <Text style={styles.profileLevelText}>⭐ Lv.{profileData.level.level} · {profileData.level.title}</Text>
          </View>
        </View>

        {/* 学习统计三栏 */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: iOSColors.accent }]}>{profileData.stats.streak_days}</Text>
            <Text style={styles.statLabel}>连续天数</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: iOSColors.secondary }]}>{profileData.stats.total_courses || 0}</Text>
            <Text style={styles.statLabel}>全部课程</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: iOSColors.gold }]}>{profileData.stats.total_hours.toFixed(0)}h</Text>
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
            {profileData.weekly_study.daily_data.map((data, idx) => (
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
          {profileData.achievements.map(achievement => (
            <AchievementBadge key={achievement.id} achievement={achievement} />
          ))}
        </ScrollView>

        {/* 设置列表 */}
        <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
        <View style={styles.settingsList}>
          {settingsData.map(item => (
            <SettingsItem
              key={item.id}
              item={item}
              switchValue={item.id === 'darkmode' ? darkModeEnabled : undefined}
              onSwitchChange={item.id === 'darkmode' ? toggleDarkMode : undefined}
              onPress={() => {
                haptics.light();
                if (item.id === 'profile') {
                  router.push('/edit-profile');
                } else if (item.id === 'notifications') {
                  setShowNotifModal(true);
                } else if (item.id === 'preferences') {
                  setShowPrefModal(true);
                } else if (item.id === 'help') {
                  handleHelp();
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

      {/* 通知设置 Modal */}
      <Modal visible={showNotifModal} transparent animationType="fade" onRequestClose={() => setShowNotifModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNotifModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('profile.notificationSettings')}</Text>
            {[
              { key: 'course', icon: 'book', label: t('profile.notifCourse') || '课程更新' },
              { key: 'achievement', icon: 'trophy', label: t('profile.notifAchievement') || '成就解锁' },
              { key: 'buddy', icon: 'chatbubbles', label: t('profile.notifBuddy') || '搭子消息' },
              { key: 'system', icon: 'information-circle', label: t('profile.notifSystem') || '系统通知' },
            ].map(item => (
              <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: iOSColors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name={item.icon as any} size={20} color={iOSColors.accent} />
                  <Text style={{ fontSize: 15, color: iOSColors.fg }}>{item.label}</Text>
                </View>
                <Switch value={notifEnabled} onValueChange={setNotifEnabled} trackColor={{ false: iOSColors.border, true: iOSColors.blue }} thumbColor="#fff" />
              </View>
            ))}
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowNotifModal(false)} activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>{t('common.confirm')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* 学习偏好 Modal */}
      <Modal visible={showPrefModal} transparent animationType="fade" onRequestClose={() => setShowPrefModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPrefModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('profile.learningPreferences')}</Text>
            <Text style={styles.modalLabel}>{t('profile.dailyGoal') || '每日学习目标(分钟)'}</Text>
            <TextInput
              style={styles.modalInput}
              value={dailyGoal}
              onChangeText={setDailyGoal}
              keyboardType="number-pad"
              placeholder="30"
            />
            <Text style={[styles.modalLabel, { marginTop: 12 }]}>{t('profile.reminderTime') || '学习提醒时间'}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {['08:00', '12:00', '20:00', '22:00'].map(time => (
                <TouchableOpacity key={time} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: iOSColors.border, marginRight: 4, marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, color: iOSColors.fg }}>{time}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.modalCancelButton, { marginTop: 16 }]} onPress={async () => {
              try { await AsyncStorage.setItem('dailyGoal', dailyGoal); onSuccess(t('profile.prefSaved') || '已保存'); } catch {}
              setShowPrefModal(false);
            }} activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>{t('common.confirm')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
    </TabPageWrapper>
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
  scrollViewTablet: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
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
  achievementEmoji: {
    fontSize: 28,
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
  modalLabel: {
    fontSize: 13,
    color: iOSColors.muted,
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: iOSColors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: iOSColors.fg,
    backgroundColor: iOSColors.bgSolid,
  },

  // Loading & Error
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  loadingText: {
    fontSize: 16,
    color: iOSColors.muted,
    marginTop: Spacing.sm,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  errorText: {
    fontSize: 16,
    color: iOSColors.fg,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Rounded.md,
    backgroundColor: iOSColors.accent,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});