/**
 * Whiteboard Overlay Component
 *
 * Renders whiteboard content from Agent actions (wb_draw_text, wb_draw_shape)
 * Used during teaching and interactive scenes to display formulas and key points.
 */

import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
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
  onClose: () => void;
}

export function WhiteboardOverlay({ visible, actions, onClose }: WhiteboardOverlayProps) {
  // Calculate scale based on screen width (match Web端 1000px viewport)
  const screenWidth = Dimensions.get('window').width;
  const whiteboardWidth = Math.min(screenWidth * 0.9, 400);
  const scale = whiteboardWidth / VIEWPORT_WIDTH;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.whiteboard}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="pencil" size={24} color="#5b9bd5" />
            <Text style={styles.title}>白板</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Whiteboard content area */}
          <View style={styles.contentArea}>
            {actions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>暂无白板内容</Text>
                <Text style={styles.emptyHint}>Agent讲解时会在这里绘制知识点</Text>
              </View>
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
                    // Simple shape rendering (rect, circle, line)
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

          {/* Footer hint */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {actions.length > 0
                ? `已绘制 ${actions.length} 个内容`
                : '点击关闭等待讲解'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  whiteboard: {
    backgroundColor: Colors.neutral.white,
    borderRadius: Rounded.lg,
    width: '90%',
    maxWidth: 400,
    minHeight: 300,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
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
});