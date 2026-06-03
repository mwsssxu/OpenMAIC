/**
 * SimplifiedTextElement - 简化格式文本元素渲染器
 *
 * 用于渲染简化格式数据（后端scene_service.py生成）
 *
 * 特点：
 * - 使用单轴缩放（按宽度适配）
 * - 自动背景色装饰
 * - 支持style.fontSize、style.color属性
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SlideTheme } from './types';
import { getElementPosition } from './utils/layout-detection';
import { getAutoBackgroundColor } from './utils/text-height-table';
import { SIMPLIFIED_WIDTH } from './constants';
import { isSmallScreen } from '@/lib/utils/scaling';

interface SimplifiedTextElementProps {
  element: any; // PPTElement（简化格式）
  theme: SlideTheme;
  scale: number;
}

/**
 * SimplifiedTextElement Component
 */
export function SimplifiedTextElement({
  element,
  theme,
  scale,
}: SimplifiedTextElementProps) {
  const el = element;
  const position = useMemo(() => getElementPosition(el), [el]);

  // 解析文本内容（移除HTML标签）
  const textContent = useMemo(() => {
    const text = el.content?.replace(/<[^>]+>/g, '') || '';
    return text;
  }, [el.content]);

  // 计算字体大小
  const fontSize = useMemo(() => {
    const minSize = isSmallScreen ? 9 : 11;
    // 从style获取
    const styleSize = el.style?.fontSize;
    if (styleSize) {
      return Math.max(minSize, Math.round(styleSize * scale * 0.85));
    }

    // 根据position.height推断
    if (position.height >= 60) {
      return Math.max(minSize, Math.round(28 * scale)); // 标题
    } else if (position.height >= 50) {
      return Math.max(minSize, Math.round(20 * scale)); // 描述
    } else {
      return Math.max(minSize, Math.round(16 * scale)); // 要点
    }
  }, [el, position.height, scale]);

  // 文本颜色
  const textColor = useMemo(() => {
    return el.style?.color || theme.fontColor;
  }, [el, theme]);

  // 字体粗细
  const fontWeight = useMemo(() => {
    const weight = el.style?.fontWeight;
    if (weight === 'bold') return '700';
    return weight || '400';
  }, [el]);

  // 背景色（自动装饰）
  const backgroundColor = useMemo(() => {
    // 如果数据自带fill属性，使用它
    if (el.fill) return el.fill;
    // 自动装饰
    return getAutoBackgroundColor(el.id || '');
  }, [el]);

  // 内容宽度
  const contentWidth = useMemo(() => {
    return Math.min(position.width * scale, SIMPLIFIED_WIDTH * scale); // 限制最大宽度
  }, [position.width, scale]);

  // padding（根据scale调整）
  const padding = useMemo(() => {
    return Math.max(8, 12 * scale);
  }, [scale]);

  // 圆角
  const borderRadius = useMemo(() => {
    return Math.max(4, 6 * scale);
  }, [scale]);

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: contentWidth,
          backgroundColor,
          borderRadius,
          paddingHorizontal: padding,
          paddingVertical: padding,
        },
      ]}
    >
      <Text
        style={{
          fontSize,
          color: textColor,
          fontWeight: fontWeight as any,
          lineHeight: fontSize * 1.4,
        }}
        numberOfLines={undefined}
        ellipsizeMode="tail"
        maxFontSizeMultiplier={1.2}
      >
        {textContent}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
});