import { ReactNode, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Pressable,
  Animated,
  PanResponder,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useFirstTimeHint } from '@/lib/hooks/use-first-time-hint';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 是否展示顶部拖拽把手，默认 true */
  showHandle?: boolean;
  /** 点击背景是否关闭，默认 true */
  dismissOnBackdropPress?: boolean;
  /** 是否启用下滑关闭，默认 true */
  swipeToClose?: boolean;
  /** 抽屉容器额外样式（通常透传原 modalContent） */
  contentStyle?: StyleProp<ViewStyle>;
  /** 透传 Modal onRequestClose（Android 系统返回键） */
  animationType?: 'slide' | 'fade' | 'none';
}

/**
 * 移动端通用底部抽屉 Modal：
 * - 点背景关闭
 * - 手指下滑跟随 + 释放超阈值关闭
 * - 顶部拖拽把手作为视觉提示
 */
export function BottomSheetModal({
  visible,
  onClose,
  children,
  showHandle = true,
  dismissOnBackdropPress = true,
  swipeToClose = true,
  contentStyle,
  animationType = 'slide',
}: BottomSheetModalProps) {
  const translateY = useRef(new Animated.Value(0)).current;

  // 首次打开时提示“下滑可关闭”— 全局只提示一次
  const swipeDownHint = useFirstTimeHint('bottomSheet.swipeDown', {
    enabled: visible && swipeToClose,
    delayMs: 250,
    autoHideMs: 2800,
  });

  // 提示的涼入涼出动画
  const hintOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(hintOpacity, {
      toValue: swipeDownHint.visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [swipeDownHint.visible, hintOpacity]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        if (!swipeToClose) return false;
        return Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
      },
      onPanResponderMove: (_evt, gesture) => {
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy > 100 || gesture.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const handleBackdropPress = () => {
    if (!dismissOnBackdropPress) return;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType={animationType}
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        {/* 阻止内部点击冒泡到 backdrop */}
        <Pressable onPress={() => { /* swallow */ }}>
          <Animated.View
            style={[
              styles.sheet,
              contentStyle,
              { transform: [{ translateY }] },
            ]}
            {...(swipeToClose ? panResponder.panHandlers : {})}
          >
            {showHandle && (
              <View style={styles.handleArea}>
                <View style={styles.handleBar} />
                {swipeToClose && (
                  <Animated.Text style={[styles.swipeHintText, { opacity: hintOpacity }]}>
                    下滑可关闭
                  </Animated.Text>
                )}
              </View>
            )}
            {children}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: Rounded.lg,
    borderTopRightRadius: Rounded.lg,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: 4,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  swipeHintText: {
    marginTop: 4,
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
