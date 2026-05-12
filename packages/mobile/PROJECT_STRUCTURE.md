# OpenMAIC 项目文件结构说明

## 概述

OpenMAIC (Open Multi-Agent Interactive Classroom) 是一个开源的AI驱动的多智能体互动课堂平台。项目采用 Monorepo 架构，包含 Web 应用、Python 后端服务、移动端应用等多个子项目。

---

## 顶层目录结构

```
openmaic-business/
├── lib/                    # Web端核心库 (Next.js共享代码)
├── packages/               # 子项目目录
│   ├── admin/              # Admin Dashboard (Next.js)
│   ├── main-project/       # 主项目 (Next.js)
│   ├── mobile/             # 移动端应用 (React Native/Expo)
│   ├── server-python/      # Python后端服务 (FastAPI)
│   ├── website/            # 官网 (Next.js)
│   ├── pptxgenjs/          # PPT生成库
│   └── mathml2omml/        # MathML转OMML工具
├── docs/                   # 项目文档
├── scripts/                # 脚本工具
├── community/              # 社区相关文档
├── assets/                 # 静态资源
├── docker-compose.yml      # Docker编排配置
├── README.md               # 项目说明文档
├── CHANGELOG.md            # 变更日志
└── CONTRIBUTING.md         # 贡献指南
```

---

## lib/ - Web端核心库

Web端核心业务逻辑和共享组件，供各Next.js应用使用。

### 目录结构

```
lib/
├── action/                 # Action类型定义和处理
│   └── action-types.ts     # Action类型枚举
│
├── ai/                     # AI服务集成
│   ├── llm.ts              # LLM统一调用接口
│   ├── providers.ts        # 多Provider支持 (OpenAI/Anthropic/DeepSeek等)
│   └── thinking-config.ts  # Thinking参数配置
│
├── api/                    # API客户端
│   ├── stage-api.ts        # Stage数据操作API
│   ├── classroom-api.ts    # Classroom相关API
│   └── web-search-config.ts # Web Search配置
│
├── audio/                  # 音频处理
│   ├── tts-service.ts      # TTS服务 (OpenAI/Minimax/VoxCPM)
│   └── asr-service.ts      # ASR语音识别
│
├── chat/                   # 聊天功能
│   └── chat-history.ts     # 聊天历史管理
│
├── generation/             # 课程生成管道 ⭐核心模块
│   ├── outline-generator.ts    # Stage 1: 大纲生成
│   ├── scene-generator.ts      # Stage 2: 场景内容+Actions生成
│   ├── scene-builder.ts        # 场景构建辅助函数
│   ├── action-parser.ts        # Action解析器
│   ├── json-repair.ts          # JSON修复工具
│   ├── prompt-formatters.ts    # Prompt格式化工具
│   ├── pipeline-runner.ts      # 生成管道运行器
│   ├── interactive-post-processor.ts  # Interactive HTML后处理
│   └── prompts-zh-CN/          # 中文Prompt模板
│
├── media/                  # 媒体生成
│   ├── image-providers.ts  # 图片生成 (DALL-E/Stable Diffusion)
│   ├── video-providers.ts  # 视频生成 (Runway/Pika)
│   ├── media-orchestrator.ts   # 媒体编排器
│   ├── video-manifest.ts   # 视频清单管理
│   └── adapters/           # 各Provider适配器
│
├── orchestration/          # Agent编排
│   ├── registry/           # Agent注册中心
│   │   ├── store.ts        # Agent状态存储
│   │   └── defaults.ts     # 默认Agent配置
│   └── discussion-engine.ts    # 多Agent讨论引擎
│
├── pbl/                    # 项目式学习(PBL)
│   ├── generate-pbl.ts     # PBL项目生成
│   └── pbl-types.ts        # PBL类型定义
│
├── pdf/                    # PDF处理
│   ├── pdf-extractor.ts    # PDF文本/图片提取
│   └── pdf-image-utils.ts  # PDF图片处理工具
│
├── playback/               # 播放控制
│   ├── playback-engine.ts  # 播放引擎核心
│   ├── playback-store.ts   # 播放状态管理
│   └── action-executor.ts  # Action执行器
│
├── prompts/                # Prompt模板系统 ⭐新增
│   ├── loader.ts           # 模板加载器
│   ├── index.ts            # Prompt构建入口
│   ├── types.ts            # Prompt类型定义
│   ├── templates/          # 模板文件目录
│   │   ├── requirements-to-outlines/   # 大纲生成模板
│   │   ├── slide-content/              # Slide内容模板
│   │   ├── slide-actions/              # Slide Actions模板
│   │   ├── quiz-content/               # Quiz内容模板
│   │   ├── quiz-actions/               # Quiz Actions模板
│   │   ├── simulation-content/         # 物理模拟模板
│   │   ├── game-content/               # 游戏练习模板
│   │   ├── diagram-content/            # 流程图模板
│   │   ├── code-content/               # 代码演示模板
│   │   ├── visualization3d-content/    # 3D可视化模板
│   │   ├── interactive-actions/        # Interactive Actions模板
│   │   ├── pbl-actions/                # PBL Actions模板
│   │   ├── director/                   # Director模板
│   │   └ agent-system/                 # Agent System Prompt
│   │   ├── agent-system-wb-teacher/    # 教师白板Prompt
│   │   ├── agent-system-wb-assistant/  # 助教白板Prompt
│   │   └ agent-system-wb-student/      # 学生白板Prompt
│   │   └ snippets/                     # Snippet片段
│   │   │   ├── image-instructions.md   # 图片生成指令
│   │   │   ├── video-instructions.md   # 视频生成指令
│   │   │   ├── speech-guidelines.md    # 语音指南
│   │   │   ├── whiteboard-reference.md # 白板参考 (17KB)
│   │   │   └ element-types.md          # 元素类型定义
│   │   │   ├── action-types.md         # Action类型定义
│   │   │   └── json-output-rules.md    # JSON输出规则
│   │   └── ...
│   │
├── quiz/                   # Quiz系统
│   ├── persistence.ts      # 状态持久化 (localStorage三层存储)
│   └ grading.ts            # 自动评分逻辑
│   │
├── server/                 # 服务端功能
│   ├── classroom-generation.ts  # 课程生成主流程 ⭐核心
│   ├── classroom-media-generation.ts # 媒体生成
│   ├── classroom-storage.ts    # 课程存储
│   ├── classroom-job-store.ts  # 任务队列存储
│   ├── resolve-model.ts        # 模型动态选择
│   ├── web-search-config.ts    # Web Search配置
│   ├── search-query-builder.ts # 搜索查询构建
│   ├── provider-config.ts      # Provider配置
│   └ ssrf-guard.ts             # SSRF防护
│   │
├── store/                  # 状态管理
│   ├── classroom-store.ts  # Classroom状态
│   ├── playback-store.ts   # 播放状态
│   └── agent-store.ts      # Agent状态
│   │
├── types/                  # 类型定义
│   ├── generation.ts       # 生成相关类型
│   ├── stage.ts            # Stage类型
│   ├── action.ts           # Action类型
│   ├── slides.ts           # Slide类型
│   ├── widgets.ts          # Widget类型
│   ├── provider.ts         # Provider类型
│   └ scene.ts              # Scene类型
│   │
├── web-search/             # 网络搜索
│   ├── tavily.ts           # Tavily搜索
│   ├── bocha.ts            # Bocha搜索
│   ├── format.ts           # 结果格式化
│   └ types.ts              # 搜索类型
│   │
├── export/                 # 导出功能
│   ├── pptx-exporter.ts    # PPT导出
│   ├── html-exporter.ts    # HTML导出
│   └ zip-export.ts         # ZIP打包导出
│   │
├── hooks/                  # React Hooks
│   ├── use-classroom.ts    # Classroom Hook
│   ├── use-playback.ts     # 播放Hook
│   ├── use-draft-cache.ts  # 草稿缓存Hook
│   └ use-agent.ts          # Agent Hook
│   │
├── utils/                  # 工具函数
│   ├── json-utils.ts       # JSON工具
│   ├── date-utils.ts       # 日期工具
│   ├── format-utils.ts     # 格式化工具
│   └ validation.ts         # 验证工具
│   │
├── constants/              # 常量定义
│   ├── generation.ts       # 生成常量
│   ├── theme.ts            # 主题常量
│   ├── agent-defaults.ts   # Agent默认配置
│   │
├── i18n/                   # 国际化
│   ├── locales/            # 语言文件
│   └ config.ts             # i18n配置
│   │
├── audio/                  # 音频处理
├── contexts/               # React Context
├── import/                 # 导入功能
├── storage/                # 存储服务
├── buffer/                 # Buffer处理
├── prosemirror/            # ProseMirror编辑器
└── classroom/              # Classroom相关
```

---

## packages/server-python/ - Python后端服务

FastAPI实现的Python后端，提供课程生成、LLM调用、TTS等服务。

### 目录结构

```
packages/server-python/
├── app/
│   ├── main.py                 # FastAPI应用入口
│   ├── core/
│   │   ├── config.py           # 配置管理
│   │   └ database.py           # 数据库连接
│   │   └ security.py           # 安全认证
│   │   └── dependencies.py     # 依赖注入
│   │
│   ├── routes/                 # API路由
│   │   ├── classrooms.py       # 课程CRUD + 生成
│   │   ├── chat.py             # 聊天接口
│   │   ├── agents.py           # Agent接口
│   │   ├── personas.py         # Persona接口
│   │   ├── generate.py         # 生成接口
│   │   ├── tts.py              # TTS接口
│   │   └ scenes.py             # Scene接口
│   │   └── knowledge.py        # 知识库接口
│   │
│   ├── services/               # 业务服务 ⭐核心
│   │   ├── llm.py              # LLM统一接口 (支持Thinking参数)
│   │   ├── model_metadata.py   # 模型元数据 (Thinking配置) ⭐新增
│   │   ├── tts_service.py      # TTS服务
│   │   ├── scene_service.py    # Scene服务
│   │   ├── pdf_service.py      # PDF处理服务
│   │   ├── web_search_service.py # Web搜索服务
│   │   ├── generation/         # 生成模块
│   │   │   ├── outline_generator.py   # 大纲生成 (widget_type/widget_outline)
│   │   │   ├── scene_generator.py     # 场景生成 (Interactive支持)
│   │   │   ├── agent_generator.py     # Agent生成
│   │   │   ├── prompts/               # Prompt模板系统 ⭐新增
│   │   │   │   ├── __init__.py        # 模板加载器 (snippet/条件块)
│   │   │   │   ├── slide_content_system.py  # Slide Prompt
│   │   │   │   ├── slide_content_simple.py  # Simplified Prompt
│   │   │   │   ├── templates/               # 模板文件
│   │   │   │   │   ├── requirements-to-outlines/
│   │   │   │   │   ├── slide-content/
│   │   │   │   │   ├── simulation-content/
│   │   │   │   │   ├── game-content/
│   │   │   │   │   ├── diagram-content/
│   │   │   │   │   ├── code-content/
│   │   │   │   │   ├── visualization3d-content/
│   │   │   │   │   └ snippets/             # Snippet片段
│   │   │   │   │   ├── image-instructions.md
│   │   │   │   │   ├── video-instructions.md
│   │   │   │   │   ├── speech-guidelines.md
│   │   │   │   │   └ ...
│   │   │   │   └
│   │   │   └ orchestration/         # Agent编排
│   │   │   │   ├── director_graph.py     # LangGraph编排
│   │   │   │   └ ...
│   │   │   │
│   │   ├── knowledge/           # 知识库服务
│   │   └
│   ├── models/                 # 数据模型
│   │   ├── classroom.py        # Classroom模型
│   │   ├── scene.py            # Scene模型
│   │   ├── agent.py            # Agent模型
│   │   └ user.py               # User模型
│   │   └
│   ├── schemas/                # Pydantic Schema
│   │   ├── classroom.py        # Classroom Schema
│   │   ├── scene.py            # Scene Schema
│   │   └ agent.py              # Agent Schema
│   │   └
│   ├── db/                     # 数据库操作
│   │   ├── classroom_db.py     # Classroom CRUD
│   │   ├── scene_db.py         # Scene CRUD
│   │   └ agent_db.py           # Agent CRUD
│   │   └
│   └── middleware/             # 中间件
│       ├── auth.py             # 认证中间件
│       ├── cors.py             # CORS中间件
│       └
│   ├── alembic/                # 数据库迁移
│   │   ├── versions/           # 迁移版本
│   │   └ env.py                # Alembic环境
│   │   └
│   └── tests/                  # 测试文件 ⭐新增
│       ├── test_prompt_system.py      # Prompt系统测试 (21 tests)
│       ├── test_thinking_config.py    # Thinking配置测试 (17 tests)
│       ├── test_scene_generator.py    # Scene生成测试 (17 tests)
│       ├── test_api_flow.py           # API流程测试
│       ├── test_course_flow.py        # 课程流程测试
│       └ integration.py               # 集成测试
│       └ auth.py                      # 认证测试
│       └
├── requirements.txt            # Python依赖
├── Dockerfile                  # Docker镜像配置
├── alembic.ini                 # Alembic配置
├── pytest.ini                  # pytest配置
└ README.md                    # 服务说明文档
└── .env.example               # 环境变量示例
```

### 核心服务说明

| 服务 | 文件 | 功能 |
|------|------|------|
| **LLM统一接口** | `llm.py` | 多Provider调用、Thinking参数、流式输出 |
| **模型元数据** | `model_metadata.py` | Thinking能力配置表、Provider参数映射 |
| **大纲生成** | `outline_generator.py` | 需求→大纲、widget_type/widget_outline字段 |
| **场景生成** | `scene_generator.py` | 内容+Actions生成、Interactive Widget支持 |
| **Agent生成** | `agent_generator.py` | 动态生成Agent配置、默认5角色 |
| **Prompt系统** | `prompts/__init__.py` | 模板加载、snippet/条件块处理、变量插值 |

---

## packages/mobile/ - 移动端应用

React Native/Expo实现的移动端应用，支持iOS和Android。

### 目录结构

```
packages/mobile/
├── app/                       # Expo Router页面
│   ├── (tabs)/                # Tab导航页面
│   │   ├── index.tsx          # 首页
│   │   ├── courses.tsx        # 课程列表
│   │   ├── discover.tsx       # 发现页面
│   │   ├── matching.tsx       # 匹配页面
│   │   ├── knowledge.tsx      # 知识页面
│   │   ├── notes.tsx          # 笔记页面
│   │   ├── profile.tsx        # 个人中心
│   │   ├── gamification.tsx   # 游戏化页面
│   │   ├── buddy.tsx          # AI伙伴
│   │   └ payment.tsx          # 支付页面
│   │   └ invite.tsx           # 邀请页面
│   │   └
│   ├── classroom/             # Classroom页面 ⭐核心
│   │   ├── [id].tsx           # 课堂详情/播放页面
│   │   ├── create.tsx         # 课程创建页面
│   │   └ assessment/          # 评估页面
│   │   │   └ [id].tsx         # 课程评估详情
│   │   │   └
│   ├── auth/                  # 认证页面
│   │   ├── login.tsx          # 登录
│   │   ├── register.tsx       # 注册
│   │   └
│   ├── knowledge/             # 知识详情
│   │   ├── [id].tsx           # 知识详情页
│   │   └
│   └ layout.tsx               # 根布局
│   └
│   ├── components/            # React Native组件
│   │   ├── slide/             # Slide渲染组件
│   │   │   ├── ScreenCanvas.tsx   # Canvas容器
│   │   │   ├── SlideBackground.tsx # 背景渲染
│   │   │   ├── TextElement.tsx    # 文本元素
│   │   │   ├── ShapeElement.tsx   # 形状元素
│   │   │   ├── ImageElement.tsx   # 图片元素
│   │   │   ├── LatexElement.tsx   # LaTeX元素
│   │   │   ├── ChartElement.tsx   # 图表元素
│   │   │   ├── LineElement.tsx    # 线条元素
│   │   │   └
│   │   ├── classroom/         # Classroom组件
│   │   │   ├── WhiteboardOverlay.tsx  # 白板覆盖层
│   │   │   ├── AgentAvatar.tsx        # Agent头像
│   │   │   ├── SpeechBubble.tsx       # 对话气泡
│   │   │   ├── SpotlightOverlay.tsx   # 聚光灯效果
│   │   │   ├── ThumbnailNav.tsx       # 场景缩略图导航
│   │   │   ├── QuizView.tsx           # Quiz渲染
│   │   │   ├── InteractiveView.tsx    # Interactive渲染
│   │   │   └
│   │   ├── quiz/              # Quiz组件
│   │   │   ├── QuestionCard.tsx       # 问题卡片
│   │   │   ├── OptionsList.tsx        # 选项列表
│   │   │   ├── ResultDisplay.tsx      # 结果展示
│   │   │   └
│   │   ├── navigation/        # 导航组件
│   │   ├── common/            # 通用组件
│   │   └
│   ├── lib/                   # 核心库
│   │   ├── api-client/        # API客户端
│   │   │   ├── index.ts       # API统一入口
│   │   │   ├── classroom.ts   # Classroom API
│   │   │   ├── auth.ts        # Auth API
│   │   │   └
│   │   ├── playback/          # 播放引擎 ⭐核心
│   │   │   ├── engine.ts      # 播放引擎核心
│   │   │   ├── audio-player.ts    # 音频播放器
│   │   │   ├── index.ts       # 导出入口
│   │   │   └
│   │   ├── quiz/              # Quiz系统 ⭐已完善
│   │   │   ├── persistence.ts # 状态持久化 (AsyncStorage)
│   │   │   └ grading.ts       # 评分逻辑
│   │   │   └
│   │   ├── types/             # 类型定义
│   │   │   ├── scene.ts       # Scene类型
│   │   │   ├── agent.ts       # Agent类型
│   │   │   ├── action.ts      # Action类型
│   │   │   └
│   │   ├── constants/         # 常量
│   │   │   ├── theme.ts       # 主题常量
│   │   │   └
│   │   ├── hooks/             # React Hooks
│   │   ├── auth/              # 认证
│   │   ├── classroom/         # Classroom
│   │   ├── configs/           # 配置
│   │   ├── storage/           # 存储
│   │   ├── i18n/              # 国际化
│   │   └
│   ├── app.json               # Expo配置
│   ├── package.json           # 项目依赖
│   ├── tsconfig.json          # TypeScript配置
│   ├── eas.json               # EAS Build配置
│   ├── README.md              # 项目说明
│   ├── BUSINESS_LOGIC_ANALYSIS.md  # 业务逻辑分析 ⭐新增
│   ├── ALIGNMENT_SUMMARY.md        # 对齐总结 ⭐新增
│   ├── FIX_SUMMARY.md              # 修复总结 ⭐新增
│   ├── TEST_PLAN.md               # 测试计划 ⭐新增
│   ├── VERIFICATION_GUIDE.md       # 验证指南 ⭐新增
│   └── IMPLEMENTATION_COMPARISON.md # 实现对比 ⭐新增
```

### 核心模块说明

| 模块 | 文件 | 功能 |
|------|------|------|
| **课堂播放** | `app/classroom/[id].tsx` | 场景播放、Quiz答题、Agent交互 |
| **播放引擎** | `lib/playback/engine.ts` | Action执行、场景切换、音频控制 |
| **Quiz持久化** | `lib/quiz/persistence.ts` | 三层存储 (draft/answers/results)、状态恢复 |
| **API客户端** | `lib/api-client/index.ts` | 与Python后端通信 |

---

## packages/admin/ - Admin Dashboard

管理员后台，用于课程管理、用户管理、系统配置。

```
packages/admin/
├── app/                       # Next.js App Router
│   ├── (dashboard)/           # Dashboard页面
│   │   ├── classrooms/        # 课程管理
│   │   ├── users/             # 用户管理
│   │   ├── agents/            # Agent管理
│   │   ├── settings/          # 系统设置
│   │   └
│   ├── components/            # React组件
│   ├── lib/                   # 工具库
│   └
├── Dockerfile                 # Docker配置
├── package.json               # 依赖
├── README.md                  # 说明文档
```

---

## packages/main-project/ - 主项目

主应用入口，整合所有功能。

```
packages/main-project/
├── app/                       # Next.js App Router
│   ├── (auth)/                # 认证相关页面
│   ├── classroom/             # Classroom页面
│   ├── api/                   # API Routes
│   └
├── components/                # React组件
├── lib/                       # 工具库 (引用顶层lib)
├── Dockerfile                 # Docker配置
├── package.json               # 依赖
├── README.md                  # 说明文档
```

---

## packages/website/ - 官网

产品官网，展示功能介绍、案例等。

```
packages/website/
├── app/                       # Next.js App Router
│   ├── (marketing)/           # 营销页面
│   ├── features/              # 功能介绍
│   ├── cases/                 # 使用案例
│   ├── pricing/               # 价格方案
│   └
├── components/                # React组件
├── Dockerfile                 # Docker配置
├── package.json               # 依赖
```

---

## docs/ - 项目文档

```
docs/
├── api/                       # API文档
│   ├── classroom-api.md       # Classroom API
│   ├── agent-api.md           # Agent API
│   └
├── design/                    # 设计文档
│   ├── architecture.md        # 架构设计
│   ├── generation-pipeline.md # 生成管道设计
│   ├── widget-system.md       # Widget系统设计
│   ├── agent-orchestration.md # Agent编排设计
│   ├── prompt-system.md       # Prompt系统设计
│   ├── quiz-system.md         # Quiz系统设计
│   ├── playback-engine.md     # 播放引擎设计
│   └
├── deployment/                # 部署文档
│   ├── docker.md              # Docker部署
│   ├── vercel.md              # Vercel部署
│   ├── self-hosted.md         # 自托管部署
│   └
├── marketing/                 # 营销文档
│   ├── features.md            # 功能介绍
│   ├── use-cases.md            # 使用案例
│   └
├── performance/               # 性能文档
│   ├── optimization.md        # 性能优化
│   └
├── progress/                  # 进度文档
│   ├── phase1.md              # Phase 1进度
│   ├── phase2.md              # Phase 2进度
│   └
├── requirements/              # 需求文档
│   ├── features.md            # 功能需求
│   └
├── superpowers/               # AI能力文档
│   ├── thinking-config.md     # Thinking配置
│   ├── providers.md           # Provider支持
│   └
├── business-features.md       # 业务功能文档
├── moat-improvement-plan.md   # 护城河改进计划
├── next-phase-plan.md         # 下一阶段计划
├── phase1-completion-report.md # Phase 1完成报告
├── phase2-progress-report.md  # Phase 2进度报告
├── performance-optimization.md # 性能优化文档
├── videotutor-analysis-*.md   # VideoTutor分析文档
├── README.md                  # 文档索引
```

---

## scripts/ - 脚本工具

```
scripts/
├── restart-python.sh          # 重启Python服务
├── update-python-service.sh   # 更新Python服务
├── build-all.sh               # 构建所有项目
├── deploy.sh                  # 部署脚本
└── ...
```

---

## 关键配置文件

| 文件 | 用途 |
|------|------|
| `docker-compose.yml` | Docker编排配置 (Python/PostgreSQL/Redis) |
| `.env.example` | 环境变量示例 |
| `pnpm-workspace.yaml` | Monorepo工作空间配置 |
| `turbo.json` | Turborepo配置 |
| `.eslintrc.js` | ESLint配置 |
| `.prettierrc` | Prettier配置 |
| `tsconfig.json` | TypeScript配置 (根目录) |

---

## 数据流概览

### 课程生成流程

```
用户需求 → lib/server/classroom-generation.ts
         ↓
    1. resolveModel() → 选择LLM Provider
         ↓
    2. Web Search → researchContext (可选)
         ↓
    3. generateSceneOutlinesFromRequirements() → 大纲生成
         ↓
    4. generateAgentProfiles() → Agent生成 (可选)
         ↓
    5. generateSceneContent() → 场景内容生成
         │   ├─ slide → generateSlideContent()
         │   ├─ quiz → generateQuizContent()
         │   ├─ interactive → generateWidgetContent()
         │   └─ pbl → generatePBLContent()
         ↓
    6. generateSceneActions() → Actions生成
         ↓
    7. generateMediaForClassroom() → 图片/视频生成 (可选)
         ↓
    8. generateTTSForClassroom() → TTS音频生成 (可选)
         ↓
    9. persistClassroom() → 存储到数据库
         ↓
    返回 classroomId + URL
```

### Python端生成流程

```
用户需求 → packages/server-python/routes/classrooms.py
         ↓
    1. generate_outlines() → 大纲生成
         ↓
    2. get_default_agents() / generate_agent_profiles() → Agent配置
         ↓
    3. generate_scene_content() → 场景内容
         ↓
    4. create_scene() → 创建场景
         ↓
    返回 classroomId
```

### 移动端播放流程

```
classroomId → packages/mobile/app/classroom/[id].tsx
         ↓
    1. fetchClassroom() → 获取课程数据
         ↓
    2. PlaybackEngine.init() → 初始化播放引擎
         ↓
    3. loadScene() → 加载当前场景
         │   ├─ slide → Canvas渲染
         │   ├─ quiz → QuizView + persistence
         │   ├─ interactive → WebView渲染
         │   └─ pbl → PBLView
         ↓
    4. executeActions() → 执行Actions
         │   ├─ speech → AudioPlayer播放
         │   ├─ spotlight → 聚光灯效果
         │   ├─ discussion → Agent对话
         │   └ widget_* → Widget交互
         ↓
    5. nextScene() → 切换场景
         ↓
    播放完成
```

---

## 技术栈概览

| 层级 | 技术 | 用途 |
|------|------|------|
| **前端** | Next.js 16 + React 19 | Web应用框架 |
| **前端** | TypeScript 5 | 类型安全 |
| **前端** | Tailwind CSS 4 | UI样式 |
| **移动端** | React Native + Expo | 跨平台移动应用 |
| **后端** | Python + FastAPI | Python服务 |
| **后端** | LangGraph | Agent编排 |
| **数据库** | PostgreSQL | 数据存储 |
| **缓存** | Redis | 任务队列/缓存 |
| **AI** | OpenAI/Anthropic/DeepSeek/Qwen | LLM Provider |
| **AI** | DALL-E/Stable Diffusion | 图片生成 |
| **AI** | Runway/Pika | 视频生成 |
| **TTS** | OpenAI/Minimax/VoxCPM | 语音合成 |
| **部署** | Docker + Docker Compose | 容器化部署 |
| **部署** | Vercel | 云部署 |

---

## Monorepo工作空间

项目使用 pnpm workspace 管理，各包之间的关系：

```
根目录 lib/ ←── packages/main-project/ (引用)
          ←── packages/admin/ (引用)
          ←── packages/website/ (引用)

packages/server-python/ ←── 提供 API
                        ↓
          packages/mobile/ ←── 调用 API
```

---

## 更新日志

- **2026-05-12**: 添加Prompt系统、Thinking配置、Quiz持久化文档
- **2026-04-26**: v0.2.1 - VoxCPM TTS、thinking config、quiz persistence
- **2026-04-20**: v0.2.0 - Deep Interactive Mode (Ultra Mode)
- **2026-04-14**: v0.1.1 - 语言推断、认证、导出/导入

---

## 相关文档

- [业务逻辑分析](packages/mobile/BUSINESS_LOGIC_ANALYSIS.md) - Web端/Python端/Mobile端差异
- [Prompt系统设计](docs/design/prompt-system.md) - Prompt模板系统架构
- [Thinking配置](docs/superpowers/thinking-config.md) - 多Provider Thinking参数
- [Quiz系统](docs/design/quiz-system.md) - Quiz持久化和评分逻辑
- [API文档](docs/api/) - 各模块API说明