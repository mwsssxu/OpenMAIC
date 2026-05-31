/**
 * ResponsiveGrid - Auto-adjusting grid layout
 *
 * Automatically calculates optimal column count based on screen width
 * and item width, or uses predefined columns per breakpoint.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import {
  useResponsiveDimensions,
  responsiveValue,
  ResponsiveSpacing,
  calculateGridColumns,
} from '@/lib/utils/responsive';

interface ResponsiveGridProps {
  children: React.ReactNode[];
  /** Minimum width per item (auto-calculates columns) */
  minItemWidth?: number;
  /** Gap between items */
  gap?: 'xs' | 'sm' | 'md' | 'lg' | number;
  /** Predefined columns per breakpoint (overrides auto-calculation) */
  columns?: { compact?: number; regular?: number; medium?: number; large?: number };
  /** Maximum columns allowed */
  maxColumns?: number;
  /** Additional style for container */
  style?: ViewStyle;
  /** Additional style for each item */
  itemStyle?: ViewStyle;
  /** Test ID for debugging */
  testID?: string;
}

const GAP_PRESETS: Record<string, number> = {
  xs: ResponsiveSpacing.xs.compact,
  sm: ResponsiveSpacing.sm.compact,
  md: ResponsiveSpacing.md.compact,
  lg: ResponsiveSpacing.lg.compact,
};

export function ResponsiveGrid({
  children,
  minItemWidth = 80,
  gap = 'sm',
  columns,
  maxColumns = 10,
  style,
  itemStyle,
  testID,
}: ResponsiveGridProps) {
  const { width, breakpoint, isTablet } = useResponsiveDimensions();

  // Calculate gap value
  const gapValue = typeof gap === 'number' ? gap : (GAP_PRESETS[gap] || 8);
  const responsiveGap = responsiveValue(
    { compact: gapValue, regular: gapValue, medium: gapValue * 1.5, large: gapValue * 2 },
    breakpoint
  );

  // Calculate number of columns
  let numColumns: number;

  if (columns) {
    // Use predefined columns
    numColumns = columns[breakpoint] ?? calculateGridColumns(width, minItemWidth, responsiveGap, maxColumns);
  } else {
    // Auto-calculate based on minItemWidth
    numColumns = calculateGridColumns(width, minItemWidth, responsiveGap, maxColumns);
  }

  // Guard against division by zero
  numColumns = Math.max(1, numColumns);

  // Calculate item width to fill grid evenly
  // Formula: itemWidth = (containerWidth - (columns - 1) * gap) / columns
  // We use percentage to allow flex shrink if needed
  const containerWidth = width - responsiveGap * 2; // Account for container padding
  const itemWidthPercent = (100 - (numColumns - 1) * (responsiveGap / containerWidth * 100)) / numColumns;

  // Render grid
  const rows: React.ReactNode[] = [];
  const items = React.Children.toArray(children);

  for (let i = 0; i < items.length; i += numColumns) {
    const rowItems = items.slice(i, i + numColumns);
    rows.push(
      <View key={`row-${i}`} style={[styles.row, { gap: responsiveGap }]}>
        {rowItems.map((item, j) => (
          <View
            key={`item-${i + j}`}
            style={[
              styles.item,
              { flex: 1, maxWidth: `${100 / numColumns}%` },
              itemStyle,
            ]}
          >
            {item}
          </View>
        ))}
        {/* Fill empty slots to maintain grid alignment */}
        {rowItems.length < numColumns &&
          Array.from({ length: numColumns - rowItems.length }).map((_, k) => (
            <View key={`empty-${i + rowItems.length + k}`} style={[styles.item, { flex: 1 }]} />
          ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, { gap: responsiveGap }, style]} testID={testID}>
      {rows}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexWrap: 'wrap',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  item: {
    // Flex properties set dynamically
  },
});

export default ResponsiveGrid;