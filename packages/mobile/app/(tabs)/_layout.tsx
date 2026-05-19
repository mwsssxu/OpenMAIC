import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { useFeedback } from '@/lib/hooks/use-feedback';

// iOS 风格图标组件
const TabIcon = ({ emoji, focused }: { emoji: string; focused: boolean }) => (
  <View style={[styles.iconContainer, focused && styles.iconActive]}>
    <Text style={styles.iconText}>{emoji}</Text>
  </View>
);

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { onPress } = useFeedback();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.72)',
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(0, 0, 0, 0.1)',
          paddingTop: 8,
          paddingBottom: 8,
          height: 83,
          position: 'absolute',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.005,
        },
        tabBarActiveTintColor: '#B8714B',
        tabBarInactiveTintColor: 'rgba(0, 0, 0, 0.5)',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
        listeners={{
          tabPress: () => onPress(),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: '课程',
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon emoji="📚" focused={focused} />,
        }}
        listeners={{
          tabPress: () => onPress(),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: '笔记',
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon emoji="📝" focused={focused} />,
        }}
        listeners={{
          tabPress: () => onPress(),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
        listeners={{
          tabPress: () => onPress(),
        }}
      />
      {/* 隐藏其他页面 */}
      <Tabs.Screen
        name="discover"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="knowledge"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="questions"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="buddy"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="matching"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="gamification"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="invite"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="payment"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconActive: {
    // 活跃状态样式
  },
  iconText: {
    fontSize: 22,
  },
});