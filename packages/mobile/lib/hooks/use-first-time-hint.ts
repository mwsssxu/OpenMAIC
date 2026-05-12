/**
 * useFirstTimeHint —— 一次性操作提示控制
 *
 * 使用 AsyncStorage 记忆用户是否已看过某个提示，避免重复打扰。
 *
 * 用法：
 *   const { visible, dismiss } = useFirstTimeHint('courses.longPress');
 *   return visible ? <HintToast onClose={dismiss} ... /> : null;
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'hint_seen:';

export interface UseFirstTimeHintOptions {
  /** 是否启用（默认 true，false 时永不显示） */
  enabled?: boolean;
  /** 延迟多少毫秒后再显示（默认 400ms，避免与页面进入动画重叠） */
  delayMs?: number;
  /** 若 > 0，显示后自动消失的时长（毫秒）。默认 0 表示不自动消失 */
  autoHideMs?: number;
}

export function useFirstTimeHint(key: string, options: UseFirstTimeHintOptions = {}) {
  const { enabled = true, delayMs = 400, autoHideMs = 0 } = options;
  const [visible, setVisible] = useState(false);

  const storageKey = `${STORAGE_PREFIX}${key}`;

  const dismiss = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(storageKey, '1').catch(() => {
      /* 记录失败不影响当前体验 */
    });
  }, [storageKey]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const seen = await AsyncStorage.getItem(storageKey);
        if (cancelled || seen) return;

        showTimer = setTimeout(() => {
          if (cancelled) return;
          setVisible(true);
          if (autoHideMs > 0) {
            hideTimer = setTimeout(() => {
              if (cancelled) return;
              setVisible(false);
              AsyncStorage.setItem(storageKey, '1').catch(() => {});
            }, autoHideMs);
          }
        }, delayMs);
      } catch {
        /* 读失败就当未看过，下次重试 */
      }
    })();

    return () => {
      cancelled = true;
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [enabled, storageKey, delayMs, autoHideMs]);

  return { visible, dismiss };
}

/** 调试用：清除指定 key（或全部）的首次提示记忆 */
export async function resetFirstTimeHint(key?: string): Promise<void> {
  if (key) {
    await AsyncStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    return;
  }
  const allKeys = await AsyncStorage.getAllKeys();
  const hintKeys = allKeys.filter((k) => k.startsWith(STORAGE_PREFIX));
  if (hintKeys.length > 0) {
    await AsyncStorage.multiRemove(hintKeys);
  }
}
