import { View, Text, StyleSheet, Modal, Animated, TouchableOpacity, Dimensions, Easing } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

interface CelebrationConfig {
  animation: string;
  duration: number;
  sound: string;
  vibration: string;
  message: string;
  color: string;
  particles?: {
    count: number;
    colors: string[];
    spread: number;
    origin: { y: number };
  };
}

interface CelebrationPopupProps {
  visible: boolean;
  config: CelebrationConfig | null;
  rewardPoints?: number;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function CelebrationPopup({ visible, config, rewardPoints, onClose }: CelebrationPopupProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef<Animated.Value[]>([]).current;
  const [particles, setParticles] = useState<{ x: number; y: number; color: string }[]>([]);

  useEffect(() => {
    if (visible && config) {
      // 触发震动反馈
      triggerVibration(config.vibration);

      // 生成粒子
      if (config.particles) {
        const newParticles = Array.from({ length: config.particles.count }, (_, i) => ({
          x: Math.random() * SCREEN_WIDTH,
          y: SCREEN_HEIGHT * config.particles.origin.y,
          color: config.particles.colors[i % config.particles.colors.length],
        }));
        setParticles(newParticles);

        // 初始化粒子动画
        particleAnims.length = newParticles.length;
        for (let i = 0; i < newParticles.length; i++) {
          particleAnims[i] = new Animated.Value(0);
        }
      }

      // 弹窗动画
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // 粒子散开动画
      if (particleAnims.length > 0) {
        Animated.stagger(20, particleAnims.map(anim =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          })
        )).start();
      }

      // 自动关闭
      const timer = setTimeout(() => {
        handleClose();
      }, config.duration * 1000 + 500);

      return () => clearTimeout(timer);
    } else {
      setParticles([]);
    }
  }, [visible, config]);

  const triggerVibration = (type: string) => {
    switch (type) {
      case 'short':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'long':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
        break;
      case 'double':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 150);
        break;
      case 'pattern':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 100);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
        break;
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible || !config) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.overlay}>
        {/* 粒子效果 */}
        {particles.map((particle, i) => (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                backgroundColor: particle.color,
                left: particle.x,
                top: particle.y,
                transform: [
                  {
                    translateY: particleAnims[i]?.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -SCREEN_HEIGHT * 0.6],
                    }) || 0,
                  },
                  {
                    translateX: particleAnims[i]?.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, (Math.random() - 0.5) * 200],
                    }) || 0,
                  },
                  {
                    scale: particleAnims[i]?.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 1.5, 0],
                    }) || 1,
                  },
                ],
                opacity: particleAnims[i]?.interpolate({
                  inputRange: [0, 0.8, 1],
                  outputRange: [1, 1, 0],
                }) || 1,
              },
            ]}
          />
        ))}

        {/* 弹窗主体 */}
        <Animated.View
          style={[
            styles.popup,
            {
              backgroundColor: config.color + '20',
              borderColor: config.color,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* 动画图标 */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [
                  {
                    scale: scaleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.5, 1.2, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={[styles.celebrateIcon, { color: config.color }]}>
              {getAnimationIcon(config.animation)}
            </Text>
          </Animated.View>

          {/* 消息文本 */}
          <Text style={[styles.message, { color: config.color }]}>
            {config.message}
          </Text>

          {/* 积分显示 */}
          {rewardPoints && (
            <View style={styles.rewardContainer}>
              <Text style={[styles.rewardText, { color: config.color }]}>
                +{rewardPoints} 积分
              </Text>
            </View>
          )}

          {/* 关闭按钮 */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: config.color }]}
            onPress={handleClose}
          >
            <Text style={styles.closeButtonText}>太棒了!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

function getAnimationIcon(animationType: string): string {
  const icons: Record<string, string> = {
    confetti: '🎉',
    fireworks: '🎇',
    sparkle: '✨',
    cascade: '🌟',
    mystery: '🔮',
    pulse: '💫',
    slideIn: '🏆',
    bounce: '🎯',
    fadeIn: '⭐',
    scaleUp: '🔥',
    glow: '💡',
  };
  return icons[animationType] || '🎊';
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    width: 300,
    padding: 30,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 15,
  },
  celebrateIcon: {
    fontSize: 60,
  },
  message: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  rewardText: {
    fontSize: 28,
    fontWeight: '800',
  },
  closeButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});