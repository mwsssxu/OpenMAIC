import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { PolicyAgreement } from '@/components/common/PolicyAgreement';

// Web端使用window.alert，Mobile端使用Alert.alert
const showAlert = (title: string, message: string, buttons?: any[]) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 0) {
      const confirm = window.confirm(`${title}\n\n${message}\n\n点击确定继续`);
      if (confirm && buttons[0].onPress) {
        buttons[0].onPress();
      }
    } else {
      window.alert(`${title}\n\n${message}`);
    }
  } else {
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, buttons);
  }
};

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 注册成功后自动跳转
  if (isAuthenticated && !registering) {
    router.replace('/');
    return null;
  }

  const handleRegister = async () => {
    setError(null);

    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要 6 位字符');
      return;
    }

    if (!policyAgreed) {
      setError('请先勾选同意用户协议和隐私政策');
      return;
    }

    setRegistering(true);
    try {
      await register(email, password, nickname || undefined);
      showAlert('注册成功', '欢迎加入 OpenMAIC!', [
        { text: '开始使用', onPress: () => router.replace('/') }
      ]);
    } catch (error) {
      setRegistering(false);
      const message = error instanceof Error ? error.message : '请稍后重试';
      setError(message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>创建账户</Text>

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
          placeholder="密码（至少 6 位）"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="昵称（可选）"
          value={nickname}
          onChangeText={setNickname}
        />

        <PolicyAgreement checked={policyAgreed} onCheck={setPolicyAgreed} />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, (isLoading || registering) && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isLoading || registering}
        >
          {registering ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>注册</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>已有账户？返回登录</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  form: { marginTop: 40 },
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
});