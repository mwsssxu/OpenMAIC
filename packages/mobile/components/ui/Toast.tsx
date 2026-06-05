import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { USE_NATIVE_DRIVER } from '@/lib/configs/animation';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/lib/constants/theme';
import { Animations } from '@/lib/configs/animation';
import { useFeedback } from '@/lib/hooks/use-feedback';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  onClose?: () => void;
}

export function Toast({ visible, type, message, description, duration = 3000, onClose }: ToastProps) {
  const { onSuccess, onError, onWarning } = useFeedback();
  const fadeAnim = React.useRef(new RNAnimated.Value(0)).current;
  const slideAnim = React.useRef(new RNAnimated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      if (type === 'success') onSuccess();
      if (type === 'error') onError();
      if (type === 'warning' || type === 'info') onWarning();

      RNAnimated.parallel([
        RNAnimated.timing(fadeAnim, { toValue: 1, duration: Animations.toast.slideUp.duration, useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.timing(slideAnim, { toValue: 0, duration: Animations.toast.slideUp.duration, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();

      const timer = setTimeout(() => handleClose(), duration);
      return () => clearTimeout(timer);
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(fadeAnim, { toValue: 0, duration: Animations.toast.fadeOut.duration, useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.timing(slideAnim, { toValue: 20, duration: Animations.toast.fadeOut.duration, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [visible, type, duration]);

  const handleClose = useCallback(() => {
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, { toValue: 0, duration: Animations.toast.fadeOut.duration, useNativeDriver: USE_NATIVE_DRIVER }),
      RNAnimated.timing(slideAnim, { toValue: 20, duration: Animations.toast.fadeOut.duration, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => onClose?.());
  }, [onClose]);

  if (!visible) return null;

  const getConfig = () => {
    switch (type) {
      case 'success': return { backgroundColor: Colors.feedback.successBg, borderColor: Colors.feedback.successBorder, textColor: Colors.feedback.successText, icon: 'checkmark-circle', iconColor: Colors.secondary.success };
      case 'error': return { backgroundColor: Colors.feedback.errorBg, borderColor: Colors.feedback.errorBorder, textColor: Colors.feedback.errorText, icon: 'close-circle', iconColor: '#ef4444' };
      case 'warning': return { backgroundColor: Colors.feedback.warningBg, borderColor: Colors.feedback.warningBorder, textColor: Colors.feedback.warningText, icon: 'warning', iconColor: Colors.primary.main };
      case 'info': return { backgroundColor: Colors.secondary.infoLight, borderColor: Colors.secondary.infoBorder, textColor: Colors.secondary.info, icon: 'information-circle', iconColor: Colors.secondary.info };
    }
  };

  const config = getConfig();

  return (
    <RNAnimated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={[styles.toast, { backgroundColor: config.backgroundColor, borderColor: config.borderColor }]} onPress={handleClose} activeOpacity={0.8}>
        <Ionicons name={config.icon as any} size={24} color={config.iconColor} />
        <View style={styles.content}>
          <Text style={[styles.message, { color: config.textColor }]}>{message}</Text>
          {description && <Text style={[styles.description, { color: config.textColor }]}>{description}</Text>}
        </View>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={config.textColor} />
        </TouchableOpacity>
      </TouchableOpacity>
    </RNAnimated.View>
  );
}

export function useToast() {
  const [toastState, setToastState] = React.useState<{ visible: boolean; type: ToastType; message: string; description?: string }>({ visible: false, type: 'info', message: '' });

  const show = useCallback((type: ToastType, message: string, description?: string) => setToastState({ visible: true, type, message, description }), []);
  const hide = useCallback(() => setToastState(prev => ({ ...prev, visible: false })), []);
  const success = useCallback((message: string, description?: string) => show('success', message, description), [show]);
  const error = useCallback((message: string, description?: string) => show('error', message, description), [show]);
  const warning = useCallback((message: string, description?: string) => show('warning', message, description), [show]);
  const info = useCallback((message: string, description?: string) => show('info', message, description), [show]);

  return { toastState, show, hide, success, error, warning, info };
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 60, left: 0, right: 0, paddingHorizontal: 16, zIndex: 1000 },
  toast: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  content: { flex: 1 },
  message: { fontSize: 14, fontWeight: '600' },
  description: { fontSize: 12, marginTop: 4, opacity: 0.8 },
  closeBtn: { padding: 4 },
});
