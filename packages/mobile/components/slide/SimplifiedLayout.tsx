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

/**
 * 检测元素是否为标签角色（短文本，用于 label+body 配对）
 * 与 SimplifiedTextElement 的 detectSemanticRole 逻辑保持一致
 */
function _isLabelElement(element: any, text: string): boolean {
  const id = (element.id || '').toLowerCase();
  if (id.startsWith('shape_') || id.startsWith('line_')) {
    return text.length <= 12;
  }
  // 短文本 + 有显式颜色
  const explicitColor = element.style?.color || element.defaultColor;
  if (text.length <= 8 && explicitColor && explicitColor !== '#333333' && explicitColor !== '#444444') {
    return true;
  }
  return false;
}

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
  const { rows } = useMemo(() => {
    return groupColumnsForMobile(sortedElements, isMobile);
  }, [sortedElements, isMobile]);

  // 标签+描述配对：短标签（label 角色）与紧邻的长文本合并为一行
  type RenderItem =
    | { kind: 'single'; element: any; originalIndex: number }
    | { kind: 'multi'; elements: any[] }
    | { kind: 'pair'; label: any; body: any; labelIndex: number; bodyIndex: number };

  const renderItems = useMemo((): RenderItem[] => {
    const items: RenderItem[] = [];
    const consumed = new Set<number>(); // 已被配对消耗的 row index

    for (let i = 0; i < rows.length; i++) {
      if (consumed.has(i)) continue;
      const row = rows[i];

      // 仅单元素行可以配对
      if (row.length === 1) {
        const el = row[0] as any;
        if (el.type !== 'text') {
          items.push({ kind: 'single', element: el, originalIndex: sortedElements.indexOf(el) });
          continue;
        }

        // 检测是否为 label 角色
        const text = (el.content || '').replace(/<[^>]+>/g, '').trim();
        const isLabel = _isLabelElement(el, text);

        // 尝试与下一行配对
        if (isLabel && i + 1 < rows.length && rows[i + 1].length === 1) {
          const nextEl = rows[i + 1][0] as any;
          if (nextEl.type === 'text') {
            const nextText = (nextEl.content || '').replace(/<[^>]+>/g, '').trim();
            // 下一行文本较长（> 8 字）= 描述性内容，可以配对
            if (nextText.length > 8) {
              items.push({
                kind: 'pair',
                label: el,
                body: nextEl,
                labelIndex: sortedElements.indexOf(el),
                bodyIndex: sortedElements.indexOf(nextEl),
              });
              consumed.add(i + 1);
              continue;
            }
          }
        }

        items.push({ kind: 'single', element: el, originalIndex: sortedElements.indexOf(el) });
      } else {
        items.push({ kind: 'multi', elements: row });
      }
    }

    return items;
  }, [rows, sortedElements]);

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
      {renderItems.map((item, itemIndex) => {
        const spacing = itemIndex < renderItems.length - 1
          ? getElementSpacing(
              item.kind === 'pair' ? item.bodyIndex
                : item.kind === 'single' ? item.originalIndex
                : 0
            )
          : 0;

        if (item.kind === 'pair') {
          // 标签+描述配对行：label badge 在左侧，body 在右侧填充
          return (
            <View key={`pair-${item.labelIndex}`} style={[styles.pairRow, { marginBottom: spacing }]}>
              <SimplifiedTextElement
                element={item.label}
                theme={theme}
                scale={scale}
              />
              <View style={styles.pairBody}>
                <SimplifiedTextElement
                  element={item.body}
                  theme={theme}
                  scale={scale}
                  forceFullWidth={true}
                />
              </View>
            </View>
          );
        }

        if (item.kind === 'multi') {
          // 多列元素：移动端垂直堆叠
          return (
            <View key={`row-${itemIndex}`} style={[styles.multiColumnRow, { marginBottom: spacing }]}>
              {item.elements.map((element) => {
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
        }

        // 单元素行
        const el = item.element as any;
        if (el.type !== 'text') return null;
        return (
          <View
            key={el.id || `item-${itemIndex}`}
            style={{ marginBottom: spacing }}
          >
            <SimplifiedTextElement
              element={el}
              theme={theme}
              scale={scale}
            />
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
  pairRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  pairBody: {
    flex: 1,
  },
  multiColumnRow: {
    gap: 8,
    marginBottom: 8,
  },
  stackedColumn: {
    width: '100%',
  },
});