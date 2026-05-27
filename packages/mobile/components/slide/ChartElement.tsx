import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { PPTChartElement, SlideTheme } from './types';
import { sFont, isSmallScreen } from '@/lib/utils/scaling';

interface ChartElementProps {
  element: PPTChartElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
}

const DEFAULT_COLORS = ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4'];

export function ChartElement({ element, theme, scaleX, scaleY }: ChartElementProps) {
  const effectiveScale = Math.min(scaleX, scaleY);
  const colors = element.themeColors ?? DEFAULT_COLORS;

  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: element.left * scaleX,
    top: element.top * scaleY,
    width: Math.max(element.width * scaleX, 60),
    height: element.height > 0 ? element.height * scaleY : undefined,
    zIndex: 1,
  }), [element, scaleX, scaleY]);

  const data = element.data ?? {};
  const labels: string[] = data.labels ?? data.categories ?? [];
  const seriesList: Array<{ name: string; data: number[] }> = data.series ?? [];

  if (labels.length === 0 || seriesList.length === 0) {
    return (
      <View style={containerStyle}>
        <View style={styles.fallbackBox}>
          <Text style={{ fontSize: sFont(12 * effectiveScale, 10), color: '#999' }}>
            Chart data unavailable
          </Text>
        </View>
      </View>
    );
  }

  const isPie = element.chartType === 'pie' || element.chartType === 'doughnut';

  if (isPie) {
    return <PieChartView element={element} scaleX={scaleX} scaleY={scaleY} labels={labels} series={seriesList} colors={colors} />;
  }

  return <BarChartView element={element} scaleX={scaleX} scaleY={scaleY} labels={labels} series={seriesList} colors={colors} />;
}

function BarChartView({ element, scaleX, scaleY, labels, series, colors }: {
  element: PPTChartElement; scaleX: number; scaleY: number;
  labels: string[]; series: Array<{ name: string; data: number[] }>; colors: string[];
}) {
  const effectiveScale = Math.min(scaleX, scaleY);
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

  const labelFontSize = sFont(10 * effectiveScale, 8);
  const valueFontSize = sFont(9 * effectiveScale, 7);

  return (
    <View style={containerStyle}>
      {series.map((s, si) => (
        <View key={si} style={styles.seriesRow}>
          {s.name && (
            <View style={[styles.legendDot, { backgroundColor: colors[si % colors.length] }]} />
          )}
          {s.name && (
            <Text style={{ fontSize: labelFontSize, color: '#666', marginLeft: 4, marginRight: 8 }}>
              {s.name}
            </Text>
          )}
        </View>
      ))}
      <View style={styles.barsArea}>
        {labels.map((label, li) => (
          <View key={li} style={styles.barColumn}>
            {series.map((s, si) => {
              const val = s.data[li] ?? 0;
              const pct = (val / maxVal) * 100;
              return (
                <View key={si} style={styles.barCell}>
                  <View style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: colors[si % colors.length], borderRadius: 2, width: '80%', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <Text style={{ fontSize: valueFontSize, color: '#333' }}>{val}</Text>
                  </View>
                </View>
              );
            })}
            <Text style={{ fontSize: labelFontSize, color: '#666', marginTop: 2 }} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PieChartView({ element, scaleX, scaleY, labels, series, colors }: {
  element: PPTChartElement; scaleX: number; scaleY: number;
  labels: string[]; series: Array<{ name: string; data: number[] }>; colors: string[];
}) {
  const effectiveScale = Math.min(scaleX, scaleY);
  const data = series[0]?.data ?? [];
  const total = data.reduce((a, b) => a + b, 0) || 1;

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

  const labelFontSize = sFont(10 * effectiveScale, 8);

  return (
    <View style={containerStyle}>
      <View style={styles.pieLegend}>
        {labels.map((label, i) => {
          const pct = ((data[i] ?? 0) / total * 100).toFixed(0);
          return (
            <View key={i} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors[i % colors.length] }]} />
              <Text style={{ fontSize: labelFontSize, color: '#333', marginLeft: 4 }}>
                {label} ({pct}%)
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.pieBars}>
        {labels.map((label, i) => {
          const pct = ((data[i] ?? 0) / total * 100);
          return (
            <View key={i} style={styles.pieBarRow}>
              <View style={{ flex: pct / 100, backgroundColor: colors[i % colors.length], height: 16, borderRadius: 2 }} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = {
  fallbackBox: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 12,
  },
  seriesRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 2,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  barsArea: {
    flexDirection: 'row' as const,
    flex: 1,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-around' as const,
    paddingTop: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center' as const,
    height: '80%' as any,
    justifyContent: 'flex-end' as const,
  },
  barCell: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end' as const,
    alignItems: 'center' as const,
    marginHorizontal: 1,
  },
  pieLegend: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginBottom: 8,
  },
  pieBars: {
    flexDirection: 'row' as const,
    borderRadius: 4,
    overflow: 'hidden' as const,
    height: 16,
  },
  pieBarRow: {
    flexDirection: 'row' as const,
  },
};
