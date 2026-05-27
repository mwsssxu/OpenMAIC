# InteractiveWebView 交互增强实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 InteractiveWebView 组件的完整实现，支持外部 URL 加载、内嵌 HTML 渲染、双向通信、JS 注入、加载状态和错误处理。

**Architecture:** 轻量级封装方案，直接在现有 `InteractiveWebView.tsx` 中集成 `react-native-webview`，保持单一文件结构。使用 React hooks 管理状态，通过 ref 暴露方法。

**Tech Stack:** React Native, react-native-webview, TypeScript, expo-haptics

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/mobile/components/playback/InteractiveWebView.tsx` | 重写 | WebView 主组件，包含状态管理、消息处理、错误界面 |
| `packages/mobile/package.json` | 修改 | 添加 react-native-webview 依赖 |

---

### Task 1: 安装 react-native-webview 依赖

**Files:**
- Modify: `packages/mobile/package.json`

- [ ] **Step 1: 添加 react-native-webview 依赖**

```bash
cd packages/mobile && npm install react-native-webview
```

- [ ] **Step 2: 验证依赖安装成功**

Run: `grep "react-native-webview" packages/mobile/package.json`
Expected: 输出包含 `"react-native-webview": "13.x.x"` 或类似版本号

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/package.json packages/mobile/package-lock.json
git commit -m "chore(mobile): add react-native-webview dependency

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: 定义类型和接口

**Files:**
- Rewrite: `packages/mobile/components/playback/InteractiveWebView.tsx`

- [ ] **Step 1: 编写类型定义和 imports**

在文件开头添加完整的类型定义：

```typescript
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
```

---

### Task 3: 实现组件主体和状态管理

**Files:**
- Rewrite: `packages/mobile/components/playback/InteractiveWebView.tsx`

- [ ] **Step 1: 实现组件主体**

在类型定义后添加组件实现：

```typescript
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

    // ... 继续下一部分
```

---

### Task 4: 实现消息处理和事件回调

**Files:**
- Rewrite: `packages/mobile/components/playback/InteractiveWebView.tsx`

- [ ] **Step 1: 在组件主体后添加消息处理函数**

```typescript
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
        // 使用 Linking.openURL 或 expo-web-browser
        import('expo-web-browser').then(({ openBrowserAsync }) => {
          openBrowserAsync(url);
        });
      }
    }, [url, haptics]);
```

---

### Task 5: 实现渲染界面

**Files:**
- Rewrite: `packages/mobile/components/playback/InteractiveWebView.tsx`

- [ ] **Step 1: 添加渲染函数**

```typescript
    // 渲染加载中界面
    const renderLoading = useCallback(() => (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={Colors.primary.main} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    ), [t]);

    // 渲染错误界面
    const renderError = useCallback(() => (
      <View style={styles.errorOverlay}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.semantic.red} />
        <Text style={styles.errorTitle}>{t('common.error')}</Text>
        <Text style={styles.errorMessage}>
          {state.errorMessage || ERROR_MESSAGES.DEFAULT}
        </Text>
        <View style={styles.errorButtons}>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
          {url && (
            <TouchableOpacity style={styles.browserButton} onPress={handleOpenInBrowser}>
              <Text style={styles.browserButtonText}>在浏览器中打开</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    ), [t, state.errorMessage, handleRetry, handleOpenInBrowser, url]);

    // 无内容时显示占位界面
    if (!url && !htmlContent) {
      return (
        <View style={[styles.placeholder, style]}>
          <Ionicons name="code-working" size={48} color={Colors.neutral.textMuted} />
          <Text style={styles.placeholderTitle}>互动内容</Text>
          <Text style={styles.placeholderText}>
            此场景包含互动内容，需要在支持的环境中打开
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
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    );
  }
));
```

---

### Task 6: 添加样式定义

**Files:**
- Rewrite: `packages/mobile/components/playback/InteractiveWebView.tsx`

- [ ] **Step 1: 在组件后添加样式**

```typescript
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
```

---

### Task 7: 添加 i18n 翻译键

**Files:**
- Modify: `packages/mobile/lib/i18n/index.ts`

- [ ] **Step 1: 添加 WebView 相关翻译**

在 `common` 部分已有 `loading`, `error`, `retry`。添加 `webview` 部分：

找到 `translations` 对象，在 `common` 后添加：

```typescript
    // WebView
    webview: {
      loadingContent: '加载互动内容...',
      noContent: '暂无互动内容',
      openInBrowser: '在浏览器中打开',
      networkError: '网络连接失败，请检查网络设置',
      timeoutError: '加载超时，请稍后重试',
      serverError: '服务器错误，请稍后重试',
      contentError: '内容解析错误',
    },
```

在 `en-US` 翻译部分也添加对应英文：

```typescript
    webview: {
      loadingContent: 'Loading interactive content...',
      noContent: 'No interactive content',
      openInBrowser: 'Open in Browser',
      networkError: 'Network connection failed. Please check your network settings.',
      timeoutError: 'Loading timeout. Please try again later.',
      serverError: 'Server error. Please try again later.',
      contentError: 'Content parsing error.',
    },
```

- [ ] **Step 2: Commit**

```bash
git add packages/mobile/lib/i18n/index.ts
git commit -m "feat(mobile): add i18n keys for InteractiveWebView

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: 提交完整组件

**Files:**
- Rewrite: `packages/mobile/components/playback/InteractiveWebView.tsx`

- [ ] **Step 1: 验证组件完整性**

确保所有部分已整合到一个完整文件中，文件结构为：
1. imports
2. 类型定义
3. 错误消息映射
4. 组件实现
5. 样式定义

- [ ] **Step 2: Commit**

```bash
git add packages/mobile/components/playback/InteractiveWebView.tsx
git commit -m "feat(mobile): complete InteractiveWebView implementation

- Support external URL loading and embedded HTML rendering
- Implement bidirectional communication with WebView
- Add JS injection capability via ref
- Add loading state indicator
- Add error handling with retry mechanism

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: 验证 TypeScript 编译

- [ ] **Step 1: 运行 TypeScript 编译检查**

Run: `cd packages/mobile && npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 2: 修复任何编译错误**

如果有类型错误，根据错误信息修复。

---

### Task 10: 代码审查

- [ ] **Step 1: 检查代码质量**

- 确保所有 imports 正确
- 确保类型定义完整
- 确保样式使用 theme 常量
- 确保回调函数使用 useCallback
- 确保 ref 方法正确暴露

- [ ] **Step 2: 最终 commit**

```bash
git add -A
git commit -m "chore(mobile): finalize InteractiveWebView implementation

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] 可以加载外部 URL
- [ ] 可以渲染内嵌 HTML
- [ ] 加载过程中显示加载指示器
- [ ] 加载失败显示错误界面
- [ ] 点击重试可以重新加载
- [ ] 可以通过 ref.postMessage 发送消息
- [ ] 可以通过 ref.injectJavaScript 注入脚本
- [ ] TypeScript 编译无错误
