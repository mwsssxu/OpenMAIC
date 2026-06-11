# 课程创建流程分析：移动端缺少互动场景生成

## 问题

移动端课程创建后没有生成实时互动场景（interactive type），而 Web 端可以。

---

## Web 端流程（完整）

### 1. 需求输入（app/page.tsx）
- 用户输入课程需求、选择语言
- **有 interactiveMode 开关**（localStorage key: `interactiveModeEnabled`）
- FormState 包含 `interactiveMode: boolean`

### 2. 大纲生成（scene-outlines-stream/route.ts）
- **关键差异**：Web 端根据 `interactiveMode` 选择不同 prompt 模板：
  ```
  interactiveMode=false → PROMPT_IDS.REQUIREMENTS_TO_OUTLINES
  interactiveMode=true  → PROMPT_IDS.INTERACTIVE_OUTLINES
  ```
- `INTERACTIVE_OUTLINES` 模板生成的大纲包含 `type: "interactive"` 场景，
  并附带 `widgetType` + `widgetOutline` 字段（simulation/game/diagram/code/visualization3d/html/scientific-model）

### 3. 场景内容生成（scene-content/route.ts + Web 前端）
- Web 前端调用 `/api/generate/scene-content` → `/api/generate/scene-actions` 两步
- 对于 `type: "interactive"` 的场景，scene-generator.ts 有专门的 interactive 路径：
  - 根据 `widgetType` 选择对应 prompt（simulation-content/game-content/...）
  - 生成 interactive HTML/widget 内容
  - actions 也有专门处理（interactive-actions prompt）

### 4. 步骤序列（generation-preview/page.tsx）
```
Step 1: outlines-stream → SSE 流式
Step 2: scene-content → 单个场景内容
Step 3: scene-actions → 单个场景动作 + TTS
```

---

## 移动端流程（缺失）

### 1. 需求输入（packages/mobile/app/classroom/create.tsx）
- **没有 interactiveMode 开关**
- 状态只有：requirement、language、webSearchEnabled
- STEPS 定义为：需求 → 大纲 → 角色 → 确认（4步）

### 2. 大纲生成（apiClient.generateOutlinesStream）
- 调用后端 `/generate/outlines-stream`
- **没有传 interactiveMode 参数**
- 后端 outline_generator 使用 `requirements-to-outlines` 模板（默认）
- **永远不会生成 type=interactive 的大纲**

### 3. 课程创建（apiClient.createFullClassroom）
- 调用后端 `/classrooms/create-full`
- 只保存课程记录，**不生成场景**
- 返回 classroom ID

### 4. 场景生成（classroom/[id].tsx → createAllScenesInBackground）
- 进入课堂页面后后台调用 `apiClient.createAllScenes(id, outlines, language)`
- 后端 `create_single_scene` 处理场景内容生成
- 但因为没有 interactive 类型大纲，**互动场景永远不会被生成**

---

## 根因分析

| 缺失点 | Web 端 | 移动端 |
|---------|--------|--------|
| interactiveMode 开关 | ✅ 有 | ❌ 无 |
| INTERACTIVE_OUTLINES prompt | ✅ 有 | ❌ 后端不支持 |
| widgetType/widgetOutline 字段 | ✅ 大纲含 | ❌ 不可能含 |
| interactive 场景内容生成 | ✅ scene-generator.ts | ✅ 后端 scene_generator.py 有 |
| interactive 场景 actions | ✅ interactive-actions | ✅ 后端有 prompt 模板 |

**核心问题**：不是后端缺能力，而是移动端前端没有 interactiveMode 开关 → 不传参数 → 后端用普通模板 → 只生成 slide/quiz 大纲 → 永远没有互动场景。

---

## 修复方案

### 方案 A：移动端增加 interactiveMode 开关（推荐）

1. **create.tsx**: 添加 interactiveMode 状态和 UI 开关
2. **apiClient.generateOutlinesStream**: 增加 interactiveMode 参数
3. **后端 outlines-stream**: 接收 interactiveMode，选择 prompt 模板
4. **后端 outline_generator.py**: 添加 INTERACTIVE_OUTLINES prompt 支持

### 方案 B：默认开启互动模式

1. 后端大纲生成默认混入 1-2 个 interactive 场景
2. 移动端无需额外开关

### 方案 A 具体改动

#### 1. create.tsx — 添加 interactiveMode 开关
```tsx
const [interactiveMode, setInteractiveMode] = useState(false);
// 在 optionsSection 里添加开关（类似 webSearchEnabled）
```

#### 2. apiClient.generateOutlinesStream — 传 interactiveMode
```ts
// 增加 interactiveMode 参数，POST body 加 interactiveMode 字段
```

#### 3. 后端 generate.py outlines-stream — 接收并使用
```python
interactive_mode = body.get("interactiveMode", False)
prompt_id = "interactive-outlines" if interactive_mode else "requirements-to-outlines"
```

#### 4. 后端 outline_generator.py — 支持 interactive-outlines prompt
```python
# stream_generate_outlines 函数增加 interactive_mode 参数
# 选择不同的 prompt 模板
```

#### 5. 后端 prompts — 确保 interactive-outlines 模板存在
需要检查 Web 端 `INTERACTIVE_OUTLINES` prompt 并移植到后端模板目录。

---

## 后端已有但未被触发的 Interactive 能力

后端 scene_generator.py 和 scene_service.py 已经具备完整的 interactive 处理：

- `WIDGET_CONTENT_PROMPT_OVERRIDES` 映射表
- `widget_type → prompt_id` 路径
- simulation/game/diagram/code/visualization3d/html/scientific-model 内容模板
- interactive-actions prompt 模板
- `create_single_scene` 中对 interactive/pbl 的并行 actions 生成

这些能力因为大纲生成不包含 interactive 类型而完全未被利用。

---

## 2026-06-08 分析