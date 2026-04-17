# OpenMAIC API 文档

> **版本:** v0.23.0
> **端点:** http://localhost:8000 (开发) / https://api.yourdomain.com (生产)

---

## 一、认证接口

### 登录
```
POST /auth/login
Body: { email, password }
Response: { access_token, refresh_token, user }
```

### 注册
```
POST /auth/register
Body: { email, password, nickname }
Response: { access_token, user }
```

### 获取当前用户
```
GET /auth/me
Headers: Authorization: Bearer {token}
Response: { id, email, nickname, avatar_url, ... }
```

---

## 二、课程接口

### 获取课程列表
```
GET /classrooms
Response: { classrooms: [...] }
```

### 获取课程详情
```
GET /classrooms/{id}
Response: { stage, scenes }
```

### 创建课程
```
POST /classrooms
Body: { name, description }
Response: { id, name, ... }
```

### AI生成课程
```
POST /generate/classroom
Body: { requirement, language, depth }
Response: { job_id, status }
```

---

## 三、测评接口

### 获取测评类型
```
GET /assessments/types
Response: { types: [{ id, name, duration_minutes, questions_count }] }
```

### 创建测评
```
POST /assessments/create
Body: { course_id, assessment_type }
Response: { assessment_id, questions, expires_at }
```

### 提交测评
```
POST /assessments/submit
Body: { assessment_id, answers: [{ question_id, answer }] }
Response: { score, mastery_level, passed, earned_points }
```

### 获取测评结果
```
GET /assessments/results/{course_id}
Response: { results: [...] }
```

---

## 四、企业接口

### 获取我的企业
```
GET /enterprise/my
Response: { has_enterprise, name, role, member_count }
```

### 创建企业
```
POST /enterprise/
Body: { name, industry, size, plan_type }
Response: { enterprise_id, limits }
```

### 邀请成员
```
POST /enterprise/{id}/members/invite
Body: { emails: [...], role }
Response: { invites_created }
```

### 获取企业统计
```
GET /enterprise/{id}/stats
Response: { member_count, active_members, total_learning_hours }
```

---

## 五、学习系统接口

### 课程推荐
```
POST /recommendations/completions/{course_id}
Body: { status, rating }
Response: { completion_id, recommendations, reward_points }
```

### 间隔复习
```
GET /review/schedules
Response: { schedules: [...] }

POST /review/start/{schedule_id}
Response: { review_id }
```

### 学习护照
```
GET /passport/me
Response: { passports: [{ skill_name, skill_level }] }

POST /passport/projects
Body: { project_name, project_type, content_url }
Response: { project_id }
```

---

## 六、社交接口

### 共享笔记
```
GET /notes
Response: { items: [...] }

POST /notes
Body: { title, content, visibility, price }
Response: { id }

POST /notes/{id}/purchase
Response: { note_id, price, author_reward }
```

### 笔记引用
```
POST /notes/{id}/citations
Body: { scene_id, content_snippet, citation_type }
Response: { citation_id }
```

---

## 七、游戏化接口

### 每日打卡
```
POST /checkin/checkin
Response: { reward_points, streak_days }
```

### 每日任务
```
GET /gamification/tasks
Response: { tasks: [...] }
```

### 联赛排行
```
GET /gamification/league/leaderboard
Response: { leaderboard: [...] }
```

---

## 八、支付接口

### Token购买
```
POST /tokens/purchase
Body: { package_id }
Response: { order_id, amount }
```

### 积分余额
```
GET /points/balance
Response: { balance }
```

---

## 九、AI智能体接口

### 开始对话
```
POST /personas/session
Body: { persona_id, topic, mode }
Response: { session_id }
```

### 发送消息
```
POST /personas/session/{id}/message
Body: { user_message }
Response: { persona_response, quotes_used }
```

---

## 十、管理后台接口

### 管理员登录
```
POST /admin/auth/login
Body: { email, password }
Response: { access_token, roles }
```

### 用户管理
```
GET /admin/users
Response: { users: [...] }

POST /admin/users/{id}/ban
Response: { success }
```

### 内容审核
```
GET /admin/content/questions
Response: { questions: [...] }

POST /admin/content/questions/{id}/approve
Response: { success }
```

### 数据统计
```
GET /admin/statistics/users
Response: { total, growth, tier_distribution }
```

---

## 错误响应格式

```json
{
  "detail": "错误描述"
}
```

常见错误码：
- 400: 参数错误
- 401: 未认证
- 403: 无权限
- 404: 资源不存在
- 500: 服务器错误

---

## 请求示例

```bash
# 登录获取token
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 获取用户信息
curl -X GET http://localhost:8000/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# 创建测评
curl -X POST http://localhost:8000/assessments/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"course_id":"UUID","assessment_type":"standard"}'
```

---

## WebSocket 接口

### 多人课堂实时通信
```
ws://localhost:8000/ws/classroom/{classroom_id}?token={jwt}
```

事件类型：
- scene_change: 场景切换
- whiteboard_update: 白板同步
- chat_message: 聊天消息
- user_join/leave: 用户加入/离开

---

相关文档：
- [部署指南](../deployment/deployment-guide.md)
- [数据库优化](../performance/database-optimization.md)