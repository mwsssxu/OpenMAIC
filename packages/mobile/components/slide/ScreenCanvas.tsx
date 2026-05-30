/**
 * ScreenCanvas - Main slide canvas for Mobile
 * Renders slide content using the same positioning algorithm as Web
 */

import React, { useRef, useMemo, useCallback, useState } from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { ScreenElement } from './ScreenElement';
import { SpotlightOverlay } from './SpotlightOverlay';
import { LaserOverlay } from './LaserOverlay';
import { SimplifiedLayout } from './SimplifiedLayout';
import { detectLayoutMode } from './utils/layout-detection';
import type { PPTElement, SlideBackground, SlideTheme, PPTLineElement } from './types';
import { useSlideBackgroundStyle } from './hooks/useViewportSize';
import { VIEWPORT_SIZE, VIEWPORT_HEIGHT } from './constants';
import { isSmallScreen, isWideScreen } from '@/lib/utils/scaling';

const MARGIN = isSmallScreen ? 12 : isWideScreen ? 30 : 20;

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
  /** Whether rendering in whiteboard mode (adds card backgrounds to text elements) */
  isWhiteboard?: boolean;
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
  isWhiteboard = false,
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
  // 白板模式：使用固定画布尺寸（与 Web 端一致：1000×562.5）
  const effectiveWidth = useMemo(() => {
    // 白板模式：使用容器实际宽度
    if (isWhiteboard && containerSize.width > 0) {
      return containerSize.width;
    }
    if (scrollable) {
      return containerSize.width > 0 ? containerSize.width : screenWidth;
    }
    // 非 scrollable 模式：使用 containerSize
    return containerSize.width > 0 ? containerSize.width : screenWidth - 40;
  }, [scrollable, isWhiteboard, containerSize.width, screenWidth]);

  // 白板画布基准尺寸（与 Web 端一致）
  const whiteboardCanvasWidth = 1000;

  const canvasScaleX = useMemo(() => {
    // 白板模式：将 1000px 基准画布缩放到容器宽度
    if (isWhiteboard && effectiveWidth > 0) {
      const scale = effectiveWidth / whiteboardCanvasWidth;
      console.log(`[ScreenCanvas] whiteboard scale: effectiveWidth=${effectiveWidth}, scaleX=${scale}`);
      return scale;
    }
    if (layoutMode !== 'precise') return 1;
    if (effectiveWidth === 0) return 1;
    return (effectiveWidth - MARGIN) / VIEWPORT_SIZE;
  }, [isWhiteboard, effectiveWidth, layoutMode]);

  // 白板模式使用统一的缩放比例
  const canvasScaleY = useMemo(() => {
    // 白板模式：使用 X 轴缩放（保持宽高比）
    if (isWhiteboard) return canvasScaleX;
    if (layoutMode !== 'precise') return 1;
    if (containerSize.height === 0) return 1;
    const targetHeight = containerSize.height - MARGIN * 2;
    return targetHeight / VIEWPORT_HEIGHT;
  }, [isWhiteboard, canvasScaleX, layoutMode, containerSize.height]);

  // Canvas尺寸计算
  // 白板模式：宽度使用容器宽度，高度根据内容计算
  const canvasWidth = useMemo(() => {
    if (isWhiteboard) {
      // 白板模式：使用容器实际宽度
      return effectiveWidth;
    }
    return effectiveWidth - MARGIN;
  }, [isWhiteboard, effectiveWidth, layoutMode]);

  // 计算元素所需的最小高度（防止内容溢出）
  // 白板模式：基于基准画布坐标计算，然后缩放
  // 非 whiteboard 模式：直接计算像素高度
  const minContentHeight = useMemo(() => {
    if (elements.length === 0) {
      // 白板模式没有元素时，使用默认高度
      return isWhiteboard ? 200 : VIEWPORT_HEIGHT;
    }

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

    // 白板模式：maxBottom 是基准画布坐标，需要缩放
    if (isWhiteboard) {
      const scaledHeight = maxBottom * canvasScaleX; // 使用 scaleX 作为统一缩放
      // 白板元素使用 minHeight，实际高度可能超出预设值
      // 增加安全边距：每个元素可能额外扩展 20-40px
      const safetyMargin = elements.length * 30;
      console.log(`[ScreenCanvas] minContentHeight: maxBottom=${maxBottom}, scaledHeight=${scaledHeight}, scaleX=${canvasScaleX}, safetyMargin=${safetyMargin}`);
      return scaledHeight + 60 + safetyMargin; // 加上顶部和底部 padding + 安全边距
    }

    // 非白板模式：直接使用像素值
    const padding = scrollable ? 40 : 20;
    return Math.max(VIEWPORT_HEIGHT, maxBottom + padding);
  }, [elements, scrollable, isWhiteboard, canvasScaleX]);

  // 精确格式：根据内容高度计算canvas尺寸
  const canvasHeight = useMemo(() => {
    if (layoutMode === 'simplified') {
      return undefined; // 简化格式自适应高度
    }
    if (containerSize.height === 0 && !isWhiteboard) return undefined;

    // 白板模式/scrollable模式：使用完整内容高度（无需缩放）
    if (scrollable || isWhiteboard) {
      return minContentHeight;
    }

    // 非滚动模式：使用容器可用高度
    const availableHeight = containerSize.height - MARGIN * 2;
    const contentNeededHeight = minContentHeight * canvasScaleY;
    return Math.max(availableHeight, contentNeededHeight);
  }, [layoutMode, containerSize.height, canvasScaleY, minContentHeight, scrollable, isWhiteboard]);

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
      {/* 白板模式：使用 ScrollView 支持滚动 */}
      {isWhiteboard ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollViewContent, styles.scrollViewContentWhiteboard]}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled
        >
          <View
            style={[
              styles.canvas,
              backgroundStyle,
              {
                width: canvasWidth,
                minHeight: canvasHeight || minContentHeight,
              },
            ]}
          >
            {/* 精确格式渲染 */}
            {layoutMode === 'precise' && elements.map((element) => (
              <ScreenElement
                key={element.id}
                element={element}
                theme={activeTheme}
                scaleX={canvasScaleX}
                scaleY={canvasScaleY}
                isWhiteboard={isWhiteboard}
              />
            ))}
            {/* 简化格式渲染 */}
            {layoutMode === 'simplified' && (
              <SimplifiedLayout
                elements={elements}
                theme={activeTheme}
                containerSize={containerSize}
              />
            )}
          </View>
        </ScrollView>
      ) : (
        /* 普通模式 */
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
                  isWhiteboard={isWhiteboard}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 10,
  },
  scrollViewContentWhiteboard: {
    padding: 0, // 白板模式不需要额外 padding
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