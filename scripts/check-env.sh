#!/bin/bash

###############################################################################
# 环境检查脚本
# 用途: 检查生产环境配置是否正确
# 使用: ./scripts/check-env.sh
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 计数器
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# 检查函数
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS_COUNT++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL_COUNT++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARN_COUNT++))
}

print_header() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
}

###############################################################################
# 1. 检查必需的命令
###############################################################################

print_header "1. 检查必需的命令"

command -v node >/dev/null 2>&1 && check_pass "Node.js 已安装 ($(node --version))" || check_fail "Node.js 未安装"
command -v npm >/dev/null 2>&1 && check_pass "npm 已安装 ($(npm --version))" || check_fail "npm 未安装"
command -v git >/dev/null 2>&1 && check_pass "Git 已安装 ($(git --version | head -1))" || check_warn "Git 未安装"
command -v pm2 >/dev/null 2>&1 && check_pass "PM2 已安装 ($(pm2 --version))" || check_warn "PM2 未安装 (运行: npm install -g pm2)"

###############################################################################
# 2. 检查配置文件
###############################################################################

print_header "2. 检查配置文件"

[ -f ".env.production" ] && check_pass ".env.production 存在" || check_fail ".env.production 不存在 (运行: cp .env.production.example .env.production)"
[ -f ".env.production.example" ] && check_pass ".env.production.example 存在" || check_warn ".env.production.example 不存在"
[ -f "ecosystem.config.js" ] && check_pass "ecosystem.config.js 存在" || check_fail "ecosystem.config.js 不存在"
[ -f "next.config.js" ] && check_pass "next.config.js 存在" || check_fail "next.config.js 不存在"
[ -f "prisma/schema.prisma" ] && check_pass "prisma/schema.prisma 存在" || check_fail "prisma/schema.prisma 不存在"

###############################################################################
# 3. 检查环境变量
###############################################################################

print_header "3. 检查环境变量"

if [ -f ".env.production" ]; then
    source .env.production
    
    # 检查 NODE_ENV
    [ "$NODE_ENV" == "production" ] && check_pass "NODE_ENV=production" || check_fail "NODE_ENV 不是 production"
    
    # 检查 NEXTAUTH_SECRET
    if [ -n "$NEXTAUTH_SECRET" ] && [ "$NEXTAUTH_SECRET" != "<使用 openssl rand -base64 32 生成>" ]; then
        if [ ${#NEXTAUTH_SECRET} -ge 32 ]; then
            check_pass "NEXTAUTH_SECRET 已配置 (长度: ${#NEXTAUTH_SECRET})"
        else
            check_warn "NEXTAUTH_SECRET 长度不足 32 字符"
        fi
    else
        check_fail "NEXTAUTH_SECRET 未配置"
    fi
    
    # 检查 STORAGE_ENCRYPTION_KEY
    if [ -n "$STORAGE_ENCRYPTION_KEY" ] && [ "$STORAGE_ENCRYPTION_KEY" != "<使用 openssl rand -base64 32 生成>" ]; then
        if [ ${#STORAGE_ENCRYPTION_KEY} -ge 32 ]; then
            check_pass "STORAGE_ENCRYPTION_KEY 已配置 (长度: ${#STORAGE_ENCRYPTION_KEY})"
        else
            check_warn "STORAGE_ENCRYPTION_KEY 长度不足 32 字符"
        fi
    else
        check_fail "STORAGE_ENCRYPTION_KEY 未配置"
    fi
    
    # 检查 DATABASE_URL
    if [ -n "$DATABASE_URL" ]; then
        if [[ "$DATABASE_URL" == mysql://* ]]; then
            check_pass "DATABASE_URL 已配置 (MySQL)"
        elif [[ "$DATABASE_URL" == file:* ]]; then
            check_warn "DATABASE_URL 使用 SQLite (生产环境建议使用 MySQL)"
        else
            check_warn "DATABASE_URL 格式未知"
        fi
    else
        check_fail "DATABASE_URL 未配置"
    fi
    
    # 检查 NEXTAUTH_URL
    if [ -n "$NEXTAUTH_URL" ]; then
        if [[ "$NEXTAUTH_URL" == https://* ]]; then
            check_pass "NEXTAUTH_URL 已配置 (HTTPS)"
        elif [[ "$NEXTAUTH_URL" == http://localhost* ]]; then
            check_warn "NEXTAUTH_URL 使用 localhost (生产环境应使用实际域名)"
        else
            check_warn "NEXTAUTH_URL 未使用 HTTPS"
        fi
    else
        check_fail "NEXTAUTH_URL 未配置"
    fi
    
    # 检查 REDIS_URL
    [ -n "$REDIS_URL" ] && check_pass "REDIS_URL 已配置" || check_warn "REDIS_URL 未配置 (可选)"
    
    # 检查日志级别
    if [ "$LOG_LEVEL" == "warn" ] || [ "$LOG_LEVEL" == "error" ]; then
        check_pass "LOG_LEVEL=$LOG_LEVEL (适合生产环境)"
    else
        check_warn "LOG_LEVEL=$LOG_LEVEL (生产环境建议使用 warn 或 error)"
    fi
else
    check_fail "无法检查环境变量 (.env.production 不存在)"
fi

###############################################################################
# 4. 检查目录和权限
###############################################################################

print_header "4. 检查目录和权限"

[ -d "node_modules" ] && check_pass "node_modules 目录存在" || check_warn "node_modules 目录不存在 (运行: npm ci)"
[ -d ".next" ] && check_pass ".next 目录存在" || check_warn ".next 目录不存在 (运行: npm run build)"
[ -d "logs" ] && check_pass "logs 目录存在" || check_warn "logs 目录不存在 (将自动创建)"
[ -d "public/uploads" ] && check_pass "public/uploads 目录存在" || check_warn "public/uploads 目录不存在 (将自动创建)"

# 检查上传目录权限
if [ -d "public/uploads" ]; then
    if [ -w "public/uploads" ]; then
        check_pass "public/uploads 目录可写"
    else
        check_fail "public/uploads 目录不可写"
    fi
fi

###############################################################################
# 5. 检查数据库连接
###############################################################################

print_header "5. 检查数据库连接"

if [ -f ".env.production" ]; then
    source .env.production
    
    if command -v npx >/dev/null 2>&1; then
        if npx prisma db pull --force 2>/dev/null; then
            check_pass "数据库连接成功"
        else
            check_fail "数据库连接失败"
        fi
    else
        check_warn "无法检查数据库连接 (npx 不可用)"
    fi
else
    check_warn "无法检查数据库连接 (.env.production 不存在)"
fi

###############################################################################
# 6. 检查端口占用
###############################################################################

print_header "6. 检查端口占用"

if command -v netstat >/dev/null 2>&1; then
    if netstat -tuln 2>/dev/null | grep -q ":3000"; then
        check_warn "端口 3000 已被占用"
    else
        check_pass "端口 3000 可用"
    fi
    
    if netstat -tuln 2>/dev/null | grep -q ":3002"; then
        check_warn "端口 3002 已被占用"
    else
        check_pass "端口 3002 可用"
    fi
elif command -v lsof >/dev/null 2>&1; then
    if lsof -i :3000 >/dev/null 2>&1; then
        check_warn "端口 3000 已被占用"
    else
        check_pass "端口 3000 可用"
    fi
    
    if lsof -i :3002 >/dev/null 2>&1; then
        check_warn "端口 3002 已被占用"
    else
        check_pass "端口 3002 可用"
    fi
else
    check_warn "无法检查端口占用 (netstat 和 lsof 都不可用)"
fi

###############################################################################
# 7. 检查 Git 状态
###############################################################################

print_header "7. 检查 Git 状态"

if command -v git >/dev/null 2>&1 && [ -d ".git" ]; then
    # 检查是否有未提交的更改
    if git diff-index --quiet HEAD -- 2>/dev/null; then
        check_pass "没有未提交的更改"
    else
        check_warn "有未提交的更改"
    fi
    
    # 检查当前分支
    BRANCH=$(git branch --show-current 2>/dev/null)
    if [ -n "$BRANCH" ]; then
        check_pass "当前分支: $BRANCH"
    fi
else
    check_warn "不是 Git 仓库或 Git 不可用"
fi

###############################################################################
# 8. 总结
###############################################################################

print_header "检查总结"

echo ""
echo -e "${GREEN}通过: $PASS_COUNT${NC}"
echo -e "${YELLOW}警告: $WARN_COUNT${NC}"
echo -e "${RED}失败: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    if [ $WARN_COUNT -eq 0 ]; then
        echo -e "${GREEN}✓ 所有检查通过!环境配置完美!${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠ 有 $WARN_COUNT 个警告,建议修复后再部署${NC}"
        exit 0
    fi
else
    echo -e "${RED}✗ 有 $FAIL_COUNT 个严重问题,必须修复后才能部署!${NC}"
    echo ""
    echo "修复建议:"
    echo "  1. 创建 .env.production: cp .env.production.example .env.production"
    echo "  2. 生成密钥: openssl rand -base64 32"
    echo "  3. 编辑 .env.production 填入真实配置"
    echo "  4. 安装依赖: npm ci"
    echo "  5. 构建应用: npm run build"
    echo ""
    exit 1
fi

