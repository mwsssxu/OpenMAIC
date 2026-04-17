# Token/积分系统详细设计

## 系统概述

Token 和积分系统构成平台的经济闭环，用于：
- 课程生成消耗
- AI 交互消耗
- 用户激励赚取
- 内容购买支付

## 数据模型

### Token账户

```sql
CREATE TABLE token_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  balance INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE token_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- purchase, exchange, spend, reward
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  reference_id UUID, -- 关联订单或操作
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 积分账户

```sql
CREATE TABLE point_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  balance INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE point_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  source VARCHAR(50) NOT NULL, -- course, daily, qanda, notes, invitation
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Token 消费流程

### 流程设计

```
操作请求 → Token余额检查 → Token扣减 → 操作执行 → 记录流水
```

### 消费规则

| 操作 | Token消耗 | 备注 |
|------|-----------|------|
| 课程生成（短） | 10 Token | < 10场景 |
| 课程生成（中） | 30 Token | 10-30场景 |
| 课程生成（长） | 50 Token | > 30场景 |
| AI交互（轮） | 1 Token | 每轮讨论 |
| AI交互（超10轮） | 2 Token/轮 | 超过10轮后 |
| 下载报告 | 5 Token | PDF/PPTX |
| 图片生成 | 2 Token | DALL-E 3 |

### 扣减逻辑

```python
async def spend_token(user_id: str, amount: int, operation: str):
    # 1. 检查余额
    account = await get_token_account(user_id)
    if account.balance < amount:
        raise InsufficientTokenError()
    
    # 2. 扣减
    account.balance -= amount
    await save_token_account(account)
    
    # 3. 记录流水
    transaction = TokenTransaction(
        user_id=user_id,
        type="spend",
        amount=-amount,
        balance_after=account.balance,
        description=operation,
    )
    await save_transaction(transaction)
    
    return account
```

## Token 获取流程

### 购买流程

```
选择套餐 → 创建订单 → 支付 → 验证 → 入账
```

### 购买套餐

| 套餐 | 价格 | Token数量 | 赠送 |
|------|------|-----------|------|
| 基础包 | ￥10 | 100 | 0 |
| 标准包 | ￥50 | 500 | +100（20%） |
| 高级包 | ￥100 | 1000 | +500（50%） |
| 新用户首购 | ￥5 | 100 | 50%折扣 |

### 支付集成

**微信支付**:
```python
async def create_wechat_order(user_id: str, package: str):
    order = await create_order(user_id, package)
    
    # 调用微信支付API
    wechat_params = wechat_pay.unified_order(
        out_trade_no=order.id,
        total_fee=order.amount,
        body=f"OpenMAIC {package}",
    )
    
    return {
        "order_id": order.id,
        "wechat_params": wechat_params,
    }
```

**支付宝**:
```python
async def create_alipay_order(user_id: str, package: str):
    order = await create_order(user_id, package)
    
    # 调用支付宝API
    pay_url = alipay.create_payment(
        out_trade_no=order.id,
        total_amount=order.amount,
        subject=f"OpenMAIC {package}",
    )
    
    return {
        "order_id": order.id,
        "pay_url": pay_url,
    }
```

### 回调验证

```python
async def verify_payment(order_id: str, payment_data: dict):
    order = await get_order(order_id)
    
    # 验证签名
    if not verify_signature(payment_data):
        raise InvalidSignatureError()
    
    # 验证金额
    if payment_data['amount'] != order.amount:
        raise AmountMismatchError()
    
    # 入账
    token_amount = get_package_tokens(order.package)
    account = await get_token_account(order.user_id)
    account.balance += token_amount
    await save_token_account(account)
    
    # 记录流水
    transaction = TokenTransaction(
        user_id=order.user_id,
        type="purchase",
        amount=token_amount,
        balance_after=account.balance,
        reference_id=order.id,
    )
    await save_transaction(transaction)
    
    return account
```

## 积分赚取流程

### 赚取规则

| 来源 | 积分数量 | 条件 |
|------|----------|------|
| 完成课程 | 10-50 | 根据课程长度 |
| 每日签到 | 5 | 首次签到 |
| 连续签到（第2天） | 10 | 连续2天 |
| 连续签到（第7天） | 30 | 连续7天 |
| 问答被采纳 | 10 | 回答被提问者采纳 |
| 笔记被购买 | 70% | 笔记价格×0.7 |
| 邀请好友 | 20 | 一级邀请 |
| 二级邀请 | 10 | 二级邀请 |
| 三级邀请 | 5 | 三级邀请 |

### 赚取逻辑

```python
async def earn_points(user_id: str, source: str, amount: int, reference_id: str = None):
    # 1. 检查来源有效性
    if source not in VALID_SOURCES:
        raise InvalidSourceError()
    
    # 2. 防作弊检测
    if await detect_cheating(user_id, source):
        raise CheatingDetectedError()
    
    # 3. 增加积分
    account = await get_point_account(user_id)
    account.balance += amount
    await save_point_account(account)
    
    # 4. 记录流水
    transaction = PointTransaction(
        user_id=user_id,
        source=source,
        amount=amount,
        balance_after=account.balance,
        reference_id=reference_id,
    )
    await save_transaction(transaction)
    
    return account
```

## 积分兑换流程

### 兑换规则

- 100 积分 → 10 Token
- 最小兑换 100 积分
- 无手续费

### 兑换逻辑

```python
async def exchange_points_to_tokens(user_id: str, points: int):
    if points < 100:
        raise MinimumExchangeError()
    
    # 检查积分余额
    point_account = await get_point_account(user_id)
    if point_account.balance < points:
        raise InsufficientPointsError()
    
    # 扣减积分
    point_account.balance -= points
    await save_point_account(point_account)
    
    # 增加Token
    tokens = points // 10
    token_account = await get_token_account(user_id)
    token_account.balance += tokens
    await save_token_account(token_account)
    
    # 记录流水
    await save_point_transaction(
        user_id=user_id,
        source="exchange",
        amount=-points,
        balance_after=point_account.balance,
    )
    await save_token_transaction(
        user_id=user_id,
        type="exchange",
        amount=tokens,
        balance_after=token_account.balance,
    )
    
    return {
        "points_used": points,
        "tokens_gained": tokens,
        "point_balance": point_account.balance,
        "token_balance": token_account.balance,
    }
```

## 新用户礼包

### 礼包内容

- 200 Token
- 500 积分
- 7 天高级会员（可选）

### 发放逻辑

```python
async def grant_new_user_package(user_id: str):
    # Token发放
    token_account = await get_token_account(user_id)
    token_account.balance += 200
    await save_token_account(token_account)
    
    # 积分发放
    point_account = await get_point_account(user_id)
    point_account.balance += 500
    await save_point_account(point_account)
    
    # 记录流水
    await save_token_transaction(
        user_id=user_id,
        type="reward",
        amount=200,
        description="新用户礼包",
    )
    await save_point_transaction(
        user_id=user_id,
        source="new_user",
        amount=500,
    )
```

## 反作弊机制

### 检测规则

| 行为 | 检测方法 | 处理 |
|------|---------|------|
| 频繁签到 | 同设备多账号 | 禁止签到 |
| 问答刷分 | 同用户问答采纳 | 封禁账号 |
| 笔记抄袭 | 文本相似度检测 | 拒绝发布 |
| 邀请作弊 | 同设备邀请 | 取消奖励 |

### 检测逻辑

```python
async def detect_cheating(user_id: str, source: str):
    if source == "daily":
        # 同设备多账号签到检测
        device_id = await get_user_device(user_id)
        other_users = await get_users_by_device(device_id)
        if len(other_users) > 3:
            return True
    
    if source == "qanda":
        # 问答刷分检测
        recent_qa = await get_recent_qanda(user_id, days=7)
        if len(recent_qa) > 20:
            # 同一用户频繁问答采纳
            accepted_count = count_accepted_from_same_user(recent_qa)
            if accepted_count > 10:
                return True
    
    return False
```

## 交易查询

### API设计

```typescript
// GET /api/tokens/transactions?page=1&limit=20
interface TokenTransactionQuery {
  page?: number;
  limit?: number;
  type?: 'purchase' | 'exchange' | 'spend' | 'reward';
  startDate?: string;
  endDate?: string;
}
```

### 响应格式

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "type": "spend",
        "amount": -10,
        "balance_after": 190,
        "description": "课程生成",
        "created_at": "2026-04-17T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50
    }
  }
}
```