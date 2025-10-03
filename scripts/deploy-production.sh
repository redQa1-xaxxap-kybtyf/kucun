#!/bin/bash

###############################################################################
# 生产环境部署脚本
# 用途：自动化部署应用到生产环境
# 使用方法：./scripts/deploy-production.sh
###############################################################################

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查必要的环境变量
check_env_vars() {
    log_info "检查环境变量..."
    
    required_vars=(
        "DATABASE_URL"
        "NEXTAUTH_URL"
        "NEXTAUTH_SECRET"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "缺少必要的环境变量："
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    log_success "环境变量检查通过"
}

# 备份当前版本
backup_current_version() {
    log_info "备份当前版本..."
    
    if [ -d ".next" ]; then
        BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        cp -r .next "$BACKUP_DIR/"
        cp -r public "$BACKUP_DIR/" 2>/dev/null || true
        
        log_success "已备份到 $BACKUP_DIR"
        echo "$BACKUP_DIR" > .last_backup
    else
        log_warning "未找到 .next 目录，跳过备份"
    fi
}

# 安装依赖
install_dependencies() {
    log_info "安装生产依赖..."
    
    # 使用 pnpm 安装依赖（锁文件模式，仅生产依赖）
    if command -v pnpm &> /dev/null; then
        pnpm install --frozen-lockfile --prod
    else
        log_error "未找到 pnpm，请先安装 pnpm"
        exit 1
    fi
    
    log_success "依赖安装完成"
}

# 生成 Prisma Client
generate_prisma_client() {
    log_info "生成 Prisma Client..."
    
    pnpm db:generate
    
    log_success "Prisma Client 生成完成"
}

# 应用数据库迁移
apply_database_migrations() {
    log_info "应用数据库迁移..."
    
    # 检查是否有待应用的迁移
    if npx prisma migrate status | grep -q "Database schema is up to date"; then
        log_info "数据库已是最新版本，无需迁移"
    else
        log_warning "发现待应用的迁移，开始应用..."
        npx prisma migrate deploy
        log_success "数据库迁移完成"
    fi
}

# 构建应用
build_application() {
    log_info "构建应用..."
    
    pnpm build
    
    if [ ! -d ".next" ]; then
        log_error "构建失败：.next 目录不存在"
        exit 1
    fi
    
    log_success "应用构建完成"
}

# 重启应用
restart_application() {
    log_info "重启应用..."
    
    if command -v pm2 &> /dev/null; then
        # 使用 PM2 重启
        if pm2 list | grep -q "kucun"; then
            pm2 reload ecosystem.config.js --env production
            log_success "PM2 进程已重启"
        else
            pm2 start ecosystem.config.js --env production
            log_success "PM2 进程已启动"
        fi
    else
        log_warning "未找到 PM2，请手动重启应用"
    fi
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    # 等待应用启动
    sleep 5
    
    HEALTH_URL="${NEXTAUTH_URL}/api/health"
    MAX_RETRIES=5
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
        
        if [ "$HTTP_CODE" = "200" ]; then
            log_success "健康检查通过 (HTTP $HTTP_CODE)"
            return 0
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
            log_warning "健康检查失败 (HTTP $HTTP_CODE)，重试 $RETRY_COUNT/$MAX_RETRIES..."
            sleep 3
        fi
    done
    
    log_error "健康检查失败，已重试 $MAX_RETRIES 次"
    return 1
}

# 回滚到上一个版本
rollback() {
    log_warning "开始回滚..."
    
    if [ -f ".last_backup" ]; then
        BACKUP_DIR=$(cat .last_backup)
        
        if [ -d "$BACKUP_DIR" ]; then
            rm -rf .next
            cp -r "$BACKUP_DIR/.next" .
            
            if command -v pm2 &> /dev/null; then
                pm2 reload ecosystem.config.js --env production
            fi
            
            log_success "已回滚到备份版本：$BACKUP_DIR"
        else
            log_error "备份目录不存在：$BACKUP_DIR"
        fi
    else
        log_error "未找到备份信息"
    fi
}

# 清理旧备份（保留最近 5 个）
cleanup_old_backups() {
    log_info "清理旧备份..."
    
    if [ -d "backups" ]; then
        cd backups
        ls -t | tail -n +6 | xargs -r rm -rf
        cd ..
        log_success "旧备份清理完成"
    fi
}

# 主流程
main() {
    echo ""
    log_info "========================================="
    log_info "开始生产环境部署"
    log_info "时间：$(date '+%Y-%m-%d %H:%M:%S')"
    log_info "========================================="
    echo ""
    
    # 1. 检查环境变量
    check_env_vars
    
    # 2. 备份当前版本
    backup_current_version
    
    # 3. 安装依赖
    install_dependencies
    
    # 4. 生成 Prisma Client
    generate_prisma_client
    
    # 5. 应用数据库迁移
    apply_database_migrations
    
    # 6. 构建应用
    build_application
    
    # 7. 重启应用
    restart_application
    
    # 8. 健康检查
    if health_check; then
        # 9. 清理旧备份
        cleanup_old_backups
        
        echo ""
        log_success "========================================="
        log_success "部署成功！"
        log_success "时间：$(date '+%Y-%m-%d %H:%M:%S')"
        log_success "========================================="
        echo ""
    else
        # 健康检查失败，回滚
        rollback
        
        echo ""
        log_error "========================================="
        log_error "部署失败，已回滚到之前的版本"
        log_error "时间：$(date '+%Y-%m-%d %H:%M:%S')"
        log_error "========================================="
        echo ""
        exit 1
    fi
}

# 执行主流程
main

