// packages/mobile/lib/hooks/use-feedback.ts

import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

/**
 * 交互反馈 Hook
 * 提供统一的触觉反馈和视觉反馈触发函数
 */

export type FeedbackStyle = 'light' | 'medium' | 'heavy';
export type NotificationType = 'success' | 'warning' | 'error';

export function useFeedback() {
  // 点击反馈
  const onTap = useCallback((style: FeedbackStyle = 'light') => {
    const hapticStyle = style === 'light'
      ? Haptics.ImpactFeedbackStyle.Light
      : style === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy;

    Haptics.impactAsync(hapticStyle);
  }, []);

  // 按钮点击（默认轻触觉）
  const onPress = useCallback(() => {
    onTap('light');
  }, [onTap]);

  // 重要操作（中等触觉）
  const onImportant = useCallback(() => {
    onTap('medium');
  }, [onTap]);

  // 结果通知
  const onNotify = useCallback((type: NotificationType) => {
    const notificationType = type === 'success'
      ? Haptics.NotificationFeedbackType.Success
      : type === 'error'
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Warning;

    Haptics.notificationAsync(notificationType);
  }, []);

  // 成功反馈
  const onSuccess = useCallback((_message?: string) => {
    onNotify('success');
  }, [onNotify]);

  // 错误反馈
  const onError = useCallback((_message?: string) => {
    onNotify('error');
  }, [onNotify]);

  // 警告反馈
  const onWarning = useCallback((_message?: string) => {
    onNotify('warning');
  }, [onNotify]);

  // 选择反馈（用于选项切换）
  const onSelection = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

  return {
    onTap,
    onPress,
    onImportant,
    onNotify,
    onSuccess,
    onError,
    onWarning,
    onSelection,
  };
}