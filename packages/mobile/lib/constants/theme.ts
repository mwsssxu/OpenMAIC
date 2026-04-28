// packages/mobile/lib/constants/theme.ts

/**
 * OpenMAIC 移动端配色体系
 * 设计风格：友好温暖风
 */

export const Colors = {
  // 主色系 - 温暖橙
  primary: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
    transparent: 'rgba(245, 158, 11, 0.2)',
  },

  // 辅助色系
  secondary: {
    success: '#10b981',
    successLight: '#d1fae5',
    successBorder: '#6ee7b7',
    info: '#3b82f6',
    infoLight: '#dbeafe',
    infoBorder: '#93c5fd',
    fun: '#ec4899',
    funLight: '#fce7f3',
    funBorder: '#f9a8d4',
    wisdom: '#8b5cf6',
    wisdomLight: '#ede9fe',
    wisdomBorder: '#c4b5fd',
  },

  // 背景与中性色
  neutral: {
    background: '#fefce8',
    backgroundAlt: '#fffbeb',
    card: '#fffbeb',
    border: '#fde68a',
    borderAlt: '#e5e7eb',
    textPrimary: '#1c1917',
    textSecondary: '#78716c',
    textMuted: '#a8a29e',
    white: '#ffffff',
    disabled: '#e5e7eb',
    disabledText: '#9ca3af',
  },

  // 结果反馈色
  feedback: {
    successBg: '#d1fae5',
    successBorder: '#6ee7b7',
    successText: '#059669',
    errorBg: '#fee2e2',
    errorBorder: '#fca5a5',
    errorText: '#dc2626',
    warningBg: '#fffbeb',
    warningBorder: '#fde68a',
    warningText: '#d97706',
  },

  // 阴影色（用于不同颜色的阴影效果）
  shadow: {
    primary: 'rgba(245, 158, 11, 0.2)',
    success: 'rgba(16, 185, 129, 0.2)',
    info: 'rgba(59, 130, 246, 0.2)',
    fun: 'rgba(236, 72, 153, 0.2)',
    wisdom: 'rgba(139, 92, 246, 0.2)',
    neutral: 'rgba(0, 0, 0, 0.05)',
  },
};

// 预设的辅助色映射（用于功能图标等）
export const SecondaryColorMap: Record<string, string> = {
  courses: Colors.primary.main,
  questions: Colors.secondary.info,
  notes: Colors.secondary.success,
  buddy: Colors.secondary.fun,
  matching: Colors.secondary.wisdom,
  gamification: Colors.primary.main,
  invite: Colors.secondary.info,
  payment: Colors.secondary.success,
  wallet: Colors.primary.dark,
  enterprise: Colors.secondary.wisdom,
};

// 获取对应颜色的阴影
export function getShadowColor(color: string): string {
  if (color === Colors.primary.main) return Colors.shadow.primary;
  if (color === Colors.secondary.success) return Colors.shadow.success;
  if (color === Colors.secondary.info) return Colors.shadow.info;
  if (color === Colors.secondary.fun) return Colors.shadow.fun;
  if (color === Colors.secondary.wisdom) return Colors.shadow.wisdom;
  return Colors.shadow.neutral;
}