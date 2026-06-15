/**
 * Layout Detection - 检测数据格式类型
 *
 * 根据元素数据结构判断使用哪种渲染模式：
 * - simplified: 简化格式（position对象），后端scene_service.py生成
 * - precise: 精确格式（left/top直接属性），精确排版API生成
 * - empty: 空元素列表
 */

import type { PPTElement } from '../types';

export type LayoutMode = 'simplified' | 'precise' | 'empty';

/**
 * 检测布局模式
 *
 * @param elements - 元素数组
 * @returns 布局模式类型
 */
export function detectLayoutMode(elements: PPTElement[]): LayoutMode {
  if (elements.length === 0) return 'empty';

  const first = elements[0] as any;

  // 简化格式特征：有 position 对象，无 left/top 直接属性
  if (first.position && first.left === undefined) {
    return 'simplified';
  }

  // 精确格式特征：有 left/top 直接属性
  if (first.left !== undefined && first.top !== undefined) {
    return 'precise';
  }

  // 默认为简化格式
  return 'simplified';
}

/**
 * 从元素获取位置信息（兼容两种格式）
 *
 * @param element - 元素对象
 * @returns 位置信息 {left, top, width, height}
 */
export function getElementPosition(element: any): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  // 简化格式：嵌套position对象
  if (element.position) {
    return {
      left: element.position.left || 0,
      top: element.position.top || 0,
      width: element.position.width || 900,
      height: element.position.height || 50,
    };
  }

  // 精确格式：直接属性
  return {
    left: element.left || 0,
    top: element.top || 0,
    width: element.width || 100,
    height: element.height || 50,
  };
}

/**
 * 检测精确格式元素中是否存在多列并排布局
 *
 * 判断逻辑：如果有2个或以上text元素，它们的top值接近
 * （差距 < 较小元素高度的50%）且left值明显不同，
 * 则认为存在多列并排。
 *
 * @param elements - 元素数组
 * @returns 是否存在多列并排
 */
export function detectMultiColumnPrecise(elements: PPTElement[]): boolean {
  const textElements = elements.filter((el: any) => el.type === 'text');
  if (textElements.length < 2) return false;

  // 按 top 排序
  const sorted = [...textElements].sort((a: any, b: any) => {
    const topA = a.top ?? a.position?.top ?? 0;
    const topB = b.top ?? b.position?.top ?? 0;
    return topA - topB;
  });

  // 检测同行元素
  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const elA = sorted[i] as any;
      const elB = sorted[j] as any;

      const topA = elA.top ?? elA.position?.top ?? 0;
      const topB = elB.top ?? elB.position?.top ?? 0;
      const heightA = elA.height ?? elA.position?.height ?? 50;
      const heightB = elB.height ?? elB.position?.height ?? 50;
      const leftA = elA.left ?? elA.position?.left ?? 0;
      const leftB = elB.left ?? elB.position?.left ?? 0;

      // 同行判断：top差距小，left差距大
      const topDiff = Math.abs(topA - topB);
      const leftDiff = Math.abs(leftA - leftB);
      const minHeight = Math.min(heightA, heightB);

      if (topDiff < minHeight * 0.5 && leftDiff > 100) {
        return true;
      }
    }
  }

  return false;
}