/**
 * 移动端白板组件 - 支持手势绘制、双指缩放和平移
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useI18n } from '@/lib/i18n';
import { Colors } from '@/lib/constants/theme';
import { useHaptics } from '@/lib/hooks/use-haptics';

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

// 缩放限制常量
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

export function Whiteboard({
  width,
  height,
  elements = [],
  onElementAdd,
  onClear,
  editable = true,
}: WhiteboardProps) {
  const { t } = useI18n();
  const haptics = useHaptics();
  const screenWidth = width || Dimensions.get('window').width - 40;
  const screenHeight = height || screenWidth * 0.75;

  // 缩放和平移状态（使用 Reanimated）
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // 绘制状态
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [paths, setPaths] = useState<WhiteboardElement[]>(elements);
  const [color, setColor] = useState('#333333');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [showTools, setShowTools] = useState(true);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomIndicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 同步外部 elements
  useEffect(() => {
    setPaths(elements);
  }, [elements]);

  // 更新缩放指示器
  const updateZoomIndicator = useCallback(() => {
    setShowZoomIndicator(true);
    if (zoomIndicatorTimeout.current) {
      clearTimeout(zoomIndicatorTimeout.current);
    }
    zoomIndicatorTimeout.current = setTimeout(() => {
      setShowZoomIndicator(false);
    }, 1500);
  }, []);

  // 缩放结束时回调
  const onPinchEnd = useCallback(() => {
    updateZoomIndicator();
    if (scale.value < 0.8 || scale.value > 2.5) {
      haptics.light();
    }
  }, [updateZoomIndicator, haptics]);

  // 双指缩放手势
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = savedScale.value * e.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      runOnJS(onPinchEnd)();
    });

  // 双指平移手势
  const panGesture = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // 添加路径
  const addPath = useCallback((pathData: string) => {
    const newElement: WhiteboardElement = {
      id: `path_${Date.now()}`,
      type: 'path',
      data: pathData,
      color,
      strokeWidth,
    };
    setPaths((prev) => [...prev, newElement]);
    onElementAdd?.(newElement);
    setCurrentPath(null);
  }, [color, strokeWidth, onElementAdd]);

  // 更新当前路径
  const updateCurrentPath = useCallback((newPath: string) => {
    setCurrentPath(newPath);
  }, []);

  // 单指绘制手势
  const drawGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart((e) => {
      if (!editable) return;
      // 将屏幕坐标转换为画布坐标
      const x = (e.x - translateX.value) / scale.value;
      const y = (e.y - translateY.value) / scale.value;
      runOnJS(updateCurrentPath)(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
    })
    .onUpdate((e) => {
      if (!editable) return;
      const x = (e.x - translateX.value) / scale.value;
      const y = (e.y - translateY.value) / scale.value;
      setCurrentPath((prev) => prev ? `${prev} L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`);
    })
    .onEnd(() => {
      if (!editable || !currentPath) return;
      runOnJS(addPath)(currentPath);
    });

  // 组合手势：绘制、缩放、平移
  const composedGesture = Gesture.Simultaneous(
    drawGesture,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  // 画布变换样式
  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // 重置视图
  const handleResetView = useCallback(() => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    haptics.light();
    updateZoomIndicator();
  }, [haptics, updateZoomIndicator]);

  const handleUndo = () => {
    setPaths((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPath(null);
    onClear?.();
  };

  // 获取当前缩放百分比
  const getZoomPercent = () => {
    return Math.round(scale.value * 100);
  };

  // SVG 路径渲染 - Web 兼容方案
  const renderPath = (pathData: string, strokeColor: string, strokeW: number) => {
    const points = pathData.split(/[ML]/).filter(p => p.trim()).map(p => {
      const coords = p.trim().split(/\s+/);
      return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
    });

    if (points.length < 2) return null;

    return points.slice(1).map((point, i) => {
      const prev = points[i];
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      return (
        <View
          key={`${prev.x}-${prev.y}-${i}`}
          style={{
            position: 'absolute',
            left: prev.x,
            top: prev.y,
            width: length,
            height: strokeW,
            backgroundColor: strokeColor,
            transform: [{ rotate: `${angle}deg` }],
            transformOrigin: 'left center',
          }}
        />
      );
    });
  };

  return (
    <View style={[styles.container, { width: screenWidth, height: screenHeight + (showTools && editable ? 60 : 0) }]}>
      {/* 缩放指示器 */}
      {showZoomIndicator && (
        <View style={styles.zoomIndicator}>
          <Text style={styles.zoomText}>{getZoomPercent()}%</Text>
        </View>
      )}

      {/* 白板画布 */}
      <GestureDetector gesture={composedGesture}>
        <View style={[styles.canvas, { width: screenWidth, height: screenHeight }]}>
          {/* 背景 */}
          <View style={{ width: screenWidth, height: screenHeight, backgroundColor: '#ffffff' }} />

          {/* 已绘制的路径 - 应用变换 */}
          <Animated.View style={[styles.pathsContainer, animatedCanvasStyle]}>
            {paths.map((el) => {
              if (el.type === 'path') {
                return renderPath(el.data, el.color, el.strokeWidth);
              }
              return null;
            })}

            {/* 当前正在绘制的路径 */}
            {currentPath && renderPath(currentPath, color, strokeWidth)}
          </Animated.View>
        </View>
      </GestureDetector>

      {/* 工具栏 */}
      {editable && showTools && (
        <View style={styles.toolbar}>
          {/* 缩放重置按钮 */}
          <TouchableOpacity
            style={styles.resetZoomButton}
            onPress={handleResetView}
          >
            <Text style={styles.resetZoomText}>重置视图</Text>
          </TouchableOpacity>

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
    overflow: 'hidden',
  },
  pathsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  zoomIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  zoomText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  resetZoomButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.neutral.background,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  resetZoomText: {
    fontSize: 11,
    color: Colors.neutral.textSecondary,
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
    backgroundColor: Colors.neutral.card,
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
