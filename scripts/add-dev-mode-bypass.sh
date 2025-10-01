#!/bin/bash

# 批量为财务 API 添加开发模式绕过的脚本
# 此脚本用于快速修复所有需要添加开发模式绕过的 API

echo "开始批量添加开发模式绕过..."

# 需要修复的文件列表
files=(
  "app/api/finance/payments-out/route.ts"
  "app/api/finance/payments-out/[id]/route.ts"
  "app/api/finance/receivables/route.ts"
  "app/api/finance/receivables/statistics/route.ts"
  "app/api/finance/refunds/route.ts"
  "app/api/finance/refunds/[id]/route.ts"
  "app/api/finance/refunds/statistics/route.ts"
  "app/api/finance/payables/statistics/route.ts"
  "app/api/payments/route.ts"
  "app/api/payments/[id]/route.ts"
)

echo "需要修复的文件数量: ${#files[@]}"

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ 找到文件: $file"
  else
    echo "✗ 文件不存在: $file"
  fi
done

echo "请手动修复这些文件，或使用 IDE 的查找替换功能"
echo "查找: const session = await getServerSession(authOptions);"
echo "      if (!session"
echo "替换为: if (env.NODE_ENV !== 'development') {"
echo "        const session = await getServerSession(authOptions);"
echo "        if (!session"
echo "并在文件顶部添加: import { env } from '@/lib/env';"

