/**
 * TextElement - Text element renderer for Mobile
 *
 * Renders text content with absolute positioning and styling
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PPTTextElement, SlideTheme } from './types';
import { parseHtmlToText, extractFontSizeFromHtml } from './hooks/useViewportSize';

interface TextElementProps {
  element: PPTTextElement;
  theme: SlideTheme;
  /** Scale factor for positioning */
  scale: number;
}

/**
 * TextElement Component
 */
export function TextElement({ element, theme, scale }: TextElementProps) {
  // Parse HTML content to plain text
  const textContent = useMemo(() => parseHtmlToText(element.content), [element.content]);

  // Extract font size from HTML or compute based on element height
  const fontSize = useMemo(() => {
    // Try to extract from HTML content
    const htmlFontSize = extractFontSizeFromHtml(element.content, 0);

    if (htmlFontSize > 0) {
      return htmlFontSize * scale; // Scale font size
    }

    // Compute based on element height and expected line count
    const lineHeightRatio = element.lineHeight || 1.5;
    const estimatedLines = Math.max(1, Math.floor(element.height / (16 * lineHeightRatio)));

    if (estimatedLines <= 2) {
      return Math.min(element.height * 0.6, 48) * scale;
    } else {
      return Math.min(element.height / (estimatedLines * lineHeightRatio), 24) * scale;
    }
  }, [element.content, element.height, element.lineHeight, scale]);

  // Calculate text style
  const textStyle = useMemo(() => ({
    color: element.defaultColor || theme.fontColor,
    fontFamily: element.defaultFontName || theme.fontName,
    fontSize,
    lineHeight: fontSize * (element.lineHeight || 1.5),
    letterSpacing: (element.wordSpace || 0) * scale,
    textAlign: 'left' as const,
    opacity: element.opacity || 1,
  }), [element, theme, fontSize, scale]);

  // Container style with absolute positioning - scaled positions/dimensions
  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: element.top * scale,
    left: element.left * scale,
    width: element.width * scale,
    height: element.height * scale,
    transform: [{ rotate: `${element.rotate || 0}deg` }],
    backgroundColor: element.fill,
    zIndex: 1,
  }), [element, scale]);

  // Vertical text support
  const textWrapperStyle = useMemo(() => {
    if (element.vertical) {
      return {
        flex: 1,
        padding: 10 * scale,
        writingDirection: 'rtl' as const,
        alignItems: 'flex-start' as const,
      };
    }
    return {
      flex: 1,
      padding: 10 * scale,
      justifyContent: 'flex-start' as const,
    };
  }, [element.vertical, scale]);

  return (
    <View style={containerStyle}>
      <View style={[styles.textWrapper, textWrapperStyle]}>
        <Text style={textStyle}>
          {textContent}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  textWrapper: {
    flex: 1,
    padding: 10,
    justifyContent: 'flex-start',
  },
});