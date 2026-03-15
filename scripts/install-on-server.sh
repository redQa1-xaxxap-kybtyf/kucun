#!/usr/bin/env bash

# 生产环境安装/升级脚本（在服务器上执行）
#
# 用途：
# - 用户上传并解压 kucun-<version>.tar.gz 后，在解压目录中执行本脚本
# - 自动安装依赖、生成 Prisma Client、执行数据库迁移、启动/重启 PM2 服务
#
# 使用方式（以宝塔为例）：
#   1. 上传 release/kucun-<version>.tar.gz 到服务器，如 /www/wwwroot
#   2. 在宝塔文件管理中解压到 /www/wwwroot/kucun
#   3. SSH 登录服务器：
#        cd /www/wwwroot/kucun
#        chmod +x scripts/install-on-server.sh
#        ./scripts/install-on-server.sh

set -e

APP_DIR="${APP_DIR:-$(pwd)}"

echo "📦 安装目录: ${APP_DIR}"

cd "${APP_DIR}"

if [ ! -f "package.json" ]; then
  echo "❌ 当前目录下未找到 package.json，请确认已进入项目根目录（例如 /www/wwwroot/kucun）"
  exit 1
fi

echo "1️⃣ 安装生产依赖 (npm ci --omit=dev)..."
npm ci --omit=dev

echo "2️⃣ 生成 Prisma Client..."
npx prisma generate

echo "3️⃣ 执行数据库迁移 (prisma migrate deploy)..."
npx prisma migrate deploy

echo "4️⃣ 启动或重启 PM2 服务..."

if command -v pm2 >/dev/null 2>&1; then
  # 如果已经有 kucun-app 在运行，则 reload，否则 start
  if pm2 describe kucun-app >/dev/null 2>&1; then
    echo "   检测到已有 kucun-app 进程，执行 pm2 reload..."
    pm2 reload ecosystem.config.js --env production
  else
    echo "   未检测到 kucun-app 进程，执行 pm2 start..."
    pm2 start ecosystem.config.js --env production
  fi

else
  echo "⚠️ 未检测到 pm2 命令，请先在服务器上安装 pm2："
  echo "   npm install -g pm2"
  echo "   然后重新运行本脚本。"
  exit 1
fi

echo "✅ 安装/升级完成。"
