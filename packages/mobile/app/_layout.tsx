import { Stack } from 'expo-router';
import { GlobalDialog } from '@/lib/utils/global-dialog';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { TouchableOpacity, Platform, LogBox } from 'react-native';
import { useRouter, usePathname, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/lib/i18n';
import { useGoBack } from '@/lib/utils/navigation';

// 全局抑制 useNativeDriver 警告（Expo Go 缺少 RCTAnimation 原生模块）
// 第三方库（reanimated、react-navigation 等）内部硬编码 useNativeDriver: true，
// 项目代码已用 USE_NATIVE_DRIVER 动态检测，但无法控制第三方库
// LogBox.ignoreLogs 比 console.warn 覆盖更可靠，能拦截所有来源的警告
LogBox.ignoreLogs([
  /useNativeDriver.*native animated module is missing/,
]);

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
  const goBack = useGoBack();

  const handleBack = () => {
    // 尝试返回，如果失败则跳转到首页
    try {
      if (router.canGoBack()) {
        goBack();
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

// 全局认证守卫 — 未认证时只渲染登录页，不渲染 Stack
const PUBLIC_ROUTES = ['/auth/login', '/auth/register'];

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();

  // 加载中不渲染
  if (isLoading) return null;

  // 已认证 → 正常渲染
  if (isAuthenticated) return <>{children}</>;

  // 未认证 → 判断是否在公开页面
  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname.startsWith(r));
  if (isPublicRoute) return <>{children}</>;

  // 未认证且不在公开页面 → 强制重定向到登录页
  return <Redirect href="/auth/login" />;
}

function RootStack() {
  const { t } = useI18n();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="classroom/[id]" options={{ headerShown: true, title: t('classroom.detail'), headerLeft: () => <CustomBackButton /> }} />
      <Stack.Screen name="classroom/create" options={{ headerShown: true, title: t('classroom.create'), headerLeft: () => <CustomBackButton /> }} />
      <Stack.Screen name="course/[id]" options={{ headerShown: true, title: t('classroom.detail'), headerLeft: () => <CustomBackButton /> }} />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/register" />
      <Stack.Screen name="wallet" />
      <Stack.Screen name="enterprise" />
    </Stack>
  );
}

export default function RootLayout() {
  // 全局错误处理器已在模块加载时设置，无需在组件中再次调用

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGuard>
          <StatusBar style="auto" />
          <RootStack />
          <GlobalDialog />
        </AuthGuard>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
