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
 */

import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import type { PPTElement, SlideTheme } from './types';
import { SimplifiedTextElement } from './SimplifiedTextElement';
import { getElementPosition } from './utils/layout-detection';
import { SIMPLIFIED_WIDTH, CANVAS_MARGIN_SIMPLIFIED } from './constants';

interface SimplifiedLayoutProps {
  elements: PPTElement[];
  theme: SlideTheme;
  containerSize: { width: number; height: number };
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
    return (containerSize.width - CANVAS_MARGIN_SIMPLIFIED) / SIMPLIFIED_WIDTH;
  }, [containerSize.width]);

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
      {sortedElements.map((element, index) => {
        // 根据元素类型选择渲染器
        const el = element as any;

        if (el.type === 'text') {
          return (
            <View
              key={element.id}
              style={{ marginBottom: getElementSpacing(index) }}
            >
              <SimplifiedTextElement
                element={el}
                theme={theme}
                scale={scale}
              />
            </View>
          );
        }

        // 其他类型暂时跳过（简化格式通常只有text）
        return null;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
  },
});