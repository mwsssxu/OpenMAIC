# OpenMAIC API 测试文档

## 测试文件

- `tests/test_api_flow.py` - pytest 单元测试套件（完整流程覆盖）
- `tests/test_course_flow.py` - 命令行集成测试脚本（快速验证）

## 测试结果概览

| 模块 | 测试数量 | 通过 | 备注 |
|------|----------|------|------|
| TestAuth | 3 | 3 | ✓ 认证模块完整覆盖 |
| TestOutlineGeneration | 2 | 2 | ✓ SSE流式大纲生成 |
| TestAgentGeneration | 1 | 1 | ✓ 智能体生成 |
| TestClassroomCRUD | 4 | 4 | ✓ CRUD操作完整 |
| TestSceneCreation | 1 | 1 | ✓ 场景创建（耗时90-250s）|
| TestFullFlow | 1 | 1 | ✓ 完整流程 |

**最新测试结果**: 12/12 通过 (2024-05-11)

## 运行测试

### pytest 单元测试

```bash
# 运行全部测试（耗时约10-20分钟）
pytest tests/test_api_flow.py -v --asyncio-mode=auto

# 快速测试（不含LLM调用）
pytest tests/test_api_flow.py -v -k "TestAuth or TestOutlineGeneration or test_list_classrooms or test_delete_classroom" --asyncio-mode=auto

# 运行指定模块
pytest tests/test_api_flow.py -v -k "TestAuth" --asyncio-mode=auto
pytest tests/test_api_flow.py -v -k "TestOutline" --asyncio-mode=auto
pytest tests/test_api_flow.py -v -k "TestClassroom" --asyncio-mode=auto

# 失败时停止
pytest tests/test_api_flow.py -v --asyncio-mode=auto -x

# 显示详细输出
pytest tests/test_api_flow.py -v --asyncio-mode=auto -s
```

### 命令行集成测试

```bash
# 运行全部流程
python tests/test_course_flow.py --stage all --cleanup

# 运行指定阶段
python tests/test_course_flow.py --stage auth
python tests/test_course_flow.py --stage outlines
python tests/test_course_flow.py --stage agents
python tests/test_course_flow.py --stage classroom
python tests/test_course_flow.py --stage scene

# 不清理测试数据
python tests/test_course_flow.py --stage scene

# 查看帮助
python tests/test_course_flow.py --help
```

## 测试覆盖范围

### 1. 认证模块 (TestAuth)

| 测试 | 描述 | 预期结果 |
|------|------|----------|
| test_login_success | 正确邮箱密码登录 | 200, 返回 access_token |
| test_login_invalid_password | 密码错误 | 401 |
| test_login_invalid_email | 邮箱不存在 | 401 |

### 2. 大纲生成模块 (TestOutlineGeneration)

| 测试 | 描述 | 预期结果 |
|------|------|----------|
| test_outline_generation_success | SSE流式生成大纲 | 200, 至少3个大纲 |
| test_outline_generation_unauthorized | 未认证请求 | 401/403 |

**SSE响应格式**:
```
event: outline
data: {"id": "scene_1", "title": "...", "type": "slide", ...}

:heartbeat

event: complete
data: {"count": 5}
```

### 3. 智能体生成模块 (TestAgentGeneration)

| 测试 | 描述 | 预期结果 |
|------|------|----------|
| test_agent_generation_success | 根据大纲生成智能体 | 200, 至少3个智能体 |

**注意**: 此测试可能因LLM响应超时而失败，属于正常现象。

### 4. 课程 CRUD 模块 (TestClassroomCRUD)

| 测试 | 描述 | 预期结果 |
|------|------|----------|
| test_create_classroom | 创建课程 | 200, 返回课程ID |
| test_list_classrooms | 获取课程列表 | 200, 返回数组 |
| test_get_classroom_detail | 获取课程详情 | 200, 包含stage和scenes |
| test_delete_classroom | 删除课程 | 200, 再次查询返回404 |

### 5. 场景创建模块 (TestSceneCreation)

| 测试 | 描述 | 预期结果 |
|------|------|----------|
| test_create_single_scene | 创建单个场景 | 200, LLM生成内容 |

**验证项**:
- 元素数量 >= 3 (非fallback模板)
- 动作数量 >= 2
- 存在 speech 类型动作

**耗时**: 90-250秒（两次LLM调用）

### 6. 完整流程测试 (TestFullFlow)

认证 → 大纲 → 智能体 → 课程 → 场景 → 验证 → 清理

## 问题修复记录

### 已修复问题

| 问题 | 根因 | 修复方案 | 文件 |
|------|------|----------|------|
| SSE解析失败 | 响应格式是标准SSE而非嵌套JSON | 支持两种SSE格式解析 | test_api_flow.py |
| Agent role验证失败 | role大小写敏感("Teacher" vs "teacher") | 验证时转小写并标准化 | scene_service.py |
| 测试超时 | LLM调用耗时长，客户端超时不足 | 增加超时到180-400秒 | test_api_flow.py |

### 代码变更

**scene_service.py** (agent配置验证):
```python
# 验证role类型（大小写不敏感）
role_lower = agent['role'].lower()
if role_lower not in valid_roles:
    raise ValueError(f"Agent role must be one of {valid_roles}, got: {agent['role']}")
# 标准化role为小写
agent['role'] = role_lower
```

**test_api_flow.py** (SSE解析):
```python
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

## 性能优化记录

### 场景生成优化

| 改进项 | 原值 | 优化后 |
|--------|------|--------|
| LLM流式超时 | 300s | 600s |
| Prompt长度 | ~340行 | ~15行 |
| 单场景耗时 | ~220s | ~92-245s |

### 文件变更

- `app/services/llm.py` - 增加流式超时到600秒
- `app/services/scene_service.py` - 添加内容格式标准化
- `app/services/generation/prompts/slide_content_simple.py` - 简化Prompt模板

## 测试环境要求

1. Python服务运行在 `http://localhost:8000`
2. 测试用户: `test@example.com` / `test123456`
3. 数据库连接正常
4. LLM API配置正确 (DashScope/其他)

## 常见问题

### Q: 大纲生成返回400
检查请求体是否包含 `requirement` 字段（非空）

### Q: 场景创建超时
场景生成需要两次LLM调用，正常耗时90-250秒。如超时，检查：
- LLM API是否稳定
- 网络连接是否正常

### Q: 测试返回500
检查：
- 数据库连接
- 前置测试是否清理数据
- 服务日志 `docker logs openmaic-business-python-server-1`

### Q: 认证返回401
检查测试用户是否存在，或运行：
```sql
INSERT INTO users (id, email, password_hash, nickname, is_active)
VALUES (uuid_generate_v4(), 'test@example.com', 'hashed_password', '测试用户', true);
```

## 测试输出示例

```
tests/test_api_flow.py::TestAuth::test_login_success PASSED              [  8%]
tests/test_api_flow.py::TestAuth::test_login_invalid_password PASSED     [ 16%]
tests/test_api_flow.py::TestAuth::test_login_invalid_email PASSED        [ 25%]
tests/test_api_flow.py::TestOutlineGeneration::test_outline_generation_success PASSED [ 33%]
tests/test_api_flow.py::TestOutlineGeneration::test_outline_generation_unauthorized PASSED [ 41%]
tests/test_api_flow.py::TestAgentGeneration::test_agent_generation_success PASSED [ 50%]
tests/test_api_flow.py::TestClassroomCRUD::test_create_classroom PASSED  [ 58%]
tests/test_api_flow.py::TestClassroomCRUD::test_list_classrooms PASSED   [ 66%]
tests/test_api_flow.py::TestClassroomCRUD::test_get_classroom_detail PASSED [ 75%]
tests/test_api_flow.py::TestClassroomCRUD::test_delete_classroom PASSED  [ 83%]
tests/test_api_flow.py::TestSceneCreation::test_create_single_scene PASSED [ 91%]
tests/test_api_flow.py::TestFullFlow::test_full_course_creation_flow PASSED [100%]

======================== 12 passed in 928.12s (0:15:28) ========================
```