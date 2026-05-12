import { Colors, SecondaryColorMap, getShadowColor } from '../lib/constants/theme';

describe('Theme Colors', () => {
  test('主色系定义正确 - 深蓝品牌色', () => {
    expect(Colors.primary.main).toBe('#1E40AF');
    expect(Colors.primary.light).toBe('#2563EB');
    expect(Colors.primary.dark).toBe('#1E3A8A');
    expect(Colors.primary.transparent).toBe('rgba(30, 64, 175, 0.1)');
  });

  test('辅助色系定义正确', () => {
    expect(Colors.secondary.success).toBe('#10B981');
    expect(Colors.secondary.successLight).toBe('#D1FAE5');
    expect(Colors.secondary.info).toBe('#2563EB');
    expect(Colors.secondary.infoLight).toBe('#DBEAFE');
    expect(Colors.secondary.slate).toBe('#64748B');
  });

  test('强调色定义正确 - 琥珀色', () => {
    expect(Colors.accent.main).toBe('#F59E0B');
    expect(Colors.accent.light).toBe('#FBBF24');
    expect(Colors.accent.dark).toBe('#D97706');
  });

  test('中性色定义正确 - 冷白灰背景', () => {
    expect(Colors.neutral.background).toBe('#F8FAFC');
    expect(Colors.neutral.backgroundAlt).toBe('#FFFFFF');
    expect(Colors.neutral.card).toBe('#FFFFFF');
    expect(Colors.neutral.textPrimary).toBe('#0F172A');
    expect(Colors.neutral.textSecondary).toBe('#475569');
  });

  test('反馈色定义正确', () => {
    expect(Colors.feedback.successBg).toBe('#D1FAE5');
    expect(Colors.feedback.successText).toBe('#059669');
    expect(Colors.feedback.errorBg).toBe('#FEF2F2');
    expect(Colors.feedback.errorText).toBe('#B91C1C');
    expect(Colors.feedback.warningBg).toBe('#FFFBEB');
    expect(Colors.feedback.warningText).toBe('#B45309');
  });

  test('阴影色定义正确', () => {
    expect(Colors.shadow.primary).toBe('rgba(30, 64, 175, 0.1)');
    expect(Colors.shadow.success).toBe('rgba(16, 185, 129, 0.1)');
    expect(Colors.shadow.info).toBe('rgba(37, 99, 235, 0.1)');
    expect(Colors.shadow.accent).toBe('rgba(245, 158, 11, 0.1)');
    expect(Colors.shadow.neutral).toBe('rgba(0, 0, 0, 0.02)');
  });

  test('SecondaryColorMap 包含所有功能入口', () => {
    expect(SecondaryColorMap.courses).toBe(Colors.primary.main);
    expect(SecondaryColorMap.questions).toBe(Colors.secondary.info);
    expect(SecondaryColorMap.notes).toBe(Colors.secondary.success);
    expect(SecondaryColorMap.buddy).toBe(Colors.accent.main);
    expect(SecondaryColorMap.knowledge).toBe(Colors.primary.main);
  });

  test('getShadowColor 返回正确的阴影色', () => {
    expect(getShadowColor(Colors.primary.main)).toBe(Colors.shadow.primary);
    expect(getShadowColor(Colors.secondary.success)).toBe(Colors.shadow.success);
    expect(getShadowColor(Colors.secondary.info)).toBe(Colors.shadow.info);
    expect(getShadowColor(Colors.accent.main)).toBe(Colors.shadow.accent);
    expect(getShadowColor('#unknown')).toBe(Colors.shadow.neutral);
  });
});