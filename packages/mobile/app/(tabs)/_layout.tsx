import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { useFeedback } from '@/lib/hooks/use-feedback';
import IOSTabBar from '@/lib/components/IOSTabBar';

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
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '首页',
            headerShown: false,
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
          }}
          listeners={{
            tabPress: () => onPress(),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: '我的',
            headerShown: true,
          }}
          listeners={{
            tabPress: () => onPress(),
          }}
        />
        {/* 隐藏其他页面 */}
        <Tabs.Screen name="discover" options={{ href: null }} />
        <Tabs.Screen name="knowledge" options={{ href: null }} />
        <Tabs.Screen name="questions" options={{ href: null }} />
        <Tabs.Screen name="buddy" options={{ href: null }} />
        <Tabs.Screen name="matching" options={{ href: null }} />
        <Tabs.Screen name="gamification" options={{ href: null }} />
        <Tabs.Screen name="invite" options={{ href: null }} />
        <Tabs.Screen name="payment" options={{ href: null }} />
      </Tabs>
      {/* 单一持久化的 TabBar */}
      <IOSTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});