/**
 * LineElement - Line element renderer for Mobile
 *
 * Renders lines with proper geometry calculation
 * Uses nested Views to achieve rotation around start point (React Native doesn't support transformOrigin)
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import type { PPTLineElement } from './types';

interface LineElementProps {
  element: PPTLineElement;
  /** Scale factor for positioning */
  scale: number;
}

/**
 * LineElement Component
 *
 * Uses nested Views: outer View positioned at scaled start point,
 * inner View rotated and contains the actual line
 */
export function LineElement({ element, scale }: LineElementProps) {
  // Get start and end points from element
  const startX = element.start[0];
  const startY = element.start[1];
  const endX = element.end[0];
  const endY = element.end[1];

  // Calculate actual line length (hypotenuse)
  const lineLength = useMemo(() => {
    return Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
  }, [startX, startY, endX, endY]);

  // Calculate angle in degrees
  const angle = useMemo(() => {
    return Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
  }, [startX, startY, endX, endY]);

  // Outer wrapper positioned at scaled start point
  // This acts as the rotation pivot point
  const wrapperStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: element.left * scale,
    top: element.top * scale,
    zIndex: 1,
  }), [element.left, element.top, scale]);

  // Line container with rotation
  // The rotation happens around the wrapper's position (which is the start point)
  const lineContainerStyle = useMemo(() => ({
    transform: [{ rotate: `${angle}deg` }],
    // Position relative to wrapper - line starts at 0,0 in this coordinate system
  }), [angle]);

  // Line visual style - scaled dimensions
  const lineWidth = element.style === 'dashed' ? 1 * scale : 2 * scale;
  const lineStyle = useMemo(() => ({
    width: lineLength * scale,
    height: lineWidth,
    backgroundColor: element.color,
  }), [lineLength, lineWidth, element.color, scale]);

  // Dashed style uses border instead
  const dashedStyle = useMemo(() => {
    if (element.style !== 'dashed') return null;
    return {
      backgroundColor: 'transparent',
      borderBottomWidth: 2 * scale,
      borderBottomColor: element.color,
    };
  }, [element.style, element.color, scale]);

  return (
    <View style={wrapperStyle}>
      <View style={[styles.lineContainer, lineContainerStyle]}>
        <View style={[lineStyle, dashedStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lineContainer: {
    // Container for the actual line, rotation applied here
    // Line starts at (0,0) relative to this container
  },
});