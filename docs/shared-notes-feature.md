# 共享笔记功能

> 版本: v1.0
> 更新日期: 2026-05-31

## 功能概述

共享笔记是 OpenMAIC 的知识共享平台，用户可以发布学习笔记到市场，其他用户可以浏览、搜索、购买和评分。作者通过付费笔记获得 70% 收益分成。

## 核心功能

### 1. 笔记市场

- **浏览笔记**：查看所有公开和付费笔记
- **搜索筛选**：按关键词搜索，按可见性（免费/付费）筛选
- **排序方式**：最新、热门、评分
- **笔记卡片**：显示标题、价格、评分、购买数

### 2. 笔记详情

- **免费笔记**：直接查看完整内容
- **付费笔记**：显示前 200 字预览，购买后查看完整内容
- **购买流程**：积分确认 → 支付 → 查看内容
- **评分功能**：购买后可评分（1-5星）

### 3. 我的笔记

- **收益统计**：总收益、购买次数、已发布数量
- **笔记管理**：查看已发布的笔记列表
- **发布入口**：快速发布新笔记

### 4. 发布笔记

- **基本信息**：标题（限50字）、内容（限2000字）
- **标签**：可选，逗号分隔
- **可见性**：
  - 免费公开：所有人可查看
  - 付费笔记：设置积分价格，购买后可查看
- **收益说明**：作者获得 70% 收益

### 5. 个人笔记转共享

- 在个人笔记详情页点击"分享到市场"
- 选择可见性和价格
- 一键复制到共享市场

## 页面路由

| 路由 | 说明 |
|------|------|
| `/shared-notes` | 共享笔记市场（双Tab：市场/我的）|
| `/shared-notes/[id]` | 笔记详情页 |
| `/shared-notes/new` | 发布笔记页 |

## API 接口

### 获取笔记列表

```
GET /notes/
```

参数：
- `page`: 页码（默认1）
- `limit`: 每页数量（默认20）
- `visibility`: 可见性筛选（public/paid）
- `sort`: 排序方式（recent/popular/rating）

响应：
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "笔记标题",
      "visibility": "paid",
      "price": 10,
      "rating": 4.5,
      "rating_count": 12,
      "purchase_count": 50,
      "is_purchased": false,
      "created_at": "2026-05-31T00:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20 }
}
```

### 获取笔记详情

```
GET /notes/{note_id}
```

响应：
```json
{
  "id": "uuid",
  "title": "笔记标题",
  "content": "完整内容（已购买或作者）",
  "visibility": "paid",
  "price": 10,
  "rating": 4.5,
  "is_purchased": true,
  "is_author": false,
  "preview": "预览内容（未购买时）"
}
```

### 购买笔记

```
POST /notes/{note_id}/purchase
```

响应：
```json
{
  "note_id": "uuid",
  "price": 10,
  "author_reward": 7,
  "message": "笔记购买成功，可以查看完整内容"
}
```

### 评分笔记

```
POST /notes/{note_id}/rating
```

请求体：
```json
{ "rating": 5 }
```

### 发布笔记

```
POST /notes/
```

请求体：
```json
{
  "title": "笔记标题",
  "content": "笔记内容",
  "visibility": "paid",
  "price": 10,
  "tags": "Python,数据分析",
  "course_id": "可选关联课程ID"
}
```

### 获取我的笔记

```
GET /notes/my-shares
```

### 获取收益统计

```
GET /notes/my/earnings
```

响应：
```json
{
  "total_earnings": 150,
  "total_purchases": 20,
  "notes_count": 5
}
```

## 数据库表结构

### shared_notes 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 作者ID |
| course_id | UUID | 关联课程ID（可选）|
| title | VARCHAR(255) | 标题 |
| content | TEXT | 内容 |
| visibility | VARCHAR(20) | 可见性：public/paid |
| price | INTEGER | 积分价格 |
| tags | TEXT | 标签，逗号分隔 |
| rating | DECIMAL(3,2) | 平均评分 |
| rating_count | INTEGER | 评分人数 |
| purchase_count | INTEGER | 购买次数 |
| status | VARCHAR(20) | 状态：published/draft |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### note_purchases 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 购买者ID |
| note_id | UUID | 笔记ID |
| price | INTEGER | 支付积分 |
| author_reward | INTEGER | 作者收益 |
| platform_fee | INTEGER | 平台费用 |
| created_at | TIMESTAMP | 购买时间 |

### note_ratings 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 评分者ID |
| note_id | UUID | 笔记ID |
| rating | INTEGER | 评分（1-5）|
| created_at | TIMESTAMP | 评分时间 |

## 业务规则

### 可见性类型

- `public`：免费公开，所有人可查看
- `paid`：付费笔记，购买后可查看

### 收益分配

- 作者收益：70%
- 平台费用：30%

### 评分规则

- 购买后才能评分
- 每个用户只能评分一次
- 评分范围：1-5星

## 移动端实现

### 文件结构

```
packages/mobile/app/
├── shared-notes/
│   ├── index.tsx      # 市场页面（双Tab）
│   ├── [id].tsx       # 笔记详情页
│   └── new.tsx        # 发布笔记页
└── note/
    └── [id].tsx       # 个人笔记详情页（含分享功能）
```

### API 客户端方法

```typescript
// 获取共享笔记列表
apiClient.getSharedNotes(page?, limit?, visibility?, sort?)

// 获取笔记详情
apiClient.getSharedNoteDetail(noteId)

// 购买笔记
apiClient.purchaseSharedNote(noteId)

// 评分笔记
apiClient.rateSharedNote(noteId, rating)

// 获取我的笔记
apiClient.getMySharedNotes()

// 发布共享笔记
apiClient.createSharedNote({ title, content, visibility, price, tags })

// 获取收益统计
apiClient.getMyEarnings()

// 个人笔记转共享
apiClient.convertToSharedNote(personalNoteId, { visibility, price })
```

## 使用流程

### 浏览购买流程

1. 首页点击"共享笔记"入口
2. 进入市场Tab浏览笔记列表
3. 使用筛选和排序找到感兴趣的内容
4. 点击笔记卡片查看详情
5. 付费笔记点击购买按钮
6. 确认支付积分
7. 查看完整内容
8. 购买后可评分

### 发布流程

1. 首页点击"共享笔记"入口
2. 切换到"我的"Tab
3. 点击右下角发布按钮
4. 填写标题和内容
5. 选择可见性（免费/付费）
6. 付费时设置价格
7. 点击发布

### 个人笔记转共享

1. 在"笔记"页面打开个人笔记
2. 点击右上角分享按钮
3. 选择可见性和价格
4. 确认分享

## 注意事项

1. **积分余额**：购买前确保积分余额充足
2. **内容规范**：发布有价值的内容，避免抄袭
3. **价格设置**：付费笔记价格建议 1-100 积分
4. **评分不可改**：评分后无法修改，请谨慎评分
