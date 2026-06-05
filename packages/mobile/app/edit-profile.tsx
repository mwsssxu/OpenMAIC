import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { useI18n } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

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
  const { user } = useAuth();
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

  // Original values for change detection
  const [original, setOriginal] = useState({ nickname: '', bio: '', birthday: '', gender: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setIsLoading(true);
      const resp = await apiClient.getProfileOverview();
      const u = resp.user || {};
      const n = u.nickname || '';
      const b = u.bio || '';
      const bd = u.birthday || '';
      const g = u.gender || '';
      setNickname(n);
      setBio(b);
      setBirthday(bd);
      setGender(g);
      setOriginal({ nickname: n, bio: b, birthday: bd, gender: g });
    } catch (e) {
      console.error('Load profile error:', e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const changed = nickname !== original.nickname || bio !== original.bio ||
      birthday !== original.birthday || gender !== original.gender;
    setHasChanges(changed);
  }, [nickname, bio, birthday, gender, original]);

  async function handleSave() {
    if (!hasChanges || saving) return;
    haptics.light();
    setSaving(true);
    try {
      const data: Record<string, string | null> = {};
      if (nickname !== original.nickname) data.nickname = nickname || null;
      if (bio !== original.bio) data.bio = bio || null;
      if (birthday !== original.birthday) {
        data.birthday = birthday || null;
      }
      if (gender !== original.gender) data.gender = gender || null;

      await apiClient.updateUser(data);
      setOriginal({ nickname, bio, birthday, gender });
      setHasChanges(false);
      onSuccess(t('profile.profileUpdated') || '已保存');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || '请检查网络后重试';
      Alert.alert('保存失败', msg);
    } finally {
      setSaving(false);
    }
  }

  function onDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    setShowDatePicker(Platform.OS === 'ios'); // iOS 需要手动关闭
    if (event.type === 'set' && selectedDate) {
      haptics.light();
      const iso = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      setBirthday(iso);
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  }

  function toggleInterest(tag: string) {
    haptics.light();
    setInterests(prev =>
      prev.includes(tag) ? prev.filter(i => i !== tag) : [...prev, tag]
    );
    setHasChanges(true);
  }

  if (isLoading) {
    return (
      <View style={[S.container, { paddingTop: insets.top }]}>
        <View style={S.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={S.navBack}>
            <Ionicons name="chevron-back" size={24} color={C.accent} />
            <Text style={S.navBackText}>返回</Text>
          </TouchableOpacity>
          <Text style={S.navTitle}>编辑资料</Text>
          <Text style={[S.navSave, { color: C.muted }]}>保存</Text>
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
        <TouchableOpacity onPress={() => router.back()} style={S.navBack}>
          <Ionicons name="chevron-back" size={24} color={C.accent} />
          <Text style={S.navBackText}>返回</Text>
        </TouchableOpacity>
        <Text style={S.navTitle}>编辑资料</Text>
        <TouchableOpacity onPress={handleSave} disabled={!hasChanges || saving}>
          <Text style={[S.navSave, hasChanges && S.navSaveActive]}>
            {saving ? '保存中...' : '保存'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView style={S.scrollView} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Avatar Section */}
          <View style={S.avatarSection}>
            <View style={S.avatarCircle}>
              <Text style={S.avatarText}>{(nickname || '我').charAt(0)}</Text>
            </View>
            <TouchableOpacity style={S.avatarHintWrap}>
              <Text style={S.avatarHint}>点击更换头像</Text>
            </TouchableOpacity>
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
            {showDatePicker && (
              <DateTimePicker
                value={birthday ? new Date(birthday + 'T00:00:00') : new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={onDateChange}
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

          {/* Delete Account */}
          <TouchableOpacity
            style={S.deleteSection}
            onPress={() => {
              Alert.alert('注销账户', '确定要注销账户吗？此操作不可恢复。', [
                { text: '取消', style: 'cancel' },
                { text: '确定注销', style: 'destructive', onPress: () => {} },
              ]);
            }}
            activeOpacity={0.7}
          >
            <Text style={S.deleteText}>注销账户</Text>
          </TouchableOpacity>

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
  navSave: {
    fontSize: 17,
    fontWeight: '500',
    color: C.muted,
  },
  navSaveActive: {
    color: C.accent,
    fontWeight: '600',
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
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 44,
    fontWeight: '700',
    color: '#fff',
  },
  avatarHintWrap: {
    marginTop: 8,
  },
  avatarHint: {
    fontSize: 12,
    color: C.muted,
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

  // Delete
  deleteSection: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteText: {
    fontSize: 15,
    color: C.danger,
  },
});
