/**
 * ScreenCanvas - Main slide canvas for Mobile
 *
 * Renders slide content using the same positioning algorithm as Web
 *
 * Web端定位算法（关键）：
 * - viewportSize = 1000, viewportRatio = 0.5625 (16:9)
 * - 外层容器：缩放后的尺寸 (viewportWidth * scale, viewportHeight * scale)
 * - 内层内容：原始尺寸 (viewportWidth, viewportHeight)，通过CSS scale变换
 * - 元素坐标：基于原始viewport的left/top
 *
 * Mobile端适配：
 * - React Native不支持CSS transform scale
 * - 采用Web端相同的scale计算
 * - 元素直接使用缩放后的坐标（原始坐标 * scale）
 */

import React, { useRef, useMemo, useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenElement } from './ScreenElement';
import { SpotlightOverlay } from './SpotlightOverlay';
import { LaserOverlay } from './LaserOverlay';
import type { PPTElement, SlideBackground, SlideTheme, PPTLineElement } from './types';
import { useSlideBackgroundStyle } from './hooks/useViewportSize';

// Helper to check if element is a line
function isLineElement(element: PPTElement): element is PPTLineElement {
  return element.type === 'line';
}

interface ScreenCanvasProps {
  /** Slide elements to render */
  elements: PPTElement[];
  /** Slide background */
  background?: SlideBackground;
  /** Slide theme */
  theme?: SlideTheme;
  /** Spotlight target element ID */
  spotlightElementId?: string | null;
  /** Spotlight options */
  spotlightOptions?: { dimness?: number };
  /** Laser target element ID */
  laserElementId?: string | null;
  /** Laser options */
  laserOptions?: { color?: string; duration?: number };
}

// 固定viewport尺寸（与Web端一致）
const VIEWPORT_SIZE = 1000;
const VIEWPORT_RATIO = 16 / 9;
const VIEWPORT_HEIGHT = VIEWPORT_SIZE / VIEWPORT_RATIO; // 562.5

/**
 * ScreenCanvas Component
 */
export function ScreenCanvas({
  elements,
  background,
  theme,
  spotlightElementId,
  spotlightOptions,
  laserElementId,
  laserOptions,
}: ScreenCanvasProps) {
  const containerRef = useRef<View>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // 与Web端完全一致的scale计算逻辑
  // 参考：components/slide-renderer/Editor/Canvas/hooks/useViewportSize.ts
  // Web端关键代码：
  // if (canvasHeight / canvasWidth > viewportRatio) {
  //   viewportActualWidth = canvasWidth * (canvasPercentage / 100)
  //   scale = viewportActualWidth / viewportSize
  // } else {
  //   viewportActualHeight = canvasHeight * (canvasPercentage / 100)
  //   scale = viewportActualHeight / (viewportSize * viewportRatio)
  // }

  // 注意：viewportSize * viewportRatio 是错误的！
  // viewportHeight = viewportSize / viewportRatio（除法而非乘法）
  // 或者直接用预定义的 VIEWPORT_HEIGHT = 562.5

  // Mobile端适配策略：双轴缩放
  // viewport ratio (16:9=1.78) 与 container ratio (~0.85) 差异大
  // 使用不同的scaleX和scaleY来同时填充宽度和高度

  const canvasScaleX = useMemo(() => {
    if (containerSize.width === 0) return 1;
    // 按宽度适配，留10px边距
    return (containerSize.width - 20) / VIEWPORT_SIZE;
  }, [containerSize.width]);

  const canvasScaleY = useMemo(() => {
    if (containerSize.height === 0) return 1;
    // 按高度适配，让内容填满垂直空间
    // 保持与X轴缩放相同的基准，但调整viewportHeight概念
    // viewportHeight概念调整为：让scaleY使内容填满容器高度
    const targetHeight = containerSize.height - 40; // 留边距
    return targetHeight / VIEWPORT_HEIGHT;
  }, [containerSize.height]);

  // Canvas在容器中的位置
  const viewportLeft = 10;
  const viewportTop = 20;

  // 简洁调试 - 只在首次渲染时打印scale

  // Handle layout
  const handleLayout = useCallback((event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setContainerSize({ width, height });
    }
  }, []);

  // Background style
  const backgroundStyle = useSlideBackgroundStyle(background);

  // Default theme
  const defaultTheme: SlideTheme = {
    backgroundColor: '#ffffff',
    fontColor: '#333333',
    fontName: 'System',
  };
  const activeTheme = theme || defaultTheme;

  // Spotlight geometry - 使用viewport坐标（0-1000），不转换为百分比
  // Overlay内部会处理缩放
  const spotlightGeometry = useMemo(() => {
    if (!spotlightElementId) return null;
    const element = elements.find((el) => el.id === spotlightElementId);
    if (!element) return null;

    const width = element.width || (isLineElement(element) ? Math.abs(element.end[0] - element.start[0]) : 100);
    const height = isLineElement(element) ? Math.abs(element.end[1] - element.start[1]) : (element.height || 2);

    // viewport坐标（基于VIEWPORT_SIZE=1000）
    return {
      centerX: element.left + width / 2,
      centerY: element.top + height / 2,
      width,
      height,
    };
  }, [spotlightElementId, elements]);

  // Laser position - viewport坐标
  const laserPosition = useMemo(() => {
    if (!laserElementId) return null;
    const element = elements.find((el) => el.id === laserElementId);
    if (!element) return null;

    const width = element.width || (isLineElement(element) ? Math.abs(element.end[0] - element.start[0]) : 100);
    const height = isLineElement(element) ? Math.abs(element.end[1] - element.start[1]) : (element.height || 2);

    return {
      x: element.left + width / 2,
      y: element.top + height / 2,
    };
  }, [laserElementId, elements]);

  // Canvas实际显示尺寸 - 使用不同的宽高缩放
  const canvasWidth = VIEWPORT_SIZE * canvasScaleX;
  const canvasHeight = VIEWPORT_HEIGHT * canvasScaleY;

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={handleLayout}
    >
      {/* Canvas容器 - 与Web端外层容器一致 */}
      <View
        style={[
          styles.canvas,
          backgroundStyle,
          {
            position: 'absolute',
            left: viewportLeft,
            top: viewportTop,
            width: canvasWidth,
            height: canvasHeight,
          },
        ]}
      >
        {/* 内容层 - 元素使用缩放后的坐标 */}
        {elements.map((element) => (
          <ScreenElement
            key={element.id}
            element={element}
            theme={activeTheme}
            scaleX={canvasScaleX}
            scaleY={canvasScaleY}
          />
        ))}

        {/* Spotlight overlay */}
        {spotlightGeometry && (
          <SpotlightOverlay
            geometry={spotlightGeometry}
            dimness={spotlightOptions?.dimness ?? 0.7}
            scaleX={canvasScaleX}
            scaleY={canvasScaleY}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
          />
        )}

        {/* Laser pointer overlay */}
        {laserPosition && (
          <LaserOverlay
            position={laserPosition}
            color={laserOptions?.color ?? '#ff3b30'}
            duration={laserOptions?.duration ?? 500}
            scaleX={canvasScaleX}
            scaleY={canvasScaleY}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  canvas: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
});