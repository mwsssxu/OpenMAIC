/**
 * LaserOverlay - Laser pointer effect for Mobile
 *
 * Implements laser pointer animation with:
 * 1. Fly-in animation from screen corner
 * 2. Pulsing glow ring (expands outward)
 * 3. Core glowing dot
 *
 * Adapted from Web's LaserOverlay.tsx
 * Uses react-native-reanimated for animations
 *
 * Performance optimizations:
 * - Uses memo to prevent unnecessary re-renders
 * - Adaptive animation duration for low-end devices
 * - Reduced particle count on low-end devices (no pulse ring)
 */

import React, { useEffect, useMemo, memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { isLowEndDevice, getAdaptiveAnimationDuration } from '@/lib/utils/responsive';

interface LaserOverlayProps {
  /** Target position (in viewport coordinates 0-1000) */
  position: {
    x: number;
    y: number;
  };
  /** Laser color (default '#ff3b30') */
  color?: string;
  /** Fly-in animation duration (ms, default 500) */
  duration?: number;
  /** Scale factor for horizontal positioning */
  scaleX: number;
  /** Scale factor for vertical positioning */
  scaleY: number;
  /** Canvas dimensions for calculating fly-in start position */
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * LaserOverlay Component
 *
 * Creates a laser pointer effect:
 * - Fly-in: starts from corner opposite to target position
 * - Pulse: continuous expanding ring animation (disabled on low-end devices)
 * - Glow: core dot with shadow glow effect
 */
export const LaserOverlay = memo(function LaserOverlay({
  position,
  color = '#ff3b30',
  duration = 500,
  scaleX,
  scaleY,
  canvasWidth,
  canvasHeight,
}: LaserOverlayProps) {
  // Low-end device detection
  const lowEnd = isLowEndDevice();
  const flyDuration = getAdaptiveAnimationDuration(duration);

  // Determine start position (fly-in from opposite corner)
  const startPos = useMemo(() => {
    // If target is on right side, fly in from left
    // If target is on left side, fly in from right
    const viewportWidth = canvasWidth / scaleX;
    const viewportHeight = canvasHeight / scaleY;
    const isRightSide = position.x > viewportWidth / 2;
    const isBottomSide = position.y > viewportHeight / 2;

    return {
      x: isRightSide ? -20 : viewportWidth + 20,
      y: isBottomSide ? -20 : viewportHeight + 20,
    };
  }, [position, canvasWidth, canvasHeight, scaleX, scaleY]);

  // Animation values
  const laserX = useSharedValue(startPos.x);
  const laserY = useSharedValue(startPos.y);
  const laserOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  // Start animations on mount
  useEffect(() => {
    // Fly-in animation
    laserX.value = withTiming(position.x, {
      duration: flyDuration,
      easing: Easing.out(Easing.exp),
    });
    laserY.value = withTiming(position.y, {
      duration: flyDuration,
      easing: Easing.out(Easing.exp),
    });

    // Fade in during fly-in
    laserOpacity.value = withDelay(100, withTiming(1, { duration: 150 }));

    // Pulsing ring animation - only on non-low-end devices
    if (!lowEnd) {
      pulseScale.value = withRepeat(
        withTiming(2.8, { duration: 1200 }),
        -1, // infinite
        false // don't reverse
      );
      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1200 }),
        -1,
        false
      );
    }
  }, [position, startPos, flyDuration, lowEnd]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(laserX);
      cancelAnimation(laserY);
      cancelAnimation(laserOpacity);
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
    };
  }, []);

  // Average scale for visual consistency
  const avgScale = (scaleX + scaleY) / 2;

  // Core dot animated style (position) - use dual-axis scaling
  const coreAnimatedStyle = useAnimatedStyle(() => ({
    left: laserX.value * scaleX - 5 * avgScale,
    top: laserY.value * scaleY - 5 * avgScale,
    opacity: laserOpacity.value,
  }));

  // Pulse ring animated style
  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    left: laserX.value * scaleX - 15 * avgScale,
    top: laserY.value * scaleY - 15 * avgScale,
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Dot size based on average scale
  const dotSize = 10 * avgScale;
  const pulseSize = 30 * avgScale;

  return (
    <>
      {/* Pulsing ring - expands outward with fade */}
      <Animated.View
        style={[
          styles.pulseRing,
          pulseAnimatedStyle,
          {
            width: pulseSize,
            height: pulseSize,
            borderRadius: pulseSize / 2,
            borderColor: color,
          },
        ]}
      />

      {/* Core dot - solid center with glow */}
      <Animated.View
        style={[
          styles.coreDot,
          coreAnimatedStyle,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            shadowColor: color,
          },
        ]}
      />
    </>
  );
});

const styles = StyleSheet.create({
  pulseRing: {
    position: 'absolute',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  coreDot: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
});