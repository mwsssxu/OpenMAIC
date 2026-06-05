import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Platform, KeyboardAvoidingView } from 'react-native';
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

const GENDERS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
];

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
  const { t } = useI18n();
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
        showError('生日格式不正确，请输入 YYYY-MM-DD');
        return;
      }
      if (birthday) {
        const d = new Date(birthday);
        if (isNaN(d.getTime())) { showError('生日日期无效'); return; }
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
    confirmAction('退出登录', '确定要退出当前账号吗？', () => {
      confirmAction('再次确认', '退出登录后需要重新登录才能使用', async () => {
        try {
          await logout();
          router.dismissAll();
          router.replace('/auth/login');
        } catch (e) { showError(e); }
      }, '确认退出');
    }, '退出');
  }

  // Delete account: 2-step confirm
  function handleDeleteAccount() {
    haptics.medium();
    confirmAction('注销账户', '注销后所有数据将被永久删除，无法恢复。', () => {
      confirmAction('最终确认', '这是最后一次确认，注销后无法撤销。', () => {
        showError('注销账户功能尚未实现');
      }, '永久注销');
    }, '继续');
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
            <Text style={S.navBackText}>返回</Text>
          </TouchableOpacity>
          <Text style={S.navTitle}>编辑资料</Text>
          <View style={{ width: 18 }} />
        </View>
        <View style={S.loadingWrap}>
          <Text style={{ color: C.muted }}>加载中...</Text>
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
          <Text style={S.navBackText}>返回</Text>
        </TouchableOpacity>
        <Text style={S.navTitle}>编辑资料</Text>
        {saving && <Text style={S.navStatus}>保存中...</Text>}
        {!saving && hasChanges && <Text style={[S.navStatus, { color: C.accent }]}>有修改</Text>}
        {!saving && !hasChanges && original.nickname && <Ionicons name="checkmark-circle" size={18} color="#34c759" />}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView style={S.scrollView} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Avatar Section with logout + delete account */}
          <View style={S.avatarSection}>
            <View style={S.avatarRow}>
              <View style={S.avatarCircle}>
                <Text style={S.avatarText}>{(nickname || '我').charAt(0)}</Text>
              </View>
              <View style={S.avatarActions}>
                <TouchableOpacity onPress={handleLogout} style={S.avatarActionBtn}>
                  <Ionicons name="log-out-outline" size={18} color={C.muted} />
                  <Text style={S.avatarActionText}>退出登录</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteAccount} style={S.deleteIconBtn}>
                  <Ionicons name="trash-outline" size={16} color={C.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Basic Info */}
          <Text style={S.sectionTitle}>基本信息</Text>
          <View style={S.formCard}>
            <View style={S.formRow}>
              <Text style={S.formLabel}>昵称</Text>
              <TextInput
                style={S.formInput}
                value={nickname}
                onChangeText={setNickname}
                placeholder="输入昵称"
                maxLength={20}
                placeholderTextColor={C.muted}
              />
            </View>

            {/* Bio */}
            <View style={S.bioRow}>
              <View style={S.bioHeader}>
                <Text style={S.formLabel}>简介</Text>
                <Text style={S.bioCount}>{bio.length}/100</Text>
              </View>
              <TextInput
                style={S.bioInput}
                value={bio}
                onChangeText={setBio}
                placeholder="介绍一下自己..."
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
                <Text style={S.formLabel}>生日</Text>
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
                <Text style={S.formLabel}>生日</Text>
                <Text style={[S.formInput, { textAlign: 'right' }, birthday ? { color: C.fg } : { color: C.muted }]}>
                  {birthday || '选择日期'}
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
              <Text style={S.formLabel}>性别</Text>
            </View>
            <View style={S.genderRow}>
              {GENDERS.map(g => (
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
          <Text style={S.sectionTitle}>学习兴趣</Text>
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
          <Text style={S.sectionTitle}>社交账号</Text>
          <View style={S.formCard}>
            <View style={S.socialRow}>
              <View style={[S.socialIcon, { backgroundColor: '#e8f5e8' }]}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#2aa02a" />
              </View>
              <TextInput
                style={S.socialInput}
                value={wechat}
                onChangeText={setWechat}
                placeholder="微信号"
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
                placeholder="微博账号"
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
                placeholder="GitHub 用户名"
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
                placeholder="LinkedIn 链接"
                placeholderTextColor={C.muted}
              />
            </View>
          </View>

          {/* Privacy Settings */}
          <Text style={S.sectionTitle}>隐私设置</Text>
          <View style={S.formCard}>
            <View style={S.privacyRow}>
              <View style={S.privacyInfo}>
                <Text style={S.privacyLabel}>公开学习进度</Text>
                <Text style={S.privacyDesc}>其他用户可以看到你的学习进度</Text>
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
                <Text style={S.privacyLabel}>展示社交账号</Text>
                <Text style={S.privacyDesc}>在个人主页显示绑定的社交账号</Text>
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
                <Text style={S.privacyLabel}>接收陌生人消息</Text>
                <Text style={S.privacyDesc}>允许未关注的人发送私信</Text>
              </View>
              <Switch
                value={allowMessage}
                onValueChange={v => { haptics.light(); setAllowMessage(v); }}
                trackColor={{ false: C.border, true: C.accent }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  avatarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.surfaceSolid,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  avatarActionText: {
    fontSize: 13,
    color: C.muted,
  },
  deleteIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 0.5,
    borderColor: '#fecaca',
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
});
