import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useI18n } from '@/lib/i18n';
import IOSTabBar from '@/lib/components/IOSTabBar';

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { onPress } = useFeedback();
  const { t } = useI18n();

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
            title: t('tabs.home'),
            headerShown: false,
          }}
          listeners={{
            tabPress: () => onPress(),
          }}
        />
        <Tabs.Screen
          name="courses"
          options={{
            title: t('tabs.courses'),
            headerShown: true,
          }}
          listeners={{
            tabPress: () => onPress(),
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{
            title: t('tabs.questions'),
            headerShown: true,
          }}
          listeners={{
            tabPress: () => onPress(),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
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