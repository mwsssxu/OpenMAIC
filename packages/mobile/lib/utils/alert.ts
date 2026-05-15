/**
 * 跨平台 Alert 工具
 *
 * Web 端用 window.alert/confirm，Mobile 端用 React Native Alert。
 * 用于替代散落在各业务文件中的 showAlert 重复函数。
 */
import { Platform } from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

/**
 * 通用弹窗提示
 * @param title 标题
 * @param message 正文
 * @param buttons 按钮列表（mobile 原生支持；web 仅触发第一个非 cancel 按钮的 onPress）
 */
export function showAlert(title: string, message: string, buttons?: AlertButton[]): void {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 0) {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        const primary = buttons.find((b) => b.style !== 'cancel') ?? buttons[0];
        primary?.onPress?.();
      }
    } else {
      window.alert(`${title}\n\n${message}`);
    }
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Alert } = require('react-native');
  Alert.alert(title, message, buttons);
}

/** 仅显示消息的简化版本，等价于 showAlert(title, message) */
export function showMessage(title: string, message: string): void {
  showAlert(title, message);
}
