# 支付宝 H5 支付集成文档

## 一、开放平台应用配置（你需要做的）

### 1. 创建应用

登录 [支付宝开放平台控制台](https://openhome.alipay.com/develop/manage)（需实名认证的支付宝账号）。

- 应用类型：**网页/移动应用**
- 应用名称：侧伴（需通过审核规范，不能含"支付宝"等字样）
- 应用图标：建议 320×320，<3M

### 2. 配置接口加签方式（必填）

在「开发设置 > 接口加签方式」中：

- 选择 **公钥模式**（非公钥证书模式）
- 使用 [支付宝密钥生成工具](https://opendocs.alipay.com/common/02kipl) 生成 RSA2 密钥对
- 上传**应用公钥**到开放平台
- 保存**应用私钥**（填入 `ALIPAY_APP_PRIVATE_KEY` 环境变量）
- 复制开放平台返回的**支付宝公钥**（填入 `ALIPAY_PUBLIC_KEY` 环境变量）

### 3. 配置回调地址

| 字段 | 填写内容 | 说明 |
|------|---------|------|
| 授权回调地址 | `https://你的域名/payment/callback/alipay` | 用户支付后同步跳转（可选） |
| 应用网关 URL | `https://你的域名/api/payment/callback/alipay` | 异步通知地址（必填，公网可达） |

**注意**：异步通知 URL 也在代码中通过 `ALIPAY_NOTIFY_URL` 环境变量传入，两者需一致。

### 4. 开通产品

在 [商家平台 > 产品中心](http://b.alipay.com) 开通：
- **手机网站支付**（alipay.trade.wap.pay）

### 5. 上线应用

- 填写应用名称和图标后提交审核
- 审核通过后应用状态变为「已上线」，才能线上调用接口
- 记录 **APPID**（填入 `ALIPAY_APP_ID`）

---

## 二、环境变量配置

在 `.env` 文件（或 docker-compose.yml 的 environment）中添加：

```bash
# 支付宝配置
ALIPAY_APP_ID=2021000XXXXXXXXX           # 开放平台应用 APPID
ALIPAY_APP_PRIVATE_KEY=MIIEvQIBADANB...   # 应用私钥（裸 base64，不含 PEM 标记）
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG...     # 支付宝公钥（裸 base64，不含 PEM 标记）
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do    # 生产网关
ALIPAY_NOTIFY_URL=https://api.ceban.com/api/payment/callback/alipay  # 异步回调（公网可达）
ALIPAY_RETURN_URL=https://api.ceban.com/payment/return   # 同步跳转（支付完成后浏览器跳转）
ALIPAY_SANDBOX=false                      # 沙箱模式（开发时设 true）
```

### 沙箱配置

沙箱测试时：
- `ALIPAY_SANDBOX=true`
- `ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do`
- 使用沙箱版支付宝 APP 扫码支付

---

## 三、代码变更清单

### 后端（packages/server-python）

| 文件 | 变更 |
|------|------|
| `app/core/config.py` | 新增 7 个支付宝配置项（APP_ID/PRIVATE_KEY/PUBLIC_KEY/GATEWAY/NOTIFY_URL/RETURN_URL/SANDBOX） |
| `app/services/alipay.py` | **新建**：AliPay 客户端封装（wap.pay URL 生成 + 回调验签） |
| `app/routes/payment.py` | 下单 alipay 分支接真实 SDK；回调验签接 SDK；新增 trade_status 检查 + 金额校验 |
| `requirements.txt` | 新增 `python-alipay-sdk==3.1.0` |

### 部署

| 文件 | 变更 |
|------|------|
| `docker-compose.yml` | python-server 环境变量新增 7 个 ALIPAY_* 变量 |

### 移动端（packages/mobile）

| 文件 | 变更 |
|------|------|
| `lib/api-client/index.ts` | 新增 `getPaymentOrderDetail(orderId)` 方法 |
| `app/(tabs)/payment.tsx` | alipay 支付流程：打开 H5 URL（expo-web-browser）+ 轮询订单状态（最多 20 秒） |

---

## 四、支付流程

### 用户视角

1. 用户选择套餐 → 选择"支付宝" → 点击购买
2. App 内打开支付宝 H5 支付页面（expo-web-browser）
3. 用户输入支付密码完成支付
4. 浏览器关闭，App 轮询订单状态（每 2 秒，最多 10 次 = 20 秒）
5. 订单变为 `paid` → 显示成功 + 刷新余额
6. 超时未到账 → 提示"支付确认中，请稍后刷新"

### 系统流程

```
App → POST /payment/create-order (method=alipay)
    ← { alipay_url: "https://openapi.alipay.com/gateway.do?..." }

App → WebBrowser.openBrowserAsync(alipay_url)
    用户完成支付

支付宝 → POST /api/payment/callback/alipay (异步通知)
    ① 验签 (RSA2)
    ② 检查 trade_status = TRADE_SUCCESS
    ③ 金额校验 (回调金额 == 订单金额)
    ④ 入账 Token / 激活订阅
    ← "success"

App → GET /payment/orders/{order_id} (轮询)
    ← { status: "paid" }
```

---

## 五、安全措施

1. **RSA2 签名验证**：所有回调使用支付宝公钥验签，伪造请求被拒绝
2. **金额校验**：回调 `total_amount` 必须与数据库订单 `amount` 一致（单位：分）
3. **trade_status 检查**：只处理 `TRADE_SUCCESS` / `TRADE_FINISHED`，忽略中间状态
4. **幂等处理**：`process_payment_success` 检查 `status == 'paid'` 防重复入账
5. **生产强制配置**：未配置支付宝密钥时，生产环境返回 503 / 回调返回 "fail"
6. **开发环境回退**：`TESTING_MODE=true` 且未配置密钥时，回退到 mock 支付

---

## 六、开发调试

### 本地开发（无支付宝配置）

- `TESTING_MODE=true` 时，支付宝下单返回 mock URL
- 移动端检测到 mock URL 走模拟支付流程（调用 `/payment/mock-pay/{order_id}`）

### 沙箱测试

1. 在 [沙箱环境](https://openhome.alipay.com/develop/sandbox/app) 获取沙箱 APPID 和密钥
2. 配置环境变量 `ALIPAY_SANDBOX=true` + 沙箱网关 URL
3. 使用沙箱版支付宝 APP 完成支付

### 依赖安装

```bash
cd packages/server-python
pip install python-alipay-sdk==3.1.0
```

注意：`python-alipay-sdk` 依赖 `pyOpenSSL`，如果版本冲突需升级：
```bash
pip install -U pyOpenSSL
```

---

## 七、参考文档

- [支付宝开放平台 - 创建网页/移动应用](https://opendocs.alipay.com/open/200/105310)
- [手机网站支付 API (alipay.trade.wap.pay)](https://opendocs.alipay.com/open/02ivbs)
- [生成密钥并上传](https://opendocs.alipay.com/common/02kipl)
- [python-alipay-sdk GitHub](https://github.com/fzlee/alipay)
