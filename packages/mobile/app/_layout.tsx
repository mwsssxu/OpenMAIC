import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth/auth-context';
import { TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// 全局错误处理 - 拦截MetaMask等浏览器扩展错误
// 在模块加载时就执行（比组件渲染更早）
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // 保存原始的console.error
  const originalConsoleError = console.error;

  // 覆盖console.error，过滤MetaMask相关错误
  console.error = (...args: any[]) => {
    const errorMessage = args[0]?.message || args[0] || '';
    if (typeof errorMessage === 'string' &&
        (errorMessage.includes('MetaMask') ||
         errorMessage.includes('inpage.js') ||
         errorMessage.includes('ethereum'))) {
      // 忽略MetaMask相关错误，不输出
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // 捕获未处理的Promise错误
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason;
    const errorMessage = error?.message || '';
    if (errorMessage.includes('MetaMask') ||
        errorMessage.includes('inpage.js') ||
        errorMessage.includes('ethereum') ||
        errorMessage.includes('wallet')) {
      console.log('[Ignored] Wallet extension error:', errorMessage);
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  };

  window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

  // 捕获全局错误
  const handleError = (event: ErrorEvent) => {
    const error = event.error;
    const errorMessage = error?.message || event.message || '';
    const filename = event.filename || '';

    if (errorMessage.includes('MetaMask') ||
        filename.includes('inpage.js') ||
        filename.includes('chrome-extension') ||
        errorMessage.includes('ethereum')) {
      console.log('[Ignored] Wallet extension error:', errorMessage);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  };

  window.addEventListener('error', handleError, true);
}

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
  // 全局错误处理器已在模块加载时设置，无需在组件中再次调用

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