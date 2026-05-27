/**
 * Whiteboard Overlay Component
 *
 * Renders whiteboard content from Agent actions (wb_draw_text, wb_draw_shape)
 * Used during teaching and interactive scenes to display formulas and key points.
 */

import React, { memo, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { ScreenCanvas } from '@/components/slide/ScreenCanvas';
import { whiteboardStore } from '@/lib/whiteboard/element-store';

// 真正的数学符号（排除基本运算符 = + -，它们在普通文本中很常见）
const MATH_SYMBOLS = ['∑', '∫', '∂', '√', '∞', 'π', 'α', 'β', 'γ', 'δ', 'θ', 'λ', 'μ', 'σ', 'ω', 'φ', 'ψ', 'Ω', 'Δ', '∇', '±', '≠', '≤', '≥', '×', '÷', '∈', '∉', '⊂', '⊃', '∪', '∩', '∀', '∃', '→', '↔', '⟹', '∝', '∘', '⊥', '∥', '∠', '°', '′', '″', '²', '³', '⁴', '⁵', 'ⁿ', '₀', '₁', '₂', '₃', '₄', '₅', 'ₙ', '‰', '‱'];

// 代码块显示行数阈值（超过则默认折叠）
const CODE_COLLAPSE_THRESHOLD = 10;

/**
 * 预处理内容，提取代码块
 * 返回分段数组，每段可以是普通文本或代码块
 */
function parseContentSegments(content: string): Array<{ type: 'text' | 'code'; content: string; lang?: string }> {
  const segments: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = [];
  const lines = content.split('\n');
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
 * 代码块渲染组件 - 支持折叠/展开和复制
 */
const CodeBlock = memo(function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');
  const shouldCollapse = lines.length > CODE_COLLAPSE_THRESHOLD;
  const displayLines = shouldCollapse && !expanded ? lines.slice(0, CODE_COLLAPSE_THRESHOLD) : lines;

  const handleCopy = () => {
    Clipboard.setString(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.codeBlock}>
      <View style={styles.codeHeader}>
        <Text style={styles.codeLang}>{lang || 'code'}</Text>
        <View style={styles.codeActions}>
          <TouchableOpacity onPress={handleCopy} style={styles.codeActionBtn}>
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={16}
              color={copied ? Colors.secondary.success : '#666'}
            />
          </TouchableOpacity>
        </View>
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

        // 处理文本段落
        const lines = segment.content.split('\n');
        return (
          <View key={`text-${segIndex}`}>
            {lines.map((line, index) => {
              const trimmedLine = line.trim();
              const key = `${segIndex}-${index}`;

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
                      <Text style={styles.treeNodeText}>{nodeText}</Text>
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
                          <Text style={styles.flowText}>{part.trim()}</Text>
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

              // 检测表格行 (| col1 | col2 |)
              if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
                const cells = trimmedLine.split('|').filter(c => c.trim());
                // 检测是否是表格分隔行 (|---|---|)
                if (cells.every(c => c.match(/^[-:]+$/))) {
                  return <View key={key} style={styles.tableSeparator} />;
                }
                return (
                  <View key={key} style={styles.tableRow}>
                    {cells.map((cell, i) => (
                      <View key={i} style={styles.tableCell}>
                        <Text style={styles.tableCellText}>{cell.trim()}</Text>
                      </View>
                    ))}
                  </View>
                );
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
  /** 使用 absolute 定位而非 Modal（用于与聊天同时显示） */
  useAbsolute?: boolean;
}

export function WhiteboardOverlay({ visible, textContent, onClose, useAbsolute = false }: WhiteboardOverlayProps) {
  const elements = whiteboardStore.useElements();
  const hasElements = elements.length > 0;
  const hasTextContent = !!textContent;

  // 计算白板画布尺寸 — 使用屏幕宽度的 88% 作为画布宽度（减去边距）
  // ScreenCanvas 内部会根据 scrollable 模式使用屏幕宽度计算 scale

  const content = (
    <View style={[styles.whiteboard, useAbsolute && styles.whiteboardAbsolute]}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="pencil" size={20} color="#5b9bd5" />
        <Text style={styles.title}>白板</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Whiteboard content area */}
      <View style={styles.contentArea}>
        {!hasElements && !hasTextContent ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>暂无白板内容</Text>
          </View>
        ) : hasElements ? (
          /* Element-based rendering via ScreenCanvas (matches web端) */
          <ScreenCanvas
            elements={elements}
            background={{ type: 'solid', color: '#f8f9fa' }}
            scrollable
            isWhiteboard
          />
        ) : (
          /* Legacy text fallback */
          <ScrollView style={styles.textScrollView} contentContainerStyle={styles.textScrollContent}>
            <StructuredContent content={textContent!.replace(/```[\w]*\n?/g, '').replace(/```$/g, '')} />
          </ScrollView>
        )}
      </View>
    </View>
  );

  // absolute 模式：直接渲染 View
  if (useAbsolute) {
    if (!visible) return null;
    return (
      <View style={styles.absoluteContainer}>
        {content}
      </View>
    );
  }

  // Modal 模式：使用 Modal 包裹，支持滚动查看长内容
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <ScrollView
        style={styles.modalScrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={true}
      >
        {content}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Modal 滚动容器
  modalScrollView: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  // absolute 模式容器 - 白板占上方 2/3
  absoluteContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '33%', // 为底部对话框留出 1/3 空间
    zIndex: 5, // 比聊天面板层级低
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  whiteboardAbsolute: {
    flex: 1, // 填满上方区域，允许内容扩展
    borderRadius: Rounded.lg,
  },
  // Modal 模式容器 - 支持白板动态扩展
  container: {
    justifyContent: 'flex-start', // 靠上方
    alignItems: 'center',
    paddingTop: Spacing.md, // 顶部留出一点间距
    paddingBottom: Spacing.xl, // 底部留出滚动空间
    // 允许滚动查看更多内容
  },
  whiteboard: {
    backgroundColor: Colors.neutral.white,
    borderRadius: Rounded.lg,
    width: '92%',
    maxWidth: undefined, // 移除固定 maxWidth，让白板充分利用移动端屏幕
    minHeight: 280,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: Spacing.sm,
    color: Colors.neutral.textPrimary,
  },
  closeBtn: {
    padding: Spacing.sm,
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    minHeight: 200,
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
  },
  tableCellText: {
    fontSize: 13,
    color: '#333',
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