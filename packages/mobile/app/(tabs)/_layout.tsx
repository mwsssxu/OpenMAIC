import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth/auth-context';

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  // 加载中显示空白
  if (isLoading) {
    return null;
  }

  // 未认证则重定向到登录页
  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
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
          title: '工作台',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
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
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      {/* 隐藏其他tab页面，通过工作台入口访问 */}
      <Tabs.Screen
        name="courses"
        options={{
          title: '我的课程',
          headerShown: true,
          href: null,
        }}
      />
      <Tabs.Screen
        name="questions"
        options={{ title: '问答', headerShown: true, href: null }}
      />
      <Tabs.Screen
        name="notes"
        options={{ title: '笔记', headerShown: true, href: null }}
      />
      <Tabs.Screen
        name="buddy"
        options={{ title: '搭子', headerShown: true, href: null }}
      />
      <Tabs.Screen
        name="matching"
        options={{ title: '匹配', headerShown: true, href: null }}
      />
      <Tabs.Screen
        name="gamification"
        options={{ title: '成长', headerShown: true, href: null }}
      />
      <Tabs.Screen
        name="invite"
        options={{ title: '邀请', headerShown: true, href: null }}
      />
      <Tabs.Screen
        name="payment"
        options={{ title: '充值', headerShown: true, href: null }}
      />
    </Tabs>
  );
}