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