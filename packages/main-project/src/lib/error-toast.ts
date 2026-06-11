/**
 * 统一错误处理工具 — 与移动端 error-toast.ts 的 getErrorMessage 逻辑一致
 *
 * 用法:
 *   import { getErrorMessage, showError, showSuccess } from '@/lib/error-toast';
 *   try { ... } catch (err) { showError(err); }
 */

import { toast } from 'sonner';

// ============ 消息提取 ============

export function getErrorMessage(err: unknown, fallback = '操作失败，请重试'): string {
  if (!err) return fallback;
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    // axios error: err.response.data.detail
    if (e.response && typeof e.response === 'object') {
      const resp = e.response as Record<string, unknown>;
      if (resp.data && typeof resp.data === 'object') {
        const data = resp.data as Record<string, unknown>;
        if (typeof data.detail === 'string') return data.detail;
        if (typeof data.message === 'string') return data.message;
        if (typeof data.error === 'string') return data.error;
      }
      if (typeof resp.status === 'number') {
        const s = resp.status as number;
        if (s === 401) return '登录已过期，请重新登录';
        if (s === 403) return '没有权限执行此操作';
        if (s === 404) return '请求的资源不存在';
        if (s === 429) return '操作过于频繁，请稍后再试';
        if (s >= 500) return '服务器繁忙，请稍后再试';
      }
    }
    if (e.message && typeof e.message === 'string') return e.message as string;
  }
  if (typeof err === 'string') return err;
  return fallback;
}

// ============ Toast API ============

export function showError(err: unknown, fallback = '操作失败，请重试'): void {
  const message = getErrorMessage(err, fallback);
  toast.error(message);
}

export function showSuccess(message: string): void {
  toast.success(message);
}

export function showInfo(message: string): void {
  toast.info(message);
}

export function showWarning(message: string): void {
  toast.warning(message);
}
