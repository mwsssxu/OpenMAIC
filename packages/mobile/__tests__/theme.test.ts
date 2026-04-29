import { Colors, SecondaryColorMap, getShadowColor } from '../lib/constants/theme';

describe('Theme Colors', () => {
  test('主色系定义正确', () => {
    expect(Colors.primary.main).toBe('#f59e0b');
    expect(Colors.primary.light).toBe('#fbbf24');
    expect(Colors.primary.dark).toBe('#d97706');
  });

  test('辅助色系定义正确', () => {
    expect(Colors.secondary.success).toBe('#10b981');
    expect(Colors.secondary.info).toBe('#3b82f6');
    expect(Colors.secondary.fun).toBe('#ec4899');
    expect(Colors.secondary.wisdom).toBe('#8b5cf6');
  });

  test('中性色定义正确', () => {
    expect(Colors.neutral.background).toBe('#fefce8');
    expect(Colors.neutral.card).toBe('#fffbeb');
    expect(Colors.neutral.textPrimary).toBe('#1c1917');
  });

  test('SecondaryColorMap 包含所有功能入口', () => {
    expect(SecondaryColorMap.courses).toBeDefined();
    expect(SecondaryColorMap.questions).toBeDefined();
    expect(SecondaryColorMap.notes).toBeDefined();
  });

  test('getShadowColor 返回正确的阴影色', () => {
    expect(getShadowColor(Colors.primary.main)).toBe('rgba(245, 158, 11, 0.2)');
    expect(getShadowColor(Colors.secondary.success)).toBe('rgba(16, 185, 129, 0.2)');
    expect(getShadowColor('#unknown')).toBe('rgba(0, 0, 0, 0.05)');
  });
});