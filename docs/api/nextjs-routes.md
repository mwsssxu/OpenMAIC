# Next.js 路由 API

## 路由结构

```
app/api/
├── auth/
│   ├── register/route.ts
│   ├── login/route.ts
│   ├── oauth/
│   │   ├── apple/route.ts
│   │   ├── google/route.ts
│   │   ├── wechat/route.ts
│   │   └── callback/route.ts
│   └── refresh/route.ts
├── classrooms/
│   ├── route.ts
│   ├── [id]/route.ts
│   ├── [id]/scenes/route.ts
│   ├── [id]/generate/route.ts
│   └── [id]/status/route.ts
├── chat/
│   ├── [classroom_id]/route.ts
│   ├── [classroom_id]/stream/route.ts
│   ├── [classroom_id]/history/route.ts
├── generate/
│   ├── outline/route.ts
│   ├── scene/route.ts
│   ├── image/route.ts
│   └── tts/route.ts
├── tokens/
│   ├── balance/route.ts
│   ├── purchase/route.ts
│   ├── transactions/route.ts
│   ├── exchange/route.ts
├── points/
│   ├── balance/route.ts
│   ├── earn/route.ts
│   ├── transactions/route.ts
├── questions/
│   ├── route.ts
│   ├── [id]/route.ts
│   ├── [id]/answers/route.ts
│   ├── [id]/accept/route.ts
├── notes/
│   ├── route.ts
│   ├── [id]/route.ts
│   ├── [id]/purchase/route.ts
├── streaks/
│   ├── checkin/route.ts
│   ├── status/route.ts
│   ├── history/route.ts
├── tasks/
│   ├── daily/route.ts
│   ├── complete/route.ts
├── leagues/
│   ├── current/route.ts
│   ├── rankings/route.ts
├── badges/
│   ├── route.ts
│   ├── unlock/route.ts
├── buddies/
│   ├── current/route.ts
│   ├── messages/route.ts
│   ├── interact/route.ts
├── matches/
│   ├── recommend/route.ts
│   ├── notes/route.ts
├── invitations/
│   ├── code/route.ts
│   ├── stats/route.ts
│   ├── accept/route.ts
├── payment/
│   ├── create-order/route.ts
│   ├── verify/route.ts
│   ├── orders/route.ts
```

## 认证路由

### POST /api/auth/register

**请求**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "nickname": "用户昵称"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "nickname": "用户昵称"
    }
  }
}
```

### POST /api/auth/login

**请求**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**响应**: 同注册

### POST /api/auth/refresh

**Headers**: Authorization: Bearer {refresh_token}

**响应**: 同登录

## 课程路由

### POST /api/classrooms

**Headers**: Authorization: Bearer {access_token}

**请求**:
```json
{
  "title": "商业策略分析课程",
  "description": "基于XX公司的商业策略分析",
  "source": "upload" | "topic",
  "content": "文件ID或主题描述",
  "options": {
    "tts": true,
    "language": "zh-CN"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "classroom_id": "uuid",
    "job_id": "uuid",
    "status": "generating",
    "token_cost": 30
  }
}
```

### GET /api/classrooms/[id]/status

**响应** (SSE):
```
Event: progress
Data: {"percent": 30, "message": "生成场景 3/10"}

Event: complete
Data: {"classroom_id": "uuid", "status": "completed"}
```

## 讨论路由

### GET /api/chat/[classroom_id]/stream

**Headers**: Authorization: Bearer {access_token}

**响应** (SSE):
```
Event: agent_start
Data: {"agent": "Chief Analyst", "role": "首席分析师"}

Event: message
Data: {"content": "从整体市场来看...", "timestamp": 1634567890}

Event: agent_end
Data: {"agent": "Chief Analyst", "duration": 2.5}

Event: user_input_available
Data: {"available": true, "timeout": 30}
```

## Token/积分路由

### GET /api/tokens/balance

**Headers**: Authorization: Bearer {access_token}

**响应**:
```json
{
  "success": true,
  "data": {
    "balance": 200,
    "updated_at": "2026-04-17T10:00:00Z"
  }
}
```

### POST /api/tokens/exchange

**请求**:
```json
{
  "points": 100
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "tokens_gained": 10,
    "point_balance": 400,
    "token_balance": 210
  }
}
```

## 问答路由

### POST /api/questions

**请求**:
```json
{
  "title": "如何评估市场规模？",
  "content": "请问有哪些方法可以准确评估市场规模？",
  "category": "market",
  "bounty": 20
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "question_id": "uuid",
    "status": "open"
  }
}
```

### POST /api/questions/[id]/answers

**请求**:
```json
{
  "content": "可以从以下几个方法评估市场规模..."
}
```

### POST /api/questions/[id]/accept

**请求**:
```json
{
  "answer_id": "uuid"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "points_transferred": 18,
    "platform_fee": 2
  }
}
```

## 打卡路由

### POST /api/streaks/checkin

**响应**:
```json
{
  "success": true,
  "data": {
    "streak_count": 5,
    "reward": 25,
    "checkin_date": "2026-04-17"
  }
}
```

## 联赛路由

### GET /api/leagues/current

**响应**:
```json
{
  "success": true,
  "data": {
    "season": "2026-W16",
    "level": "silver",
    "points": 350,
    "rank": 45
  }
}
```

## 支付路由

### POST /api/payment/create-order

**请求**:
```json
{
  "package": "standard",
  "payment_method": "wechat"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "order_id": "uuid",
    "amount": 50,
    "token_amount": 600,
    "wechat_params": {...}
  }
}
```