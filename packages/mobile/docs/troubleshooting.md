# 移动端开发问题记录

> 记录开发过程中遇到的问题及解决方案，便于后续参考和知识积累。

---

## 问题列表

### #1: Web 端跨域错误 (2026-04-21)

**问题描述：**

Web 端访问登录接口时报跨域错误：
- 前端地址：`http://192.168.1.110:8081/auth/login`
- 后端地址：`http://192.168.1.110:8000/auth/login`

**原因分析：**

浏览器认为不同端口的请求是跨域请求。React Native 手机 App 无跨域限制，但 Expo Web 模式运行在浏览器中，受跨域策略限制。

**解决方案：**

在后端 `packages/server-python/app/main.py` 的 CORS 配置中添加局域网 IP：

```python
cors_origins = [
    # ...原有配置
    "http://192.168.1.110:8081",
    "http://192.168.1.110:8082",
    "http://192.168.1.110:19000",
    "http://192.168.1.110:19006",
]
```

重启后端服务：

```bash
docker compose restart python-server
```

**相关文件：**
- `packages/server-python/app/main.py:64-79`

---

### #2: Expo Go 扫码显示网卡 IP 而非 WiFi IP (2026-04-21)

**问题描述：**

Expo 启动后二维码下方显示网卡 IP（如 `192.168.100.x`），手机扫码无法连接开发服务器。

**原因分析：**

Expo 默认自动选择网络接口 IP，可能选择了虚拟网卡或其他非 WiFi 接口。

**解决方案：**

方法一：指定 WiFi IP 启动（推荐）

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.110 npx expo start
```

方法二：使用 tunnel 模式

```bash
npx expo start --tunnel
```

通过 ngrok 创建公网隧道，无需手机和电脑在同一 WiFi。

方法三：使用启动脚本

```bash
./start-expo.sh
```

**是否影响生产部署：**

否。此配置仅影响开发阶段，生产构建独立 APK/IPA 后，应用直接连接配置的后端 API 地址。

**相关文件：**
- `packages/mobile/start-expo.sh`（新建）

---

### #3: 后端 API 地址配置 (2026-04-21)

**问题描述：**

手机端需要配置后端地址和端口。

**解决方案：**

创建 `.env` 文件配置：

```bash
# 本地开发（模拟器）
EXPO_PUBLIC_API_URL=http://localhost:8000

# 真机调试（WiFi IP）
EXPO_PUBLIC_API_URL=http://192.168.1.110:8000

# 生产环境
EXPO_PUBLIC_API_URL=https://api.palansoft.cn
```

代码中通过环境变量读取（`lib/api-client/index.ts:5`）：

```typescript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
```

**相关文件：**
- `packages/mobile/lib/api-client/index.ts`
- `packages/mobile/.env`

---

### #4: Agent/大纲生成失败 - LLM API 连接关闭 (2026-04-21)

**问题描述：**

调用 `/generate/agent-profiles` 和 `/generate/outlines` 接口时报错：
```
WARNING:root:Agent生成失败: Remote end closed connection without response
WARNING:root:大纲生成失败: Remote end closed connection without response
```

**原因分析：**

1. 原代码使用 `urllib.request` 进行 HTTP 调用，不适合异步场景
2. 超时时间 60 秒对复杂生成任务可能不够
3. 阿里云百炼 API 对某些请求可能有兼容性问题
4. 缺少重试机制，单次失败直接报错

**解决方案：**

改进 `packages/server-python/app/services/llm.py`：

1. 使用 `httpx` 替代 `urllib.request`（更适合异步调用）
2. 增加超时时间：总超时 120 秒，连接超时 30 秒
3. 添加重试机制：最多 3 次重试，间隔 2-3 秒
4. 完善错误日志记录（区分 Timeout、RemoteProtocolError、HTTPError）

关键代码改动：

```python
# 使用 httpx 异步客户端
timeout = httpx.Timeout(120.0, connect=30.0)

for attempt in range(max_retries):
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
    except httpx.RemoteProtocolError as e:
        if attempt < max_retries - 1:
            await asyncio.sleep(3)
        else:
            raise
```

重启后端：

```bash
docker compose restart python-server
```

**是否影响生产部署：**

是。此改动直接影响生产环境的 LLM API 调用稳定性。

**相关文件：**
- `packages/server-python/app/services/llm.py`

---

### #5: 大纲生成需要流式显示，而非一次性获取 (2026-04-21)

**问题描述：**

原项目大纲是逐个生成的，用户可以看到每个大纲逐渐出现。但移动端当前实现是一次性获取所有大纲，再模拟动画显示。

**原因分析：**

1. 移动端 API 客户端注释说"不支持 SSE"，使用普通 `/generate/outlines` 接口
2. 后端 `stream_llm` 函数并非真正流式，只是调用 `call_llm` 返回完整结果
3. React Native 实际可以通过 fetch API 支持 SSE

**解决方案：**

**方案一（已废弃）：真正的 SSE 流式**

尝试使用 LLM API 的流式输出，但 GLM-5 推理模型生成时间过长。

**方案二（已采用）：逐个生成大纲**

将大纲生成拆分为两阶段：

1. **快速生成标题列表**（一次 LLM 调用，max_tokens=1024）
2. **逐个生成详细内容**（多次 LLM 调用，每次 max_tokens=512）

后端改动（`packages/server-python/app/services/generation/outline_generator.py`）：

```python
async def stream_outlines(requirement, ...):
    # 先快速生成大纲标题列表
    outline_titles = await generate_outline_titles(requirement, language, model, total_count)

    # 然后逐个生成详细内容
    for i, outline_info in enumerate(outline_titles):
        outline = await generate_single_outline(requirement, outline_info, order=i+1, ...)
        yield outline  # 立即返回给前端
```

路由层改动（`packages/server-python/app/routes/generate.py`）：

```python
async def event_stream():
    async for outline in stream_outlines(...):
        yield f"event: outline\ndata: {json.dumps(outline.model_dump())}\n\n"
    yield f"event: done\ndata: {json.dumps({'count': index})}\n\n"
```

移动端改动（`packages/mobile/lib/api-client/index.ts`）：

```typescript
async generateOutlinesStream(..., onOutline?: (outline: any) => void) {
  const reader = response.body?.getReader();
  while (true) {
    const { done, value } = await reader.read();
    // 解析 SSE，每个大纲立即回调
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (onOutline) onOutline(data);
    }
  }
}
```

**效果：**
- 用户快速看到大纲框架（标题列表）
- 每个大纲逐个出现，过程可见
- 单个大纲失败不影响其他大纲
- 不需要等待所有大纲完成

**是否影响生产部署：**

是。此改动改善用户体验，大纲生成过程可见。

**相关文件：**
- `packages/server-python/app/services/llm.py`
- `packages/server-python/app/services/generation/outline_generator.py`
- `packages/mobile/lib/api-client/index.ts`
- `packages/mobile/app/classroom/create.tsx`

---

## 问题记录模板

遇到新问题时，请按以下格式添加：

```markdown
### #N: 问题标题 (日期)

**问题描述：**
简要描述遇到的问题现象。

**原因分析：**
分析问题产生的原因。

**解决方案：**
给出具体的解决步骤和代码示例。

**是否影响生产部署：**
说明是否影响生产环境（如适用）。

**相关文件：**
列出涉及的文件路径和行号。
```

---

**最后更新:** 2026-04-21