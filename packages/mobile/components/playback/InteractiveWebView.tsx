/**
 * InteractiveWebView - 互动内容 WebView 组件
 *
 * 用于 interactive 和 pbl 场景渲染外部互动内容
 * 支持与 WebView 内容的双向通信
 */

import React, { useRef, useCallback, useState, forwardRef, useImperativeHandle, memo } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useHaptics } from '@/lib/hooks/use-haptics';

// 加载状态
type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

// WebView 内部状态
interface WebViewState {
  loadState: LoadState;
  errorMessage: string | null;
  errorCode: string | null;
  retryCount: number;
  canGoBack: boolean;
  canGoForward: boolean;
}

// Props 接口
export interface InteractiveWebViewProps {
  /** 外部 URL */
  url?: string;
  /** 内嵌 HTML 内容 */
  htmlContent?: string;
  /** HTML 基础 URL（用于相对路径解析） */
  baseUrl?: string;
  /** 场景 ID */
  sceneId: string;
  /** 完成回调 */
  onComplete?: (data: any) => void;
  /** 消息回调 */
  onMessage?: (data: any) => void;
  /** 加载完成回调 */
  onLoad?: () => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 样式 */
  style?: StyleProp<ViewStyle>;
  /** 混合内容模式 */
  mixedContentMode?: 'never' | 'always' | 'compatibility';
  /** 是否允许内联媒体播放 */
  allowsInlineMediaPlayback?: boolean;
  /** 是否需要用户操作才能播放媒体 */
  mediaPlaybackRequiresUserAction?: boolean;
}

// Ref 方法接口
export interface InteractiveWebViewRef {
  /** 发送消息到 WebView */
  postMessage: (data: any) => void;
  /** 注入并执行 JavaScript */
  injectJavaScript: (js: string) => void;
  /** 重新加载 */
  reload: () => void;
  /** 返回上一页 */
  goBack: () => void;
  /** 前进到下一页 */
  goForward: () => void;
}

// WebView 消息格式
interface WebViewMessage {
  type: 'message' | 'complete' | 'error' | 'state';
  payload?: any;
}

// 错误信息映射
const ERROR_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  TIMEOUT: '加载超时，请稍后重试',
  HTTP_ERROR: '服务器错误，请稍后重试',
  CONTENT_ERROR: '内容解析错误',
  DEFAULT: '加载失败，请重试',
};

/**
 * InteractiveWebView 组件
 */
export const InteractiveWebView = memo(forwardRef<InteractiveWebViewRef, InteractiveWebViewProps>(
  function InteractiveWebView(
    {
      url,
      htmlContent,
      baseUrl,
      sceneId,
      onComplete,
      onMessage,
      onLoad,
      onError,
      style,
      mixedContentMode = 'compatibility',
      allowsInlineMediaPlayback = true,
      mediaPlaybackRequiresUserAction = false,
    },
    ref
  ) {
    // sceneId 用于日志追踪和调试（保留参数）
    void sceneId;
    const { t } = useI18n();
    const haptics = useHaptics();
    const webViewRef = useRef<WebView>(null);

    // 内部状态
    const [state, setState] = useState<WebViewState>({
      loadState: 'idle',
      errorMessage: null,
      errorCode: null,
      retryCount: 0,
      canGoBack: false,
      canGoForward: false,
    });

    // 注入的 JavaScript 桥接脚本
    const injectedJavaScript = `
      (function() {
        window.nativeBridge = {
          postMessage: function(data) {
            window.ReactNativeWebView.postMessage(JSON.stringify(data));
          }
        };
      })();
      true;
    `;

    // 暴露 ref 方法
    useImperativeHandle(ref, () => ({
      postMessage: (data: any) => {
        webViewRef.current?.postMessage(JSON.stringify(data));
      },
      injectJavaScript: (js: string) => {
        webViewRef.current?.injectJavaScript(js);
      },
      reload: () => {
        webViewRef.current?.reload();
      },
      goBack: () => {
        if (state.canGoBack) {
          webViewRef.current?.goBack();
        }
      },
      goForward: () => {
        if (state.canGoForward) {
          webViewRef.current?.goForward();
        }
      },
    }), [state.canGoBack, state.canGoForward]);

    // 处理 WebView 消息
    const handleMessage = useCallback((event: any) => {
      try {
        const data: WebViewMessage = JSON.parse(event.nativeEvent?.data || '{}');
        switch (data.type) {
          case 'complete':
            haptics.success();
            onComplete?.(data.payload);
            break;
          case 'error':
            onError?.(new Error(data.payload?.message || 'WebView error'));
            break;
          case 'state':
            // 状态同步，可用于更新进度条等
            break;
          default:
            onMessage?.(data);
        }
      } catch (e) {
        console.warn('[InteractiveWebView] Failed to parse message:', e);
      }
    }, [onComplete, onError, onMessage, haptics]);

    // 加载开始
    const handleLoadStart = useCallback(() => {
      setState(prev => ({ ...prev, loadState: 'loading', errorMessage: null }));
    }, []);

    // 加载完成
    const handleLoadEnd = useCallback(() => {
      setState(prev => ({ ...prev, loadState: 'loaded', retryCount: 0 }));
      onLoad?.();
    }, [onLoad]);

    // 加载错误
    const handleError = useCallback((syntheticEvent: any) => {
      const { nativeEvent } = syntheticEvent;
      const errorCode = nativeEvent.code || 'DEFAULT';
      const errorMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.DEFAULT;

      setState(prev => ({
        ...prev,
        loadState: 'error',
        errorCode,
        errorMessage,
      }));

      onError?.(new Error(errorMessage));
    }, [onError]);

    // 导航状态变化
    const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
      setState(prev => ({
        ...prev,
        canGoBack: navState.canGoBack,
        canGoForward: navState.canGoForward,
      }));
    }, []);

    // 重试加载
    const handleRetry = useCallback(() => {
      haptics.light();
      setState(prev => ({
        ...prev,
        loadState: 'loading',
        retryCount: prev.retryCount + 1,
        errorMessage: null,
        errorCode: null,
      }));
      webViewRef.current?.reload();
    }, [haptics]);

    // 在浏览器中打开
    const handleOpenInBrowser = useCallback(() => {
      haptics.light();
      if (url) {
        import('expo-web-browser').then(({ openBrowserAsync }) => {
          openBrowserAsync(url);
        });
      }
    }, [url, haptics]);

    // 渲染加载中界面
    const renderLoading = useCallback(() => (
      <View
        style={styles.loadingOverlay}
        accessibilityRole="text"
        accessibilityLabel={t('accessibility.loading')}
        accessibilityHint={t('accessibility.loadingHint')}
      >
        <ActivityIndicator size="large" color={Colors.primary.main} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    ), [t]);

    // 渲染错误界面
    const renderError = useCallback(() => (
      <View
        style={styles.errorOverlay}
        accessibilityRole="text"
        accessibilityLabel={t('accessibility.error')}
      >
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={Colors.semantic.red}
          accessibilityRole="image"
          accessibilityLabel="错误图标"
        />
        <Text style={styles.errorTitle}>{t('common.error')}</Text>
        <Text style={styles.errorMessage}>
          {state.errorMessage || ERROR_MESSAGES.DEFAULT}
        </Text>
        <View style={styles.errorButtons}>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            accessibilityLabel={t('accessibility.webViewReload')}
            accessibilityHint={t('accessibility.errorHint')}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
          {url && (
            <TouchableOpacity
              style={styles.browserButton}
              onPress={handleOpenInBrowser}
              accessibilityLabel={t('accessibility.webViewOpenBrowser')}
              accessibilityHint="在系统浏览器中打开此内容"
              accessibilityRole="button"
            >
              <Text style={styles.browserButtonText}>{t('webview.openInBrowser')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    ), [t, state.errorMessage, handleRetry, handleOpenInBrowser, url]);

    // 无内容时显示占位界面
    if (!url && !htmlContent) {
      return (
        <View
          style={[styles.placeholder, style]}
          accessibilityRole="text"
          accessibilityLabel={t('accessibility.empty')}
        >
          <Ionicons
            name="code-working"
            size={48}
            color={Colors.neutral.textMuted}
            accessibilityRole="image"
            accessibilityLabel="代码图标"
          />
          <Text style={styles.placeholderTitle}>{t('webview.noContent')}</Text>
          <Text style={styles.placeholderText}>
            {t('webview.noContentHint')}
          </Text>
        </View>
      );
    }

    // 主渲染
    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          source={url ? { uri: url } : { html: htmlContent!, baseUrl }}
          onMessage={handleMessage}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onNavigationStateChange={handleNavigationStateChange}
          startInLoadingState={true}
          renderLoading={renderLoading}
          renderError={renderError}
          injectedJavaScript={injectedJavaScript}
          style={styles.webView}
          mixedContentMode={mixedContentMode}
          allowsInlineMediaPlayback={allowsInlineMediaPlayback}
          mediaPlaybackRequiresUserAction={mediaPlaybackRequiresUserAction}
          originWhitelist={['https://*', 'http://localhost:*', 'http://127.0.0.1:*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          accessibilityLabel={t('accessibility.interactiveContent')}
          accessibilityHint={t('accessibility.interactiveContentHint')}
        />
      </View>
    );
  }
));

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
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral.background,
  },
  loadingText: {
    marginTop: Spacing.sm,
    fontSize: 14,
    color: Colors.neutral.textSecondary,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral.background,
    padding: Spacing.lg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  errorMessage: {
    fontSize: 14,
    color: Colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  retryButton: {
    backgroundColor: Colors.primary.main,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.sm,
  },
  retryButtonText: {
    color: Colors.neutral.white,
    fontSize: 14,
    fontWeight: '600',
  },
  browserButton: {
    backgroundColor: Colors.neutral.backgroundAlt,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.borderAlt,
  },
  browserButtonText: {
    color: Colors.neutral.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
});
