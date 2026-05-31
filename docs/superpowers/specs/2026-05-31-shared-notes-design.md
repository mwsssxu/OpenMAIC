# 共享笔记功能设计

> 版本: v1.0
> 日期: 2026-05-31

## 概述

共享笔记功能允许用户发布学习笔记到市场，其他用户可以浏览、搜索、购买（积分）和评分。作者获得70%收益分成。

## 功能需求

### 核心功能

1. **共享笔记市场**：浏览、搜索、筛选他人发布的笔记
2. **我的共享笔记**：管理自己发布的笔记，查看收益统计
3. **笔记发布**：新建共享笔记或将个人笔记转为共享笔记
4. **购买与评分**：积分购买付费笔记，购买后可评分

### 业务规则

- **可见性类型**：
  - `public`：免费公开，所有人可查看
  - `paid`：付费笔记，购买后可查看完整内容
  - `matched`：学习匹配用户可见（暂不实现）

- **收益分配**：作者 70%，平台 30%

- **评分规则**：购买后可评分（1-5星），评分不可更改

## 技术设计

### 数据模型

`shared_notes` 表字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 作者ID |
| course_id | UUID | 关联课程ID（可选） |
| title | VARCHAR(255) | 标题 |
| content | TEXT | 内容 |
| visibility | VARCHAR(20) | 可见性：public/paid/matched |
| price | INTEGER | 积分价格（0=免费） |
| tags | TEXT | 标签，逗号分隔 |
| rating | DECIMAL(3,2) | 平均评分 |
| rating_count | INTEGER | 评分人数 |
| purchase_count | INTEGER | 购买次数 |
| status | VARCHAR(20) | 状态：published/draft/removed |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### API 端点

后端已有 `/notes` 路由（packages/server-python/app/routes/notes.py），提供：

- `POST /notes/` - 发布笔记
- `GET /notes/` - 获取笔记列表
- `GET /notes/{note_id}` - 获取笔记详情
- `POST /notes/{note_id}/purchase` - 购买笔记
- `POST /notes/{note_id}/rating` - 评分
- `GET /notes/my/earnings` - 获取收益统计

### 移动端页面结构

```
/shared-notes/index.tsx        # 双Tab市场页面
  ├── Tab 1: 市场
  └── Tab 2: 我的

/shared-notes/[id].tsx         # 笔记详情页
/shared-notes/new.tsx          # 发布笔记页
```

### 移动端 API 客户端方法

```typescript
// 共享笔记市场
getSharedNotes(page, limit, visibility, sort): Promise<{ items, pagination }>
getSharedNoteDetail(noteId): Promise<SharedNoteDetail>
purchaseSharedNote(noteId): Promise<PurchaseResult>
rateSharedNote(noteId, rating): Promise<void>

// 我的共享笔记
getMySharedNotes(): Promise<{ shares }>
createSharedNote(note): Promise<CreatedNote>
updateSharedNote(noteId, updates): Promise<void>
deleteSharedNote(noteId): Promise<void>
getMyEarnings(): Promise<EarningsInfo>

// 个人笔记转共享
convertToSharedNote(personalNoteId, visibility, price): Promise<CreatedNote>
```

## 用户流程

### 浏览购买流程

1. 首页入口 → 共享笔记市场（市场Tab）
2. 浏览/搜索/筛选笔记列表
3. 点击笔记卡片 → 详情页
4. 付费笔记显示预览（前200字）
5. 点击购买 → 积分确认弹窗 → 确认购买
6. 购买成功 → 显示完整内容
7. 可评分（1-5星）

### 发布流程

1. 市场页切换到"我的"Tab
2. 点击发布按钮 → 发布页
3. 填写标题、内容
4. 选择可见性（公开/付费）
5. 付费时设置积分价格
6. 可选关联课程
7. 发布成功

### 个人笔记转共享

1. 个人笔记详情页 → 点击"分享到市场"
2. 弹窗选择可见性和价格
3. 确认 → 复制内容创建共享笔记

## 实现顺序

1. 更新数据库表结构（迁移文件）
2. 添加移动端 API 客户端方法
3. 创建共享笔记市场页面（双Tab）
4. 创建笔记详情页
5. 创建发布页面
6. 实现个人笔记转共享
7. 连接首页入口

## 实现状态

| 任务 | 状态 | 文件路径 |
|------|------|----------|
| 数据库迁移 | ✅ 完成 | `packages/server-python/migrations/update_shared_notes.sql` |
| API客户端方法 | ✅ 完成 | `packages/mobile/lib/api-client/index.ts` |
| 市场页面 | ✅ 完成 | `packages/mobile/app/shared-notes/index.tsx` |
| 详情页面 | ✅ 完成 | `packages/mobile/app/shared-notes/[id].tsx` |
| 发布页面 | ✅ 完成 | `packages/mobile/app/shared-notes/new.tsx` |
| 个人笔记转共享 | ✅ 完成 | `packages/mobile/app/note/[id].tsx` |
| 首页入口连接 | ✅ 完成 | `packages/mobile/app/(tabs)/index.tsx` |
| 功能文档 | ✅ 完成 | `docs/shared-notes-feature.md` |

## 测试要点

### 功能测试

1. **市场浏览**
   - 笔记列表正确加载
   - 筛选（全部/免费/付费）正常工作
   - 排序（最新/热门/评分）正常工作
   - 下拉刷新正常

2. **笔记详情**
   - 免费笔记直接显示内容
   - 付费笔记显示预览
   - 购买流程完整（确认→支付→显示内容）
   - 评分功能正常

3. **发布笔记**
   - 表单验证正常（标题/内容必填）
   - 可见性切换正常
   - 付费笔记价格设置正常
   - 发布成功后跳转

4. **个人笔记转共享**
   - 分享弹窗正常显示
   - 可见性和价格选择正常
   - 转换成功后内容正确

### 边界情况

1. 积分不足时的购买提示
2. 重复购买的提示
3. 自己购买自己笔记的限制
4. 网络错误处理
