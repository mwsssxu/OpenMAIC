/**
 * SimplifiedTextElement - 简化格式文本元素渲染器
 *
 * 用于渲染简化格式数据（后端scene_service.py生成）
 *
 * 视觉层级设计：
 * - title: 大号加粗 + 左侧色条 + 浅色背景 + 圆角
 * - desc: 中号 + 浅灰文字 + 无装饰
 * - point: 正文 + 圆点/图标 + 卡片背景 + 阴影
 * - highlight: 高亮背景 + 左侧色条
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SlideTheme } from './types';
import { getElementPosition } from './utils/layout-detection';
import { SIMPLIFIED_WIDTH } from './constants';
import { isSmallScreen } from '@/lib/utils/scaling';

/** 元素语义类型 */
type SemanticRole = 'title' | 'desc' | 'point' | 'highlight' | 'label' | 'body';

/** 配色方案 */
const THEME: Record<SemanticRole, {
  bg: string;
  accentBar: string | null;
  text: string;
  fontSizeScale: number;
  fontWeight: string;
  borderLeft: number;
  borderRadius: number;
  shadowOpacity: number;
}> = {
  title: {
    bg: '#eff6ff',         // 浅蓝底
    accentBar: '#3b82f6',  // 蓝色左边条
    text: '#0f172a',       // 深色字
    fontSizeScale: 1.4,    // 字号放大倍率
    fontWeight: '700',
    borderLeft: 4,
    borderRadius: 10,
    shadowOpacity: 0.12,
  },
  desc: {
    bg: 'transparent',
    accentBar: null,
    text: '#64748b',       // 灰色字
    fontSizeScale: 0.95,
    fontWeight: '400',
    borderLeft: 0,
    borderRadius: 0,
    shadowOpacity: 0,
  },
  point: {
    bg: '#ffffff',         // 白底卡片
    accentBar: null,
    text: '#334155',
    fontSizeScale: 1,
    fontWeight: '400',
    borderLeft: 0,
    borderRadius: 12,
    shadowOpacity: 0.08,
  },
  highlight: {
    bg: '#fef9c3',        // 浅黄底
    accentBar: '#eab308',  // 金色左边条
    text: '#713f12',
    fontSizeScale: 1,
    fontWeight: '500',
    borderLeft: 3,
    borderRadius: 8,
    shadowOpacity: 0,
  },
  label: {
    bg: '#f1f5f9',         // 浅灰底
    accentBar: null,
    text: '#475569',
    fontSizeScale: 0.9,
    fontWeight: '600',
    borderLeft: 0,
    borderRadius: 6,
    shadowOpacity: 0,
  },
  body: {
    bg: '#f8fafc',
    accentBar: null,
    text: '#475569',
    fontSizeScale: 1,
    fontWeight: '400',
    borderLeft: 0,
    borderRadius: 8,
    shadowOpacity: 0.04,
  },
};

/**
 * 检测元素的语义角色
 *
 * 判断依据：
 * 1. 元素 ID 前缀（title/desc/point/highlight）
 * 2. HTML 标签（<h1>/<h2>/<strong>）
 * 3. fill 属性（带填充色的文本=色块标签）
 * 4. 位置 + 高度推断
 */
function detectSemanticRole(element: any): SemanticRole {
  const id = (element.id || '').toLowerCase();

  // 优先根据 ID 前缀判断
  if (id === 'title' || id.startsWith('title')) return 'title';
  if (id === 'desc' || id.startsWith('desc')) return 'desc';
  if (id.startsWith('point')) return 'point';
  if (id.startsWith('highlight')) return 'highlight';

  // shape/line 替换来的文本元素
  if (id.startsWith('shape_') || id.startsWith('line_')) {
    const content = element.content || '';
    const text = content.replace(/<[^>]+>/g, '').trim();
    // 短文本（变量名、符号、标签）→ label 角色，不占满宽
    if (text.length <= 12) return 'label';
    // 较长文本才作为 highlight
    return 'highlight';
  }

  // 根据 HTML 内容标签判断
  const content = element.content || '';
  if (/<h1[^>]*>/i.test(content)) return 'title';
  if (/<h2[^>]*>/i.test(content)) return 'highlight';
  if (/<strong[^>]*>/i.test(content) && content.length < 60) return 'highlight';

  // 根据位置和大小推断
  const position = getElementPosition(element);
  const text = content.replace(/<[^>]+>/g, '');

  // top 靠前 + 短文本 = 标题
  if (position.top < 80 && text.length < 50) return 'title';
  // 紧跟标题 + 中等长度 = 描述
  if (position.top >= 80 && position.top < 200 && text.length < 80) return 'desc';
  // 以圆点或数字开头 = 要点
  if (/^[•●▪▸➤\d]/.test(text.trim())) return 'point';
  // 短文本 + 有显式颜色 = 标签（如 v₀, θ, vx 等物理量符号）
  const explicitColor = element.style?.color || element.defaultColor;
  if (text.trim().length <= 8 && explicitColor && explicitColor !== '#333333' && explicitColor !== '#444444') {
    return 'label';
  }
  // 极短文本（≤ 6 字）即使无显式颜色也视为标签
  // 典型场景：坐标轴标签 F/N、x/m、O
  if (text.trim().length <= 6) {
    return 'label';
  }

  return 'body';
}

/**
 * 提取要点前的图标字符
 */
function extractBulletIcon(text: string): { icon: string; rest: string } | null {
  const trimmed = text.trim();

  // 圆点类
  if (/^[•●▪]/.test(trimmed)) {
    return { icon: '●', rest: trimmed.replace(/^[•●▪]\s*/, '') };
  }
  // 箭头类
  if (/^[▸➤→]/.test(trimmed)) {
    return { icon: '▸', rest: trimmed.replace(/^[▸➤→]\s*/, '') };
  }
  // 数字序号
  const numMatch = trimmed.match(/^(\d+)[.、)\]】]/);
  if (numMatch) {
    return { icon: numMatch[1], rest: trimmed.replace(/^\d+[.、)\]】]\s*/, '') };
  }

  return null;
}

interface SimplifiedTextElementProps {
  element: any; // PPTElement（简化格式）
  theme: SlideTheme;
  scale: number;
  /** 强制使用全宽（多列元素垂直堆叠时） */
  forceFullWidth?: boolean;
}

/**
 * SimplifiedTextElement Component
 */
export function SimplifiedTextElement({
  element,
  theme,
  scale,
  forceFullWidth = false,
}: SimplifiedTextElementProps) {
  const el = element;
  const position = useMemo(() => getElementPosition(el), [el]);

  // 检测语义角色
  const role = useMemo(() => detectSemanticRole(el), [el]);
  const roleTheme = THEME[role];

  // 解析文本内容（移除HTML标签）
  const textContent = useMemo(() => {
    const text = el.content?.replace(/<[^>]+>/g, '') || '';
    return text;
  }, [el.content]);

  // 要点图标
  const bulletInfo = useMemo(() => {
    if (role === 'point') return extractBulletIcon(textContent);
    return null;
  }, [role, textContent]);

  // 基础字体大小
  const baseFontSize = useMemo(() => {
    const minSize = isSmallScreen ? 9 : 11;
    // 从style获取
    const styleSize = el.style?.fontSize;
    if (styleSize) {
      return Math.max(minSize, Math.round(styleSize * scale * 0.85));
    }

    // 根据position.height推断
    if (position.height >= 60) {
      return Math.max(minSize, Math.round(28 * scale));
    } else if (position.height >= 50) {
      return Math.max(minSize, Math.round(20 * scale));
    } else {
      return Math.max(minSize, Math.round(16 * scale));
    }
  }, [el, position.height, scale]);

  // 应用层级缩放后的字号
  const fontSize = useMemo(() => {
    return Math.max(isSmallScreen ? 11 : 13, Math.round(baseFontSize * roleTheme.fontSizeScale));
  }, [baseFontSize, roleTheme]);

  // 文本颜色
  const textColor = useMemo(() => {
    // 数据显式指定颜色时优先使用
    const explicitColor = el.style?.color || el.defaultColor;
    if (explicitColor && explicitColor !== '#333333' && explicitColor !== '#444444') {
      return explicitColor;
    }
    return roleTheme.text;
  }, [el, roleTheme]);

  // 内容宽度
  const contentWidth = useMemo(() => {
    if (forceFullWidth) return '100%' as any;
    // label 角色：不设宽度，用 alignSelf 自适应内容
    if (role === 'label') return undefined;
    return Math.min(position.width * scale, SIMPLIFIED_WIDTH * scale);
  }, [position.width, scale, forceFullWidth, role]);

  // padding
  const padding = useMemo(() => {
    if (role === 'title') return Math.max(10, 16 * scale);
    if (role === 'desc') return Math.max(4, 6 * scale);
    if (role === 'point') return Math.max(8, 12 * scale);
    if (role === 'label') return Math.max(4, 8 * scale);
    return Math.max(8, 12 * scale);
  }, [scale, role]);

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: contentWidth,
          // label 角色：自适应内容宽度，不撑满父容器
          ...(role === 'label' ? { alignSelf: 'flex-start' } : {}),
          backgroundColor: el.fill || roleTheme.bg,  // fill 属性覆盖默认背景
          borderRadius: roleTheme.borderRadius,
          paddingHorizontal: padding,
          paddingVertical: role === 'desc' ? 2 : padding,
          // 左侧色条
          borderLeftWidth: roleTheme.borderLeft,
          borderLeftColor: roleTheme.accentBar || 'transparent',
          // 阴影（point 卡片）
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: roleTheme.shadowOpacity,
          shadowRadius: 6,
          elevation: roleTheme.shadowOpacity > 0 ? 3 : 0,
        },
      ]}
    >
      {role === 'point' && bulletInfo ? (
        // 要点：图标 + 文字 水平排列
        <View style={styles.pointRow}>
          <View style={[styles.pointIcon, { backgroundColor: theme.fontColor + '15' }]}>
            <Text style={[styles.pointIconText, { color: theme.fontColor, fontSize: fontSize * 0.7 }]}>
              {bulletInfo.icon}
            </Text>
          </View>
          <Text
            style={{
              flex: 1,
              fontSize,
              color: textColor,
              fontWeight: roleTheme.fontWeight as any,
              lineHeight: fontSize * 1.5,
            }}
            maxFontSizeMultiplier={1.2}
          >
            {bulletInfo.rest}
          </Text>
        </View>
      ) : (
        // 非要点：直接渲染
        <Text
          style={{
            fontSize,
            color: textColor,
            fontWeight: roleTheme.fontWeight as any,
            lineHeight: role === 'title' ? fontSize * 1.3 : fontSize * 1.5,
            letterSpacing: role === 'title' ? 0.5 : 0,
          }}
          maxFontSizeMultiplier={1.2}
        >
          {textContent}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'visible',
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  pointIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  pointIconText: {
    fontWeight: '600',
  },
});
