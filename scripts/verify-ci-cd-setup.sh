#!/bin/bash

###############################################################################
# CI/CD 配置验证脚本
# 用途：验证所有 CI/CD 配置是否正确
# 使用方法：./scripts/verify-ci-cd-setup.sh
###############################################################################

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 计数器
PASSED=0
FAILED=0

# 检查函数
check() {
    local name="$1"
    local command="$2"
    
    echo -n "检查 $name... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 通过${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ 失败${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# 检查文件存在
check_file() {
    local name="$1"
    local file="$2"
    
    echo -n "检查 $name... "
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ 存在${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ 不存在${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo ""
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}CI/CD 配置验证${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# 1. 检查必要的工具
echo -e "${YELLOW}1. 检查必要的工具${NC}"
check "Node.js" "command -v node"
check "pnpm" "command -v pnpm"
check "Git" "command -v git"
check "Prisma CLI" "command -v prisma"
echo ""

# 2. 检查 Husky 配置
echo -e "${YELLOW}2. 检查 Husky 配置${NC}"
check_file "Husky 目录" ".husky/_/husky.sh"
check_file "pre-commit 钩子" ".husky/pre-commit"
check_file "commit-msg 钩子" ".husky/commit-msg"
check_file "pre-push 钩子" ".husky/pre-push"
check "pre-commit 可执行" "[ -x .husky/pre-commit ]"
check "commit-msg 可执行" "[ -x .husky/commit-msg ]"
check "pre-push 可执行" "[ -x .husky/pre-push ]"
echo ""

# 3. 检查 lint-staged 配置
echo -e "${YELLOW}3. 检查 lint-staged 配置${NC}"
check "package.json 中的 lint-staged" "grep -q 'lint-staged' package.json"
check "lint-staged 命令" "command -v lint-staged"
echo ""

# 4. 检查 GitHub Actions 配置
echo -e "${YELLOW}4. 检查 GitHub Actions 配置${NC}"
check_file "CI 工作流" ".github/workflows/ci.yml"
check_file "CD 工作流" ".github/workflows/cd.yml"
echo ""

# 5. 检查部署脚本
echo -e "${YELLOW}5. 检查部署脚本${NC}"
check_file "生产部署脚本" "scripts/deploy-production.sh"
check_file "快速部署脚本" "scripts/quick-deploy.sh"
check "deploy-production.sh 可执行" "[ -x scripts/deploy-production.sh ]"
check "quick-deploy.sh 可执行" "[ -x scripts/quick-deploy.sh ]"
echo ""

# 6. 检查健康检查 API
echo -e "${YELLOW}6. 检查健康检查 API${NC}"
check_file "健康检查路由" "app/api/health/route.ts"
echo ""

# 7. 检查 package.json 脚本
echo -e "${YELLOW}7. 检查 package.json 脚本${NC}"
check "lint 脚本" "grep -q '\"lint\"' package.json"
check "type-check 脚本" "grep -q '\"type-check\"' package.json"
check "format 脚本" "grep -q '\"format\"' package.json"
check "build 脚本" "grep -q '\"build\"' package.json"
check "deploy:prod 脚本" "grep -q '\"deploy:prod\"' package.json"
echo ""

# 8. 检查 Prisma 配置
echo -e "${YELLOW}8. 检查 Prisma 配置${NC}"
check_file "Prisma Schema" "prisma/schema.prisma"
check_file "迁移目录" "prisma/migrations"
echo ""

# 9. 检查文档
echo -e "${YELLOW}9. 检查文档${NC}"
check_file "CI/CD 指南" "docs/CI-CD-GUIDE.md"
echo ""

# 10. 运行代码质量检查（可选）
echo -e "${YELLOW}10. 运行代码质量检查（可选）${NC}"
echo -n "是否运行完整的代码质量检查？(y/N) "
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}运行 ESLint...${NC}"
    if pnpm lint; then
        echo -e "${GREEN}✅ ESLint 检查通过${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ ESLint 检查失败${NC}"
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
    echo -e "${BLUE}运行 TypeScript 类型检查...${NC}"
    if pnpm type-check; then
        echo -e "${GREEN}✅ TypeScript 类型检查通过${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ TypeScript 类型检查失败${NC}"
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
    echo -e "${BLUE}运行 Prettier 格式检查...${NC}"
    if pnpm format:check; then
        echo -e "${GREEN}✅ Prettier 格式检查通过${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ Prettier 格式检查失败${NC}"
        FAILED=$((FAILED + 1))
    fi
fi

# 总结
echo ""
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}验证结果${NC}"
echo -e "${BLUE}=========================================${NC}"
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有检查通过！CI/CD 配置正确。${NC}"
    exit 0
else
    echo -e "${RED}❌ 部分检查失败，请修复后重试。${NC}"
    exit 1
fi

