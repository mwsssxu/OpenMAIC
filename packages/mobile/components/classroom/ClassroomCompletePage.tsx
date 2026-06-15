/**
 * 课程完成页面 - 移动端版本
 *
 * 展示课程完成后的庆祝动画和统计数据
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useI18n } from '@/lib/i18n';
import { useRouter } from 'expo-router';
import { summarizeScenes, encouragementKey } from '@/lib/classroom/complete-summary';
import type { Scene, SceneType } from '@/lib/types/scene';
import { Colors } from '@/lib/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 场景类型图标映射
const SCENE_TYPE_ICONS: Record<SceneType, string> = {
  slide: 'document-text',
  quiz: 'help-circle',
  interactive: 'game-controller',
  pbl: 'layers', // 使用 layers 替代 puzzle
};

const TYPE_ORDER: SceneType[] = ['slide', 'quiz', 'interactive', 'pbl'];

// Confetti 颜色
const CONFETTI_COLORS = [
  '#fbbf24', '#f97316', '#ef4444', '#ec4899',
  '#a855f7', '#3b82f6', '#10b981',
];

interface ParticleConfig {
  x: number;
  y: number;
  rotate: number;
  color: string;
  size: number;
  duration: number;
  delay: number;
}

function makeConfetti(count: number): ParticleConfig[] {
  const particles: ParticleConfig[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
    const distance = 150 + Math.random() * 200;
    particles.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 30,
      rotate: (Math.random() - 0.5) * 720,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 6,
      duration: 1000 + Math.random() * 900,
      delay: Math.random() * 120,
    });
  }
  return particles;
}

// Confetti 粒子组件
function ConfettiParticle({ config, index }: { config: ParticleConfig; index: number }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.2);

  useEffect(() => {
    translateX.value = withDelay(
      config.delay,
      withTiming(config.x, { duration: config.duration, easing: Easing.out(Easing.quad) })
    );
    translateY.value = withDelay(
      config.delay,
      withTiming(config.y + 200, { duration: config.duration, easing: Easing.out(Easing.quad) })
    );
    rotate.value = withDelay(
      config.delay,
      withTiming(config.rotate, { duration: config.duration })
    );
    opacity.value = withDelay(
      config.delay,
      withTiming(0, { duration: config.duration })
    );
    scale.value = withDelay(
      config.delay,
      withTiming(1, { duration: 200 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        { backgroundColor: config.color, width: config.size, height: config.size * 0.4 },
        animatedStyle,
      ]}
    />
  );
}

// Confetti 组件
function Confetti() {
  const particles = useMemo(() => makeConfetti(40), []);

  return (
    <View style={styles.confettiContainer} pointerEvents="none">
      {particles.map((p, i) => (
        <ConfettiParticle key={i} config={p} index={i} />
      ))}
    </View>
  );
}

// Trophy SVG 组件 (简化版)
function TrophyIcon({ size = 120 }: { size?: number }) {
  return (
    <View style={[styles.trophyContainer, { width: size, height: size * 1.25 }]}>
      <Ionicons name="trophy" size={size} color="#fbbf24" />
    </View>
  );
}

// 闪光动画组件（带位置）
function Sparkle({ delay, top, left }: { delay: number; top: number; left: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.7, { duration: 200 }),
          withTiming(1, { duration: 200 }),
          withTiming(0, { duration: 400 }),
        ),
        -1,
        true
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.7, { duration: 200 }),
          withTiming(1, { duration: 200 }),
          withTiming(0, { duration: 400 }),
        ),
        -1,
        true
      )
    );
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.sparkle, { top, left }, animatedStyle]}>
      <Ionicons name="star" size={14} color="#fbbf24" />
    </Animated.View>
  );
}

// 数字动画计数器（简化版：直接显示值）
function AnimatedCounter({ value, delay }: { value: number; delay?: number }) {
  // delay 参数暂不使用，预留用于后续动画优化
  return <Text style={styles.statNumber}>{value}</Text>;
}

// Quiz 进度条（带动画）
function QuizRing({ pct, delay = 0 }: { pct: number; delay?: number }) {
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withDelay(delay, withTiming(pct, { duration: 1100 }));
  }, [pct, delay]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  return (
    <View style={styles.quizRing}>
      <View style={styles.quizRingOuter}>
        <Animated.View style={[styles.quizRingProgress, progressStyle]} />
      </View>
      <Text style={styles.quizRingText}>
        {pct}%
      </Text>
    </View>
  );
}

// 统计卡片
function StatCard({
  type,
  count,
  label,
  delay,
}: {
  type: SceneType;
  count: number;
  label: string;
  delay: number;
}) {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 20 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 300 }));
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const iconName = SCENE_TYPE_ICONS[type] as any;

  return (
    <Animated.View style={[styles.statCard, animatedStyle]}>
      <Ionicons name={iconName} size={24} color="#f59e0b" />
      <AnimatedCounter value={count} delay={delay + 150} />
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

interface ClassroomCompletePageProps {
  scenes: Scene[];
  title: string;
  quizAnswers?: Record<string, Record<string, string | string[]>>;
  classroomId?: string;
  onClose?: () => void;
}

export function ClassroomCompletePage({
  scenes,
  title,
  quizAnswers,
  classroomId,
  onClose,
}: ClassroomCompletePageProps) {
  const { t } = useI18n();
  const router = useRouter();

  // 触发震动反馈
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const summary = useMemo(() => summarizeScenes(scenes, quizAnswers), [scenes, quizAnswers]);

  const dateLabel = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
  }, []);

  const trailItems = TYPE_ORDER
    .filter((type) => (summary.countsByType[type] ?? 0) > 0)
    .map((type) => ({
      type,
      count: summary.countsByType[type] ?? 0,
      label: t(`classroomComplete.trailLabels.${type}`),
    }));

  // Trophy 动画
  const trophyScale = useSharedValue(0.4);
  const trophyY = useSharedValue(44);
  const haloScale = useSharedValue(0.6);
  const haloOpacity = useSharedValue(0);

  useEffect(() => {
    trophyScale.value = withDelay(200, withSpring(1, { stiffness: 260, damping: 18 }));
    trophyY.value = withDelay(200, withTiming(0, { duration: 500 }));
    haloScale.value = withDelay(150, withRepeat(
      withSequence(withTiming(1.15), withTiming(0.95), withTiming(1.1)),
      -1,
      true
    ));
    haloOpacity.value = withDelay(150, withRepeat(
      withSequence(withTiming(0.55), withTiming(0.4), withTiming(0.5)),
      -1,
      true
    ));
  }, []);

  const trophyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: trophyScale.value }, { translateY: trophyY.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
    opacity: haloOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* 背景 */}
      <View style={styles.background}>
        <Animated.View style={[styles.radialGlow, haloStyle]} />
      </View>

      {/* Confetti */}
      <Confetti />

      {/* 内容 */}
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Trophy 区域 */}
        <View style={styles.trophyArea}>
          <Animated.View style={[styles.trophyHalo, haloStyle]} />
          <Animated.View style={[styles.trophyWrapper, trophyStyle]}>
            <TrophyIcon size={100} />
          </Animated.View>
          {/* Sparkles */}
          <Sparkle delay={800} top={10} left={20} />
          <Sparkle delay={1100} top={30} left={170} />
          <Sparkle delay={1350} top={150} left={60} />
        </View>

        {/* 标题徽章 */}
        <View style={styles.ribbon}>
          <Ionicons name="star" size={12} color="white" />
          <Text style={styles.ribbonText}>{t('classroomComplete.title')}</Text>
          <Ionicons name="star" size={12} color="white" />
        </View>

        {/* 标题 */}
        <Text style={styles.title}>{title || t('classroomComplete.title')}</Text>
        <Text style={styles.dateLabel}>{dateLabel}</Text>

        {/* 统计卡片 */}
        {trailItems.length > 0 && (
          <View style={styles.statsGrid}>
            {trailItems.map((item, idx) => (
              <StatCard
                key={item.type}
                type={item.type}
                count={item.count}
                label={item.label}
                delay={960 + idx * 80}
              />
            ))}
          </View>
        )}

        {/* Quiz 卡片 */}
        {summary.quiz && (
          <View style={styles.quizCard}>
            <QuizRing pct={summary.quiz.pct} delay={1300} />
            <View style={styles.quizInfo}>
              <Text style={styles.quizScoreLabel}>
                {t('classroomComplete.quizScoreLabel', {
                  correct: summary.quiz.correct,
                  total: summary.quiz.total,
                })}
              </Text>
              <Text style={styles.quizEncouragement}>
                {t(`classroomComplete.encouragement.${encouragementKey(summary.quiz.pct)}`)}
              </Text>
            </View>
          </View>
        )}

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          {classroomId && (
            <TouchableOpacity
              style={styles.assessButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(`/classroom/${classroomId}/assessment` as any);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="clipboard-outline" size={18} color="#fff" />
              <Text style={styles.assessButtonText}>去测评</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffbeb',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fef3c7', // 使用纯色替代 gradient
  },
  radialGlow: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.3,
    left: SCREEN_WIDTH * 0.25,
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_WIDTH * 0.5,
    borderRadius: SCREEN_WIDTH * 0.25,
    backgroundColor: 'rgba(251, 191, 36, 0.3)',
  },
  confettiContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.4,
    left: SCREEN_WIDTH * 0.5,
    width: 0,
    height: 0,
    zIndex: 10,
  },
  confettiParticle: {
    position: 'absolute',
    borderRadius: 2,
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  trophyArea: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  trophyHalo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(251, 191, 36, 0.5)',
  },
  trophyWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f59e0b',
    marginBottom: 12,
  },
  ribbonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#b45309',
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: 100,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.neutral.card,
    alignItems: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fef3c7',
    marginBottom: 24,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  quizRing: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizRingOuter: {
    width: 70,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.3)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  quizRingProgress: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#f59e0b',
  },
  quizRingText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#b45309',
  },
  quizInfo: {
    flex: 1,
    marginLeft: 16,
  },
  quizScoreLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#b45309',
  },
  quizEncouragement: {
    fontSize: 14,
    color: '#92400e',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  assessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#c45a1a',
  },
  assessButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});