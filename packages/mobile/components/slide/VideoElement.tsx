/**
 * VideoElement - Video element renderer for Mobile
 */

import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import type { PPTVideoElement } from './types';

interface VideoElementProps {
  element: PPTVideoElement;
  /** Scale factor for positioning */
  scale: number;
}

/**
 * VideoElement Component
 *
 * Simplified: Shows poster image with play button overlay
 * Actual video playback would require expo-av Video component
 */
export function VideoElement({ element, scale }: VideoElementProps) {
  // Container style with absolute positioning - scaled
  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: element.top * scale,
    left: element.left * scale,
    width: element.width * scale,
    height: element.height * scale,
    transform: [{ rotate: `${element.rotate || 0}deg` }],
    zIndex: 1,
  }), [element, scale]);

  // Poster image style - scaled
  const posterStyle = useMemo(() => ({
    width: element.width * scale,
    height: element.height * scale,
    resizeMode: 'cover' as const,
  }), [element, scale]);

  // Play icon size scaled
  const playIconSize = 40 * scale;

  return (
    <View style={containerStyle}>
      {element.poster ? (
        <Image source={{ uri: element.poster }} style={posterStyle} />
      ) : (
        <View style={[posterStyle, styles.placeholder]}>
          <View style={[styles.playIcon, { width: playIconSize, height: playIconSize, borderRadius: playIconSize / 2 }]}>
            <View style={[styles.playTriangle, {
              borderLeftWidth: 12 * scale,
              borderTopWidth: 8 * scale,
              borderBottomWidth: 8 * scale,
              marginLeft: 4 * scale,
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