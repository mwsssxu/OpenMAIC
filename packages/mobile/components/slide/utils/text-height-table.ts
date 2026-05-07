/**
 * Text Height Lookup Table - 文本高度查表
 *
 * 与Web端Prompt模板一致（lib/generation/prompts/templates/slide-content/system.md）
 *
 * 规范：
 * - line-height = 1.5
 * - 包含10px上下padding（共20px）
 * - 公式：height = line_count × (font_size × 1.5) + 20
 */

/**
 * 文本高度查表
 *
 * 行号：1-5行
 * 字体：14px - 36px
 */
export const TEXT_HEIGHT_TABLE: Record<number, number[]> = {
  14: [43, 64, 85, 106, 127],
  16: [46, 70, 94, 118, 142],
  18: [49, 76, 103, 130, 157],
  20: [52, 82, 112, 142, 172],
  24: [58, 94, 130, 166, 202],
  28: [64, 106, 148, 190, 232],
  32: [70, 118, 166, 214, 262],
  36: [76, 130, 184, 238, 292],
};

/**
 * 根据字体大小和行数获取标准高度
 *
 * @param fontSize - 字体大小（14-36）
 * @param lineCount - 行数（1-5）
 * @returns 文本元素高度
 */
export function getTextHeight(fontSize: number, lineCount: number): number {
  const sizes = TEXT_HEIGHT_TABLE[fontSize];
  if (sizes && lineCount >= 1 && lineCount <= 5) {
    return sizes[lineCount - 1];
  }
  // 未在表中，使用公式计算
  return Math.ceil(lineCount * fontSize * 1.5 + 20);
}

/**
 * 计算文本所需行数
 *
 * @param text - 文本内容
 * @param width - 元素宽度
 * @param fontSize - 字体大小
 * @returns 预估行数
 */
export function calculateLineCount(
  text: string,
  width: number,
  fontSize: number
): number {
  if (!text || width <= 0 || fontSize <= 0) return 1;

  // 计算每行可容纳字符数（减去左右padding 20px）
  const charsPerLine = Math.floor((width - 20) / fontSize);
  if (charsPerLine <= 0) return 1;

  // 计算文本长度（中文字符算1个，英文单词平均5字符）
  // 简化处理：直接使用字符串长度
  const textLength = text.length;

  // 计算行数（加上安全边际）
  const lines = Math.ceil(textLength / (charsPerLine * 0.75)); // 75%利用率

  return Math.max(1, Math.min(lines, 5)); // 限制1-5行
}

/**
 * 常用背景色配色方案
 *
 * 用于简化格式的自动装饰
 */
export const AUTO_BACKGROUND_COLORS = {
  title: '#e8f4fd', // 标题：浅蓝色
  desc: '#f0f9e8', // 描述：浅绿色
  point: '#fafafa', // 要点：浅灰色
  default: 'transparent',
};

/**
 * 获取自动背景色
 *
 * @param elementId - 元素ID
 * @returns 背景色
 */
export function getAutoBackgroundColor(elementId: string): string {
  if (elementId.startsWith('title')) return AUTO_BACKGROUND_COLORS.title;
  if (elementId.startsWith('desc')) return AUTO_BACKGROUND_COLORS.desc;
  if (elementId.startsWith('point')) return AUTO_BACKGROUND_COLORS.point;
  return AUTO_BACKGROUND_COLORS.default;
}