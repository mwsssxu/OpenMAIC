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
  /** Scale factor for horizontal positioning */
  scaleX: number;
  /** Scale factor for vertical positioning */
  scaleY: number;
}

/**
 * LineElement Component
 *
 * Uses nested Views: outer View positioned at scaled start point,
 * inner View rotated and contains the actual line
 */
export function LineElement({ element, scaleX, scaleY }: LineElementProps) {
  // Get start and end points from element
  const startX = element.start[0];
  const startY = element.start[1];
  const endX = element.end[0];
  const endY = element.end[1];

  // Calculate actual line length (hypotenuse)
  // Note: Line length is calculated from original coordinates, then scaled
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
    left: element.left * scaleX,
    top: element.top * scaleY,
    zIndex: 1,
  }), [element.left, element.top, scaleX, scaleY]);

  // Line container with rotation
  // The rotation happens around the wrapper's position (which is the start point)
  const lineContainerStyle = useMemo(() => ({
    transform: [{ rotate: `${angle}deg` }],
    // Position relative to wrapper - line starts at 0,0 in this coordinate system
  }), [angle]);

  // Line visual style - scaled dimensions
  // Use average scale for line width to maintain visual consistency
  const avgScale = (scaleX + scaleY) / 2;
  const lineWidth = element.style === 'dashed' ? 1 * avgScale : 2 * avgScale;
  const lineStyle = useMemo(() => ({
    width: lineLength * avgScale,
    height: lineWidth,
    backgroundColor: element.color,
  }), [lineLength, lineWidth, element.color, avgScale]);

  // Dashed style uses border instead
  const dashedStyle = useMemo(() => {
    if (element.style !== 'dashed') return null;
    return {
      backgroundColor: 'transparent',
      borderBottomWidth: 2 * avgScale,
      borderBottomColor: element.color,
    };
  }, [element.style, element.color, avgScale]);

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