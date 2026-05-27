/**
 * ResponsiveContainer - Adaptive container with breakpoint-aware padding
 *
 * Wraps content with responsive padding and optional max-width constraint
 * for tablet layouts.
 */

import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useResponsiveDimensions, responsiveValue, ResponsiveSpacing } from '@/lib/utils/responsive';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  /** Padding size preset */
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Limit max width on tablets (centers content) */
  maxWidth?: boolean;
  /** Custom max width value (overrides default) */
  maxWidthValue?: number;
  /** Additional style */
  style?: ViewStyle;
  /** Background color */
  backgroundColor?: string;
  /** Test ID for debugging */
  testID?: string;
}

const PADDING_PRESETS: Record<string, keyof typeof ResponsiveSpacing> = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
};

const MAX_WIDTH_VALUES = {
  compact: undefined,
  regular: undefined,
  medium: 720,
  large: 960,
};

export function ResponsiveContainer({
  children,
  padding = 'md',
  maxWidth = false,
  maxWidthValue,
  backgroundColor,
  style,
  testID,
}: ResponsiveContainerProps) {
  const { breakpoint, isTablet, width } = useResponsiveDimensions();

  // Get padding value based on preset and breakpoint
  const paddingSize = padding === 'none' ? 0 : responsiveValue(
    ResponsiveSpacing[PADDING_PRESETS[padding] || 'md'],
    breakpoint
  );

  // Calculate max width (only for tablets if maxWidth enabled)
  const containerMaxWidth = maxWidthValue ?? (maxWidth && isTablet
    ? responsiveValue(MAX_WIDTH_VALUES, breakpoint)
    : undefined);

  const containerStyle: ViewStyle = {
    flex: 1,
    paddingHorizontal: paddingSize,
    paddingVertical: paddingSize,
    backgroundColor,
    ...(containerMaxWidth && {
      maxWidth: containerMaxWidth,
      alignSelf: 'center',
      width: Math.min(width, containerMaxWidth),
    }),
  };

  return (
    <View style={[containerStyle, style]} testID={testID}>
      {children}
    </View>
  );
}

export default ResponsiveContainer;