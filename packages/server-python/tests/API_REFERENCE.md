# OpenMAIC API 端点参考

## 认证模块 `/auth`

### POST /auth/login
用户登录

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "nickname": "用户名",
    "avatar_url": null
  }
}
```

**状态码**:
- 200: 成功
- 401: 认证失败

---

### POST /auth/register
用户注册

**请求体**:
```json
{
  "email": "new@example.com",
  "password": "password123",
  "nickname": "新用户"
}
```

---

## 生成模块 `/generate`

### POST /generate/outlines-stream
生成大纲（SSE流式）

**请求体**:
```json
{
  "requirement": "课程需求描述",
  "language": "zh-CN",
  "total_count": 5,
  "model": "openai/glm-5",
  "web_search": false
}
```

**响应**: SSE流（标准格式）
```
event: outline
data: {"id": "scene_1", "title": "场景标题", "type": "slide", "description": "...", ...}

:heartbeat

event: outline
data: {"id": "scene_2", ...}

event: complete
data: {"count": 5}
```

**解析示例**:
```python
outlines = []
lines = response.text.split("\n")
i = 0
while i < len(lines):
    line = lines[i].strip()
    if line == "event: outline":
        if i + 1 < len(lines) and lines[i + 1].startswith("data: "):
            data_str = lines[i + 1][6:]
            outline = json.loads(data_str)
            outlines.append(outline)
            i += 2
            continue
    i += 1
```

**状态码**:
- 200: 成功
- 400: 参数错误（requirement为空）
- 401: 未认证

---

### POST /generate/agent-profiles
生成智能体配置

**请求体**:
```json
{
  "stageInfo": {
    "name": "课程名称",
    "description": "课程描述"
  },
  "language": "zh-CN",
  "sceneOutlines": [...],
  "availableAvatars": [
    "/avatars/teacher.png",
    "/avatars/assistant.png",
    "/avatars/student1.png"
  ]
}
```

**响应**:
```json
{
  "agents": [
    {
      "id": "agent-uuid",
      "name": "李老师",
      "role": "teacher",
      "persona": "引导式教学专家...",
      "color": "#5b9bd5",
      "avatarUrl": "/avatars/teacher.png"
    }
  ]
}
```

---

## 课程模块 `/classrooms`

### POST /classrooms/create-full
创建课程（不生成场景）

**请求体**:
```json
{
  "name": "课程名称",
  "description": "课程描述",
  "language": "zh-CN",
  "agent_ids": ["agent-id-1", "agent-id-2"],
  "agent_configs": [
    {
      "id": "agent-uuid",
      "name": "李老师",
      "role": "teacher",
      "persona": "..."
    }
  ],
  "outlines": [...]
}
```

**响应**:
```json
{
  "id": "course-uuid",
  "name": "课程名称",
  "outlines_count": 5,
  "language": "zh-CN",
  "elapsed_seconds": 0.1
}
```

---

### GET /classrooms
获取课程列表

**响应**: 课程数组

---

### GET /classrooms/{id}
获取课程详情

**响应**:
```json
{
  "stage": {
    "id": "...",
    "name": "...",
    "generatedAgentConfigs": [...]
  },
  "scenes": [
    {
      "id": "...",
      "type": "slide",
      "title": "...",
      "content": {...},
      "actions": [...]
    }
  ]
}
```

---

### DELETE /classrooms/{id}
删除课程（包含所有场景）

---

### POST /classrooms/{id}/scenes/create
创建单个场景

**请求体**:
```json
{
  "outline": {
    "id": "outline-id",
    "type": "slide",
    "title": "场景标题",
    "description": "场景描述",
    "key_points": ["要点1", "要点2"]
  },
  "order_index": 1,
  "language": "zh-CN",
  "agents": [...]
}
```

**响应**:
```json
{
  "id": "scene-uuid",
  "title": "场景标题",
  "type": "slide",
  "order_index": 1,
  "elapsed_seconds": 92.3
}
```

---

## 场景内容结构

### Canvas格式
```json
{
  "type": "slide",
  "canvas": {
    "width": 1000,
    "height": 562.5,
    "background": {"color": "#ffffff"},
    "elements": [
      {
        "id": "text_title",
        "type": "text",
        "left": 60,
        "top": 80,
        "width": 880,
        "height": 76,
        "content": "<p style='font-size:36px;'>标题</p>",
        "defaultColor": "#333333"
      },
      {
        "id": "shape_bg",
        "type": "shape",
        "left": 60,
        "top": 200,
        "width": 400,
        "height": 100,
        "path": "M 0 0 L 1 0 L 1 1 L 0 1 Z",
        "viewBox": [1, 1],
        "fill": "#5b9bd5",
        "fixedRatio": false
      }
    ]
  }
}
```

### Actions格式
```json
[
  {
    "id": "action_1",
    "type": "speech",
    "data": {"text": "开场介绍文本"}
  },
  {
    "id": "action_2",
    "type": "spotlight",
    "data": {"target_element_id": "text_title", "dim_opacity": 0.7}
  },
  {
    "id": "action_3",
    "type": "laser",
    "data": {"target_element_id": "shape_bg", "color": "#ff3b30"}
  }
]
```

---

## 配置端点

### GET /classrooms/supported-languages
返回支持的语言列表: `["zh-CN", "en-US", "ja-JP", "ko-KR"]`

### GET /classrooms/supported-scene-types
返回支持的场景类型: `["slide", "quiz", "interactive", "pbl"]`

### GET /classrooms/limits
返回系统限制配置