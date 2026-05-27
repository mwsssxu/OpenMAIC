/**
 * TextElement - Mobile text element renderer with responsive scaling
 *
 * Uses canvas-scale-based font sizing with minimum readability threshold.
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { PPTTextElement, SlideTheme } from './types';
import { isSmallScreen } from '@/lib/utils/scaling';

interface TextElementProps {
  element: PPTTextElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
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

export function TextElement({ element, theme, scaleX, scaleY }: TextElementProps) {
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
    padding: Math.max(4, 8 * effectiveScale),
    justifyContent: 'flex-start' as const,
    backgroundColor: element.fill || 'transparent',
    opacity: element.opacity || 1,
  }), [effectiveScale, element.fill, element.opacity]);

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