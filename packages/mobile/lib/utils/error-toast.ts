/**
 * 全局弹框工具 — 页面居中 Modal 展示
 *
 * showError('操作失败') — 提示弹框
 * confirmAction('标题', '内容', onConfirm) — 确认弹框（居中展示）
 *
 * 原理：队列管理 + 回调订阅，GlobalDialog 组件在 _layout.tsx 中渲染一次。
 */

// ============ 纯逻辑层：消息提取 ============

export function getErrorMessage(err: unknown, fallback = '操作失败，请重试'): string {
  if (!err) return fallback;
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
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

// ============ 全局弹框队列 ============

interface DialogItem {
  id: number;
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  resolve: (value: boolean) => void;
}

export type { DialogItem };

let dialogQueue: DialogItem[] = [];
let dialogId = 0;
let updateCallback: ((queue: DialogItem[]) => void) | null = null;

function notifyUpdate() {
  updateCallback?.(dialogQueue);
}

function pushDialog(item: Omit<DialogItem, 'id'>): Promise<boolean> {
  const id = ++dialogId;
  return new Promise((resolve) => {
    const dialog: DialogItem = { ...item, id, resolve };
    dialogQueue = [...dialogQueue, dialog];
    notifyUpdate();
  });
}

export function subscribeDialogs(cb: (queue: DialogItem[]) => void) {
  updateCallback = cb;
  cb(dialogQueue);
  return () => { updateCallback = null; };
}

export function dismissDialog(id: number, result: boolean) {
  const dialog = dialogQueue.find(d => d.id === id);
  if (dialog) {
    dialog.resolve(result);
    dialogQueue = dialogQueue.filter(d => d.id !== id);
    notifyUpdate();
  }
}

// ============ 公开 API ============

export function showError(err: unknown, title = '提示'): void {
  const message = getErrorMessage(err);
  pushDialog({
    type: 'alert',
    title,
    message,
    confirmText: '知道了',
    cancelText: '',
    destructive: false,
  });
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = '确定',
  cancelText = '取消',
  destructive = false,
): void {
  pushDialog({
    type: 'confirm',
    title,
    message,
    confirmText,
    cancelText,
    destructive,
  }).then(confirmed => {
    if (confirmed) onConfirm();
  });
}
