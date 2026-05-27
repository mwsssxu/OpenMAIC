import { useEffect, useRef, useState } from 'react';
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
import { showAlert } from '@/lib/utils/alert';

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
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // 键盘顺序跳转
  const passwordInputRef = useRef<TextInput>(null);
  const nicknameInputRef = useRef<TextInput>(null);

  // 注册成功后自动跳转（用 effect 避免在 render 期间触发副作用）
  useEffect(() => {
    if (isAuthenticated && !registering) {
      router.replace('/');
    }
  }, [isAuthenticated, registering, router]);

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
            style={[
              styles.input,
              focusedInput === 'email' && styles.inputFocused
            ]}
            placeholder="邮箱"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedInput('email')}
            onBlur={() => setFocusedInput(null)}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            blurOnSubmit={false}
            placeholderTextColor={Colors.neutral.textMuted}
          />
          <View style={styles.passwordRow}>
            <TextInput
              ref={passwordInputRef}
              style={[
                styles.input,
                styles.passwordInput,
                focusedInput === 'password' && styles.inputFocused
              ]}
              placeholder="密码（至少 6 位）"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => nicknameInputRef.current?.focus()}
              blurOnSubmit={false}
              placeholderTextColor={Colors.neutral.textMuted}
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
            style={[
              styles.input,
              focusedInput === 'nickname' && styles.inputFocused
            ]}
            placeholder="昵称（可选）"
            value={nickname}
            onChangeText={setNickname}
            onFocus={() => setFocusedInput('nickname')}
            onBlur={() => setFocusedInput(null)}
            textContentType="nickname"
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            placeholderTextColor={Colors.neutral.textMuted}
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

          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#c45a1a" />
            <Text style={styles.linkText}>已有账户？返回登录</Text>
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
  inputFocused: {
    borderColor: Colors.primary.main,
    borderWidth: 1.5,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
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
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md },
  linkText: { color: '#c45a1a', fontSize: 16, fontWeight: '500', marginLeft: 4 },
});
