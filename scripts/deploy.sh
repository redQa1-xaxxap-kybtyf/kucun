#!/bin/bash

###############################################################################
# 生产环境部署脚本
# 用途: 自动化部署 Next.js 应用到生产服务器
# 使用: ./scripts/deploy.sh
###############################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 打印标题
print_header() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
    echo ""
}

###############################################################################
# 1. 环境检查
###############################################################################

print_header "步骤 1: 环境检查"

# 检查 Node.js
if ! command_exists node; then
    log_error "Node.js 未安装! 请先安装 Node.js 18+"
    exit 1
fi
log_success "Node.js 版本: $(node --version)"

# 检查 npm
if ! command_exists npm; then
    log_error "npm 未安装!"
    exit 1
fi
log_success "npm 版本: $(npm --version)"

# 检查 PM2
if ! command_exists pm2; then
    log_warning "PM2 未安装,正在安装..."
    npm install -g pm2
    log_success "PM2 安装完成"
fi
log_success "PM2 版本: $(pm2 --version)"

# 检查 .env.production
if [ ! -f ".env.production" ]; then
    log_error ".env.production 文件不存在!"
    log_info "请先创建 .env.production 文件:"
    log_info "  cp .env.production.example .env.production"
    log_info "  然后编辑文件填入真实配置"
    exit 1
fi
log_success ".env.production 文件存在"

# 检查关键环境变量
log_info "检查关键环境变量..."
source .env.production

if [ "$NEXTAUTH_SECRET" == "<使用 openssl rand -base64 32 生成>" ]; then
    log_error "NEXTAUTH_SECRET 未配置!"
    log_info "请运行: openssl rand -base64 32"
    log_info "然后将结果填入 .env.production"
    exit 1
fi

if [ "$STORAGE_ENCRYPTION_KEY" == "<使用 openssl rand -base64 32 生成>" ]; then
    log_error "STORAGE_ENCRYPTION_KEY 未配置!"
    log_info "请运行: openssl rand -base64 32"
    log_info "然后将结果填入 .env.production"
    exit 1
fi

log_success "环境变量配置正确"

###############################################################################
# 2. 创建必要的目录
###############################################################################

print_header "步骤 2: 创建必要的目录"

mkdir -p logs
mkdir -p public/uploads
mkdir -p .next

log_success "目录创建完成"

###############################################################################
# 3. 安装依赖
###############################################################################

print_header "步骤 3: 安装依赖"

log_info "清理旧的 node_modules..."
rm -rf node_modules

log_info "安装生产依赖（使用 npm ci 确保依赖版本一致性）..."
npm ci --omit=dev

log_success "依赖安装完成"

###############################################################################
# 4. 数据库迁移
###############################################################################

print_header "步骤 4: 数据库迁移"

log_info "生成 Prisma Client..."
npx prisma generate

log_info "运行数据库迁移..."
npx prisma migrate deploy

log_success "数据库迁移完成"

###############################################################################
# 5. 构建应用
###############################################################################

print_header "步骤 5: 构建应用"

log_info "构建 Next.js 应用..."
npm run build

log_success "应用构建完成"

###############################################################################
# 6. 启动应用
###############################################################################

print_header "步骤 6: 启动应用"

# 检查 PM2 是否已有运行的应用
if pm2 list | grep -q "kucun-app"; then
    log_info "检测到已运行的应用,正在重启..."
    pm2 reload ecosystem.config.js --env production
    log_success "应用重启完成"
else
    log_info "首次启动应用..."
    pm2 start ecosystem.config.js --env production
    log_success "应用启动完成"
fi

# 保存 PM2 配置
pm2 save

# 设置开机自启 (仅首次需要)
if ! pm2 startup | grep -q "already"; then
    log_info "配置 PM2 开机自启..."
    pm2 startup
fi

###############################################################################
# 7. 验证部署
###############################################################################

print_header "步骤 7: 验证部署"

sleep 5  # 等待应用启动

# 检查应用状态
log_info "检查应用状态..."
pm2 status

# 检查应用是否在线
if pm2 list | grep "kucun-app" | grep -q "online"; then
    log_success "应用运行正常"
else
    log_error "应用启动失败!"
    log_info "查看日志: pm2 logs kucun-app"
    exit 1
fi

# 检查端口
if command_exists netstat; then
    if netstat -tuln | grep -q ":3000"; then
        log_success "端口 3000 正在监听"
    else
        log_warning "端口 3000 未监听"
    fi
fi

###############################################################################
# 8. 完成
###############################################################################

print_header "部署完成!"

echo ""
log_success "应用已成功部署到生产环境!"
echo ""
log_info "常用命令:"
echo "  查看状态: pm2 status"
echo "  查看日志: pm2 logs kucun-app"
echo "  重启应用: pm2 restart kucun-app"
echo "  停止应用: pm2 stop kucun-app"
echo "  监控应用: pm2 monit"
echo ""
log_info "下一步:"
echo "  1. 配置 Nginx 反向代理"
echo "  2. 配置 SSL 证书"
echo "  3. 配置防火墙"
echo "  4. 配置数据库备份"
echo ""
log_info "参考文档: 生产环境部署指南.md"
echo ""

