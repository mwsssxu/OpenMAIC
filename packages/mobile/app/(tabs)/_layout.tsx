import { Tabs, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth/auth-context';

export default function TabLayout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Stack.Screen name="auth/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#5b9bd5',
        tabBarInactiveTintColor: '#999',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '我的课程',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: '发现',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="questions"
        options={{
          title: '问答',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: '笔记',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="buddy"
        options={{
          title: '搭子',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="happy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="matching"
        options={{
          title: '匹配',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="gamification"
        options={{
          title: '成长',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="invite"
        options={{
          title: '邀请',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="gift" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payment"
        options={{
          title: '充值',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}