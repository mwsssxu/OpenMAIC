# Web端业务逻辑分析 - Python端/Mobile端优化机会

## 一、Prompt系统差异

### Web端新增功能
| 功能 | Web端 | Python端 | Mobile端 |
|------|-------|----------|----------|
| 变量插值 {{var}} | ✓ | ✓ | N/A |
| Snippet {{snippet:name}} | ✓ | ✓ (已同步) | N/A |
| 条件块 {{#if cond}} | ✓ | ✓ (已同步) | N/A |
| Prompt模板数量 | 22+ | 7 | N/A |
| Agent System Prompt模板 | ✓ (agent-system/) | ✗ | N/A |
| Director模板 | ✓ (director/) | ✗ | N/A |
| Whiteboard参考模板 | ✓ (whiteboard-reference.md) | ✗ | N/A |

### 优化机会 - Python端

1. **添加Agent System Prompt模板**
   - Web端有专门的 `agent-system/`, `agent-system-wb-teacher/`, `agent-system-wb-assistant/`, `agent-system-wb-student/` 模板
   - Python端 `director_graph.py` 硬编码了 AGENT_SYSTEM_PROMPTS
   - 建议：同步模板文件，动态加载

2. **Director模板同步**
   - Web端 `templates/director/` 用于多Agent讨论编排
   - Python端需要更智能的Agent选择逻辑

3. **Whiteboard Reference模板**
   - Web端 `snippets/whiteboard-reference.md` (17KB) 包含完整的白板绘制规范
   - Python端缺失，影响Agent绘制能力

---

## 二、场景创建流程差异

### Web端流程 (lib/server/classroom-generation.ts)
```
1. resolveModel() - 动态选择模型
2. Web Search - 搜索增强（Tavily/Bocha）
3. generateSceneOutlinesFromRequirements() - 大纲生成
4. generateAgentProfiles() - 动态生成Agent（可选）
5. applyOutlineFallbacks() - 大纲类型fallback
6. generateSceneContent() - 内容生成
7. generateSceneActions() - Actions生成
8. generateMediaForClassroom() - 图片/视频生成
9. generateTTSForClassroom() - TTS音频生成
10. persistClassroom() - 持久化
```

### Python端流程 (app/routes/classrooms.py)
```
1. generate_outlines() - 大纲生成
2. get_default_agents() - 默认Agent配置
3. generate_scene_content() - 内容生成（简化）
4. create_scene() - 创建场景
```

### 优化机会 - Python端

1. **Web Search集成**
   - Web端支持Tavily/Bocha搜索增强
   - Python端缺失researchContext功能
   - 文件：`packages/server-python/app/services/web_search.py` (需新建)

2. **Model动态选择**
   - Web端 `resolve-model.ts` 支持多Provider、Fallback
   - Python端硬编码DEFAULT_MODEL
   - 文件：`packages/server-python/app/services/model_resolver.py` (需新建)

3. **Outline Fallback机制**
   - Web端 `applyOutlineFallbacks()` 处理interactive/pbl类型缺失配置时的fallback
   - Python端缺失此逻辑

4. **Media Generation**
   - Web端支持AI图片/视频生成（DALL-E/Runway等）
   - Python端缺失 `media_generations` 处理
   - 文件：`packages/server-python/app/services/media_generation.py` (需新建)

5. **TTS集成**
   - Web端 `generateTTSForClassroom()` 生成所有speech音频
   - Python端TTS仅在playback时调用，未预生成

---

## 三、Agent生成差异

### Web端 (lib/server/classroom-generation.ts generateAgentProfiles)
```typescript
// 动态生成Agent配置
- 根据课程内容生成3-5个Agent
- 1个teacher + 其余assistant/student
- 每个Agent: name, role, persona (2-3句)
- 语言跟随languageDirective
```

### Python端 (agent_generator.py)
```python
# 合并Prompt，避免system/user分离
AGENT_PROMPT_TEMPLATE = """..."""
# 默认配置: 1老师+1助教+3学生
```

### 优化机会

1. **Agent Prompt模板化**
   - Python端硬编码Prompt
   - 建议：创建 `templates/agent-system/` 模板

2. **Agent生成时机**
   - Web端：大纲生成后，使用languageDirective生成Agent
   - Python端：大纲生成前，无法根据课程语言定制

3. **Agent Voice配置**
   - Python端有完整的voice_provider/voice_id配置
   - Web端缺失voice配置（需同步）

---

## 四、Interactive内容生成差异

### Web端 (scene-generator.ts generateWidgetContent)
```typescript
// Ultra Mode - 5种Widget
- simulation: 物理模拟
- game: 游戏练习  
- diagram: 流程图/思维导图
- code: 代码演示
- visualization3d: 3D可视化

// 每种Widget有独立的:
- promptId (PROMPT_IDS.SIMULATION_CONTENT等)
- variables (根据Widget类型定制)
- teacherActions生成
- HTML提取和后处理
```

### Python端 (scene_generator.py)
```python
# 已实现基本框架
if outline.type == "interactive":
    widget_type = getattr(outline, 'widget_type', None) or 'simulation'
    system_prompt, user_prompt = build_prompt(f"{widget_type}-content", {...})
```

### 优化机会

1. **Widget Teacher Actions**
   - Web端生成 `teacherActions` (highlight, setState, annotation, reveal)
   - Python端缺失此功能
   - 建议：添加 `generate_widget_teacher_actions()` 函数

2. **HTML后处理**
   - Web端 `postProcessInteractiveHtml()` 处理生成的HTML
   - Python端需要类似处理

3. **Widget Config提取**
   - Web端从HTML中提取 `<script id="widget-config">` JSON
   - Python端缺失

---

## 五、Quiz系统差异

### Web端 (lib/quiz/)
```
persistence.ts - 三层存储 (localStorage)
grading.ts - 自动评分逻辑
```

### Mobile端 (packages/mobile/lib/quiz/)
```
persistence.ts - 已完整实现 (AsyncStorage)
```

### Python端
```
缺失专门的Quiz评分服务
```

### 优化机会

1. **Python端Quiz评分**
   - Web端 `grading.ts` 有评分逻辑
   - Python端缺失自动评分服务
   - 文件：`packages/server-python/app/services/quiz_grading.py` (需新建)

2. **Mobile端已完善**
   - Quiz persistence已完整实现并集成
   - 无额外优化需求

---

## 六、移动端特有优化机会

### 1. Playback Engine增强
- Web端: 完整的Action类型处理（widget_highlight, widget_setState等）
- Mobile端: `packages/mobile/lib/playback/engine.ts` 缺失Widget Action处理
- 建议：添加Widget Action渲染逻辑

### 2. Offline支持
- Mobile端可增强离线播放能力
- 预缓存TTS音频、图片等资源

### 3. 性能优化
- Web端使用Promise.all并行生成场景
- Python端串行生成
- 建议：Python端实现并行生成

---

## 七、优先级排序

### 高优先级
1. **Python端: Web Search集成** - 提升大纲质量
2. **Python端: Widget Teacher Actions** - Interactive场景完整性
3. **Python端: Model动态选择** - 多Provider支持

### 中优先级
1. **Python端: Agent模板化** - Prompt系统统一
2. **Python端: Outline Fallback** - 类型容错
3. **Mobile端: Widget Action渲染** - Interactive播放

### 低优先级
1. **Python端: Media Generation** - 图片/视频生成（依赖外部API）
2. **Python端: TTS预生成** - 性能优化
3. **Mobile端: Offline缓存** - 用户体验优化

---

## 八、实施建议

### Phase 1: Web Search集成 (2-3小时)
```python
# 新建 app/services/web_search.py
# 集成Tavily/Bocha API
# 在大纲生成时传入researchContext
```

### Phase 2: Widget Teacher Actions (2-3小时)
```python
# scene_generator.py 添加:
async def generate_widget_teacher_actions(widget_type, outline, widget_config, ai_call):
    prompts = build_prompt(PROMPT_IDS.WIDGET_TEACHER_ACTIONS, {...})
    # 解析返回的TeacherAction[]
```

### Phase 3: Model动态选择 (1-2小时)
```python
# 新建 app/services/model_resolver.py
# 支持多Provider、Fallback逻辑
# 从环境变量读取配置
```

---

## 九、关键代码差异对比

### 大纲生成 - languageDirective

**Web端:**
```typescript
// 返回 { languageDirective, outlines }
const { languageDirective, outlines } = outlinesResult.data;
// Agent生成使用languageDirective
agents = await generateAgentProfiles(requirement, languageDirective, aiCall);
```

**Python端:**
```python
# 只返回outlines
outlines = await generate_outlines(...)
# Agent生成无法使用languageDirective
agents = get_default_agents(language)
```

### 场景生成 - Interactive

**Web端:**
```typescript
// Ultra Mode完整流程
if (outline.type === 'interactive') {
  outline = convertInteractiveConfigToWidget(outline); // 向后兼容
  return generateWidgetContent(outline, aiCall, languageDirective);
}
// generateWidgetContent包含:
// - HTML生成
// - widgetConfig提取
// - teacherActions生成
```

**Python端:**
```python
# 基本框架已实现
if outline.type == "interactive":
    widget_type = getattr(outline, 'widget_type', None) or 'simulation'
    system_prompt, user_prompt = build_prompt(f"{widget_type}-content", {...})
    # 缺失: teacherActions生成
```

---

## 十、总结

Web端业务逻辑已大幅优化，Python端/Mobile端需要同步的关键功能：

1. **Prompt系统** - 已完成基本同步，需补充Agent/Director模板
2. **Web Search** - Python端缺失，影响大纲质量
3. **Widget Teacher Actions** - Python端缺失，影响Interactive体验
4. **Model动态选择** - Python端硬编码，需改进
5. **Quiz系统** - Mobile端已完善，Python端需补充评分服务
6. **Agent生成** - 需模板化并根据languageDirective生成