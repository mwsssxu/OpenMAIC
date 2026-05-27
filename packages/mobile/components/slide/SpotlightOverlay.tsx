/**
 * SpotlightOverlay - Spotlight effect for Mobile
 *
 * Implements spotlight focus effect using semi-transparent dimming layers
 * arranged around the highlighted element to create a "cutout" appearance.
 *
 * Adapted from Web's SpotlightOverlay.tsx (SVG mask approach)
 * React Native doesn't support SVG mask, so we use 4 positioned dimming Views:
 * - Top dimming layer (above target)
 * - Bottom dimming layer (below target)
 * - Left dimming layer (left of target)
 * - Right dimming layer (right of target)
 *
 * This creates the visual effect of a dark overlay with a clear cutout.
 *
 * Performance optimizations:
 * - Uses memo to prevent unnecessary re-renders
 * - Uses useDerivedValue to combine animations
 * - Adaptive animation duration for low-end devices
 */

import React, { useEffect, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { getAdaptiveAnimationDuration } from '@/lib/utils/responsive';

interface SpotlightOverlayProps {
  /** Target element geometry (in viewport coordinates 0-1000) */
  geometry: {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
  };
  /** Background dimming opacity (0-1, default 0.7) */
  dimness?: number;
  /** Scale factor for horizontal positioning */
  scaleX: number;
  /** Scale factor for vertical positioning */
  scaleY: number;
  /** Canvas dimensions for overlay positioning */
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * SpotlightOverlay Component
 *
 * Creates a spotlight effect by:
 * 1. 4 semi-transparent dark layers around the target (top, bottom, left, right)
 * 2. White border around the highlighted area
 * 3. Animation: contraction from larger area to precise position
 */
export const SpotlightOverlay = memo(function SpotlightOverlay({
  geometry,
  dimness = 0.7,
  scaleX,
  scaleY,
  canvasWidth,
  canvasHeight,
}: SpotlightOverlayProps) {
  // Adaptive animation duration for device performance
  const animationDuration = getAdaptiveAnimationDuration(600);

  // Animation values for contraction effect
  const paddingAnim = useSharedValue(40); // Start with larger padding
  const borderRadiusAnim = useSharedValue(12); // Start with larger radius

  // Trigger contraction animation on mount
  useEffect(() => {
    paddingAnim.value = withTiming(8, {
      duration: animationDuration,
      easing: Easing.out(Easing.exp),
    });
    borderRadiusAnim.value = withTiming(4, {
      duration: animationDuration,
      easing: Easing.out(Easing.exp),
    });

    // Cleanup on unmount
    return () => {
      cancelAnimation(paddingAnim);
      cancelAnimation(borderRadiusAnim);
    };
  }, [animationDuration]);

  // Calculate the cutout area dimensions
  const cutoutX = geometry.centerX - geometry.width / 2;
  const cutoutY = geometry.centerY - geometry.height / 2;
  const cutoutW = geometry.width;
  const cutoutH = geometry.height;

  // Animated border style - use dual-axis scaling
  const borderAnimatedStyle = useAnimatedStyle(() => {
    const padding = paddingAnim.value;
    const borderWidth = 1.5 * Math.min(scaleX, scaleY);
    const left = (cutoutX - padding) * scaleX - borderWidth;
    const top = (cutoutY - padding) * scaleY - borderWidth;
    const width = (cutoutW + padding * 2) * scaleX + borderWidth * 2;
    const height = (cutoutH + padding * 2) * scaleY + borderWidth * 2;

    return {
      left,
      top,
      width,
      height,
      borderRadius: borderRadiusAnim.value * Math.min(scaleX, scaleY),
    };
  });

  // Animated dimming layers positions
  // Top layer: from top of canvas to top of cutout
  const topDimStyle = useAnimatedStyle(() => {
    const padding = paddingAnim.value;
    const cutoutTop = (cutoutY - padding) * scaleY;
    return {
      height: cutoutTop,
    };
  });

  // Bottom layer: from bottom of cutout to bottom of canvas
  const bottomDimStyle = useAnimatedStyle(() => {
    const padding = paddingAnim.value;
    const cutoutBottom = (cutoutY + cutoutH + padding) * scaleY;
    return {
      top: cutoutBottom,
    };
  });

  // Left layer: between top and bottom, left of cutout
  const leftDimStyle = useAnimatedStyle(() => {
    const padding = paddingAnim.value;
    const cutoutLeft = (cutoutX - padding) * scaleX;
    const cutoutTop = (cutoutY - padding) * scaleY;
    const cutoutHeight = (cutoutH + padding * 2) * scaleY;
    return {
      left: 0,
      top: cutoutTop,
      width: cutoutLeft,
      height: cutoutHeight,
    };
  });

  // Right layer: between top and bottom, right of cutout
  const rightDimStyle = useAnimatedStyle(() => {
    const padding = paddingAnim.value;
    const cutoutRight = (cutoutX + cutoutW + padding) * scaleX;
    const cutoutTop = (cutoutY - padding) * scaleY;
    const cutoutHeight = (cutoutH + padding * 2) * scaleY;
    return {
      left: cutoutRight,
      top: cutoutTop,
      width: canvasWidth - cutoutRight,
      height: cutoutHeight,
    };
  });

  const dimColor = `rgba(0,0,0,${dimness})`;

  return (
    <View style={[styles.overlayContainer, { width: canvasWidth, height: canvasHeight }]}>
      {/* Top dimming layer */}
      <Animated.View style={[styles.dimLayer, topDimStyle, { backgroundColor: dimColor }]} />

      {/* Bottom dimming layer */}
      <Animated.View style={[styles.dimLayer, styles.bottomLayer, bottomDimStyle, { backgroundColor: dimColor, height: canvasHeight }]} />

      {/* Left dimming layer */}
      <Animated.View style={[styles.dimLayer, leftDimStyle, { backgroundColor: dimColor }]} />

      {/* Right dimming layer */}
      <Animated.View style={[styles.dimLayer, rightDimStyle, { backgroundColor: dimColor }]} />

      {/* White border highlight */}
      <Animated.View
        style={[
          styles.borderHighlight,
          borderAnimatedStyle,
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  dimLayer: {
    position: 'absolute',
    left: 0,
    width: '100%',
  },
  bottomLayer: {
    bottom: 0,
  },
  borderHighlight: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'transparent',
  },
});