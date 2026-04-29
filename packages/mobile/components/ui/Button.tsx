import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/lib/constants/theme';
import { Animations } from '@/lib/configs/animation';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'icon';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  title?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  color?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  hapticStyle?: 'light' | 'medium' | 'heavy';
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity) as any;

export function Button({
  variant = 'primary',
  size = 'medium',
  title,
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  color,
  onPress,
  onLongPress,
  hapticStyle = 'light',
}: ButtonProps) {
  const scale = useSharedValue(1);

  const triggerHaptic = useCallback(() => {
    const haptic = hapticStyle === 'light'
      ? Haptics.ImpactFeedbackStyle.Light
      : hapticStyle === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy;
    Haptics.impactAsync(haptic);
  }, [hapticStyle]);

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(Animations.buttonPress.scale, { duration: Animations.buttonPress.duration });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSequence(
      withSpring(1.02, { damping: 15, stiffness: 200 }),
      withTiming(1, { duration: 100 })
    );
  }, []);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    triggerHaptic();
    onPress?.();
  }, [disabled, loading, triggerHaptic, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getButtonStyle = (): ViewStyle[] => {
    const base: ViewStyle[] = [styles.base];
    if (size === 'small') base.push(styles.small);
    if (size === 'large') base.push(styles.large);

    if (variant === 'primary') {
      base.push({
        backgroundColor: color || Colors.primary.main,
        shadowColor: color || Colors.primary.main,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        ...Platform.select({ android: { elevation: 4 } }),
      });
    } else if (variant === 'secondary') {
      base.push({
        backgroundColor: Colors.neutral.card,
        borderWidth: 2,
        borderColor: color || Colors.primary.main,
      });
    } else if (variant === 'text') {
      base.push({ backgroundColor: 'transparent' });
    } else if (variant === 'icon') {
      base.push(styles.iconButton, {
        backgroundColor: color || Colors.primary.main,
        shadowColor: color || Colors.primary.main,
        shadowOpacity: 0.2,
      });
    }

    if (disabled) base.push(styles.disabled);
    if (fullWidth) base.push(styles.fullWidth);
    if (style) base.push(style);
    return base;
  };

  const getTextStyle = (): TextStyle[] => {
    const base: TextStyle[] = [styles.text];
    if (size === 'small') base.push(styles.textSmall);
    if (size === 'large') base.push(styles.textLarge);
    if (variant === 'primary') base.push({ color: Colors.neutral.white });
    else if (variant === 'secondary') base.push({ color: color || Colors.primary.dark });
    else if (variant === 'text') base.push({ color: color || Colors.primary.main });
    if (disabled) base.push({ color: Colors.neutral.disabledText });
    if (textStyle) base.push(textStyle);
    return base;
  };

  return (
    <AnimatedTouchable
      style={[getButtonStyle(), animatedStyle]}
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? Colors.neutral.white : Colors.primary.main} />
      ) : (
        <>
          {icon}
          {title && <Text style={getTextStyle()}>{title}</Text>}
        </>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 24, gap: 8 },
  small: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16 },
  large: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 24 },
  iconButton: { width: 48, height: 48, borderRadius: 24, paddingVertical: 0, paddingHorizontal: 0 },
  disabled: { backgroundColor: Colors.neutral.disabled, shadowOpacity: 0, elevation: 0 },
  fullWidth: { width: '100%' },
  text: { fontSize: 14, fontWeight: '600' },
  textSmall: { fontSize: 12 },
  textLarge: { fontSize: 16 },
});
