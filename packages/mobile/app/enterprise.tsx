import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../lib/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      setLoading(false);
    }
  }

  async function loadMembers(enterpriseId: string) {
    try {
      const data = await apiClient.getEnterpriseMembers(enterpriseId);
      setMembers(data.members || []);
    } catch (e) {}
  }

  async function loadStats(enterpriseId: string) {
    try {
      const data = await apiClient.getEnterpriseStats(enterpriseId);
      setStats(data);
    } catch (e) {}
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
      setShowCreate(false);
      loadMembers(data.enterprise_id);
      loadStats(data.enterprise_id);
    } catch (e: any) {
      Alert.alert('错误', e.message || '创建失败');
    }
  }

  async function inviteMembers() {
    if (!enterprise?.enterprise_id) return;
    const emails = inviteEmails.split(',').map(e => e.trim()).filter(e => e);
    try {
      const data = await apiClient.inviteEnterpriseMembers(enterprise.enterprise_id, emails);
      Alert.alert('成功', `已邀请 ${data.total_invited} 人`);
      setShowInvite(false);
      setInviteEmails('');
      loadMembers(enterprise.enterprise_id);
    } catch (e: any) {
      Alert.alert('错误', e.message || '邀请失败');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showCreate) {
    return (
      <SafeAreaView style={styles.container}>
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
      </SafeAreaView>
    );
  }

  if (!enterprise?.has_enterprise) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.noEnterpriseTitle}>企业功能</Text>
          <Text style={styles.noEnterpriseDesc}>创建企业账户，管理团队学习</Text>
          <TouchableOpacity style={styles.button} onPress={() => setShowCreate(true)}>
            <Text style={styles.buttonText}>创建企业账户</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { flex: 1, padding: 16 },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  enterpriseName: { fontSize: 20, fontWeight: 'bold' },
  enterpriseInfo: { fontSize: 14, color: '#666', marginTop: 4 },
  inviteButton: { marginTop: 8, padding: 8, backgroundColor: '#3b82f6', borderRadius: 4 },
  inviteButtonText: { color: '#fff', fontSize: 14 },
  inviteModal: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12 },
  label: { fontSize: 14, color: '#666', marginBottom: 8 },
  sizeOptions: { flexDirection: 'row', marginBottom: 16 },
  sizeOption: { padding: 12, backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 8 },
  sizeOptionSelected: { backgroundColor: '#3b82f6' },
  button: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  buttonOutline: { backgroundColor: '#fff', padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6' },
  buttonText: { fontSize: 16, color: '#fff' },
  buttonOutlineText: { fontSize: 16, color: '#3b82f6' },
  statsGrid: { flexDirection: 'row', padding: 16, justifyContent: 'space-between' },
  statCard: { backgroundColor: '#fff', padding: 16, borderRadius: 8, alignItems: 'center', flex: 1, marginHorizontal: 4 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#3b82f6' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  memberCard: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8 },
  memberName: { fontSize: 16, fontWeight: 'bold' },
  memberEmail: { fontSize: 12, color: '#666' },
  memberRole: { fontSize: 12, color: '#888', marginTop: 4 },
  noEnterpriseTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  noEnterpriseDesc: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
});