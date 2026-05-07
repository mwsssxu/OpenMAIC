/**
 * Slide Constants - 共享常量定义
 *
 * 与Web端保持一致
 */

// Viewport尺寸（Web端标准）
export const VIEWPORT_SIZE = 1000;
export const VIEWPORT_RATIO = 16 / 9;
export const VIEWPORT_HEIGHT = VIEWPORT_SIZE / VIEWPORT_RATIO; // 562.5

// 简化格式基准宽度（scene_service.py生成）
export const SIMPLIFIED_WIDTH = 900;

// Canvas边距
export const CANVAS_MARGIN_PRECISE = 20;
export const CANVAS_MARGIN_SIMPLIFIED = 40;