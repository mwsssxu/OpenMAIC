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
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth/auth-context';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { LinearGradient } from 'expo-linear-gradient';
import { PolicyAgreement } from '@/components/common/PolicyAgreement';

const C = {
  bg: '#FBF6F2',
  surface: 'rgba(255,255,255,0.65)',
  fg: '#1F1A17',
  muted: '#6D6763',
  border: '#E8E3DC',
  accent: '#D4682A',
  accentDark: '#B84A15',
  accentSoft: '#E0C8B8',
  accentLight: '#F5ECE6',
  weak: '#DC2626',
  medium: '#EAB308',
  strong: '#17A34A',
};

const SW = Dimensions.get('window').width;
const HERO_H = Math.round(Dimensions.get('window').height * 0.38);

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading, isAuthenticated } = useAuth();
  const { onPress, onError } = useFeedback();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const pwdRef = useRef<TextInput>(null);
  const pwdConfirmRef = useRef<TextInput>(null);
  const nicknameRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isAuthenticated && !busy) router.replace('/');
  }, [isAuthenticated, busy, router]);

  // 密码强度
  const pwdStrength = (() => {
    if (!password) return { score: 0, label: '', level: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    const levels = ['weak', 'medium', 'strong'];
    const labels = ['弱', '中等', '强'];
    return { score, label: labels[score - 1] || '', level: levels[score - 1] || '' };
  })();

  const handleRegister = async () => {
    setError(null);
    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }
    if (password.length < 8) {
      setError('密码至少需要 8 位字符');
      return;
    }
    if (/[a-zA-Z]/.test(password) === false || /\d/.test(password) === false) {
      setError('密码需包含字母和数字');
      return;
    }
    if (password !== passwordConfirm) {
      setError('两次密码输入不一致');
      return;
    }
    if (!policyAgreed) {
      setError('请先同意用户协议和隐私政策');
      return;
    }
    setBusy(true);
    try {
      await register(email, password, nickname || undefined);
      onPress();
      router.replace('/');
    } catch (err) {
      setBusy(false);
      onError();
      setError(err instanceof Error ? err.message : '注册失败，请稍后重试');
    }
  };

  const strengthColor = pwdStrength.level === 'weak' ? C.weak
    : pwdStrength.level === 'medium' ? C.medium : C.strong;

  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView style={S.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">

          {/* ── Hero ── */}
          <View style={S.hero}>
            <LinearGradient
              colors={['rgba(212,104,42,0.9)', 'rgba(196,90,26,0.6)', 'rgba(232,168,136,0.3)', C.accentDark]}
              locations={[0, 0.3, 0.65, 1]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={S.heroGrad}
            />

            {/* Brand watermark */}
            <View style={S.brandCol}>
              <Text style={S.brandChar}>侧</Text>
              <Text style={[S.brandChar, { marginTop: 8 }]}>伴</Text>
            </View>

            {/* Back */}
            <TouchableOpacity style={S.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <View style={S.backArrow} />
            </TouchableOpacity>

            {/* Decorative line */}
            <View style={S.decoLine}>
              <View style={S.decoDot} />
              <View style={S.decoDash} />
            </View>

            {/* Hero text */}
            <View style={S.heroText}>
              <View style={S.eyebrowRow}>
                <View style={S.eyebrowLine} />
                <Text style={S.eyebrow}>JOIN US</Text>
              </View>
              <Text style={S.heroMain}>为己而学</Text>
              <View style={S.heroSubWrap}>
                <View style={S.heroSubDash} />
                <Text style={S.heroSub}>为人而行</Text>
              </View>
              <Text style={S.heroCaption}>{'开启你的学习旅程\n与千万学伴共同成长'}</Text>
            </View>

            {/* Bottom wave */}
            <View style={S.waveWrap}>
              <View style={S.waveInner} />
            </View>
          </View>

          {/* ── Form Card ── */}
          <View style={S.card}>
            <View style={S.cardAccentBar} />

            <View style={S.cardHeader}>
              <Text style={S.greeting}>创建账号</Text>
            </View>

            {/* Email */}
            <View style={S.field}>
              <Text style={S.label}>邮箱</Text>
              <View style={[S.inputBox, focused === 'email' && S.inputFocus]}>
                <TextInput
                  style={S.input}
                  placeholder="请输入邮箱地址"
                  placeholderTextColor="#BFB8B2"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => pwdRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            </View>

            {/* Nickname */}
            <View style={S.field}>
              <Text style={S.label}>昵称</Text>
              <View style={[S.inputBox, focused === 'nickname' && S.inputFocus]}>
                <TextInput
                  ref={nicknameRef}
                  style={S.input}
                  placeholder="给自己取一个名字"
                  placeholderTextColor="#BFB8B2"
                  value={nickname}
                  onChangeText={setNickname}
                  onFocus={() => setFocused('nickname')}
                  onBlur={() => setFocused(null)}
                  textContentType="nickname"
                  returnKeyType="next"
                  onSubmitEditing={() => pwdRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={S.field}>
              <Text style={S.label}>密码</Text>
              <View style={S.pwdRow}>
                <View style={[S.inputBox, S.pwdInputBox, focused === 'password' && S.inputFocus]}>
                  <TextInput
                    ref={pwdRef}
                    style={S.input}
                    placeholder="至少8位，包含字母和数字"
                    placeholderTextColor="#BFB8B2"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    secureTextEntry={!showPwd}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="next"
                    onSubmitEditing={() => pwdConfirmRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </View>
                <TouchableOpacity style={S.eyeBtn} onPress={() => setShowPwd(v => !v)} activeOpacity={0.7}>
                  <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.muted} />
                </TouchableOpacity>
              </View>
              {/* Password strength */}
              {password.length > 0 && (
                <View style={S.strengthWrap}>
                  <View style={S.strengthRow}>
                    <View style={[S.strengthBar, pwdStrength.score >= 1 && { backgroundColor: strengthColor }]} />
                    <View style={[S.strengthBar, pwdStrength.score >= 2 && { backgroundColor: strengthColor }]} />
                    <View style={[S.strengthBar, pwdStrength.score >= 3 && { backgroundColor: strengthColor }]} />
                  </View>
                  <Text style={S.strengthLabel}>{pwdStrength.label ? `密码强度：${pwdStrength.label}` : ''}</Text>
                </View>
              )}
            </View>

            {/* Password confirm */}
            <View style={S.field}>
              <Text style={S.label}>确认密码</Text>
              <View style={S.pwdRow}>
                <View style={[S.inputBox, S.pwdInputBox, focused === 'passwordConfirm' && S.inputFocus]}>
                  <TextInput
                    ref={pwdConfirmRef}
                    style={S.input}
                    placeholder="再次输入密码"
                    placeholderTextColor="#BFB8B2"
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    onFocus={() => setFocused('passwordConfirm')}
                    onBlur={() => setFocused(null)}
                    secureTextEntry={!showPwdConfirm}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                  />
                </View>
                <TouchableOpacity style={S.eyeBtn} onPress={() => setShowPwdConfirm(v => !v)} activeOpacity={0.7}>
                  <Ionicons name={showPwdConfirm ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Agreement */}
            <PolicyAgreement checked={policyAgreed} onCheck={setPolicyAgreed} />

            {/* Error */}
            {error && (
              <View style={S.errBox}>
                <Text style={S.errText}>{error}</Text>
              </View>
            )}

            {/* Register button */}
            <TouchableOpacity
              style={[S.regBtn, (!policyAgreed || isLoading || busy) && S.regBtnDisabled]}
              onPress={handleRegister}
              disabled={!policyAgreed || isLoading || busy}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={policyAgreed && !isLoading && !busy ? [C.accent, C.accentDark] : ['#D0D0D0', '#C0C0C0']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={S.regGrad}
              >
                {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={S.regText}>注 册</Text>}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={S.divider}>
              <View style={S.divLine} />
              <Text style={S.divText}>其他注册方式</Text>
              <View style={S.divLine} />
            </View>

            {/* Social */}
            <View style={S.socialRow}>
              <TouchableOpacity style={S.socialBtn} onPress={() => onPress()} activeOpacity={0.85}>
                <View style={[S.socialBg, { backgroundColor: 'rgba(7,193,96,0.12)' }]}>
                  <View style={S.wechatDot} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={S.socialBtn} onPress={() => onPress()} activeOpacity={0.85}>
                <View style={[S.socialBg, { backgroundColor: '#fff' }]}>
                  <View style={S.appleDot} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={S.socialBtn} onPress={() => onPress()} activeOpacity={0.85}>
                <View style={[S.socialBg, { backgroundColor: 'rgba(212,104,42,0.12)' }]}>
                  <View style={S.smsTriangle} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Login link */}
            <View style={S.loginRow}>
              <Text style={S.loginPre}>已有账号？</Text>
              <TouchableOpacity onPress={() => router.push('/auth/login')} activeOpacity={0.7}>
                <Text style={S.loginLink}>立即登录</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Home indicator */}
          <View style={S.termsWrap}>
            <View style={S.homeBar} />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  /* ── Hero ── */
  hero: { height: HERO_H, position: 'relative', overflow: 'hidden' },
  heroGrad: { ...StyleSheet.absoluteFillObject },
  brandCol: { position: 'absolute', top: 40, right: 20, alignItems: 'flex-end' } as any,
  brandChar: { fontSize: 72, fontWeight: '800', color: 'rgba(30,20,15,0.12)', lineHeight: 72, letterSpacing: 2.88 } as any,
  backBtn: {
    position: 'absolute', top: 16, left: 16, width: 32, height: 32,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  backArrow: {
    width: 10, height: 10, borderWidth: 1.5, borderColor: '#fff',
    borderRightWidth: 0, borderTopWidth: 0, transform: [{ rotate: '45deg' }],
  },
  decoLine: {
    position: 'absolute', top: 80, left: 28, alignItems: 'center',
  },
  decoDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.5)' },
  decoDash: { width: 1, height: 60, backgroundColor: 'rgba(255,255,255,0.3)' },

  heroText: { position: 'absolute', top: 100, left: 28, right: 28, zIndex: 3 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  eyebrowLine: { width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.4)' },
  eyebrow: { fontSize: 10, letterSpacing: 1.8, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  heroMain: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.64, lineHeight: 37, marginBottom: 4 },
  heroSubWrap: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 20, position: 'relative' },
  heroSubDash: { width: 8, height: 1, backgroundColor: 'rgba(255,255,255,0.5)', position: 'absolute', left: 0, top: 8 },
  heroSub: { fontSize: 26, fontWeight: '300', color: 'rgba(255,255,255,0.8)', letterSpacing: 2.08, lineHeight: 31 },
  heroCaption: { marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 18, letterSpacing: 0.11, maxWidth: 220 },
  waveWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, overflow: 'hidden', zIndex: 2 },
  waveInner: { position: 'absolute', width: SW, height: 36, bottom: -1, left: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: C.bg },

  /* ── Card ── */
  card: {
    marginTop: -20, marginHorizontal: 16, marginBottom: 16,
    backgroundColor: C.surface, borderRadius: 20,
    paddingVertical: 22, paddingHorizontal: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: C.fg, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06, shadowRadius: 32, elevation: 4, zIndex: 15,
  },
  cardAccentBar: { width: 40, height: 3, borderRadius: 2, backgroundColor: C.accent, alignSelf: 'center', marginBottom: 18 },
  cardHeader: { marginBottom: 18 },
  greeting: { fontSize: 18, fontWeight: '700', letterSpacing: -0.36, color: C.fg },

  /* ── Inputs ── */
  field: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', color: C.muted, marginBottom: 4, letterSpacing: 0.11 },
  inputBox: {
    height: 44, borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 14, justifyContent: 'center',
  },
  inputFocus: {
    borderColor: C.accent, shadowColor: C.accent, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08, shadowRadius: 8,
  },
  input: { fontSize: 14, color: C.fg, flex: 1 },
  pwdRow: { position: 'relative' },
  pwdInputBox: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: 4, top: 5, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  /* ── Password strength ── */
  strengthWrap: { marginTop: 6 },
  strengthRow: { flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.border },
  strengthLabel: { fontSize: 10, marginTop: 3, color: C.muted, textAlign: 'right' },

  /* ── Error ── */
  errBox: { backgroundColor: '#FEE2E2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  errText: { color: '#B91C1C', fontSize: 13, textAlign: 'center' },

  /* ── Register Button ── */
  regBtn: { height: 48, borderRadius: 12, marginTop: 4, shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 3 },
  regBtnDisabled: { shadowOpacity: 0, elevation: 0 },
  regGrad: { flex: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  regText: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },

  /* ── Divider ── */
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 12, gap: 12 },
  divLine: { flex: 1, height: 1, backgroundColor: C.border },
  divText: { fontSize: 11, color: C.muted },

  /* ── Social ── */
  socialRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 14 },
  socialBtn: { width: 52, height: 42, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  socialBg: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  wechatDot: { width: 10, height: 6, borderRadius: 3, backgroundColor: '#07C160' },
  appleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#111' },
  smsTriangle: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: C.accent },

  /* ── Login link ── */
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4, marginBottom: 4 },
  loginPre: { fontSize: 13, color: C.muted },
  loginLink: { fontSize: 13, color: C.accent, fontWeight: '600', marginLeft: 4 },

  /* ── Footer ── */
  termsWrap: { alignItems: 'center', paddingBottom: 20 },
  homeBar: { width: 134, height: 5, borderRadius: 3, backgroundColor: 'rgba(30,26,23,0.18)' },
});