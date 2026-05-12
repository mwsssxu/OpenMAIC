#!/bin/bash

# OpenMAIC Python 服务更新脚本
# 用法: ./scripts/update-python-service.sh [--skip-pull] [--verbose]

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PYTHON_DIR="$PROJECT_ROOT/packages/server-python"
CONTAINER_NAME="openmaic-business-python-server-1"
LOG_FILE="/tmp/openmaic-update.log"

# 参数
SKIP_PULL=false
VERBOSE=false

for arg in "$@"; do
    case $arg in
        --skip-pull) SKIP_PULL=true ;;
        --verbose) VERBOSE=true ;;
        *) echo "未知参数: $arg"; exit 1 ;;
    esac
done

# 日志函数
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$1"; }
log_warn() { log "WARN" "$1"; }
log_error() { log "ERROR" "$1"; }

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查 Docker 是否运行
check_docker() {
    print_status "检查 Docker 状态..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker 未运行，请先启动 Docker"
        exit 1
    fi
    print_success "Docker 正常运行"
}

# 检查容器是否存在
check_container() {
    print_status "检查容器状态..."
    if ! docker ps -a --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
        print_warning "容器 $CONTAINER_NAME 不存在，将创建新容器"
        return 1
    fi

    local status=$(docker ps --filter "name=$CONTAINER_NAME" --format '{{.Status}}')
    if [ -z "$status" ]; then
        print_warning "容器已停止"
        return 2
    fi
    print_success "容器状态: $status"
    return 0
}

# 拉取最新代码（可选）
pull_code() {
    if [ "$SKIP_PULL" = true ]; then
        print_status "跳过代码拉取 (--skip-pull)"
        return
    fi

    print_status "拉取最新代码..."
    cd "$PROJECT_ROOT"

    local current_branch=$(git branch --show-current)
    log_info "当前分支: $current_branch"

    # 检查是否有未提交的更改
    if ! git diff-index --quiet HEAD --; then
        print_warning "有未提交的更改，跳过拉取"
        log_warn "未提交更改，跳过 git pull"
        return
    fi

    git pull origin "$current_branch" 2>&1 | tee -a "$LOG_FILE"
    print_success "代码已更新"
}

# 安装/更新依赖
update_dependencies() {
    print_status "检查 Python 依赖..."

    # 检查是否有新的依赖需要安装
    if docker exec "$CONTAINER_NAME" pip install -q --dry-run -r /app/requirements.txt 2>/dev/null | grep -q "Would install"; then
        print_status "更新依赖..."
        docker exec "$CONTAINER_NAME" pip install -q -r /app/requirements.txt 2>&1 | tee -a "$LOG_FILE"
        print_success "依赖已更新"
    else
        print_success "依赖无变化"
    fi
}

# 重启服务
restart_service() {
    print_status "重启 Python 服务..."

    cd "$PYTHON_DIR"

    # 尝试 docker compose 重启
    if [ -f "docker-compose.yml" ] || [ -f "../docker-compose.yml" ]; then
        cd "$PROJECT_ROOT"
        docker compose restart python-server 2>&1 | tee -a "$LOG_FILE" || \
        docker restart "$CONTAINER_NAME" 2>&1 | tee -a "$LOG_FILE"
    else
        docker restart "$CONTAINER_NAME" 2>&1 | tee -a "$LOG_FILE"
    fi

    print_success "服务重启命令已执行"
}

# 等待服务启动
wait_for_service() {
    print_status "等待服务启动..."
    local max_wait=60
    local wait_time=0
    local check_interval=3

    while [ $wait_time -lt $max_wait ]; do
        sleep $check_interval
        wait_time=$((wait_time + check_interval))

        # 检查健康状态
        local health=$(curl -s http://localhost:8000/health 2>/dev/null)
        if [ -n "$health" ] && echo "$health" | grep -q "ok"; then
            print_success "服务已启动 (等待 ${wait_time}s)"
            return 0
        fi

        if [ "$VERBOSE" = true ]; then
            echo -n "."
        fi
    done

    print_error "服务启动超时 (${max_wait}s)"
    return 1
}

# 验证服务
verify_service() {
    print_status "验证服务..."

    # 测试健康检查
    local health_response=$(curl -s http://localhost:8000/health)
    if echo "$health_response" | grep -q "ok"; then
        print_success "健康检查: OK"
    else
        print_error "健康检查失败"
        return 1
    fi

    # 测试 Personas API
    local personas_response=$(curl -s -w "\n%{http_code}" http://localhost:8000/personas/list)
    local personas_code=$(echo "$personas_response" | tail -1)
    if [ "$personas_code" = "200" ]; then
        print_success "Personas API: OK"
    else
        print_warning "Personas API: HTTP $personas_code"
    fi

    # 测试 Auth API
    local auth_response=$(curl -s -w "\n%{http_code}" http://localhost:8000/auth/me)
    local auth_code=$(echo "$auth_response" | tail -1)
    # 401 是正常的（未登录）
    if [ "$auth_code" = "401" ] || [ "$auth_code" = "200" ]; then
        print_success "Auth API: OK"
    else
        print_warning "Auth API: HTTP $auth_code"
    fi

    return 0
}

# 显示日志
show_logs() {
    print_status "显示最新日志..."
    docker logs "$CONTAINER_NAME" --tail 20 2>&1
}

# 显示服务状态
show_status() {
    print_status "服务状态:"
    echo ""
    docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "API 端点:"
    echo "  - Health:     http://localhost:8000/health"
    echo "  - Personas:   http://localhost:8000/personas/list"
    echo "  - Chat:       http://localhost:8000/chat"
    echo "  - Discussion: http://localhost:8000/chat/discussion"
    echo ""
}

# 显示修改内容
show_changes() {
    print_status "最近修改:"
    cd "$PROJECT_ROOT"
    git log --oneline -5 -- packages/server-python/
    echo ""
    git diff --stat HEAD -- packages/server-python/ 2>/dev/null || echo "无新修改"
}

# 主流程
main() {
    echo ""
    echo "========================================"
    echo "  OpenMAIC Python 服务更新"
    echo "========================================"
    echo ""

    log_info "开始更新流程"

    # 1. 检查 Docker
    check_docker

    # 2. 检查容器
    check_container

    # 3. 拉取代码
    pull_code

    # 4. 重启服务
    restart_service

    # 5. 等待启动
    if ! wait_for_service; then
        print_error "服务启动失败，查看日志:"
        show_logs
        exit 1
    fi

    # 6. 验证服务
    verify_service

    # 7. 显示状态
    show_status

    # 8. 显示修改（verbose 模式）
    if [ "$VERBOSE" = true ]; then
        show_changes
        show_logs
    fi

    log_info "更新完成"
    echo ""
    print_success "🎉 Python 服务更新成功！"
    echo ""
    echo "日志文件: $LOG_FILE"
}

# 执行
main