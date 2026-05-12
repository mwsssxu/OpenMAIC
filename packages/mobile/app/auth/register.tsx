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
  const [showPassword, setShowPassword] = useState(false);
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 键盘顺序跳转
  const passwordInputRef = useRef<TextInput>(null);
  const nicknameInputRef = useRef<TextInput>(null);

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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.neutral.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>创建账户</Text>

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
              placeholder="密码（至少 6 位）"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => nicknameInputRef.current?.focus()}
              blurOnSubmit={false}
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
          <TextInput
            ref={nicknameInputRef}
            style={styles.input}
            placeholder="昵称（可选）"
            value={nickname}
            onChangeText={setNickname}
            textContentType="nickname"
            returnKeyType="done"
            onSubmitEditing={handleRegister}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
});
