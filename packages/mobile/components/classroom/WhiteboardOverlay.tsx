/**
 * Whiteboard Overlay Component
 *
 * Renders whiteboard content from Agent actions (wb_draw_text, wb_draw_shape)
 * Used during teaching and interactive scenes to display formulas and key points.
 */

import React, { memo, useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, useWindowDimensions, Alert } from 'react-native';
import Animated, {
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { ScreenCanvas } from '@/components/slide/ScreenCanvas';
import { whiteboardStore } from '@/lib/whiteboard/element-store';
import { useResponsiveDimensions } from '@/lib/utils/responsive';
import { apiClient } from '@/lib/api-client';

// 真正的数学符号（排除基本运算符 = + -，它们在普通文本中很常见）
const MATH_SYMBOLS = ['∑', '∫', '∂', '√', '∞', 'π', 'α', 'β', 'γ', 'δ', 'θ', 'λ', 'μ', 'σ', 'ω', 'φ', 'ψ', 'Ω', 'Δ', '∇', '±', '≠', '≤', '≥', '×', '÷', '∈', '∉', '⊂', '⊃', '∪', '∩', '∀', '∃', '→', '↔', '⟹', '∝', '∘', '⊥', '∥', '∠', '°', '′', '″', '²', '³', '⁴', '⁵', 'ⁿ', '₀', '₁', '₂', '₃', '₄', '₅', 'ₙ', '‰', '‱'];

// 代码块显示行数阈值（超过则默认折叠）
const CODE_COLLAPSE_THRESHOLD = 10;

/**
 * 解码 HTML 实体
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * 预处理内容，提取代码块
 * 返回分段数组，每段可以是普通文本或代码块
 */
function parseContentSegments(content: string): Array<{ type: 'text' | 'code'; content: string; lang?: string }> {
  // 先解码 HTML 实体
  const decodedContent = decodeHtmlEntities(content);
  const segments: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = [];
  const lines = decodedContent.split('\n');
  let inCodeBlock = false;
  let codeLang = '';
  let codeContent = '';
  let textContent = '';

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // 结束代码块
        segments.push({ type: 'code', content: codeContent, lang: codeLang });
        codeContent = '';
        codeLang = '';
        inCodeBlock = false;
      } else {
        // 开始代码块
        if (textContent) {
          segments.push({ type: 'text', content: textContent });
          textContent = '';
        }
        codeLang = line.trim().slice(3).trim() || 'code';
        inCodeBlock = true;
      }
    } else if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line;
    } else {
      textContent += (textContent ? '\n' : '') + line;
    }
  }

  // 处理剩余内容
  if (textContent) {
    segments.push({ type: 'text', content: textContent });
  }
  if (codeContent) {
    segments.push({ type: 'code', content: codeContent, lang: codeLang });
  }

  return segments;
}

/**
 * 代码块渲染组件 - 支持折叠/展开
 */
const CodeBlock = memo(function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = code.split('\n');
  const shouldCollapse = lines.length > CODE_COLLAPSE_THRESHOLD;
  const displayLines = shouldCollapse && !expanded ? lines.slice(0, CODE_COLLAPSE_THRESHOLD) : lines;

  return (
    <View style={styles.codeBlock}>
      <View style={styles.codeHeader}>
        <Text style={styles.codeLang}>{lang || 'code'}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={styles.codeText}>
          {displayLines.map((line, i) => `${i + 1}  ${line}`).join('\n')}
        </Text>
      </ScrollView>
      {shouldCollapse && (
        <TouchableOpacity
          style={styles.codeExpandBtn}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={styles.codeExpandText}>
            {expanded ? `收起 (${lines.length} 行)` : `展开全部 (${lines.length} 行)`}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={Colors.primary.main}
          />
        </TouchableOpacity>
      )}
    </View>
  );
});

/**
 * 可滚动表格组件 - 支持横向滚动和阴影指示器
 */
const ScrollableTable = memo(function ScrollableTable({ rows }: { rows: string[][] }) {
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const contentWidthRef = useRef(0);
  const layoutWidthRef = useRef(0);

  const handleScroll = (event: any) => {
    const { contentOffset } = event.nativeEvent;
    const isAtLeft = contentOffset.x <= 5;
    const isAtRight = contentOffset.x >= contentWidthRef.current - layoutWidthRef.current - 5;
    setShowLeftShadow(!isAtLeft);
    setShowRightShadow(!isAtRight);
  };

  const onContentSizeChange = (w: number) => {
    contentWidthRef.current = w;
    setShowRightShadow(w > layoutWidthRef.current);
  };

  const onLayout = (event: any) => {
    layoutWidthRef.current = event.nativeEvent.layout.width;
  };

  return (
    <View style={styles.tableWrapper} onLayout={onLayout}>
      {showLeftShadow && <View style={styles.tableShadowLeft} />}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onContentSizeChange={onContentSizeChange}
        scrollEventThrottle={16}
      >
        <View>
          {rows.map((cells, ri) => (
            <View key={ri} style={styles.tableRow}>
              {cells.map((cell, ci) => (
                <View key={ci} style={styles.tableCell}>
                  <Text style={styles.tableCellText} numberOfLines={2} ellipsizeMode="tail">{cell.trim()}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      {showRightShadow && <View style={styles.tableShadowRight} />}
    </View>
  );
});

/**
 * 解析文本行并提取表格块
 * 返回分段数组，表格会被合并为table类型
 */
function parseTextSegments(lines: string[]): Array<{ type: 'line' | 'table'; line?: string; rows?: string[][] }> {
  const result: Array<{ type: 'line' | 'table'; line?: string; rows?: string[][] }> = [];
  let tableRows: string[][] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 检测表格行 (| col1 | col2 |)
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      const cells = trimmedLine.split('|').filter(c => c.trim());
      // 跳过表格分隔行 (|---|---|)
      if (cells.every(c => c.match(/^[-:]+$/))) {
        continue; // 忽略分隔行，但保持在表格模式
      }
      tableRows.push(cells);
      inTable = true;
    } else {
      // 如果之前有表格，先保存
      if (inTable && tableRows.length > 0) {
        result.push({ type: 'table', rows: tableRows });
        tableRows = [];
      }
      inTable = false;
      result.push({ type: 'line', line });
    }
  }

  // 处理末尾的表格
  if (tableRows.length > 0) {
    result.push({ type: 'table', rows: tableRows });
  }

  return result;
}

/**
 * 解析并渲染结构化白板内容
 * 支持树结构、流程图、公式、代码块、表格等
 */
const StructuredContent = memo(function StructuredContent({ content }: { content: string }) {
  // 预解析内容为分段，处理代码块
  const segments = useMemo(() => parseContentSegments(content), [content]);

  return (
    <View style={styles.structuredContent}>
      {segments.map((segment, segIndex) => {
        if (segment.type === 'code') {
          return <CodeBlock key={`code-${segIndex}`} code={segment.content} lang={segment.lang} />;
        }

        // 处理文本段落 - 使用解析表格的分段逻辑
        const textSegments = useMemo(() => parseTextSegments(segment.content.split('\n')), [segment.content]);

        return (
          <View key={`text-${segIndex}`}>
            {textSegments.map((seg, segIdx) => {
              if (seg.type === 'table' && seg.rows) {
                // 渲染表格
                if (seg.rows.length === 1) {
                  // 单行表格直接渲染，不需要滚动
                  return (
                    <View key={`table-${segIdx}`} style={styles.tableRow}>
                      {seg.rows[0].map((cell, i) => (
                        <View key={i} style={styles.tableCell}>
                          <Text style={styles.tableCellText} numberOfLines={2} ellipsizeMode="tail">{cell.trim()}</Text>
                        </View>
                      ))}
                    </View>
                  );
                }
                // 多行表格使用 ScrollableTable
                return <ScrollableTable key={`table-${segIdx}`} rows={seg.rows} />;
              }

              // 渲染普通行
              const line = seg.line || '';
              const trimmedLine = line.trim();
              const key = `${segIndex}-${segIdx}`;

              // 检测树结构节点 (├──, └──, │)
              if (trimmedLine.includes('├──') || trimmedLine.includes('└──') || trimmedLine.startsWith('│')) {
                const indentLevel = (line.match(/^[│\s]+/)?.[0]?.length || 0) / 2;
                const isLast = trimmedLine.includes('└──');
                const prefix = isLast ? '└── ' : '├── ';
                const nodeText = trimmedLine.replace(/^[│\s]*(├──|└──)\s*/, '');

                return (
                  <View key={key} style={[styles.treeNode, { marginLeft: indentLevel * 20 }]}>
                    <Text style={styles.treePrefix}>{prefix}</Text>
                    <View style={styles.treeNodeBox}>
                      <Text style={styles.treeNodeText} numberOfLines={1}>{nodeText}</Text>
                    </View>
                  </View>
                );
              }

              // 检测标题/框 (【xxx】或方括号内容)
              const bracketMatch = trimmedLine.match(/^【(.+)】$/);
              if (bracketMatch) {
                return (
                  <View key={key} style={styles.titleBox}>
                    <Text style={styles.titleText}>{bracketMatch[1]}</Text>
                  </View>
                );
              }

              // 检测流程箭头 (A → B 或步骤序列，排除单箭头符号)
              if ((trimmedLine.includes('→') || trimmedLine.includes('->')) && trimmedLine.length > 3) {
                let parts: string[];
                if (trimmedLine.includes('→')) {
                  parts = trimmedLine.split('→');
                } else {
                  parts = trimmedLine.split('->');
                }
                return (
                  <View key={key} style={styles.flowLine}>
                    {parts.map((part, i) => (
                      <View key={i} style={styles.flowPart}>
                        <View style={styles.flowBox}>
                          <Text style={styles.flowText} numberOfLines={1}>{part.trim()}</Text>
                        </View>
                        {i < parts.length - 1 && (
                          <Text style={styles.flowArrow}>→</Text>
                        )}
                      </View>
                    ))}
                  </View>
                );
              }

              // 检测公式 (包含真正的数学符号，排除基本运算符)
              const hasMathSymbol = MATH_SYMBOLS.some(s => trimmedLine.includes(s));
              const hasComplexFormula = trimmedLine.match(/\d+\s*[×÷]\s*\d+/) ||
                                        trimmedLine.match(/[a-z]\s*²|[a-z]\s*³/i) ||
                                        trimmedLine.match(/\^\{.*\}/) ||
                                        trimmedLine.match(/_[a-z]|\_[0-9]/i) ||
                                        trimmedLine.match(/frac|sqrt|integral|sum/i);
              if ((hasMathSymbol || hasComplexFormula) && !trimmedLine.includes('█')) {
                return (
                  <View key={key} style={styles.formulaBox}>
                    <Text style={styles.formulaText}>{trimmedLine}</Text>
                  </View>
                );
              }

              // 检测柱状图 (█ 符号)
              if (trimmedLine.includes('█')) {
                const labelMatch = trimmedLine.match(/^(.+?)\s+(█+)\s+(\d+)$/);
                if (labelMatch) {
                  const label = labelMatch[1];
                  const bars = labelMatch[2];
                  const value = labelMatch[3];
                  return (
                    <View key={key} style={styles.barRow}>
                      <Text style={styles.barLabel}>{label}</Text>
                      <View style={styles.barContainer}>
                        <View style={[styles.bar, { width: bars.length * 8 }]}>
                          <Text style={styles.barFill}>{bars}</Text>
                        </View>
                      </View>
                      <Text style={styles.barValue}>{value}</Text>
                    </View>
                  );
                }
                // 简单柱状图（无数值）
                const simpleMatch = trimmedLine.match(/^(.+?)\s+(█+)$/);
                if (simpleMatch) {
                  return (
                    <View key={key} style={styles.barRow}>
                      <Text style={styles.barLabel}>{simpleMatch[1]}</Text>
                      <View style={styles.barContainer}>
                        <View style={[styles.bar, { width: simpleMatch[2].length * 8 }]}>
                          <Text style={styles.barFill}>{simpleMatch[2]}</Text>
                        </View>
                      </View>
                    </View>
                  );
                }
              }

              // 检测列表项 (- 或 1. 等)
              if (trimmedLine.match(/^[-*]\s/) || trimmedLine.match(/^\d+[.]\s/)) {
                const bullet = trimmedLine.match(/^[-*]/) ? '•' : trimmedLine.match(/^\d+/)?.[0] + '.';
                const text = trimmedLine.replace(/^[-*\d.]+\s*/, '');
                return (
                  <View key={key} style={styles.listItem}>
                    <Text style={styles.listBullet}>{bullet}</Text>
                    <Text style={styles.listText}>{text}</Text>
                  </View>
                );
              }

              // 检测分隔线
              if (trimmedLine.match(/^[-─━]{3,}$/)) {
                return <View key={key} style={styles.separator} />;
              }

              // 检测标题行 (# ## ###)
              if (trimmedLine.match(/^#{1,6}\s/)) {
                const level = trimmedLine.match(/^#+/)?.[0]?.length || 1;
                const titleText = trimmedLine.replace(/^#+\s*/, '');
                const fontSize = [24, 20, 18, 16, 14, 14][level - 1] || 14;
                return (
                  <Text key={key} style={[styles.headingText, { fontSize }]}>{titleText}</Text>
                );
              }

              // 检测强调文本 (**text** 或 *text*)
              if (trimmedLine.match(/\*\*.*\*\*/) || trimmedLine.match(/\*[^*]+\*/)) {
                const cleanText = trimmedLine.replace(/\*\*/g, '').replace(/\*/g, '');
                const isBold = trimmedLine.includes('**');
                return (
                  <Text key={key} style={[styles.normalText, isBold && styles.boldText]}>{cleanText}</Text>
                );
              }

              // 普通文本
              if (trimmedLine) {
                return <Text key={key} style={styles.normalText}>{trimmedLine}</Text>;
              }

              // 空行
              return <View key={key} style={styles.emptyLine} />;
            })}
          </View>
        );
      })}
    </View>
  );
});

interface WhiteboardOverlayProps {
  visible: boolean;
  /** 纯文本图表内容（legacy fallback） */
  textContent?: string | null;
  onClose: () => void;
  /** 聊天面板是否打开 — 白板全屏覆盖，底部留聊天切换按钮 */
  chatVisible?: boolean;
  /** 点击聊天切换按钮的回调 */
  onToggleChat?: () => void;
  /** 语音播放状态 */
  playbackMode?: 'idle' | 'playing' | 'paused';
  /** 横屏模式 */
  isLandscape?: boolean;
  /** 课程 ID（保存笔记时使用） */
  courseId?: string;
  /** 当前场景 ID（保存笔记时关联课程场景） */
  sceneId?: string;
}

export function WhiteboardOverlay({
  visible,
  textContent,
  onClose,
  chatVisible = false,
  onToggleChat,
  playbackMode = 'idle',
  isLandscape = false,
  courseId,
  sceneId,
}: WhiteboardOverlayProps) {
  const elements = whiteboardStore.useElements();
  const pages = whiteboardStore.usePages();
  const hasElements = elements.length > 0;
  const hasPages = pages.length > 0;
  const hasTextContent = !!textContent;
  const { isPhone, isCompact } = useResponsiveDimensions();
  const windowDims = useWindowDimensions();

  // 保存笔记中状态
  const [savingNote, setSavingNote] = useState(false);
  // 历史页查看模式
  const [viewingHistory, setViewingHistory] = useState(false);

  /**
   * 将白板元素转为 Markdown 文本（包含所有页）
   */
  const whiteboardToMarkdown = useCallback((): string => {
    const allPages = whiteboardStore.getPages();
    const currentEls = whiteboardStore.getElements();
    const lines: string[] = [];

    const elementsToMarkdown = (els: typeof currentEls, pageNum?: number) => {
      if (pageNum && els.length > 0) {
        lines.push(`\n## 白板 ${pageNum}\n`);
      }
      for (const el of els) {
        if (el.type === 'text' && (el as any).content) {
          const text = (el as any).content.replace(/<[^>]+>/g, '').trim();
          if (!text) continue;
          const id = (el.id || '').toLowerCase();
          if (id === 'title' || id.startsWith('title')) {
            lines.push(`### ${text}\n`);
          } else if (id.startsWith('point')) {
            lines.push(`- ${text}`);
          } else if (id.startsWith('highlight') || id.startsWith('shape_') || id.startsWith('line_')) {
            lines.push(`> ${text}`);
          } else {
            lines.push(text);
          }
        }
        // shape 和 line 的 label
        if (el.type === 'shape' && (el as any).text?.content) {
          const label = (el as any).text.content.replace(/<[^>]+>/g, '').trim();
          if (label) lines.push(`- ▢ ${label}`);
        }
      }
    };

    // 历史页
    allPages.forEach((page, i) => elementsToMarkdown(page.elements, i + 1));
    // 当前页
    if (currentEls.length > 0) {
      elementsToMarkdown(currentEls, allPages.length + 1);
    }

    if (lines.length === 0 && textContent) {
      return textContent;
    }
    return lines.join('\n');
  }, [textContent]);

  /**
   * 一键保存白板内容到笔记（含所有页）
   */
  const handleSaveToNote = useCallback(async () => {
    const markdown = whiteboardToMarkdown();
    if (!markdown.trim()) {
      Alert.alert('提示', '白板暂无内容可保存');
      return;
    }

    setSavingNote(true);
    try {
      const firstLine = markdown.split('\n').find(l => l.trim())?.trim() || '白板笔记';
      const title = firstLine.replace(/^##\s*/, '').slice(0, 50);

      await apiClient.createPersonalNote({
        title,
        content: markdown.trim(),
        course_id: courseId,
        scene_id: sceneId,
        category: '白板笔记',
        color: 'blue',
        starred: false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('已保存', '白板内容已加入笔记');
    } catch (error: any) {
      if (error.response?.status === 401) {
        Alert.alert('需要登录', '请先登录后再保存笔记');
      } else if (error.response?.status === 409) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('已添加过', '这条白板内容已经加入过笔记');
      } else {
        Alert.alert('保存失败', '请稍后重试');
      }
    } finally {
      setSavingNote(false);
    }
  }, [whiteboardToMarkdown, courseId, sceneId]);

  /**
   * 手动清空白板（含历史页）
   */
  const handleClearAll = useCallback(() => {
    Alert.alert(
      '清空白板',
      '将清空当前白板和所有历史白板内容，此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清空',
          style: 'destructive',
          onPress: () => {
            whiteboardStore.clearAll();
            setViewingHistory(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  }, []);

  // 白板占满全部空间（聊天面板已移除，由外部独立渲染）
  const whiteboardStyle = useAnimatedStyle(() => ({
    flex: 1,
  }));

  if (!visible) return null;

  const isCompactPhone = isPhone || isCompact;
  const headerPadding = isCompactPhone ? 6 : Spacing.sm;
  const totalPageCount = pages.length + (hasElements ? 1 : 0);

  return (
    <View style={[
      styles.overlayContainer,
      isLandscape && styles.overlayContainerLandscape,
    ]}>
      {/* 白板内容区域 */}
      <Animated.View style={[styles.whiteboardAnimatedArea, whiteboardStyle]}>
        <View style={styles.whiteboard}>
          {/* Header */}
          <View style={[styles.header, { padding: headerPadding }]}>
            <Ionicons name="pencil" size={16} color="#5b9bd5" />
            <Text style={styles.title}>
              白板{totalPageCount > 1 ? ` (${viewingHistory ? '历史' : '当前'} · ${totalPageCount}页)` : ''}
            </Text>

            {/* 语音播放指示器 */}
            {playbackMode === 'playing' && (
              <View style={styles.playbackBadge}>
                <Ionicons name="volume-high" size={12} color="white" />
                <Text style={styles.playbackBadgeText}>播放中</Text>
              </View>
            )}
            {playbackMode === 'paused' && (
              <View style={[styles.playbackBadge, styles.playbackBadgePaused]}>
                <Ionicons name="pause" size={12} color="#f59e0b" />
                <Text style={[styles.playbackBadgeText, { color: '#f59e0b' }]}>已暂停</Text>
              </View>
            )}

            {/* 历史页切换按钮 */}
            {hasPages && (
              <TouchableOpacity
                style={[styles.saveNoteBtn, viewingHistory && { backgroundColor: '#5b9bd5', borderColor: '#5b9bd5' }]}
                onPress={() => setViewingHistory(!viewingHistory)}
                activeOpacity={0.7}
              >
                <Ionicons name={viewingHistory ? 'pencil' : 'layers-outline'} size={15} color={viewingHistory ? 'white' : '#5b9bd5'} />
                <Text style={[styles.saveNoteBtnText, viewingHistory && { color: 'white' }]}>
                  {viewingHistory ? '当前' : `历史${pages.length}`}
                </Text>
              </TouchableOpacity>
            )}

            {/* 聊天切换按钮（聊天关闭时显示） */}
            {onToggleChat && !chatVisible && (
              <TouchableOpacity
                style={styles.chatToggleBtn}
                onPress={onToggleChat}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubble-ellipses" size={16} color="#5b9bd5" />
                <Text style={styles.chatToggleText}>对话</Text>
              </TouchableOpacity>
            )}

            {/* 加入笔记按钮 */}
            {(hasElements || hasTextContent || hasPages) && (
              <TouchableOpacity
                style={styles.saveNoteBtn}
                onPress={handleSaveToNote}
                disabled={savingNote}
                activeOpacity={0.7}
              >
                <Ionicons name="bookmark-outline" size={15} color={savingNote ? '#ccc' : '#5b9bd5'} />
                <Text style={[styles.saveNoteBtnText, savingNote && { color: '#ccc' }]}>
                  {savingNote ? '保存中...' : '加入笔记'}
                </Text>
              </TouchableOpacity>
            )}

            {/* 清空按钮 */}
            {(hasElements || hasPages) && (
              <TouchableOpacity
                onPress={handleClearAll}
                style={styles.closeBtn}
              >
                <Ionicons name="trash-outline" size={16} color="#e74c3c" />
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Whiteboard content area */}
          <View style={styles.contentArea}>
            {viewingHistory && hasPages ? (
              // 历史页查看模式：垂直滚动浏览所有历史页
              <ScrollView style={styles.textScrollView} contentContainerStyle={{ padding: Spacing.sm }}>
                {pages.map((page, pageIdx) => (
                  <View key={page.id} style={styles.historyPageCard}>
                    <View style={styles.historyPageHeader}>
                      <Text style={styles.historyPageTitle}>白板 {pageIdx + 1}</Text>
                      <Text style={styles.historyPageCount}>{page.elements.length} 个元素</Text>
                    </View>
                    <ScreenCanvas
                      elements={page.elements}
                      background={{ type: 'solid', color: '#f8f9fa' }}
                      isWhiteboard
                    />
                  </View>
                ))}
              </ScrollView>
            ) : !hasElements && !hasTextContent ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={32} color="#ccc" />
                <Text style={styles.emptyText}>暂无白板内容</Text>
                {hasPages && (
                  <TouchableOpacity
                    style={styles.viewHistoryBtn}
                    onPress={() => setViewingHistory(true)}
                  >
                    <Ionicons name="layers-outline" size={16} color="#5b9bd5" />
                    <Text style={styles.viewHistoryText}>查看 {pages.length} 页历史白板</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : hasElements ? (
              <ScreenCanvas
                elements={elements}
                background={{ type: 'solid', color: '#f8f9fa' }}
                scrollable
                isWhiteboard
              />
            ) : (
              <ScrollView style={styles.textScrollView} contentContainerStyle={styles.textScrollContent}>
                <StructuredContent content={textContent!.replace(/```[\w]*\n?/g, '').replace(/```$/g, '')} />
              </ScrollView>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 全屏覆盖容器
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: 'white',
  },
  overlayContainerLandscape: {
    // 横屏时保持全屏，白板获得更多水平空间
  },
  // 白板动画区域（flex 分配空间）
  whiteboardAnimatedArea: {
    overflow: 'hidden',
  },
  whiteboard: {
    flex: 1,
    backgroundColor: Colors.neutral.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: Spacing.xs,
    color: Colors.neutral.textPrimary,
  },
  // 语音播放状态指示器
  playbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Rounded.full,
    marginRight: Spacing.sm,
  },
  playbackBadgePaused: {
    backgroundColor: '#fef3c7',
  },
  playbackBadgeText: {
    fontSize: 11,
    color: 'white',
    fontWeight: '500',
    marginLeft: 3,
  },
  // 聊天切换按钮
  chatToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Rounded.full,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  chatToggleText: {
    fontSize: 12,
    color: '#5b9bd5',
    fontWeight: '500',
    marginLeft: 3,
  },
  saveNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Rounded.full,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  saveNoteBtnText: {
    fontSize: 12,
    color: '#5b9bd5',
    fontWeight: '500',
    marginLeft: 3,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: Spacing.sm,
  },
  viewHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#eff6ff',
    borderRadius: Rounded.full,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  viewHistoryText: {
    fontSize: 13,
    color: '#5b9bd5',
    fontWeight: '500',
    marginLeft: 6,
  },
  historyPageCard: {
    backgroundColor: 'white',
    borderRadius: Rounded.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  historyPageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  historyPageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.textPrimary,
  },
  historyPageCount: {
    fontSize: 12,
    color: '#999',
  },
  // 文本图表样式 - 支持内容扩展
  textScrollView: {
    flex: 1,
    // 移除 maxHeight 限制，允许内容扩展
  },
  textScrollContent: {
    padding: Spacing.md,
    flexGrow: 1, // 允许内容增长
  },
  // 结构化内容样式
  structuredContent: {
    flex: 1,
  },
  treeNode: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  treePrefix: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  treeNodeBox: {
    backgroundColor: '#e8f4f8',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
    maxWidth: Dimensions.get('window').width - 40,
  },
  treeNodeText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  titleBox: {
    backgroundColor: '#5b9bd5',
    borderRadius: Rounded.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  titleText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  flowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  flowPart: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flowBox: {
    backgroundColor: '#f0f4f8',
    borderWidth: 1,
    borderColor: '#5b9bd5',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: Dimensions.get('window').width - 40,
  },
  flowText: {
    fontSize: 13,
    color: '#333',
  },
  flowArrow: {
    fontSize: 18,
    color: '#5b9bd5',
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '600',
  },
  formulaBox: {
    backgroundColor: '#fff9e6',
    borderWidth: 1,
    borderColor: '#f0d78c',
    borderRadius: Rounded.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  formulaText: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: '#333',
    textAlign: 'center',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  barLabel: {
    fontSize: 12,
    color: '#333',
    width: 80,
  },
  barContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginHorizontal: 8,
  },
  bar: {
    height: 20,
    backgroundColor: '#5b9bd5',
    borderRadius: 4,
    justifyContent: 'center',
  },
  barFill: {
    fontSize: 10,
    color: 'white',
  },
  barValue: {
    fontSize: 12,
    color: '#333',
    width: 40,
    textAlign: 'right',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  listBullet: {
    fontSize: 14,
    color: '#5b9bd5',
    width: 20,
  },
  listText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 8,
  },
  normalText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
  },
  emptyLine: {
    height: 8,
  },
  // 表格样式
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 4,
  },
  tableSeparator: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 2,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    overflow: 'hidden',
  },
  tableCellText: {
    fontSize: 13,
    color: '#333',
  },
  // 表格滚动指示器
  tableWrapper: {
    position: 'relative',
  },
  tableShadowLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
    backgroundColor: 'rgba(0,0,0,0.08)',
    zIndex: 1,
  },
  tableShadowRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 20,
    backgroundColor: 'rgba(0,0,0,0.08)',
    zIndex: 1,
  },
  // 标题样式
  headingText: {
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    marginTop: 4,
  },
  // 强调文本
  boldText: {
    fontWeight: '600',
    color: '#1a1a1a',
  },
  // 代码块样式
  codeBlock: {
    backgroundColor: '#f5f5f5',
    borderRadius: Rounded.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  codeLang: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  codeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  codeActionBtn: {
    padding: 4,
  },
  codeExpandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  codeExpandText: {
    fontSize: 12,
    color: Colors.primary.main,
  },
  codeText: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#333',
    padding: 10,
    lineHeight: 18,
  },
});