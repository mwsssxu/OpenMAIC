# 支付宝 H5 支付集成文档（证书模式）

> APPID: 2021006168684071 | 出品方: 南京帕兰数字科技有限公司

---

## 一、应用信息

| 项目 | 值 |
|------|-----|
| **APPID** | `2021006168684071` |
| **加签方式** | 证书模式（RSA2） |
| **SDK** | python-alipay-sdk==3.1.0 |
| **SDK 类** | `DCAliPay`（数字证书版） |

---

## 二、证书文件

证书文件存放路径：`packages/server-python/certs/alipay/`

| 文件 | 用途 | Docker 容器内路径 |
|------|------|-------------------|
| `appCertPublicKey.crt` | 应用公钥证书 | `/app/certs/alipay/appCertPublicKey.crt` |
| `alipayCertPublicKey_RSA2.crt` | 支付宝公钥证书 | `/app/certs/alipay/alipayCertPublicKey_RSA2.crt` |
| `alipayRootCert.crt` | 支付宝根证书 | `/app/certs/alipay/alipayRootCert.crt` |
| `appPrivateKey.txt` | 应用私钥（配置到 .env） | 不挂载到容器，通过环境变量传入 |

> ⚠️ 证书目录已加入 `.gitignore`，不会提交到 Git 仓库。

---

## 三、环境变量配置

### .env 文件

```bash
# 支付宝（证书模式，APPID: 2021006168684071）
ALIPAY_APP_ID=2021006168684071
ALIPAY_APP_PRIVATE_KEY=MIIEvgIBADANBgkqhkiG...    # appPrivateKey.txt 的内容（裸 base64，不含 PEM 标记）
ALIPAY_APP_CERT_PATH=certs/alipay/appCertPublicKey.crt
ALIPAY_PUBLIC_CERT_PATH=certs/alipay/alipayCertPublicKey_RSA2.crt
ALIPAY_ROOT_CERT_PATH=certs/alipay/alipayRootCert.crt
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_NOTIFY_URL=https://api.palansoft.cn/api/payment/callback/alipay
ALIPAY_RETURN_URL=https://api.palansoft.cn/payment/return
ALIPAY_SANDBOX=false
```

### docker-compose.yml 中已配置

```yaml
environment:
  - ALIPAY_APP_ID=2021006168684071
  - ALIPAY_APP_PRIVATE_KEY=${ALIPAY_APP_PRIVATE_KEY}
  - ALIPAY_APP_CERT_PATH=/app/certs/alipay/appCertPublicKey.crt
  - ALIPAY_PUBLIC_CERT_PATH=/app/certs/alipay/alipayCertPublicKey_RSA2.crt
  - ALIPAY_ROOT_CERT_PATH=/app/certs/alipay/alipayRootCert.crt
  - ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
  - ALIPAY_NOTIFY_URL=${ALIPAY_NOTIFY_URL}
  - ALIPAY_RETURN_URL=${ALIPAY_RETURN_URL}
  - ALIPAY_SANDBOX=false
volumes:
  - ./packages/server-python/certs:/app/certs:ro
```

### 沙箱配置

沙箱测试时修改以下变量：

```bash
ALIPAY_SANDBOX=true
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
```

> 沙箱环境使用独立的沙箱 APPID 和密钥，不是 2021006168684071。

---

## 四、网关地址规范

| 环境 | 网关地址 |
|------|---------|
| **生产** | `https://openapi.alipay.com/gateway.do` |
| **沙箱** | `https://openapi-sandbox.dl.alipaydev.com/gateway.do` |

代码中 `_get_gateway()` 根据 `ALIPAY_SANDBOX` 开关自动选择，`ALIPAY_GATEWAY` 仅生产环境生效。

---

## 五、回调地址

### 异步通知（notify_url）

| 项目 | 值 |
|------|-----|
| **用途** | 支付宝服务器主动POST通知支付结果 |
| **要求** | 公网可达 HTTPS 端点 |
| **路由** | `/api/payment/callback/alipay` |
| **完整URL** | `https://api.palansoft.cn/api/payment/callback/alipay` |

验签流程：
1. 收到 POST form 数据
2. 用支付宝公钥证书验 RSA2 签名
3. 检查 `trade_status == TRADE_SUCCESS`
4. 金额校验（回调金额 == 订单金额）
5. 幂等处理（已 paid 的订单不重复入账）
6. 返回 `"success"`（支付宝收到 success 后停止重试）

### 同步跳转（return_url）

| 项目 | 值 |
|------|-----|
| **用途** | 用户支付完成后浏览器跳转 |
| **路由** | `/payment/return` |
| **完整URL** | `https://api.palansoft.cn/payment/return` |

---

## 六、代码文件

### 后端（packages/server-python）

| 文件 | 职责 |
|------|------|
| `app/core/config.py` | 9 个 ALIPAY_* 配置项 |
| `app/services/alipay.py` | DCAliPay 客户端封装（wap.pay URL 生成 + 回调验签） |
| `app/routes/payment.py` | 支付下单 + 回调处理路由 |
| `certs/alipay/` | 证书三件套（.gitignore 保护） |
| `requirements.txt` | `python-alipay-sdk==3.1.0` |

### 移动端（packages/mobile）

| 文件 | 职责 |
|------|------|
| `lib/api-client/index.ts` | `createPaymentOrder()` + `getPaymentOrderDetail()` |
| `app/(tabs)/payment.tsx` | 支付宝 H5 支付流程 + 订单状态轮询 |

---

## 七、支付流程

```
App → POST /payment/create-order (method=alipay)
    ← { alipay_url: "https://openapi.alipay.com/gateway.do?..." }

App → WebBrowser.openBrowserAsync(alipay_url)
    用户完成支付

支付宝 → POST /api/payment/callback/alipay (异步通知)
    ① DCAliPay 证书验签 (RSA2)
    ② 检查 trade_status = TRADE_SUCCESS
    ③ 金额校验 (回调金额 == 订单金额)
    ④ 入账 Token / 激活订阅
    ← "success"

App → GET /payment/orders/{order_id} (轮询，每2秒，最多10次)
    ← { status: "paid" }
```

---

## 八、安全措施

1. **RSA2 证书签名验证**：使用支付宝公钥证书验签，伪造请求被拒绝
2. **金额校验**：回调 `total_amount` 必须与数据库订单 `amount` 一致
3. **trade_status 检查**：只处理 `TRADE_SUCCESS` / `TRADE_FINISHED`
4. **幂等处理**：`process_payment_success` 检查 `status == 'paid'` 防重复入账
5. **生产强制配置**：未配置证书时返回 503，回调返回 `"fail"`
6. **开发环境回退**：`TESTING_MODE=true` 且未配置密钥时，回退到 mock 支付
7. **证书文件权限**：部署时 `chmod 600 certs/alipay/*.crt`

---

## 九、依赖安装

```bash
cd packages/server-python
pip install python-alipay-sdk==3.1.0
```

> 注意：`python-alipay-sdk` 依赖 `pyOpenSSL`。如果遇到 `AttributeError: module 'lib' has no attribute 'GEN_EMAIL'`，需升级 pyOpenSSL：
> ```bash
> pip install -U pyOpenSSL>=22.0.0
> ```

---

## 十、开发调试

### 本地开发（无支付宝配置）

- `TESTING_MODE=true` 时，支付宝下单返回 mock URL
- 移动端检测到 mock URL 走模拟支付流程（调用 `/payment/mock-pay/{order_id}`）

### 沙箱测试

1. 在 [沙箱环境](https://openhome.alipay.com/develop/sandbox/app) 获取沙箱 APPID 和密钥
2. 配置 `ALIPAY_SANDBOX=true` + 沙箱网关 URL
3. 使用沙箱版支付宝 APP 完成支付

---

## 十一、参考文档

- [支付宝开放平台 - 证书模式](https://opendocs.alipay.com/common/02kdpl)
- [手机网站支付 API (alipay.trade.wap.pay)](https://opendocs.alipay.com/open/02ivbs)
- [python-alipay-sdk GitHub](https://github.com/fzlee/alipay)
- [支付宝异步通知说明](https://opendocs.alipay.com/open/204/105301)

---

*文档更新时间: 2026-06-26*
*出品方: 南京帕兰数字科技有限公司*
