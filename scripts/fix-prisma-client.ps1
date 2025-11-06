# 修复 Prisma Client 生成问题
# 用法: .\scripts\fix-prisma-client.ps1

Write-Host "🔧 开始修复 Prisma Client..." -ForegroundColor Cyan

# 1. 删除旧的 Prisma Client
Write-Host "📦 删除旧的 Prisma Client..." -ForegroundColor Yellow
if (Test-Path "node_modules\.prisma") {
    Remove-Item -Path "node_modules\.prisma" -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path "node_modules\@prisma\client") {
    Remove-Item -Path "node_modules\@prisma\client" -Recurse -Force -ErrorAction SilentlyContinue
}

# 2. 重新安装 Prisma Client
Write-Host "📦 重新安装 Prisma Client..." -ForegroundColor Yellow
npm install @prisma/client

# 3. 生成新的 Prisma Client
Write-Host "🔨 生成新的 Prisma Client..." -ForegroundColor Yellow
npx prisma generate

# 4. 验证生成结果
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Prisma Client 生成成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 下一步：" -ForegroundColor Cyan
    Write-Host "1. 运行 npm run type-check 验证类型"
    Write-Host "2. 运行 npm run lint 检查代码质量"
    Write-Host "3. 运行 npm run dev 启动开发服务器"
} else {
    Write-Host "❌ Prisma Client 生成失败！" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 可能的原因：" -ForegroundColor Yellow
    Write-Host "1. 数据库连接被占用"
    Write-Host "2. node_modules 文件被锁定"
    Write-Host "3. Prisma schema 有语法错误"
    Write-Host ""
    Write-Host "💡 建议：" -ForegroundColor Cyan
    Write-Host "1. 关闭所有开发服务器和数据库客户端"
    Write-Host "2. 重启终端"
    Write-Host "3. 重新运行此脚本"
}

