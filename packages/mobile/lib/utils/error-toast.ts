/**
 * 全局错误提示工具
 *
 * 用法：import { showError } from '@/lib/utils/error-toast'; showError('操作失败');
 *
 * 为什么不用 useToast：useToast 需要在每个页面组件里 hook + 渲染 <Toast/>，
 * 在 catch 块中无法直接使用。Alert.alert 是命令式 API，随处可用。
 */

import { Alert } from 'react-native';

/**
 * 从未知错误对象中提取用户可读的消息
 */
export function getErrorMessage(err: unknown, fallback = '操作失败，请重试'): string {
  if (!err) return fallback;

  // Axios 错误
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;

    // 后端返回的错误详情
    if (e.response && typeof e.response === 'object') {
      const resp = e.response as Record<string, unknown>;
      if (resp.data && typeof resp.data === 'object') {
        const data = resp.data as Record<string, unknown>;
        if (typeof data.detail === 'string') return data.detail;
        if (typeof data.message === 'string') return data.message;
        if (typeof data.error === 'string') return data.error;
      }
      // HTTP 状态码提示
      if (typeof resp.status === 'number') {
        const status = resp.status as number;
        if (status === 401) return '登录已过期，请重新登录';
        if (status === 403) return '没有权限执行此操作';
        if (status === 404) return '请求的资源不存在';
        if (status === 429) return '操作过于频繁，请稍后再试';
        if (status >= 500) return '服务器繁忙，请稍后再试';
      }
    }

    // Error 对象
    if (e.message && typeof e.message === 'string') return e.message as string;

    // 字符串
    if (typeof err === 'string') return err;
  }

  return fallback;
}

/**
 * 全局错误提示 — 在任何 catch 块中直接调用
 */
export function showError(err: unknown, title = '提示'): void {
  const message = getErrorMessage(err);
  Alert.alert(title, message);
}
