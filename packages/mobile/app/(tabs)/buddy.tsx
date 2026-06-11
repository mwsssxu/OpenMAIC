import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { showError, showSuccess } from '@/lib/utils/error-toast';
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

const BUDDY_TYPE_MAP: Record<string, { label: string; icon: string; desc: string }> = {
  encourager: { label: '鼓励型', icon: 'sunny', desc: '温暖鼓励，积极正面' },
  challenger: { label: '挑战型', icon: 'fitness', desc: '严格要求，追求进步' },
  explainer: { label: '讲解型', icon: 'school', desc: '耐心讲解，深入浅出' },
  motivator: { label: '激励型', icon: 'flash', desc: '充满激情，目标驱动' },
};

const TONE_MAP: Record<string, { label: string; emoji: string }> = {
  warm: { label: '温暖', emoji: '🤗' },
  professional: { label: '专业', emoji: '👔' },
  humorous: { label: '幽默', emoji: '😄' },
  calm: { label: '沉稳', emoji: '🧘' },
};

export default function BuddyScreen() {
  const goBack = useGoBack();
  const [buddy, setBuddy] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [buddyTypes, setBuddyTypes] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [selectedTone, setSelectedTone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const data = await apiClient.getMyBuddyConfig();
      setBuddy(data);
      setSelectedType(data.buddy_type || 'encourager');
      setSelectedTone(data.tone_style || 'warm');
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadBuddyTypes() {
    try {
      const data = await apiClient.getBuddyTypes();
      setBuddyTypes(data.types || []);
    } catch { /* silent */ }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await apiClient.setBuddyConfig(selectedType, undefined, selectedTone);
      showSuccess('搭子配置已更新');
      setShowConfig(false);
      loadData();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  const typeInfo = BUDDY_TYPE_MAP[buddy?.buddy_type || 'encourager'] || BUDDY_TYPE_MAP.encourager;
  const toneInfo = TONE_MAP[buddy?.tone_style || 'warm'] || TONE_MAP.warm;

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
      <View style={styles.pageHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>学习搭子</Text>
        <View style={styles.pageHeaderActions}>
          {buddy && !buddy.is_default && (
            <TouchableOpacity style={styles.configBtn} onPress={() => { loadBuddyTypes(); setShowConfig(true); }}>
              <Ionicons name="settings-outline" size={20} color={iOSColors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
      >
        {buddy ? (
          <View style={styles.buddyCard}>
            <View style={styles.avatar}>
              <Ionicons name={typeInfo.icon as any} size={40} color={Colors.primary.main} />
            </View>
            <Text style={styles.buddyName}>{buddy.buddy_name || typeInfo.label}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{typeInfo.label}</Text>
              </View>
              <View style={styles.toneBadge}>
                <Text style={styles.toneBadgeText}>{toneInfo.emoji} {toneInfo.label}</Text>
              </View>
            </View>
            <Text style={styles.buddyDesc}>{typeInfo.desc}</Text>
            {buddy.is_default && (
              <TouchableOpacity
                style={styles.configButton}
                onPress={() => { loadBuddyTypes(); setShowConfig(true); }}
              >
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={styles.configButtonText}>自定义搭子</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : !isLoading ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={64} color={Colors.neutral.textSecondary} />
            <Text style={styles.emptyTitle}>还没有学习搭子</Text>
            <Text style={styles.emptyDesc}>配置你的专属学习伙伴</Text>
            <TouchableOpacity
              style={styles.matchButton}
              onPress={() => { loadBuddyTypes(); setShowConfig(true); }}
            >
              <Text style={styles.matchButtonText}>去配置</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 配置 Modal */}
      <Modal visible={showConfig} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>配置学习搭子</Text>
              <TouchableOpacity onPress={() => setShowConfig(false)}>
                <Ionicons name="close" size={24} color={iOSColors.fg} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sectionLabel}>搭子类型</Text>
              {Object.entries(BUDDY_TYPE_MAP).map(([key, info]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.typeOption, selectedType === key && styles.typeOptionActive]}
                  onPress={() => setSelectedType(key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={info.icon as any} size={20} color={selectedType === key ? Colors.primary.main : iOSColors.muted} />
                  <View style={styles.typeOptionText}>
                    <Text style={[styles.typeOptionLabel, selectedType === key && styles.typeOptionLabelActive]}>{info.label}</Text>
                    <Text style={styles.typeOptionDesc}>{info.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <Text style={styles.sectionLabel}>语气风格</Text>
              <View style={styles.toneGrid}>
                {Object.entries(TONE_MAP).map(([key, info]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.toneOption, selectedTone === key && styles.toneOptionActive]}
                    onPress={() => setSelectedTone(key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.toneEmoji}>{info.emoji}</Text>
                    <Text style={[styles.toneLabel, selectedTone === key && styles.toneLabelActive]}>{info.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={saveConfig}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? '保存中...' : '保存配置'}</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
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
  configBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  scrollView: { flex: 1, paddingHorizontal: Spacing.md },
  buddyCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.lg,
    borderRadius: Rounded.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  buddyName: { fontSize: 20, fontWeight: '600', color: Colors.neutral.textPrimary, marginBottom: Spacing.sm },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  typeBadge: { backgroundColor: Colors.primary.transparent, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Rounded.full },
  typeBadgeText: { fontSize: 13, color: Colors.primary.main, fontWeight: '500' },
  toneBadge: { backgroundColor: iOSColors.accentLight, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Rounded.full },
  toneBadgeText: { fontSize: 13, color: iOSColors.accent, fontWeight: '500' },
  buddyDesc: { fontSize: 14, color: Colors.neutral.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  configButton: {
    backgroundColor: Colors.primary.main,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Rounded.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  configButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emptyCard: {
    backgroundColor: Colors.neutral.card,
    padding: Spacing.xl,
    borderRadius: Rounded.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral.textPrimary, marginTop: Spacing.md },
  emptyDesc: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.md },
  matchButton: {
    backgroundColor: Colors.primary.main,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
  },
  matchButtonText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '600', color: iOSColors.fg },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: iOSColors.fg, marginBottom: Spacing.sm, marginTop: Spacing.md },
  typeOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Rounded.md, borderWidth: 1, borderColor: iOSColors.border, marginBottom: Spacing.sm },
  typeOptionActive: { borderColor: Colors.primary.main, backgroundColor: Colors.primary.transparent },
  typeOptionText: { flex: 1 },
  typeOptionLabel: { fontSize: 15, fontWeight: '500', color: iOSColors.fg },
  typeOptionLabelActive: { color: Colors.primary.main },
  typeOptionDesc: { fontSize: 12, color: iOSColors.muted, marginTop: 2 },
  toneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  toneOption: { width: '47%', alignItems: 'center', padding: Spacing.md, borderRadius: Rounded.md, borderWidth: 1, borderColor: iOSColors.border },
  toneOptionActive: { borderColor: Colors.primary.main, backgroundColor: Colors.primary.transparent },
  toneEmoji: { fontSize: 24, marginBottom: 4 },
  toneLabel: { fontSize: 13, color: iOSColors.muted },
  toneLabelActive: { color: Colors.primary.main, fontWeight: '600' },
  saveBtn: { backgroundColor: Colors.primary.main, borderRadius: Rounded.full, padding: Spacing.md + 2, alignItems: 'center', marginTop: Spacing.lg },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});