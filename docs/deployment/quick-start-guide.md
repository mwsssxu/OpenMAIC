# OpenMAIC Business 快速启动指南

> **版本:** v0.23.0  
> **更新:** 2026-04-18

---

## 一、快速启动（推荐）

### 方式一：一键启动脚本

```bash
# 克隆项目
git clone https://github.com/mwsssxu/OpenMAIC.git
cd OpenMAIC

# 运行启动脚本
chmod +x scripts/quick-start.sh
./scripts/quick-start.sh
```

脚本会自动：
1. 检查 Docker 安装
2. 创建环境配置文件
3. 启动服务
4. 执行数据库迁移
5. 健康检查

### 方式二：手动启动

```bash
# 1. 创建环境配置
cp docs/deployment/env-production.template .env.local

# 2. 编辑配置（填入必需值）
vim .env.local

# 3. 启动服务
docker-compose up -d

# 4. 执行迁移
docker-compose exec python-server alembic upgrade head

# 5. 查看状态
docker-compose ps
```

---

## 二、启动模式

### 开发模式

启动 Backend + PostgreSQL + Redis：

```bash
docker-compose up -d
```

**服务地址：**
- Backend: http://localhost:8000
- API文档: http://localhost:8000/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### 完整模式

启动 Backend + Database + Frontend：

```bash
docker-compose --profile admin --profile main up -d
```

**服务地址：**
- Backend: http://localhost:8000
- 主应用: http://localhost:3000
- 管理后台: http://localhost:3001

### 生产模式

使用生产配置启动：

```bash
# 创建生产配置
cp .env.local .env.production

# 启动生产服务
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## 三、必需配置

### 最小配置

```env
# .env.local 最小配置

# 安全密钥（生成命令: openssl rand -hex 32）
SECRET_KEY=your-32-character-secret-key

# LLM密钥（至少一个）
OPENAI_API_KEY=sk-your-openai-key
# 或
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
```

### 完整配置

参见 `docs/deployment/env-production.template`

---

## 四、服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| python-server | 8000 | Backend API |
| postgres | 5432 | PostgreSQL数据库 |
| redis | 6379 | Redis缓存 |
| main | 3000 | 主应用前端 |
| admin | 3001 | 管理后台 |
| nginx | 80/443 | 反向代理（生产） |

### 服务依赖关系

```
┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │
│  (main/admin)│     │(python-server)│
└─────────────┘     └─────────────┘
                          │
                    ┌─────┴─────┐
                    ▼           ▼
              ┌─────────┐ ┌─────────┐
              │PostgreSQL│ │  Redis  │
              └─────────┘ └─────────┘
```

---

## 五、数据库初始化

### 自动迁移

```bash
docker-compose exec python-server alembic upgrade head
```

### 手动执行SQL

```bash
# 在容器外执行
psql -h localhost -U maic -d maic -f docs/deployment/database-init.sql

# 或在容器内执行
docker-compose exec postgres psql -U maic -d maic -f /path/to/init.sql
```

### 创建管理员账户

```bash
# 进入Backend容器
docker-compose exec python-server bash

# 创建管理员
python scripts/create_admin.py
```

或手动执行SQL：

```sql
INSERT INTO admins (id, email, password_hash, nickname, is_super_admin, created_at)
VALUES (
    gen_random_uuid(),
    'admin@yourdomain.com',
    '$2b$12$...',  -- 使用bcrypt加密
    '超级管理员',
    true,
    now()
);
```

---

## 六、健康检查

### Backend

```bash
curl http://localhost:8000/health
# 返回: {"status": "healthy", "version": "0.23.0"}
```

### Frontend

```bash
curl http://localhost:3000/api/health
curl http://localhost:3001/api/health
```

### 数据库

```bash
docker-compose exec postgres pg_isready -U maic
# 返回: accepting connections
```

### Redis

```bash
docker-compose exec redis redis-cli ping
# 返回: PONG
```

---

## 七、常用命令

### 服务管理

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 重启
docker-compose restart

# 查看日志
docker-compose logs -f python-server

# 查看状态
docker-compose ps
```

### 数据库操作

```bash
# 进入数据库
docker-compose exec postgres psql -U maic -d maic

# 备份
docker-compose exec postgres pg_dump -U maic maic > backup.sql

# 恢复
docker-compose exec -T postgres psql -U maic maic < backup.sql
```

### Backend操作

```bash
# 进入容器
docker-compose exec python-server bash

# 运行迁移
docker-compose exec python-server alembic upgrade head

# 查看迁移状态
docker-compose exec python-server alembic current

# 创建新迁移
docker-compose exec python-server alembic revision -m "description"
```

---

## 八、常见问题

### Q1: 端口冲突

**问题：** 端口被占用
```
Error: port is already allocated
```

**解决：**
```bash
# 查看端口占用
lsof -i :8000

# 停止占用进程
kill -9 <PID>

# 或修改docker-compose.yml中的端口映射
ports:
  - "8001:8000"  # 使用8001端口
```

### Q2: 数据库连接失败

**问题：** Backend无法连接PostgreSQL
```
Connection refused
```

**解决：**
```bash
# 等待数据库就绪
docker-compose exec postgres pg_isready -U maic

# 检查网络
docker-compose exec python-server ping postgres

# 重启Backend
docker-compose restart python-server
```

### Q3: SECRET_KEY未配置

**问题：** 启动失败
```
RuntimeError: SECRET_KEY must be set
```

**解决：**
```bash
# 生成密钥
openssl rand -hex 32

# 添加到.env.local
echo "SECRET_KEY=$(openssl rand -hex 32)" >> .env.local
```

### Q4: LLM API调用失败

**问题：** AI生成失败
```
API key not found
```

**解决：**
```bash
# 检查配置
grep OPENAI_API_KEY .env.local

# 验证密钥
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Q5: Docker内存不足

**问题：** 服务启动后崩溃
```
OOMKilled
```

**解决：**
```bash
# 检查Docker内存限制
docker stats

# 增加内存（修改docker-compose.prod.yml）
deploy:
  resources:
    limits:
      memory: 2G
```

### Q6: 前端无法连接Backend

**问题：** API请求失败
```
Network Error
```

**解决：**
```bash
# 检查Backend状态
curl http://localhost:8000/health

# 检查前端配置
grep NEXT_PUBLIC_API_URL .env.local

# 应为: NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 九、开发调试

### 本地开发Backend

```bash
# 不使用Docker
cd packages/server-python

# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 本地开发Frontend

```bash
# 主应用
cd packages/main-project
pnpm install
pnpm dev

# 管理后台
cd packages/admin
pnpm install
pnpm dev
```

### 热重载配置

Docker开发模式支持Backend热重载：

```yaml
# docker-compose.yml
volumes:
  - ./packages/server-python/app:/app/app:ro
```

修改代码后自动重启。

---

## 十、下一步

1. **创建管理员账户** - 访问管理后台
2. **配置支付** - 设置商户密钥
3. **配置OSS** - 启用文件上传
4. **配置域名** - 设置生产域名和SSL
5. **监控告警** - 配置Prometheus/Grafana

---

## 相关文档

- [部署指南](./deployment-guide.md)
- [生产检查清单](./production-checklist.md)
- [环境配置模板](./env-production.template)
- [数据库SQL](./database-init.sql)

---

**最后更新:** 2026-04-18