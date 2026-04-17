# 部署指南

> OpenMAIC Business 生产环境部署配置

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
ALLOWED_ORIGINS=["https://yourdomain.com","https://admin.yourdomain.com"]

# LLM（至少一个）
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# OSS（可选）
OSS_ACCESS_KEY_ID=...
OSS_ACCESS_KEY_SECRET=...
OSS_BUCKET=...
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
```

### Frontend 必需变量

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## 三、Kubernetes 部署

### Deployment 配置

```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openmaic-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    spec:
      containers:
      - name: backend
        image: openmaic/backend:v0.23.0
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
  name: openmaic-ingress
spec:
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 8000
  - host: yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: main-service
            port:
              number: 3000
  - host: admin.yourdomain.com
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

## 四、监控配置

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

## 五、备份策略

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

## 六、日志配置

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

## 七、安全配置

### HTTPS 配置

使用 cert-manager 自动证书：

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: openmaic-tls
spec:
  secretName: openmaic-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - api.yourdomain.com
  - yourdomain.com
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

## 八、扩展配置

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