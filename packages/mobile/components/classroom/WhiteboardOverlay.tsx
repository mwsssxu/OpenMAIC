/**
 * Whiteboard Overlay Component
 *
 * Renders whiteboard content from Agent actions (wb_draw_text, wb_draw_shape)
 * Used during teaching and interactive scenes to display formulas and key points.
 */

import React, { memo, useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { ScreenCanvas } from '@/components/slide/ScreenCanvas';
import { whiteboardStore } from '@/lib/whiteboard/element-store';
import { useResponsiveDimensions } from '@/lib/utils/responsive';

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
}

export function WhiteboardOverlay({
  visible,
  textContent,
  onClose,
  chatVisible = false,
  onToggleChat,
  playbackMode = 'idle',
  isLandscape = false,
}: WhiteboardOverlayProps) {
  const elements = whiteboardStore.useElements();
  const hasElements = elements.length > 0;
  const hasTextContent = !!textContent;
  const { isPhone, isCompact } = useResponsiveDimensions();
  const windowDims = useWindowDimensions();

  // 拖拽调整白板/聊天分割比例
  const chatSheetPercent = useSharedValue(chatVisible ? 0.45 : 0);
  const savedChatSheetPercent = useSharedValue(chatVisible ? 0.45 : 0);

  // 当 chatVisible 变化时，动画切换
  React.useEffect(() => {
    if (chatVisible) {
      chatSheetPercent.value = withSpring(0.45, { damping: 20 });
      savedChatSheetPercent.value = 0.45;
    } else {
      chatSheetPercent.value = withSpring(0, { damping: 20 });
      savedChatSheetPercent.value = 0;
    }
  }, [chatVisible]);

  // 拖拽手势调整聊天面板高度
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // 从底部往上拖 → percent 增大
      const screenHeight = windowDims.height;
      const delta = -e.translationY / screenHeight;
      const newPercent = Math.min(0.7, Math.max(0.2, savedChatSheetPercent.value + delta));
      chatSheetPercent.value = newPercent;
    })
    .onEnd(() => {
      savedChatSheetPercent.value = chatSheetPercent.value;
      // 如果拖到很小，自动收起
      if (chatSheetPercent.value < 0.15 && onToggleChat) {
        runOnJS(onToggleChat)();
      }
    });

  // 白板区域动画样式（聊天展开时缩小）
  const whiteboardStyle = useAnimatedStyle(() => ({
    flex: 1 - chatSheetPercent.value,
  }));

  // 聊天面板动画样式
  const chatSheetStyle = useAnimatedStyle(() => ({
    height: `${chatSheetPercent.value * 100}%` as any,
  }));

  if (!visible) return null;

  const isCompactPhone = isPhone || isCompact;
  const headerPadding = isCompactPhone ? 6 : Spacing.sm;

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
            <Text style={styles.title}>白板</Text>

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

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Whiteboard content area */}
          <View style={styles.contentArea}>
            {!hasElements && !hasTextContent ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={32} color="#ccc" />
                <Text style={styles.emptyText}>暂无白板内容</Text>
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

      {/* 聊天面板拖拽区域 + 聊天面板（动画展开/收起） */}
      {onToggleChat && (
        <Animated.View style={[styles.chatSheetContainer, chatSheetStyle]}>
          {/* 拖拽手柄 */}
          <GestureDetector gesture={panGesture}>
            <View style={styles.dragHandleArea}>
              <View style={styles.dragHandle} />
            </View>
          </GestureDetector>
        </Animated.View>
      )}
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
  // 聊天面板容器（覆盖在白板底部）
  chatSheetContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: Rounded.lg,
    borderTopRightRadius: Rounded.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
    overflow: 'hidden',
  },
  // 拖拽手柄区域
  dragHandleArea: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#fafafa',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
  },
});