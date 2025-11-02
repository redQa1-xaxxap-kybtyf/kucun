# 重启开发服务器并清除缓存

Write-Host "=== 重启开发服务器 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 查找并停止运行在端口 3000 的进程
Write-Host "1. 停止开发服务器..." -ForegroundColor Yellow
$port = 3000
$processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    foreach ($pid in $processes) {
        Write-Host "   停止进程 PID: $pid" -ForegroundColor Gray
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
    Write-Host "   ✓ 开发服务器已停止" -ForegroundColor Green
} else {
    Write-Host "   没有运行在端口 $port 的进程" -ForegroundColor Gray
}

Write-Host ""

# 2. 清除 .next 缓存
Write-Host "2. 清除 .next 缓存..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force
    Write-Host "   ✓ .next 目录已删除" -ForegroundColor Green
} else {
    Write-Host "   .next 目录不存在" -ForegroundColor Gray
}

Write-Host ""

# 3. 清除 node_modules/.cache
Write-Host "3. 清除 node_modules 缓存..." -ForegroundColor Yellow
if (Test-Path "node_modules\.cache") {
    Remove-Item -Path "node_modules\.cache" -Recurse -Force
    Write-Host "   ✓ node_modules\.cache 已删除" -ForegroundColor Green
} else {
    Write-Host "   node_modules\.cache 不存在" -ForegroundColor Gray
}

Write-Host ""

# 4. 启动开发服务器
Write-Host "4. 启动开发服务器..." -ForegroundColor Yellow
Write-Host "   运行命令: npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "=== 请手动运行以下命令启动服务器 ===" -ForegroundColor Cyan
Write-Host "npm run dev" -ForegroundColor Green
Write-Host ""

