/**
 * ShapeElement - Shape element renderer for Mobile
 *
 * Uses react-native-svg to render SVG paths (aligned with web implementation)
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { PPTShapeElement, SlideTheme } from './types';
import { parseHtmlToText } from './hooks/useViewportSize';
import { sFont, isSmallScreen } from '@/lib/utils/scaling';

interface ShapeElementProps {
  element: PPTShapeElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
  isWhiteboard?: boolean;
}

export function ShapeElement({ element, theme, scaleX, scaleY, isWhiteboard = false }: ShapeElementProps) {
  // Calculate actual dimensions
  const width = (element.width || 100) * scaleX;
  const height = (element.height || 100) * scaleY;
  const left = (element.left || 0) * scaleX;
  const top = (element.top || 0) * scaleY;

  // Get viewBox dimensions for scaling
  const viewBoxWidth = element.viewBox?.[0] || element.width || 100;
  const viewBoxHeight = element.viewBox?.[1] || element.height || 100;

  // Calculate scale ratios for path transformation
  const scaleRatioX = width / viewBoxWidth;

  // Determine fill color or gradient
  const fill = useMemo(() => {
    if (element.gradient) {
      return `url(#gradient-${element.id})`;
    }
    return element.fill || '#5b9bd5';
  }, [element]);

  // Outline properties
  const outlineWidth = element.outline?.width || 0;
  const outlineColor = element.outline?.color || 'transparent';
  const strokeDashArray = element.outline?.style === 'dashed' ? '5,3' : undefined;

  // Container style
  const containerStyle = useMemo(() => {
    if (isWhiteboard) {
      return {
        width: '100%' as const,
        minHeight: Math.max(40, height),
        marginBottom: 8,
        opacity: element.opacity || 1,
        zIndex: 0,
      };
    }
    return {
      position: 'absolute' as const,
      top,
      left,
      width,
      height,
      transform: [{ rotate: `${element.rotate || 0}deg` }],
      opacity: element.opacity || 1,
      zIndex: 0,
    };
  }, [element, left, top, width, height, isWhiteboard]);

  // Flip transform for the View container
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
    fontSize: sFont(14, isSmallScreen ? 9 : 11),
    lineHeight: sFont(14, isSmallScreen ? 9 : 11) * 1.4,
    textAlign: 'center' as const,
  }), [element, theme]);

  // Text container alignment
  const textContainerStyle = useMemo(() => {
    const justifyContent = element.text?.align === 'top' ? 'flex-start' :
                          element.text?.align === 'bottom' ? 'flex-end' : 'center';
    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: justifyContent as 'flex-start' | 'flex-end' | 'center',
      alignItems: 'center' as const,
      padding: 8 * Math.min(scaleX, scaleY),
    };
  }, [element, scaleX, scaleY]);

  // Gradient definition if present
  const gradientDef = useMemo(() => {
    if (!element.gradient) return null;

    const stops = element.gradient.colors.map((c, i) => (
      <Stop
        key={i}
        offset={c.pos.toString()}
        stopColor={c.color}
      />
    ));

    // Calculate gradient rotation
    const rotate = element.gradient.rotate || 0;
    const angle = (rotate * Math.PI) / 180;
    const x1 = 0.5 - 0.5 * Math.cos(angle);
    const y1 = 0.5 - 0.5 * Math.sin(angle);
    const x2 = 0.5 + 0.5 * Math.cos(angle);
    const y2 = 0.5 + 0.5 * Math.sin(angle);

    return (
      <Defs>
        <LinearGradient
          id={`gradient-${element.id}`}
          x1={x1.toString()}
          y1={y1.toString()}
          x2={x2.toString()}
          y2={y2.toString()}
        >
          {stops}
        </LinearGradient>
      </Defs>
    );
  }, [element]);

  return (
    <View style={[containerStyle, flipTransform.length > 0 && { transform: flipTransform }]}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      >
        {gradientDef}
        <Path
          d={element.path}
          fill={fill}
          stroke={outlineColor}
          strokeWidth={outlineWidth / scaleRatioX}
          strokeDasharray={strokeDashArray}
        />
      </Svg>
      {textContent && (
        <View style={textContainerStyle}>
          <Text style={textStyle}>{textContent}</Text>
        </View>
      )}
    </View>
  );
}
