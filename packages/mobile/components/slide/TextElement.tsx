/**
 * TextElement - Mobile text element renderer with responsive scaling
 *
 * Uses canvas-scale-based font sizing with minimum readability threshold.
 * Whiteboard elements get a default card-like background for visual separation.
 * Supports text wrapping and flexible height for long content.
 * Automatically detects and styles titles differently from content.
 */

import { useMemo, useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { USE_NATIVE_DRIVER } from '@/lib/configs/animation';
import type { PPTTextElement, SlideTheme } from './types';
import { isSmallScreen, isWideScreen } from '@/lib/utils/scaling';
import { Colors } from '@/lib/constants/theme';

// 白板背景色数组
const WHITEBOARD_BG_COLORS_LIGHT = [
  Colors.primary.light, // 淡蓝
  '#fff3e6', // 淡橙
  '#f0f7f0', // 淡绿
  '#f5f0fa', // 淡紫
  '#fff8e6', // 淡黄
  '#e6f2ff', // 淡青蓝
];

// 深色模式颜色（预留）
const WHITEBOARD_BG_COLORS_DARK = [
  '#1a2a3a',
  '#2a1a10',
  '#102010',
  '#1a1030',
  '#202010',
  '#102030',
];

// 标题背景色（更醒目）
const TITLE_BG_COLORS_LIGHT = [
  '#dbeafe', // 蓝色
  '#fef3c7', // 黄色
  '#dcfce7', // 绿色
  '#fce7f3', // 粉色
  '#e0e7ff', // 靛蓝
];

// 背景色缓存，避免重复计算
const bgColorCache = new Map<string, string>();

// 根据元素 ID 生成稳定的背景色索引
function getBackgroundColorForElement(elementId: string, isTitle: boolean, isDark: boolean = false): string {
  const cacheKey = `${elementId}-${isTitle}-${isDark}`;
  const cached = bgColorCache.get(cacheKey);
  if (cached) return cached;

  const colors = isTitle ? TITLE_BG_COLORS_LIGHT : WHITEBOARD_BG_COLORS_LIGHT;
  let hash = 0;
  for (let i = 0; i < elementId.length; i++) {
    hash = ((hash << 5) - hash + elementId.charCodeAt(i)) % colors.length;
  }
  const color = colors[Math.abs(hash)];
  bgColorCache.set(cacheKey, color);
  return color;
}

// 检测文本是否为标题（基于位置和内容特征）
function detectTitleLevel(element: PPTTextElement, position: { top: number; height: number }): 'h1' | 'h2' | 'h3' | 'body' {
  const content = element.content?.replace(/<[^>]+>/g, '') || '';
  const contentLength = content.length;

  // H1: 章节标题 - 位置最靠前（top < 80），短文本
  if (position.top < 80 && contentLength < 50) {
    return 'h1';
  }

  // H2: 副标题/区域标题 - 位置中等（top 80-200），短文本
  if (position.top >= 80 && position.top < 200 && contentLength < 50) {
    return 'h2';
  }

  // H3: 列标题 - 位置在内容区（top 200-280），非常短的文本
  if (position.top >= 200 && position.top < 280 && contentLength < 20) {
    return 'h3';
  }

  // 检查是否有明确的标题样式标记
  if ((element as any).style?.isTitle) {
    return 'h1';
  }

  // 默认为正文
  return 'body';
}

// 获取标题级别对应的样式
function getTitleStyle(level: 'h1' | 'h2' | 'h3' | 'body', baseFontSize: number): {
  fontSize: number;
  fontWeight: string;
  color: string;
  lineHeight: number;
} {
  switch (level) {
    case 'h1':
      return {
        fontSize: Math.round(baseFontSize * 1.5),
        fontWeight: '700',
        color: '#0f172a',
        lineHeight: 1.3,
      };
    case 'h2':
      return {
        fontSize: Math.round(baseFontSize * 1.25),
        fontWeight: '600',
        color: '#1e293b',
        lineHeight: 1.35,
      };
    case 'h3':
      return {
        fontSize: Math.round(baseFontSize * 1.1),
        fontWeight: '600',
        color: '#334155',
        lineHeight: 1.4,
      };
    default:
      return {
        fontSize: baseFontSize,
        fontWeight: '400',
        color: '#475569',
        lineHeight: 1.5,
      };
  }
}

interface TextElementProps {
  element: PPTTextElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
  /** 是否在白板模式下渲染（添加卡片背景） */
  isWhiteboard?: boolean;
}

function getPosition(element: PPTTextElement) {
  const el = element as any;
  if (el.position) {
    return {
      top: el.position.top || 0,
      left: el.position.left || 0,
      width: el.position.width || 100,
      height: el.position.height || 50,
    };
  }
  return {
    top: element.top || 0,
    left: element.left || 0,
    width: element.width || 100,
    height: element.height || 50,
  };
}

export function TextElement({ element, theme, scaleX, scaleY, isWhiteboard = false }: TextElementProps) {
  const position = useMemo(() => getPosition(element), [element]);
  const effectiveScale = Math.min(scaleX, scaleY);

  // 动画效果
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // 入场动画：淡入 + 上滑
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: USE_NATIVE_DRIVER,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: USE_NATIVE_DRIVER,
        easing: Easing.out(Easing.ease),
      }),
    ]).start();
  }, []);

  const textContent = useMemo(() => {
    let text = element.content || '';
    // 检测是否有 HTML 标题标签
    const h1Match = text.match(/<h1[^>]*>(.*?)<\/h1>/is);
    const h2Match = text.match(/<h2[^>]*>(.*?)<\/h2>/is);
    const h3Match = text.match(/<h3[^>]*>(.*?)<\/h3>/is);

    // 如果有标题标签，提取内容（优先级 h1 > h2 > h3）
    if (h1Match) {
      text = h1Match[1];
    } else if (h2Match) {
      text = h2Match[1];
    } else if (h3Match) {
      text = h3Match[1];
    }

    // 移除其他 HTML 标签
    text = text.replace(/<[^>]+>/g, '');

    // 解码 HTML 实体
    text = text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');

    return text;
  }, [element.content]);

  // 从 HTML 标签检测标题级别
  const htmlTitleLevel = useMemo(() => {
    const content = element.content || '';
    if (/<h1[^>]*>/i.test(content)) return 'h1';
    if (/<h2[^>]*>/i.test(content)) return 'h2';
    if (/<h3[^>]*>/i.test(content)) return 'h3';
    return null;
  }, [element.content]);

  // 检测标题级别（优先使用 HTML 标签，其次使用位置检测）
  const titleLevel = useMemo(() => {
    if (htmlTitleLevel) return htmlTitleLevel;
    return detectTitleLevel(element, position);
  }, [htmlTitleLevel, element, position]);

  // Font size: responsive with mobile-friendly minimums
  //
  // 白板模式适配策略（与 Web 端对齐）：
  // 1. 基准画布宽度 1000px，字体如 18px
  // 2. ScreenCanvas 将画布缩放到屏幕宽度
  //    - 手机（375px）：scale ≈ 0.375，18px → ~7px（太小）
  //    - Pad（768px）：scale ≈ 0.768，18px → ~14px（合适）
  // 3. 因此需要设置最小字体阈值：
  //    - 小屏手机：最小 12px
  //    - 普通手机：最小 14px
  //    - Pad：最小 16px
  const minFont = isSmallScreen ? 12 : isWideScreen ? 16 : 14;
  const baseFontSize = useMemo(() => {
    let rawSize: number;

    // 从 style 或 HTML 中获取原始字体大小
    if ((element as any).style?.fontSize) {
      rawSize = (element as any).style.fontSize;
    } else {
      const htmlFontSizeMatch = element.content?.match(/font-size:\s*(\d+)px/i);
      if (htmlFontSizeMatch) {
        rawSize = parseInt(htmlFontSizeMatch[1], 10);
      } else {
        // Fallback based on element height
        if (position.height >= 60) {
          rawSize = 18;
        } else if (position.height >= 50) {
          rawSize = 14;
        } else {
          rawSize = 12;
        }
      }
    }

    // 白板模式：字体随画布缩放，但保证最小可读性
    if (isWhiteboard) {
      // 应用缩放（effectiveScale 来自 ScreenCanvas 的 canvasScaleX）
      let scaledSize = rawSize * effectiveScale;
      // 确保不低于最小字体
      scaledSize = Math.max(minFont, Math.round(scaledSize));
      // 宽度安全：如果容器太窄，按宽度反推最大字体
      // 屏幕宽度 = position.width * scaleX, 每字约 scaledSize * 0.85px
      const screenW = position.width * effectiveScale;
      const plainText = (element.content || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ');
      const longestLine = Math.max(...plainText.split('\\n').map(l => l.length), 1);
      const maxFontByWidth = (screenW - 16) / (longestLine * 0.85);
      return Math.max(minFont, Math.min(scaledSize, Math.floor(maxFontByWidth)));
    } else {
      // 非白板模式：直接应用缩放
      return Math.max(minFont, Math.round(rawSize * effectiveScale));
    }
  }, [element, position.height, effectiveScale, isWhiteboard, minFont]);

  // 根据标题级别调整字体
  const titleStyle = useMemo(() => getTitleStyle(titleLevel, baseFontSize), [titleLevel, baseFontSize]);

  const textColor = useMemo(() => {
    if ((element as any).style?.color) {
      return (element as any).style.color;
    }
    return titleStyle.color;
  }, [element, titleStyle]);

  // 白板模式下为每个文本块添加背景色
  const elementId = element.id || '';
  const isTitle = titleLevel === 'h1' || titleLevel === 'h2' || titleLevel === 'h3';
  const bgColor = useMemo(() => {
    if (isWhiteboard && !element.fill) {
      return getBackgroundColorForElement(elementId, isTitle);
    }
    return element.fill || 'transparent';
  }, [isWhiteboard, element.fill, elementId, isTitle]);

  // 宽度计算：白板模式下直接使用元素宽度（已经是屏幕像素）
  const effectiveWidth = useMemo(() => {
    return Math.max(position.width * scaleX, 40);
  }, [position.width, scaleX]);

  const containerStyle = useMemo(() => {
    // 统一使用绝对定位（白板模式也使用 LLM 生成的坐标）
    const minH = position.height > 0 ? position.height * scaleY : 40;
    return {
      position: 'absolute' as const,
      left: position.left * scaleX,
      top: position.top * scaleY,
      width: effectiveWidth,
      minHeight: minH,
      transform: [{ rotate: `${element.rotate || 0}deg` }],
      zIndex: 1,
      opacity: fadeAnim,
    };
  }, [position, element.rotate, scaleX, scaleY, effectiveWidth, fadeAnim]);

  const textWrapperStyle = useMemo(() => ({
    flex: 1,
    padding: isWhiteboard ? Math.max(8, 12 * effectiveScale) : Math.max(4, 8 * effectiveScale),
    justifyContent: 'flex-start' as const,
    backgroundColor: bgColor,
    overflow: 'visible' as const,
    opacity: element.opacity || 1,
    // 白板模式下添加圆角和阴影
    ...(isWhiteboard && {
      borderRadius: titleLevel === 'h1' ? 12 : titleLevel === 'h2' ? 10 : 8,
      borderWidth: titleLevel === 'h1' ? 2 : 1,
      borderColor: titleLevel === 'h1' ? 'rgba(59, 130, 246, 0.3)' : titleLevel === 'h2' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 0, 0, 0.06)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: titleLevel === 'h1' ? 3 : titleLevel === 'h2' ? 2 : 1 },
      shadowOpacity: titleLevel === 'h1' ? 0.15 : titleLevel === 'h2' ? 0.1 : 0.08,
      shadowRadius: titleLevel === 'h1' ? 8 : titleLevel === 'h2' ? 5 : 3,
      elevation: titleLevel === 'h1' ? 5 : titleLevel === 'h2' ? 3 : 2,
    }),
    // H1 标题特殊样式：左边框装饰
    ...(titleLevel === 'h1' && isWhiteboard && {
      borderLeftWidth: 4,
      borderLeftColor: '#3b82f6',
    }),
    // H2 标题特殊样式：左边框装饰（较细）
    ...(titleLevel === 'h2' && isWhiteboard && {
      borderLeftWidth: 3,
      borderLeftColor: '#60a5fa',
    }),
  }), [effectiveScale, bgColor, element.opacity, isWhiteboard, titleLevel]);

  const textStyle = useMemo(() => ({
    color: textColor,
    fontFamily: element.defaultFontName || theme.fontName,
    fontSize: titleStyle.fontSize,
    lineHeight: titleStyle.fontSize * titleStyle.lineHeight,
    letterSpacing: (element.wordSpace || 0) * scaleX,
    textAlign: 'left' as const,
    fontWeight: titleStyle.fontWeight as any,
    // 自动换行
    flexWrap: 'wrap' as any,
  }), [element, theme, titleStyle, scaleX, textColor]);

  return (
    <Animated.View style={[containerStyle, { transform: [{ translateY: slideAnim }] }]}>
        <View style={textWrapperStyle}>
          <Text style={textStyle} numberOfLines={50} ellipsizeMode="tail" maxFontSizeMultiplier={1.2}>
            {textContent}
          </Text>
        </View>
    </Animated.View>
  );
};