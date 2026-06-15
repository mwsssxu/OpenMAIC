/**
 * SimplifiedLayout - 简化格式布局渲染器
 *
 * 用于渲染简化格式数据（后端scene_service.py生成）
 *
 * 特点：
 * - Flex垂直布局，按position.top排序
 * - 单轴缩放（按宽度适配）
 * - 自动间距计算（根据原始坐标）
 * - 支持自动背景色装饰
 * - 移动端自动将多列并排改为垂直堆叠
 */

import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import type { PPTElement, SlideTheme } from './types';
import { SimplifiedTextElement } from './SimplifiedTextElement';
import { getElementPosition } from './utils/layout-detection';
import { SIMPLIFIED_WIDTH } from './constants';
import { isSmallScreen, isWideScreen } from '@/lib/utils/scaling';

const MARGIN = isSmallScreen ? 12 : isWideScreen ? 30 : 20;

interface SimplifiedLayoutProps {
  elements: PPTElement[];
  theme: SlideTheme;
  containerSize: { width: number; height: number };
}

/**
 * 检测同行多列元素并分组
 *
 * 在移动端，3列并排的文字会因宽度不足导致文字溢出背景块。
 * 检测逻辑：如果多个元素的 top 值接近（差距 < height*0.5）且 left 不同，
 * 则认为它们是同行多列，移动端自动改为垂直堆叠。
 */
function groupColumnsForMobile(
  elements: any[],
  isMobile: boolean,
): { rows: any[][]; isMultiColumnRow: boolean[] } {
  if (!isMobile || elements.length === 0) {
    // 非移动端：每个元素独立一行
    return {
      rows: elements.map(el => [el]),
      isMultiColumnRow: elements.map(() => false),
    };
  }

  // 按 top 排序
  const sorted = [...elements].sort((a, b) => {
    const topA = getElementPosition(a).top;
    const topB = getElementPosition(b).top;
    return topA - topB;
  });

  const rows: any[][] = [];
  const isMultiColumnRow: boolean[] = [];
  let currentRow: any[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevPos = getElementPosition(currentRow[0]);
    const currPos = getElementPosition(sorted[i]);

    // 判断是否在同一行：top差距小于较小元素高度的50%
    const threshold = Math.min(prevPos.height, currPos.height) * 0.5;
    const sameRow = Math.abs(currPos.top - prevPos.top) < threshold;

    if (sameRow) {
      currentRow.push(sorted[i]);
    } else {
      const isMulti = currentRow.length > 1;
      rows.push(currentRow);
      isMultiColumnRow.push(isMulti);
      currentRow = [sorted[i]];
    }
  }

  // 最后一行
  const isMulti = currentRow.length > 1;
  rows.push(currentRow);
  isMultiColumnRow.push(isMulti);

  return { rows, isMultiColumnRow };
}

/**
 * SimplifiedLayout Component
 *
 * 使用Flex布局渲染简化格式数据
 */
export function SimplifiedLayout({
  elements,
  theme,
  containerSize,
}: SimplifiedLayoutProps) {
  // 按 position.top 排序（保持视觉顺序）
  const sortedElements = useMemo(() => {
    return [...elements].sort((a, b) => {
      const topA = getElementPosition(a as any).top;
      const topB = getElementPosition(b as any).top;
      return topA - topB;
    });
  }, [elements]);

  // 单轴缩放（基于SIMPLIFIED_WIDTH基准）
  const scale = useMemo(() => {
    if (containerSize.width === 0) return 1;
    return (containerSize.width - MARGIN) / SIMPLIFIED_WIDTH;
  }, [containerSize.width]);

  // 移动端检测
  const isMobile = containerSize.width < 600;

  // 多列分组
  const { rows, isMultiColumnRow } = useMemo(() => {
    return groupColumnsForMobile(sortedElements, isMobile);
  }, [sortedElements, isMobile]);

  // 计算元素间距（根据原始 position）
  const getElementSpacing = useCallback((index: number): number => {
    if (index === 0) return 16 * scale; // 第一个元素的顶部间距

    const prevEl = sortedElements[index - 1] as any;
    const currEl = sortedElements[index] as any;

    const prevPos = getElementPosition(prevEl);
    const currPos = getElementPosition(currEl);

    // 计算原始坐标中的间距
    const originalGap = currPos.top - (prevPos.top + prevPos.height);

    // 转换为屏幕间距（保持相对比例）
    return Math.max(8 * scale, originalGap * scale);
  }, [sortedElements, scale]);

  // 内边距
  const containerPadding = useMemo(() => {
    return Math.max(12, 20 * scale);
  }, [scale]);

  return (
    <View
      style={[
        styles.container,
        {
          padding: containerPadding,
        },
      ]}
    >
      {rows.map((row, rowIndex) => {
        if (row.length === 1) {
          // 单列元素：保持原样
          const element = row[0];
          const el = element as any;
          const originalIndex = sortedElements.indexOf(element);

          if (el.type === 'text') {
            return (
              <View
                key={element.id}
                style={{ marginBottom: getElementSpacing(originalIndex) }}
              >
                <SimplifiedTextElement
                  element={el}
                  theme={theme}
                  scale={scale}
                />
              </View>
            );
          }
          return null;
        }

        // 多列元素：移动端垂直堆叠，每列撑满宽度
        return (
          <View key={`row-${rowIndex}`} style={styles.multiColumnRow}>
            {row.map((element) => {
              const el = element as any;
              if (el.type !== 'text') return null;

              return (
                <View key={element.id} style={styles.stackedColumn}>
                  <SimplifiedTextElement
                    element={el}
                    theme={theme}
                    scale={scale}
                    forceFullWidth={true}
                  />
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
  },
  multiColumnRow: {
    gap: 8,
    marginBottom: 8,
  },
  stackedColumn: {
    width: '100%',
  },
});