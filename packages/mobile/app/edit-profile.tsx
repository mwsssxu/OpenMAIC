import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Platform, KeyboardAvoidingView, Modal, Dimensions } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { useI18n } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { showError, confirmAction } from '@/lib/utils/error-toast';
import { useGoBack } from '@/lib/utils/navigation';

const C = {
  bgSolid: '#f5f3f2',
  surface: 'rgba(255, 255, 255, 0.55)',
  surfaceSolid: '#FFFFFF',
  fg: '#1a1a1a',
  muted: '#666666',
  border: 'rgba(230, 225, 220, 0.6)',
  accent: '#c45a1a',
  accentLight: '#fde8e0',
  secondary: '#1a8a8a',
  danger: '#dc2626',
};

const INTERESTS = [
  '数据分析', '前端开发', '后端开发', '产品设计', '人工智能',
  '云计算', '区块链', '网络安全', '移动开发', '游戏开发',
  '运维', '数据库', '算法', '数学', '物理',
];

export default function EditProfileScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const { user, logout } = useAuth();
  const { onSuccess } = useFeedback();
  const haptics = useHaptics();
  const { t, locale, setLocale } = useI18n();
  const insets = useSafeAreaInsets();

  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<string>('');
  const [interests, setInterests] = useState<string[]>([]);
  const [showProgress, setShowProgress] = useState(true);
  const [showSocial, setShowSocial] = useState(false);
  const [allowMessage, setAllowMessage] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [wechat, setWechat] = useState('');
  const [weibo, setWeibo] = useState('');
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');

  // Original values for change detection (all fields)
  const [original, setOriginal] = useState({
    nickname: '', bio: '', birthday: '', gender: '',
    interests: [] as string[], wechat: '', weibo: '', github: '', linkedin: '',
    showProgress: true, showSocial: false, allowMessage: true,
  });

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    try {
      setIsLoading(true);
      const resp = await apiClient.getProfileOverview();
      const u = resp.user || {};
      const n = u.nickname || '';
      const b = u.bio || '';
      const bd = u.birthday || '';
      const g = u.gender || '';
      const intList = u.interests ? u.interests.split(',').filter(Boolean) : [];
      setNickname(n);
      setBio(b);
      setBirthday(bd);
      setGender(g);
      setInterests(intList);
      setWechat(u.wechat || '');
      setWeibo(u.weibo || '');
      setGithub(u.github || '');
      setLinkedin(u.linkedin || '');
      setShowProgress(u.show_progress ?? true);
      setShowSocial(u.show_social ?? false);
      setAllowMessage(u.allow_message ?? true);
      setOriginal({
        nickname: n, bio: b, birthday: bd, gender: g,
        interests: intList, wechat: u.wechat || '', weibo: u.weibo || '', github: u.github || '', linkedin: u.linkedin || '',
        showProgress: u.show_progress ?? true, showSocial: u.show_social ?? false, allowMessage: u.allow_message ?? true,
      });
    } catch (e) {
      showError(e);
    } finally {
      setIsLoading(false);
    }
  }

  // Change detection: all fields
  useEffect(() => {
    const changed = nickname !== original.nickname || bio !== original.bio ||
      birthday !== original.birthday || gender !== original.gender ||
      JSON.stringify(interests) !== JSON.stringify(original.interests) ||
      wechat !== original.wechat || weibo !== original.weibo ||
      github !== original.github || linkedin !== original.linkedin ||
      showProgress !== original.showProgress || showSocial !== original.showSocial ||
      allowMessage !== original.allowMessage;
    setHasChanges(changed);
  }, [nickname, bio, birthday, gender, interests, wechat, weibo, github, linkedin, showProgress, showSocial, allowMessage, original]);

  // Auto-save with refs to avoid stale closure
  const savingRef = useRef(false);
  const hasChangesRef = useRef(false);
  const originalRef = useRef(original);
  useEffect(() => { hasChangesRef.current = hasChanges; }, [hasChanges]);
  useEffect(() => { originalRef.current = original; }, [original]);

  useEffect(() => {
    if (!hasChanges) return;
    const timer = setTimeout(async () => {
      if (!hasChangesRef.current || savingRef.current) return;
      if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
        showError(t('profile.birthdayInvalid'));
        return;
      }
      if (birthday) {
        const d = new Date(birthday);
        if (isNaN(d.getTime())) { showError(t('profile.birthdayInvalidDate')); return; }
      }
      savingRef.current = true;
      setSaving(true);
      try {
        const orig = originalRef.current;
        const data: Record<string, string | boolean | null> = {};
        if (nickname !== orig.nickname) data.nickname = nickname || null;
        if (bio !== orig.bio) data.bio = bio || null;
        if (birthday !== orig.birthday) data.birthday = birthday || null;
        if (gender !== orig.gender) data.gender = gender || null;
        if (JSON.stringify(interests) !== JSON.stringify(orig.interests)) data.interests = interests.join(',');
        if (wechat !== orig.wechat) data.wechat = wechat || '';
        if (weibo !== orig.weibo) data.weibo = weibo || '';
        if (github !== orig.github) data.github = github || '';
        if (linkedin !== orig.linkedin) data.linkedin = linkedin || '';
        if (showProgress !== orig.showProgress) data.show_progress = showProgress;
        if (showSocial !== orig.showSocial) data.show_social = showSocial;
        if (allowMessage !== orig.allowMessage) data.allow_message = allowMessage;

        await apiClient.updateUser(data);
        setOriginal({
          nickname, bio, birthday, gender,
          interests: [...interests], wechat, weibo, github, linkedin,
          showProgress, showSocial, allowMessage,
        });
        setHasChanges(false);
        haptics.light();
      } catch (e: any) {
        showError(e);
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [nickname, bio, birthday, gender, interests, wechat, weibo, github, linkedin, showProgress, showSocial, allowMessage]);

  // Logout: 2-step confirm
  function handleLogout() {
    haptics.medium();
    confirmAction(t('profile.logout'), t('profile.logoutConfirm'), () => {
      confirmAction(t('common.confirm'), t('profile.logoutTwice'), async () => {
        try {
          await logout();
          router.dismissAll();
          router.replace('/auth/login');
        } catch (e) { showError(e); }
      }, t('profile.logoutConfirmExit'));
    }, t('profile.logoutStep1'));
  }

  function handleChangePassword() {
    if (!oldPwd || !newPwd || !confirmPwd) {
      showError(t('profile.allFieldsRequired'));
      return;
    }
    if (newPwd.length < 6) {
      showError(t('profile.passwordMinLength'));
      return;
    }
    if (newPwd !== confirmPwd) {
      showError(t('profile.passwordMismatch'));
      return;
    }
    confirmAction(t('profile.changePassword'), t('profile.changePasswordConfirm'), async () => {
      try {
        await apiClient.changePassword(oldPwd, newPwd);
        setShowChangePwd(false);
        setOldPwd('');
        setNewPwd('');
        setConfirmPwd('');
        showError(t('profile.passwordChanged'));
      } catch (e) { showError(e); }
    });
  }

  // Delete account: 2-step confirm
  function handleDeleteAccount() {
    haptics.medium();
    confirmAction(t('profile.deleteAccount'), t('profile.deleteAccountConfirm'), () => {
      confirmAction(t('common.confirm'), t('profile.deleteFinal'), async () => {
        try {
          await apiClient.deleteAccount();
          await logout();
          router.dismissAll();
          router.replace('/auth/login');
        } catch (e) { showError(e); }
      }, t('profile.deletePermanently'), t('common.back'), true);
    }, t('profile.deleteContinue'), t('common.cancel'), true);
  }

  function toggleInterest(tag: string) {
    haptics.light();
    setInterests(prev =>
      prev.includes(tag) ? prev.filter(i => i !== tag) : [...prev, tag]
    );
  }

  if (isLoading) {
    return (
      <View style={[S.container, { paddingTop: insets.top }]}>
        <View style={S.navBar}>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS === 'web') {
                window.history.back();
              } else {
                router.back();
              }
            }}
            style={S.navBack}
          >
            <Ionicons name="chevron-back" size={24} color={C.accent} />
            <Text style={S.navBackText}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={S.navTitle}>{t('profile.edit')}</Text>
          <View style={{ width: 18 }} />
        </View>
        <View style={S.loadingWrap}>
          <Text style={{ color: C.muted }}>{t('common.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      {/* Nav Bar */}
      <View style={S.navBar}>
        <TouchableOpacity
          onPress={() => goBack()}
          style={S.navBack}
        >
          <Ionicons name="chevron-back" size={24} color={C.accent} />
          <Text style={S.navBackText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={S.navTitle}>{t('profile.edit')}</Text>
        {saving && <Text style={S.navStatus}>{t('profile.saving')}</Text>}
        {!saving && hasChanges && <Text style={[S.navStatus, { color: C.accent }]}>{t('profile.hasChanges')}</Text>}
        {!saving && !hasChanges && original.nickname && <Ionicons name="checkmark-circle" size={18} color="#34c759" />}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView style={S.scrollView} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Avatar Section */}
          <View style={S.avatarSection}>
            <View style={S.avatarRow}>
              <View style={S.avatarCircle}>
                <Text style={S.avatarText}>{(nickname || t('profile.me')).charAt(0)}</Text>
              </View>
              <View style={S.avatarRight}>
                <TouchableOpacity style={S.avatarHintWrap} onPress={() => showError(t('profile.changeAvatarSoon'))}>
                  <Text style={S.avatarHint}>{t('profile.changeAvatar')}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={S.changePwdBtn} onPress={() => setShowChangePwd(true)} activeOpacity={0.7}>
                    <Ionicons name="key-outline" size={14} color={C.accent} />
                    <Text style={S.changePwdLabel}>{t('profile.passwordShort')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.deleteIconBtn} onPress={handleDeleteAccount} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={14} color={C.danger} />
                    <Text style={S.deleteIconLabel}>{t('profile.deleteShort')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Basic Info */}
          <Text style={S.sectionTitle}>{t('profile.nickname')}</Text>
          <View style={S.formCard}>
            <View style={S.formRow}>
              <Text style={S.formLabel}>{t('profile.nickname')}</Text>
              <TextInput
                style={S.formInput}
                value={nickname}
                onChangeText={setNickname}
                placeholder={t("profile.nicknamePlaceholder")}
                maxLength={20}
                placeholderTextColor={C.muted}
              />
            </View>

            {/* Bio */}
            <View style={S.bioRow}>
              <View style={S.bioHeader}>
                <Text style={S.formLabel}>{t('profile.bio')}</Text>
                <Text style={S.bioCount}>{bio.length}/100</Text>
              </View>
              <TextInput
                style={S.bioInput}
                value={bio}
                onChangeText={setBio}
                placeholder={t("profile.bioPlaceholder")}
                maxLength={100}
                multiline
                numberOfLines={3}
                placeholderTextColor={C.muted}
                textAlignVertical="top"
              />
            </View>

            {/* Birthday */}
            {Platform.OS === 'web' ? (
              <View style={S.formRow}>
                <Text style={S.formLabel}>{t('profile.birthday')}</Text>
                <TextInput
                  style={S.formInput}
                  value={birthday}
                  onChangeText={setBirthday}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                />
              </View>
            ) : (
              <TouchableOpacity
                style={S.formRow}
                onPress={() => { haptics.light(); setShowDatePicker(true); }}
                activeOpacity={0.6}
              >
                <Text style={S.formLabel}>{t('profile.birthday')}</Text>
                <Text style={[S.formInput, { textAlign: 'right' }, birthday ? { color: C.fg } : { color: C.muted }]}>
                  {birthday || t('profile.birthdayPlaceholder')}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={C.muted} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}
            {Platform.OS !== 'web' && showDatePicker && (
              <DateTimePicker
                value={birthday ? new Date(birthday + 'T00:00:00') : new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (event.type === 'set' && selectedDate) {
                    haptics.light();
                    setBirthday(selectedDate.toISOString().split('T')[0]);
                  }
                }}
                locale="zh-CN"
              />
            )}

            {/* Gender */}
            <View style={[S.formRow, { borderBottomWidth: 0 }]}>
              <Text style={S.formLabel}>{t('profile.gender')}</Text>
            </View>
            <View style={S.genderRow}>
              {[
                { value: 'male', label: t('profile.genderMale') },
                { value: 'female', label: t('profile.genderFemale') },
                { value: 'other', label: t('profile.genderOther') },
              ].map(g => (
                <TouchableOpacity
                  key={g.value}
                  style={[S.genderOption, gender === g.value && S.genderSelected]}
                  onPress={() => { haptics.light(); setGender(g.value); }}
                  activeOpacity={0.7}
                >
                  <Text style={[S.genderText, gender === g.value && S.genderTextSelected]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Learning Interests */}
          <Text style={S.sectionTitle}>{t('profile.interests')}</Text>
          <View style={S.formCard}>
            <View style={S.interestsGrid}>
              {INTERESTS.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[S.interestTag, interests.includes(tag) && S.interestSelected]}
                  onPress={() => toggleInterest(tag)}
                  activeOpacity={0.7}
                >
                  <Text style={[S.interestText, interests.includes(tag) && S.interestTextSelected]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Social Links */}
          <Text style={S.sectionTitle}>{t('profile.socialLinks')}</Text>
          <View style={S.formCard}>
            <View style={S.socialRow}>
              <View style={[S.socialIcon, { backgroundColor: '#e8f5e8' }]}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#2aa02a" />
              </View>
              <TextInput
                style={S.socialInput}
                value={wechat}
                onChangeText={setWechat}
                placeholder={t("profile.wechat")}
                placeholderTextColor={C.muted}
              />
            </View>
            <View style={S.socialRow}>
              <View style={[S.socialIcon, { backgroundColor: '#fde8e0' }]}>
                <Ionicons name="globe-outline" size={18} color="#c45a1a" />
              </View>
              <TextInput
                style={S.socialInput}
                value={weibo}
                onChangeText={setWeibo}
                placeholder={t("profile.weibo")}
                placeholderTextColor={C.muted}
              />
            </View>
            <View style={S.socialRow}>
              <View style={[S.socialIcon, { backgroundColor: '#e8e8e8' }]}>
                <Ionicons name="logo-github" size={18} color="#333" />
              </View>
              <TextInput
                style={S.socialInput}
                value={github}
                onChangeText={setGithub}
                placeholder={t("profile.github")}
                placeholderTextColor={C.muted}
              />
            </View>
            <View style={[S.socialRow, { borderBottomWidth: 0 }]}>
              <View style={[S.socialIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="logo-linkedin" size={18} color="#2563eb" />
              </View>
              <TextInput
                style={S.socialInput}
                value={linkedin}
                onChangeText={setLinkedin}
                placeholder={t("profile.linkedin")}
                placeholderTextColor={C.muted}
              />
            </View>
          </View>

          {/* Privacy Settings */}
          <Text style={S.sectionTitle}>{t('profile.privacySettings')}</Text>
          <View style={S.formCard}>
            <View style={S.privacyRow}>
              <View style={S.privacyInfo}>
                <Text style={S.privacyLabel}>{t('profile.showProgress')}</Text>
                <Text style={S.privacyDesc}>{t('profile.showProgressDesc')}</Text>
              </View>
              <Switch
                value={showProgress}
                onValueChange={v => { haptics.light(); setShowProgress(v); }}
                trackColor={{ false: C.border, true: C.accent }}
                thumbColor="#fff"
              />
            </View>
            <View style={S.privacyRow}>
              <View style={S.privacyInfo}>
                <Text style={S.privacyLabel}>{t('profile.showSocial')}</Text>
                <Text style={S.privacyDesc}>{t('profile.showSocialDesc')}</Text>
              </View>
              <Switch
                value={showSocial}
                onValueChange={v => { haptics.light(); setShowSocial(v); }}
                trackColor={{ false: C.border, true: C.accent }}
                thumbColor="#fff"
              />
            </View>
            <View style={[S.privacyRow, { borderBottomWidth: 0 }]}>
              <View style={S.privacyInfo}>
                <Text style={S.privacyLabel}>{t('profile.allowMessage')}</Text>
                <Text style={S.privacyDesc}>{t('profile.allowMessageDesc')}</Text>
              </View>
              <Switch
                value={allowMessage}
                onValueChange={v => { haptics.light(); setAllowMessage(v); }}
                trackColor={{ false: C.border, true: C.accent }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Language */}
          <Text style={S.sectionTitle}>{t('settings.language')}</Text>
          <View style={S.formCard}>
            <View style={[S.formRow, { borderBottomWidth: 0 }]}>
              <Text style={S.formLabel}>{t('profile.language')}</Text>
              <View style={S.langRow}>
                <TouchableOpacity
                  style={[S.langOption, locale === 'zh-CN' && S.langSelected]}
                  onPress={() => setLocale('zh-CN')}
                  activeOpacity={0.7}
                >
                  <Text style={[S.langText, locale === 'zh-CN' && S.langTextSelected]}>中文</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.langOption, locale === 'en-US' && S.langSelected]}
                  onPress={() => setLocale('en-US')}
                  activeOpacity={0.7}
                >
                  <Text style={[S.langText, locale === 'en-US' && S.langTextSelected]}>English</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={S.logoutSection}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color={C.accent} />
            <Text style={S.logoutText}>{t('profile.logout')}</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Change Password Modal */}
      <Modal visible={showChangePwd} transparent animationType="fade" onRequestClose={() => setShowChangePwd(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>{t('profile.changePassword')}</Text>
            <TextInput
              style={S.modalInput}
              value={oldPwd}
              onChangeText={setOldPwd}
              placeholder={t("profile.oldPassword")}
              placeholderTextColor={C.muted}
              secureTextEntry
            />
            <TextInput
              style={S.modalInput}
              value={newPwd}
              onChangeText={setNewPwd}
              placeholder={t("profile.newPassword")}
              placeholderTextColor={C.muted}
              secureTextEntry
            />
            <TextInput
              style={S.modalInput}
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              placeholder={t("profile.confirmPassword")}
              placeholderTextColor={C.muted}
              secureTextEntry
            />
            <View style={S.modalBtnRow}>
              <TouchableOpacity style={S.modalCancelBtn} onPress={() => { setShowChangePwd(false); setOldPwd(''); setNewPwd(''); setConfirmPwd(''); }} activeOpacity={0.6}>
                <Text style={S.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.modalConfirmBtn} onPress={handleChangePassword} activeOpacity={0.6}>
                <Text style={S.modalConfirmText}>{t('profile.confirmChange')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bgSolid,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navBack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navBackText: {
    fontSize: 17,
    color: C.accent,
    marginLeft: 2,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: C.fg,
    letterSpacing: -0.015,
  },
  navStatus: {
    fontSize: 14,
    color: C.muted,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },

  // Avatar
  avatarSection: {
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  avatarRight: {
    flex: 1,
    gap: 6,
  },
  avatarHintWrap: {},
  avatarHint: {
    fontSize: 12,
    color: C.muted,
  },
  deleteIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 0.5,
    borderColor: '#fecaca',
  },
  deleteIconLabel: {
    fontSize: 11,
    color: C.danger,
  },

  // Section Title
  sectionTitle: {
    fontSize: 13,
    color: C.muted,
    fontWeight: '500',
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.02,
  },

  // Form Card
  formCard: {
    marginHorizontal: 16,
    backgroundColor: C.surfaceSolid,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: C.border,
    overflow: 'hidden',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  formLabel: {
    fontSize: 15,
    color: C.fg,
    minWidth: 56,
  },
  formInput: {
    flex: 1,
    fontSize: 15,
    color: C.fg,
    textAlign: 'right',
    padding: 0,
  },

  // Bio
  bioRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  bioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bioCount: {
    fontSize: 12,
    color: C.muted,
  },
  bioInput: {
    fontSize: 14,
    color: C.fg,
    lineHeight: 21,
    minHeight: 60,
    padding: 0,
  },

  // Gender
  genderRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  genderOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.bgSolid,
    borderWidth: 1,
    borderColor: C.border,
  },
  genderSelected: {
    backgroundColor: C.accentLight,
    borderColor: C.accent,
  },
  genderText: {
    fontSize: 14,
    color: C.fg,
  },
  genderTextSelected: {
    color: C.accent,
  },

  // Interests
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
  },
  interestTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.bgSolid,
    borderWidth: 1,
    borderColor: C.border,
  },
  interestSelected: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  interestText: {
    fontSize: 13,
    color: C.fg,
  },
  interestTextSelected: {
    color: '#fff',
  },

  // Privacy
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },

  // Social
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  socialIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialInput: {
    flex: 1,
    fontSize: 15,
    color: C.fg,
    padding: 0,
  },
  privacyInfo: {
    flex: 1,
    marginRight: 12,
  },
  privacyLabel: {
    fontSize: 15,
    color: C.fg,
    marginBottom: 2,
  },
  privacyDesc: {
    fontSize: 12,
    color: C.muted,
  },

  // Logout
  logoutSection: {
    marginTop: 28,
    marginHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.surfaceSolid,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  logoutText: {
    fontSize: 16,
    color: C.accent,
    fontWeight: '500',
  },

  // Change Password Button
  changePwdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f0f7ff',
    borderWidth: 0.5,
    borderColor: '#bfdbfe',
  },
  changePwdLabel: {
    fontSize: 11,
    color: C.accent,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    width: Math.min(Dimensions.get('window').width - 48, 340),
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 10,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  modalCancelText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: C.accent,
  },
  modalConfirmText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },

  // Language
  langRow: {
    flexDirection: 'row',
    gap: 8,
  },
  langOption: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: C.border,
  },
  langSelected: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  langText: {
    fontSize: 14,
    color: C.muted,
  },
  langTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});