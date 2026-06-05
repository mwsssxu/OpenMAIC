// packages/mobile/lib/configs/animation.ts

import { Easing } from 'react-native-reanimated';

/**
 * 检测 RCTAnimation 原生模块是否可用
 * Expo Go 环境可能缺少此模块，导致 useNativeDriver 警告
 * 
 * 注意：延迟检测到首次使用时，避免模块加载阶段 NativeModules 未初始化
 */
let _nativeDriverAvailable: boolean | null = null;

export function isNativeDriverAvailable(): boolean {
  if (_nativeDriverAvailable !== null) return _nativeDriverAvailable;
  try {
    // 检测原生动画模块是否存在
    // Platform.OS 检查确保 web 端直接返回 false
    const { Platform, NativeModules } = require('react-native');
    _nativeDriverAvailable = Platform.OS !== 'web' && !!NativeModules.NativeAnimatedModule;
  } catch {
    _nativeDriverAvailable = false;
  }
  return _nativeDriverAvailable;
}

/**
 * 安全的 useNativeDriver 值
 * 有原生动画模块返回 true，否则降级为 false（JS 驱动动画）
 */
export const USE_NATIVE_DRIVER: boolean = isNativeDriverAvailable();

/**
 * 动画配置
 * 统一的动画参数，确保全应用动画一致性
 */

export const Animations = {
  // 按钮按下动画
  buttonPress: {
    scale: 0.95,
    duration: 100,
    easing: Easing.out(Easing.quad),
  },

  // 按钮释放动画
  buttonRelease: {
    scale: 1,
    duration: 150,
    easing: Easing.out(Easing.quad),
  },

  // 按钮外发光效果
  buttonGlow: {
    duration: 200,
    opacity: 0.3,
    radius: 4,
  },

  // 页面过渡动画
  transition: {
    fade: { duration: 200, easing: Easing.out(Easing.quad) },
    slideIn: { duration: 250, translateX: -300, easing: Easing.out(Easing.quad) },
    slideOut: { duration: 200, translateX: 300, easing: Easing.in(Easing.quad) },
    spring: { damping: 15, stiffness: 150, mass: 1 },
  },

  // 卡片动画
  card: {
    fadeIn: { duration: 300, easing: Easing.out(Easing.quad) },
    press: { scale: 0.98, duration: 100 },
  },

  // Toast 动画
  toast: {
    slideUp: { duration: 300, translateY: -20, easing: Easing.out(Easing.quad) },
    fadeOut: { duration: 200, delay: 2000 },
  },

  // 图标网格动画
  gridItem: {
    press: { scale: 0.9, duration: 80 },
    release: { scale: 1, duration: 120 },
  },

  // 模态框动画
  modal: {
    backdrop: { fadeIn: 200, fadeOut: 200 },
    content: { spring: { damping: 20, stiffness: 200 } },
  },

  // 加载动画
  loading: {
    spinner: { duration: 1000, rotation: 360 },
    progress: { duration: 500, easing: Easing.out(Easing.quad) },
  },
};

export function createButtonPressAnimation() {
  return { scale: Animations.buttonPress.scale, duration: Animations.buttonPress.duration };
}

export function createFadeTransition() {
  return { duration: Animations.transition.fade.duration, easing: Animations.transition.fade.easing };
}

export function createSpringAnimation() {
  return Animations.transition.spring;
}