# API 概述

## 设计原则

| 原则 | 说明 |
|------|------|
| RESTful | 标准 REST API 设计 |
| 版本化 | URL 路径版本化 /api/v1 |
| 认证 | JWT Token 认证 |
| 响应格式 | JSON 统一格式 |
| 错误处理 | 标准 HTTP 状态码 + 错误详情 |

## 认证机制

### JWT Token

| 参数 | 说明 |
|------|------|
| Header | Authorization: Bearer {access_token} |
| 有效期 | access_token 24h, refresh_token 7d |
| 签名 | HS256 |
| Payload | user_id, email, role |

### 认证流程

```
1. 用户登录 → 返回 access_token + refresh_token
2. API 请求携带 access_token
3. Token 过期 → 使用 refresh_token 刷新
4. 刷新失败 → 重新登录
```

### OAuth 流程

```
1. 用户点击 OAuth 按钮 → 重定向到提供商
2. 用户授权 → 回调到 /api/auth/oauth/callback
3. 验证授权 → 创建用户 → 返回 Token
```

## 请求格式

### Headers

```
Content-Type: application/json
Authorization: Bearer {access_token}
X-Request-ID: {uuid}
```

### Query Parameters

```
?page=1&limit=20&sort=created_at&order=desc
```

## 响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数验证失败",
    "details": [
      {"field": "email", "message": "邮箱格式不正确"}
    ]
  }
}
```

### 分页响应

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

## HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 未找到 |
| 409 | 冲突 |
| 422 | 验证失败 |
| 500 | 服务器错误 |

## SSE 流式响应

### 课程生成进度

```
GET /api/classrooms/{id}/status

Event: progress
Data: {"percent": 30, "message": "生成场景 3/10"}

Event: scene
Data: {"scene_id": "uuid", "type": "slide", "content": {...}}

Event: complete
Data: {"classroom_id": "uuid", "status": "completed"}
```

### 多智能体讨论

```
GET /api/chat/{classroom_id}/stream

Event: agent_start
Data: {"agent": "Chief Analyst", "role": "首席分析师"}

Event: message
Data: {"content": "从整体市场来看...", "timestamp": 1634567890}

Event: agent_end
Data: {"agent": "Chief Analyst", "duration": 2.5}
```

## WebSocket 连接

### 连接 URL

```
ws://api.openmaic.com/collaboration/{classroom_id}?token={access_token}
```

### 消息类型

| 类型 | 方向 | 说明 |
|------|------|------|
| join | client → server | 加入课堂 |
| leave | client → server | 离开课堂 |
| whiteboard_update | client ↔ server | 白板更新 |
| chat_message | client ↔ server | 聊天消息 |
| user_join | server → client | 用户加入通知 |
| user_leave | server → client | 用户离开通知 |

## Rate Limiting

| 端点类型 | 限制 |
|----------|------|
| 认证端点 | 10 次/分钟 |
| API 端点 | 100 次/分钟 |
| WebSocket | 1000 条/分钟 |
| AI 端点 | 10 次/分钟（消耗 Token） |

## API 端点总览

| 路径 | 说明 |
|------|------|
| /api/auth | 用户认证 |
| /api/classrooms | 课程管理 |
| /api/chat | 多智能体讨论 |
| /api/generate | 课程生成 |
| /api/collaboration | 实时协作 |
| /api/tokens | Token 管理 |
| /api/points | 积分管理 |
| /api/questions | 问答系统 |
| /api/notes | 笔记系统 |
| /api/invitations | 邀请系统 |
| /api/streaks | 打卡系统 |
| /api/tasks | 任务系统 |
| /api/leagues | 联赛系统 |
| /api/badges | 徽章系统 |
| /api/buddies | 学习搭子 |
| /api/matches | 学习匹配 |
| /api/payment | 支付系统 |

详细端点定义见：
- [Next.js 路由](nextjs-routes.md)
- [Python 路由](python-routes.md)