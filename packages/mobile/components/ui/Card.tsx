import React, { useCallback } from 'react';
import { View, ViewStyle, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/lib/constants/theme';
import { Animations } from '@/lib/configs/animation';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  backgroundColor?: string;
  borderColor?: string;
  shadowColor?: string;
  padding?: number;
  borderRadius?: number;
  onPress?: () => void;
  disabled?: boolean;
  animated?: boolean;
}

const AnimatedView = Animated.createAnimatedComponent(View) as any;

export function Card({
  children,
  style,
  backgroundColor = Colors.neutral.card,
  borderColor = Colors.neutral.border,
  shadowColor = Colors.primary.main,
  padding = 20,
  borderRadius = 16,
  onPress,
  disabled = false,
  animated = true,
}: CardProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    if (!animated || !onPress) return;
    scale.value = withTiming(Animations.card.press.scale, { duration: Animations.card.press.duration });
  }, [animated, onPress]);

  const handlePressOut = useCallback(() => {
    if (!animated || !onPress) return;
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, [animated, onPress]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [disabled, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const cardStyle: ViewStyle = {
    backgroundColor,
    borderRadius,
    borderWidth: 1,
    borderColor,
    padding,
    shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    ...Platform.select({ android: { elevation: 4 } }),
  };

  if (onPress) {
    return (
      <AnimatedView
        style={[cardStyle, animatedStyle, style]}
        onTouchStart={handlePressIn}
        onTouchEnd={handlePressOut}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handlePress}
      >
        {children}
      </AnimatedView>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
}

export function CardSmall({ children, style, onPress }: CardProps) {
  return <Card padding={12} borderRadius={12} style={style} onPress={onPress}>{children}</Card>;
}

export function CardFlat({ children, style, backgroundColor = Colors.neutral.backgroundAlt }: CardProps) {
  return <Card backgroundColor={backgroundColor} borderColor="transparent" shadowColor="transparent" style={style}>{children}</Card>;
}