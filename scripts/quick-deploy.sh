#!/bin/bash

###############################################################################
# 快速部署脚本（简化版）
# 用途：快速部署应用到生产环境（跳过部分检查）
# 使用方法：./scripts/quick-deploy.sh
###############################################################################

set -e

echo "🚀 开始快速部署..."

# 1. 安装依赖
echo "📦 安装依赖..."
pnpm install --frozen-lockfile --prod

# 2. 生成 Prisma Client
echo "🔧 生成 Prisma Client..."
pnpm db:generate

# 3. 应用数据库迁移
echo "🗄️  应用数据库迁移..."
npx prisma migrate deploy

# 4. 构建应用
echo "🏗️  构建应用..."
pnpm build

# 5. 重启 PM2
echo "🔄 重启应用..."
pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production

echo "✅ 部署完成！"

