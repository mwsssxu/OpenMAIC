import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { showError, showSuccess } from '@/lib/utils/error-toast';
import { useFeedback } from '@/lib/hooks/use-feedback';
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

export default function InviteScreen() {
  const { onSuccess, onError } = useFeedback();
  const router = useRouter();
  const goBack = useGoBack();
  const [inviteCode, setInviteCode] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [codeData, statsData] = await Promise.all([
        apiClient.getMyInviteCode(),
        apiClient.getInvitationStats(),
      ]);
      setInviteCode(codeData.invite_code || '');
      setStats(statsData);
    } catch (error) {
      showError(error);
      console.error('Load invite data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const shareInvite = async () => {
    try {
      onSuccess();
      await Share.share({
        message: `快来加入 OpenMAIC！使用我的邀请码 ${inviteCode} 注册，你可获得 100 Token，我也能获得奖励哦~`,
      });
    } catch (error) {
      onError();
      showError('分享失败');
    }
  };

  const applyCode = async () => {
    setInputCode('');
    setShowCodeModal(true);
  };

  const canSubmit = inputCode.trim().length > 0 && !submitting;

  const submitCode = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setShowCodeModal(false);
    try {
      await apiClient.applyInviteCode(inputCode.trim());
      showSuccess('已获得邀请奖励！');
      loadData();
    } catch (error: any) {
      showError(error.response?.data?.detail || '邀请码无效');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
      <View style={styles.pageHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>邀请奖励</Text>
        <View style={styles.pageHeaderActions} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
      >
        {/* 邀请码卡片 */}
        <View style={styles.codeCard}>
          <Text style={styles.cardTitle}>我的邀请码</Text>
          <Text style={styles.inviteCode}>{isLoading ? '加载中...' : inviteCode || '暂无邀请码'}</Text>
          <TouchableOpacity style={styles.shareButton} onPress={shareInvite}>
            <Text style={styles.shareButtonText}>分享邀请码</Text>
          </TouchableOpacity>
        </View>

        {/* 邀请统计 */}
        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.cardTitle}>邀请统计</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_invites || 0}</Text>
                <Text style={styles.statLabel}>总邀请</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.level1_count || 0}</Text>
                <Text style={styles.statLabel}>一级邀请</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.level2_count || 0}</Text>
                <Text style={styles.statLabel}>二级邀请</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_points || 0}</Text>
                <Text style={styles.statLabel}>获得积分</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_tokens || 0}</Text>
                <Text style={styles.statLabel}>获得Token</Text>
              </View>
            </View>
          </View>
        )}

        {/* 奖励说明 */}
        <View style={styles.rewardCard}>
          <Text style={styles.cardTitle}>邀请奖励</Text>
          <View style={styles.rewardItem}>
            <Text style={styles.rewardText}>一级邀请: 20积分 + 50 Token</Text>
            <Text style={styles.rewardDesc}>被邀请人获得 100 Token</Text>
          </View>
          <View style={styles.rewardItem}>
            <Text style={styles.rewardText}>二级邀请: 10积分</Text>
          </View>
          <View style={styles.rewardItem}>
            <Text style={styles.rewardText}>三级邀请: 5积分</Text>
          </View>
        </View>

        {/* 应用邀请码 */}
        <TouchableOpacity style={styles.applyButton} onPress={applyCode}>
          <Text style={styles.applyButtonText}>输入邀请码</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 输入邀请码弹框 */}
      <Modal transparent visible={showCodeModal} animationType="fade" onRequestClose={() => setShowCodeModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>输入邀请码</Text>
            <Text style={styles.modalDesc}>输入朋友的邀请码获得奖励</Text>
            <TextInput
              style={styles.modalInput}
              value={inputCode}
              onChangeText={setInputCode}
              placeholder="请输入邀请码"
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowCodeModal(false)} activeOpacity={0.6}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtnConfirm, !canSubmit && styles.modalBtnDisabled]} 
                onPress={submitCode} 
                activeOpacity={canSubmit ? 0.6 : 1}
                disabled={!canSubmit}
              >
                <Text style={[styles.modalBtnConfirmText, !canSubmit && styles.modalBtnDisabledText]}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </View>
    </TabPageWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  pageTitle: { fontSize: 18, fontWeight: '600', color: iOSColors.fg, letterSpacing: -0.3, flex: 1 },
  pageHeaderActions: { flexDirection: 'row', gap: Spacing.xs },
  scrollView: { flex: 1, paddingHorizontal: Spacing.md },
  codeCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.lg,
    borderRadius: Rounded.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: Spacing.sm, color: Colors.neutral.textSecondary },
  inviteCode: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary.main,
    letterSpacing: 4,
    marginBottom: Spacing.md,
  },
  shareButton: {
    backgroundColor: Colors.primary.main,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
  },
  shareButtonText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },
  statsCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: Colors.primary.main },
  statLabel: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  rewardCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  rewardItem: { marginBottom: Spacing.sm, paddingLeft: Spacing.sm, borderLeftWidth: 3, borderLeftColor: Colors.primary.main },
  rewardText: { fontSize: 14, fontWeight: '600', color: Colors.neutral.textPrimary },
  rewardDesc: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  applyButton: {
    backgroundColor: Colors.primary.main,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    alignItems: 'center',
  },
  applyButtonText: { fontSize: 16, fontWeight: '600', color: Colors.neutral.white },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: { width: '85%', maxWidth: 320, backgroundColor: Colors.neutral.card, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 17, fontWeight: '600', color: Colors.neutral.textPrimary, textAlign: 'center', marginBottom: 8 },
  modalDesc: { fontSize: 14, color: Colors.neutral.textSecondary, textAlign: 'center', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: Colors.neutral.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.neutral.textPrimary, marginBottom: 20 },
  modalBtnRow: { flexDirection: 'row', gap: 10 },
  modalBtnCancel: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.neutral.background, alignItems: 'center' },
  modalBtnCancelText: { fontSize: 15, color: Colors.neutral.textSecondary, fontWeight: '500' },
  modalBtnConfirm: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.primary.main, alignItems: 'center' },
  modalBtnConfirmText: { fontSize: 15, color: Colors.neutral.white, fontWeight: '600' },
  modalBtnDisabled: { backgroundColor: Colors.neutral.border },
  modalBtnDisabledText: { color: Colors.neutral.textMuted },
});