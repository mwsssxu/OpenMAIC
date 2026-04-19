import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth/auth-context';
import { TouchableOpacity, Text, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

function CustomBackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/courses')}
      style={{ marginLeft: Platform.OS === 'web' ? 10 : 0 }}
    >
      {Platform.OS === 'web' ? (
        <Text style={{ color: '#5b9bd5', fontSize: 16 }}>← 返回</Text>
      ) : (
        <Ionicons name="chevron-back" size={24} color="#5b9bd5" />
      )}
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
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="wallet" />
          <Stack.Screen name="enterprise" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}