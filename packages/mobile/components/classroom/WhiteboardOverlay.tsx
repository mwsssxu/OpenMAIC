/**
 * Whiteboard Overlay Component
 *
 * Renders whiteboard content from Agent actions (wb_draw_text, wb_draw_shape)
 * Used during teaching and interactive scenes to display formulas and key points.
 */

import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';

const VIEWPORT_WIDTH = 1000; // Web端 viewport 标准

interface WhiteboardAction {
  id: string;
  type: 'wb_draw_text' | 'wb_draw_shape';
  data: {
    // wb_draw_text
    text?: string;
    fontSize?: number;
    color?: string;
    left?: number;
    top?: number;
    // wb_draw_shape
    path?: string;
    width?: number;
    height?: number;
    fill?: string;
    viewBox?: [number, number];
  };
}

interface WhiteboardOverlayProps {
  visible: boolean;
  actions: WhiteboardAction[];
  /** 纯文本图表内容（从 SSE 解析提取） */
  textContent?: string | null;
  onClose: () => void;
  /** 使用 absolute 定位而非 Modal（用于与聊天同时显示） */
  useAbsolute?: boolean;
}

export function WhiteboardOverlay({ visible, actions, textContent, onClose, useAbsolute = false }: WhiteboardOverlayProps) {
  // Calculate scale based on screen width (match Web端 1000px viewport)
  const screenWidth = Dimensions.get('window').width;
  const whiteboardWidth = Math.min(screenWidth * 0.95, 500);
  const scale = whiteboardWidth / VIEWPORT_WIDTH;

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
        {actions.length === 0 && !textContent ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>暂无白板内容</Text>
          </View>
        ) : textContent ? (
          /* 纯文本图表显示 */
          <ScrollView style={styles.textScrollView} contentContainerStyle={styles.textScrollContent}>
            <View style={styles.textDiagramContainer}>
              <Text style={styles.textDiagram}>{textContent.replace(/```[\w]*\n?/g, '').replace(/```$/g, '')}</Text>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.canvas}>
            {actions.map((action) => {
              if (action.type === 'wb_draw_text') {
                return (
                  <View
                    key={action.id}
                    style={[
                      styles.textElement,
                      {
                        left: (action.data.left || 50) * scale,
                        top: (action.data.top || 50) * scale,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.drawText,
                        {
                          fontSize: (action.data.fontSize || 18) * scale,
                          color: action.data.color || '#333333',
                        },
                      ]}
                    >
                      {action.data.text || ''}
                    </Text>
                  </View>
                );
              } else if (action.type === 'wb_draw_shape') {
                return (
                  <View
                    key={action.id}
                    style={[
                      styles.shapeElement,
                      {
                        left: (action.data.left || 50) * scale,
                        top: (action.data.top || 50) * scale,
                        width: (action.data.width || 100) * scale,
                        height: (action.data.height || 50) * scale,
                        backgroundColor: action.data.fill || '#5b9bd5',
                      },
                    ]}
                  />
                );
              }
              return null;
            })}
          </View>
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

  // Modal 模式：使用 Modal 包裹
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {content}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    height: '100%', // 填满上方区域
    borderRadius: Rounded.lg,
  },
  // Modal 模式容器
  container: {
    flex: 1,
    justifyContent: 'flex-start', // 靠上方
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)', // 更透明的背景
    paddingTop: Spacing.md, // 顶部留出一点间距
  },
  whiteboard: {
    backgroundColor: Colors.neutral.white,
    borderRadius: Rounded.lg,
    width: '95%',
    maxWidth: 500,
    height: '66%', // 占屏幕 2/3
    minHeight: 300,
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
    backgroundColor: '#f8f9fa', // Light gray like real whiteboard
    minHeight: 200,
  },
  canvas: {
    flex: 1,
    position: 'relative',
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
  emptyHint: {
    fontSize: 12,
    color: '#ccc',
    marginTop: Spacing.xs,
  },
  textElement: {
    position: 'absolute',
    padding: Spacing.sm,
  },
  drawText: {
    fontWeight: '500',
  },
  shapeElement: {
    position: 'absolute',
    borderRadius: Rounded.sm,
  },
  footer: {
    padding: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral.border,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.neutral.textSecondary,
  },
  // 文本图表样式
  textScrollView: {
    flex: 1,
    maxHeight: 200, // 与白板整体高度匹配
  },
  textScrollContent: {
    padding: Spacing.md,
  },
  textDiagramContainer: {
    backgroundColor: '#f0f4f8',
    borderRadius: Rounded.md,
    padding: Spacing.md,
  },
  textDiagram: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    lineHeight: 20,
    textAlign: 'left',
  },
});