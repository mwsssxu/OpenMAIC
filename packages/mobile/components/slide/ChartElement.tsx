import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { PPTChartElement, SlideTheme } from './types';
import { sFont, isSmallScreen } from '@/lib/utils/scaling';

interface ChartElementProps {
  element: PPTChartElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
}

const THEME_COLORS = ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'];

export function ChartElement({ element, theme, scaleX, scaleY }: ChartElementProps) {
  const chartType = element.chartType ?? 'bar';
  const data = element.data;
  const colors = element.themeColors ?? THEME_COLORS;

  if (!data) return null;

  // Parse data structure
  const labels: string[] = data.labels ?? [];
  const series: Array<{ name: string; data: number[] }> = data.series
    ? (data.legends ?? ['Value']).map((name: string, si: number) => ({
        name,
        data: data.series[si] ?? [],
      }))
    : [];

  if (labels.length === 0 || series.length === 0) {
    // Fallback: try array format [{ label, value }]
    if (Array.isArray(data)) {
      const items = data as Array<{ label?: string; name?: string; category?: string; value?: number }>;
      if (items.length > 0 && items[0].value !== undefined) {
        return (
          <SimpleBarChart
            element={element}
            scaleX={scaleX}
            scaleY={scaleY}
            items={items.map((d) => ({
              label: d.label ?? d.name ?? d.category ?? '',
              value: d.value!,
            }))}
            colors={colors}
          />
        );
      }
    }
    return <FallbackChart element={element} scaleX={scaleX} scaleY={scaleY} />;
  }

  if (chartType === 'pie') {
    return <PieChartView element={element} scaleX={scaleX} scaleY={scaleY} labels={labels} series={series} colors={colors} />;
  }

  return <BarChartView element={element} scaleX={scaleX} scaleY={scaleY} labels={labels} series={series} colors={colors} />;
}

/** Bar chart using flex-based bars (responsive) */
function BarChartView({ element, scaleX, scaleY, labels, series, colors }: {
  element: PPTChartElement; scaleX: number; scaleY: number;
  labels: string[]; series: Array<{ name: string; data: number[] }>; colors: string[];
}) {
  const maxVal = Math.max(...series.flatMap((s) => s.data), 1);

  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: element.left * scaleX,
    top: element.top * scaleY,
    width: Math.max(element.width * scaleX, 60),
    height: element.height > 0 ? element.height * scaleY : 200,
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 8,
    zIndex: 1,
  }), [element, scaleX, scaleY]);

  const labelSize = sFont(10, 8);
  const valueSize = sFont(9, 7);
  const barFlex = 1;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={containerStyle}>
        {/* Legend */}
        {series.length > 1 && (
          <View style={styles.legendRow}>
            {series.map((s, si) => (
              <View key={si} style={styles.seriesRow}>
                <View style={[styles.legendDot, { backgroundColor: colors[si % colors.length] }]} />
                <Text style={{ fontSize: labelSize, color: '#666', marginLeft: 4, marginRight: 8 }}>{s.name}</Text>
              </View>
            ))}
          </View>
        )}
        {/* Bars */}
        <View style={styles.barsArea}>
          {labels.map((label, li) => (
            <View key={li} style={[styles.barColumn, { flex: barFlex }]}>
              {series.map((s, si) => {
                const val = s.data[li] ?? 0;
                const pct = Math.max((val / maxVal) * 100, 3);
                return (
                  <View key={si} style={styles.barCell}>
                    <View style={{ flex: pct, backgroundColor: colors[si % colors.length], borderRadius: 2, justifyContent: 'flex-end' as const, alignItems: 'center' as const }}>
                      <Text style={{ fontSize: valueSize, color: '#333' }} numberOfLines={1}>{val}</Text>
                    </View>
                  </View>
                );
              })}
              <Text style={{ fontSize: labelSize, color: '#666', marginTop: 2 }} numberOfLines={1}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/** Simple bar chart for [{ label, value }] format */
function SimpleBarChart({ element, scaleX, scaleY, items, colors }: {
  element: PPTChartElement; scaleX: number; scaleY: number;
  items: Array<{ label: string; value: number }>; colors: string[];
}) {
  const maxVal = Math.max(...items.map((d) => d.value), 1);

  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: element.left * scaleX,
    top: element.top * scaleY,
    width: Math.max(element.width * scaleX, 60),
    height: element.height > 0 ? element.height * scaleY : 200,
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 8,
    zIndex: 1,
  }), [element, scaleX, scaleY]);

  const labelSize = sFont(10, 8);
  const valueSize = sFont(9, 7);

  return (
    <View style={containerStyle}>
      {items.map((item, i) => {
        const pct = Math.max((item.value / maxVal) * 100, 3);
        return (
          <View key={i} style={styles.simpleBarRow}>
            <Text style={{ fontSize: labelSize, color: '#666', flex: 1 }} numberOfLines={1}>{item.label}</Text>
            <View style={styles.simpleBarTrack}>
              <View style={{ flex: pct, backgroundColor: colors[i % colors.length], borderRadius: 2, justifyContent: 'center' as const, alignItems: 'center' as const }}>
                <Text style={{ fontSize: valueSize, color: '#fff' }} numberOfLines={1}>{item.value}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Pie chart as horizontal stacked bar with legend */
function PieChartView({ element, scaleX, scaleY, labels, series, colors }: {
  element: PPTChartElement; scaleX: number; scaleY: number;
  labels: string[]; series: Array<{ name: string; data: number[] }>; colors: string[];
}) {
  const total = series[0]?.data.reduce((a, b) => a + b, 0) || 1;

  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: element.left * scaleX,
    top: element.top * scaleY,
    width: Math.max(element.width * scaleX, 60),
    height: element.height > 0 ? element.height * scaleY : 160,
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 8,
    zIndex: 1,
  }), [element, scaleX, scaleY]);

  const labelSize = sFont(10, 8);

  return (
    <View style={containerStyle}>
      {/* Stacked bar */}
      <View style={styles.pieBar}>
        {series[0]?.data.map((val, i) => {
          const pct = Math.max((val / total) * 100, 2);
          return (
            <View key={i} style={{ flex: pct, backgroundColor: colors[i % colors.length], height: 24, justifyContent: 'center' as const, alignItems: 'center' as const }}>
              <Text style={{ fontSize: labelSize, color: '#fff' }} numberOfLines={1}>{Math.round(pct)}%</Text>
            </View>
          );
        })}
      </View>
      {/* Legend */}
      <View style={styles.legendRow}>
        {labels.map((label, i) => (
          <View key={i} style={styles.seriesRow}>
            <View style={[styles.legendDot, { backgroundColor: colors[i % colors.length] }]} />
            <Text style={{ fontSize: labelSize, color: '#666', marginLeft: 4, marginRight: 8 }} numberOfLines={1}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Fallback for unrecognized chart data */
function FallbackChart({ element, scaleX, scaleY }: { element: PPTChartElement; scaleX: number; scaleY: number }) {
  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: element.left * scaleX,
    top: element.top * scaleY,
    width: Math.max(element.width * scaleX, 60),
    height: element.height > 0 ? element.height * scaleY : 80,
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 8,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 1,
  }), [element, scaleX, scaleY]);

  return (
    <View style={containerStyle}>
      <Text style={{ fontSize: sFont(12, 10), color: '#999' }}>Chart data unavailable</Text>
    </View>
  );
}

const styles = {
  legendRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginBottom: 8,
  },
  seriesRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginRight: 8,
    marginBottom: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  barsArea: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
  },
  barCell: {
    flex: 1,
    justifyContent: 'flex-end' as const,
    alignItems: 'center' as const,
  },
  pieBar: {
    flexDirection: 'row' as const,
    borderRadius: 4,
    overflow: 'hidden' as const,
    height: 24,
    marginBottom: 8,
  },
  simpleBarRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 6,
  },
  simpleBarTrack: {
    flex: 1,
    height: 20,
    flexDirection: 'row' as const,
    marginLeft: 8,
  },
};
