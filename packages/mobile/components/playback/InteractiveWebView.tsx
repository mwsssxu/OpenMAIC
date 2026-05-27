/**
 * InteractiveWebView - 互动内容 WebView 组件
 *
 * 用于 interactive 和 pbl 场景渲染外部互动内容
 * 支持与 WebView 内容的双向通信
 *
 * 注意：React Native WebView 需要额外安装依赖
 * npm install react-native-webview
 */

import React, { useRef, useCallback, memo } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';

interface InteractiveWebViewProps {
  /** 互动内容 URL */
  url?: string;
  /** HTML 内容（内嵌） */
  htmlContent?: string;
  /** 场景 ID */
  sceneId: string;
  /** 完成回调 */
  onComplete?: (data: any) => void;
  /** 消息回调（接收 WebView 消息） */
  onMessage?: (data: any) => void;
}

/**
 * InteractiveWebView 组件
 *
 * 渲染互动内容，支持：
 * 1. 外部 URL 加载
 * 2. 内嵌 HTML 渲染
 * 3. 双向通信
 *
 * 当前为占位实现，后续可集成 react-native-webview
 */
export const InteractiveWebView = memo(function InteractiveWebView({
  url,
  htmlContent,
  sceneId,
  onComplete,
  onMessage,
}: InteractiveWebViewProps) {
  // WebView ref (for future use)
  const webViewRef = useRef<any>(null);

  // 处理 WebView 消息
  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent?.data || '{}');
      if (data.type === 'complete') {
        onComplete?.(data.payload);
      } else {
        onMessage?.(data);
      }
    } catch (e) {
      console.warn('[InteractiveWebView] Failed to parse message:', e);
    }
  }, [onComplete, onMessage]);

  // 发送消息到 WebView
  const postMessage = useCallback((data: any) => {
    webViewRef.current?.postMessage(JSON.stringify(data));
  }, []);

  // 当前实现：显示占位 UI
  // TODO: 集成 react-native-webview 后替换为实际 WebView
  if (!url && !htmlContent) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="code-working" size={48} color={Colors.neutral.textMuted} />
        <Text style={styles.placeholderTitle}>互动内容</Text>
        <Text style={styles.placeholderText}>
          此场景包含互动内容，需要在支持的环境中打开
        </Text>
        <TouchableOpacity style={styles.openButton}>
          <Text style={styles.openButtonText}>在浏览器中打开</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Loading indicator */}
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={Colors.primary.main} />
        <Text style={styles.loadingText}>加载互动内容...</Text>
      </View>

      {/*
        TODO: 集成 react-native-webview
        <WebView
          ref={webViewRef}
          source={url ? { uri: url } : { html: htmlContent }}
          onMessage={handleMessage}
          style={styles.webView}
          startInLoadingState={true}
          renderLoading={() => <ActivityIndicator />}
        />
      */}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral.white,
    borderRadius: Rounded.lg,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.neutral.card,
    borderRadius: Rounded.lg,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  openButton: {
    backgroundColor: Colors.primary.main,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.md,
  },
  openButtonText: {
    color: Colors.neutral.white,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral.background,
  },
  loadingText: {
    marginTop: Spacing.sm,
    fontSize: 14,
    color: Colors.neutral.textSecondary,
  },
});
