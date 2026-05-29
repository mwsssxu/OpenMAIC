# 模型路由系统

模型路由系统根据场景类型自动选择合适的模型提供商和模型ID，支持文本模型、多模态模型和TTS模型的统一管理。

## 架构设计

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  场景类型        │────▶│  ModelRouter     │────▶│  模型配置        │
│  (SceneType)    │     │  (路由逻辑)       │     │  (API, 参数)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**核心组件：**
- `SceneType`: 场景类型枚举，定义不同的使用场景
- `ModelCapability`: 模型能力枚举（文本、视觉、TTS等）
- `ModelRouter`: 路由器，根据场景选择模型
- `ModelConfig`: 模型配置（API地址、参数等）

## 场景类型说明

| 场景类型 | 说明 | 默认模型 | 能力类型 |
|---------|------|---------|---------|
| `OUTLINE_GENERATION` | 课程大纲生成 | qwen3.6-plus | TEXT |
| `SCENE_GENERATION` | 场景内容生成（幻灯片/测验） | qwen3.6-plus | TEXT |
| `AGENT_CHAT` | 智能体对话/讲解 | qwen3.6-plus | TEXT |
| `QUIZ_GRADING` | 测验批改 | qwen-turbo | TEXT |
| `INTERACTIVE_GENERATION` | 交互式内容生成 | qwen-vl-max | VISION |
| `IMAGE_DESCRIPTION` | 图片描述分析 | qwen-vl-max | VISION |
| `PDF_ANALYSIS` | PDF文档分析 | qwen-vl-max | VISION |
| `TTS_SYNTHESIS` | 语音合成 | qwen3-tts-flash | TTS |

## 配置方式

### 环境变量配置

在 `packages/server-python/` 目录下创建 `.env` 文件：

```bash
# ========== LLM 提供商配置 ==========

# 默认文本模型
DEFAULT_MODEL=qwen3.6-plus

# API 端点（DashScope/OpenAI 兼容）
OPENAI_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_API_KEY=sk-your-api-key

# ========== 视觉模型配置 ==========

# 视觉/多模态模型（用于图片分析）
VISION_MODEL_ID=qwen-vl-max

# ========== TTS 模型配置 ==========

# TTS 语音合成模型
TTS_MODEL_ID=qwen3-tts-flash

# TTS 专用 API（可选，默认使用 OPENAI_API_*）
TTS_API_BASE=
TTS_API_KEY=

# ========== 图像生成模型配置 ==========

# 图像生成模型
IMAGE_GEN_MODEL_ID=wanx-v1

# ========== 网络配置 ==========

# HTTP 代理（可选）
HTTP_PROXY=http://localhost:7890
```

### 支持的模型

#### 文本模型

| 模型ID | 提供商 | 最大Token | 说明 |
|--------|--------|----------|------|
| `qwen3.6-plus` | 通义千问 | 8192 | 默认模型，性价比高 |
| `qwen-turbo` | 通义千问 | 4096 | 更快响应，适合简单任务 |
| `qwen-max` | 通义千问 | 4096 | 能力最强 |
| `deepseek-chat` | DeepSeek | 4096 | 备选提供商 |
| `gpt-4o` | OpenAI | 4096 | 备选方案 |

#### 视觉模型

| 模型ID | 提供商 | 最大Token | 说明 |
|--------|--------|----------|------|
| `qwen-vl-max` | 通义千问 | 4096 | 默认视觉模型 |
| `qwen-vl-plus` | 通义千问 | 2048 | 更快响应，成本更低 |
| `glm-4v` | 智谱AI | 4096 | 备选提供商 |

#### TTS模型

| 模型ID | 提供商 | 最大Token | 说明 |
|--------|--------|----------|------|
| `qwen3-tts-flash` | 通义千问 | 1024 | 默认TTS模型 |
| `cosyvoice-v1` | 通义千问 | 1024 | 备选TTS模型 |

### 提供商API端点

```bash
# 阿里云 DashScope（通义千问）
OPENAI_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1

# OpenAI
OPENAI_API_BASE=https://api.openai.com/v1

# DeepSeek
OPENAI_API_BASE=https://api.deepseek.com/v1

# 智谱AI
OPENAI_API_BASE=https://open.bigmodel.cn/api/paas/v4
```

## 使用方法

### Python 代码调用

```python
from app.services.llm import call_llm, stream_llm
from app.services.model_router import SceneType

# 根据场景自动选择模型
response = await call_llm(
    prompt="生成一个Python入门课程大纲...",
    scene_type=SceneType.OUTLINE_GENERATION
)

# 手动指定模型（覆盖自动选择）
response = await call_llm(
    prompt="...",
    model="gpt-4o"  # 使用指定模型
)

# 视觉模型调用
from app.services.llm import call_llm_with_vision

response = await call_llm_with_vision(
    prompt="描述这张图片的内容",
    images=[{"url": "https://example.com/image.png"}],
    scene_type=SceneType.IMAGE_DESCRIPTION
)
```

### 注册自定义模型

```python
from app.services.model_router import get_model_router, ModelConfig, ModelCapability

router = get_model_router()

# 注册自定义模型
router.register_model(
    "my-custom-model",
    ModelConfig(
        model_id="my-custom-model",
        provider="custom",
        api_base="https://api.custom.com/v1",
        max_tokens=4096,
        capabilities=[ModelCapability.TEXT],
        priority=1,
    )
)
```

## 模型选择流程

```
1. 请求到达，携带 scene_type（场景类型）参数

2. 如果提供了 scene_type：
   └─> Router 从 SCENE_MODEL_MAP 查找对应模型

3. 如果提供了 model 参数：
   └─> 使用指定模型（最高优先级）

4. 如果两者都未提供：
   └─> 使用 settings.DEFAULT_MODEL

5. 模型映射：
   └─> MODEL_REMAP 将不支持的模型转换为 DashScope 等效模型
```

## 降级机制

模型可配置降级模型，当主模型不可用时自动切换：

```python
# qwen-turbo 的降级模型是 qwen3.6-plus
"qwen-turbo": ModelConfig(
    model_id="qwen-turbo",
    fallback_model="qwen3.6-plus",  # 如果 qwen-turbo 失败，降级到此模型
)
```

## 成本优化策略

路由系统默认按成本优化原则配置：

| 场景 | 使用模型 | 原因 |
|-----|---------|------|
| 测验批改 | `qwen-turbo` | 任务简单，响应更快，成本更低 |
| 大纲生成 | `qwen3.6-plus` | 平衡能力与成本 |
| 交互式内容 | `qwen-vl-max` | 可能涉及图片，需要视觉能力 |

## 常见问题

### 模型未找到

```
Error: Model 'xyz' not found
```

**解决方案：**
1. 检查模型ID是否正确
2. 使用 `router.register_model()` 注册自定义模型

### API 连接失败

```
Error: LLM API connection error
```

**解决方案：**
1. 检查 `OPENAI_API_BASE` URL 是否正确
2. 验证 `OPENAI_API_KEY` 是否有效
3. 检查网络连接（如需代理，配置 `HTTP_PROXY`）

### 请求超时

```
Error: LLM API timeout
```

**解决方案：**
1. 增加 `llm.py` 中的超时时间（默认120秒）
2. 对于长响应，使用流式模式 `stream_llm()`
3. 检查 API 服务状态

### SSL 证书问题

DashScope 等国内服务可能存在 SSL 兼容性问题，系统已内置处理：
- 禁用 SSL 验证（仅用于兼容性问题）
- 增加重试次数（默认 6 次）

## 测试验证

```bash
# 进入服务目录
cd packages/server-python

# 测试模型路由
python -c "
from app.services.model_router import get_model_router, SceneType

router = get_model_router()
print(f'文本模型: {router.default_text_model}')
print(f'视觉模型: {router.default_vision_model}')
print(f'TTS模型: {router.default_tts_model}')
print(f'大纲生成: {router.get_model_for_scene(SceneType.OUTLINE_GENERATION)}')
print(f'场景生成: {router.get_model_for_scene(SceneType.SCENE_GENERATION)}')
print(f'智能体对话: {router.get_model_for_scene(SceneType.AGENT_CHAT)}')
"
```

## 相关文件

| 文件 | 说明 |
|-----|------|
| `app/services/model_router.py` | 模型路由核心实现 |
| `app/services/llm.py` | LLM 统一调用接口 |
| `app/core/config.py` | 环境变量配置定义 |
| `app/services/generation/scene_generator.py` | 场景生成（使用路由） |
| `app/services/generation/outline_generator.py` | 大纲生成（使用路由） |
