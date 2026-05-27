import { Dimensions, PixelRatio } from 'react-native';

// Web端白板/场景画布的基准视口宽度
export const CANVAS_VIEWPORT_W = 1000;
export const CANVAS_VIEWPORT_H = 600;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** 移动端可用内容宽度（减去边距） */
export const CONTENT_W = SCREEN_W * 0.92;

/** 移动端可用内容高度（按比例） */
export const CONTENT_H = SCREEN_H * 0.75;

/** 场景画布缩放比：将 1000px 基准宽度映射到移动端 */
export const canvasScale = CONTENT_W / CANVAS_VIEWPORT_W;

/** 将画布坐标转换为移动端像素 */
export function sx(v: number): number {
  return Math.round(v * canvasScale);
}

/** 将画布字号转换为移动端字号，不低于最小值 */
export function sFont(size: number, min = 8): number {
  return Math.max(min, Math.round(size * canvasScale));
}

/** 移动端是否为小屏（iPhone SE 等） */
export const isSmallScreen = SCREEN_W < 375;

/** 移动端是否为宽屏（iPad 等） */
export const isWideScreen = SCREEN_W >= 768;

/** 屏幕实际像素宽度 */
export const screenW = SCREEN_W;

/** 屏幕实际像素高度 */
export const screenH = SCREEN_H;

/** 1dp 对应的像素 */
export const pixelRatio = PixelRatio.get();
