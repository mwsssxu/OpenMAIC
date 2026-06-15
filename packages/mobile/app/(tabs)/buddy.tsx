import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { showError, showSuccess } from '@/lib/utils/error-toast';
import { useGoBack } from '@/lib/utils/navigation';
import TabPageWrapper from '@/lib/components/TabPageWrapper';

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
  listener: { label: '倾听型', icon: 'ear', desc: '耐心倾听，共情理解' },
  critic: { label: '毒舌型', icon: 'flame', desc: '犀利点评，幽默吐槽' },
  scholar: { label: '学者型', icon: 'school', desc: '严谨治学，深入浅出' },
  partner: { label: '伙伴型', icon: 'people', desc: '共同成长，亦师亦友' },
  // 向后兼容旧类型值
  explainer: { label: '讲解型', icon: 'school', desc: '耐心讲解，深入浅出' },
  motivator: { label: '激励型', icon: 'flash', desc: '充满激情，目标驱动' },
};

const TONE_MAP: Record<string, { label: string; emoji: string }> = {
  warm: { label: '温暖', emoji: '🤗' },
  strict: { label: '严格', emoji: '💪' },
  humorous: { label: '幽默', emoji: '😄' },
  serious: { label: '严谨', emoji: '🎓' },
  // 向后兼容旧tone值
  professional: { label: '专业', emoji: '👔' },
  calm: { label: '沉稳', emoji: '🧘' },
};

interface ChatMsg {
  id: string;
  role: 'user' | 'buddy';
  text: string;
  time: Date;
}

export default function BuddyScreen() {
  const goBack = useGoBack();
  const [buddy, setBuddy] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [buddyTypes, setBuddyTypes] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [selectedTone, setSelectedTone] = useState('');
  const [saving, setSaving] = useState(false);

  // 聊天状态
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [data, msgs] = await Promise.all([
        apiClient.getMyBuddyConfig(),
        apiClient.getBuddyMessages(1, 20).catch(() => ({ messages: [] })),
      ]);
      setBuddy(data);
      setSelectedType(data.buddy_type || 'encourager');
      setSelectedTone(data.tone_style || 'warm');
      // 还原聊天历史
      if (msgs.messages?.length > 0) {
        const history: ChatMsg[] = msgs.messages
          .filter((m: any) => m.trigger_event === 'deep_chat')
          .reverse()
          .map((m: any) => ({
            id: m.id,
            role: m.message_type === 'user' ? 'user' as const : 'buddy' as const,
            text: m.content,
            time: new Date(m.created_at),
          }));
        setChatMessages(history);
        setTimeout(() => scrollRef.current?.scrollToEnd?.(), 200);
      }
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

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? inputText).trim();
    if (!text || sending) return;
    setInputText('');
    setSending(true);

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      time: new Date(),
    };
    // 正在输入占位
    const typingMsg: ChatMsg = {
      id: `typing-${Date.now()}`,
      role: 'buddy',
      text: '__TYPING__',
      time: new Date(),
    };
    setChatMessages(prev => [...prev, userMsg, typingMsg]);
    setTimeout(() => scrollRef.current?.scrollToEnd?.(), 100);

    try {
      const res = await apiClient.buddyDeepChat(text, buddy?.buddy_type);
      const buddyMsg: ChatMsg = {
        id: `b-${Date.now()}`,
        role: 'buddy',
        text: res.content || '...',
        time: new Date(),
      };
      // 替换 typing 占位
      setChatMessages(prev => [...prev.filter(m => m.id !== typingMsg.id), buddyMsg]);
      setTimeout(() => scrollRef.current?.scrollToEnd?.(), 100);
    } catch (error: any) {
      showError(error?.response?.data?.detail || '搭子回复失败');
      // 移除用户消息和typing占位
      setChatMessages(prev => prev.filter(m => m.id !== userMsg.id && m.id !== typingMsg.id));
    } finally {
      setSending(false);
    }
  }

  const typeInfo = BUDDY_TYPE_MAP[buddy?.buddy_type || 'encourager'] || BUDDY_TYPE_MAP.encourager;
  const toneInfo = TONE_MAP[buddy?.tone_style || 'warm'] || TONE_MAP.warm;
  const buddyName = buddy?.buddy_name || typeInfo.label;

  return (
    <TabPageWrapper hasHeader>
      <View style={styles.container}>
        <View style={styles.pageHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>学习搭子</Text>
          <View style={styles.pageHeaderActions}>
            <TouchableOpacity style={styles.configBtn} onPress={() => { loadBuddyTypes(); setShowConfig(true); }}>
              <Ionicons name="settings-outline" size={20} color={iOSColors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 搭子信息卡 */}
        <View style={styles.buddyCard}>
          <View style={styles.avatar}>
            <Ionicons name={typeInfo.icon as any} size={36} color={Colors.primary.main} />
          </View>
          <Text style={styles.buddyName}>{buddyName}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{typeInfo.label}</Text>
            </View>
            <View style={styles.toneBadge}>
              <Text style={styles.toneBadgeText}>{toneInfo.emoji} {toneInfo.label}</Text>
            </View>
          </View>
        </View>

        {/* 聊天区域 */}
        <KeyboardAvoidingView
          style={styles.chatSection}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          {chatMessages.length === 0 ? (
            <View style={styles.chatEmpty}>
              <Ionicons name="chatbubbles-outline" size={40} color={iOSColors.muted} />
              <Text style={styles.chatEmptyTitle}>和{buddyName}聊聊天</Text>
              <Text style={styles.chatEmptyDesc}>分享你的学习困惑、目标或心情</Text>
              {/* 快捷话题 */}
              <View style={styles.quickTopics}>
                {['今天学了什么？', '帮我制定学习计划', '我遇到困难了', '给我一些鼓励'].map((topic) =>(
                  <TouchableOpacity
                    key={topic}
                    style={styles.topicChip}
                    onPress={() => sendMessage(topic)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.topicText}>{topic}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.chatList}
              contentContainerStyle={styles.chatListContent}
            >
              {chatMessages.length === 0 && !sending && (
                <View style={styles.emptyChat}>
                  <Ionicons name="chatbubbles-outline" size={40} color={Colors.neutral.textMuted} />
                  <Text style={styles.emptyChatTitle}>和你的学习搭子聊聊吧</Text>
                  <Text style={styles.emptyChatDesc}>随时提问、分享心得，{buddy?.buddy_name || typeInfo.label}陪你一起学</Text>
                </View>
              )}
              {chatMessages.map((msg) => (
                <View
                  key={msg.id}
                  style={[styles.msgBubble, msg.role === 'user' ? styles.msgUser : styles.msgBuddy]}
                >
                  {msg.role === 'buddy' && (
                    <View style={styles.msgAvatar}>
                      <Ionicons name={typeInfo.icon as any} size={16} color={Colors.primary.main} />
                    </View>
                  )}
                  <View style={[styles.msgContent, msg.role === 'user' ? styles.msgUserContent : styles.msgBuddyContent]}>
                    {msg.text === '__TYPING__' ? (
                      <View style={styles.typingDots}>
                        <View style={[styles.dot, styles.dot1]} />
                        <View style={[styles.dot, styles.dot2]} />
                        <View style={[styles.dot, styles.dot3]} />
                      </View>
                    ) : (
                      <Text style={[styles.msgText, msg.role === 'user' ? styles.msgUserText : styles.msgBuddyText]}>
                        {msg.text}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
              {sending && (
                <View style={[styles.msgBubble, styles.msgBuddy]}>
                  <View style={styles.msgAvatar}>
                    <Ionicons name={typeInfo.icon as any} size={16} color={Colors.primary.main} />
                  </View>
                  <View style={[styles.msgContent, styles.msgBuddyContent]}>
                    <Text style={styles.msgBuddyText}>正在思考...</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* 输入栏 */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder={`和${buddyName}说点什么...`}
              placeholderTextColor={iOSColors.muted}
              multiline
              maxLength={500}
              editable={!sending}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.7}
            >
              <Ionicons name="send" size={18} color={inputText.trim() && !sending ? '#fff' : iOSColors.muted} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* 配置 Modal */}
        <Modal visible={showConfig} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>配置学习搭子</Text>
                <TouchableOpacity onPress={() => setShowConfig(false)}>
                  <Ionicons name="close" size={24} color={iOSColors.muted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>搭子类型</Text>
              <View style={styles.typeGrid}>
                {Object.entries(BUDDY_TYPE_MAP).map(([key, val]) => {
                  const isActive = selectedType === key;
                  return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.typeCard, isActive && styles.typeCardActive]}
                    onPress={() => setSelectedType(key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={val.icon as any} size={24} color={isActive ? iOSColors.accent : iOSColors.muted} />
                    <Text style={[styles.typeLabel, isActive && styles.typeLabelActive]}>
                      {val.label}
                    </Text>
                    <Text style={styles.typeDesc}>{val.desc}</Text>
                  </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>语气风格</Text>
              <View style={styles.toneRow}>
                {Object.entries(TONE_MAP).map(([key, val]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.toneChip, selectedTone === key && styles.toneChipActive]}
                    onPress={() => setSelectedTone(key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.toneText, selectedTone === key && styles.toneTextActive]}>
                      {val.emoji} {val.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={saveConfig}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={styles.saveBtnText}>{saving ? '保存中...' : '保存配置'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </TabPageWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: iOSColors.bgSolid },
  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: iOSColors.surfaceSolid,
    borderBottomWidth: 1, borderBottomColor: iOSColors.border,
  },
  backBtn: { padding: 8 },
  pageTitle: { fontSize: 17, fontWeight: '600', color: iOSColors.fg },
  pageHeaderActions: { flexDirection: 'row', gap: 8 },
  configBtn: { padding: 8 },

  // 搭子信息卡
  buddyCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, padding: 12,
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: 12, borderWidth: 1, borderColor: iOSColors.border,
    gap: 10,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primary.main + '18',
    justifyContent: 'center', alignItems: 'center',
  },
  buddyName: { fontSize: 16, fontWeight: '600', color: iOSColors.fg, flex: 1 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: iOSColors.accentLight, borderRadius: 10,
  },
  typeBadgeText: { fontSize: 12, color: iOSColors.accent, fontWeight: '500' },
  toneBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: iOSColors.secondaryLight, borderRadius: 10,
  },
  toneBadgeText: { fontSize: 12, color: iOSColors.secondary, fontWeight: '500' },

  // 聊天区域
  chatSection: { flex: 1, marginTop: 8 },
  chatEmpty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  chatEmptyTitle: { fontSize: 18, fontWeight: '600', color: iOSColors.fg, marginTop: 12 },
  chatEmptyDesc: { fontSize: 14, color: iOSColors.muted, marginTop: 4, textAlign: 'center' },
  quickTopics: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 8, marginTop: 20,
  },
  topicChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: 16, borderWidth: 1, borderColor: iOSColors.border,
  },
  topicText: { fontSize: 13, color: iOSColors.fg },

  chatList: { flex: 1 },
  chatListContent: { padding: 16, paddingBottom: 8 },
  emptyChat: { alignItems: 'center', paddingTop: 60, paddingBottom: 40, paddingHorizontal: 32 },
  emptyChatTitle: { fontSize: 16, fontWeight: '600', color: Colors.neutral.textPrimary, marginTop: 16 },
  emptyChatDesc: { fontSize: 13, color: Colors.neutral.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18 },

  // 消息气泡
  msgBubble: {
    flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end',
  },
  msgUser: { justifyContent: 'flex-end' },
  msgBuddy: { justifyContent: 'flex-start' },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary.main + '18',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 6,
  },
  msgContent: {
    maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 16,
  },
  msgUserContent: {
    backgroundColor: iOSColors.accent,
    borderBottomRightRadius: 4,
  },
  msgBuddyContent: {
    backgroundColor: iOSColors.surfaceSolid,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: iOSColors.border,
  },
  msgText: { fontSize: 15, lineHeight: 20 },
  msgUserText: { color: '#fff' },
  msgBuddyText: { color: iOSColors.fg },
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: iOSColors.muted, opacity: 0.4 },
  dot1: { opacity: 1 },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 0.3 },

  // 输入栏
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: iOSColors.surfaceSolid,
    borderTopWidth: 1, borderTopColor: iOSColors.border,
    gap: 8,
  },
  input: {
    flex: 1, minHeight: 36, maxHeight: 100,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: iOSColors.bgSolid,
    borderRadius: 18, fontSize: 15,
    color: iOSColors.fg,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: iOSColors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: iOSColors.bgSolid },

  // 配置 Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: iOSColors.surfaceSolid,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: iOSColors.fg },
  sectionLabel: { fontSize: 14, fontWeight: '500', color: iOSColors.muted, marginBottom: 10 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  typeCard: {
    width: '47%', padding: 14, alignItems: 'center',
    backgroundColor: iOSColors.bgSolid,
    borderRadius: 12, borderWidth: 1.5, borderColor: iOSColors.border,
  },
  typeCardActive: { borderColor: iOSColors.accent, backgroundColor: iOSColors.accentLight },
  typeLabel: { fontSize: 13, color: iOSColors.muted, marginTop: 6 },
  typeDesc: { fontSize: 10, color: iOSColors.muted, marginTop: 2, opacity: 0.7 },
  typeLabelActive: { color: iOSColors.accent, fontWeight: '600' },
  toneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  toneChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: iOSColors.bgSolid,
    borderRadius: 16, borderWidth: 1.5, borderColor: iOSColors.border,
  },
  toneChipActive: { borderColor: iOSColors.secondary, backgroundColor: iOSColors.secondaryLight },
  toneText: { fontSize: 14, color: iOSColors.muted },
  toneTextActive: { color: iOSColors.secondary, fontWeight: '600' },
  saveBtn: {
    paddingVertical: 14, alignItems: 'center',
    backgroundColor: iOSColors.accent, borderRadius: 12,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
