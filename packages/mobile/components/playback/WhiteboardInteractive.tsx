/**
 * 移动端白板组件 - 支持手势绘制
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { Canvas, Path, Group, Paint } from '@shopify/react-native-skia';
import { useI18n } from '@/lib/i18n';

interface WhiteboardElement {
  id: string;
  type: 'path' | 'text' | 'shape';
  data: any;
  color: string;
  strokeWidth: number;
}

interface WhiteboardProps {
  width?: number;
  height?: number;
  elements?: WhiteboardElement[];
  onElementAdd?: (element: WhiteboardElement) => void;
  onClear?: () => void;
  editable?: boolean;
}

const COLORS = ['#333333', '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#ffffff'];
const STROKE_WIDTHS = [2, 4, 8, 12];

export function Whiteboard({
  width,
  height,
  elements = [],
  onElementAdd,
  onClear,
  editable = true,
}: WhiteboardProps) {
  const { t } = useI18n();
  const screenWidth = width || Dimensions.get('window').width - 40;
  const screenHeight = height || screenWidth * 0.75;

  // 绘制状态
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [paths, setPaths] = useState<WhiteboardElement[]>(elements);
  const [color, setColor] = useState('#333333');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [showTools, setShowTools] = useState(true);

  // PanResponder 处理手势绘制
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editable,
      onMoveShouldSetPanResponder: () => editable,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        if (!editable) return;
        const { locationX, locationY } = evt.nativeEvent;
        // 开始新路径
        const startX = Math.max(0, Math.min(locationX, screenWidth));
        const startY = Math.max(0, Math.min(locationY, screenHeight));
        setCurrentPath(`M ${startX} ${startY}`);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        if (!currentPath) return;
        const { locationX, locationY } = evt.nativeEvent;
        // 添加路径点
        const x = Math.max(0, Math.min(locationX, screenWidth));
        const y = Math.max(0, Math.min(locationY, screenHeight));
        setCurrentPath((prev) => prev ? `${prev} L ${x} ${y}` : `M ${x} ${y}`);
      },
      onPanResponderRelease: () => {
        if (currentPath) {
          const newElement: WhiteboardElement = {
            id: `path_${Date.now()}`,
            type: 'path',
            data: currentPath,
            color,
            strokeWidth,
          };
          setPaths((prev) => [...prev, newElement]);
          onElementAdd?.(newElement);
          setCurrentPath(null);
        }
      },
    })
  ).current;

  const handleUndo = () => {
    setPaths((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPath(null);
    onClear?.();
  };

  return (
    <View style={[styles.container, { width: screenWidth, height: screenHeight + (showTools && editable ? 60 : 0) }]}>
      {/* 白板画布 */}
      <View
        style={[styles.canvas, { width: screenWidth, height: screenHeight }]}
        {...panResponder.panHandlers}
      >
        <Canvas style={{ width: screenWidth, height: screenHeight }}>
          {/* 背景 */}
          <Path
            path={`M 0 0 L ${screenWidth} 0 L ${screenWidth} ${screenHeight} L 0 ${screenHeight} Z`}
            color="#ffffff"
          />

          {/* 已绘制的路径 */}
          <Group>
            {paths.map((el) => {
              if (el.type === 'path') {
                return (
                  <Path
                    key={el.id}
                    path={el.data}
                    color={el.color}
                    style="stroke"
                    strokeWidth={el.strokeWidth}
                    strokeCap="round"
                    strokeJoin="round"
                  />
                );
              }
              return null;
            })}
          </Group>

          {/* 当前正在绘制的路径 */}
          {currentPath && (
            <Path
              path={currentPath}
              color={color}
              style="stroke"
              strokeWidth={strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          )}
        </Canvas>
      </View>

      {/* 工具栏 */}
      {editable && showTools && (
        <View style={styles.toolbar}>
          {/* 颜色选择 */}
          <View style={styles.colorPicker}>
            {COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorButton, { backgroundColor: c }, color === c && styles.colorButtonActive]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>

          {/* 笔触大小 */}
          <View style={styles.strokePicker}>
            {STROKE_WIDTHS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.strokeButton, strokeWidth === s && styles.strokeButtonActive]}
                onPress={() => setStrokeWidth(s)}
              >
                <View style={[styles.strokeIndicator, { width: s, height: s }]} />
              </TouchableOpacity>
            ))}
          </View>

          {/* 操作按钮 */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleUndo}>
              <Text style={styles.actionButtonText}>{t('whiteboard.undo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={handleClear}>
              <Text style={styles.actionButtonText}>{t('whiteboard.clear')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  canvas: {
    backgroundColor: '#ffffff',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  colorPicker: {
    flexDirection: 'row',
    gap: 4,
  },
  colorButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  colorButtonActive: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  strokePicker: {
    flexDirection: 'row',
    gap: 8,
  },
  strokeButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  strokeButtonActive: {
    borderColor: '#007AFF',
  },
  strokeIndicator: {
    backgroundColor: '#333',
    borderRadius: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#eee',
  },
  clearButton: {
    backgroundColor: '#ffebee',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
  },
});