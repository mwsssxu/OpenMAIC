import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { useI18n } from '@/lib/i18n';
import { apiClient } from '@/lib/api-client';

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
  gold: '#f59e0b',
  goldLight: '#fef3c7',
  blue: '#2563eb',
  blueLight: '#dbeafe',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
};

interface NoteData {
  id: string;
  title: string;
  content: string;
  course: string;
  course_id?: string;
  category: string;
  starred: boolean;
  color: string;
  tags: string[];
  created_at: string;
  related_notes: Array<{
    id: string;
    title: string;
    date: string;
    course: string;
    color: string;
  }>;
}

// 颜色映射
const colorMap = {
  coral: { bg: iOSColors.accentLight, stroke: iOSColors.accent },
  mint: { bg: iOSColors.secondaryLight, stroke: iOSColors.secondary },
  gold: { bg: iOSColors.goldLight, stroke: iOSColors.gold },
  blue: { bg: iOSColors.blueLight, stroke: iOSColors.blue },
  purple: { bg: iOSColors.purpleLight, stroke: iOSColors.purple },
};

interface RelatedNote {
  id: string;
  title: string;
  date: string;
  course: string;
  color: string;
}

// 相关笔记卡片
function RelatedNoteCard({ note, onPress }: { note: RelatedNote; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const haptics = useHaptics();
  const colors = colorMap[note.color as keyof typeof colorMap] || colorMap.mint;

  const handlePress = () => {
    haptics.light();
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
    onPress();
    setTimeout(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }, 100);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={[styles.relatedItem, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.relatedIcon, { backgroundColor: colors.bg }]}>
          <Ionicons name="document-text" size={16} color={colors.stroke} />
        </View>
        <View style={styles.relatedText}>
          <Text style={styles.relatedTitle}>{note.title}</Text>
          <Text style={styles.relatedMeta}>{note.date} · {note.course}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// 代码块组件
function CodeBlock({ code }: { code: string }) {
  return (
    <View style={styles.codeBlock}>
      <Text style={styles.codeText}>{code}</Text>
    </View>
  );
}

// 重点标注卡片
function HighlightBlock({ text }: { text: string }) {
  return (
    <View style={styles.highlightBlock}>
      <Text style={styles.highlightText}>{text}</Text>
    </View>
  );
}

export default function NoteDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const haptics = useHaptics();
  const { t } = useI18n();
  const [noteData, setNoteData] = useState<NoteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNote();
  }, [params.id]);

  async function loadNote() {
    if (!params.id) return;
    try {
      setIsLoading(true);
      const data = await apiClient.getPersonalNote(params.id);
      setNoteData(data);
    } catch (error) {
      console.error('Load note error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // 解析笔记内容，提取代码块和重点标注
  const parseContent = (content: string) => {
    const lines = content.trim().split('\n');
    const elements: any[] = [];
    let currentText = '';
    let inCodeBlock = false;
    let codeContent = '';

    lines.forEach((line) => {
      if (line.startsWith('import ') || line.startsWith('# ') || line.startsWith('plt.') || line.startsWith('categories') || line.startsWith('values') || line.trim() === '') {
        if (!inCodeBlock && currentText) {
          elements.push({ type: 'text', content: currentText.trim() });
          currentText = '';
        }
        inCodeBlock = true;
        codeContent += line + '\n';
      } else if (line.startsWith('💡')) {
        if (currentText) {
          elements.push({ type: 'text', content: currentText.trim() });
          currentText = '';
        }
        if (inCodeBlock) {
          elements.push({ type: 'code', content: codeContent.trim() });
          codeContent = '';
          inCodeBlock = false;
        }
        elements.push({ type: 'highlight', content: line });
      } else {
        if (inCodeBlock) {
          elements.push({ type: 'code', content: codeContent.trim() });
          codeContent = '';
          inCodeBlock = false;
        }
        currentText += line + '\n';
      }
    });

    if (currentText) {
      elements.push({ type: 'text', content: currentText.trim() });
    }
    if (inCodeBlock && codeContent) {
      elements.push({ type: 'code', content: codeContent.trim() });
    }

    return elements;
  };

  if (isLoading || !noteData) {
    return (
      <View style={styles.container}>
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </View>
    );
  }

  const contentElements = parseContent(noteData.content);

  return (
    <View style={styles.container}>
      {/* 导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={iOSColors.fg} />
        </TouchableOpacity>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navBtn} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={20} color={iOSColors.fg} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 笔记头部 */}
        <View style={styles.noteHeader}>
          <Text style={styles.noteTitle}>{noteData.title}</Text>
          <View style={styles.noteHeaderMeta}>
            <View style={styles.courseTag}>
              <Text style={styles.courseTagText}>{noteData.course || noteData.category}</Text>
            </View>
            <Text style={styles.noteDate}>{noteData.created_at}</Text>
          </View>
        </View>

        {/* 卡通图表插图 */}
        <View style={styles.illustration}>
          <Text style={styles.illustrationEmoji}>📊</Text>
        </View>

        {/* 笔记内容 */}
        <View style={styles.noteContent}>
          {contentElements.map((element, idx) => {
            if (element.type === 'text') {
              return <Text key={idx} style={styles.contentText}>{element.content}</Text>;
            } else if (element.type === 'code') {
              return <CodeBlock key={idx} code={element.content} />;
            } else if (element.type === 'highlight') {
              return <HighlightBlock key={idx} text={element.content} />;
            }
            return null;
          })}
        </View>

        {/* 标签 */}
        <View style={styles.tagsRow}>
          {noteData.tags.map((tag: string) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}># {tag}</Text>
            </View>
          ))}
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionBtnPrimary}
            onPress={() => haptics.light()}
            activeOpacity={0.85}
          >
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnPrimaryText}>{t('classroom.download')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={() => haptics.light()}
            activeOpacity={0.85}
          >
            <Ionicons name="share-outline" size={18} color={iOSColors.fg} />
            <Text style={styles.actionBtnSecondaryText}>分享</Text>
          </TouchableOpacity>
        </View>

        {/* 相关笔记 */}
        {noteData.related_notes.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedSectionTitle}>相关笔记</Text>
            {noteData.related_notes.map((note: RelatedNote) => (
              <RelatedNoteCard
                key={note.id}
                note={note}
                onPress={() => router.push(`/note/${note.id}` as any)}
              />
            ))}
          </View>
        )}

        {/* 占位 */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iOSColors.bgSolid,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: iOSColors.muted,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md + 4,
    paddingBottom: Spacing.sm,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  navRight: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },

  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },

  // Note Header
  noteHeader: {
    marginBottom: Spacing.md,
  },
  noteTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: iOSColors.fg,
    letterSpacing: -0.025,
    lineHeight: 28,
    marginBottom: Spacing.xs,
  },
  noteHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  courseTag: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#fce8e0',
  },
  courseTagText: {
    fontSize: 12,
    fontWeight: '500',
    color: iOSColors.accent,
  },
  noteDate: {
    fontSize: 12,
    color: iOSColors.muted,
  },

  // Illustration
  illustration: {
    borderRadius: Rounded.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    backgroundColor: '#fce8e0',
  },
  illustrationEmoji: {
    fontSize: 48,
  },

  // Content
  noteContent: {
    marginBottom: Spacing.lg,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 24,
    color: iOSColors.fg,
    marginBottom: Spacing.sm,
  },

  // Code Block
  codeBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: Rounded.md,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: '#ddd',
  },

  // Highlight
  highlightBlock: {
    backgroundColor: iOSColors.accentLight,
    borderLeftWidth: 3,
    borderLeftColor: iOSColors.accent,
    borderRadius: Rounded.sm,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
  },
  highlightText: {
    fontSize: 14,
    lineHeight: 20,
    color: iOSColors.fg,
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: iOSColors.surface,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: iOSColors.muted,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: iOSColors.accent,
    borderRadius: Rounded.md,
    padding: Spacing.sm,
    minHeight: 44,
  },
  actionBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    minHeight: 44,
  },
  actionBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.fg,
  },

  // Related Notes
  relatedSection: {
    marginBottom: Spacing.lg,
  },
  relatedSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: Spacing.sm,
  },
  relatedItem: {
    backgroundColor: iOSColors.surface,
    borderRadius: Rounded.md,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
    minHeight: 44,
  },
  relatedIcon: {
    width: 32,
    height: 32,
    borderRadius: Rounded.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relatedText: {
    flex: 1,
  },
  relatedTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: iOSColors.fg,
    marginBottom: 2,
  },
  relatedMeta: {
    fontSize: 11,
    color: iOSColors.muted,
  },
});