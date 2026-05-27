/**
 * TextElement - Mobile text element renderer with responsive scaling
 *
 * Uses canvas-scale-based font sizing with minimum readability threshold.
 * Whiteboard elements get a default card-like background for visual separation.
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { PPTTextElement, SlideTheme } from './types';
import { isSmallScreen } from '@/lib/utils/scaling';

// 预定义的白板背景色数组，用于区分不同文本块
const WHITEBOARD_BG_COLORS = [
  '#e8f4f8', // 淡蓝
  '#fff3e6', // 淡橙
  '#f0f7f0', // 淡绿
  '#f5f0fa', // 淡紫
  '#fff8e6', // 淡黄
  '#e6f2ff', // 淡青蓝
];

// 根据元素 ID 生成稳定的背景色索引
function getBackgroundColorForElement(elementId: string): string {
  // 使用 ID 的哈希值选择颜色，保证同一元素颜色一致
  let hash = 0;
  for (let i = 0; i < elementId.length; i++) {
    hash = ((hash << 5) - hash + elementId.charCodeAt(i)) % WHITEBOARD_BG_COLORS.length;
  }
  return WHITEBOARD_BG_COLORS[Math.abs(hash)];
}

interface TextElementProps {
  element: PPTTextElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
  /** 是否在白板模式下渲染（添加卡片背景） */
  isWhiteboard?: boolean;
}

function getPosition(element: PPTTextElement) {
  const el = element as any;
  if (el.position) {
    return {
      top: el.position.top || 0,
      left: el.position.left || 0,
      width: el.position.width || 100,
      height: el.position.height || 50,
    };
  }
  return {
    top: element.top || 0,
    left: element.left || 0,
    width: element.width || 100,
    height: element.height || 50,
  };
}

export function TextElement({ element, theme, scaleX, scaleY, isWhiteboard = false }: TextElementProps) {
  const position = useMemo(() => getPosition(element), [element]);
  const effectiveScale = Math.min(scaleX, scaleY);

  const textContent = useMemo(() => {
    const text = element.content?.replace(/<[^>]+>/g, '') || '';
    return text;
  }, [element.content]);

  // Font size: responsive with mobile-friendly minimums
  const minFont = isSmallScreen ? 9 : 11;
  const fontSize = useMemo(() => {
    if ((element as any).style?.fontSize) {
      const styleFontSize = (element as any).style.fontSize;
      return Math.max(minFont, Math.round(styleFontSize * effectiveScale));
    }
    const htmlFontSizeMatch = element.content?.match(/font-size:\s*(\d+)px/i);
    if (htmlFontSizeMatch) {
      const htmlFontSize = parseInt(htmlFontSizeMatch[1], 10);
      return Math.max(minFont, Math.round(htmlFontSize * effectiveScale));
    }
    // Fallback based on element height
    let baseFontSize;
    if (position.height >= 60) {
      baseFontSize = 24;
    } else if (position.height >= 50) {
      baseFontSize = 16;
    } else {
      baseFontSize = 12;
    }
    return Math.max(minFont, Math.round(baseFontSize * effectiveScale));
  }, [element, position.height, effectiveScale]);

  const textColor = useMemo(() => {
    if ((element as any).style?.color) {
      return (element as any).style.color;
    }
    return element.defaultColor || theme.fontColor;
  }, [element, theme]);

  const fontWeight = useMemo(() => {
    if ((element as any).style?.fontWeight) {
      return (element as any).style.fontWeight as any;
    }
    return '400' as any;
  }, [element]);

  // 白板模式下为每个文本块添加背景色
  const elementId = element.id || '';
  const bgColor = useMemo(() => {
    if (isWhiteboard && !element.fill) {
      return getBackgroundColorForElement(elementId);
    }
    return element.fill || 'transparent';
  }, [isWhiteboard, element.fill, elementId]);

  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: position.left * scaleX,
    top: position.top * scaleY,
    width: Math.max(position.width * scaleX, 40),
    height: position.height > 0 ? position.height * scaleY : undefined,
    transform: [{ rotate: `${element.rotate || 0}deg` }],
    zIndex: 1,
  }), [position, element.rotate, scaleX, scaleY]);

  const textWrapperStyle = useMemo(() => ({
    flex: 1,
    padding: isWhiteboard ? Math.max(8, 12 * effectiveScale) : Math.max(4, 8 * effectiveScale),
    justifyContent: 'flex-start' as const,
    backgroundColor: bgColor,
    opacity: element.opacity || 1,
    // 白板模式下添加圆角和阴影
    ...(isWhiteboard && {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.06)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    }),
  }), [effectiveScale, bgColor, element.opacity, isWhiteboard]);

  const textStyle = useMemo(() => ({
    color: textColor,
    fontFamily: element.defaultFontName || theme.fontName,
    fontSize,
    lineHeight: fontSize * 1.4,
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