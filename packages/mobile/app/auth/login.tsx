import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { PolicyAgreement } from '@/components/common/PolicyAgreement';
import { Colors } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';

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
  const { onPress, onError } = useFeedback();

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
      onPress();
      router.replace('/');
    } catch (error) {
      setLoggingIn(false);
      onError();
      const message = error instanceof Error ? error.message : '请检查邮箱和密码';
      setError(message);
    }
  };

  const handleOAuthLogin = async (provider: string) => {
    onPress();
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
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.neutral.background,
  },
  title: { fontSize: 32, fontWeight: 'bold', color: Colors.primary.main },
  subtitle: { fontSize: 16, color: Colors.neutral.textSecondary, marginTop: 8 },
  form: { width: '100%', marginTop: 40 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: Colors.neutral.card,
    color: Colors.neutral.textPrimary,
  },
  errorBox: {
    backgroundColor: Colors.feedback.errorBg,
    borderColor: Colors.feedback.errorBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.feedback.errorText,
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    height: 50,
    backgroundColor: Colors.primary.main,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { backgroundColor: Colors.neutral.disabled },
  buttonText: { color: Colors.neutral.white, fontSize: 18, fontWeight: '600' },
  link: { color: Colors.primary.main, textAlign: 'center', marginTop: 20, fontSize: 16, fontWeight: '500' },
  oauthSection: { marginTop: 40 },
  oauthTitle: { textAlign: 'center', color: Colors.neutral.textSecondary },
  oauthButtons: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 12 },
  oauthButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  oauthButtonText: { color: Colors.neutral.white, fontWeight: '600' },
});
