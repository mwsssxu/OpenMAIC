/**
 * TextElement - Text element renderer for Mobile
 *
 * Renders text content with positioning matching Web's BaseTextElement
 *
 * Web端定位（BaseTextElement.tsx）：
 * - 元素使用原始坐标：left, top（基于viewportSize=1000）
 * - 容器尺寸：width, height（原始值）
 * - 内部padding：10px（固定值，不缩放）
 *
 * Mobile端适配：
 * - 元素坐标乘以scale：left * scale, top * scale
 * - 容器尺寸乘以scale：width * scale, height * scale
 * - 内部padding保持相对比例
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { PPTTextElement, SlideTheme } from './types';

interface TextElementProps {
  element: PPTTextElement;
  theme: SlideTheme;
  /** Scale factor for horizontal positioning */
  scaleX: number;
  /** Scale factor for vertical positioning */
  scaleY: number;
}

/**
 * Extract position from element
 * 支持两种格式：
 * 1. 直接属性：element.left, element.top（PPTElement格式）
 * 2. 嵌套对象：element.position.left, element.position.top（Web端返回格式）
 */
function getPosition(element: PPTTextElement): { top: number; left: number; width: number; height: number } {
  // Web端返回嵌套的position对象
  const el = element as any;
  if (el.position) {
    return {
      top: el.position.top || 0,
      left: el.position.left || 0,
      width: el.position.width || 100,
      height: el.position.height || 50,
    };
  }
  // PPTElement直接使用left/top属性
  return {
    top: element.top || 0,
    left: element.left || 0,
    width: element.width || 100,
    height: element.height || 50,
  };
}

/**
 * TextElement Component
 */
export function TextElement({ element, theme, scaleX, scaleY }: TextElementProps) {
  // Get position
  const position = useMemo(() => getPosition(element), [element]);

  // Parse HTML content to plain text
  const textContent = useMemo(() => {
    // 移除HTML标签
    const text = element.content?.replace(/<[^>]+>/g, '') || '';
    return text;
  }, [element.content]);

  // Calculate font size
  // 使用scaleY计算（垂直方向填充更多），字体相应放大
  const fontSize = useMemo(() => {
    // 优先从style对象获取fontSize（Web端格式）
    if ((element as any).style?.fontSize) {
      const styleFontSize = (element as any).style.fontSize;
      return Math.max(16, styleFontSize * scaleY);
    }

    // 从HTML提取fontSize
    const htmlFontSizeMatch = element.content?.match(/font-size:\s*(\d+)px/i);
    if (htmlFontSizeMatch) {
      const htmlFontSize = parseInt(htmlFontSizeMatch[1], 10);
      return Math.max(16, htmlFontSize * scaleY);
    }

    // 根据元素类型计算
    let baseFontSize;
    if (position.height >= 60) {
      baseFontSize = 36; // 标题
    } else if (position.height >= 50) {
      baseFontSize = 24; // 描述
    } else {
      baseFontSize = 18; // 内容
    }

    return Math.max(14, baseFontSize * scaleY);
  }, [element, position.height, scaleY]);

  // Get color from style or defaultColor
  const textColor = useMemo(() => {
    // 优先从style对象获取（Web端格式）
    if ((element as any).style?.color) {
      return (element as any).style.color;
    }
    return element.defaultColor || theme.fontColor;
  }, [element, theme]);

  // Get fontWeight from style
  const fontWeight = useMemo(() => {
    if ((element as any).style?.fontWeight) {
      return (element as any).style.fontWeight as any;
    }
    return '400' as any;
  }, [element]);

  // Container style - 使用双轴缩放
  // 水平：scaleX，垂直：scaleY（更大）
  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: position.left * scaleX,
    top: position.top * scaleY,
    width: position.width * scaleX,
    height: position.height * scaleY,
    transform: [{ rotate: `${element.rotate || 0}deg` }],
    zIndex: 1,
  }), [position, element.rotate, scaleX, scaleY]);

  // Text wrapper style - 使用元素自带的fill属性
  // 精确格式数据自带fill属性，无需自动装饰
  const textWrapperStyle = useMemo(() => ({
    flex: 1,
    padding: 10 * Math.min(scaleX, scaleY),
    justifyContent: 'flex-start' as const,
    backgroundColor: element.fill || 'transparent',
    opacity: element.opacity || 1,
  }), [scaleX, scaleY, element.fill, element.opacity]);

  // Text style
  const textStyle = useMemo(() => ({
    color: textColor,
    fontFamily: element.defaultFontName || theme.fontName,
    fontSize,
    lineHeight: fontSize * (element.lineHeight || 1.5),
    letterSpacing: (element.wordSpace || 0) * scaleX,
    textAlign: 'left' as const,
    fontWeight,
  }), [element, theme, fontSize, scaleX, textColor, fontWeight]);

  return (
    <View style={containerStyle}>
      <View style={textWrapperStyle}>
        <Text style={textStyle}>
          {textContent}
        </Text>
      </View>
    </View>
  );
}