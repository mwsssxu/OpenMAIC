/**
 * 全局弹框 UI 组件 — 在 _layout.tsx 中渲染一次即可
 * 页面居中弹出，带遮罩和动画
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { subscribeDialogs, dismissDialog, type DialogItem } from './error-toast';

const { width: SCREEN_W } = Dimensions.get('window');
const DIALOG_W = Math.min(SCREEN_W - 48, 340);

const C = {
  overlay: 'rgba(0,0,0,0.45)',
  bg: '#FFFFFF',
  title: '#1a1a1a',
  message: '#555555',
  cancel: '#666666',
  confirm: '#c45a1a',
  danger: '#dc2626',
  border: 'rgba(0,0,0,0.08)',
};

export function GlobalDialog() {
  const [queue, setQueue] = useState<DialogItem[]>([]);

  useEffect(() => subscribeDialogs(setQueue), []);

  if (queue.length === 0) return null;
  const dialog = queue[0];

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => dismissDialog(dialog.id, false)}>
      <View style={S.overlay}>
        <View style={S.card}>
          <Text style={S.title}>{dialog.title}</Text>
          {!!dialog.message && <Text style={S.message}>{dialog.message}</Text>}
          <View style={S.btnRow}>
            {dialog.type === 'confirm' && (
              <TouchableOpacity
                style={[S.btn, S.btnCancel]}
                onPress={() => dismissDialog(dialog.id, false)}
                activeOpacity={0.6}
              >
                <Text style={S.btnCancelText}>{dialog.cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[S.btn, dialog.destructive ? S.btnDanger : S.btnConfirm]}
              onPress={() => dismissDialog(dialog.id, true)}
              activeOpacity={0.6}
            >
              <Text style={dialog.destructive ? S.btnDangerText : S.btnConfirmText}>
                {dialog.confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.overlay,
  },
  card: {
    width: DIALOG_W,
    backgroundColor: C.bg,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: C.title,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: C.message,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: '#f5f5f5',
  },
  btnCancelText: {
    fontSize: 15,
    color: C.cancel,
    fontWeight: '500',
  },
  btnConfirm: {
    backgroundColor: C.confirm,
  },
  btnConfirmText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  btnDanger: {
    backgroundColor: C.danger,
  },
  btnDangerText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
});
