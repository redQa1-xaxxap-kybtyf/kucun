# ========================================
# MySQL 服务重启脚本
# ========================================
# 需要管理员权限运行
# 右键点击此文件，选择"使用 PowerShell 运行"
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MySQL 服务重启脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ 错误: 此脚本需要管理员权限运行" -ForegroundColor Red
    Write-Host ""
    Write-Host "请按以下步骤操作:" -ForegroundColor Yellow
    Write-Host "1. 右键点击此文件 (restart-mysql-service.ps1)" -ForegroundColor Yellow
    Write-Host "2. 选择 '以管理员身份运行'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "或者在管理员 PowerShell 中运行:" -ForegroundColor Yellow
    Write-Host "   cd e:\kucun\scripts" -ForegroundColor Yellow
    Write-Host "   .\restart-mysql-service.ps1" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host "✅ 管理员权限验证通过" -ForegroundColor Green
Write-Host ""

# 获取 MySQL 服务状态
Write-Host "📊 检查 MySQL 服务状态..." -ForegroundColor Cyan
$service = Get-Service -Name MySQL57 -ErrorAction SilentlyContinue

if ($null -eq $service) {
    Write-Host "❌ 错误: 未找到 MySQL57 服务" -ForegroundColor Red
    Write-Host ""
    Write-Host "请检查:" -ForegroundColor Yellow
    Write-Host "1. MySQL 是否已安装" -ForegroundColor Yellow
    Write-Host "2. 服务名称是否为 MySQL57" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host "   服务名称: $($service.Name)" -ForegroundColor White
Write-Host "   显示名称: $($service.DisplayName)" -ForegroundColor White
Write-Host "   当前状态: $($service.Status)" -ForegroundColor White
Write-Host "   启动类型: $($service.StartType)" -ForegroundColor White
Write-Host ""

# 停止 MySQL 服务
if ($service.Status -eq "Running") {
    Write-Host "🛑 正在停止 MySQL 服务..." -ForegroundColor Cyan
    try {
        Stop-Service -Name MySQL57 -Force -ErrorAction Stop
        Write-Host "✅ MySQL 服务已停止" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } catch {
        Write-Host "❌ 停止 MySQL 服务失败: $($_.Exception.Message)" -ForegroundColor Red
        Read-Host "按 Enter 键退出"
        exit 1
    }
} else {
    Write-Host "ℹ️  MySQL 服务当前未运行，跳过停止步骤" -ForegroundColor Yellow
}

Write-Host ""

# 启动 MySQL 服务
Write-Host "🚀 正在启动 MySQL 服务..." -ForegroundColor Cyan
try {
    Start-Service -Name MySQL57 -ErrorAction Stop
    Write-Host "✅ MySQL 服务已启动" -ForegroundColor Green
    Start-Sleep -Seconds 2
} catch {
    Write-Host "❌ 启动 MySQL 服务失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "可能的原因:" -ForegroundColor Yellow
    Write-Host "1. my.ini 配置文件有语法错误" -ForegroundColor Yellow
    Write-Host "2. MySQL 数据目录权限问题" -ForegroundColor Yellow
    Write-Host "3. 端口 3306 被占用" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "请检查错误日志:" -ForegroundColor Yellow
    Write-Host "   D:\phpstudy_pro\Extensions\MySQL5.7.26\data\*.err" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host ""

# 验证服务状态
Write-Host "📊 验证 MySQL 服务状态..." -ForegroundColor Cyan
$service = Get-Service -Name MySQL57
Write-Host "   当前状态: $($service.Status)" -ForegroundColor White

if ($service.Status -eq "Running") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ MySQL 服务重启成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步: 验证配置是否生效" -ForegroundColor Cyan
    Write-Host "   运行以下命令:" -ForegroundColor Yellow
    Write-Host "   mysql -u root -proot -e `"SHOW VARIABLES LIKE 'default_storage_engine';`"" -ForegroundColor Yellow
    Write-Host "   mysql -u root -proot -e `"SHOW VARIABLES LIKE 'character_set_server';`"" -ForegroundColor Yellow
    Write-Host "   mysql -u root -proot -e `"SHOW VARIABLES LIKE 'collation_server';`"" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ MySQL 服务启动失败" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
}

Read-Host "按 Enter 键退出"

