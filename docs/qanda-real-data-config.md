# 问答功能 - 使用真实数据配置说明

## ✅ 配置完成

### 1. 后端服务

**状态**: ✅ 运行中
- **端口**: 8001
- **健康状态**: OK (v0.23.0)
- **访问地址**: http://localhost:8001

### 2. 数据库

**状态**: ✅ 已配置
- **表**: questions (7条), answers (2条), answer_votes
- **索引**: 已优化
- **外键**: 已设置

**测试数据**:
```sql
-- 问题数据
SELECT id, title, bounty, answer_count, view_count FROM questions LIMIT 3;
```

**结果**:
- 7条测试问题
- 2条测试回答
- 完整的用户关联

### 3. 前端配置

**环境配置**: ✅ 已更新
- **文件**: packages/mobile/.env
- **API URL**: `http://localhost:8001` (从8000更新到8001)

**API客户端**: ✅ 已配置
- **文件**: packages/mobile/lib/api-client/index.ts
- **方法**:
  - `getQuestions(page, limit, sort)`
  - `getQuestion(id)`
  - `createQuestion(title, content, bounty, tags)`
  - `getAnswers(questionId)`
  - `createAnswer(questionId, content)`
  - `voteAnswer(answerId, vote)`
  - `acceptAnswer(answerId)`

### 4. 前端页面

**已创建的页面**:
- ✅ `packages/mobile/app/(tabs)/questions.tsx` - 问题列表
- ✅ `packages/mobile/app/questions/[id].tsx` - 问题详情
- ✅ `packages/mobile/app/questions/create.tsx` - 发布问题

## 🔧 下一步操作

### 重启前端应用

由于修改了 `.env` 文件，需要重启 Expo 应用才能生效：

```bash
cd packages/mobile
npx expo start --clear
```

或者如果正在运行：
```bash
# 按 Ctrl+C 停止当前进程
# 然后重新启动
npx expo start
```

### 测试流程

1. **登录**: 
   - 使用测试账号登录
   - Email: `test_053178ca@example.com`
   - 或者注册新账号

2. **查看问题列表**:
   - 访问 http://localhost:8081/questions
   - 应该能看到7条测试问题

3. **查看问题详情**:
   - 点击任意问题
   - 查看回答列表（第一个问题有2条回答）

4. **发布问题**:
   - 点击右下角FAB按钮
   - 填写标题、内容、悬赏积分、标签
   - 提交发布

5. **回答问题**:
   - 在问题详情页底部输入回答
   - 提交回答

6. **投票和采纳**:
   - 对回答进行赞成/反对投票
   - 问题作者可以采纳答案

## 📊 API接口测试

### 获取问题列表 (需要认证)

```bash
curl -X GET "http://localhost:8001/questions?page=1&limit=10&sort=recent" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 获取问题详情

```bash
curl -X GET "http://localhost:8001/questions/18c02893-5a87-4d7b-9798-affe758c378d" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 发布问题

```bash
curl -X POST "http://localhost:8001/questions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "如何学习React Native？",
    "content": "我是新手，想学习React Native开发移动应用...",
    "bounty": 20,
    "tags": "[\"React Native\", \"移动开发\"]"
  }'
```

## 🐛 已修复的问题

1. **ResponsiveGrid组件错误**: 
   - 问题: JSX注释格式错误导致文本节点错误
   - 修复: 将 `// ...` 改为 `{/* ... */}`

2. **API端口不匹配**: 
   - 问题: 前端配置8000端口，后端运行8001端口
   - 修复: 更新 `.env` 文件为8001端口

## ✅ 功能完整性检查

| 功能 | 状态 | 备注 |
|------|------|------|
| 问题列表 | ✅ | 支持筛选、排序、响应式布局 |
| 问题详情 | ✅ | 完整内容、回答列表、投票、采纳 |
| 发布问题 | ✅ | 标题、内容、悬赏、标签、验证 |
| 回答问题 | ✅ | 提交回答、更新统计 |
| 投票功能 | ✅ | 赞成/反对、防自我投票 |
| 采纳答案 | ✅ | 作者权限、积分发放 |
| 后端API | ✅ | 7个接口完全实现 |
| 数据库表 | ✅ | 结构完整、索引优化 |

## 📱 访问地址

- **问题列表**: http://localhost:8081/questions
- **问题详情**: 点击任意问题卡片
- **发布问题**: 点击右下角紫色FAB按钮
- **后端API**: http://localhost:8001/docs

## 🎉 总结

问答功能已完全配置好使用真实数据：

1. ✅ 后端服务运行在8001端口
2. ✅ 数据库有测试数据（7问题 + 2回答）
3. ✅ 前端API配置已更新
4. ✅ 所有API接口已实现
5. ✅ 前端页面已创建
6. ✅ ResponsiveGrid组件错误已修复

**重启Expo应用后，问答功能即可使用真实数据！**