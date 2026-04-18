/**
 * 激光笔/聚光灯组件 - 用于幻灯片演示
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useI18n } from '@/lib/i18n';

interface PointerOverlayProps {
  width: number;
  height: number;
  enabled?: boolean;
  mode?: 'laser' | 'spotlight';
  onPositionChange?: (x: number, y: number) => void;
}

export function PointerOverlay({
  width,
  height,
  enabled = false,
  mode = 'laser',
  onPositionChange,
}: PointerOverlayProps) {
  const { t } = useI18n();
  const [position, setPosition] = useState({ x: width / 2, y: height / 2 });
  const [active, setActive] = useState(enabled);
  const [pointerMode, setPointerMode] = useState(mode);

  // 激光笔动画
  const laserOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pointerMode === 'laser' && active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserOpacity, { toValue: 0.7, duration: 300, useNativeDriver: true }),
          Animated.timing(laserOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    } else {
      laserOpacity.setValue(1);
    }
  }, [pointerMode, active]);

  // 聚光灯半径动画
  const spotlightRadius = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (pointerMode === 'spotlight' && active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(spotlightRadius, { toValue: 70, duration: 500, useNativeDriver: true }),
          Animated.timing(spotlightRadius, { toValue: 60, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      spotlightRadius.setValue(60);
    }
  }, [pointerMode, active]);

  const handleTouch = (evt: any) => {
    if (!active) return;
    const { locationX, locationY } = evt.nativeEvent;
    const x = Math.max(0, Math.min(locationX, width));
    const y = Math.max(0, Math.min(locationY, height));
    setPosition({ x, y });
    onPositionChange?.(x, y);
  };

  const handleTouchMove = (evt: any) => {
    handleTouch(evt);
  };

  return (
    <View style={[styles.container, { width, height }]}>
      {/* 触摸层 */}
      <View
        style={[styles.touchLayer, { width, height }]}
        onTouchStart={handleTouch}
        onTouchMove={handleTouchMove}
      />

      {/* 指针可视化 - 使用 Animated.View 替代 Skia */}
      {active && pointerMode === 'laser' && (
        <Animated.View
          style={[
            styles.laserPointer,
            {
              left: position.x - 8,
              top: position.y - 8,
              opacity: laserOpacity,
            },
          ]}
        />
      )}

      {active && pointerMode === 'spotlight' && (
        <Animated.View
          style={[
            styles.spotlight,
            {
              left: position.x - 60,
              top: position.y - 60,
              width: spotlightRadius,
              height: spotlightRadius,
            },
          ]}
        />
      )}

      {/* 控制按钮 */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.modeButton, active && pointerMode === 'laser' && styles.modeButtonActive]}
          onPress={() => {
            setActive(true);
            setPointerMode('laser');
          }}
        >
          <Text style={styles.modeButtonText}>🔴</Text>
          <Text style={styles.modeButtonLabel}>{t('pointer.laser')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, active && pointerMode === 'spotlight' && styles.modeButtonActive]}
          onPress={() => {
            setActive(true);
            setPointerMode('spotlight');
          }}
        >
          <Text style={styles.modeButtonText}>💡</Text>
          <Text style={styles.modeButtonLabel}>{t('pointer.spotlight')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, !active && styles.modeButtonActive]}
          onPress={() => setActive(false)}
        >
          <Text style={styles.modeButtonText}>✕</Text>
          <Text style={styles.modeButtonLabel}>{t('pointer.disable')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  touchLayer: {
    backgroundColor: 'transparent',
  },
  laserPointer: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff0000',
  },
  spotlight: {
    position: 'absolute',
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  controls: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modeButtonActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
  },
  modeButtonText: {
    fontSize: 14,
  },
  modeButtonLabel: {
    fontSize: 12,
    color: '#fff',
  },
});