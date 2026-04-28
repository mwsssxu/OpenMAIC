/**
 * ScreenCanvas - Main slide canvas for Mobile
 *
 * Renders slide content using absolute positioning with proper scaling
 * Adapted from Web's components/slide-renderer/Editor/ScreenCanvas.tsx
 *
 * Note: React Native doesn't support CSS transformOrigin, so we scale
 * element positions/dimensions directly instead of using scale transform.
 */

import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { ScreenElement } from './ScreenElement';
import type { PPTElement, SlideBackground, SlideTheme, PPTLineElement } from './types';
import { useSlideBackgroundStyle } from './hooks/useViewportSize';

// Helper to check if element is a line
function isLineElement(element: PPTElement): element is PPTLineElement {
  return element.type === 'line';
}

interface ScreenCanvasProps {
  /** Slide elements to render */
  elements: PPTElement[];
  /** Slide background */
  background?: SlideBackground;
  /** Slide theme */
  theme?: SlideTheme;
  /** Spotlight target element ID */
  spotlightElementId?: string | null;
  /** Laser target element ID */
  laserElementId?: string | null;
  /** Laser options */
  laserOptions?: { color?: string; duration?: number };
}

const VIEWPORT_WIDTH = 1000;
const VIEWPORT_RATIO = 16 / 9;
const VIEWPORT_HEIGHT = VIEWPORT_WIDTH / VIEWPORT_RATIO; // 562.5 for 16:9 widescreen

/**
 * ScreenCanvas Component
 *
 * Renders a slide with absolute positioned elements and proper scaling
 */
export function ScreenCanvas({
  elements,
  background,
  theme,
  spotlightElementId,
  laserElementId,
  laserOptions,
}: ScreenCanvasProps) {
  const containerRef = useRef<View>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Laser animation values
  const laserOpacity = useSharedValue(1);
  const laserScale = useSharedValue(1);

  // Start laser animation when laser is active
  useEffect(() => {
    if (laserElementId) {
      // Pulsing animation: scale up/down, opacity fade
      laserScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 300, easing: Easing.ease }),
          withTiming(1, { duration: 300, easing: Easing.ease })
        ),
        -1, // infinite
        true // reverse
      );
      laserOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 400 }),
          withTiming(1, { duration: 400 })
        ),
        -1,
        true
      );
    } else {
      // Cancel running animations and reset values
      cancelAnimation(laserScale);
      cancelAnimation(laserOpacity);
      laserScale.value = withTiming(1, { duration: 100 });
      laserOpacity.value = withTiming(1, { duration: 100 });
    }
  }, [laserElementId]);

  // Laser animated style
  const laserAnimatedStyle = useAnimatedStyle(() => ({
    opacity: laserOpacity.value,
    transform: [{ scale: laserScale.value }],
  }));

  // Calculate scale to fit viewport in container
  const scale = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return 1;
    const containerRatio = containerSize.height / containerSize.width;

    if (containerRatio > VIEWPORT_RATIO) {
      // Container is taller - fit by width (95% of container width)
      return (containerSize.width * 0.95) / VIEWPORT_WIDTH;
    } else {
      // Container is wider - fit by height (95% of container height)
      return (containerSize.height * 0.95) / VIEWPORT_HEIGHT;
    }
  }, [containerSize]);

  // Calculate positioned canvas position
  const canvasPosition = useMemo(() => {
    const scaledWidth = VIEWPORT_WIDTH * scale;
    const scaledHeight = VIEWPORT_HEIGHT * scale;
    return {
      left: (containerSize.width - scaledWidth) / 2,
      top: (containerSize.height - scaledHeight) / 2,
    };
  }, [containerSize, scale]);

  // Handle layout to get container dimensions
  const handleLayout = useCallback((event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setContainerSize({ width, height });
    }
  }, []);

  // Background style
  const backgroundStyle = useSlideBackgroundStyle(background);

  // Default theme values
  const defaultTheme: SlideTheme = {
    backgroundColor: '#ffffff',
    fontColor: '#333333',
    fontName: 'System',
  };
  const activeTheme = theme || defaultTheme;

  // Calculate spotlight geometry if needed
  const spotlightGeometry = useMemo(() => {
    if (!spotlightElementId) return null;
    const element = elements.find((el) => el.id === spotlightElementId);
    if (!element) return null;

    // LineElement doesn't have height, use calculated height
    const width = element.width || (isLineElement(element) ? Math.abs(element.end[0] - element.start[0]) : 100);
    const height = isLineElement(element) ? Math.abs(element.end[1] - element.start[1]) : (element.height || 2);

    return {
      centerX: element.left + width / 2,
      centerY: element.top + height / 2,
      width,
      height,
      padding: 20, // Extra space around element
    };
  }, [spotlightElementId, elements]);

  // Calculate laser position if needed
  const laserPosition = useMemo(() => {
    if (!laserElementId) return null;
    const element = elements.find((el) => el.id === laserElementId);
    if (!element) return null;

    // LineElement doesn't have height, use calculated height
    const width = element.width || (isLineElement(element) ? Math.abs(element.end[0] - element.start[0]) : 100);
    const height = isLineElement(element) ? Math.abs(element.end[1] - element.start[1]) : (element.height || 2);

    return {
      x: element.left + width / 2,
      y: element.top + height / 2,
    };
  }, [laserElementId, elements]);

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={handleLayout}
    >
      {/* Canvas - positioned absolutely with scaled dimensions */}
      {/* Elements inside are rendered at scaled positions directly */}
      <View
        style={[
          styles.canvas,
          backgroundStyle,
          {
            position: 'absolute',
            left: canvasPosition.left,
            top: canvasPosition.top,
            width: VIEWPORT_WIDTH * scale,
            height: VIEWPORT_HEIGHT * scale,
          },
        ]}
      >
        {/* Elements layer - each element receives scale for positioning */}
        {elements.map((element, index) => (
          <ScreenElement
            key={element.id}
            element={element}
            index={index}
            theme={activeTheme}
            scale={scale}
          />
        ))}

        {/* Spotlight overlay - highlights target element with border */}
        {spotlightGeometry && (
          <View
            style={[
              styles.spotlightHighlight,
              {
                left: (spotlightGeometry.centerX - spotlightGeometry.width / 2 - spotlightGeometry.padding) * scale,
                top: (spotlightGeometry.centerY - spotlightGeometry.height / 2 - spotlightGeometry.padding) * scale,
                width: (spotlightGeometry.width + spotlightGeometry.padding * 2) * scale,
                height: (spotlightGeometry.height + spotlightGeometry.padding * 2) * scale,
                borderRadius: 8 * scale,
              },
            ]}
          />
        )}

        {/* Laser pointer with pulsing animation */}
        {laserPosition && (
          <Animated.View
            style={[
              styles.laserDot,
              laserAnimatedStyle,
              {
                left: laserPosition.x * scale - 8,
                top: laserPosition.y * scale - 8,
              },
            ]}
          >
            {/* Inner glowing dot */}
            <View
              style={[
                styles.laserInner,
                { backgroundColor: laserOptions?.color || '#ff3333' },
              ]}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvas: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  spotlightHighlight: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#5b9bd5',
    backgroundColor: 'transparent',
    // Subtle glow effect
    shadowColor: '#5b9bd5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  laserDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 50, 50, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    // Outer glow
    shadowColor: '#ff3333',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  laserInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});