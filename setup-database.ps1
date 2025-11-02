# 数据库设置脚本
# 用于检查和创建 kucun_dev 数据库

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "数据库设置脚本 (phpStudy MySQL)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 从 .env 文件读取数据库连接信息
$envFile = Get-Content .env -ErrorAction SilentlyContinue
$databaseUrl = ($envFile | Select-String -Pattern '^DATABASE_URL=').ToString()

if ($databaseUrl) {
    Write-Host "✓ 找到数据库连接配置" -ForegroundColor Green
    Write-Host "  $databaseUrl" -ForegroundColor Gray
} else {
    Write-Host "✗ 未找到 DATABASE_URL 配置" -ForegroundColor Red
    Write-Host "  请检查 .env 文件" -ForegroundColor Yellow
    pause
    exit 1
}
Write-Host ""

# 检查 MySQL 服务状态
Write-Host "[步骤 1/3] 检查 MySQL 服务状态..." -ForegroundColor Yellow
$service = Get-Service -Name "MySQL57" -ErrorAction SilentlyContinue

if ($service) {
    if ($service.Status -eq "Running") {
        Write-Host "✓ MySQL 服务正在运行" -ForegroundColor Green
    } else {
        Write-Host "✗ MySQL 服务未运行 (状态: $($service.Status))" -ForegroundColor Red
        Write-Host ""
        Write-Host "请执行以下操作之一：" -ForegroundColor Yellow
        Write-Host "  1. 打开 phpStudy Pro 控制面板，点击'启动 MySQL'按钮" -ForegroundColor White
        Write-Host "  2. 以管理员身份运行: Start-Service -Name 'MySQL57'" -ForegroundColor White
        Write-Host "  3. 运行: .\start-mysql.bat (右键 -> 以管理员身份运行)" -ForegroundColor White
        Write-Host ""
        pause
        exit 1
    }
} else {
    Write-Host "✗ 未找到 MySQL57 服务" -ForegroundColor Red
    Write-Host "  请检查 phpStudy 是否正确安装" -ForegroundColor Yellow
    pause
    exit 1
}
Write-Host ""

# 检查 MySQL 命令行工具
Write-Host "[步骤 2/3] 检查 MySQL 命令行工具..." -ForegroundColor Yellow
$mysqlPath = "D:\phpstudy_pro\Extensions\MySQL5.7.26\bin\mysql.exe"

if (Test-Path $mysqlPath) {
    Write-Host "✓ 找到 MySQL 命令行工具" -ForegroundColor Green
    Write-Host "  路径: $mysqlPath" -ForegroundColor Gray
} else {
    Write-Host "✗ 未找到 MySQL 命令行工具" -ForegroundColor Red
    Write-Host "  预期路径: $mysqlPath" -ForegroundColor Yellow
    
    # 尝试查找其他版本
    $mysqlVersions = Get-ChildItem -Path "D:\phpstudy_pro\Extensions" -Filter "MySQL*" -Directory -ErrorAction SilentlyContinue
    if ($mysqlVersions) {
        Write-Host ""
        Write-Host "  找到以下 MySQL 版本：" -ForegroundColor Yellow
        foreach ($version in $mysqlVersions) {
            Write-Host "    - $($version.Name)" -ForegroundColor White
            $altMysqlPath = Join-Path $version.FullName "bin\mysql.exe"
            if (Test-Path $altMysqlPath) {
                $mysqlPath = $altMysqlPath
                Write-Host "      ✓ 找到 mysql.exe" -ForegroundColor Green
                break
            }
        }
    }
}
Write-Host ""

# 创建数据库（如果不存在）
Write-Host "[步骤 3/3] 检查并创建数据库..." -ForegroundColor Yellow
Write-Host "数据库名称: kucun_dev" -ForegroundColor Gray
Write-Host ""

$createDbSql = @"
CREATE DATABASE IF NOT EXISTS kucun_dev 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
"@

Write-Host "执行 SQL:" -ForegroundColor Gray
Write-Host $createDbSql -ForegroundColor DarkGray
Write-Host ""

# 使用 mysql 命令行工具创建数据库
$mysqlCmd = "& `"$mysqlPath`" -u root -proot -e `"$createDbSql`""
try {
    Invoke-Expression $mysqlCmd 2>&1 | Out-Null
    Write-Host "✓ 数据库检查/创建完成" -ForegroundColor Green
} catch {
    Write-Host "✗ 数据库创建失败" -ForegroundColor Red
    Write-Host "  错误: $_" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "请手动创建数据库：" -ForegroundColor Yellow
    Write-Host "  1. 打开 phpStudy Pro -> 数据库 -> phpMyAdmin" -ForegroundColor White
    Write-Host "  2. 创建新数据库: kucun_dev" -ForegroundColor White
    Write-Host "  3. 字符集: utf8mb4" -ForegroundColor White
    Write-Host "  4. 排序规则: utf8mb4_unicode_ci" -ForegroundColor White
    Write-Host ""
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "数据库设置完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步操作：" -ForegroundColor Yellow
Write-Host "  1. 运行: .\migrate-database.bat (右键 -> 以管理员身份运行)" -ForegroundColor White
Write-Host "  2. 或者手动运行:" -ForegroundColor White
Write-Host "     - npx prisma db push" -ForegroundColor Gray
Write-Host "     - npx prisma generate" -ForegroundColor Gray
Write-Host ""
pause

