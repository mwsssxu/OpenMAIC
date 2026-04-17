# OpenMAIC Business 生产部署检查清单

> **版本:** v0.23.0
> **状态:** 生产就绪

---

## 一、环境配置检查

### 1. 数据库配置
- [ ] PostgreSQL 15+ 已安装
- [ ] 数据库用户已创建
- [ ] DATABASE_URL 配置正确
- [ ] 连接池参数已优化

### 2. Redis配置
- [ ] Redis 7+ 已安装
- [ ] REDIS_URL 配置正确
- [ ] 内存限制已设置
- [ ] 持久化策略已配置

### 3. 安全配置
- [ ] SECRET_KEY 已生成（32位以上）
- [ ] JWT 密钥已配置
- [ ] CORS ALLOWED_ORIGINS 已设置
- [ ] HTTPS 证书已配置

### 4. LLM配置
- [ ] OPENAI_API_KEY 已配置
- [ ] ANTHROPIC_API_KEY 已配置（可选）
- [ ] API 密钥有效性已验证
- [ ] 速率限制已配置

### 5. OSS配置（可选）
- [ ] OSS_ACCESS_KEY_ID 已配置
- [ ] OSS_BUCKET 已创建
- [ ] OSS_ENDPOINT 已配置

### 6. OAuth配置（可选）
- [ ] APPLE_CLIENT_ID 已配置
- [ ] GOOGLE_CLIENT_ID 已配置
- [ ] 回调URL已配置

### 7. 支付配置（可选）
- [ ] WECHAT_PAY_MCHID 已配置
- [ ] ALIPAY_APP_ID 已配置
- [ ] 支付回调URL已配置

---

## 二、服务部署检查

### 1. Docker服务
```bash
# 检查服务状态
docker-compose ps

# 应显示6个服务:
# - backend (健康)
# - admin (健康)
# - main (健康)
# - postgres (健康)
# - redis (健康)
# - nginx (健康)
```

- [ ] backend 服务健康
- [ ] admin 服务健康
- [ ] main 服务健康
- [ ] postgres 服务健康
- [ ] redis 服务健康
- [ ] nginx 服务健康

### 2. 数据库迁移
```bash
cd packages/server-python
alembic upgrade head
```

- [ ] 迁移执行成功
- [ ] 表数量验证（62张）
- [ ] 索引创建成功

### 3. 管理员账户
```sql
-- 创建超级管理员
INSERT INTO admins (email, password_hash, nickname, is_super_admin)
VALUES ('admin@yourdomain.com', '$2b$12$...', '系统管理员', true);
```

- [ ] 管理员账户已创建
- [ ] 登录测试成功
- [ ] RBAC权限已配置

---

## 三、功能验证检查

### 1. 认证功能
- [ ] 用户注册成功
- [ ] 用户登录成功
- [ ] Token刷新成功
- [ ] OAuth登录成功（可选）

### 2. 核心功能
- [ ] 课程创建成功
- [ ] AI课程生成成功
- [ ] 场景内容加载
- [ ] 白板功能正常

### 3. 商业功能
- [ ] Token购买流程
- [ ] 积分奖励发放
- [ ] 测评系统可用
- [ ] 企业创建成功

### 4. 管理后台
- [ ] 后台登录成功
- [ ] 用户管理可用
- [ ] 内容审核可用
- [ ] 数据统计显示

---

## 四、性能验证检查

### 1. 响应时间
- [ ] API响应 < 200ms (P95)
- [ ] 页面加载 < 3s
- [ ] WebSocket连接 < 1s

### 2. 缓存验证
- [ ] Redis缓存命中率 > 80%
- [ ] 用户余额缓存生效
- [ ] 课程详情缓存生效

### 3. 数据库验证
- [ ] 连接池健康
- [ ] 查询性能正常
- [ ] 索引使用有效

---

## 五、监控配置检查

### 1. 基础监控
- [ ] 服务健康检查端点
- [ ] 日志收集配置
- [ ] 错误告警配置

### 2. 业务监控
- [ ] API调用统计
- [ ] 用户活跃统计
- [ ] 支付成功率统计

### 3. 资源监控
- [ ] CPU使用率监控
- [ ] 内存使用率监控
- [ ] 存储空间监控

---

## 六、安全验证检查

### 1. 访问控制
- [ ] JWT有效期已设置
- [ ] Token刷新机制正常
- [ ] RBAC权限生效

### 2. 数据安全
- [ ] 密码哈希验证
- [ ] SQL注入防护
- [ ] XSS防护

### 3. 网络安全
- [ ] HTTPS强制
- [ ] CORS策略生效
- [ ] Rate Limiting生效

---

## 七、备份配置检查

### 1. 数据库备份
- [ ] 自动备份脚本
- [ ] 备份频率已设置
- [ ] 备份存储位置
- [ ] 恢复测试成功

### 2. 配置备份
- [ ] 环境变量备份
- [ ] 密钥安全存储
- [ ] 版本记录

---

## 八、文档检查

- [ ] API文档可访问
- [ ] 部署指南完整
- [ ] 运维手册完整
- [ ] 用户手册完整

---

## 九、发布前最终检查

### Git状态
```bash
# 确认分支状态
git log --oneline -1
# 应显示: 9353934b8 docs: CHANGELOG

git branch -vv
# feat/mobile 应与 origin 同步
```

- [ ] 代码已合并到 main
- [ ] 版本号已确认
- [ ] CHANGELOG 已更新

### 发布通知
- [ ] 发布公告已准备
- [ ] 用户通知已发送
- [ ] 团队已通知

---

## 部署命令参考

```bash
# 1. 克隆代码
git clone https://github.com/mwsssxu/OpenMAIC.git
cd OpenMAIC

# 2. 配置环境
cp docs/deployment/env-production.template .env.local
vim .env.local

# 3. 启动服务
docker-compose up -d

# 4. 数据库迁移
docker-compose exec backend alembic upgrade head

# 5. 创建管理员
docker-compose exec backend python scripts/create_admin.py

# 6. 健康检查
curl http://localhost:8000/health
curl http://localhost:3001/health
curl http://localhost:3000/health

# 7. 查看日志
docker-compose logs -f backend
```

---

**检查完成签名:** ________________
**检查日期:** ________________
**检查人:** ________________