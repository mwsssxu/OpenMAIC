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
};

interface BalanceState {
  tokenBalance: number;
  pointsBalance: number;
  isLoading: boolean;
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

  // 菜单项组件
  function MenuItem({ icon, title, onPress }: { icon: string; title: string; onPress: () => void }) {
    const scaleAnim = useRef(new Animated.Value(1)).current;

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
        <Animated.View style={[styles.menuItem, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name={icon as any} size={20} color={iOSColors.accent} />
          <Text style={styles.menuItemText}>{title}</Text>
          <Ionicons name="chevron-forward" size={16} color={iOSColors.muted} />
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header 用户信息 */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.nickname || user?.email || '用户').charAt(0)}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.nickname || user?.email?.split('@')[0] || '用户'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Balance Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{balance.tokenBalance}</Text>
            <Text style={styles.statLabel}>{t('profile.tokenBalance')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{balance.pointsBalance}</Text>
            <Text style={styles.statLabel}>{t('profile.pointsBalance')}</Text>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
          <MenuItem
            icon="language-outline"
            title={t('profile.languageSettings')}
            onPress={() => {
              haptics.light();
              setShowLanguageModal(true);
            }}
          />
          <MenuItem
            icon="wallet-outline"
            title={t('home.wallet')}
            onPress={() => {
              haptics.light();
              router.push('/wallet');
            }}
          />
          <MenuItem
            icon="trending-up-outline"
            title={t('home.growthSystem')}
            onPress={() => {
              haptics.light();
              router.push('/gamification');
            }}
          />
          <MenuItem
            icon="gift-outline"
            title={t('home.inviteRewards')}
            onPress={() => {
              haptics.light();
              router.push('/invite');
            }}
          />
        </View>

        {/* More Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>更多</Text>
          <MenuItem
            icon="information-circle-outline"
            title={t('profile.about')}
            onPress={() => {
              haptics.light();
            }}
          />
          <MenuItem
            icon="download-outline"
            title={t('profile.exportData')}
            onPress={() => {
              haptics.light();
            }}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Text style={styles.logoutButtonText}>{t('auth.logout')}</Text>
        </TouchableOpacity>

        {/* Spacer for safe area */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLanguageModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('profile.languageSettings')}</Text>
            {availableLocales.map((lang) => (
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md + 4,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: iOSColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: iOSColors.muted,
  },

  // Stats Grid
  statsGrid: {
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
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: iOSColors.accent,
  },
  statLabel: {
    fontSize: 12,
    color: iOSColors.muted,
    marginTop: 4,
  },

  // Section
  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: Spacing.sm,
  },

  // Menu Item
  menuItem: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: iOSColors.fg,
    marginLeft: Spacing.sm,
  },

  // Logout Button
  logoutButton: {
    marginHorizontal: Spacing.md,
    height: 48,
    borderRadius: Rounded.md,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
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