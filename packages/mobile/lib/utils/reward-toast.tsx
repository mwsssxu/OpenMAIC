/**
 * RewardToast — 全局积分奖励反馈
 *
 * 用法：
 *   import { showReward } from '@/lib/utils/reward-toast';
 *   showReward({ points: 25, newBalance: 710, source: 'assessment' });
 *
 * 设计原则：
 * - 移动端优先：顶部悬浮卡片，不阻塞主流程，2.6s 自动消失
 * - 触觉反馈：notificationAsync(Success) — 用户能"感觉到"积分到账
 * - 视觉反馈：弹性入场 + 粒子飘出 + 金币 emoji 旋转
 * - 防过度：同一秒内多次调用合并为单次（quiet 节流）
 *
 * 注意：使用 React Native Animated API（已在项目其他组件验证可用），
 * 通过 USE_NATIVE_DRIVER 自动适配 Expo Go / 原生构建。
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { USE_NATIVE_DRIVER } from '@/lib/configs/animation';
import { Colors } from '@/lib/constants/theme';

export type RewardSource =
  | 'assessment'
  | 'programming'
  | 'note_reminder'
  | 'depth_progress'
  | 'share_card'
  | 'persona_feedback'
  | 'admin_gift'
  | 'generic';

export interface RewardPayload {
  /** 本次获得的积分（正数）。0 或负数会被忽略。 */
  points: number;
  /** 发放后的新余额（可选，后端 grant_points 返回） */
  newBalance?: number | null;
  /** 来源（用于文案与未来分析） */
  source?: RewardSource;
  /** 自定义副文案（覆盖默认 source 文案） */
  description?: string;
}

const SOURCE_TEXT: Record<RewardSource, string> = {
  assessment: '完成测评',
  programming: '完成编程作业',
  note_reminder: '完成课程笔记',
  depth_progress: '完成学习场景',
  share_card: '分享课程',
  persona_feedback: '反馈人格匹配',
  admin_gift: '管理员奖励',
  generic: '获得奖励',
};

// 全局事件总线（不引入额外依赖）
type Listener = (p: RewardPayload) => void;
let listener: Listener | null = null;
let lastShowMs = 0;

/**
 * 在任意地方调用即可弹出奖励反馈。
 * 节流：800ms 内重复调用会被合并（避免 1 个请求触发多次）。
 */
export function showReward(payload: RewardPayload) {
  if (!payload || !payload.points || payload.points <= 0) return;
  const now = Date.now();
  if (now - lastShowMs < 800) return;
  lastShowMs = now;
  listener?.(payload);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ParticleState {
  id: number;
  x: number;
  drift: number;
  emoji: string;
  delay: number;
}

const PARTICLE_EMOJIS = ['✨', '⭐', '💫'];

export function RewardController() {
  const [payload, setPayload] = useState<RewardPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const [particles, setParticles] = useState<ParticleState[]>([]);

  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const coinScaleAnim = useRef(new Animated.Value(0)).current;
  const coinRotateAnim = useRef(new Animated.Value(0)).current;
  const particleAnimsRef = useRef<Animated.Value[]>([]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      setVisible(false);
      setPayload(null);
      setParticles([]);
    });
  }, [slideAnim, opacityAnim]);

  // 注册全局监听
  useEffect(() => {
    listener = (p: RewardPayload) => {
      setPayload(p);
      setVisible(true);
    };
    return () => {
      listener = null;
    };
  }, []);

  // 入场 + 粒子 + 触觉
  useEffect(() => {
    if (!visible || !payload) return;

    // 触觉反馈（仅 iOS/Android 原生有效，web 自动 no-op）
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    // 重置动画值
    slideAnim.setValue(-120);
    opacityAnim.setValue(0);
    coinScaleAnim.setValue(0);
    coinRotateAnim.setValue(0);

    // 生成粒子
    const newParticles: ParticleState[] = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: 30 + Math.random() * 80,
      drift: (Math.random() - 0.5) * 60,
      emoji: PARTICLE_EMOJIS[i % PARTICLE_EMOJIS.length],
      delay: i * 60,
    }));
    setParticles(newParticles);
    particleAnimsRef.current = newParticles.map(() => new Animated.Value(0));

    // 卡片滑入
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    // 金币弹出 + 旋转一圈
    Animated.sequence([
      Animated.spring(coinScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 120,
        delay: 100,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
    Animated.timing(coinRotateAnim, {
      toValue: 1,
      duration: 600,
      delay: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    // 粒子飘出
    Animated.stagger(
      40,
      particleAnimsRef.current.map((a) =>
        Animated.timing(a, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        })
      )
    ).start();

    // 自动关闭
    const timer = setTimeout(handleClose, 2600);
    return () => clearTimeout(timer);
  }, [visible, payload, slideAnim, opacityAnim, coinScaleAnim, coinRotateAnim, handleClose]);

  if (!visible || !payload) return null;

  const sourceText = payload.description ?? SOURCE_TEXT[payload.source ?? 'generic'];
  const rotateInterpolation = coinRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View pointerEvents="none" style={styles.root}>
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.coin,
            {
              transform: [{ scale: coinScaleAnim }, { rotate: rotateInterpolation }],
            },
          ]}
        >
          <Text style={styles.coinText}>🪙</Text>
        </Animated.View>

        <View style={styles.textCol}>
          <Text style={styles.pointsText}>+{payload.points} 积分</Text>
          <Text style={styles.sourceText}>
            {sourceText}
            {payload.newBalance != null ? ` · 余额 ${payload.newBalance}` : ''}
          </Text>
        </View>
      </Animated.View>

      {/* 粒子层 */}
      {particles.map((p, i) => {
        const anim = particleAnimsRef.current[i];
        if (!anim) return null;
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -60],
        });
        const translateX = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.drift],
        });
        const opacity = anim.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 0.8, 0],
        });
        return (
          <Animated.Text
            key={p.id}
            style={[
              styles.particle,
              {
                left: p.x,
                opacity,
                transform: [{ translateY }, { translateX }],
              },
            ]}
          >
            {p.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.card,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 220,
    maxWidth: SCREEN_WIDTH - 40,
    // iOS 阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    // Android 阴影
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.accent.light,
  },
  coin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  coinText: {
    fontSize: 24,
  },
  textCol: {
    flex: 1,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.accent.dark,
    lineHeight: 22,
  },
  sourceText: {
    fontSize: 12,
    color: Colors.neutral.textSecondary,
    marginTop: 2,
  },
  particle: {
    position: 'absolute',
    top: 30,
    fontSize: 18,
  },
});
