# Mobile App 更新日志

## [feat/mobile] - 2026-06-10

### Features

- **PDF 上传创建课程** — 移动端课程创建页新增 PDF 上传功能，与 Web 端对齐。支持选择 PDF 文件、解析文本内容，将 PDF 内容注入大纲生成 prompt 以生成更准确的课程大纲。支持纯 PDF 创建（无需手动输入需求）[#301a3da](https://github.com/mwsssxu/OpenMAIC/commit/301a3da)
- **白板全屏布局适配** — 移动端白板改为全屏覆盖模式，聊天面板以可拖拽底部浮层叠加在白板之上（覆盖 20%-70% 屏幕高度），替代原来的 2/3 固定分割布局。新增语音播放状态指示灯（绿色播放中/黄色已暂停），Reanimated 弹簧动画驱动浮层过渡 [#b9be39a](https://github.com/mwsssxu/OpenMAIC/commit/b9be39a)
- **统一讨论语音** — 移动端课堂讨论语音统一使用 TTS API + 课程 ttsConfig，不再使用系统 `Speech.speak()`。Fallback 链路：智能体自有 voiceConfig → 课程 ttsConfig（provider + voice）。语速跟随 `ttsConfig.speed`，移除 200 字截断限制 [#66e0a72](https://github.com/mwsssxu/OpenMAIC/commit/66e0a72)
- **白板清除/关闭处理** — PlaybackEngine 新增 `wb_clear`/`wb_close` 事件处理器，支持远端白板操作同步到移动端 [#69f9a05](https://github.com/mwsssxu/OpenMAIC/commit/69f9a05)

### Bug Fixes

- PDF 上传后允许不输入课程需求直接生成（用 PDF 文件名构造默认 requirement）
- 后端 `outlines-stream` 端点支持 `pdf_content` 参数（原硬编码为 `None`），允许纯 PDF 创建
- 允许 `pdf_content` 存在时绕过后端空 requirement 校验

---

## 安装步骤

### 1. 拉取代码

```bash
git pull origin feat/mobile
```

### 2. 安装新增依赖

本次更新新增 `expo-document-picker` 依赖，需重新安装：

```bash
cd packages/mobile
pnpm install
```

> 如果 pnpm 报 `ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF` 错误，执行：
> ```bash
> cd <项目根目录>
> pnpm install --force
> ```
> `.npmrc` 已添加 `public-hoist-pattern[]=*` 以匹配现有 `shamefully-hoist=true` 配置。

### 3. 确认依赖安装成功

```bash
ls node_modules/expo-document-picker/package.json
# 应输出该文件路径
```

### 4. 启动移动端开发服务器

```bash
cd packages/mobile
npx expo start
```

### 5. 验证功能

| 功能 | 验证方式 |
|---|---|
| PDF 上传 | 进入「创建课程」页面 → 看到「上传 PDF（可选）」虚线框 → 点击选择 PDF → 点击「解析」→ 显示绿色提示 → 点击「开始生成课程大纲」|
| 纯 PDF 创建 | 不输入课程需求 → 上传并解析 PDF → 直接点击「开始生成课程大纲」→ 应正常生成 |
| 白板全屏 | 进入课堂 → 播放白板场景 → 白板应全屏覆盖 → 聊天面板浮在底部 |
| 聊天面板拖拽 | 在白板场景中 → 拖拽聊天面板顶部手柄 → 可调整高度 20%-70% |
| 语音统一 | 进入课堂 → 触发讨论 → 语音应使用 TTS API 播放（非系统语音）|

---

## 涉及文件

| 文件 | 改动 |
|---|---|
| `packages/mobile/app/classroom/create.tsx` | +193 — PDF 上传 UI + 状态 + 解析逻辑 + 允许纯 PDF 创建 |
| `packages/mobile/lib/api-client/index.ts` | +27 — `parsePdf()` 方法 + `generateOutlinesStream` 新增 `pdfContent` 参数 |
| `packages/server-python/app/routes/generate.py` | +3/-1 — 后端 `outlines-stream` 传递 `pdf_content` + 放宽空 requirement 校验 |
| `packages/mobile/components/classroom/WhiteboardOverlay.tsx` | +270/-99 — 全屏覆盖 + 可拖拽聊天浮层 |
| `packages/mobile/app/classroom/[id].tsx` | +14/-10 — 统一讨论语音 + 白板布局更新 |
| `packages/mobile/package.json` | +1 — 新增 `expo-document-picker` 依赖 |
| `.npmrc` | +1 — 新增 `public-hoist-pattern[]=*` |
