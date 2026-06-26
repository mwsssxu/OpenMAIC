# 支付宝 H5 支付集成文档（公钥模式 + AES 内容加密）

> APPID: 2021006168684071 | 出品方: 南京帕兰数字科技有限公司

---

## 一、应用信息

| 项目 | 值 |
|------|-----|
| **APPID** | `2021006168684071` |
| **应用类型** | 移动应用 |
| **加签方式** | 公钥模式（RSA2） |
| **内容加密** | AES-128-CBC |
| **SDK** | alipay-sdk-python（支付宝官方 SDK） |
| **SDK 类** | `DefaultAlipayClient` + `AlipayClientConfig`（官方 SDK） |

---

## 二、密钥文件

密钥文件存放路径：`packages/server-python/certs/alipay/`（.gitignore 保护）

| 文件 | 用途 |
|------|------|
| `appPrivateKey.txt` | 应用私钥（配置到 .env 的 ALIPAY_APP_PRIVATE_KEY） |

支付宝公钥通过开放平台获取，配置到 .env 的 ALIPAY_PUBLIC_KEY。

### 密钥对应关系

| 密钥 | 说明 | 存放位置 |
|------|------|---------|
| 应用公钥 | 上传到支付宝开放平台 | 密钥工具生成，已上传 |
| 应用私钥 | 代码签名用 | .env → ALIPAY_APP_PRIVATE_KEY |
| 支付宝公钥 | 验证回调签名用 | .env → ALIPAY_PUBLIC_KEY |
| AES 密钥 | 接口内容加密 | .env → ALIPAY_AES_KEY |

---

## 三、环境变量配置

### .env 文件

```bash
# 支付宝（公钥模式 + AES内容加密，APPID: 2021006168684071）
ALIPAY_APP_ID=2021006168684071
ALIPAY_APP_PRIVATE_KEY=MIIEvgIBADANBgkqhkiG...    # 应用私钥（裸 base64，不含 PEM 标记）
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG9w0BAQ...        # 支付宝公钥（裸 base64，不含 PEM 标记）
ALIPAY_AES_KEY=                                    # AES内容加密密钥（base64编码，开放平台配置后获取）
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
  - ALIPAY_PUBLIC_KEY=${ALIPAY_PUBLIC_KEY}
  - ALIPAY_AES_KEY=${ALIPAY_AES_KEY}
  - ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
  - ALIPAY_NOTIFY_URL=${ALIPAY_NOTIFY_URL}
  - ALIPAY_RETURN_URL=${ALIPAY_RETURN_URL}
  - ALIPAY_SANDBOX=false
```

### 沙箱配置

沙箱测试时修改以下变量：

```bash
ALIPAY_SANDBOX=true
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
```

> 沙箱环境使用独立的沙箱 APPID 和密钥。

---

## 四、AES 内容加密

### 加密规格

| 项目 | 值 |
|------|-----|
| 算法 | AES-128-CBC |
| 密钥 | 16 字节（base64 编码，开放平台配置后获取） |
| IV | 16 字节全零 (0x00 * 16) |
| 填充 | PKCS7 |
| 输出 | base64 编码 |

### 加密流程

1. 构建 biz_content JSON 字符串
2. AES-128-CBC 加密 JSON 字符串
3. base64 编码加密结果
4. 将加密后的字符串作为 biz_content 值
5. 请求参数添加 encrypt_type=AES
6. RSA2 签名所有参数

### 代码实现

```python
# 加密
cipher = AES.new(key, AES.MODE_CBC, iv)
encrypted = cipher.encrypt(pad(plaintext.encode(), AES.block_size))
result = base64.b64encode(encrypted).decode()

# 解密（如需解析API响应）
cipher = AES.new(key, AES.MODE_CBC, iv)
decrypted = unpad(cipher.decrypt(base64.b64decode(ciphertext)), AES.block_size)
```

> 注意：异步通知（notify_url）不使用 AES 加密，回调验签无需解密。

---

## 五、网关地址规范

| 环境 | 网关地址 |
|------|---------|
| **生产** | `https://openapi.alipay.com/gateway.do` |
| **沙箱** | `https://openapi-sandbox.dl.alipaydev.com/gateway.do` |

代码中 `_get_gateway()` 根据 `ALIPAY_SANDBOX` 开关自动选择。

---

## 六、回调地址

### 异步通知（notify_url）

| 项目 | 值 |
|------|-----|
| **用途** | 支付宝服务器主动POST通知支付结果 |
| **要求** | 公网可达 HTTPS 端点 |
| **路由** | `/api/payment/callback/alipay` |
| **完整URL** | `https://api.palansoft.cn/api/payment/callback/alipay` |

验签流程：
1. 收到 POST form 数据（明文，无 AES 加密）
2. 用支付宝公钥验 RSA2 签名
3. 检查 `trade_status == TRADE_SUCCESS`
4. 金额校验（回调金额 == 订单金额）
5. 幂等处理（已 paid 的订单不重复入账）
6. 返回 `"success"`

### 同步跳转（return_url）

| 项目 | 值 |
|------|-----|
| **用途** | 用户支付完成后浏览器跳转 |
| **路由** | `/payment/return` |
| **完整URL** | `https://api.palansoft.cn/payment/return` |

---

## 七、支付流程

```
App → POST /payment/create-order (method=alipay)
    ← { alipay_url: "https://openapi.alipay.com/gateway.do?..." }

App → WebBrowser.openBrowserAsync(alipay_url)
    用户完成支付

支付宝 → POST /api/payment/callback/alipay (异步通知，明文)
    ① RSA2 公钥验签
    ② 检查 trade_status = TRADE_SUCCESS
    ③ 金额校验 (回调金额 == 订单金额)
    ④ 入账 Token / 激活订阅
    ← "success"

App → GET /payment/orders/{order_id} (轮询，每2秒，最多10次)
    ← { status: "paid" }
```

---

## 八、安全措施

1. **RSA2 公钥签名验证**：使用支付宝公钥验签，伪造请求被拒绝
2. **AES 内容加密**：biz_content 使用 AES-128-CBC 加密，防止中间人窃取订单信息
3. **金额校验**：回调 `total_amount` 必须与数据库订单 `amount` 一致
4. **trade_status 检查**：只处理 `TRADE_SUCCESS` / `TRADE_FINISHED`
5. **幂等处理**：`process_payment_success` 检查 `status == 'paid'` 防重复入账
6. **生产强制配置**：未配置密钥时返回 503，回调返回 `"fail"`
7. **开发环境回退**：`TESTING_MODE=true` 且未配置密钥时，回退到 mock 支付

---

## 九、代码文件

### 后端（packages/server-python）

| 文件 | 职责 |
|------|------|
| `app/core/config.py` | ALIPAY_* 配置项（含 ALIPAY_AES_KEY） |
| `app/services/alipay.py` | AliPay 客户端封装 + AES 加密 + wap.pay URL 生成 + 回调验签 |
| `app/routes/payment.py` | 支付下单 + 回调处理路由 |
| `certs/alipay/appPrivateKey.txt` | 应用私钥（.gitignore 保护） |
| `requirements.txt` | `alipay-sdk-python>=3.7.0`, `rsa>=4.9`, `pycryptodome>=3.20` |

### 移动端（packages/mobile）

| 文件 | 职责 |
|------|------|
| `lib/api-client/index.ts` | `createPaymentOrder()` + `getPaymentOrderDetail()` |
| `app/(tabs)/payment.tsx` | 支付宝 H5 支付流程 + 订单状态轮询 |

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

- [支付宝开放平台 - 公钥模式](https://opendocs.alipay.com/common/02kip1)
- [手机网站支付 API (alipay.trade.wap.pay)](https://opendocs.alipay.com/open/02ivbs)
- [接口内容加密方式](https://opendocs.alipay.com/common/02mse8)
- [python-alipay-sdk GitHub](https://github.com/fzlee/alipay)

---

*文档更新时间: 2026-06-26*
*出品方: 南京帕兰数字科技有限公司*
