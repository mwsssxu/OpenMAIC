import { useState, useEffect, useCallback } from 'react';
import { showError, showSuccess, confirmAction } from '@/lib/utils/error-toast';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useGoBack } from '@/lib/utils/navigation';
import TabPageWrapper from '@/lib/components/TabPageWrapper';

// iOS 风格颜色系统
const iOSColors = {
  bgSolid: '#f5f3f2',
  surface: 'rgba(255, 255, 255, 0.55)',
  surfaceSolid: '#FFFFFF',
  fg: '#1a1a1a',
  muted: '#666666',
  border: 'rgba(230, 225, 220, 0.6)',
  accent: '#c45a1a',
  accentLight: '#fde8e0',
  secondary: '#1a8a8a',
  secondaryLight: '#e8f5f5',
};

// ==================== Types ====================

interface Enterprise {
  has_enterprise: boolean;
  enterprise_id?: string;
  name?: string;
  industry?: string;
  size?: string;
  plan_type?: string;
  role?: string;
  member_count?: number;
  member_limit?: number;
  course_limit?: number;
  storage_limit?: number;
}

interface Member {
  member_id: string;
  nickname: string;
  email: string;
  role: string;
  joined_at: string;
  avatar_url?: string;
}

interface Stats {
  member_count: number;
  active_members: number;
  course_completions: number;
  total_learning_hours: number;
}

interface Course {
  assignment_id: string;
  course_id: string;
  course_name: string;
  description: string;
  is_required: boolean;
  deadline: string | null;
  assigned_at: string;
  status: string;
}

interface LearningReport {
  overall_progress: number;
  members: Array<{
    user_id: string;
    nickname: string;
    courses_completed: number;
    total_courses: number;
    learning_hours: number;
    last_active: string;
  }>;
}

// ==================== Helpers ====================

const PLAN_MAP: Record<string, { label: string; color: string }> = {
  basic: { label: '基础版', color: Colors.neutral.textSecondary },
  pro: { label: '专业版', color: '#2563eb' },
  enterprise: { label: '企业版', color: '#7c3aed' },
};

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  owner: { label: '创建者', color: '#7c3aed' },
  admin: { label: '管理员', color: '#dc2626' },
  member: { label: '成员', color: '#16a34a' },
  viewer: { label: '查看者', color: '#6b7280' },
};

const SIZE_MAP: Record<string, string> = {
  small: '小型（<50人）',
  medium: '中型（50-200人）',
  large: '大型（200+人）',
};

// ==================== Main Screen ====================

export default function EnterpriseScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [report, setReport] = useState<LearningReport | null>(null);

  // Sub-views
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'courses' | 'report'>('overview');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', industry: '', size: 'small' });
  const [creating, setCreating] = useState(false);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviting, setInviting] = useState(false);

  // Role modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleMember, setRoleMember] = useState<Member | null>(null);
  const [selectedRole, setSelectedRole] = useState('member');

  useEffect(() => { loadEnterprise(); }, []);

  async function loadEnterprise() {
    try {
      const data = await apiClient.getMyEnterprise();
      setEnterprise(data);
      if (data.has_enterprise && data.enterprise_id) {
        await Promise.all([
          loadMembers(data.enterprise_id),
          loadStats(data.enterprise_id),
          loadCourses(data.enterprise_id),
        ]);
      }
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    if (!enterprise?.enterprise_id) return;
    setRefreshing(true);
    try {
      const eid = enterprise.enterprise_id;
      await Promise.all([
        loadEnterprise(),
        loadMembers(eid),
        loadStats(eid),
        loadCourses(eid),
        loadReport(eid),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function loadMembers(eid: string) {
    try {
      const data = await apiClient.getEnterpriseMembers(eid);
      setMembers(data.members || []);
    } catch (e) { /* silent */ }
  }

  async function loadStats(eid: string) {
    try {
      const data = await apiClient.getEnterpriseStats(eid);
      setStats(data);
    } catch (e) { /* silent */ }
  }

  async function loadCourses(eid: string) {
    try {
      const data = await apiClient.getEnterpriseCourses(eid);
      setCourses(data.courses || []);
    } catch (e) { /* silent */ }
  }

  async function loadReport(eid: string) {
    try {
      const data = await apiClient.getEnterpriseLearningReport(eid);
      setReport(data);
    } catch (e) { showError(e); }
  }

  // ==================== Actions ====================

  async function createEnterprise() {
    if (!createForm.name.trim()) {
      showError({ message: '请输入企业名称' });
      return;
    }
    setCreating(true);
    try {
      const data = await apiClient.createEnterprise(
        createForm.name.trim(),
        createForm.industry.trim() || undefined,
        createForm.size,
      );
      setEnterprise({
        has_enterprise: true,
        enterprise_id: data.enterprise_id,
        name: data.name,
        role: 'admin',
        plan_type: 'basic',
        member_count: 1,
      });
      setShowCreate(false);
      if (data.enterprise_id) {
        await Promise.all([
          loadMembers(data.enterprise_id),
          loadStats(data.enterprise_id),
          loadCourses(data.enterprise_id),
        ]);
      }
    } catch (e: any) {
      showError(e);
    } finally {
      setCreating(false);
    }
  }

  async function inviteMembers() {
    if (!enterprise?.enterprise_id) return;
    const emails = inviteEmails.split(/[,，\n]/).map(e => e.trim()).filter(e => e.includes('@'));
    if (emails.length === 0) {
      showError({ message: '请输入有效的邮箱地址' });
      return;
    }
    setInviting(true);
    try {
      const data = await apiClient.inviteEnterpriseMembers(enterprise.enterprise_id, emails);
      showSuccess(`已向 ${data.total_invited || emails.length} 人发送邀请`);
      setShowInvite(false);
      setInviteEmails('');
      loadMembers(enterprise.enterprise_id);
    } catch (e: any) {
      showError(e);
    } finally {
      setInviting(false);
    }
  }

  async function updateRole() {
    if (!enterprise?.enterprise_id || !roleMember) return;
    try {
      await apiClient.updateEnterpriseMemberRole(
        enterprise.enterprise_id,
        roleMember.member_id,
        selectedRole,
      );
      setShowRoleModal(false);
      setRoleMember(null);
      loadMembers(enterprise.enterprise_id);
    } catch (e: any) {
      showError(e);
    }
  }

  async function removeMember(member: Member) {
    if (!enterprise?.enterprise_id) return;
    confirmAction(
      '移除成员',
      `确定要将 ${member.nickname || member.email} 移出企业吗？`,
      async () => {
        try {
          await apiClient.removeEnterpriseMember(enterprise.enterprise_id!, member.member_id);
          loadMembers(enterprise.enterprise_id!);
        } catch (e: any) { showError(e); }
      },
    );
  }

  // ==================== Render Helpers ====================

  const isAdmin = enterprise?.role === 'admin';
  const planInfo = PLAN_MAP[enterprise?.plan_type || 'basic'];

  function StatCard({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string | number; label: string }) {
    return (
      <View style={s.statCard}>
        <Ionicons name={icon} size={20} color={Colors.primary.main} />
        <Text style={s.statValue}>{value}</Text>
        <Text style={s.statLabel}>{label}</Text>
      </View>
    );
  }

  function TabButton({ id, icon, label }: { id: typeof activeTab; icon: keyof typeof Ionicons.glyphMap; label: string }) {
    const active = activeTab === id;
    return (
      <TouchableOpacity
        style={[s.tabBtn, active && s.tabBtnActive]}
        onPress={() => {
          setActiveTab(id);
          if (id === 'report' && enterprise?.enterprise_id) loadReport(enterprise.enterprise_id);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name={icon} size={18} color={active ? Colors.primary.main : Colors.neutral.textSecondary} />
        <Text style={[s.tabBtnText, active && s.tabBtnTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  // ==================== Sub-Views ====================

  function renderOverview() {
    return (
      <>
        {/* 企业信息卡 */}
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <Ionicons name="business" size={20} color={Colors.primary.main} />
            <Text style={s.infoLabel}>套餐</Text>
            <Text style={[s.infoValue, { color: planInfo.color }]}>{planInfo.label}</Text>
          </View>
          {enterprise?.industry && (
            <View style={s.infoRow}>
              <Ionicons name="globe" size={20} color={Colors.neutral.textSecondary} />
              <Text style={s.infoLabel}>行业</Text>
              <Text style={s.infoValue}>{enterprise.industry}</Text>
            </View>
          )}
          {enterprise?.size && (
            <View style={s.infoRow}>
              <Ionicons name="people" size={20} color={Colors.neutral.textSecondary} />
              <Text style={s.infoLabel}>规模</Text>
              <Text style={s.infoValue}>{SIZE_MAP[enterprise.size] || enterprise.size}</Text>
            </View>
          )}
          <View style={s.infoRow}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.neutral.textSecondary} />
            <Text style={s.infoLabel}>你的角色</Text>
            <Text style={[s.infoValue, { color: ROLE_MAP[enterprise?.role || 'member']?.color }]}>
              {ROLE_MAP[enterprise?.role || 'member']?.label}
            </Text>
          </View>
        </View>

        {/* 统计 */}
        {stats && (
          <View style={s.statsGrid}>
            <StatCard icon="people" value={stats.member_count} label="成员" />
            <StatCard icon="flash" value={stats.active_members} label="活跃" />
            <StatCard icon="checkmark-done" value={stats.course_completions} label="完成" />
            <StatCard icon="time" value={stats.total_learning_hours} label="学时" />
          </View>
        )}

        {/* 限额进度 */}
        <View style={s.infoCard}>
          <Text style={s.sectionTitle}>资源配额</Text>
          <LimitBar label="成员" current={enterprise?.member_count || 0} max={enterprise?.member_limit || 10} />
          <LimitBar label="课程" current={courses.length} max={enterprise?.course_limit || 50} />
        </View>

        {/* 快捷操作 */}
        {isAdmin && (
          <View style={s.actionsCard}>
            <TouchableOpacity style={s.actionBtn} onPress={() => setShowInvite(true)}>
              <Ionicons name="person-add" size={20} color={Colors.primary.main} />
              <Text style={s.actionBtnText}>邀请成员</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={() => setActiveTab('members')}>
              <Ionicons name="people-circle" size={20} color={Colors.primary.main} />
              <Text style={s.actionBtnText}>管理成员</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={() => setActiveTab('courses')}>
              <Ionicons name="book" size={20} color={Colors.primary.main} />
              <Text style={s.actionBtnText}>课程管理</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={() => setActiveTab('report')}>
              <Ionicons name="stats-chart" size={20} color={Colors.primary.main} />
              <Text style={s.actionBtnText}>学习报告</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  }

  function renderMembers() {
    return (
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>团队成员 ({members.length}/{enterprise?.member_limit || 10})</Text>
          {isAdmin && (
            <TouchableOpacity style={s.smallBtn} onPress={() => setShowInvite(true)}>
              <Ionicons name="person-add" size={16} color={Colors.primary.main} />
              <Text style={s.smallBtnText}>邀请</Text>
            </TouchableOpacity>
          )}
        </View>
        {members.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="people-outline" size={40} color={Colors.neutral.textSecondary} />
            <Text style={s.emptyText}>暂无成员</Text>
          </View>
        ) : members.map(m => {
          const roleInfo = ROLE_MAP[m.role] || ROLE_MAP.member;
          return (
            <View key={m.member_id} style={s.memberCard}>
              <View style={s.memberAvatar}>
                <Text style={s.memberAvatarText}>
                  {(m.nickname || m.email || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={s.memberInfo}>
                <Text style={s.memberName}>{m.nickname || m.email}</Text>
                <Text style={s.memberEmail}>{m.email}</Text>
              </View>
              <View style={s.memberActions}>
                <View style={[s.roleBadge, { backgroundColor: roleInfo.color + '18' }]}>
                  <Text style={[s.roleBadgeText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
                </View>
                {isAdmin && m.role !== 'admin' && (
                  <TouchableOpacity
                    style={s.iconBtn}
                    onPress={() => {
                      setRoleMember(m);
                      setSelectedRole(m.role === 'admin' ? 'admin' : 'member');
                      setShowRoleModal(true);
                    }}
                  >
                    <Ionicons name="create" size={18} color={Colors.neutral.textSecondary} />
                  </TouchableOpacity>
                )}
                {isAdmin && m.role !== 'admin' && (
                  <TouchableOpacity
                    style={s.iconBtn}
                    onPress={() => removeMember(m)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function renderCourses() {
    return (
      <View style={s.section}>
        <Text style={s.sectionTitle}>企业课程 ({courses.length})</Text>
        {courses.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="book-outline" size={40} color={Colors.neutral.textSecondary} />
            <Text style={s.emptyText}>暂无分配课程</Text>
            <Text style={s.emptySubText}>请联系管理员分配课程</Text>
          </View>
        ) : courses.map(c => (
          <View key={c.assignment_id} style={s.courseCard}>
            <View style={s.courseIcon}>
              <Ionicons name="book" size={20} color={Colors.primary.main} />
            </View>
            <View style={s.courseInfo}>
              <Text style={s.courseTitle}>{c.course_name}</Text>
              <Text style={s.courseMeta}>
                {c.is_required ? '必修' : '选修'}
                {c.deadline ? ` · 截止 ${new Date(c.deadline).toLocaleDateString()}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  function renderReport() {
    if (!report) {
      return (
        <View style={s.emptyBox}>
          <Ionicons name="stats-chart-outline" size={40} color={Colors.neutral.textSecondary} />
          <Text style={s.emptyText}>加载中...</Text>
        </View>
      );
    }
    return (
      <View style={s.section}>
        <Text style={s.sectionTitle}>学习报告</Text>
        {/* 总体进度 */}
        <View style={s.infoCard}>
          <View style={s.progressRow}>
            <Text style={s.progressLabel}>整体完成率</Text>
            <Text style={s.progressValue}>{Math.round(report.overall_progress || 0)}%</Text>
          </View>
          <View style={s.progressBarBg}>
            <View style={[s.progressBarFill, { width: `${report.overall_progress || 0}%` }]} />
          </View>
        </View>
        {/* 成员进度 */}
        {(report.members || []).map(m => (
          <View key={m.user_id} style={s.reportCard}>
            <View style={s.reportHeader}>
              <Text style={s.reportName}>{m.nickname}</Text>
              <Text style={s.reportHours}>{m.learning_hours}h</Text>
            </View>
            <View style={s.progressRow}>
              <Text style={s.progressLabel}>
                课程 {m.courses_completed}/{m.total_courses}
              </Text>
              <Text style={s.progressValue}>
                {m.total_courses > 0 ? Math.round(m.courses_completed / m.total_courses * 100) : 0}%
              </Text>
            </View>
            <View style={s.progressBarBg}>
              <View style={[
                s.progressBarFill,
                { width: `${m.total_courses > 0 ? m.courses_completed / m.total_courses * 100 : 0}%` },
              ]} />
            </View>
            <Text style={s.reportActive}>
              最近活跃: {m.last_active ? new Date(m.last_active).toLocaleDateString('zh-CN') : '无'}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  // ==================== Main Render ====================

  if (loading) {
    return (
      <TabPageWrapper hasHeader>
        <View style={s.container}>
          <View style={s.pageHeader}>
            <TouchableOpacity style={s.backBtn} onPress={() => goBack()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
            </TouchableOpacity>
            <Text style={s.pageTitle}>企业服务</Text>
            <View style={s.pageHeaderActions} />
          </View>
          <View style={s.center}><Text>加载中...</Text></View>
        </View>
      </TabPageWrapper>
    );
  }

  if (showCreate) {
    return (
      <TabPageWrapper hasHeader>
        <View style={s.container}>
          <View style={s.pageHeader}>
            <TouchableOpacity style={s.backBtn} onPress={() => setShowCreate(false)} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
            </TouchableOpacity>
            <Text style={s.pageTitle}>创建企业</Text>
            <View style={s.pageHeaderActions} />
          </View>
          <ScrollView style={s.content} keyboardShouldPersistTaps="handled">
            <View style={s.formCard}>
              <Text style={s.formTitle}>创建企业账户</Text>
              <Text style={s.formDesc}>创建后可邀请团队成员加入，统一管理学习进度</Text>
              <TextInput
                style={s.input}
                placeholder="企业名称 *"
                value={createForm.name}
                onChangeText={t => setCreateForm(p => ({ ...p, name: t }))}
                maxLength={50}
              />
              <TextInput
                style={s.input}
                placeholder="所属行业（选填）"
                value={createForm.industry}
                onChangeText={t => setCreateForm(p => ({ ...p, industry: t }))}
                maxLength={30}
              />
              <Text style={s.label}>企业规模</Text>
              <View style={s.sizeOptions}>
                {(['small', 'medium', 'large'] as const).map(size => (
                  <TouchableOpacity
                    key={size}
                    style={[s.sizeOption, createForm.size === size && s.sizeOptionActive]}
                    onPress={() => setCreateForm(p => ({ ...p, size }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.sizeOptionText, createForm.size === size && s.sizeOptionTextActive]}>
                      {SIZE_MAP[size]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[s.primaryBtn, creating && s.btnDisabled]}
                onPress={createEnterprise}
                disabled={creating}
              >
                <Text style={s.primaryBtnText}>{creating ? '创建中...' : '创建企业'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TabPageWrapper>
    );
  }

  if (!enterprise?.has_enterprise) {
    return (
      <TabPageWrapper hasHeader>
        <View style={s.container}>
          <View style={s.pageHeader}>
            <TouchableOpacity style={s.backBtn} onPress={() => goBack()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
            </TouchableOpacity>
            <Text style={s.pageTitle}>企业服务</Text>
            <View style={s.pageHeaderActions} />
          </View>
          <View style={s.center}>
            <Ionicons name="business-outline" size={64} color={Colors.neutral.textSecondary} />
            <Text style={s.emptyTitle}>企业功能</Text>
            <Text style={s.emptyDesc}>创建企业账户，管理团队学习</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => setShowCreate(true)}>
              <Text style={s.primaryBtnText}>创建企业账户</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TabPageWrapper>
    );
  }

  // Main enterprise view
  return (
    <TabPageWrapper hasHeader>
      <View style={s.container}>
        <View style={s.pageHeader}>
          <TouchableOpacity style={s.backBtn} onPress={() => goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
          </TouchableOpacity>
          <Text style={s.pageTitle}>企业服务</Text>
          <View style={s.pageHeaderActions} />
        </View>

        {/* 企业名 + 邀请按钮 */}
        <View style={s.enterpriseHeader}>
          <View>
            <Text style={s.enterpriseName}>{enterprise?.name}</Text>
            <View style={s.planBadge}>
              <Text style={[s.planBadgeText, { color: planInfo.color }]}>{planInfo.label}</Text>
            </View>
          </View>
          {isAdmin && (
            <TouchableOpacity style={s.inviteBtn} onPress={() => setShowInvite(true)}>
              <Ionicons name="person-add" size={16} color={Colors.neutral.white} />
              <Text style={s.inviteBtnText}>邀请</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          <TabButton id="overview" icon="grid" label="概览" />
          <TabButton id="members" icon="people" label="成员" />
          <TabButton id="courses" icon="book" label="课程" />
          <TabButton id="report" icon="stats-chart" label="报告" />
        </View>

        {/* Content */}
        <ScrollView
          style={s.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'members' && renderMembers()}
          {activeTab === 'courses' && renderCourses()}
          {activeTab === 'report' && renderReport()}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Invite Modal */}
        <Modal visible={showInvite} animationType="slide" transparent>
          <KeyboardAvoidingView
            style={s.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={s.modalContent}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>邀请成员</Text>
                <TouchableOpacity onPress={() => { setShowInvite(false); setInviteEmails(''); }}>
                  <Ionicons name="close" size={24} color={Colors.neutral.textSecondary} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="输入邮箱，多个用逗号或换行分隔"
                value={inviteEmails}
                onChangeText={setInviteEmails}
                multiline
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity
                style={[s.primaryBtn, inviting && s.btnDisabled]}
                onPress={inviteMembers}
                disabled={inviting}
              >
                <Text style={s.primaryBtnText}>{inviting ? '发送中...' : '发送邀请'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Role Modal */}
        <Modal visible={showRoleModal} animationType="slide" transparent>
          <KeyboardAvoidingView
            style={s.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={s.modalContent}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>修改角色</Text>
                <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.neutral.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={s.modalDesc}>
                修改 {roleMember?.nickname || roleMember?.email} 的角色
              </Text>
              {(['admin', 'member', 'viewer'] as const).map(r => {
                const ri = ROLE_MAP[r];
                return (
                  <TouchableOpacity
                    key={r}
                    style={[s.roleOption, selectedRole === r && s.roleOptionActive]}
                    onPress={() => setSelectedRole(r)}
                  >
                    <View style={[s.roleDot, { backgroundColor: ri.color }]} />
                    <Text style={s.roleOptionText}>{ri.label}</Text>
                    {selectedRole === r && <Ionicons name="checkmark" size={20} color={Colors.primary.main} />}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={s.primaryBtn} onPress={updateRole}>
                <Text style={s.primaryBtnText}>确认修改</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </TabPageWrapper>
  );
}

// ==================== Sub-Components ====================

function LimitBar({ label, current, max }: { label: string; current: number; max: number }) {
  const pct = max > 0 ? Math.min(current / max * 100, 100) : 0;
  const isNear = pct > 80;
  return (
    <View style={s.limitRow}>
      <Text style={s.limitLabel}>{label}</Text>
      <View style={s.limitBarBg}>
        <View style={[s.limitBarFill, { width: `${pct}%` }, isNear && { backgroundColor: '#f59e0b' }]} />
      </View>
      <Text style={[s.limitText, isNear && { color: '#f59e0b' }]}>{current}/{max}</Text>
    </View>
  );
}

// ==================== Styles ====================

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  content: { flex: 1, paddingHorizontal: Spacing.md },

  // Page Header
  pageHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.5)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: iOSColors.border,
  },
  pageTitle: { fontSize: 18, fontWeight: '600', color: iOSColors.fg, letterSpacing: -0.3, flex: 1 },
  pageHeaderActions: { flexDirection: 'row', gap: Spacing.xs },

  // Enterprise Header
  enterpriseHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, backgroundColor: Colors.neutral.card,
    borderBottomWidth: 1, borderBottomColor: Colors.neutral.border,
  },
  enterpriseName: { fontSize: 20, fontWeight: '700', color: Colors.neutral.textPrimary },
  planBadge: { marginTop: 4 },
  planBadgeText: { fontSize: 13, fontWeight: '600' },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary.main, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Rounded.md,
  },
  inviteBtnText: { color: Colors.neutral.white, fontSize: 14, fontWeight: '600' },

  // Tabs
  tabs: {
    flexDirection: 'row', backgroundColor: Colors.neutral.card,
    borderBottomWidth: 1, borderBottomColor: Colors.neutral.border,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: Spacing.sm,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Colors.primary.main },
  tabBtnText: { fontSize: 13, color: Colors.neutral.textSecondary, fontWeight: '500' },
  tabBtnTextActive: { color: Colors.primary.main, fontWeight: '600' },

  // Cards
  infoCard: {
    backgroundColor: Colors.neutral.card, padding: Spacing.md,
    borderRadius: Rounded.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.neutral.border,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  infoLabel: { fontSize: 14, color: Colors.neutral.textSecondary, flex: 1 },
  infoValue: { fontSize: 14, fontWeight: '500', color: Colors.neutral.textPrimary },

  // Stats
  statsGrid: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.neutral.card, padding: Spacing.md,
    borderRadius: Rounded.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.neutral.border,
  },
  statCard: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.primary.main, marginTop: 2 },
  statLabel: { fontSize: 11, color: Colors.neutral.textSecondary, marginTop: 2 },

  // Limit bars
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  limitLabel: { fontSize: 13, color: Colors.neutral.textSecondary, width: 40 },
  limitBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.neutral.border, overflow: 'hidden' },
  limitBarFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary.main },
  limitText: { fontSize: 12, color: Colors.neutral.textSecondary, width: 50, textAlign: 'right' },

  // Actions
  actionsCard: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
    backgroundColor: Colors.neutral.card, padding: Spacing.md,
    borderRadius: Rounded.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.neutral.border,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary.light, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Rounded.md,
  },
  actionBtnText: { fontSize: 13, fontWeight: '500', color: Colors.primary.main },

  // Section
  section: { marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.neutral.textPrimary, marginBottom: Spacing.sm },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  smallBtnText: { fontSize: 13, color: Colors.primary.main, fontWeight: '500' },

  // Members
  memberCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.neutral.card, padding: Spacing.md,
    borderRadius: Rounded.md, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.neutral.border,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary.light, alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 16, fontWeight: '600', color: Colors.primary.main },
  memberInfo: { flex: 1, marginLeft: Spacing.sm },
  memberName: { fontSize: 15, fontWeight: '500', color: Colors.neutral.textPrimary },
  memberEmail: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: 2 },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Rounded.sm },
  roleBadgeText: { fontSize: 11, fontWeight: '600' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Courses
  courseCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.neutral.card, padding: Spacing.md,
    borderRadius: Rounded.md, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.neutral.border,
  },
  courseIcon: {
    width: 40, height: 40, borderRadius: Rounded.md,
    backgroundColor: Colors.primary.light, alignItems: 'center', justifyContent: 'center',
  },
  courseInfo: { flex: 1, marginLeft: Spacing.sm },
  courseTitle: { fontSize: 15, fontWeight: '500', color: Colors.neutral.textPrimary },
  courseMeta: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: 2 },

  // Report
  reportCard: {
    backgroundColor: Colors.neutral.card, padding: Spacing.md,
    borderRadius: Rounded.md, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.neutral.border,
  },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  reportName: { fontSize: 15, fontWeight: '500', color: Colors.neutral.textPrimary },
  reportHours: { fontSize: 13, color: Colors.primary.main, fontWeight: '600' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel: { fontSize: 12, color: Colors.neutral.textSecondary },
  progressValue: { fontSize: 12, color: Colors.primary.main, fontWeight: '600' },
  progressBarBg: { height: 6, borderRadius: 3, backgroundColor: Colors.neutral.border, overflow: 'hidden', marginBottom: Spacing.xs },
  progressBarFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary.main },
  reportActive: { fontSize: 11, color: Colors.neutral.textSecondary, marginTop: 2 },

  // Form
  formCard: {
    backgroundColor: Colors.neutral.card, padding: Spacing.lg,
    borderRadius: Rounded.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.neutral.border,
  },
  formTitle: { fontSize: 22, fontWeight: '700', color: Colors.neutral.textPrimary, marginBottom: Spacing.xs },
  formDesc: { fontSize: 14, color: Colors.neutral.textSecondary, marginBottom: Spacing.lg },
  input: {
    borderWidth: 1, borderColor: Colors.neutral.border,
    backgroundColor: Colors.neutral.backgroundAlt,
    padding: Spacing.sm, borderRadius: Rounded.md,
    marginBottom: Spacing.sm, color: Colors.neutral.textPrimary,
    fontSize: 16,
  },
  label: { fontSize: 14, color: Colors.neutral.textSecondary, marginBottom: Spacing.sm },
  sizeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  sizeOption: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.neutral.backgroundAlt, borderRadius: Rounded.md,
    borderWidth: 1, borderColor: Colors.neutral.border,
  },
  sizeOptionActive: { backgroundColor: Colors.primary.light, borderColor: Colors.primary.main },
  sizeOptionText: { fontSize: 13, color: Colors.neutral.textPrimary },
  sizeOptionTextActive: { color: Colors.primary.main, fontWeight: '600' },

  // Buttons
  primaryBtn: {
    backgroundColor: Colors.primary.main, padding: Spacing.md,
    borderRadius: Rounded.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  primaryBtnText: { fontSize: 16, color: Colors.neutral.white, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyText: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.sm },
  emptySubText: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: Spacing.sm, color: Colors.neutral.textPrimary },
  emptyDesc: { fontSize: 14, color: Colors.neutral.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: {
    backgroundColor: Colors.neutral.card, borderTopLeftRadius: Rounded.xl, borderTopRightRadius: Rounded.xl,
    padding: Spacing.lg, paddingBottom: Spacing.xl,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral.textPrimary },
  modalDesc: { fontSize: 14, color: Colors.neutral.textSecondary, marginBottom: Spacing.md },

  // Role options
  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Rounded.md,
    borderWidth: 1, borderColor: Colors.neutral.border, marginBottom: Spacing.sm,
  },
  roleOptionActive: { borderColor: Colors.primary.main, backgroundColor: Colors.primary.light },
  roleOptionText: { flex: 1, fontSize: 15, color: Colors.neutral.textPrimary, fontWeight: '500' },
  roleDot: { width: 10, height: 10, borderRadius: 5 },
});
