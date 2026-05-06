/**
 * VideoElement - Video element renderer for Mobile
 */

import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import type { PPTVideoElement } from './types';

interface VideoElementProps {
  element: PPTVideoElement;
  /** Scale factor for horizontal positioning */
  scaleX: number;
  /** Scale factor for vertical positioning */
  scaleY: number;
}

/**
 * VideoElement Component
 *
 * Simplified: Shows poster image with play button overlay
 * Actual video playback would require expo-av Video component
 */
export function VideoElement({ element, scaleX, scaleY }: VideoElementProps) {
  // Container style with absolute positioning - dual-axis scaled
  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: element.top * scaleY,
    left: element.left * scaleX,
    width: element.width * scaleX,
    height: element.height * scaleY,
    transform: [{ rotate: `${element.rotate || 0}deg` }],
    zIndex: 1,
  }), [element, scaleX, scaleY]);

  // Poster image style - scaled
  const posterStyle = useMemo(() => ({
    width: element.width * scaleX,
    height: element.height * scaleY,
    resizeMode: 'cover' as const,
  }), [element, scaleX, scaleY]);

  // Play icon size scaled - use average for visual consistency
  const avgScale = (scaleX + scaleY) / 2;
  const playIconSize = 40 * avgScale;

  return (
    <View style={containerStyle}>
      {element.poster ? (
        <Image source={{ uri: element.poster }} style={posterStyle} />
      ) : (
        <View style={[posterStyle, styles.placeholder]}>
          <View style={[styles.playIcon, { width: playIconSize, height: playIconSize, borderRadius: playIconSize / 2 }]}>
            <View style={[styles.playTriangle, {
              borderLeftWidth: 12 * avgScale,
              borderTopWidth: 8 * avgScale,
              borderBottomWidth: 8 * avgScale,
              marginLeft: 4 * avgScale,
            }]} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftColor: 'white',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});