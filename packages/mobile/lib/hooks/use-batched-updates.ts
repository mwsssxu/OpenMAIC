/**
 * 批量更新 Hook - 用于流式文本更新优化
 *
 * 将高频的流式更新批量处理，减少 React 重渲染次数
 * 适用于 Agent 讨论、聊天消息等场景
 */

import { useRef, useCallback, useState, useEffect } from 'react';

interface BatchUpdateOptions {
  /** 批量更新间隔（毫秒），默认 100ms */
  intervalMs?: number;
  /** 最大累积字符数，超过则立即刷新 */
  maxBatchSize?: number;
}

// React Native 环境的 setTimeout 返回 number
type TimeoutHandle = ReturnType<typeof setTimeout>;

/**
 * 用于管理流式文本的批量更新
 *
 * @example
 * ```tsx
 * const { displayText, appendText, flush, reset } = useBatchedText({
 *   intervalMs: 100,
 *   onFlush: (text) => console.log('Flushed:', text),
 * });
 *
 * // 每次收到流式文本时调用
 * appendText(chunk);
 *
 * // 组件卸载或需要立即显示时
 * flush();
 * ```
 */
export function useBatchedText(
  options: BatchUpdateOptions & { onFlush?: (text: string) => void } = {}
) {
  const { intervalMs = 100, maxBatchSize = 100, onFlush } = options;

  const [displayText, setDisplayText] = useState('');
  const pendingTextRef = useRef('');
  const flushTimeoutRef = useRef<TimeoutHandle | null>(null);
  const totalLengthRef = useRef(0);

  const flush = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }

    if (pendingTextRef.current) {
      const pending = pendingTextRef.current;
      pendingTextRef.current = '';
      setDisplayText(prev => {
        const newText = prev + pending;
        onFlush?.(newText);
        return newText;
      });
    }
  }, [onFlush]);

  const appendText = useCallback((chunk: string) => {
    pendingTextRef.current += chunk;
    totalLengthRef.current += chunk.length;

    // 超过最大批量大小，立即刷新
    if (pendingTextRef.current.length >= maxBatchSize) {
      flush();
      return;
    }

    // 设置定时器，延迟刷新
    if (!flushTimeoutRef.current) {
      flushTimeoutRef.current = setTimeout(() => {
        flushTimeoutRef.current = null;
        flush();
      }, intervalMs);
    }
  }, [intervalMs, maxBatchSize, flush]);

  const reset = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    pendingTextRef.current = '';
    totalLengthRef.current = 0;
    setDisplayText('');
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, []);

  return {
    displayText,
    appendText,
    flush,
    reset,
    /** 当前累积的总长度 */
    totalLength: totalLengthRef.current,
  };
}

/**
 * 用于管理聊天历史的批量更新
 *
 * 适用于 Agent 讨论场景，每条消息独立更新其文本内容
 */
export function useBatchedChatHistory<T extends { id?: string; message: string }>(
  options: BatchUpdateOptions = {}
) {
  const { intervalMs = 100, maxBatchSize = 100 } = options;

  const [history, setHistory] = useState<T[]>([]);
  const pendingUpdatesRef = useRef<Map<string, string>>(new Map());
  const flushTimeoutRef = useRef<TimeoutHandle | null>(null);

  const flush = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }

    if (pendingUpdatesRef.current.size > 0) {
      const updates = new Map(pendingUpdatesRef.current);
      pendingUpdatesRef.current.clear();

      setHistory(prev => {
        return prev.map(item => {
          const itemId = item.id || '';
          const update = updates.get(itemId);
          if (update !== undefined) {
            return { ...item, message: update };
          }
          return item;
        });
      });
    }
  }, []);

  const appendToMessage = useCallback((itemId: string, chunk: string) => {
    setHistory(prev => {
      const existing = prev.find(item => (item.id || '') === itemId);
      if (!existing) {
        return prev;
      }

      // 更新 pending
      const currentPending = pendingUpdatesRef.current.get(itemId) || existing.message;
      const newPending = currentPending + chunk;
      pendingUpdatesRef.current.set(itemId, newPending);

      // 超过最大批量大小，立即刷新
      if (newPending.length >= maxBatchSize) {
        flush();
        return prev;
      }

      // 设置定时器
      if (!flushTimeoutRef.current) {
        flushTimeoutRef.current = setTimeout(() => {
          flushTimeoutRef.current = null;
          flush();
        }, intervalMs);
      }

      return prev;
    });
  }, [intervalMs, maxBatchSize, flush]);

  const addEntry = useCallback((entry: T) => {
    // 先刷新任何待处理的更新
    flush();
    setHistory(prev => [...prev, entry]);
  }, [flush]);

  const reset = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    pendingUpdatesRef.current.clear();
    setHistory([]);
  }, []);

  const setHistoryDirect = useCallback((entries: T[]) => {
    flush();
    setHistory(entries);
  }, [flush]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, []);

  return {
    history,
    addEntry,
    appendToMessage,
    reset,
    setHistory: setHistoryDirect,
    flush,
  };
}
