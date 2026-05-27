// packages/mobile/lib/constants/theme.ts

/**
 * EduDash 品牌设计系统
 * 以橙色为主色调传递活力与热情
 * 参考 packages/mobile/html/index.html 设计
 */

export const Colors = {
  // 主色系 - EduDash 橙色品牌色
  primary: {
    main: '#ec5b13',
    light: '#f97316',  // 亮橙 - 悬停状态
    dark: '#ea580c',
    transparent: 'rgba(236, 91, 19, 0.1)',
  },

  // 辅助色系
  secondary: {
    success: '#10B981',
    successLight: '#D1FAE5',
    successBorder: '#6EE7B7',
    info: '#2563EB',     // 亮蓝作为信息色
    infoLight: '#DBEAFE',
    infoBorder: '#93C5FD',
    slate: '#64748B',    // 石板灰 - 辅助文字
    slateLight: '#F1F5F9',
    slateBorder: '#CBD5E1',
  },

  // 强调色 - 琥珀色（用于徽章、通知、CTA）
  accent: {
    main: '#F59E0B',
    light: '#FBBF24',
    dark: '#D97706',
  },

  // 背景与中性色
  neutral: {
    background: '#f8f6f6',     // EduDash 浅色背景
    backgroundAlt: '#FFFFFF',  // 纯白备用背景
    backgroundDark: '#221610', // 深色背景
    card: '#FFFFFF',           // 卡片白色
    border: '#f1f5f9',         // 浅灰边框
    borderAlt: '#e2e8f0',
    textPrimary: '#0f172a',    // 深色文字 (slate-900)
    textSecondary: '#64748b',  // 辅助文字 (slate-500)
    textMuted: '#94a3b8',      // 淡化文字 (slate-400)
    textInverse: '#FFFFFF',    // 反色文字（深色背景上）
    white: '#FFFFFF',
    disabled: '#e2e8f0',
    disabledText: '#94a3b8',
  },

  // 语义颜色 - 用于统计卡片、功能入口等
  semantic: {
    blue: '#2563eb',      // 学生/信息
    orange: '#f59e0b',    // 时间/作业
    green: '#10b981',     // 成功/续费
    purple: '#8b5cf6',    // 损失指标
    red: '#ef4444',       // 紧急/考试
    teal: '#14b8a6',      // 课程
    indigo: '#6366f1',    // 考勤
    pink: '#ec4899',      // 性能监控
    amber: '#f59e0b',     // 报告/进行中
  },

  // 结果反馈色
  feedback: {
    successBg: '#D1FAE5',
    successBorder: '#6EE7B7',
    successText: '#059669',
    errorBg: '#FEF2F2',
    errorBorder: '#FECACA',
    errorText: '#B91C1C',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    warningText: '#B45309',
  },

  // 阴影色（扁平化设计不使用阴影，仅保留透明度用于交互反馈）
  shadow: {
    primary: 'rgba(30, 64, 175, 0.1)',
    success: 'rgba(16, 185, 129, 0.1)',
    info: 'rgba(37, 99, 235, 0.1)',
    accent: 'rgba(245, 158, 11, 0.1)',
    neutral: 'rgba(0, 0, 0, 0.02)',
  },
};

// 圆角规范 - EduDash 设计
export const Rounded = {
  sm: 8,      // 小按钮、输入框 (xl in Tailwind)
  md: 12,     // 卡片 (2xl in Tailwind)
  lg: 16,     // 大卡片/功能按钮
  xl: 24,     // 特大圆角
  full: 9999, // 徽章/标签（胶囊形）
};

// 间距规范（4px基准网格）
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// 字体规范
export const Typography = {
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  h1: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 1.2,
    letterSpacing: -0.02,
  },
  h2: {
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 1.3,
    letterSpacing: -0.01,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 1.4,
  },
  bodyLg: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 1.7,
  },
  bodyMd: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 1.6,
  },
  bodySm: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 1.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 1.4,
    letterSpacing: 0.05,
  },
};

// 预设的辅助色映射（用于功能图标等）- EduDash 语义颜色
export const SecondaryColorMap: Record<string, string> = {
  courses: Colors.semantic.teal,       // 课程 - 青色
  questions: Colors.semantic.blue,     // 问答 - 蓝色
  notes: Colors.semantic.green,        // 笔记 - 绿色
  buddy: Colors.semantic.orange,       // 学习搭子 - 橙色
  matching: Colors.semantic.indigo,    // 学习匹配 - 紫蓝色
  gamification: Colors.primary.main,   // 成长体系 - 主色
  invite: Colors.semantic.pink,        // 邀请奖励 - 粉色
  payment: Colors.semantic.amber,      // 充值中心 -琥珀色
  wallet: Colors.semantic.purple,      // 钱包 - 紫色
  enterprise: Colors.semantic.blue,    // 企业服务 - 蓝色
  knowledge: Colors.semantic.teal,     // 知识 - 青色
  class: Colors.primary.main,          // 课堂 - 主色
  student: Colors.semantic.blue,       // 学生 - 蓝色
  homework: Colors.semantic.orange,    // 作业 - 橙色
  exam: Colors.semantic.red,           // 考试 - 红色
  performance: Colors.semantic.pink,   // 性能 - 粉色
  report: Colors.semantic.amber,       // 报告 - 琥珀色
  attend: Colors.semantic.indigo,      // 考勤 - 紫蓝色
};

// 获取对应颜色的透明背景
export function getShadowColor(color: string): string {
  if (color === Colors.primary.main) return Colors.shadow.primary;
  if (color === Colors.secondary.success) return Colors.shadow.success;
  if (color === Colors.secondary.info) return Colors.shadow.info;
  if (color === Colors.accent.main) return Colors.shadow.accent;
  return Colors.shadow.neutral;
}

// 按钮样式预设
export const ButtonStyles = {
  primary: {
    backgroundColor: Colors.primary.main,
    textColor: Colors.neutral.textInverse,
    borderRadius: Rounded.sm,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondary: {
    backgroundColor: Colors.neutral.backgroundAlt,
    textColor: Colors.primary.main,
    borderRadius: Rounded.sm,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: Colors.primary.main,
  },
  accent: {
    backgroundColor: Colors.accent.main,
    textColor: Colors.neutral.textInverse,
    borderRadius: Rounded.sm,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
};

// 卡片样式预设
export const CardStyles = {
  default: {
    backgroundColor: Colors.neutral.card,
    borderRadius: Rounded.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  elevated: {
    backgroundColor: Colors.neutral.card,
    borderRadius: Rounded.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
};

// 输入框样式预设
export const InputStyles = {
  default: {
    backgroundColor: Colors.neutral.backgroundAlt,
    borderRadius: Rounded.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    textColor: Colors.neutral.textPrimary,
  },
};

// 徽章样式预设
export const BadgeStyles = {
  default: {
    backgroundColor: Colors.accent.main,
    textColor: Colors.neutral.textInverse,
    borderRadius: Rounded.full,
    paddingVertical: 4,
    paddingHorizontal: 12,
    fontSize: 12,
  },
  success: {
    backgroundColor: Colors.secondary.success,
    textColor: Colors.neutral.textInverse,
    borderRadius: Rounded.full,
    paddingVertical: 4,
    paddingHorizontal: 12,
    fontSize: 12,
  },
  info: {
    backgroundColor: Colors.secondary.info,
    textColor: Colors.neutral.textInverse,
    borderRadius: Rounded.full,
    paddingVertical: 4,
    paddingHorizontal: 12,
    fontSize: 12,
  },
};

// ============================================================================
// Responsive Design Tokens
// ============================================================================

import { Breakpoint } from '@/lib/utils/responsive';

/**
 * Responsive spacing values per breakpoint
 * Use with responsiveValue() from '@/lib/utils/responsive'
 */
export const SpacingResponsive: Record<string, Record<Breakpoint, number>> = {
  xs: { compact: 4, regular: 4, medium: 6, large: 8 },
  sm: { compact: 8, regular: 8, medium: 12, large: 16 },
  md: { compact: 12, regular: 16, medium: 20, large: 24 },
  lg: { compact: 16, regular: 24, medium: 32, large: 40 },
  xl: { compact: 24, regular: 32, medium: 48, large: 64 },
  xxl: { compact: 32, regular: 48, medium: 64, large: 80 },
};

/**
 * Responsive typography sizes per breakpoint (font sizes in pixels)
 */
export const TypographyResponsive: Record<string, Record<Breakpoint, number>> = {
  h1: { compact: 24, regular: 28, medium: 36, large: 40 },
  h2: { compact: 20, regular: 22, medium: 28, large: 32 },
  h3: { compact: 18, regular: 20, medium: 24, large: 28 },
  h4: { compact: 16, regular: 18, medium: 20, large: 24 },
  body: { compact: 14, regular: 16, medium: 18, large: 20 },
  bodyLg: { compact: 16, regular: 18, medium: 20, large: 22 },
  caption: { compact: 12, regular: 12, medium: 14, large: 16 },
  small: { compact: 10, regular: 11, medium: 12, large: 14 },
};

/**
 * Responsive card dimensions per breakpoint
 */
export const CardResponsive = {
  width: { compact: 140, regular: 160, medium: 200, large: 240 },
  minWidth: { compact: 120, regular: 140, medium: 180, large: 220 },
  padding: { compact: 12, regular: 16, medium: 20, large: 24 },
  borderRadius: { compact: 12, regular: 12, medium: 16, large: 20 },
  marginH: { compact: 6, regular: 8, medium: 12, large: 16 },
};

/**
 * Responsive button dimensions per breakpoint
 */
export const ButtonResponsive = {
  height: { compact: 40, regular: 44, medium: 48, large: 52 },
  paddingH: { compact: 12, regular: 16, medium: 20, large: 24 },
  fontSize: { compact: 14, regular: 16, medium: 18, large: 20 },
  borderRadius: { compact: 8, regular: 8, medium: 12, large: 12 },
  iconSize: { compact: 18, regular: 20, medium: 22, large: 24 },
};

/**
 * Responsive icon sizes per breakpoint
 */
export const IconResponsive = {
  sm: { compact: 16, regular: 18, medium: 20, large: 24 },
  md: { compact: 20, regular: 22, medium: 26, large: 32 },
  lg: { compact: 24, regular: 28, medium: 36, large: 44 },
  xl: { compact: 32, regular: 40, medium: 48, large: 56 },
};

/**
 * Grid columns recommended per breakpoint
 */
export const GridColumns = {
  compact: 4,
  regular: 5,
  medium: 6,
  large: 8,
};