/**
 * ShapeElement - Shape element renderer for Mobile
 *
 * Simplified shape rendering using View with background color
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { PPTShapeElement, SlideTheme } from './types';
import { parseHtmlToText } from './hooks/useViewportSize';
import { sFont, isSmallScreen } from '@/lib/utils/scaling';

interface ShapeElementProps {
  element: PPTShapeElement;
  theme: SlideTheme;
  /** Scale factor for horizontal positioning */
  scaleX: number;
  /** Scale factor for vertical positioning */
  scaleY: number;
}

/**
 * ShapeElement Component
 *
 * Simplified rendering - uses View with background color instead of SVG
 * 改进：支持圆形检测，优化zIndex（shape在text下方）
 */
export function ShapeElement({ element, theme, scaleX, scaleY }: ShapeElementProps) {
  // 根据path判断形状类型
  const isCircle = useMemo(() => {
    // 圆形path包含弧线命令 'A' 和半径标记
    return element.path?.includes('A') && (
      element.path?.includes('0.5') ||
      element.path?.includes('500')
    );
  }, [element.path]);

  // 计算实际尺寸
  const width = (element.width || 100) * scaleX;
  const height = (element.height || 100) * scaleY;
  const left = (element.left || 0) * scaleX;
  const top = (element.top || 0) * scaleY;

  // 计算圆角
  const borderRadius = useMemo(() => {
    if (isCircle) {
      return Math.min(width, height) / 2;
    }
    // 圆角矩形检测
    if (element.path?.includes('round')) {
      return 8 * Math.min(scaleX, scaleY);
    }
    return 0;
  }, [isCircle, width, height, element.path, scaleX, scaleY]);

  // Container style - shape在text下方
  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top,
    left,
    width,
    height,
    transform: [{ rotate: `${element.rotate || 0}deg` }],
    backgroundColor: element.fill || '#5b9bd5',
    borderRadius,
    opacity: element.opacity || 1,
    zIndex: 0, // shape通常在text下方作为背景
  }), [element, left, top, width, height, borderRadius, scaleX, scaleY]);

  // Handle flip transforms
  const flipTransform = useMemo(() => {
    const transforms: Array<{ scaleX: number } | { scaleY: number }> = [];
    if (element.flipH) transforms.push({ scaleX: -1 });
    if (element.flipV) transforms.push({ scaleY: -1 });
    return transforms;
  }, [element]);

  // Text content if shape has text
  const textContent = useMemo(() => {
    if (!element.text) return null;
    return parseHtmlToText(element.text.content);
  }, [element]);

  // Text style
  const textStyle = useMemo(() => ({
    color: element.text?.defaultColor || theme.fontColor,
    fontFamily: element.text?.defaultFontName || theme.fontName,
    fontSize: sFont(14 * Math.min(scaleX, scaleY), isSmallScreen ? 9 : 11),
    lineHeight: sFont(14 * Math.min(scaleX, scaleY), isSmallScreen ? 9 : 11) * 1.4,
    textAlign: 'center' as const,
  }), [element, theme, scaleX, scaleY]);

  // Text container alignment
  const textContainerStyle = useMemo(() => {
    const justifyContent = element.text?.align === 'top' ? 'flex-start' :
                          element.text?.align === 'bottom' ? 'flex-end' : 'center';
    return {
      flex: 1,
      justifyContent: justifyContent as 'flex-start' | 'flex-end' | 'center',
      alignItems: 'center' as const,
      padding: 8 * Math.min(scaleX, scaleY),
    };
  }, [element, scaleX, scaleY]);

  return (
    <View style={[containerStyle, flipTransform.length > 0 && { transform: flipTransform }]}>
      {textContent && (
        <View style={textContainerStyle}>
          <Text style={textStyle}>{textContent}</Text>
        </View>
      )}
    </View>
  );
}