import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { Colors } from '@/lib/constants/theme';

const QUOTES = [
  { text: '学而不思则罔，思而不学则殆', author: '孔子' },
  { text: '知之者不如好之者，好之者不如乐之者', author: '孔子' },
  { text: '路漫漫其修远兮，吾将上下而求索', author: '屈原' },
  { text: '业精于勤，荒于嬉', author: '韩愈' },
  { text: '读书破万卷，下笔如有神', author: '杜甫' },
  { text: '千里之行，始于足下', author: '老子' },
  { text: '温故而知新，可以为师矣', author: '孔子' },
  { text: '三人行，必有我师焉', author: '孔子' },
  { text: '不积跬步，无以至千里', author: '荀子' },
  { text: '天行健，君子以自强不息', author: '《周易》' },
  { text: '博学之，审问之，慎思之，明辨之，笃行之', author: '《中庸》' },
  { text: '纸上得来终觉浅，绝知此事要躬行', author: '陆游' },
  { text: '问渠那得清如许，为有源头活水来', author: '朱熹' },
  { text: '长风破浪会有时，直挂云帆济沧海', author: '李白' },
  { text: '会当凌绝顶，一览众山小', author: '杜甫' },
  { text: '宝剑锋从磨砺出，梅花香自苦寒来', author: '古训' },
  { text: '书山有路勤为径，学海无涯苦作舟', author: '韩愈' },
  { text: '敏而好学，不耻下问', author: '孔子' },
  { text: '学如逆水行舟，不进则退', author: '古训' },
  { text: '吾生也有涯，而知也无涯', author: '庄子' },
];

// 柔和渐变色系，含深色模式变体
const PALETTES = [
  { bg: '#fef3c7', text: '#92400e', sub: '#b45309', darkBg: '#451a03', darkText: '#fbbf24', darkSub: '#f59e0b' },   // amber
  { bg: '#dbeafe', text: '#1e40af', sub: '#2563eb', darkBg: '#1e3a5f', darkText: '#93c5fd', darkSub: '#60a5fa' },   // blue
  { bg: '#dcfce7', text: '#166534', sub: '#15803d', darkBg: '#14532d', darkText: '#86efac', darkSub: '#4ade80' },   // green
  { bg: '#fce7f3', text: '#9d174d', sub: '#be185d', darkBg: '#4c0519', darkText: '#f9a8d4', darkSub: '#f472b6' },   // pink
  { bg: '#f3e8ff', text: '#6b21a8', sub: '#7c3aed', darkBg: '#3b0764', darkText: '#d8b4fe', darkSub: '#a78bfa' },   // purple
  { bg: '#fff7ed', text: '#9a3412', sub: '#c2410c', darkBg: '#431407', darkText: '#fdba74', darkSub: '#fb923c' },   // orange
  { bg: '#ecfeff', text: '#155e75', sub: '#0e7490', darkBg: '#164e63', darkText: '#67e8f9', darkSub: '#22d3ee' },   // cyan
  { bg: '#fef2f2', text: '#991b1b', sub: '#b91c1c', darkBg: '#450a0a', darkText: '#fca5a5', darkSub: '#f87171' },   // rose
];

/**
 * 名言安全区域头部组件
 * 基于路由路径 hash 选定名言和配色，同一页面名言固定不变
 */
export function QuoteHeader() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const pathname = usePathname();

  // 基于路由路径hash选定名言和配色，同一页面固定
  const quoteIndex = useMemo(() => {
    const hash = pathname.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
    return ((hash >>> 0) % QUOTES.length);
  }, [pathname]);

  const paletteIndex = useMemo(() => {
    const hash = pathname.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0) | 0), 0);
    return ((hash >>> 0) % PALETTES.length);
  }, [pathname]);

  const quote = QUOTES[quoteIndex];
  const palette = PALETTES[paletteIndex];

  const isDark = colorScheme === 'dark';
  const bg = isDark ? palette.darkBg : palette.bg;
  const textColor = isDark ? palette.darkText : palette.text;
  const subColor = isDark ? palette.darkSub : palette.sub;

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      <View style={styles.inner}>
        <Text style={[styles.quote, { color: textColor }]} numberOfLines={1}>
          {quote.text}
        </Text>
        <Text style={[styles.author, { color: subColor }]}>
          ——{quote.author}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  quote: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  author: {
    fontSize: 11,
    fontWeight: '400',
  },
});