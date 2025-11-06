#!/bin/bash

# ChunkLoadError 修复验证脚本
# 用于验证修复是否成功

echo "🔍 验证 ChunkLoadError 修复..."
echo ""

# 1. 检查文件存在
echo "📌 步骤 1: 检查错误边界文件..."
if [ -f "app/(dashboard)/inventory/adjustments/error.tsx" ]; then
    echo "✅ error.tsx 文件存在"
else
    echo "❌ error.tsx 文件不存在！"
    exit 1
fi

# 2. 检查导入是否正确
echo ""
echo "📌 步骤 2: 检查错误上报服务导入..."
if grep -q "reportErrorBoundary" "app/(dashboard)/inventory/adjustments/error.tsx"; then
    echo "✅ 使用 reportErrorBoundary (统一的错误上报)"
else
    echo "⚠️  未使用 reportErrorBoundary"
fi

# 3. 检查 .next 目录
echo ""
echo "📌 步骤 3: 检查构建缓存状态..."
if [ -d ".next" ]; then
    echo "⚠️  .next 目录存在 (需要重新构建)"
    echo "   建议运行: rm -rf .next && npm run dev"
else
    echo "✅ .next 缓存已清理"
fi

# 4. 运行 TypeScript 检查
echo ""
echo "📌 步骤 4: 运行 TypeScript 检查..."
if npm run type-check > /dev/null 2>&1; then
    echo "✅ TypeScript 检查通过"
else
    echo "⚠️  TypeScript 检查有警告"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 验证完成！"
echo ""
echo "📝 下一步操作："
echo "   1. 启动开发服务器: npm run dev"
echo "   2. 访问页面: http://localhost:3000/inventory/adjustments"
echo "   3. 检查浏览器控制台是否有错误"
echo ""
echo "🔧 如果问题仍然存在："
echo "   1. 硬刷新浏览器: Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)"
echo "   2. 清理浏览器缓存"
echo "   3. 重启开发服务器"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

