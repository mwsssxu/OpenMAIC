// packages/mobile/lib/constants/theme.ts

/**
 * Palansoft 品牌设计系统
 * 专业、可信赖的企业级软件品牌
 * 以蓝色为主色调传递科技感，琥珀色点缀用于关键操作
 */

export const Colors = {
  // 主色系 - 深蓝品牌色
  primary: {
    main: '#1E40AF',
    light: '#2563EB',  // 亮蓝 - 悬停状态
    dark: '#1E3A8A',
    transparent: 'rgba(30, 64, 175, 0.1)',
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
    background: '#F8FAFC',     // 冷白灰背景
    backgroundAlt: '#FFFFFF',  // 纯白备用背景
    card: '#FFFFFF',           // 卡片白色
    border: '#E2E8F0',         // 浅灰边框
    borderAlt: '#CBD5E1',
    textPrimary: '#0F172A',    // 深色文字
    textSecondary: '#475569',  // 辅助文字
    textMuted: '#94A3B8',      // 淡化文字
    textInverse: '#FFFFFF',    // 反色文字（深色背景上）
    white: '#FFFFFF',
    disabled: '#E2E8F0',
    disabledText: '#94A3B8',
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

// 圆角规范
export const Rounded = {
  sm: 6,      // 按钮、输入框
  md: 10,     // 卡片
  lg: 16,     // 大卡片/模态框
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

// 预设的辅助色映射（用于功能图标等）
export const SecondaryColorMap: Record<string, string> = {
  courses: Colors.primary.main,
  questions: Colors.secondary.info,
  notes: Colors.secondary.success,
  buddy: Colors.accent.main,
  matching: Colors.primary.light,
  gamification: Colors.accent.main,
  invite: Colors.secondary.info,
  payment: Colors.secondary.success,
  wallet: Colors.primary.dark,
  enterprise: Colors.primary.main,
  knowledge: Colors.primary.main,
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
  },
  success: {
    backgroundColor: Colors.secondary.success,
    textColor: Colors.neutral.textInverse,
    borderRadius: Rounded.full,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  info: {
    backgroundColor: Colors.secondary.info,
    textColor: Colors.neutral.textInverse,
    borderRadius: Rounded.full,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
};