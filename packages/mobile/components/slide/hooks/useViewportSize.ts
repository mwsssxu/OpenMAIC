/**
 * useViewportSize Hook for Mobile
 *
 * Calculates viewport scaling and positioning to fit slide content
 * Adapted from Web's components/slide-renderer/Editor/Canvas/hooks/useViewportSize.ts
 */

import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import { View } from 'react-native';

export interface ViewportStyles {
  width: number;
  height: number;
  left: number;
  top: number;
  scale: number;
}

interface UseViewportSizeOptions {
  /** Viewport width in pixels (default: 1000 for 16:9 ratio) */
  viewportWidth?: number;
  /** Viewport height ratio (default: 16/9) */
  viewportRatio?: number;
  /** Canvas percentage in container (default: 95) */
  canvasPercentage?: number;
}

const DEFAULT_VIEWPORT_WIDTH = 1000;
const DEFAULT_VIEWPORT_RATIO = 16 / 9;
const DEFAULT_CANVAS_PERCENTAGE = 95;

/**
 * Hook for managing Canvas viewport size and position
 *
 * Returns viewport styles and scale factor to fit the slide canvas
 * into the container while maintaining aspect ratio.
 */
export function useViewportSize(
  _containerRef: RefObject<View | null>,
  options?: UseViewportSizeOptions
): ViewportStyles {
  const viewportWidth = options?.viewportWidth ?? DEFAULT_VIEWPORT_WIDTH;
  const viewportRatio = options?.viewportRatio ?? DEFAULT_VIEWPORT_RATIO;
  const canvasPercentage = options?.canvasPercentage ?? DEFAULT_CANVAS_PERCENTAGE;

  const [viewportStyles, setViewportStyles] = useState<ViewportStyles>({
    width: viewportWidth,
    height: viewportWidth * viewportRatio,
    left: 0,
    top: 0,
    scale: 1,
  });

  const prevDimensionsRef = useRef({ width: 0, height: 0 });

  const calculateViewport = useCallback((containerWidth: number, containerHeight: number) => {
    // Skip if dimensions haven't changed significantly
    if (
      Math.abs(containerWidth - prevDimensionsRef.current.width) < 10 &&
      Math.abs(containerHeight - prevDimensionsRef.current.height) < 10
    ) {
      return;
    }

    prevDimensionsRef.current = { width: containerWidth, height: containerHeight };

    const viewportHeight = viewportWidth * viewportRatio;
    const containerRatio = containerHeight / containerWidth;

    let scale: number;
    let left: number;
    let top: number;

    if (containerRatio > viewportRatio) {
      // Container is taller than viewport - fit by width
      const viewportActualWidth = containerWidth * (canvasPercentage / 100);
      scale = viewportActualWidth / viewportWidth;
      left = (containerWidth - viewportActualWidth) / 2;
      top = (containerHeight - viewportActualWidth * viewportRatio) / 2;
    } else {
      // Container is wider than viewport - fit by height
      const viewportActualHeight = containerHeight * (canvasPercentage / 100);
      scale = viewportActualHeight / viewportHeight;
      left = (containerWidth - viewportActualHeight / viewportRatio) / 2;
      top = (containerHeight - viewportActualHeight) / 2;
    }

    setViewportStyles({
      width: viewportWidth,
      height: viewportHeight,
      left,
      top,
      scale,
    });
  }, [viewportWidth, viewportRatio, canvasPercentage]);

  // Initial calculation and resize handling
  useEffect(() => {
    // We need to use onLayout for React Native View measurements
    // This effect sets up the initial calculation
    calculateViewport(0, 0);
  }, [calculateViewport]);

  // Handler to be called on container layout
  const handleLayout = useCallback((event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      calculateViewport(width, height);
    }
  }, [calculateViewport]);

  return {
    ...viewportStyles,
    // Include handleLayout for the component to use
    _handleLayout: handleLayout,
  } as ViewportStyles & { _handleLayout: (event: { nativeEvent: { layout: { width: number; height: number } } }) => void };
}

/**
 * Get background style for slide
 */
export function useSlideBackgroundStyle(background?: { type: string; color?: string; image?: { src: string }; gradient?: { colors: Array<{ pos: number; color: string }> } }): { backgroundColor: string } {
  if (!background) {
    return { backgroundColor: '#ffffff' };
  }

  switch (background.type) {
    case 'solid':
      return { backgroundColor: background.color || '#ffffff' };
    case 'image':
      // For image background, we'll handle it in the component with ImageBackground
      return { backgroundColor: '#ffffff' };
    case 'gradient':
      // React Native doesn't support CSS gradients directly, fallback to solid
      return { backgroundColor: background.gradient?.colors?.[0]?.color || '#ffffff' };
    default:
      return { backgroundColor: '#ffffff' };
  }
}

/**
 * Parse HTML content to plain text (simplified)
 */
export function parseHtmlToText(html: string): string {
  if (!html) return '';
  // Remove HTML tags
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * Extract font size from HTML content (looks for style="font-size: XXpx")
 * Returns default size if not found
 */
export function extractFontSizeFromHtml(html: string, defaultSize: number = 16): number {
  if (!html) return defaultSize;

  // Look for font-size in style attribute
  const fontSizeMatch = html.match(/font-size:\s*(\d+(?:\.\d+)?)(px|pt|em|rem)?/i);
  if (fontSizeMatch) {
    const size = parseFloat(fontSizeMatch[1]);
    const unit = fontSizeMatch[2] || 'px';

    // Convert units to px (simplified)
    if (unit === 'pt') {
      return size * 1.33; // pt to px
    } else if (unit === 'em' || unit === 'rem') {
      return size * 16; // assuming base of 16px
    }
    return size;
  }

  // Check for heading tags which imply larger font sizes
  if (html.includes('<h1')) return 32;
  if (html.includes('<h2')) return 24;
  if (html.includes('<h3')) return 20;

  return defaultSize;
}

/**
 * Parse HTML content to styled text segments (for rich text)
 */
export interface TextSegment {
  text: string;
  style: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    fontSize?: number;
  };
}

export function parseHtmlToSegments(html: string, defaultColor: string, _defaultFontName: string): TextSegment[] {
  if (!html) return [];

  // Simplified parsing - just extract text with basic style hints
  const segments: TextSegment[] = [];

  // Check for bold tags
  const boldMatch = html.match(/<strong[^>]*>(.*?)<\/strong>/i) || html.match(/<b[^>]*>(.*?)<\/b>/i);
  if (boldMatch) {
    segments.push({
      text: parseHtmlToText(boldMatch[1]),
      style: { bold: true },
    });
  }

  // Check for italic tags
  const italicMatch = html.match(/<em[^>]*>(.*?)<\/em>/i) || html.match(/<i[^>]*>(.*?)<\/i>/i);
  if (italicMatch) {
    segments.push({
      text: parseHtmlToText(italicMatch[1]),
      style: { italic: true },
    });
  }

  // If no styled segments found, return plain text
  if (segments.length === 0) {
    segments.push({
      text: parseHtmlToText(html),
      style: { color: defaultColor },
    });
  }

  return segments;
}