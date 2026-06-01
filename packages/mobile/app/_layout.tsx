import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth/auth-context';
import { TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

function CustomBackButton() {
  const router = useRouter();

  const handleBack = () => {
    // 尝试返回，如果失败则跳转到首页
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      router.replace('/(tabs)');
    }
  };

  return (
    <TouchableOpacity
      onPress={handleBack}
      style={{ marginLeft: Platform.OS === 'web' ? 10 : 0 }}
    >
      <Ionicons name="chevron-back" size={24} color="#c45a1a" />
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="classroom/[id]" options={{ headerShown: true, title: '课程详情', headerLeft: () => <CustomBackButton /> }} />
          <Stack.Screen name="classroom/create" options={{ headerShown: true, title: '创建课程', headerLeft: () => <CustomBackButton /> }} />
          <Stack.Screen name="course/[id]" options={{ headerShown: true, title: '课程详情', headerLeft: () => <CustomBackButton /> }} />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="wallet" />
          <Stack.Screen name="enterprise" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}