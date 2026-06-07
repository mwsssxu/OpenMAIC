import { useState, useEffect } from 'react';
import { showError } from '@/lib/utils/error-toast';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import TabPageWrapper from '@/lib/components/TabPageWrapper';

interface Enterprise {
  has_enterprise: boolean;
  enterprise_id?: string;
  name?: string;
  industry?: string;
  plan_type?: string;
  role?: string;
  member_count?: number;
  member_limit?: number;
}

interface Member {
  member_id: string;
  nickname: string;
  email: string;
  role: string;
  joined_at: string;
}

interface Stats {
  member_count: number;
  active_members: number;
  course_completions: number;
  total_learning_hours: number;
}

export default function EnterpriseScreen() {
  const { onSuccess, onError } = useFeedback();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', industry: '', size: 'small' });

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');

  useEffect(() => {
    loadToken();
  }, []);

  useEffect(() => {
    if (token) loadEnterprise();
  }, [token]);

  async function loadToken() {
    const t = await AsyncStorage.getItem('auth_token');
    apiClient.setToken(t);
    setToken(t);
  }

  async function loadEnterprise() {
    try {
      const data = await apiClient.getMyEnterprise();
      setEnterprise(data);
      setLoading(false);
      if (data.has_enterprise && data.enterprise_id) {
        loadMembers(data.enterprise_id);
        loadStats(data.enterprise_id);
      }
    } catch (e) {
      showError(e);
      setLoading(false);
    }
  }

  async function loadMembers(enterpriseId: string) {
    try {
      const data = await apiClient.getEnterpriseMembers(enterpriseId);
      setMembers(data.members || []);
    } catch (e) { showError(e); }
  }

  async function loadStats(enterpriseId: string) {
    try {
      const data = await apiClient.getEnterpriseStats(enterpriseId);
      setStats(data);
    } catch (e) { showError(e); }
  }

  async function createEnterprise() {
    try {
      const data = await apiClient.createEnterprise(
        createForm.name,
        createForm.industry,
        createForm.size
      );
      setEnterprise({
        has_enterprise: true,
        enterprise_id: data.enterprise_id,
        name: data.name,
        role: 'admin'
      });
      onSuccess();
      setShowCreate(false);
      loadMembers(data.enterprise_id);
      loadStats(data.enterprise_id);
    } catch (e: any) {
      onError();
      showError(e.message || '创建失败');
    }
  }

  async function inviteMembers() {
    if (!enterprise?.enterprise_id) return;
    const emails = inviteEmails.split(',').map(e => e.trim()).filter(e => e);
    try {
      const data = await apiClient.inviteEnterpriseMembers(enterprise.enterprise_id, emails);
      onSuccess();
      showError(`已邀请 ${data.total_invited} 人`);
      setShowInvite(false);
      setInviteEmails('');
      loadMembers(enterprise.enterprise_id);
    } catch (e: any) {
      onError();
      showError(e.message || '邀请失败');
    }
  }

  if (loading) {
    return (
      <TabPageWrapper hasHeader>
      <View style={styles.container}>
        {/* 页面头部 */}
        <View style={styles.pageHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={Colors.primary.main} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>企业服务</Text>
          <View style={styles.pageHeaderActions} />
        </View>
        <View style={styles.center}>
          <Text>加载中...</Text>
        </View>
      </View>
    </TabPageWrapper>
    );
  }

  if (showCreate) {
    return (
      <TabPageWrapper hasHeader>
      <View style={styles.container}>
        {/* 页面头部 */}
        <View style={styles.pageHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setShowCreate(false)} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={Colors.primary.main} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>创建企业账户</Text>
          <View style={styles.pageHeaderActions} />
        </View>
        <ScrollView style={styles.content}>
          <Text style={styles.title}>创建企业账户</Text>
          <TextInput
            style={styles.input}
            placeholder="企业名称"
            value={createForm.name}
            onChangeText={t => setCreateForm(prev => ({ ...prev, name: t }))}
          />
          <TextInput
            style={styles.input}
            placeholder="所属行业"
            value={createForm.industry}
            onChangeText={t => setCreateForm(prev => ({ ...prev, industry: t }))}
          />
          <Text style={styles.label}>企业规模</Text>
          <View style={styles.sizeOptions}>
            {['small', 'medium', 'large'].map(size => (
              <TouchableOpacity
                key={size}
                style={[styles.sizeOption, createForm.size === size && styles.sizeOptionSelected]}
                onPress={() => setCreateForm(prev => ({ ...prev, size }))}
              >
                <Text>{size === 'small' ? '小型' : size === 'medium' ? '中型' : '大型'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.button} onPress={createEnterprise}>
            <Text style={styles.buttonText}>创建</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonOutline} onPress={() => setShowCreate(false)}>
            <Text style={styles.buttonOutlineText}>取消</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </TabPageWrapper>
    );
  }

  if (!enterprise?.has_enterprise) {
    return (
      <TabPageWrapper hasHeader>
      <View style={styles.container}>
        {/* 页面头部 */}
        <View style={styles.pageHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={Colors.primary.main} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>企业服务</Text>
          <View style={styles.pageHeaderActions} />
        </View>
        <View style={styles.center}>
          <Text style={styles.noEnterpriseTitle}>企业功能</Text>
          <Text style={styles.noEnterpriseDesc}>创建企业账户，管理团队学习</Text>
          <TouchableOpacity style={styles.button} onPress={() => setShowCreate(true)}>
            <Text style={styles.buttonText}>创建企业账户</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TabPageWrapper>
    );
  }

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
      {/* 页面头部 */}
      <View style={styles.pageHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.primary.main} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>企业服务</Text>
        <View style={styles.pageHeaderActions} />
      </View>
      <View style={styles.header}>
        <Text style={styles.enterpriseName}>{enterprise?.name}</Text>
        <Text style={styles.enterpriseInfo}>
          {enterprise?.plan_type}版 | 角色: {enterprise?.role}
        </Text>
        {enterprise?.role === 'admin' && (
          <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInvite(true)}>
            <Text style={styles.inviteButtonText}>邀请成员</Text>
          </TouchableOpacity>
        )}
      </View>

      {showInvite && (
        <View style={styles.inviteModal}>
          <TextInput
            style={styles.input}
            placeholder="输入邮箱（多个用逗号分隔）"
            value={inviteEmails}
            onChangeText={setInviteEmails}
          />
          <TouchableOpacity style={styles.button} onPress={inviteMembers}>
            <Text style={styles.buttonText}>发送邀请</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonOutline} onPress={() => setShowInvite(false)}>
            <Text style={styles.buttonOutlineText}>取消</Text>
          </TouchableOpacity>
        </View>
      )}

      {stats && (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.member_count}</Text>
            <Text style={styles.statLabel}>成员</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.active_members}</Text>
            <Text style={styles.statLabel}>活跃</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.course_completions}</Text>
            <Text style={styles.statLabel}>完成</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_learning_hours}</Text>
            <Text style={styles.statLabel}>小时</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>团队成员 ({members.length}/{enterprise?.member_limit})</Text>
        {members.map(m => (
          <View key={m.member_id} style={styles.memberCard}>
            <Text style={styles.memberName}>{m.nickname || m.email}</Text>
            <Text style={styles.memberEmail}>{m.email}</Text>
            <Text style={styles.memberRole}>{m.role}</Text>
          </View>
        ))}
      </ScrollView>
      </View>
    </TabPageWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  content: { flex: 1, padding: Spacing.md },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d8d8d8',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.neutral.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  pageTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral.textPrimary, letterSpacing: -0.3, flex: 1 },
  pageHeaderActions: { flexDirection: 'row', gap: Spacing.xs },
  header: {
    padding: Spacing.md,
    backgroundColor: Colors.neutral.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: Spacing.md, color: Colors.neutral.textPrimary },
  enterpriseName: { fontSize: 20, fontWeight: 'bold', color: Colors.neutral.textPrimary },
  enterpriseInfo: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  inviteButton: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.primary.main,
    borderRadius: Rounded.md,
    alignItems: 'center',
  },
  inviteButtonText: { color: Colors.neutral.white, fontSize: 14, fontWeight: '600' },
  inviteModal: {
    padding: Spacing.md,
    backgroundColor: Colors.neutral.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    backgroundColor: Colors.neutral.backgroundAlt,
    padding: Spacing.sm,
    borderRadius: Rounded.md,
    marginBottom: Spacing.sm,
    color: Colors.neutral.textPrimary,
    fontSize: 16,
  },
  label: { fontSize: 14, color: Colors.neutral.textSecondary, marginBottom: Spacing.sm },
  sizeOptions: { flexDirection: 'row', marginBottom: Spacing.md },
  sizeOption: { padding: Spacing.sm, backgroundColor: Colors.neutral.backgroundAlt, borderRadius: Rounded.sm, marginRight: Spacing.sm },
  sizeOptionSelected: { backgroundColor: Colors.primary.main },
  button: {
    backgroundColor: Colors.primary.main,
    padding: Spacing.md,
    borderRadius: Rounded.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  buttonOutline: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary.main,
  },
  buttonText: { fontSize: 16, color: Colors.neutral.white, fontWeight: '600' },
  buttonOutlineText: { fontSize: 16, color: Colors.primary.main, fontWeight: '600' },
  statsGrid: {
    flexDirection: 'row',
    padding: Spacing.md,
    justifyContent: 'space-between',
    backgroundColor: Colors.neutral.card,
    margin: Spacing.sm,
    borderRadius: Rounded.lg,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  statCard: {
    backgroundColor: Colors.neutral.backgroundAlt,
    padding: Spacing.md,
    borderRadius: Rounded.md,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  statValue: { fontSize: 24, fontWeight: 'bold', color: Colors.primary.main },
  statLabel: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: Spacing.sm, color: Colors.neutral.textPrimary },
  memberCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  memberName: { fontSize: 16, fontWeight: 'bold', color: Colors.neutral.textPrimary },
  memberEmail: { fontSize: 12, color: Colors.neutral.textSecondary },
  memberRole: { fontSize: 12, color: Colors.primary.main, marginTop: Spacing.xs, fontWeight: '500' },
  noEnterpriseTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: Spacing.sm, color: Colors.neutral.textPrimary },
  noEnterpriseDesc: { fontSize: 14, color: Colors.neutral.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
});
