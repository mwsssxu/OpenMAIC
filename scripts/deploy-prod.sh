#!/bin/bash
# 侧伴 - 生产环境一键部署脚本
# 适用于服务器部署，自动完成环境检查、构建、启动

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   侧伴 - 生产环境一键部署 v0.23.0${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# 获取脚本所在目录的父目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ============================================
# 1. 环境检查
# ============================================
echo -e "${YELLOW}=== 1. 环境检查 ===${NC}"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    echo "   请安装 Node.js 18+ : https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 版本过低 (需要 18+)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}pnpm 未安装，正在安装...${NC}"
    npm install -g pnpm
fi
echo -e "${GREEN}✓ pnpm $(pnpm -v)${NC}"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    echo "   请安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✓ Docker $(docker -v | cut -d' ' -f3 | cut -d',' -f1)${NC}"

# 检查 Docker Compose
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
    echo -e "${GREEN}✓ Docker Compose (docker compose)${NC}"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
    echo -e "${GREEN}✓ Docker Compose (docker-compose)${NC}"
else
    echo -e "${RED}❌ Docker Compose 未安装${NC}"
    exit 1
fi

# 检查 Docker 是否运行
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker 未运行，请启动 Docker${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker 正在运行${NC}"

echo ""

# ============================================
# 2. 配置检查和生成
# ============================================
echo -e "${YELLOW}=== 2. 配置检查 ===${NC}"
echo ""

ENV_FILE="$PROJECT_ROOT/.env.production"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}创建生产环境配置文件...${NC}"

    # 生成 SECRET_KEY
    SECRET_KEY=$(openssl rand -hex 32)

    cat > "$ENV_FILE" << EOF
# 侧伴生产环境配置
# 生成时间: $(date)

# ===== 必需配置 =====
SECRET_KEY=${SECRET_KEY}
DEBUG=false
TESTING_MODE=false

# ===== 数据库配置 =====
DATABASE_URL=postgres://postgres:\${DB_PASSWORD}@postgres:5432/postgres
REDIS_URL=redis://redis:6379

# ===== LLM 配置 (至少需要一个) =====
# 阿里云百炼
OPENAI_API_KEY=
OPENAI_API_BASE=https://coding.dashscope.aliyuncs.com/v1
# Anthropic
ANTHROPIC_API_KEY=
# DeepSeek
DEEPSEEK_API_KEY=
# Google
GOOGLE_API_KEY=
# 默认模型
DEFAULT_MODEL=openai/glm-5

# ===== OSS 配置 (可选) =====
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET=
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com

# ===== OAuth 配置 (可选) =====
APPLE_CLIENT_ID=
GOOGLE_CLIENT_ID=
WECHAT_APP_ID=

# ===== CORS 配置 =====
ALLOWED_ORIGINS=["https://ceban.ai","https://www.ceban.ai"]

# ===== 应用端口 =====
WEBSITE_PORT=3003
MAIN_APP_PORT=3031
ADMIN_PORT=3001
BACKEND_PORT=8000
EOF

    echo -e "${GREEN}✓ 已创建 .env.production${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  请编辑 .env.production 填入以下必需配置：${NC}"
    echo "   - DB_PASSWORD (数据库密码)"
    echo "   - OPENAI_API_KEY 或 ANTHROPIC_API_KEY (LLM密钥)"
    echo ""
    echo -e "${BLUE}编辑命令: nano .env.production${NC}"
    echo ""
    read -p "配置完成后按 Enter 继续..."
fi

# 检查必需配置
check_config() {
    local missing=0

    if grep -qE "SECRET_KEY=\s*$|SECRET_KEY=your-secret" "$ENV_FILE"; then
        echo -e "${RED}❌ SECRET_KEY 未配置${NC}"
        missing=1
    fi

    if ! grep -qE "(OPENAI_API_KEY=sk-|ANTHROPIC_API_KEY=sk-ant-|DEEPSEEK_API_KEY=sk-)" "$ENV_FILE"; then
        echo -e "${YELLOW}⚠️  LLM API密钥未配置${NC}"
    fi

    return $missing
}

if check_config; then
    echo -e "${GREEN}✓ 配置检查通过${NC}"
fi

echo ""

# ============================================
# 3. 安装依赖
# ============================================
echo -e "${YELLOW}=== 3. 安装依赖 ===${NC}"
echo ""

echo "安装项目依赖..."
pnpm install --frozen-lockfile

echo -e "${GREEN}✓ 依赖安装完成${NC}"
echo ""

# ============================================
# 4. 构建应用
# ============================================
echo -e "${YELLOW}=== 4. 构建应用 ===${NC}"
echo ""

# 构建 Website
echo "构建官网..."
cd "$PROJECT_ROOT/packages/website"
pnpm build
echo -e "${GREEN}✓ 官网构建完成${NC}"

# 构建 Main Project
echo "构建主应用..."
cd "$PROJECT_ROOT/packages/main-project"
pnpm build
echo -e "${GREEN}✓ 主应用构建完成${NC}"

# 构建 Admin (可选)
cd "$PROJECT_ROOT"
if [ -d "packages/admin" ]; then
    echo "构建管理后台..."
    cd "$PROJECT_ROOT/packages/admin"
    pnpm build
    echo -e "${GREEN}✓ 管理后台构建完成${NC}"
fi

cd "$PROJECT_ROOT"
echo ""

# ============================================
# 5. Docker 构建
# ============================================
echo -e "${YELLOW}=== 5. Docker 镜像构建 ===${NC}"
echo ""

echo "构建 Docker 镜像 (可能需要几分钟)..."

# 使用生产配置构建
$DOCKER_COMPOSE \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    build

echo -e "${GREEN}✓ Docker 镜像构建完成${NC}"
echo ""

# ============================================
# 6. 停止旧服务
# ============================================
echo -e "${YELLOW}=== 6. 停止旧服务 ===${NC}"
echo ""

$DOCKER_COMPOSE \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    down --remove-orphans

echo -e "${GREEN}✓ 旧服务已停止${NC}"
echo ""

# ============================================
# 7. 启动生产服务
# ============================================
echo -e "${YELLOW}=== 7. 启动生产服务 ===${NC}"
echo ""

# 加载环境变量
export $(grep -v '^#' "$ENV_FILE" | xargs)

$DOCKER_COMPOSE \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    --profile main \
    --profile web \
    up -d

echo -e "${GREEN}✓ 服务启动完成${NC}"
echo ""

# ============================================
# 8. 等待服务就绪
# ============================================
echo -e "${YELLOW}=== 8. 等待服务就绪 ===${NC}"
echo ""

echo "等待后端服务..."
sleep 10

# 后端健康检查
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 后端服务就绪${NC}"
        break
    fi
    echo "等待中... ($WAITED/$MAX_WAIT 秒)"
    sleep 5
    WAITED=$((WAITED + 5))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "${RED}❌ 后端服务启动超时${NC}"
    echo "请查看日志: $DOCKER_COMPOSE logs python-server"
fi

# 数据库迁移
echo ""
echo "执行数据库迁移..."
$DOCKER_COMPOSE exec -T python-server alembic upgrade head || true

echo ""

# ============================================
# 9. 健康检查
# ============================================
echo -e "${YELLOW}=== 9. 健康检查 ===${NC}"
echo ""

# 后端
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API: http://localhost:8000${NC}"
else
    echo -e "${RED}❌ Backend API: 未响应${NC}"
fi

# 官网
if curl -sf http://localhost:3003 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 官网: http://localhost:3003${NC}"
else
    echo -e "${YELLOW}⚠ 官网: 启动中...${NC}"
fi

# 主应用
if curl -sf http://localhost:3031 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 主应用: http://localhost:3031${NC}"
else
    echo -e "${YELLOW}⚠ 主应用: 启动中...${NC}"
fi

echo ""

# ============================================
# 10. 完成
# ============================================
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}   🎉 部署完成！${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

echo "服务地址："
echo "  官网:       http://localhost:3003"
echo "  主应用:     http://localhost:3031"
echo "  Backend:    http://localhost:8000"
echo "  API文档:    http://localhost:8000/docs"
echo ""

echo "常用命令："
echo "  查看日志:   $DOCKER_COMPOSE logs -f"
echo "  查看状态:   $DOCKER_COMPOSE ps"
echo "  停止服务:   $DOCKER_COMPOSE down"
echo "  重启服务:   $DOCKER_COMPOSE restart"
echo ""

echo -e "${YELLOW}提示：生产环境建议配置 Nginx 反向代理和 SSL${NC}"
echo ""