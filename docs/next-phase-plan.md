# OpenMAIC Business 下阶段开发计划

> **状态：** 开发进行中
> **更新时间：** 2026-04-17
> **当前进度：** Backend v0.14.0，已完成P1-001、P2-004、P2-003、P4-001、P4-002、P2-001

---

## 一、已完成功能回顾

| Phase | 功能 | 后端 | 主项目 | 移动端 | 完成度 |
|-------|------|------|--------|--------|--------|
| **Phase 1** | 核心重构 | ✅ v0.4.0 | ✅ | ✅ | 100% |
| **Phase 2** | 增值功能 | ✅ v0.6.0 | ✅ | ✅ | 95% |
| **Phase 3** | 增强体验 | ✅ v0.8.0 | - | ✅ 10页 | 100% |
| **P0** | 商业闭环修复 | ✅ v0.6.0 | - | - | 100% |
| **P1** | 课程后续路径 | ✅ v0.9.0 | - | - | 100% |
| **P2** | 复习+护照 | ✅ v0.11.0 | - | - | 100% |
| **P4** | 管理后台 | ✅ v0.13.0 | ✅ | - | 50% |

### Phase 3 已完成功能

**后端 (v0.8.0):**
- 学习匹配系统：智能匹配算法、偏好设置、接受/拒绝
- 游戏化增强：打卡奖励递增、每日任务（6种）、联赛等级（7级）
- 学习搭子系统：6种搭子类型、消息生成
- 共享笔记：发布、购买（70/30分成）、评分

**移动端：**
- 10个Tab页面：课程、发现、问答、笔记、搭子、匹配、成长、邀请、充值、我的
- API客户端扩展：30+ API端点

---

## 二、下阶段开发计划

### P1: 商业闭环完善（预计 2 周）

基于 `docs/design/business-loop-fixes.md` 和 `docs/superpowers/plans/2026-04-17-p0-business-loop-fix.md`

| 任务ID | 任务 | 优先级 | 状态 | 预计时间 | 关联断裂点 |
|--------|------|--------|------|---------|-----------|
| P1-001 | 课程后续路径推荐 | P0 | **completed** | 3d | 断裂点6 |
| P1-002 | 课程完成触发笔记提醒 | P1 | pending | 2d | 断裂点6 |
| P1-003 | 学习效果测评系统 | P1 | pending | 4d | 断裂点4 |
| P1-004 | 笔记引用课程内容 | P1 | pending | 2d | 断裂点5 |
| P1-005 | 企业功能模块设计 | P1 | pending | 5d | - |
| P1-006 | 企业团队管理API | P1 | pending | 4d | P1-005 |

**P1-001 课程后续路径推荐详细说明：**

```
课程完成 → 触发后续路径推荐 → 保持学习动力

推荐逻辑：
1. 同主题进阶课程（如学完"Python基础"推荐"Python进阶"）
2. 相关技能课程（如学完"数据分析"推荐"数据可视化"）
3. 实战项目课程（如学完多门理论后推荐综合项目）

技术实现：
- 基于课程tags匹配推荐
- 考虑用户学习历史
- 结合用户联赛等级推荐合适难度

数据表设计：
CREATE TABLE course_recommendations (
    id UUID PRIMARY KEY,
    source_course_id UUID REFERENCES stages(id),
    target_course_id UUID REFERENCES stages(id),
    recommendation_type VARCHAR(20), -- 'advanced', 'related', 'project'
    weight FLOAT DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### Phase 4: 后台管理（预计 4 周）

基于 `docs/progress/admin-phase4.md`

| 任务ID | 任务 | 优先级 | 状态 | 预计时间 |
|--------|------|--------|------|---------|
| P4-001 | 管理后台项目搭建 | P0 | **completed** | 3d |
| P4-002 | 管理员认证系统 | P0 | **completed** | 4d |
| P4-002 | 管理员认证系统 | P0 | pending | 4d |
| P4-003 | 权限管理系统 | P0 | pending | 4d |
| P4-004 | 用户列表管理 | P0 | pending | 4d |
| P4-005 | 内容审核系统 | P0 | pending | 5d |
| P4-006 | 数据统计API | P0 | pending | 4d |
| P4-007 | 统计可视化页面 | P1 | pending | 4d |
| P4-008 | 系统配置管理 | P1 | pending | 4d |

**后台管理架构：**

```
packages/admin/
├── app/
│   ├── (dashboard)/
│   │   ├── users/         # 用户管理
│   │   ├── content/       # 内容审核
│   │   ├── statistics/    # 数据统计
│   │   ├── settings/      # 系统配置
│   │   └── logs/          # 操作日志
│   └── login/
├── lib/
│   ├── api-client/        # Python后端API
│   └── auth/              # 管理员认证
└── components/
    ├── sidebar/           # 侧边导航
    ├── charts/            # 统计图表
    └── tables/            # 数据表格
```

---

### P2: AI辅助自学平台扩展（预计 3 周）

基于 `docs/design/ai-learning-platform-opportunities.md`

| 任务ID | 任务 | 优先级 | 状态 | 预计时间 | 来源章节 |
|--------|------|--------|------|---------|---------|
| P2-001 | 视频转课程功能 | P0 | **completed** | 2周 | 2.1 输入形态扩展 |
| P2-002 | 问题驱动课程生成 | P0 | pending | 1周 | 2.1 输入形态扩展 |
| P2-003 | 学习护照基础版 | P0 | pending | 2周 | 2.4 输出形态扩展 |
| P2-004 | 间隔重复复习系统 | P0 | pending | 1周 | 2.5 学习闭环增强 |
| P2-005 | 编程学习垂直模板 | P1 | pending | 2周 | 2.2 学习场景深耕 |
| P2-006 | 学习深度分层 | P1 | pending | 1周 | 2.3 学习深度分层 |
| P2-007 | 社交分享卡片 | P1 | pending | 1周 | 2.4 输出形态扩展 |
| P2-008 | 历史人物智能体（3个） | P1 | pending | 2周 | 2.6 AI智能体差异化 |

**P2-001 视频转课程功能详细说明：**

```
输入：YouTube/Bilibili视频URL
处理流程：
1. 提取视频字幕（调用视频API或ASR）
2. AI分析字幕内容，识别知识点结构
3. 生成课程大纲
4. 为每个知识点生成幻灯片场景

技术栈：
- YouTube Data API / Bilibili API
- Whisper ASR（备用）
- 现有课程生成pipeline

API设计：
POST /generate/from-video
{
  "video_url": "https://www.youtube.com/watch?v=xxx",
  "language": "zh-CN",
  "depth": "understand"
}
```

**P2-003 学习护照数据表：**

```sql
CREATE TABLE learning_passports (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    skill_name VARCHAR(100) NOT NULL,
    skill_level INTEGER DEFAULT 1,  -- 1-5星
    courses_completed INTEGER DEFAULT 0,
    projects_completed INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    verification_hash VARCHAR(64),  -- 区块链验证哈希
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE project_portfolios (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    stage_id UUID REFERENCES stages(id),
    project_name VARCHAR(255) NOT NULL,
    project_type VARCHAR(50),  -- 'code', 'document', 'presentation'
    content_url TEXT,
    description TEXT,
    rating INTEGER,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 三、任务创建

### P1 商业闭环完善（基于分析结果）

1. 课程后续路径推荐（断裂点6修复）
2. 学习效果测评系统（断裂点4修复）
3. 企业功能模块

### Phase 4 后台管理

1. 管理后台项目搭建
2. 用户管理与内容审核
3. 数据统计系统

### P2 平台扩展

1. 视频转课程（降低输入门槛）
2. 学习护照（输出价值提升）
3. 间隔重复复习（学习闭环增强）
4. 历史人物智能体（差异化壁垒）

---

## 四、优先级排序

| 优先级 | 任务 | 收益预估 | 工作量 |
|--------|------|---------|--------|
| **P0** | 课程后续路径推荐 | 留存+15% | 3d |
| **P0** | 间隔重复复习 | 学习效果+20% | 1周 |
| **P0** | 学习护照基础版 | 留存价值提升 | 2周 |
| **P1** | 后台管理基础 | 运营效率提升 | 4周 |
| **P1** | 视频转课程 | 用户获取+30% | 2周 |
| **P1** | 企业功能模块 | 收入+30% | 4周 |

---

## 五、下一步行动

**建议优先顺序：**

1. **立即开始**：P1-001 课程后续路径推荐（3天）
2. **本周完成**：P2-004 间隔重复复习系统（1周）
3. **下周启动**：Phase 4 后台管理项目搭建
4. **并行推进**：P2-001 视频转课程功能

---

## 六、关键指标追踪

| 指标 | 当前 | 目标（3个月） |
|------|------|--------------|
| 课程完成率 | - | 75% |
| 用户留存率（7天） | - | 60% |
| 笔记发布率 | - | 10% |
| 订阅转化率 | - | 5% |
| 企业客户数 | 0 | 5 |

---

## 相关文档链接

- [商业模式闭环修复方案](../design/business-loop-fixes.md)
- [P0实现计划](../superpowers/plans/2026-04-17-p0-business-loop-fix.md)
- [AI辅助自学平台扩展机会](../design/ai-learning-platform-opportunities.md)
- [Phase 4后台管理](../progress/admin-phase4.md)