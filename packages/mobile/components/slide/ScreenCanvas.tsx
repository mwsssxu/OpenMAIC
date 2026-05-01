/**
 * ScreenCanvas - Main slide canvas for Mobile
 *
 * Renders slide content using absolute positioning with proper scaling
 * Adapted from Web's components/slide-renderer/Editor/ScreenCanvas.tsx
 *
 * Note: React Native doesn't support CSS transformOrigin, so we scale
 * element positions/dimensions directly instead of using scale transform.
 */

import React, { useRef, useMemo, useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenElement } from './ScreenElement';
import { SpotlightOverlay } from './SpotlightOverlay';
import { LaserOverlay } from './LaserOverlay';
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
  /** Spotlight options */
  spotlightOptions?: { dimness?: number };
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
 * Includes SpotlightOverlay and LaserOverlay for visual effects
 */
export function ScreenCanvas({
  elements,
  background,
  theme,
  spotlightElementId,
  spotlightOptions,
  laserElementId,
  laserOptions,
}: ScreenCanvasProps) {
  const containerRef = useRef<View>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

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

  // Canvas dimensions for overlays
  const canvasWidth = VIEWPORT_WIDTH * scale;
  const canvasHeight = VIEWPORT_HEIGHT * scale;

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
            width: canvasWidth,
            height: canvasHeight,
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

        {/* Spotlight overlay - dimming + highlight effect */}
        {spotlightGeometry && (
          <SpotlightOverlay
            geometry={spotlightGeometry}
            dimness={spotlightOptions?.dimness ?? 0.7}
            scale={scale}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
          />
        )}

        {/* Laser pointer overlay - fly-in + pulse effect */}
        {laserPosition && (
          <LaserOverlay
            position={laserPosition}
            color={laserOptions?.color ?? '#ff3b30'}
            duration={laserOptions?.duration ?? 500}
            scale={scale}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
          />
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
});