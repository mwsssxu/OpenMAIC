/**
 * ShapeElement - Shape element renderer for Mobile
 *
 * Simplified shape rendering using View with background color
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { PPTShapeElement, SlideTheme } from './types';
import { parseHtmlToText } from './hooks/useViewportSize';

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
 */
export function ShapeElement({ element, theme, scaleX, scaleY }: ShapeElementProps) {
  // Container style with absolute positioning - dual-axis scaled
  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: element.top * scaleY,
    left: element.left * scaleX,
    width: element.width * scaleX,
    height: element.height * scaleY,
    transform: [{ rotate: `${element.rotate || 0}deg` }],
    backgroundColor: element.fill,
    borderRadius: element.path?.includes('round') ? 8 * Math.min(scaleX, scaleY) : 0,
    opacity: element.opacity || 1,
    zIndex: 1,
  }), [element, scaleX, scaleY]);

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
    fontSize: 14 * scaleY,
    textAlign: 'center' as const,
  }), [element, theme, scaleY]);

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