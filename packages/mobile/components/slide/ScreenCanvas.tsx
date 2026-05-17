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
import { View, StyleSheet, Dimensions } from 'react-native';
import { ScreenElement } from './ScreenElement';
import { SpotlightOverlay } from './SpotlightOverlay';
import { LaserOverlay } from './LaserOverlay';
import { SimplifiedLayout } from './SimplifiedLayout';
import { detectLayoutMode } from './utils/layout-detection';
import type { PPTElement, SlideBackground, SlideTheme, PPTLineElement } from './types';
import { useSlideBackgroundStyle } from './hooks/useViewportSize';
import { VIEWPORT_SIZE, VIEWPORT_HEIGHT, CANVAS_MARGIN_PRECISE, CANVAS_MARGIN_SIMPLIFIED } from './constants';

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
  /** Enable scrollable mode - calculates full content height */
  scrollable?: boolean;
}

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
  scrollable = false,
}: ScreenCanvasProps) {
  const containerRef = useRef<View>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // 获取屏幕宽度作为 fallback（用于 scrollable 模式）
  const screenWidth = useMemo(() => Dimensions.get('window').width, []);

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

  // 布局模式检测
  const layoutMode = useMemo(() => detectLayoutMode(elements), [elements]);

  // 精确格式：双轴缩放
  // scrollable 模式下使用屏幕宽度，非 scrollable 使用 containerSize
  const effectiveWidth = useMemo(() => {
    if (scrollable) {
      // scrollable 模式：使用屏幕宽度减去 padding
      return screenWidth - 40; // 左右各 20 padding
    }
    // 非 scrollable 模式：使用 containerSize
    return containerSize.width > 0 ? containerSize.width : screenWidth - 40;
  }, [scrollable, containerSize.width, screenWidth]);

  const canvasScaleX = useMemo(() => {
    if (layoutMode !== 'precise') return 1;
    if (effectiveWidth === 0) return 1;
    return (effectiveWidth - CANVAS_MARGIN_PRECISE) / VIEWPORT_SIZE;
  }, [layoutMode, effectiveWidth]);

  const canvasScaleY = useMemo(() => {
    if (layoutMode !== 'precise') return 1;
    if (containerSize.height === 0) return 1;
    const targetHeight = containerSize.height - CANVAS_MARGIN_SIMPLIFIED;
    return targetHeight / VIEWPORT_HEIGHT;
  }, [layoutMode, containerSize.height]);

  // Canvas尺寸计算
  // 简化格式：宽度固定，高度自适应（内容撑开）
  // scrollable 模式：使用 effectiveWidth（屏幕宽度）
  const canvasWidth = useMemo(() => {
    if (layoutMode === 'simplified') {
      return effectiveWidth - CANVAS_MARGIN_PRECISE;
    }
    // 精确格式：使用有效宽度计算
    return effectiveWidth - CANVAS_MARGIN_PRECISE;
  }, [layoutMode, effectiveWidth]);

  // 计算元素所需的最小高度（防止内容溢出）
  // scrollable模式下计算完整高度，精确模式下也需要考虑所有元素
  const minContentHeight = useMemo(() => {
    if (elements.length === 0) return VIEWPORT_HEIGHT;

    // 遍历所有元素计算最大底部坐标
    let maxBottom = 0;
    elements.forEach(el => {
      // 获取元素位置（支持嵌套的position对象）
      const elTop = el.top || (el as any).position?.top || 0;
      const elHeight = isLineElement(el)
        ? Math.abs(el.end[1] - el.start[1])
        : (el.height || (el as any).position?.height || 50);
      const bottom = elTop + elHeight;
      maxBottom = Math.max(maxBottom, bottom);
    });

    // 基础高度：至少VIEWPORT_HEIGHT，加上底部边距
    // scrollable模式：使用实际内容高度（更宽松）
    const padding = scrollable ? 40 : 20;
    const baseHeight = scrollable ? maxBottom : VIEWPORT_HEIGHT;
    return Math.max(baseHeight, maxBottom + padding);
  }, [elements, scrollable]);

  // 精确格式：根据内容高度计算canvas尺寸
  const canvasHeight = useMemo(() => {
    if (layoutMode === 'simplified') {
      return undefined; // 简化格式自适应高度
    }
    if (containerSize.height === 0) return undefined;

    // scrollable模式：使用完整内容高度
    if (scrollable) {
      return minContentHeight * canvasScaleY;
    }

    // 非滚动模式：使用容器可用高度
    const availableHeight = containerSize.height - CANVAS_MARGIN_SIMPLIFIED;
    const contentNeededHeight = minContentHeight * canvasScaleY;
    return Math.max(availableHeight, contentNeededHeight);
  }, [layoutMode, containerSize.height, canvasScaleY, minContentHeight, scrollable]);

  // Canvas位置
  const viewportLeft = 10;
  const viewportTop = 10;

  // Handle layout
  const handleLayout = useCallback((event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setContainerSize({ width, height });
      console.log('[ScreenCanvas] mode:', detectLayoutMode(elements));
    }
  }, [elements]);

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

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={handleLayout}
    >
      {/* Canvas容器 */}
      <View
        style={[
          styles.canvas,
          backgroundStyle,
          layoutMode === 'simplified' ? {
            position: 'absolute',
            left: viewportLeft,
            top: viewportTop,
            width: canvasWidth,
          } : {
            position: 'absolute',
            left: viewportLeft,
            top: viewportTop,
            width: canvasWidth,
            height: canvasHeight,
          },
        ]}
      >
        {/* 简化格式渲染 */}
        {layoutMode === 'simplified' && (
          <SimplifiedLayout
            elements={elements}
            theme={activeTheme}
            containerSize={containerSize}
          />
        )}

        {/* 精确格式渲染 */}
        {layoutMode === 'precise' && (
          <>
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
            {spotlightGeometry && canvasHeight && (
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
            {laserPosition && canvasHeight && (
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
          </>
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
    overflow: 'visible',  // 允许内容溢出可见
  },
});