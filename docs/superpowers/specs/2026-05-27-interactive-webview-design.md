---
name: InteractiveWebView Enhancement
description: 完成 InteractiveWebView 组件的完整实现，支持外部 URL 加载、内嵌 HTML 渲染、双向通信、JS 注入、加载状态和错误处理
type: project
created: 2026-05-27
---

# InteractiveWebView 交互增强设计

## 概述

完成 `InteractiveWebView` 组件的完整实现，从当前占位状态升级为功能完整的 WebView 组件，支持教育应用中的互动内容渲染和双向通信。

## 背景

当前 `/packages/mobile/components/playback/InteractiveWebView.tsx` 是一个占位实现，仅有 TODO 注释和基础 UI 框架。需要集成 `react-native-webview` 并实现完整的交互功能。

## 目标

1. 支持外部 URL 加载和内嵌 HTML 渲染
2. 实现原生与 WebView 的双向通信
3. 提供 JS 注入能力
4. 完善加载状态和错误处理
5. 保持代码简洁，与项目现有架构一致

## 技术方案

采用**轻量级封装**方案，直接在现有 `InteractiveWebView.tsx` 中集成功能，保持单一文件结构。

### 依赖

```bash
npm install react-native-webview
```

## 组件接口

### Props

```typescript
interface InteractiveWebViewProps {
  // 内容源（二选一）
  url?: string;              // 外部 URL
  htmlContent?: string;      // 内嵌 HTML
  baseUrl?: string;          // HTML 基础 URL（用于相对路径解析）

  // 标识
  sceneId: string;           // 场景 ID

  // 回调
  onComplete?: (data: any) => void;     // 完成回调
  onMessage?: (data: any) => void;      // 消息回调
  onLoad?: () => void;                  // 加载完成
  onError?: (error: Error) => void;     // 错误回调

  // 样式
  style?: StyleProp<ViewStyle>;

  // 安全配置
  mixedContentMode?: 'never' | 'always' | 'compatibility';
  allowsInlineMediaPlayback?: boolean;  // 是否允许内联媒体播放
  mediaPlaybackRequiresUserAction?: boolean;  // 是否需要用户操作才能播放媒体
}
```

### Ref 方法

```typescript
interface InteractiveWebViewRef {
  postMessage: (data: any) => void;         // 发送消息到 WebView
  injectJavaScript: (js: string) => void;   // 注入并执行 JavaScript
  reload: () => void;                       // 重新加载当前页面
  goBack: () => void;                       // 返回上一页
  goForward: () => void;                    // 前进到下一页
}
```

## 状态管理

### 加载状态

```typescript
type LoadState = 'idle' | 'loading' | 'loaded' | 'error';
```

### 内部状态

```typescript
interface WebViewState {
  loadState: LoadState;
  errorMessage: string | null;
  errorCode: string | null;
  retryCount: number;
  canGoBack: boolean;
  canGoForward: boolean;
}
```

### 状态转换

```
idle ──[start loading]──> loading
loading ──[success]──> loaded
loading ──[failure]──> error
error ──[retry]──> loading
```

## 消息通信协议

### WebView → 原生

WebView 通过 `window.ReactNativeWebView.postMessage()` 发送消息：

```typescript
// 标准消息
{ type: 'message', payload: any }

// 完成事件（互动内容完成）
{ type: 'complete', payload: { score?: number; data?: any } }

// 错误事件
{ type: 'error', payload: { code: string; message: string } }

// 状态同步
{ type: 'state', payload: { progress?: number; title?: string } }
```

### 原生 → WebView

原生通过 `ref.postMessage()` 或 `ref.injectJavaScript()` 发送消息：

```typescript
// 数据同步
{ type: 'sync', payload: any }

// 命令执行
{ type: 'command', action: string; params?: any }

// 状态查询
{ type: 'query', field: string }
```

### WebView 端监听

WebView 内容需要监听 message 事件：

```javascript
document.addEventListener('message', (e) => {
  const data = JSON.parse(e.data);
  switch (data.type) {
    case 'sync': handleSync(data.payload); break;
    case 'command': handleCommand(data.action, data.params); break;
    case 'query': handleQuery(data.field); break;
  }
});
```

## 错误处理

### 错误类型

| 代码 | 描述 | 处理方式 |
|------|------|----------|
| `NETWORK_ERROR` | 网络连接失败 | 显示重试按钮 |
| `TIMEOUT` | 加载超时（默认 30s） | 显示重试按钮 |
| `HTTP_ERROR` | HTTP 错误（404、500 等） | 显示错误信息和重试按钮 |
| `CONTENT_ERROR` | 内容解析错误 | 显示错误信息 |

### 重试策略

- 最大重试次数：3 次
- 重试延迟：指数退避（1s → 2s → 4s）
- 达到最大次数后禁用自动重试，用户可手动重试

### 错误界面

```
┌─────────────────────────┐
│                         │
│         ⚠️              │
│    加载失败              │
│  网络连接异常，请检查网络  │
│                         │
│   [重试] [在浏览器打开]   │
│                         │
└─────────────────────────┘
```

## 加载状态界面

```
┌─────────────────────────┐
│                         │
│                         │
│       ◌ 加载中...        │
│                         │
│                         │
└─────────────────────────┘
```

## 实现要点

### 1. WebView 初始化

```typescript
<WebView
  ref={webViewRef}
  source={url ? { uri: url } : { html: htmlContent, baseUrl }}
  onMessage={handleMessage}
  onLoadStart={handleLoadStart}
  onLoadEnd={handleLoadEnd}
  onError={handleError}
  onNavigationStateChange={handleNavigationChange}
  startInLoadingState={true}
  renderLoading={renderLoading}
  renderError={renderError}
  style={styles.webView}
  mixedContentMode={mixedContentMode}
  allowsInlineMediaPlayback={allowsInlineMediaPlayback}
  mediaPlaybackRequiresUserAction={mediaPlaybackRequiresUserAction}
  originWhitelist={['*']}  // 根据安全需求调整
/>
```

### 2. 消息处理

```typescript
const handleMessage = useCallback((event: WebViewMessageEvent) => {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    switch (data.type) {
      case 'complete':
        onComplete?.(data.payload);
        break;
      case 'error':
        onError?.(new Error(data.payload.message));
        break;
      case 'state':
        // 处理状态同步
        break;
      default:
        onMessage?.(data);
    }
  } catch (e) {
    console.warn('[InteractiveWebView] Failed to parse message:', e);
  }
}, [onComplete, onError, onMessage]);
```

### 3. JS 注入

```typescript
const injectJavaScript = useCallback((js: string) => {
  webViewRef.current?.injectJavaScript(js);
}, []);

// 使用示例：获取 WebView 标题
injectJavaScript(`
  (function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'state',
      payload: { title: document.title }
    }));
  })();
`);
```

### 4. 注入初始脚本

在 WebView 加载时注入通信桥接脚本：

```typescript
const injectedJavaScript = `
  window.nativeBridge = {
    postMessage: (data) => {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
  };
  true;  // 必须返回 true
`;
```

## 安全考虑

1. **内容隔离**：使用 `originWhitelist` 限制允许的源
2. **混合内容**：通过 `mixedContentMode` 控制 HTTPS 页面加载 HTTP 资源
3. **媒体播放**：控制是否允许自动播放媒体
4. **JS 注入**：仅注入必要的桥接脚本，避免注入不可信代码

## 测试计划

### 单元测试

- [x] 消息解析函数测试
- [x] 状态转换逻辑测试
- [x] 重试策略测试
- [x] 错误码映射测试

### 集成测试

- [x] 加载外部 URL（成功、失败、超时）
- [x] 渲染内嵌 HTML
- [x] 双向消息通信
- [x] JS 注入执行
- [x] 重试机制

### 手动测试场景

1. 加载正常 URL
2. 加载不存在的 URL（404）
3. 断网情况下加载
4. 服务器错误（500）
5. 发送消息到 WebView
6. 接收 WebView 消息
7. 注入 JS 获取状态
8. 横竖屏切换
9. 低端设备性能

## 文件清单

| 文件 | 变更 |
|------|------|
| `packages/mobile/components/playback/InteractiveWebView.tsx` | 重写 |
| `packages/mobile/package.json` | 添加 react-native-webview 依赖 |

## 预估工作量

- 实现：2-3 小时
- 测试：1 小时
- 总计：3-4 小时

## 验收标准

1. 可以加载外部 URL 和内嵌 HTML
2. 加载过程中显示加载指示器
3. 加载失败显示错误界面，可重试
4. 可以发送和接收消息
5. 可以注入 JS 脚本
6. 通过所有测试用例
