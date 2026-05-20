import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

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
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (route: string) => {
    if (route === '/(tabs)' && pathname === '/') return true;
    const routePath = route.replace('/(tabs)', '').replace('/', '');
    return pathname.includes(routePath);
  };

  const handleTabPress = (route: string) => {
    router.push(route as '/' | '/courses' | '/notes' | '/profile');
  };

  return (
    <View style={styles.tabBar}>
      {/* 左侧两个 Tab */}
      {tabs.slice(0, 2).map((tab) => (
        <TouchableOpacity
          key={tab.name}
          style={[styles.tabItem, isActive(tab.route) && styles.tabItemActive]}
          onPress={() => handleTabPress(tab.route)}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>{tab.emoji}</Text>
          <Text style={[styles.tabLabel, isActive(tab.route) && styles.tabLabelActive]}>
            {tab.name}
          </Text>
        </TouchableOpacity>
      ))}

      {/* 中间创建按钮 */}
      <TouchableOpacity
        style={styles.fabCreate}
        onPress={onCreatePress || (() => router.push('/classroom/create'))}
        activeOpacity={0.85}
      >
        <View style={styles.fabInner}>
          <Text style={styles.fabIcon}>+</Text>
        </View>
      </TouchableOpacity>

      {/* 右侧两个 Tab */}
      {tabs.slice(2, 4).map((tab) => (
        <TouchableOpacity
          key={tab.name}
          style={[styles.tabItem, isActive(tab.route) && styles.tabItemActive]}
          onPress={() => handleTabPress(tab.route)}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>{tab.emoji}</Text>
          <Text style={[styles.tabLabel, isActive(tab.route) && styles.tabLabelActive]}>
            {tab.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 83,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: 8,
    paddingBottom: 8,
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
  tabItemActive: {
    // 活跃状态
  },
  tabIcon: {
    fontSize: 22,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.005,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  tabLabelActive: {
    color: '#c45a1a',
  },
  fabCreate: {
    position: 'relative',
    top: -14,
    width: 56,
    height: 56,
    borderRadius: 28,
    flexShrink: 0,
    marginHorizontal: 4,
    backgroundColor: '#c45a1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontSize: 28,
    color: 'white',
    fontWeight: '300',
    letterSpacing: -2,
  },
});

export default IOSTabBar;