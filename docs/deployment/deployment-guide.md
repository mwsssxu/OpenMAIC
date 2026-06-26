# 部署指南

> 侧伴(CeBan) 生产环境部署配置 | 出品方: 南京帕兰数字科技有限公司

---

## 一、Docker 部署

### 快速启动

```bash
# 开发环境
docker-compose up -d

# 包含前端服务
docker-compose --profile admin --profile main up -d

# 查看日志
docker-compose logs -f python-server
```

### 生产环境

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 健康检查
curl http://localhost:8000/health
```

---

## 二、环境变量配置

### Backend 必需变量

```env
# 数据库
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db

# Redis
REDIS_URL=redis://host:6379/0

# 安全
SECRET_KEY=your-production-secret-key

# CORS
ALLOWED_ORIGINS=["https://palansoft.cn","https://admin.palansoft.cn"]

# LLM（至少一个）
OPENAI_API_KEY=sk-...
OPENAI_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
DEFAULT_MODEL=qwen3.6-plus

# OSS（可选）
OSS_ACCESS_KEY_ID=...
OSS_ACCESS_KEY_SECRET=...
OSS_BUCKET=...
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
```

### 支付宝配置（公钥模式 + AES 内容加密）

```env
# 支付宝（APPID: 2021006168684071）
ALIPAY_APP_ID=2021006168684071
ALIPAY_APP_PRIVATE_KEY=MIIEvgIBADANBgkqhkiG...    # 应用私钥（裸 base64）
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG9w0BAQ...        # 支付宝公钥（裸 base64）
ALIPAY_AES_KEY=                                    # AES内容加密密钥（base64编码）
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_NOTIFY_URL=https://api.palansoft.cn/api/payment/callback/alipay
ALIPAY_RETURN_URL=https://api.palansoft.cn/payment/return
ALIPAY_SANDBOX=false
```

> 详见 [支付宝集成文档](../alipay-integration.md)

---

## 三、支付系统部署

### 域名架构

支付功能涉及以下域名，生产环境必须全部配置 DNS 解析 + HTTPS 证书：

| 域名 | 用途 | 支付相关说明 |
|------|------|-------------|
| `api.palansoft.cn` | 后端 API | 支付下单接口 + 支付宝异步回调入口 |
| `app.palansoft.cn` | 主应用（侧伴） | iOS Universal Link 前缀 |
| `palansoft.cn` | 官网 | AASA 文件托管（Universal Links 必须） |

### 支付链路

```
用户 App → POST api.palansoft.cn/api/payment/create-order
         ← 返回支付宝 H5 支付 URL
用户浏览器 → 打开支付宝 URL → 完成支付
支付宝服务器 → POST api.palansoft.cn/api/payment/callback/alipay（异步通知）
用户浏览器 → 跳转 api.palansoft.cn/payment/return（同步跳转）
```

### Nginx 路由配置

支付回调需要以下 Nginx 路由（已包含在 `nginx.conf` 中）：

```nginx
# 1. 支付宝异步回调 — POST /api/payment/callback/alipay
#    走默认 API 反代，无需特殊配置

# 2. Apple Universal Links — iOS 支付回跳必须
location /.well-known/apple-app-site-association {
    default_type application/json;
    root /etc/nginx/ssl;
}

# 3. 同步跳转 — GET /payment/return
#    走默认 API 反代，无需特殊配置
```

### AASA 文件部署

iOS Universal Links 要求 `https://palansoft.cn/.well-known/apple-app-site-association` 返回 JSON。部署步骤：

```bash
# 1. 创建 AASA 文件
mkdir -p /etc/nginx/ssl/.well-known
cat > /etc/nginx/ssl/.well-known/apple-app-site-association << 'EOF'
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["TEAMID.com.ceban.mobile"],
        "components": [
          { "/": "/app/*" }
        ]
      }
    ]
  }
}
EOF

# 2. 验证（需 HTTPS 可达）
curl -sI https://palansoft.cn/.well-known/apple-app-site-association
# 应返回 200 + Content-Type: application/json
```

### SDK 依赖

后端 Python 服务需要以下依赖（已包含在 `requirements.txt`）：

```
alipay-sdk-python>=3.7.0    # 支付宝官方 SDK
rsa>=4.9                     # RSA 签名（SDK 依赖）
pycryptodome>=3.20           # AES 加密 + RSA 密钥加载
```

### 支付宝开放平台配置清单

在 https://openhome.alipay.com/develop/manage 找到 APPID `2021006168684071` 的应用，逐项确认：

| 配置项 | 值 | 状态 |
|--------|-----|------|
| 应用类型 | 移动应用 | ☐ |
| Android 应用包名 | `com.ceban.mobile` | ☐ |
| Android 应用签名 (SHA1) | `17:46:F9:28:A6:35:55:7A:03:DD:20:56:7E:E6:0C:24:B4:88:45:BA` | ☐ |
| iOS Bundle ID | `com.ceban.mobile` | ☐ |
| iOS Universal Link | `https://palansoft.cn/app/` | ☐ |
| 接口加签方式 | 公钥模式（RSA2） | ☐ |
| 接口内容加密方式 | AES（128-CBC） | ☐ |
| 应用网关 URL | `https://api.palansoft.cn/api/payment/callback/alipay` | ☐ |
| 授权回调地址 | `https://api.palansoft.cn/api/auth/alipay/callback` | ☐ |
| 支付宝网关地址 | `https://openapi.alipay.com/gateway.do` | ☐ |
| 已开通产品 | 手机网站支付 (alipay.trade.wap.pay) | ☐ |

### 生产环境变量清单

部署前确认 `.env` 中以下变量已正确填入（非空）：

```bash
# 必填 — 支付功能不可用的缺项
ALIPAY_APP_ID=2021006168684071
ALIPAY_APP_PRIVATE_KEY=<应用私钥，从 certs/alipay/appPrivateKey.txt 获取>
ALIPAY_PUBLIC_KEY=<支付宝公钥，从支付宝开放平台获取>
ALIPAY_AES_KEY=<AES密钥，从支付宝开放平台配置AES加密后获取>

# 必填 — 回调地址
ALIPAY_NOTIFY_URL=https://api.palansoft.cn/api/payment/callback/alipay
ALIPAY_RETURN_URL=https://api.palansoft.cn/payment/return

# 固定值
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_SANDBOX=false
```

### 安全注意事项

1. **私钥保护**: `ALIPAY_APP_PRIVATE_KEY` 通过环境变量注入，不写入代码或 Dockerfile
2. **回调验签**: 生产环境 (`TESTING_MODE=false`) 强制验签，未配置公钥时拒绝回调
3. **金额校验**: 回调金额与数据库订单金额比对，防止篡改
4. **HTTPS 必须**: 支付宝回调仅支持 HTTPS，Nginx 必须配置有效 SSL 证书
5. **回调白名单**: 支付宝服务器 IP 可达 `api.palansoft.cn:443`，防火墙勿拦截

### Frontend 必需变量

```env
NEXT_PUBLIC_API_URL=https://api.palansoft.cn
```

---

## 四、Kubernetes 部署

### Deployment 配置

```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ceban-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    spec:
      containers:
      - name: backend
        image: ceban/backend:latest
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: backend-config
        - secretRef:
            name: backend-secrets
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service 配置

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  selector:
    app: backend
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

### Ingress 配置

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ceban-ingress
spec:
  rules:
  - host: api.palansoft.cn
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 8000
  - host: app.palansoft.cn
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: main-service
            port:
              number: 3000
  - host: palansoft.cn
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: website-service
            port:
              number: 3000
  - host: www.palansoft.cn
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: website-service
            port:
              number: 3000
  - host: admin.palansoft.cn
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: admin-service
            port:
              number: 3000
```

---

## 五、监控配置

### Prometheus 监控

```yaml
# prometheus-config.yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['backend-service:8000']
    metrics_path: /metrics
```

### 健康检查端点

| 端点 | 用途 |
|------|------|
| `/health` | 服务健康检查 |
| `/metrics` | Prometheus指标 |

---

## 六、备份策略

### 数据库备份

```bash
# 每日备份
pg_dump -U maic openmaic > backup_$(date +%Y%m%d).sql

# 自动备份脚本
#!/bin/bash
BACKUP_DIR=/backups
DATE=$(date +%Y%m%d_%H%M)
pg_dump -U maic openmaic | gzip > $BACKUP_DIR/db_$DATE.sql.gz
# 保留30天
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
```

### Redis 备份

```bash
# Redis RDB备份
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb /backups/redis_$DATE.rdb
```

---

## 七、日志配置

### 结构化日志

```python
# 使用 Python logging
import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "timestamp": record.created,
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module
        })

# 配置
logging.basicConfig(level=logging.INFO)
```

### 日志收集

使用 Loki 或 Elasticsearch 收集日志：

```yaml
# loki-config.yaml
clients:
  - url: http://loki:3100/loki/api/v1/push
```

---

## 八、安全配置

### HTTPS 配置

使用 cert-manager 自动证书：

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: ceban-tls
spec:
  secretName: ceban-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - api.palansoft.cn
  - app.palansoft.cn
  - palansoft.cn
  - www.palansoft.cn
  - admin.palansoft.cn
```

### 速率限制

```yaml
# nginx rate limit
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20;
    proxy_pass http://backend-service;
}
```

---

## 九、扩展配置

### 水平扩展

```bash
# Kubernetes 扩展
kubectl scale deployment backend --replicas=5

# 自动扩展
kubectl autoscale deployment backend --min=2 --max=10 --cpu-percent=70
```

### 数据库扩展

使用读写分离或分片：

```python
# 配置读写分离
DATABASE_READ_URL = "postgresql://read-host/db"
DATABASE_WRITE_URL = "postgresql://write-host/db"
```

---

## 相关文档

- [Docker Compose配置](../docker-compose.yml)
- [数据库优化](./database-optimization.md)
- [Redis缓存](../packages/server-python/app/core/cache.py)