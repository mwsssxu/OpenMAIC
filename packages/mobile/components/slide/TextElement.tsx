/**
 * TextElement - Text element renderer for Mobile
 *
 * Renders text content with absolute positioning and styling
 * Supports both direct position properties and nested position object
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
 * Extract position from element (supports both formats)
 */
function getPosition(element: any): { top: number; left: number; width: number; height: number } {
  // New format: position object
  if (element.position) {
    return {
      top: element.position.top || 0,
      left: element.position.left || 0,
      width: element.position.width || 100,
      height: element.position.height || 50,
    };
  }
  // Old format: direct properties
  return {
    top: element.top || 0,
    left: element.left || 0,
    width: element.width || 100,
    height: element.height || 50,
  };
}

/**
 * Extract style from element (supports both formats)
 */
function getStyle(element: any): { fontSize: number; color: string; fontWeight?: string } {
  // New format: style object
  if (element.style) {
    return {
      fontSize: element.style.fontSize || 16,
      color: element.style.color || '#333333',
      fontWeight: element.style.fontWeight,
    };
  }
  // Old format: direct properties
  return {
    fontSize: element.fontSize || 16,
    color: element.defaultColor || '#333333',
    fontWeight: element.fontWeight,
  };
}

/**
 * TextElement Component
 */
export function TextElement({ element, theme, scale }: TextElementProps) {
  // Get position (supports both formats)
  const position = useMemo(() => getPosition(element), [element]);

  // Get style (supports both formats)
  const elementStyle = useMemo(() => getStyle(element), [element]);

  // Parse HTML content to plain text
  const textContent = useMemo(() => parseHtmlToText(element.content), [element.content]);

  // Calculate font size
  const fontSize = useMemo(() => {
    // Use style.fontSize if available
    if (elementStyle.fontSize > 0) {
      return elementStyle.fontSize * scale;
    }

    // Extract from HTML content
    const htmlFontSize = extractFontSizeFromHtml(element.content, 0);
    if (htmlFontSize > 0) {
      return htmlFontSize * scale;
    }

    // Compute based on element height
    const lineHeightRatio = element.lineHeight || 1.5;
    const estimatedLines = Math.max(1, Math.floor(position.height / (16 * lineHeightRatio)));
    if (estimatedLines <= 2) {
      return Math.min(position.height * 0.6, 48) * scale;
    } else {
      return Math.min(position.height / (estimatedLines * lineHeightRatio), 24) * scale;
    }
  }, [elementStyle.fontSize, element.content, position.height, element.lineHeight, scale]);

  // Calculate text style
  const textStyle = useMemo(() => ({
    color: elementStyle.color || theme.fontColor,
    fontFamily: element.defaultFontName || theme.fontName,
    fontSize,
    lineHeight: fontSize * (element.lineHeight || 1.5),
    letterSpacing: (element.wordSpace || 0) * scale,
    textAlign: 'left' as const,
    opacity: element.opacity || 1,
    fontWeight: elementStyle.fontWeight as any,
  }), [elementStyle, theme, fontSize, element, scale]);

  // Container style with absolute positioning - scaled positions/dimensions
  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: position.top * scale,
    left: position.left * scale,
    width: position.width * scale,
    height: position.height * scale,
    transform: [{ rotate: `${element.rotate || 0}deg` }],
    backgroundColor: element.fill,
    zIndex: 1,
  }), [position, element, scale]);

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