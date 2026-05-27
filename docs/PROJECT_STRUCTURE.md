# OpenMAIC 项目文件结构说明

> 本文件以当前仓库真实目录为准（以根目录 `app/` + `lib/` + `components/` 为 Web 主体）。
> 旧版本曾将 Web 主体描述为 `packages/main-project/`，与实际不符，本次已全面修正。

## 概述

OpenMAIC (Open Multi-Agent Interactive Classroom) 是一个开源的 AI 驱动多智能体互动课堂平台。
仓库采用 **pnpm workspace Monorepo**，但 Web 主应用直接位于仓库根目录（Next.js 16 App Router），
`packages/` 下放置的是辅助/实验性子项目（Python 后端、移动端、官网、Admin 等）。

---

## 顶层目录结构（实际）

```
openmaic-business/
├── app/                     # ⭐ Next.js 16 App Router（Web 主体）
├── components/              # ⭐ React 组件库（舞台、Agent、UI 等）
├── configs/                 # ⭐ 舞台/动画/幻灯片等配置
├── lib/                     # ⭐ 核心业务库（Store / AI / 生成 / 播放 / …）
├── public/                  # 静态资源（avatars、logos 等）
├── assets/                  # 首页/README 用图
├── middleware.ts            # Next 中间件（access-code、i18n 等）
├── next.config.ts           # Next 配置
├── tsconfig.json            # TypeScript 配置（根）
├── package.json             # 根依赖（Web 主体依赖都在这里）
├── pnpm-workspace.yaml      # Monorepo 声明
├── vitest.config.ts         # Vitest 单测配置
├── vitest.eval.config.ts    # 评测（eval）配置
├── playwright.config.ts     # Playwright E2E 配置
│
├── tests/                   # 单元/集成测试（Vitest）
├── e2e/                     # 端到端测试（Playwright）
├── eval/                    # 生成质量评测套件
├── scripts/                 # 构建/运维脚本
│
├── docs/                    # 项目文档（设计/API/需求/进度）
├── community/               # 社区相关（feishu.md）
├── skills/                  # Agent Skill 定义
├── design.md                # 顶层设计说明
│
├── packages/                # 辅助子项目（非 Web 主体）
│   ├── main-project/        # 与 Python 后端对接的演示项目（独立 Next.js）
│   ├── admin/               # Admin Dashboard
│   ├── mobile/              # React Native / Expo 移动端
│   ├── server-python/       # Python FastAPI 后端
│   ├── website/             # 官网
│   ├── pptxgenjs/           # PPT 生成库（fork）
│   └── mathml2omml/         # MathML → OMML 转换
│
├── Dockerfile               # Web 主体 Docker 镜像
├── docker-compose.yml       # 开发编排
├── docker-compose.prod.yml  # 生产编排
├── nginx.conf               # Nginx 反代
├── vercel.json              # Vercel 部署配置
├── .env.example             # 环境变量示例
├── README.md / README-zh.md # 项目说明
├── CHANGELOG.md             # 变更日志
├── CONTRIBUTING.md          # 贡献指南
└── SECURITY.md              # 安全政策
```

---

## app/ —— Next.js App Router（Web 主体）

Web 主入口，包含页面与全部 API Route Handler。

```
app/
├── layout.tsx               # 根布局（Provider、i18n、Theme）
├── globals.css              # 全局样式
├── page.tsx                 # 首页（需求录入 → 跳转生成预览）
├── favicon.ico / apple-icon.png
│
├── classroom/[id]/
│   └── page.tsx             # 课堂播放页
│
├── generation-preview/
│   ├── layout.tsx
│   ├── page.tsx             # 生成预览流水线（8 步）
│   ├── types.ts
│   └── components/          # 预览页专用组件
│
├── eval/                    # 评测控制台页面
│
└── api/                     # Next Route Handlers
    ├── access-code/         # 访问码校验
    ├── azure-voices/        # Azure TTS 可用音色
    ├── chat/                # SSE 多 Agent 对话（15s 心跳）
    ├── classroom/           # 课堂落盘/读取
    ├── classroom-media/     # 课堂媒体代理（[classroomId]/[...path]）
    ├── debug-prompts/       # Prompt 调试
    ├── generate/            # ⭐ 生成管道
    │   ├── agent-profiles/  # Agent 推荐
    │   ├── image/           # 图片生成
    │   ├── scene-actions/   # 单场景动作
    │   ├── scene-content/   # 单场景正文
    │   ├── scene-outlines-stream/  # 大纲 SSE 流
    │   ├── tts/             # 语音合成
    │   └── video/           # 视频生成
    ├── generate-classroom/  # 兼容旧版一把梭生成
    ├── health/              # 健康检查
    ├── parse-pdf/           # PDF 文本+图片抽取
    ├── pbl/chat/            # PBL 专用 SSE 对话
    ├── proxy-media/         # 第三方媒体 CORS 代理
    ├── quiz-grade/          # Quiz 评分
    ├── server-providers/    # 服务端 Provider 配置
    ├── transcription/       # 语音转文字（ASR）
    ├── verify-image-provider/
    ├── verify-model/
    ├── verify-pdf-provider/
    ├── verify-video-provider/
    └── web-search/          # 联网研究
```

完整路由说明见 [docs/api/nextjs-routes.md](./api/nextjs-routes.md)
完整业务流程见 [docs/design/web-business-flow.md](./design/web-business-flow.md)

---

## components/ —— React 组件库

```
components/
├── stage.tsx                # ⭐ 舞台主组件（48KB，聚合所有渲染）
├── header.tsx               # 顶部导航
├── access-code-guard.tsx    # 访问码路由守卫
├── access-code-modal.tsx    # 访问码弹窗
├── language-switcher.tsx    # 语言切换
├── server-providers-init.tsx# 服务端 Provider 初始化
├── user-profile.tsx         # 用户信息卡
│
├── agent/                   # Agent 相关
│   ├── agent-avatar.tsx
│   ├── agent-bar.tsx
│   ├── agent-config-panel.tsx
│   └── agent-reveal-modal.tsx  # Agent 翻牌确认
│
├── ai-elements/             # AI 交互元素（artifact/canvas/message/reasoning/tool 等 30+ 组件）
├── audio/                   # 音频按钮与 TTS 配置
├── canvas/                  # 画布与工具栏
├── chat/                    # 聊天会话、SSE 处理、主动卡片
│   ├── chat-area.tsx
│   ├── chat-session.tsx
│   ├── proactive-card.tsx
│   ├── process-sse-stream.ts
│   └── …
├── generation/              # 生成进度、工具栏、大纲编辑器
├── roundtable/              # 多 Agent 圆桌讨论
├── scene-renderers/         # 场景渲染器
│   ├── pbl/                 # PBL 专用渲染
│   ├── interactive-renderer.tsx
│   ├── pbl-renderer.tsx
│   └── …
├── settings/                # 设置面板（16+ 项）
├── slide-renderer/          # 幻灯片渲染
├── stage/                   # 舞台子组件
├── ui/                      # 基础 UI（shadcn/ui，32 个组件）
└── whiteboard/              # 白板组件
```

---

## lib/ —— 核心业务库（实际目录）

```
lib/
├── logger.ts                # 全局 logger
│
├── action/                  # Action 类型与工具
├── ai/                      # AI Provider / LLM 客户端
├── api/                     # 客户端 API 封装
├── audio/                   # TTS / ASR / 音频播放
├── buffer/                  # 缓冲区工具
├── chat/                    # 聊天历史、会话管理
├── classroom/               # 课堂数据封装
├── constants/               # 常量
├── contexts/                # React Context
├── export/                  # 导出（PPTX / HTML / ZIP）
├── generation/              # ⭐ 课程生成核心
│   ├── action-parser.ts
│   ├── generation-pipeline.ts
│   ├── interactive-post-processor.ts
│   ├── json-repair.ts
│   ├── outline-generator.ts
│   ├── pipeline-runner.ts
│   ├── pipeline-types.ts
│   ├── prompt-formatters.ts
│   ├── prompts-zh-CN/
│   ├── scene-builder.ts
│   └── scene-generator.ts   # 53KB，场景生成主逻辑
├── hooks/                   # 业务级 React Hooks（含 use-scene-generator）
├── i18n/                    # 国际化
├── import/                  # 导入
├── media/                   # 图片/视频生成与编排
├── orchestration/           # Agent 编排（讨论引擎等）
├── pbl/                     # PBL 项目式学习
├── pdf/                     # PDF 抽取与图片处理
├── playback/                # ⭐ 播放引擎（engine.ts 状态机）
├── prompts/                 # ⭐ Prompt 模板系统
├── prosemirror/             # ProseMirror 编辑器
├── quiz/                    # Quiz 持久化与评分
├── server/                  # 服务端能力（classroom-generation、media、storage 等）
├── storage/                 # 存储抽象
├── store/                   # Zustand Store（stage / playback / agent …）
├── types/                   # TS 类型定义
├── utils/                   # 工具（含 database.ts Dexie 封装）
└── web-search/              # 联网搜索（Tavily / Bocha 等）
```

### 关键模块速查

| 模块 | 入口 | 职责 |
|------|------|------|
| 生成流水线 | `lib/generation/pipeline-runner.ts` | 8 步生成编排 |
| 场景生成器 | `lib/generation/scene-generator.ts` | 内容 + Actions |
| 大纲 SSE | `lib/generation/outline-generator.ts` | 大纲流式生成 |
| Prompt 模板 | `lib/prompts/` | 模板加载、snippet 组装 |
| 播放引擎 | `lib/playback/engine.ts` | idle/playing/paused/live 状态机 |
| Stage Store | `lib/store/stage.ts` | 跨页面的核心 Store |
| Dexie 封装 | `lib/utils/database.ts` | IndexedDB 持久化 |
| Web 搜索 | `lib/web-search/` | Tavily/Bocha |
| 媒体编排 | `lib/media/` | 图片/视频 Provider |
| 服务端生成 | `lib/server/classroom-generation.ts` | Server 侧一把梭入口 |

---

## configs/ —— 舞台与渲染配置

```
configs/
├── animation.ts    # 动画配置
├── chart.ts        # 图表配置
├── element.ts      # 元素类型
├── font.ts         # 字体
├── hotkey.ts       # 快捷键
├── image-clip.ts   # 图片裁剪
├── latex.ts        # LaTeX
├── lines.ts        # 线条
├── mime.ts         # MIME 映射
├── shapes.ts       # 形状
├── storage.ts      # 存储键
├── symbol.ts       # 符号
└── theme.ts        # 主题
```

---

## tests/ / e2e/ / eval/ —— 测试与评测

```
tests/                       # Vitest 单测
├── ai/
├── audio/
├── server/
└── store/

e2e/                         # Playwright E2E
├── fixtures/
├── pages/
└── tests/

eval/                        # 生成质量评测（vitest.eval.config.ts）
```

---

## docs/ —— 项目文档（实际目录）

```
docs/
├── README.md                # 文档索引
├── PROJECT_STRUCTURE.md     # 本文件
│
├── api/
│   ├── api-documentation.md
│   ├── nextjs-routes.md     # ⭐ Next 路由矩阵
│   ├── overview.md
│   ├── python-routes.md
│   └── types.md
│
├── design/                  # ⭐ 设计文档
│   ├── ai-learning-platform-opportunities.md
│   ├── business-loop-fixes.md
│   ├── course-generation-flow.md
│   ├── deep-dive/
│   │   ├── course-generation.md
│   │   ├── multi-agent-discussion.md
│   │   └── …
│   ├── deep-interactive-prompts-i18n.md
│   ├── overview.md
│   ├── web-business-flow.md # Web 端业务流程（新）
│   └── whiteboard-slide-tts-laser-tech.md
│
├── deployment/              # Docker / Vercel / 自托管 等
├── marketing/               # 营销内容
├── performance/             # 性能优化
├── progress/                # 11 份进度文档
├── requirements/            # 需求（main-project / mobile / server-python / collaboration）
├── superpowers/plans/       # 高级能力规划
│
├── business-features.md
├── moat-improvement-plan.md
├── next-phase-plan.md
├── phase1-completion-report.md
├── phase2-progress-report.md
├── performance-optimization.md
└── videotutor-analysis-*.md # 4 份 VideoTutor 分析
```

> 旧版文档中曾列出的 `architecture.md`、`widget-system.md`、`agent-orchestration.md`、`prompt-system.md`、`quiz-system.md`、`playback-engine.md`、`classroom-api.md`、`agent-api.md` 等**均不存在**，本次修正移除。

---

## packages/ —— 辅助子项目

> 注意：这些子项目**不是 Web 主体**。主 Web 应用在仓库根目录。

### packages/main-project/ —— 与 Python 后端对接的演示项目

独立 Next.js 项目，基于 `src/` 目录，演示多人协作 + WebSocket 白板。
详见 [packages/main-project/README.md](../packages/main-project/README.md)。

```
packages/main-project/
├── src/
│   ├── app/                 # (auth) / (main)
│   ├── components/          # collaboration / ui
│   └── lib/                 # stores / websocket / api-client
├── tests/e2e/               # Playwright
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

### packages/server-python/ —— Python FastAPI 后端

```
packages/server-python/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── core/                # config / database / security / dependencies
│   ├── routes/              # classrooms / chat / agents / personas / generate / tts / scenes / knowledge
│   ├── services/            # ⭐ 业务服务（LLM / Scene / PDF / Web Search）
│   │   └── generation/      # outline_generator / scene_generator / agent_generator / prompts/ / orchestration/
│   ├── models/              # SQLAlchemy 模型
│   ├── schemas/             # Pydantic Schema
│   ├── db/                  # CRUD
│   ├── middleware/          # auth / cors
│   ├── alembic/             # 数据库迁移
│   └── tests/               # pytest
├── requirements.txt
├── Dockerfile
├── alembic.ini
├── pytest.ini
└── .env.example
```

| 核心服务 | 文件 | 功能 |
|---------|------|------|
| LLM 统一接口 | `services/llm.py` | 多 Provider、Thinking、流式 |
| 模型元数据 | `services/model_metadata.py` | Provider 能力表 |
| 大纲生成 | `services/generation/outline_generator.py` |
| 场景生成 | `services/generation/scene_generator.py` |
| Agent 生成 | `services/generation/agent_generator.py` |
| Prompt 系统 | `services/generation/prompts/` | 模板 + snippet |

### packages/mobile/ —— React Native / Expo

```
packages/mobile/
├── app/                     # Expo Router
│   ├── (tabs)/              # 首页/课程/发现/匹配/笔记/个人 …
│   ├── classroom/[id].tsx   # 课堂播放
│   ├── auth/                # 登录/注册
│   └── knowledge/[id].tsx
├── components/              # slide / classroom / quiz / navigation
├── lib/
│   ├── api-client/
│   ├── playback/            # engine / audio-player
│   ├── quiz/                # persistence(AsyncStorage) / grading
│   ├── types/ constants/ hooks/ …
├── app.json
├── eas.json
└── package.json
```

### packages/admin/ / packages/website/

| 子包 | 定位 |
|------|------|
| `admin/` | Admin Dashboard（Next.js） |
| `website/` | 产品官网（Next.js） |

### packages/pptxgenjs/ / packages/mathml2omml/

工具/库子包，供导出模块使用。

---

## scripts/ —— 实际脚本

```
scripts/
├── backend-verify.sh        # 后端自检
├── check-i18n-keys.mjs      # i18n key 校验
├── deploy-prod.sh           # 生产部署
├── print-prompts.ts         # 打印所有 prompt
├── quick-start.sh           # 本地一键启动
├── release.sh               # 发版
├── restart-python.sh        # 重启 Python 服务
├── restart.sh               # 重启 Web
├── start-mobile.sh          # 启动 Mobile
├── stop.sh                  # 停止
└── update-python-service.sh # 更新 Python 服务
```

---

## 关键配置文件

| 文件 | 用途 |
|------|------|
| `pnpm-workspace.yaml` | Monorepo 声明 |
| `package.json` | 根依赖与脚本 |
| `next.config.ts` | Next 配置 |
| `middleware.ts` | Next 中间件（access-code / i18n） |
| `tsconfig.json` | TS 配置（根） |
| `eslint.config.mjs` | ESLint Flat Config |
| `.prettierrc` / `.prettierignore` | Prettier |
| `postcss.config.mjs` | PostCSS |
| `vitest.config.ts` / `vitest.eval.config.ts` | Vitest |
| `playwright.config.ts` | E2E |
| `Dockerfile` / `docker-compose*.yml` | 容器化 |
| `nginx.conf` | 反代配置 |
| `vercel.json` | Vercel 部署 |
| `.env.example` | 环境变量示例 |

---

## 数据流概览

> 详细说明见 [docs/design/web-business-flow.md](./design/web-business-flow.md)。

### Web 端课程生成流程（根目录实现）

```
首页 /
  ↓ sessionStorage['generationSession']
/generation-preview
  ├─ 1. POST /api/parse-pdf          # PDF 文本+图片
  ├─ 2. POST /api/web-search         # 联网研究
  ├─ 3. POST /api/generate/agent-profiles  # Agent 推荐（auto 模式）
  ├─ 4. POST /api/generate/scene-outlines-stream  # SSE 大纲流
  ├─ 5. POST /api/generate/scene-content   # 首场景正文
  ├─ 6. POST /api/generate/scene-actions   # 首场景动作
  ├─ 7. POST /api/generate/tts             # 首场景 TTS
  └─ 8. IndexedDB + POST /api/classroom    # 落盘并获取 id
        ↓ router.push(`/classroom/${id}`)
/classroom/[id]
  ├─ loadFromStorage / Dexie / GET /api/classroom  # 三级兜底
  └─ useSceneGenerator 续跑 pending outlines      # 串行 + epoch 校验
        ↓
  PlaybackEngine.start() → processNext 循环执行 Actions
```

### Python 端生成流程（packages/server-python）

```
POST /api/v1/classrooms
  → generate_outlines() → Agent 配置 → generate_scene_content() → create_scene()
  → 返回 classroomId
```

### 移动端播放流程（packages/mobile）

```
fetchClassroom() → PlaybackEngine.init() → loadScene() → executeActions() → nextScene()
```

---

## 技术栈概览

| 层级 | 技术 |
|------|------|
| Web 前端 | Next.js 16 + React 19 + TypeScript 5 + Tailwind CSS 4 |
| 状态管理 | Zustand |
| 持久化 | Dexie（IndexedDB） + sessionStorage + Server JSON |
| UI 库 | shadcn/ui + Radix UI |
| 移动端 | React Native + Expo |
| 后端 | Python + FastAPI + LangGraph |
| DB / 缓存 | PostgreSQL + Redis |
| LLM Provider | OpenAI / Anthropic / DeepSeek / Qwen 等 |
| 图片生成 | DALL-E / Stable Diffusion 等 |
| 视频生成 | Runway / Pika 等 |
| TTS | OpenAI / Minimax / VoxCPM / Azure |
| 搜索 | Tavily / Bocha |
| 测试 | Vitest + Playwright |
| 部署 | Docker / Docker Compose / Vercel |

---

## Monorepo 工作空间关系（实际）

```
根目录 Web 主体 (app/ + lib/ + components/)
        ↓ 通过 API 调用
        ↓
        ├── 同域 Next Route Handlers（app/api/*）
        └── 可选：packages/server-python/  (FastAPI 后端)
                        ↑
              packages/mobile/  (API 调用)
              packages/main-project/  (WebSocket 协作演示)
              packages/admin/  (管理后台)
              packages/website/  (官网)
```

> `packages/main-project` 与根目录 Web 主体是**两个独立的 Next.js 应用**：
> - 根目录 Web：面向 C 端的课堂生成/播放主站（本 repo 重心）；
> - `packages/main-project`：对接 Python 后端的协作演示子项目。

---

## 与旧版 PROJECT_STRUCTURE.md 的差异

| 项 | 旧版 | 实际（已修正） |
|----|------|---------------|
| Web 主体位置 | `packages/main-project/` | 仓库根 `app/` + `lib/` + `components/` |
| `lib/ai/` 子文件 | 列了 `llm.ts` / `providers.ts` 等具体文件 | 仅列目录（文件随版本变动） |
| `lib/prompts/templates/` | 列了 15+ 模板子目录 | 以实际目录为准 |
| `docs/design/` | architecture/widget-system/… 等 | 实际为 course-generation-flow / business-loop-fixes / web-business-flow 等 |
| `docs/api/` | classroom-api/agent-api | 实际为 nextjs-routes / python-routes / types / overview |
| `scripts/` | build-all.sh / deploy.sh | 实际为 deploy-prod.sh / release.sh / quick-start.sh 等 |
| 根目录文件 | 缺少 app/ components/ configs/ middleware.ts tests/ e2e/ eval/ | 已补齐 |

---

## 相关文档

- [Web 端业务流程](./design/web-business-flow.md) —— 调用链与数据处理
- [课程生成流程](./design/course-generation-flow.md) —— Prompt 与 Agent
- [多 Agent 讨论](./design/deep-dive/multi-agent-discussion.md)
- [白板/幻灯片/TTS/激光技术](./design/whiteboard-slide-tts-laser-tech.md)
- [Next.js 路由矩阵](./api/nextjs-routes.md)
- [Python 路由](./api/python-routes.md)
- [需求：主项目](./requirements/main-project.md)
- [需求：移动端](./requirements/mobile.md)
- [需求：Python 后端](./requirements/server-python.md)

---

## 更新日志

- **2026-04-27**: 全面对齐真实目录 —— 修正 Web 主体位置（`packages/main-project/` → 根目录）；补齐 `app/` / `components/` / `configs/` / `middleware.ts` / `tests/` / `e2e/` / `eval/`；修正 `docs/` 子目录、`scripts/` 脚本清单；新增与旧版差异对照表。
- **2026-05-12**: 添加 Prompt 系统、Thinking 配置、Quiz 持久化文档（旧）
- **2026-04-26**: v0.2.1 - VoxCPM TTS、thinking config、quiz persistence
- **2026-04-20**: v0.2.0 - Deep Interactive Mode (Ultra Mode)
- **2026-04-14**: v0.1.1 - 语言推断、认证、导出/导入
