/**
 * HintToast —— 轻量级操作提示胶囊
 *
 * 用法：
 *   const { visible, dismiss } = useFirstTimeHint('quiz.swipe', { autoHideMs: 3500 });
 *   return <HintToast visible={visible} onClose={dismiss} icon="hand-left" text="左右滑动切换题目" />;
 */
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HintToastProps {
  visible: boolean;
  onClose?: () => void;
  /** 图标名（Ionicons） */
  icon?: keyof typeof Ionicons.glyphMap;
  /** 提示文本 */
  text: string;
  /** 显示位置：底部（默认）或顶部 */
  position?: 'top' | 'bottom' | 'center';
  /** 额外容器样式（覆盖定位） */
  style?: StyleProp<ViewStyle>;
}

export function HintToast({
  visible,
  onClose,
  icon = 'information-circle',
  text,
  position = 'bottom',
  style,
}: HintToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(20)).current;

  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translate, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translate, {
          toValue: 20,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, opacity, translate]);

  if (!mounted) return null;

  const positionStyle: ViewStyle =
    position === 'top'
      ? { top: 80 }
      : position === 'center'
        ? { top: '45%' }
        : { bottom: 100 };

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.wrapper,
        positionStyle,
        { opacity, transform: [{ translateY: translate }] },
        style,
      ]}
    >
      <Pressable onPress={onClose} style={styles.capsule}>
        <Ionicons name={icon} size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={styles.text} numberOfLines={2}>
          {text}
        </Text>
        {onClose && (
          <View style={styles.dismissBadge}>
            <Ionicons name="close" size={14} color="#FFFFFF" />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
    elevation: 10,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '86%',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  dismissBadge: {
    marginLeft: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
