import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { PolicyAgreement } from '@/components/common/PolicyAgreement';

// Web端使用window.alert，Mobile端使用Alert.alert
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    const Alert = require('react-native').Alert;
    Alert.alert(title, message);
  }
};

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 登录成功后自动跳转
  if (isAuthenticated && !loggingIn) {
    router.replace('/');
    return null;
  }

  const handleLogin = async () => {
    setError(null);

    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }

    if (!policyAgreed) {
      setError('请先勾选同意用户协议和隐私政策');
      return;
    }

    setLoggingIn(true);
    try {
      await login(email, password);
      router.replace('/');
    } catch (error) {
      setLoggingIn(false);
      const message = error instanceof Error ? error.message : '请检查邮箱和密码';
      setError(message);
    }
  };

  const handleOAuthLogin = async (provider: string) => {
    showAlert('提示', `${provider} 登录功能即将上线`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OpenMAIC</Text>
      <Text style={styles.subtitle}>AI 交互课堂</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="邮箱"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="密码"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <PolicyAgreement checked={policyAgreed} onCheck={setPolicyAgreed} />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, (isLoading || loggingIn) && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading || loggingIn}
        >
          {loggingIn ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>登录</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/auth/register')}>
          <Text style={styles.link}>注册新账户</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.oauthSection}>
        <Text style={styles.oauthTitle}>第三方登录</Text>
        <View style={styles.oauthButtons}>
          <TouchableOpacity
            style={[styles.oauthButton, { backgroundColor: '#000' }]}
            onPress={() => handleOAuthLogin('Apple')}
          >
            <Text style={styles.oauthButtonText}>Apple</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.oauthButton, { backgroundColor: '#4285F4' }]}
            onPress={() => handleOAuthLogin('Google')}
          >
            <Text style={styles.oauthButtonText}>Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.oauthButton, { backgroundColor: '#07C160' }]}
            onPress={() => handleOAuthLogin('WeChat')}
          >
            <Text style={styles.oauthButtonText}>微信</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 5 },
  form: { width: '100%', marginTop: 40 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '600' },
  link: { color: '#007AFF', textAlign: 'center', marginTop: 20, fontSize: 16 },
  oauthSection: { marginTop: 40 },
  oauthTitle: { textAlign: 'center', color: '#666' },
  oauthButtons: { flexDirection: 'row', justifyContent: 'center', marginTop: 15, gap: 10 },
  oauthButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 5 },
  oauthButtonText: { color: 'white' },
});