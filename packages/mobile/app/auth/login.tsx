import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { PolicyAgreement } from '@/components/common/PolicyAgreement';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [policyAgreed, setPolicyAgreed] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('提示', '请输入邮箱和密码');
      return;
    }

    if (!policyAgreed) {
      Alert.alert('提示', '请先阅读并同意用户协议和隐私政策');
      return;
    }

    try {
      await login(email, password);
      router.replace('/');
    } catch (error) {
      Alert.alert('登录失败', error instanceof Error ? error.message : '请检查邮箱和密码');
    }
  };

  const handleOAuthLogin = async (provider: string) => {
    // TODO: 实现 OAuth 登录
    Alert.alert('提示', `${provider} 登录功能即将上线`);
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

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? '登录中...' : '登录'}
          </Text>
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
            onPress={() => handleOAuthLogin('apple')}
          >
            <Text style={styles.oauthButtonText}>Apple</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.oauthButton, { backgroundColor: '#4285F4' }]}
            onPress={() => handleOAuthLogin('google')}
          >
            <Text style={styles.oauthButtonText}>Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.oauthButton, { backgroundColor: '#07C160' }]}
            onPress={() => handleOAuthLogin('wechat')}
          >
            <Text style={styles.oauthButtonText}>微信</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
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
  },
  button: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: 'white', fontSize: 18 },
  link: { color: '#007AFF', textAlign: 'center', marginTop: 20 },
  oauthSection: { marginTop: 40 },
  oauthTitle: { textAlign: 'center', color: '#666' },
  oauthButtons: { flexDirection: 'row', justifyContent: 'center', marginTop: 15, gap: 10 },
  oauthButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 5 },
  oauthButtonText: { color: 'white' },
});