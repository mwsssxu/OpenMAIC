# 侧伴(CeBan) 移动应用支付配置信息

> 用于微信支付、支付宝等第三方支付平台的应用配置

---

## 1. Android 应用

| 项目 | 值 |
|------|-----|
| **应用包名** | `com.openmaic.mobile` |
| **应用签名 (SHA1)** | `17:46:F9:28:A6:35:55:7A:03:DD:20:56:7E:E6:0C:24:B4:88:45:BA` |
| **应用签名 (MD5)** | `22:38:15:6A:E7:4E:C2:4B:ED:E7:93:F8:3E:49:E0:74` |
| **应用签名 (SHA256)** | `7E:4F:03:CA:F5:E8:DC:51:A7:A0:02:58:D5:E4:EC:8E:34:D3:4F:93:B7:83:98:CA:75:70:F0:A1:06:04:F7:6A` |

### Keystore 文件信息

| 项目 | 值 |
|------|-----|
| **文件路径** | `packages/mobile/android/ceban-release.keystore` |
| **别名 (alias)** | `ceban-key` |
| **密码 (storepass/keypass)** | `ceban2026` |
| **证书所有者** | CN=南京帕兰数字科技有限公司, OU=移动开发, O=南京帕兰数字科技有限公司, L=南京, ST=江苏, C=CN |
| **有效期** | 2026-06-24 至 2126-05-31 (100年) |
| **密钥算法** | RSA 2048-bit, SHA384withRSA |

> ⚠️ keystore 文件和密码是应用签名的核心凭据，切勿提交到 Git 仓库或泄露给第三方。

### 微信开放平台填写说明

在微信开放平台 (open.weixin.qq.com) 创建移动应用时：
- **应用包名**: 填 `com.openmaic.mobile`
- **应用签名**: 填 MD5（去掉冒号，全小写）= `2238156ae74ec24bede793f83e49e074`

### 支付宝开放平台填写说明

在支付宝开放平台 (open.alipay.com) 创建应用时：
- **Android 应用包名**: `com.openmaic.mobile`
- **Android 应用签名**: 填 SHA1 = `17:46:F9:28:A6:35:55:7A:03:DD:20:56:7E:E6:0C:24:B4:88:45:BA`

---

## 2. iOS 应用

| 项目 | 值 |
|------|-----|
| **Bundle ID** | `com.openmaic.mobile` |
| **Team ID** | 待确认（Apple Developer 账号） |
| **App ID** | 待确认（Apple Developer 后台创建后获取） |

### Universal Links

> Universal Links 用于支付完成后从微信/支付宝跳回 App，必须配置 HTTPS 域名。

| 项目 | 值 |
|------|-----|
| **Universal Link** | `https://[待确认域名]/app/` |
| **apple-app-site-association 路径** | `https://[待确认域名]/.well-known/apple-app-site-association` |

#### apple-app-site-association 文件内容

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "[Team ID].com.openmaic.mobile",
        "paths": ["/app/*"]
      }
    ]
  }
}
```

#### 微信支付 Universal Link 配置

- 微信开放平台填写: `https://[待确认域名]/app/`
- iOS 项目 Associated Domains 添加: `applinks:[待确认域名]`

#### 支付宝 Universal Link 配置

- 支付宝开放平台填写: `https://[待确认域名]/app/`
- iOS 项目 Associated Domains 添加: `applinks:[待确认域名]`

---

## 3. 域名确认（待办）

> 以下域名需要确认后替换文档中的 `[待确认域名]` 占位符：

- [ ] 注册/确认正式域名（建议 `ceban.com.cn` 或 `ceban.cn`）
- [ ] 域名备案（国内服务器必须）
- [ ] 配置 HTTPS 证书
- [ ] 部署 `apple-app-site-association` 文件到服务器 `/.well-known/` 目录
- [ ] 确认 Apple Developer Team ID

---

## 4. 待办清单

### Android
- [x] 生成 release keystore
- [x] 提取 SHA1 / MD5 / SHA256 签名
- [ ] 在 app.json 中配置 Android signing config
- [ ] 微信开放平台注册移动应用
- [ ] 支付宝开放平台注册应用
- [ ] 配置微信支付回调地址

### iOS
- [ ] Apple Developer 后台创建 App ID（开启 Associated Domains capability）
- [ ] 创建 Provisioning Profile
- [ ] 配置 Associated Domains entitlement
- [ ] 微信开放平台注册 iOS 应用（填写 Bundle ID + Universal Link）
- [ ] 支付宝开放平台注册 iOS 应用（填写 Bundle ID + Universal Link）

### 后端
- [ ] 实现微信支付统一下单接口
- [ ] 实现微信支付回调通知处理
- [ ] 实现支付宝支付下单接口
- [ ] 实现支付宝支付回调通知处理
- [ ] 配置支付回调 URL 路由（`/api/payment/callback/wechat`、`/api/payment/callback/alipay`）

---

## 5. App Scheme（应用内跳转）

| 项目 | 值 |
|------|-----|
| **URL Scheme** | `openmaic` |

> 用于应用内深链接跳转，不适用于支付回跳（支付回跳必须用 Universal Links）。

---

*文档创建时间: 2026-06-24*
*出品方: 南京帕兰数字科技有限公司*
