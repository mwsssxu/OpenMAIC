import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { PolicyAgreement } from '@/components/common/PolicyAgreement';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
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
  const [showPassword, setShowPassword] = useState(false);
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 使用 ref 实现邮箱 → 密码的键盘回车跳转
  const passwordInputRef = useRef<TextInput>(null);

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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.neutral.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            blurOnSubmit={false}
          />
          <View style={styles.passwordRow}>
            <TextInput
              ref={passwordInputRef}
              style={[styles.input, styles.passwordInput]}
              placeholder="密码"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel={showPassword ? '隐藏密码' : '显示密码'}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={Colors.neutral.textMuted}
              />
            </TouchableOpacity>
          </View>

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.neutral.background,
  },
  title: { fontSize: 32, fontWeight: 'bold', color: Colors.primary.main },
  subtitle: { fontSize: 16, color: Colors.neutral.textSecondary, marginTop: Spacing.sm },
  form: { width: '100%', marginTop: Spacing.xxl + 8 },
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
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 44,
  },
  passwordToggle: {
    position: 'absolute',
    right: Spacing.sm,
    top: 14,
    padding: 4,
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
  oauthSection: { marginTop: Spacing.xxl + 8 },
  oauthTitle: { textAlign: 'center', color: Colors.neutral.textSecondary },
  oauthButtons: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.md, gap: Spacing.sm },
  oauthButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.sm,
  },
  oauthButtonText: { color: Colors.neutral.white, fontWeight: '600' },
});
