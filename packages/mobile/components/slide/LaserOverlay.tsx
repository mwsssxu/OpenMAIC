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
 */

import React, { useEffect, useMemo } from 'react';
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
  /** Scale factor for positioning */
  scale: number;
  /** Canvas dimensions for calculating fly-in start position */
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * LaserOverlay Component
 *
 * Creates a laser pointer effect:
 * - Fly-in: starts from corner opposite to target position
 * - Pulse: continuous expanding ring animation
 * - Glow: core dot with shadow glow effect
 */
export function LaserOverlay({
  position,
  color = '#ff3b30',
  duration = 500,
  scale,
  canvasWidth,
  canvasHeight,
}: LaserOverlayProps) {
  // Determine start position (fly-in from opposite corner)
  const startPos = useMemo(() => {
    // If target is on right side, fly in from left
    // If target is on left side, fly in from right
    const viewportWidth = canvasWidth / scale;
    const isRightSide = position.x > viewportWidth / 2;
    const isBottomSide = position.y > (canvasHeight / scale) / 2;

    return {
      x: isRightSide ? -20 : viewportWidth + 20,
      y: isBottomSide ? -20 : (canvasHeight / scale) + 20,
    };
  }, [position, canvasWidth, canvasHeight, scale]);

  // Animation values
  const laserX = useSharedValue(startPos.x);
  const laserY = useSharedValue(startPos.y);
  const laserOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  // Start animations on mount
  useEffect(() => {
    // Fly-in animation (0.5s ease-out)
    laserX.value = withTiming(position.x, {
      duration: duration,
      easing: Easing.out(Easing.exp),
    });
    laserY.value = withTiming(position.y, {
      duration: duration,
      easing: Easing.out(Easing.exp),
    });

    // Fade in during fly-in
    laserOpacity.value = withDelay(100, withTiming(1, { duration: 150 }));

    // Pulsing ring animation (1.2s cycle)
    // Scale: 1 → 2.8, Opacity: 0.6 → 0 (starts immediately)
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
  }, [position, startPos, duration]);

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

  // Core dot animated style (position)
  const coreAnimatedStyle = useAnimatedStyle(() => ({
    left: laserX.value * scale - 5 * scale,
    top: laserY.value * scale - 5 * scale,
    opacity: laserOpacity.value,
  }));

  // Pulse ring animated style
  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    left: laserX.value * scale - 15 * scale,
    top: laserY.value * scale - 15 * scale,
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Dot size based on scale
  const dotSize = 10 * scale;
  const pulseSize = 30 * scale;

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
}

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