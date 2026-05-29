# OpenMAIC 系统架构设计文档

**版本**: v1.0  
**日期**: 2026年5月29日  
**状态**: 正式发布

---

## 1. 文档概述

### 1.1 编写目的

本文档详细描述 OpenMAIC 智能教学平台的系统架构设计，为开发团队提供技术实现指导，确保系统的可扩展性、可维护性和高性能。

### 1.2 适用范围

本文档适用于：
- 系统架构师
- 开发工程师
- 测试工程师
- 运维工程师

### 1.3 参考资料

- FastAPI 官方文档
- React Native / Expo 官方文档
- 阿里云 DashScope API 文档
- PostgreSQL 官方文档
- Redis 官方文档

---

## 2. 系统概述

### 2.1 系统定位

OpenMAIC 是 AI 驱动的智能教学平台，核心能力：
- **AI 课程生成**：自动生成大纲、幻灯片、测验
- **智能体教学**：实时讲解、对话答疑、白板演示
- **多端覆盖**：iOS、Android、Web 统一体验

### 2.2 设计原则

| 原则 | 说明 |
|------|------|
| AI 原生 | 全链路 AI 驱动设计 |
| 模块化 | 服务解耦，独立部署 |
| 可扩展 | 支持模型、模板、组件扩展 |
| 高可用 | 容错设计，优雅降级 |
| 性能优先 | 异步处理，流式输出 |

### 2.3 技术栈总览

| 层级 | 技术选型 |
|------|----------|
| 移动端 | React Native + Expo + TypeScript |
| 后端 | Python + FastAPI + SQLAlchemy |
| 数据库 | PostgreSQL + Redis |
| 存储 | 阿里云 OSS / S3 兼容存储 |
| AI 服务 | 阿里云 DashScope (通义千问) |
| 部署 | Docker + Kubernetes |

---

## 3. 系统架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         客户端层 (Client Layer)                   │
├─────────────────────────────────────────────────────────────────┤
│   iOS App      │    Android App    │       Web App              │
│   (Expo)       │     (Expo)        │    (Expo Web)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         网关层 (Gateway Layer)                    │
├─────────────────────────────────────────────────────────────────┤
│   Nginx / Kong API Gateway                                      │
│   - 负载均衡                                                      │
│   - SSL 终止                                                      │
│   - 速率限制                                                      │
│   - CORS 处理                                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         服务层 (Service Layer)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │  Auth API   │  │ Course API  │  │  Chat API   │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │  User API   │  │Knowledge API│  │ Admin API   │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│                      FastAPI Application                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       核心服务层 (Core Services)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │Model Router │  │ LLM Service │  │  TTS Service│            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │  Generator  │  │ Agent Chat  │  │ Knowledge   │            │
│   │  Service    │  │  Service    │  │  Service    │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       数据层 (Data Layer)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │ PostgreSQL  │  │   Redis     │  │    OSS      │            │
│   │  (主数据库)  │  │  (缓存)     │  │  (文件存储)  │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     外部服务层 (External Services)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │ 通义千问 LLM│  │  通义 VL    │  │  通义 TTS   │            │
│   │ (文本生成)  │  │ (多模态)    │  │ (语音合成)  │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 架构分层说明

| 层级 | 职责 | 组件 |
|------|------|------|
| 客户端层 | 用户交互、界面渲染 | iOS/Android/Web App |
| 网关层 | 请求路由、安全控制 | Nginx/Kong |
| 服务层 | 业务逻辑、API 服务 | FastAPI Routes |
| 核心服务层 | AI 能力、核心算法 | LLM、Generator、Agent |
| 数据层 | 数据持久化、缓存 | PostgreSQL、Redis、OSS |
| 外部服务层 | 第三方 AI 能力 | DashScope API |

---

## 4. 模块设计

### 4.1 移动端模块

#### 4.1.1 模块架构

```
packages/mobile/
├── app/                    # 页面路由 (Expo Router)
│   ├── (tabs)/            # 底部 Tab 页面
│   │   ├── index.tsx      # 首页
│   │   ├── courses.tsx    # 课程列表
│   │   └── profile.tsx    # 个人中心
│   ├── classroom/         # 学习页面
│   │   └── [id].tsx       # 课堂详情
│   ├── course/            # 课程详情
│   │   └── [id].tsx       # 课程详情页
│   └── _layout.tsx        # 根布局
│
├── components/            # 组件库
│   ├── common/           # 通用组件
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── BottomSheetModal.tsx
│   ├── slide/            # 幻灯片组件
│   │   ├── ScreenCanvas.tsx    # 画布组件
│   │   ├── ScreenElement.tsx   # 元素渲染
│   │   ├── TextElement.tsx     # 文本元素
│   │   └── types.ts            # 类型定义
│   └── classroom/        # 课堂组件
│       ├── WhiteboardOverlay.tsx   # 白板组件
│       ├── ChatPanel.tsx           # 对话面板
│       └── QuizPanel.tsx           # 测验面板
│
├── lib/                   # 核心库
│   ├── api/              # API 客户端
│   │   └── client.ts
│   ├── i18n/             # 国际化
│   │   └── index.ts
│   ├── whiteboard/       # 白板引擎
│   │   ├── action-engine.ts    # 动作引擎
│   │   └── element-store.ts    # 元素状态
│   ├── utils/            # 工具函数
│   │   └── scaling.ts
│   └── constants/        # 常量定义
│       └── theme.ts
│
└── assets/               # 静态资源
    ├── images/
    └── fonts/
```

#### 4.1.2 核心组件设计

**ScreenCanvas 白板画布组件**

```typescript
interface ScreenCanvasProps {
  elements: PPTElement[];           // 元素列表
  background?: SlideBackground;     // 背景
  theme?: SlideTheme;               // 主题
  spotlightElementId?: string;      // 聚焦元素
  scrollable?: boolean;             // 可滚动
  isWhiteboard?: boolean;           // 白板模式
}

// 缩放计算
const canvasScaleX = effectiveWidth / whiteboardCanvasWidth;  // 1000px 基准
const canvasScaleY = isWhiteboard ? canvasScaleX : targetHeight / VIEWPORT_HEIGHT;
```

**WhiteboardOverlay 白板组件**

```typescript
interface WhiteboardOverlayProps {
  visible: boolean;
  textContent?: string;       // 纯文本内容（兼容）
  onClose: () => void;
  useAbsolute?: boolean;      // 绝对定位模式
}

// 元素状态管理
const elements = whiteboardStore.useElements();
```

#### 4.1.3 状态管理

```
┌─────────────────────────────────────────────┐
│              Global State (Zustand)          │
├─────────────────────────────────────────────┤
│  userStore      │  用户信息、认证状态         │
│  courseStore    │  课程列表、当前课程         │
│  classroomStore │  课堂状态、对话历史         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│           Server State (React Query)         │
├─────────────────────────────────────────────┤
│  coursesQuery   │  课程数据缓存              │
│  classroomsQuery│  学习记录缓存              │
│  progressQuery  │  进度数据缓存              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│           Local State (React State)          │
├─────────────────────────────────────────────┤
│  WhiteboardStore│  白板元素状态              │
│  ChatState      │  对话输入状态              │
└─────────────────────────────────────────────┘
```

### 4.2 后端模块

#### 4.2.1 模块架构

```
packages/server-python/
├── app/
│   ├── main.py                  # 应用入口
│   ├── core/                    # 核心配置
│   │   ├── config.py           # 配置管理
│   │   ├── security.py         # 安全认证
│   │   └── dependencies.py     # 依赖注入
│   │
│   ├── routes/                  # API 路由
│   │   ├── auth.py             # 认证 API
│   │   ├── generate.py         # 课程生成 API
│   │   ├── chat.py             # 对话 API
│   │   ├── knowledge.py        # 知识库 API
│   │   ├── gamification.py     # 游戏化 API
│   │   ├── enterprise.py       # 企业 API
│   │   └── admin.py            # 管理 API
│   │
│   ├── services/                # 业务服务
│   │   ├── llm.py              # LLM 调用服务
│   │   ├── model_router.py     # 模型路由服务
│   │   ├── tts.py              # 语音合成服务
│   │   ├── agent_chat.py       # 智能体对话
│   │   │
│   │   ├── generation/         # 内容生成
│   │   │   ├── outline_generator.py   # 大纲生成
│   │   │   ├── scene_generator.py     # 场景生成
│   │   │   └── prompts/              # 提示词模板
│   │   │
│   │   ├── knowledge/          # 知识服务
│   │   │   ├── document_processor.py
│   │   │   └── qa_service.py
│   │   │
│   │   └── orchestration/      # 编排服务
│   │       └── classroom_orchestrator.py
│   │
│   ├── db/                      # 数据库
│   │   ├── models.py           # 数据模型
│   │   ├── crud.py             # CRUD 操作
│   │   └── database.py         # 数据库连接
│   │
│   ├── middleware/              # 中间件
│   │   ├── auth.py             # 认证中间件
│   │   ├── rate_limit.py       # 速率限制
│   │   └── logging.py          # 日志中间件
│   │
│   └── tests/                   # 测试
│       ├── test_routes/
│       └── test_services/
│
├── docs/                        # 文档
│   └── model-routing.md
│
└── requirements.txt             # 依赖
```

#### 4.2.2 核心服务设计

**模型路由服务 (Model Router)**

```python
class SceneType(Enum):
    """场景类型枚举"""
    OUTLINE_GENERATION = "outline_generation"    # 大纲生成
    SCENE_GENERATION = "scene_generation"        # 场景生成
    AGENT_CHAT = "agent_chat"                    # 智能体对话
    QUIZ_GRADING = "quiz_grading"                # 测验批改
    INTERACTIVE_GENERATION = "interactive"       # 交互生成
    IMAGE_DESCRIPTION = "image_description"      # 图片描述
    PDF_ANALYSIS = "pdf_analysis"                # PDF 分析
    TTS_SYNTHESIS = "tts_synthesis"              # 语音合成

class ModelRouter:
    """模型路由器"""
    
    # 场景-模型映射
    SCENE_MODEL_MAP = {
        SceneType.OUTLINE_GENERATION: "qwen3.6-plus",
        SceneType.SCENE_GENERATION: "qwen3.6-plus",
        SceneType.AGENT_CHAT: "qwen3.6-plus",
        SceneType.QUIZ_GRADING: "qwen-turbo",
        SceneType.INTERACTIVE_GENERATION: "qwen-vl-max",
        SceneType.IMAGE_DESCRIPTION: "qwen-vl-max",
        SceneType.TTS_SYNTHESIS: "qwen3-tts-flash",
    }
    
    def get_model_for_scene(self, scene_type: SceneType) -> str:
        """根据场景获取模型"""
        return self.SCENE_MODEL_MAP.get(scene_type, self.default_text_model)
```

**LLM 调用服务**

```python
async def call_llm(
    prompt: str,
    model: Optional[str] = None,
    scene_type: Optional[SceneType] = None,
    stream: bool = False,
    **kwargs
) -> Union[str, AsyncGenerator[str, None]]:
    """
    统一 LLM 调用接口
    
    Args:
        prompt: 输入提示
        model: 指定模型（优先级最高）
        scene_type: 场景类型（自动选择模型）
        stream: 是否流式输出
    
    Returns:
        文本响应或流式生成器
    """
    # 模型选择优先级：指定模型 > 场景路由 > 默认模型
    router = get_model_router()
    selected_model = model or router.get_model_for_scene(scene_type)
    
    # 调用 API
    if stream:
        return stream_llm_response(selected_model, prompt, **kwargs)
    else:
        return await call_llm_api(selected_model, prompt, **kwargs)
```

**内容生成服务**

```python
class OutlineGenerator:
    """大纲生成器"""
    
    async def generate(
        self,
        topic: str,
        target_audience: Optional[str] = None,
        learning_goals: Optional[List[str]] = None,
        language: str = "zh"
    ) -> CourseOutline:
        """
        生成课程大纲
        
        Args:
            topic: 课程主题
            target_audience: 目标受众
            learning_goals: 学习目标
            language: 语言
        
        Returns:
            CourseOutline: 结构化大纲
        """
        prompt = self._build_prompt(topic, target_audience, learning_goals)
        response = await call_llm(prompt, scene_type=SceneType.OUTLINE_GENERATION)
        return self._parse_outline(response)

class SceneGenerator:
    """场景生成器"""
    
    async def generate_slide(
        self,
        outline_item: OutlineItem,
        index: int
    ) -> SlideScene:
        """生成幻灯片场景"""
        prompt = self._build_slide_prompt(outline_item)
        response = await call_llm(
            prompt,
            scene_type=SceneType.SCENE_GENERATION
        )
        return self._parse_slide(response, index)
    
    async def generate_quiz(
        self,
        outline_item: OutlineItem,
        quiz_type: str = "multiple_choice"
    ) -> QuizScene:
        """生成测验场景"""
        prompt = self._build_quiz_prompt(outline_item, quiz_type)
        response = await call_llm(
            prompt,
            scene_type=SceneType.SCENE_GENERATION
        )
        return self._parse_quiz(response)
```

**智能体对话服务**

```python
class AgentChatService:
    """智能体对话服务"""
    
    def __init__(self):
        self.context_manager = ContextManager()
        self.action_engine = ActionEngine()
    
    async def chat(
        self,
        user_message: str,
        session_id: str,
        course_id: Optional[str] = None,
        scene_id: Optional[str] = None
    ) -> AsyncGenerator[ChatResponse, None]:
        """
        智能体对话
        
        Args:
            user_message: 用户消息
            session_id: 会话 ID
            course_id: 课程 ID
            scene_id: 当前场景 ID
        
        Yields:
            ChatResponse: 对话响应（流式）
        """
        # 1. 获取上下文
        context = await self.context_manager.get_context(session_id)
        
        # 2. 构建提示
        system_prompt = self._build_system_prompt(course_id, scene_id)
        messages = context.messages + [{"role": "user", "content": user_message}]
        
        # 3. 调用 LLM
        async for chunk in call_llm(
            prompt=messages,
            system_prompt=system_prompt,
            scene_type=SceneType.AGENT_CHAT,
            stream=True
        ):
            # 4. 解析动作
            actions = self._parse_actions(chunk)
            
            # 5. 执行白板动作
            for action in actions:
                self.action_engine.execute(action)
            
            # 6. 返回响应
            yield ChatResponse(
                content=chunk,
                actions=actions
            )
        
        # 7. 更新上下文
        await self.context_manager.update_context(session_id, messages)
```

---

## 5. 数据架构

### 5.1 数据库设计

#### 5.1.1 ER 图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    users    │     │   courses   │     │   scenes    │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id (PK)     │────▶│ creator_id  │────▶│ course_id   │
│ username    │     │ id (PK)     │     │ id (PK)     │
│ email       │     │ name        │     │ type        │
│ password    │     │ description │     │ content     │
│ role        │     │ outline     │     │ order       │
│ created_at  │     │ status      │     │ created_at  │
└─────────────┘     │ language    │     └─────────────┘
                    │ created_at  │
                    └─────────────┘
                          │
                          ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│classrooms   │     │   progress  │     │knowledge    │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id (PK)     │     │ user_id     │     │ id (PK)     │
│ user_id     │────▶│ course_id   │     │ title       │
│ course_id   │     │ scene_id    │     │ content     │
│ status      │     │ status      │     │ embedding   │
│ progress    │     │ score       │     │ created_at  │
│ created_at  │     │ duration    │     └─────────────┘
└─────────────┘     │ created_at  │
                    └─────────────┘
```

#### 5.1.2 核心数据表

**users 用户表**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 用户 ID |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| email | VARCHAR(100) | UNIQUE, NOT NULL | 邮箱 |
| password_hash | VARCHAR(255) | NOT NULL | 密码哈希 |
| role | VARCHAR(20) | DEFAULT 'learner' | 角色 |
| avatar_url | VARCHAR(255) | | 头像 URL |
| points | INTEGER | DEFAULT 0 | 积分 |
| level | INTEGER | DEFAULT 1 | 等级 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | | 更新时间 |

**courses 课程表**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 课程 ID |
| name | VARCHAR(200) | NOT NULL | 课程名称 |
| description | TEXT | | 课程描述 |
| outline | JSONB | NOT NULL | 课程大纲 |
| creator_id | UUID | FOREIGN KEY | 创建者 ID |
| status | VARCHAR(20) | DEFAULT 'draft' | 状态 |
| language | VARCHAR(10) | DEFAULT 'zh' | 语言 |
| tags | JSONB | | 标签列表 |
| difficulty | VARCHAR(20) | | 难度 |
| duration | INTEGER | | 预计时长(分钟) |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | | 更新时间 |

**scenes 场景表**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 场景 ID |
| course_id | UUID | FOREIGN KEY | 课程 ID |
| type | VARCHAR(20) | NOT NULL | 类型(slide/quiz) |
| title | VARCHAR(200) | | 标题 |
| content | JSONB | NOT NULL | 场景内容 |
| order | INTEGER | NOT NULL | 顺序 |
| duration | INTEGER | | 预计时长(秒) |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**classrooms 学习会话表**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 会话 ID |
| user_id | UUID | FOREIGN KEY | 用户 ID |
| course_id | UUID | FOREIGN KEY | 课程 ID |
| current_scene_id | UUID | | 当前场景 |
| status | VARCHAR(20) | DEFAULT 'active' | 状态 |
| progress | FLOAT | DEFAULT 0 | 进度(%) |
| duration | INTEGER | DEFAULT 0 | 学习时长(秒) |
| messages | JSONB | | 对话历史 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | | 更新时间 |

**progress 学习进度表**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 进度 ID |
| user_id | UUID | FOREIGN KEY | 用户 ID |
| course_id | UUID | FOREIGN KEY | 课程 ID |
| scene_id | UUID | FOREIGN KEY | 场景 ID |
| status | VARCHAR(20) | DEFAULT 'pending' | 状态 |
| score | INTEGER | | 分数 |
| duration | INTEGER | DEFAULT 0 | 学习时长(秒) |
| notes | TEXT | | 笔记 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| completed_at | TIMESTAMP | | 完成时间 |

### 5.2 数据流设计

#### 5.2.1 课程生成数据流

```
用户输入主题
      │
      ▼
┌─────────────┐
│ 大纲生成请求 │
└─────────────┘
      │
      ▼
┌─────────────┐     ┌─────────────┐
│ Model Router│────▶│ 通义千问 LLM│
└─────────────┘     └─────────────┘
      │                    │
      │                    ▼
      │              ┌─────────────┐
      │              │  大纲 JSON   │
      │              └─────────────┘
      │                    │
      ▼                    ▼
┌─────────────┐     ┌─────────────┐
│ 场景生成请求│────▶│ 场景内容    │
└─────────────┘     └─────────────┘
      │                    │
      ▼                    ▼
┌─────────────┐     ┌─────────────┐
│  courses 表 │     │ scenes 表   │
└─────────────┘     └─────────────┘
```

#### 5.2.2 智能体对话数据流

```
用户消息
      │
      ▼
┌─────────────┐
│ 获取上下文   │◀──── Redis 缓存
└─────────────┘
      │
      ▼
┌─────────────┐     ┌─────────────┐
│ 构建提示词   │────▶│ 通义千问 LLM│
└─────────────┘     └─────────────┘
      │                    │
      │                    ▼
      │              ┌─────────────┐
      │              │  流式响应   │
      │              └─────────────┘
      │                    │
      ▼                    ▼
┌─────────────┐     ┌─────────────┐
│ 解析动作    │────▶│ 白板渲染    │
└─────────────┘     └─────────────┘
      │
      ▼
┌─────────────┐
│ 更新上下文   │────▶ Redis 缓存
└─────────────┘
```

### 5.3 缓存策略

#### 5.3.1 缓存层次

| 层级 | 缓存类型 | 数据 | TTL |
|------|----------|------|-----|
| L1 | 内存缓存 | 热点数据 | 1min |
| L2 | Redis | 会话、用户信息 | 1h |
| L3 | 数据库 | 持久化数据 | - |

#### 5.3.2 缓存规则

| 数据类型 | 缓存策略 | Key 格式 |
|----------|----------|----------|
| 用户信息 | Cache-Aside | user:{user_id} |
| 课程大纲 | Read-Through | course:{course_id}:outline |
| 对话上下文 | Write-Through | session:{session_id}:context |
| LLM 响应 | Cache-Aside (可选) | llm:hash:{prompt_hash} |

---

## 6. API 设计

### 6.1 API 规范

#### 6.1.1 RESTful API 规范

```
基础 URL: https://api.openmaic.com/v1

资源命名:
- 复数形式: /courses, /users, /classrooms
- 嵌套资源: /courses/{id}/scenes

HTTP 方法:
- GET: 查询
- POST: 创建
- PUT: 更新(全量)
- PATCH: 更新(部分)
- DELETE: 删除
```

#### 6.1.2 响应格式

**成功响应**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    // 业务数据
  }
}
```

**分页响应**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "page_size": 20,
    "pages": 5
  }
}
```

**错误响应**

```json
{
  "code": 400,
  "message": "参数错误",
  "errors": [
    {
      "field": "name",
      "message": "课程名称不能为空"
    }
  ]
}
```

### 6.2 核心 API

#### 6.2.1 认证 API

| 接口 | 方法 | 说明 |
|------|------|------|
| /auth/register | POST | 用户注册 |
| /auth/login | POST | 用户登录 |
| /auth/logout | POST | 用户登出 |
| /auth/refresh | POST | 刷新 Token |
| /auth/password | PUT | 修改密码 |

**登录请求**

```typescript
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "code": 200,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "bearer",
    "expires_in": 604800
  }
}
```

#### 6.2.2 课程 API

| 接口 | 方法 | 说明 |
|------|------|------|
| /courses | GET | 课程列表 |
| /courses | POST | 创建课程 |
| /courses/{id} | GET | 课程详情 |
| /courses/{id} | PUT | 更新课程 |
| /courses/{id} | DELETE | 删除课程 |
| /courses/{id}/outline | GET | 获取大纲 |
| /courses/{id}/outline | PUT | 更新大纲 |
| /courses/{id}/scenes | GET | 场景列表 |
| /courses/{id}/publish | POST | 发布课程 |

**创建课程请求**

```typescript
POST /courses
{
  "name": "Python 入门教程",
  "description": "从零开始学习 Python",
  "target_audience": "初学者",
  "learning_goals": ["掌握基本语法", "理解面向对象"],
  "language": "zh"
}

Response:
{
  "code": 200,
  "data": {
    "id": "uuid",
    "name": "Python 入门教程",
    "outline": {
      "chapters": [
        {
          "title": "第一章 Python 简介",
          "scenes": [...]
        }
      ]
    },
    "status": "draft"
  }
}
```

#### 6.2.3 学习 API

| 接口 | 方法 | 说明 |
|------|------|------|
| /classrooms | GET | 学习会话列表 |
| /classrooms | POST | 创建学习会话 |
| /classrooms/{id} | GET | 会话详情 |
| /classrooms/{id}/progress | PUT | 更新进度 |
| /classrooms/{id}/chat | POST | AI 对话 |
| /classrooms/{id}/complete | POST | 完成学习 |

**AI 对话请求 (流式)**

```typescript
POST /classrooms/{id}/chat
Content-Type: application/json
Accept: text/event-stream

{
  "message": "这个公式是什么意思？",
  "scene_id": "uuid"
}

Response (SSE):
event: message
data: {"content": "这是一个二次方程", "actions": []}

event: message
data: {"content": "的求根公式", "actions": [{"type": "wb_draw_latex", "params": {...}}]}

event: done
data: {}
```

---

## 7. 安全设计

### 7.1 认证授权

#### 7.1.1 JWT 认证流程

```
┌─────────┐                ┌─────────┐                ┌─────────┐
│  Client │                │  Server │                │Database │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     │  1. 登录请求              │                          │
     │  (email, password)       │                          │
     │─────────────────────────▶│                          │
     │                          │  2. 验证密码              │
     │                          │─────────────────────────▶│
     │                          │◀─────────────────────────│
     │                          │  3. 用户信息              │
     │  4. JWT Token            │                          │
     │◀─────────────────────────│                          │
     │                          │                          │
     │  5. API 请求 + Token      │                          │
     │─────────────────────────▶│                          │
     │                          │  6. 验证 Token            │
     │  7. 响应数据              │                          │
     │◀─────────────────────────│                          │
```

#### 7.1.2 Token 结构

```json
{
  "sub": "user_id",
  "iat": 1234567890,
  "exp": 1234567890,
  "role": "learner",
  "permissions": ["read:courses", "write:progress"]
}
```

### 7.2 数据安全

| 安全措施 | 说明 |
|----------|------|
| 密码加密 | bcrypt, cost factor >= 12 |
| 传输加密 | TLS 1.2+ |
| 敏感数据加密 | AES-256 |
| SQL 注入防护 | ORM 参数化查询 |
| XSS 防护 | 输入过滤、输出编码 |
| CSRF 防护 | Token 验证 |

### 7.3 API 安全

| 措施 | 配置 |
|------|------|
| 速率限制 | 100 req/min/user |
| 请求大小限制 | 10MB |
| 超时限制 | 30s |
| CORS | 白名单域名 |

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| API P99 响应时间 | < 500ms | 常规 API |
| 流式首字延迟 | < 2s | LLM 流式 |
| 白板渲染帧率 | > 30fps | 动画流畅 |
| 并发用户数 | > 1000 | 单节点 |
| 可用性 | > 99.9% | 年度 |

### 8.2 性能优化策略

#### 8.2.1 后端优化

| 优化项 | 方案 |
|--------|------|
| 异步处理 | asyncio + async/await |
| 数据库优化 | 索引、连接池、查询优化 |
| 缓存策略 | Redis 多级缓存 |
| 流式输出 | SSE 流式响应 |
| 连接复用 | HTTP/2, Keep-Alive |

#### 8.2.2 移动端优化

| 优化项 | 方案 |
|--------|------|
| 列表渲染 | FlatList 虚拟列表 |
| 图片加载 | 渐进式、懒加载、缓存 |
| 状态管理 | 细粒度订阅 |
| 动画优化 | useNativeDriver |
| 包体积 | Code Splitting |

---

## 9. 部署架构

### 9.1 部署拓扑

```
┌───────────────────────────────────────────────────────────────┐
│                         负载均衡层                             │
│                    Nginx / ALB / CloudFlare                   │
└───────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   API Server 1  │ │   API Server 2  │ │   API Server N  │
│   (FastAPI)     │ │   (FastAPI)     │ │   (FastAPI)     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   PostgreSQL    │ │     Redis       │ │      OSS        │
│   (Primary)     │ │   (Cluster)     │ │   (Storage)     │
│                 │ │                 │ │                 │
│   PostgreSQL    │ │                 │ │                 │
│   (Replica)     │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 9.2 容器化部署

**Dockerfile 示例**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**docker-compose.yml**

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/openmaic
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: openmaic
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 10. 扩展设计

### 10.1 模型扩展

```python
# 注册新模型提供商
router.register_model(
    "gpt-4o",
    ModelConfig(
        model_id="gpt-4o",
        provider="openai",
        api_base="https://api.openai.com/v1",
        api_key_env="OPENAI_API_KEY",
        max_tokens=4096,
        capabilities=[ModelCapability.TEXT, ModelCapability.VISION],
    )
)

# 配置场景模型
router.set_scene_model(SceneType.AGENT_CHAT, "gpt-4o")
```

### 10.2 内容模板扩展

```yaml
# templates/quiz_template.yaml
name: "编程测验模板"
description: "用于编程课程的测验模板"
quiz_types:
  - type: multiple_choice
    count: 5
  - type: code_completion
    count: 3
  - type: short_answer
    count: 2
grading:
  auto_grade: true
  ai_feedback: true
```

### 10.3 白板元素扩展

```typescript
// 自定义白板元素
interface CustomElement extends PPTElement {
  type: 'custom';
  customType: string;
  customData: any;
}

// 注册自定义元素渲染器
ElementRenderer.register('custom', {
  render: (element: CustomElement) => {
    // 自定义渲染逻辑
  }
});
```

---

## 11. 附录

### 11.1 技术选型对比

#### 11.1.1 后端框架对比

| 框架 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| FastAPI | 高性能、异步、自动文档 | 生态较新 | ✅ 选择 |
| Django | 成熟、功能全 | 性能较低 | ❌ |
| Flask | 轻量、灵活 | 需自行配置多 | ❌ |

#### 11.1.2 移动端框架对比

| 框架 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| React Native + Expo | 跨平台、开发快、热更新 | 性能略低于原生 | ✅ 选择 |
| Flutter | 性能好、UI 统一 | 包体大、Dart 学习成本 | ❌ |
| 原生开发 | 性能最优 | 开发成本高、需两套代码 | ❌ |

### 11.2 术语表

| 术语 | 说明 |
|------|------|
| LLM | Large Language Model，大语言模型 |
| SSE | Server-Sent Events，服务器推送事件 |
| JWT | JSON Web Token，JSON 网络令牌 |
| ORM | Object-Relational Mapping，对象关系映射 |
| RBAC | Role-Based Access Control，基于角色的访问控制 |

---

**文档结束**