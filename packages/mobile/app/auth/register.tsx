import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { PolicyAgreement } from '@/components/common/PolicyAgreement';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';

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
  const { onPress, onError } = useFeedback();

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
      onPress();
      showAlert('注册成功', '欢迎加入 OpenMAIC!', [
        { text: '开始使用', onPress: () => router.replace('/') }
      ]);
    } catch (error) {
      setRegistering(false);
      onError();
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
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.neutral.background,
  },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: Spacing.sm, color: Colors.neutral.textPrimary },
  form: { marginTop: Spacing.xxl },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderRadius: Rounded.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    fontSize: 16,
    backgroundColor: Colors.neutral.card,
    color: Colors.neutral.textPrimary,
  },
  errorBox: {
    backgroundColor: Colors.feedback.errorBg,
    borderColor: Colors.feedback.errorBorder,
    borderWidth: 1,
    borderRadius: Rounded.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.feedback.errorText,
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    height: 50,
    backgroundColor: Colors.primary.main,
    borderRadius: Rounded.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: Colors.neutral.disabled },
  buttonText: { color: Colors.neutral.white, fontSize: 18, fontWeight: '600' },
  link: { color: Colors.primary.main, textAlign: 'center', marginTop: Spacing.md, fontSize: 16, fontWeight: '500' },
});
