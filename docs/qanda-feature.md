# 问答悬赏功能 - 完整实现文档

## 功能概述

问答悬赏系统是一个完整的问答平台功能，用户可以发布问题、设置悬赏积分、回答问题、投票和采纳答案。

## 前端功能

### 1. 问题列表页 (`packages/mobile/app/(tabs)/questions.tsx`)

**功能特性：**
- ✅ 页面头部：返回按钮、标题、搜索按钮
- ✅ 筛选标签：全部、待回答、已回答、有悬赏（显示数量统计）
- ✅ 排序功能：最新发布、最高悬赏、最热门
- ✅ 响应式布局：列表/网格视图切换（平板自动显示网格）
- ✅ 问题卡片：缩略图、标题、内容预览、标签、悬赏徽章、状态徽章、统计数据
- ✅ 下拉刷新
- ✅ 加载状态和错误处理
- ✅ 空状态提示
- ✅ 发布问题FAB按钮

### 2. 问题详情页 (`packages/mobile/app/questions/[id].tsx`)

**功能特性：**
- ✅ 问题详情展示：标题、内容、悬赏、标签、浏览数、回答数
- ✅ 回答列表：按最新/最高票/已采纳排序
- ✅ 回答投票：赞成/反对（防止自我投票）
- ✅ 采纳答案：问题作者可采纳答案，发放悬赏积分
- ✅ 提交回答：文本输入、提交功能
- ✅ 状态管理：已解决/待回答状态显示
- ✅ 作者信息显示

### 3. 发布问题页 (`packages/mobile/app/questions/create.tsx`)

**功能特性：**
- ✅ 标题输入：字数统计、长度限制
- ✅ 内容输入：字数统计、长度限制
- ✅ 悬赏设置：快速选择、自定义输入、积分余额显示
- ✅ 标签选择：推荐标签、自定义标签、最多5个标签
- ✅ 发布提示：使用指南
- ✅ 表单验证：标题、内容、积分余额验证
- ✅ 提交反馈：加载状态、成功提示

## 后端功能

### 1. 问题路由 (`packages/server-python/app/routes/questions.py`)

**API接口：**

#### POST `/questions` - 发布问题
- 参数：title, content, bounty, tags
- 功能：扣减悬赏积分、创建问题、记录积分流水
- 验证：积分余额、最小/最大悬赏限制

#### GET `/questions` - 获取问题列表
- 参数：page, limit, status, tags, sort
- 排序：recent（最新）、bounty（最高悬赏）、hot（最热门）
- 返回：问题列表、分页信息、用户昵称

#### GET `/questions/{question_id}` - 获取问题详情
- 功能：返回问题详情、自动增加浏览数
- 返回：完整问题信息、用户昵称

### 2. 回答路由 (`packages/server-python/app/routes/answers.py`)

**API接口：**

#### POST `/answers` - 提交回答
- 参数：question_id, content
- 验证：问题存在、未关闭、不能自我回答
- 功能：创建回答、更新回答数

#### GET `/answers/question/{question_id}` - 获取回答列表
- 参数：page, limit, sort
- 排序：recent（最新）、votes（最高票）、accepted（已采纳）
- 返回：回答列表、用户昵称、投票数

#### POST `/answers/{answer_id}/vote` - 投票回答
- 参数：vote（1赞成、-1反对）
- 验证：回答存在、不能自我投票
- 功能：更新投票、记录投票历史

#### POST `/answers/{answer_id}/accept` - 采纳答案
- 验证：回答存在、问题作者权限
- 功能：
  - 更新采纳状态
  - 关闭问题
  - 发放悬赏积分（90%给回答者，10%平台）

### 3. 数据库迁移 (`packages/server-python/migrations/create_qanda_tables.sql`)

**数据表结构：**

#### questions 表
```sql
- id: UUID (主键)
- user_id: UUID (外键 -> users)
- title: VARCHAR(255)
- content: TEXT
- bounty: INTEGER (悬赏积分)
- bounty_status: VARCHAR(20) (open/closed)
- tags: TEXT (JSON数组)
- view_count: INTEGER
- answer_count: INTEGER
- accepted_answer_id: UUID (外键 -> answers)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

#### answers 表
```sql
- id: UUID (主键)
- question_id: UUID (外键 -> questions)
- user_id: UUID (外键 -> users)
- content: TEXT
- rating: DECIMAL(3,2)
- vote_count: INTEGER
- is_accepted: BOOLEAN
- accepted_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

#### answer_votes 表
```sql
- id: UUID (主键)
- answer_id: UUID (外键 -> answers)
- user_id: UUID (外键 -> users)
- vote: INTEGER (1/-1)
- created_at: TIMESTAMPTZ
- UNIQUE(answer_id, user_id)
```

## 设计亮点

### 1. iOS风格设计
- 半透明毛玻璃效果
- 圆角卡片设计
- 紫色主题色（问答专属）
- 流畅的动画效果

### 2. 响应式布局
- 手机：列表视图
- 平板：网格视图
- 自动适配不同屏幕尺寸

### 3. 安全性
- XSS防护（内容清理）
- SQL注入防护（参数化查询）
- 权限验证（JWT认证）
- 业务规则验证（自我回答、自我投票限制）

### 4. 性能优化
- 分页查询
- 索引优化
- N+1查询优化（批量获取用户信息）
- 积分缓存失效

### 5. 数据完整性
- 事务保证（积分扣减、问题创建）
- 外键约束
- 唯一约束（投票去重）

## 使用流程

### 发布问题
1. 点击FAB按钮
2. 输入标题和内容
3. 选择悬赏积分（可选）
4. 添加标签（可选）
5. 点击发布

### 回答问题
1. 浏览问题列表
2. 点击问题查看详情
3. 在底部输入回答
4. 提交回答

### 采纳答案
1. 查看回答列表
2. 点击"采纳"按钮
3. 确认采纳
4. 悬赏积分自动发放

### 投票回答
1. 查看回答列表
2. 点击赞成/反对按钮
3. 投票结果实时更新

## 配置说明

### 后端配置
- `MAX_QUESTION_LENGTH`: 问题内容最大长度（5000）
- `MAX_TITLE_LENGTH`: 标题最大长度（255）
- `MIN_BOUNTY`: 最小悬赏积分（10）
- `MAX_BOUNTY`: 最大悬赏积分（10000）
- `MAX_ANSWER_LENGTH`: 回答最大长度（10000）
- `BOUNTY_AUTHOR_RATIO`: 作者获得比例（0.9）
- `BOUNTY_PLATFORM_RATIO`: 平台获得比例（0.1）

### 前端配置
- 问题列表每页数量：20
- 标签最大数量：5
- 内容预览长度：200字符

## 部署步骤

1. **数据库迁移**
```bash
psql -U postgres -d maic -f packages/server-python/migrations/create_qanda_tables.sql
```

2. **启动后端服务**
```bash
cd packages/server-python
python -m uvicorn app.main:app --reload
```

3. **启动移动端**
```bash
cd packages/mobile
npx expo start
```

4. **访问页面**
- 问题列表：http://localhost:8081/questions
- 发布问题：点击FAB按钮
- 问题详情：点击任意问题卡片

## 后续优化建议

1. **搜索功能**：添加问题搜索
2. **通知系统**：回答通知、采纳通知
3. **问题编辑**：支持编辑已发布的问题
4. **富文本支持**：Markdown或富文本编辑器
5. **图片上传**：支持问题/回答中添加图片
6. **举报功能**：举报不当内容
7. **管理员审核**：问题审核机制
8. **积分统计**：用户积分流水、排行榜
