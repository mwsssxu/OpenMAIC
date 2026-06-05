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
import { useGoBack } from '@/lib/utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth/auth-context';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useI18n } from '@/lib/i18n';
import { LinearGradient } from 'expo-linear-gradient';

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
};

const SW = Dimensions.get('window').width;
const HERO_H = Math.round(Dimensions.get('window').height * 0.42);

export default function LoginScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const { login, isLoading, isAuthenticated } = useAuth();
  const { onPress, onError } = useFeedback();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const pwdRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isAuthenticated && !busy) router.replace('/');
  }, [isAuthenticated, busy, router]);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) { setError(t('auth.errorEmptyFields')); return; }
    setBusy(true);
    try {
      await login(email, password);
      onPress();
      router.replace('/');
    } catch (err) {
      setBusy(false);
      onError();
      setError(err instanceof Error ? err.message : t('auth.errorCheckCredentials'));
    }
  };

  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView style={S.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

          {/* ── Hero ── */}
          <View style={S.hero}>
            <LinearGradient
              colors={['rgba(212,104,42,0.9)', 'rgba(196,90,26,0.6)', 'rgba(232,168,136,0.3)', C.accentDark]}
              locations={[0, 0.3, 0.65, 1]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={S.heroGrad}
            />

            {/* Brand */}
            <View style={S.brandCol}>
              <Text style={S.brandChar}>侧</Text>
              <Text style={[S.brandChar, { marginTop: 8 }]}>伴</Text>
            </View>

            {/* Back */}
            <TouchableOpacity style={S.backBtn} onPress={() => goBack()} activeOpacity={0.85}>
              <View style={S.backArrow} />
            </TouchableOpacity>

            {/* Text */}
            <View style={S.heroText}>
              <View style={S.eyebrowRow}>
                <View style={S.eyebrowLine} />
                <Text style={S.eyebrow}>LEARN &amp; GROW</Text>
              </View>
              <Text style={S.heroMain}>{t('auth.heroMain')}</Text>
              <View style={S.heroSubWrap}>
                <View style={S.heroSubDash} />
                <Text style={S.heroSub}>{t('auth.heroSub')}</Text>
              </View>
              <Text style={S.heroCaption}>{t('auth.heroCaption')}</Text>
            </View>

            {/* Bottom wave → bg */}
            <View style={S.waveWrap}>
              <View style={S.waveInner} />
            </View>
          </View>

          {/* ── Form Card ── */}
          <View style={S.card}>
            <View style={S.cardAccentBar} />

            <View style={S.cardHeader}>
              <Text style={S.greeting}>{t('auth.welcomeBack')}</Text>
            </View>

            {/* Email */}
            <View style={S.field}>
              <Text style={S.label}>{t('auth.phoneOrEmail')}</Text>
              <View style={[S.inputBox, focused === 'email' && S.inputFocus]}>
                <TextInput
                  style={S.input}
                  placeholder={t('auth.phoneOrEmailPlaceholder')}
                  placeholderTextColor="#BFB8B2"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => pwdRef.current?.focus()}
                />
              </View>
            </View>

            {/* Password */}
            <View style={S.field}>
              <Text style={S.label}>{t('auth.password')}</Text>
              <View style={S.pwdRow}>
                <View style={[S.inputBox, S.pwdInputBox, focused === 'password' && S.inputFocus]}>
                  <TextInput
                    ref={pwdRef}
                    style={S.input}
                    placeholder={t('auth.passwordPlaceholder')}
                    placeholderTextColor="#BFB8B2"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    secureTextEntry={!showPwd}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                </View>
                <TouchableOpacity style={S.eyeBtn} onPress={() => setShowPwd(v => !v)} activeOpacity={0.7}>
                  <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember + Forgot */}
            <View style={S.actions}>
              <TouchableOpacity style={S.rememberWrap} activeOpacity={0.8}>
                <View style={S.checkbox}>
                  <View style={S.checkmark} />
                </View>
                <Text style={S.rememberText}>{t('auth.rememberMe')}</Text>
              </TouchableOpacity>
              <Text style={S.forgotLink}>{t('auth.forgotPassword')}</Text>
            </View>

            {/* Error */}
            {error && (
              <View style={S.errBox}>
                <Text style={S.errText}>{error}</Text>
              </View>
            )}

            {/* Login button */}
            <TouchableOpacity style={S.loginBtn} onPress={handleLogin} disabled={isLoading || busy} activeOpacity={0.85}>
              <LinearGradient colors={[C.accent, C.accentDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.loginGrad}>
                {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={S.loginText}>{t('auth.login')}</Text>}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={S.divider}>
              <View style={S.divLine} />
              <Text style={S.divText}>{t('auth.otherLoginMethods')}</Text>
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

            {/* Signup */}
            <View style={S.signupRow}>
              <Text style={S.signupPre}>{t('auth.noAccount')}</Text>
              <Text style={S.signupLink} onPress={() => router.push('/auth/register')}>{t('auth.signUpNow')}</Text>
            </View>
          </View>

          {/* Terms */}
          <View style={S.termsWrap}>
            <Text style={S.termsText}>
              {t('auth.loginAgreePrefix')} <Text style={S.termsLink}>{t('auth.userAgreement')}</Text>{t('auth.and')} <Text style={S.termsLink}>{t('auth.privacyPolicy')}</Text>
            </Text>
            <View style={S.homeBar} />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  flex: { flex: 1 },

  /* ── Hero ── */
  hero: {
    height: HERO_H,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGrad: {
    ...StyleSheet.absoluteFillObject,
  },
  brandCol: {
    position: 'absolute',
    top: 40,
    right: 20,
    alignItems: 'flex-end',
  } as any,
  brandChar: {
    fontSize: 72,
    fontWeight: '800',
    color: 'rgba(30,20,15,0.12)',
    lineHeight: 72,
    letterSpacing: 2.88,
  } as any,
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  backArrow: {
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRightWidth: 0,
    borderTopWidth: 0,
    transform: [{ rotate: '45deg' }],
  },
  heroText: {
    position: 'absolute',
    top: 70,
    left: 28,
    right: 28,
    zIndex: 3,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  eyebrowLine: {
    width: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  heroMain: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.76,
    lineHeight: 42,
    marginBottom: 6,
  },
  heroSubWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 20,
  },
  heroSubDash: {
    width: 8,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
    position: 'absolute',
    left: 0,
    top: 8,
  },
  heroSub: {
    fontSize: 30,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 2.4,
    lineHeight: 36,
  },
  heroCaption: {
    marginTop: 16,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
    letterSpacing: 0.12,
    maxWidth: 240,
  },
  waveWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    overflow: 'hidden',
    zIndex: 2,
  },
  waveInner: {
    position: 'absolute',
    width: SW,
    height: 36,
    bottom: -1,
    left: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: C.bg,
  },

  /* ── Card ── */
  card: {
    marginTop: -55,
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: C.fg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 4,
    zIndex: 15,
  },
  cardAccentBar: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.accent,
    alignSelf: 'center',
    marginBottom: 20,
  },
  cardHeader: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.36,
    color: C.fg,
  },

  /* ── Inputs ── */
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
    marginBottom: 5,
    letterSpacing: 0.11,
  },
  inputBox: {
    height: 46,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputFocus: {
    borderColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  input: {
    fontSize: 14,
    color: C.fg,
    flex: 1,
  },
  pwdRow: {
    position: 'relative',
  },
  pwdInputBox: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 4,
    top: 6,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Actions ── */
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  rememberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: C.accent,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    width: 5,
    height: 3,
    borderWidth: 1,
    borderColor: '#fff',
    borderRightWidth: 0,
    borderTopWidth: 0,
    transform: [{ rotate: '-45deg' }],
  },
  rememberText: {
    fontSize: 12,
    color: C.muted,
  },
  forgotLink: {
    fontSize: 12,
    color: C.accent,
    fontWeight: '500',
  },

  /* ── Error ── */
  errBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },

  /* ── Login Button ── */
  loginBtn: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 4,
  },
  loginGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.15,
  },

  /* ── Divider ── */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 14,
  },
  divLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  divText: {
    fontSize: 11,
    color: C.muted,
    marginHorizontal: 12,
  },

  /* ── Social ── */
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  socialBtn: {
    width: 52,
    minHeight: 44,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBg: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wechatDot: {
    width: 12,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#07C160',
  },
  appleDot: {
    width: 10,
    height: 12,
    borderRadius: 3,
    backgroundColor: C.fg,
  },
  smsTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderLeftColor: C.accent,
    borderTopWidth: 3.5,
    borderTopColor: 'transparent',
    borderBottomWidth: 3.5,
    borderBottomColor: 'transparent',
  },

  /* ── Signup ── */
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  signupPre: {
    fontSize: 13,
    color: C.muted,
  },
  signupLink: {
    fontSize: 13,
    color: C.accent,
    fontWeight: '600',
  },

  /* ── Terms ── */
  termsWrap: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  termsText: {
    fontSize: 10,
    color: '#9E9690',
    lineHeight: 17,
    textAlign: 'center',
  },
  termsLink: {
    color: C.accent,
  },
  homeBar: {
    width: 134,
    height: 5,
    backgroundColor: 'rgba(30,20,15,0.18)',
    borderRadius: 3,
    marginTop: 12,
  },
});
