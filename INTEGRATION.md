# OpenMAIC 本地集成完成 ✅

**集成时间**: 2026-04-03 10:40  
**项目位置**: `~/.openclaw/workspace/openmaic-local`  
**服务端口**: **3030**  
**LLM 配置**: 阿里云百炼 (参考 multi-agent-command-center)  
**代理配置**: 16006 端口 (HTTP/HTTPS)

---

## 📋 已完成步骤

| 步骤 | 状态 | 说明 |
|------|------|------|
| 1. 克隆项目 | ✅ | GitHub → 本地工作空间 |
| 2. 创建配置 | ✅ | `.env.local` + `server-providers.yml` |
| 3. 配置端口 | ✅ | 3030 (原 3000) |
| 4. LLM 配置 | ✅ | 阿里云百炼 (DashScope) |
| 5. 创建 Skill | ✅ | `skills/openmaic/SKILL.md` |
| 6. 启动脚本 | ✅ | `start.sh` 可执行 |

---

## 🚀 启动服务

### 方式 A: 快速启动 (推荐)

```bash
~/.openclaw/workspace/openmaic-local/start.sh
```

### 方式 B: 手动启动

```bash
cd ~/.openclaw/workspace/openmaic-local
pnpm install    # 首次运行需要
pnpm dev        # 启动开发服务
```

**访问**: **http://localhost:3030**

### 方式 C: Docker 启动

```bash
cd ~/.openclaw/workspace/openmaic-local
docker compose up -d
```

---

## ⚙️ LLM 配置 (已配置阿里云百炼)

配置文件已按照 `multi-agent-command-center` 的格式配置：

### `.env.local`

```env
# 服务端口
PORT=3030

# 阿里云百炼 (主要)
DASHSCOPE_API_KEY=sk-962b539037a94defa87c90c8019b5cf5
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus

# OpenAI/ModelScope (备用)
OPENAI_API_KEY=ms-b5718961-829a-49a5-859b-b6734b724731
OPENAI_BASE_URL=https://api-inference.modelscope.cn/v1/

# LLM 提供商选择
LLM_PROVIDER=dashscope

# 默认模型
DEFAULT_MODEL=dashscope:qwen-plus
```

### `server-providers.yml`

```yaml
providers:
  dashscope:
    apiKey: sk-962b539037a94defa87c90c8019b5cf5
    baseURL: https://dashscope.aliyuncs.com/compatible-mode/v1
    models:
      - qwen-plus
      - qwen-max
      - qwen-turbo

  openai:
    apiKey: ms-b5718961-829a-49a5-859b-b6734b724731
    baseURL: https://api-inference.modelscope.cn/v1/
    models:
      - Qwen/Qwen3.5-397B-A17B

defaultModel: dashscope:qwen-plus
llmProvider: dashscope
```

---

## 📖 使用方式

### 1️⃣ Web 界面

启动服务后访问 **http://localhost:3030**

- 输入主题 (如"量子力学入门")
- 或上传 PDF/文档
- 点击生成，等待 2-3 分钟
- 开始互动学习

### 2️⃣ OpenClaw 集成

通过 OpenClaw 调用本地服务：

```
生成一个 Python 编程课堂
```

### 3️⃣ API 调用

```bash
# 生成课堂
curl -X POST http://localhost:3030/api/generate-classroom \
  -H "Content-Type: application/json" \
  -d '{"topic": "量子力学入门"}'

# 导出 PPTX
curl -X POST http://localhost:3030/api/export/pptx \
  -H "Content-Type: application/json" \
  -d '{"classroomId": "xxx"}'
```

---

## 🔧 故障排查

### 问题：pnpm 未安装

```bash
npm install -g pnpm
```

### 问题：Node.js 版本过低

```bash
node --version  # 需要 >= 20
nvm install 20
nvm use 20
```

### 问题：API Key 无效

- 检查 `.env.local` 配置
- 确认百炼 API Key 有足够余额
- 查看服务日志

### 问题：端口 3030 被占用

```bash
PORT=3031 pnpm dev
```

---

## 📊 资源占用

| 资源 | 预估 |
|------|------|
| **磁盘** | ~2GB (node_modules) |
| **内存** | 500MB - 1GB |
| **CPU** | 生成时短暂高峰 |
| **网络** | LLM API 调用流量 |

---

## 📚 相关文档

| 文档 | 路径 |
|------|------|
| 集成指南 | `INTEGRATION.md` |
| 项目 README | `README-zh.md` |
| Skill 文档 | `~/.openclaw/workspace/skills/openmaic/SKILL.md` |
| 环境配置 | `.env.local` |
| 服务商配置 | `server-providers.yml` |

---

## 🎯 下一步

1. **启动服务** - 运行 `start.sh` 或 `pnpm dev`
2. **测试生成** - 访问 http://localhost:3030 生成第一个课堂
3. **OpenClaw 集成** - 通过飞书调用 OpenMAIC

---

**集成完成！** 🎉
