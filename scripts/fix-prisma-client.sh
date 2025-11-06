#!/bin/bash

# 修复 Prisma Client 生成问题
# 用法: bash scripts/fix-prisma-client.sh

echo "🔧 开始修复 Prisma Client..."

# 1. 删除旧的 Prisma Client
echo "📦 删除旧的 Prisma Client..."
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma/client

# 2. 重新安装 Prisma Client
echo "📦 重新安装 Prisma Client..."
npm install @prisma/client

# 3. 生成新的 Prisma Client
echo "🔨 生成新的 Prisma Client..."
npx prisma generate

# 4. 验证生成结果
if [ $? -eq 0 ]; then
  echo "✅ Prisma Client 生成成功！"
  echo ""
  echo "📋 下一步："
  echo "1. 运行 npm run type-check 验证类型"
  echo "2. 运行 npm run lint 检查代码质量"
  echo "3. 运行 npm run dev 启动开发服务器"
else
  echo "❌ Prisma Client 生成失败！"
  echo ""
  echo "🔍 可能的原因："
  echo "1. 数据库连接被占用"
  echo "2. node_modules 文件被锁定"
  echo "3. Prisma schema 有语法错误"
  echo ""
  echo "💡 建议："
  echo "1. 关闭所有开发服务器和数据库客户端"
  echo "2. 重启终端"
  echo "3. 重新运行此脚本"
fi

