import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useResponsiveDimensions, responsiveValue } from '@/lib/utils/responsive';
import { useI18n } from '@/lib/i18n';

interface TabBarProps {
  onCreatePress?: () => void;
}

const tabs = [
  { name: '首页', emoji: '🏠', route: '/(tabs)' },
  { name: '课程', emoji: '📚', route: '/(tabs)/courses' },
  { name: '笔记', emoji: '📝', route: '/(tabs)/notes' },
  { name: '我的', emoji: '👤', route: '/(tabs)/profile' },
];

export const IOSTabBar: React.FC<TabBarProps> = ({ onCreatePress }) => {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { breakpoint, isTablet } = useResponsiveDimensions();

  const isActive = (route: string) => {
    if (route === '/(tabs)' && pathname === '/') return true;
    const routePath = route.replace('/(tabs)', '').replace('/', '');
    return pathname.includes(routePath);
  };

  const handleTabPress = (route: string) => {
    router.push(route as '/' | '/courses' | '/notes' | '/profile');
  };

  // Responsive sizes
  const fabSize = responsiveValue({ compact: 56, regular: 56, medium: 60, large: 64 }, breakpoint);
  const fabIconSize = responsiveValue({ compact: 28, regular: 28, medium: 32, large: 36 }, breakpoint);
  const labelSize = responsiveValue({ compact: 10, regular: 10, medium: 11, large: 12 }, breakpoint);
  const emojiSize = responsiveValue({ compact: 22, regular: 22, medium: 24, large: 26 }, breakpoint);

  // TabBar 高度 = 基础高度 + 内容padding + 底部安全区域
  const baseHeight = responsiveValue({ compact: 49, regular: 49, medium: 56, large: 60 }, breakpoint);
  const tabBarHeight = baseHeight + insets.bottom;

  return (
    <View style={[
      styles.tabBar,
      {
        height: tabBarHeight,
        paddingBottom: insets.bottom + 8,
        paddingTop: isTablet ? 10 : 8,
      }
    ]}>
      {/* 左侧两个 Tab */}
      {tabs.slice(0, 2).map((tab) => {
        const isActiveTab = isActive(tab.route);
        const accessibilityLabelMap: Record<string, string> = {
          '首页': t('accessibility.tabHome'),
          '课程': t('accessibility.tabCourses'),
          '笔记': t('accessibility.tabNotes'),
          '我的': t('accessibility.tabProfile'),
        };
        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tabItem, isActiveTab && styles.tabItemActive]}
            onPress={() => handleTabPress(tab.route)}
            activeOpacity={0.7}
            accessibilityLabel={accessibilityLabelMap[tab.name] || tab.name}
            accessibilityHint={isActiveTab ? undefined : t('accessibility.enterPage', { page: tab.name })}
            accessibilityRole="button"
            accessibilityState={{ selected: isActiveTab }}
          >
            <Text style={[styles.tabIcon, { fontSize: emojiSize }]} accessibilityRole="image" accessibilityLabel={tab.emoji}>{tab.emoji}</Text>
            <Text style={[
              styles.tabLabel,
              { fontSize: labelSize },
              isActiveTab && styles.tabLabelActive
            ]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* 中间创建按钮 */}
      <TouchableOpacity
        style={[
          styles.fabCreate,
          {
            width: fabSize,
            height: fabSize,
            borderRadius: fabSize / 2,
            top: responsiveValue({ compact: -14, regular: -14, medium: -16, large: -18 }, breakpoint),
          }
        ]}
        onPress={onCreatePress || (() => router.push('/classroom/create'))}
        activeOpacity={0.85}
        accessibilityLabel={t('accessibility.tabCreate')}
        accessibilityHint={t('accessibility.enterPage', { page: '课程创建' })}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={fabIconSize} color="white" accessibilityRole="image" accessibilityLabel={t('accessibility.addIcon')} />
      </TouchableOpacity>

      {/* 右侧两个 Tab */}
      {tabs.slice(2, 4).map((tab) => {
        const isActiveTab = isActive(tab.route);
        const accessibilityLabelMap: Record<string, string> = {
          '首页': t('accessibility.tabHome'),
          '课程': t('accessibility.tabCourses'),
          '笔记': t('accessibility.tabNotes'),
          '我的': t('accessibility.tabProfile'),
        };
        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tabItem, isActiveTab && styles.tabItemActive]}
            onPress={() => handleTabPress(tab.route)}
            activeOpacity={0.7}
            accessibilityLabel={accessibilityLabelMap[tab.name] || tab.name}
            accessibilityHint={isActiveTab ? undefined : t('accessibility.enterPage', { page: tab.name })}
            accessibilityRole="button"
            accessibilityState={{ selected: isActiveTab }}
          >
            <Text style={[styles.tabIcon, { fontSize: emojiSize }]} accessibilityRole="image" accessibilityLabel={tab.emoji}>{tab.emoji}</Text>
            <Text style={[
              styles.tabLabel,
              { fontSize: labelSize },
              isActiveTab && styles.tabLabelActive
            ]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabItem: {
    flex: 1,
    minWidth: 60,
    alignItems: 'center',
    gap: 3,
  },
  tabItemActive: {},
  tabIcon: {
    // fontSize set dynamically
  },
  tabLabel: {
    fontWeight: '500',
    letterSpacing: 0.005,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  tabLabelActive: {
    color: '#c45a1a',
  },
  fabCreate: {
    position: 'relative',
    flexShrink: 0,
    marginHorizontal: 4,
    backgroundColor: '#c45a1a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
});

export default IOSTabBar;