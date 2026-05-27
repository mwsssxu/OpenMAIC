/**
 * Responsive Design Utilities
 *
 * Provides breakpoint detection, responsive values, and adaptive spacing/typography
 * for phone and tablet adaptation.
 *
 * Breakpoints:
 * - compact: < 500px (small phones like iPhone SE)
 * - regular: 500-768px (standard phones)
 * - medium: 768-1024px (large phones, small tablets)
 * - large: >= 1024px (full tablets like iPad Pro)
 */

import { Dimensions, StyleSheet, PixelRatio } from 'react-native';
import { useState, useEffect, useMemo } from 'react';

// Breakpoint types
export type Breakpoint = 'compact' | 'regular' | 'medium' | 'large';

// Breakpoint thresholds (width in pixels)
export const BREAKPOINTS = {
  compact: 500,   // < 500px
  regular: 768,   // 500-768px
  medium: 1024,   // 768-1024px
  // large: >= 1024px
};

/**
 * Determine breakpoint from screen width
 */
export function getBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.compact) return 'compact';
  if (width < BREAKPOINTS.regular) return 'regular';
  if (width < BREAKPOINTS.medium) return 'medium';
  return 'large';
}

/**
 * Get current screen dimensions
 */
export function getScreenDimensions(): { width: number; height: number } {
  const { width, height } = Dimensions.get('window');
  return { width, height };
}

/**
 * Hook: Get current breakpoint
 * Responds to dimension changes (e.g., rotation)
 */
export function useBreakpoint(): Breakpoint {
  const [dimensions, setDimensions] = useState(getScreenDimensions());

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });
    return () => subscription?.remove();
  }, []);

  return useMemo(() => getBreakpoint(dimensions.width), [dimensions.width]);
}

/**
 * Hook: Get responsive dimensions and device info
 */
export function useResponsiveDimensions(): {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isCompact: boolean;
  isRegular: boolean;
  isMedium: boolean;
  isLarge: boolean;
  isTablet: boolean;
  isPhone: boolean;
  pixelRatio: number;
} {
  const [dimensions, setDimensions] = useState(getScreenDimensions());
  const pixelRatio = PixelRatio.get();

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });
    return () => subscription?.remove();
  }, []);

  const breakpoint = useMemo(() => getBreakpoint(dimensions.width), [dimensions.width]);

  return useMemo(() => ({
    width: dimensions.width,
    height: dimensions.height,
    breakpoint,
    isCompact: breakpoint === 'compact',
    isRegular: breakpoint === 'regular',
    isMedium: breakpoint === 'medium',
    isLarge: breakpoint === 'large',
    isTablet: breakpoint === 'medium' || breakpoint === 'large',
    isPhone: breakpoint === 'compact' || breakpoint === 'regular',
    pixelRatio,
  }), [dimensions, breakpoint, pixelRatio]);
}

/**
 * Responsive value selector
 * Returns the appropriate value for the current breakpoint
 */
export function responsiveValue<T>(
  values: { compact?: T; regular?: T; medium?: T; large?: T },
  breakpoint: Breakpoint
): T {
  // Fallback chain: specified value -> larger breakpoint value -> smaller breakpoint value
  if (values[breakpoint] !== undefined) {
    return values[breakpoint]!;
  }

  // Fallback to larger breakpoints (tablets can use phone values if not specified)
  if (breakpoint === 'large' && values.medium !== undefined) return values.medium;
  if (breakpoint === 'large' && values.regular !== undefined) return values.regular;
  if (breakpoint === 'large' && values.compact !== undefined) return values.compact;

  if (breakpoint === 'medium' && values.regular !== undefined) return values.regular;
  if (breakpoint === 'medium' && values.compact !== undefined) return values.compact;
  if (breakpoint === 'medium' && values.large !== undefined) return values.large;

  if (breakpoint === 'regular' && values.compact !== undefined) return values.compact;
  if (breakpoint === 'regular' && values.medium !== undefined) return values.medium;
  if (breakpoint === 'regular' && values.large !== undefined) return values.large;

  if (breakpoint === 'compact' && values.regular !== undefined) return values.regular;
  if (breakpoint === 'compact' && values.medium !== undefined) return values.medium;
  if (breakpoint === 'compact' && values.large !== undefined) return values.large;

  // If nothing specified, return first available value
  const available = Object.values(values).filter(v => v !== undefined);
  return available[0] as T;
}

/**
 * Hook: Get responsive value based on current breakpoint
 */
export function useResponsiveValue<T>(
  values: { compact?: T; regular?: T; medium?: T; large?: T }
): T {
  const breakpoint = useBreakpoint();
  return responsiveValue(values, breakpoint);
}

/**
 * Pre-defined responsive spacing values (margins, paddings)
 */
export const ResponsiveSpacing = {
  xs: { compact: 4, regular: 4, medium: 6, large: 8 },
  sm: { compact: 8, regular: 8, medium: 12, large: 16 },
  md: { compact: 12, regular: 16, medium: 20, large: 24 },
  lg: { compact: 16, regular: 24, medium: 32, large: 40 },
  xl: { compact: 24, regular: 32, medium: 48, large: 64 },
  xxl: { compact: 32, regular: 48, medium: 64, large: 80 },
};

/**
 * Pre-defined responsive typography sizes (font sizes in pixels)
 */
export const ResponsiveTypography = {
  h1: { compact: 24, regular: 28, medium: 36, large: 40 },
  h2: { compact: 20, regular: 22, medium: 28, large: 32 },
  h3: { compact: 18, regular: 20, medium: 24, large: 28 },
  h4: { compact: 16, regular: 18, medium: 20, large: 24 },
  body: { compact: 14, regular: 16, medium: 18, large: 20 },
  bodyLg: { compact: 16, regular: 18, medium: 20, large: 22 },
  caption: { compact: 12, regular: 12, medium: 14, large: 16 },
  small: { compact: 10, regular: 11, medium: 12, large: 14 },
};

/**
 * Pre-defined responsive card dimensions
 */
export const ResponsiveCard = {
  width: { compact: 140, regular: 160, medium: 200, large: 240 },
  minWidth: { compact: 120, regular: 140, medium: 180, large: 220 },
  padding: { compact: 12, regular: 16, medium: 20, large: 24 },
  borderRadius: { compact: 12, regular: 12, medium: 16, large: 20 },
};

/**
 * Pre-defined responsive button dimensions
 */
export const ResponsiveButton = {
  height: { compact: 40, regular: 44, medium: 48, large: 52 },
  paddingH: { compact: 12, regular: 16, medium: 20, large: 24 },
  fontSize: { compact: 14, regular: 16, medium: 18, large: 20 },
  borderRadius: { compact: 8, regular: 8, medium: 12, large: 12 },
};

/**
 * Pre-defined responsive icon sizes
 */
export const ResponsiveIcon = {
  sm: { compact: 16, regular: 18, medium: 20, large: 24 },
  md: { compact: 20, regular: 22, medium: 26, large: 32 },
  lg: { compact: 24, regular: 28, medium: 36, large: 44 },
  xl: { compact: 32, regular: 40, medium: 48, large: 56 },
};

/**
 * Hook: Get responsive spacing value
 */
export function useSpacing(size: keyof typeof ResponsiveSpacing): number {
  return useResponsiveValue(ResponsiveSpacing[size]);
}

/**
 * Hook: Get responsive font size
 */
export function useFontSize(style: keyof typeof ResponsiveTypography): number {
  return useResponsiveValue(ResponsiveTypography[style]);
}

/**
 * Calculate optimal grid columns based on screen width and item width
 */
export function calculateGridColumns(
  screenWidth: number,
  minItemWidth: number,
  gap: number = 12,
  maxColumns: number = 10
): number {
  // Calculate how many items can fit with gaps
  // Formula: columns = floor((width + gap) / (itemWidth + gap))
  const columnsWithGap = Math.floor((screenWidth + gap) / (minItemWidth + gap));
  return Math.min(Math.max(1, columnsWithGap), maxColumns);
}

/**
 * Get responsive grid columns based on breakpoint or auto-calculate
 */
export function getGridColumns(
  breakpoint: Breakpoint,
  config?: { compact?: number; regular?: number; medium?: number; large?: number },
  minItemWidth?: number,
  screenWidth?: number
): number {
  if (config && config[breakpoint] !== undefined) {
    return config[breakpoint]!;
  }

  // Auto-calculate based on minItemWidth
  if (minItemWidth && screenWidth) {
    return calculateGridColumns(screenWidth, minItemWidth);
  }

  // Default columns per breakpoint
  const defaults: Record<Breakpoint, number> = {
    compact: 4,
    regular: 5,
    medium: 6,
    large: 8,
  };
  return defaults[breakpoint];
}

/**
 * Create responsive styles that adapt to breakpoint
 */
export function createResponsiveStyles<T extends StyleSheet.NamedStyles<T>>(
  styleCreator: (breakpoint: Breakpoint) => T
): (breakpoint: Breakpoint) => StyleSheet.NamedStyles<T> {
  return (breakpoint: Breakpoint) => StyleSheet.create(styleCreator(breakpoint));
}

/**
 * Helper to create breakpoint-aware style object (for inline styles)
 */
export function getResponsiveStyles(
  breakpoint: Breakpoint,
  styles: {
    compact?: object;
    regular?: object;
    medium?: object;
    large?: object;
  }
): object {
  const result = responsiveValue(styles, breakpoint);
  return result || {};
}

// Export screen dimensions for backward compatibility with scaling.ts
export const screenW = Dimensions.get('window').width;
export const screenH = Dimensions.get('window').height;