import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth/auth-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="classroom/[id]" options={{ headerShown: true, title: '课程详情', headerBackVisible: true }} />
          <Stack.Screen name="classroom/create" options={{ headerShown: true, title: '创建课程', headerBackVisible: true }} />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="wallet" />
          <Stack.Screen name="enterprise" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}