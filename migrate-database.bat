@echo off
chcp 65001 >nul
echo ========================================
echo 数据库迁移脚本 (phpStudy MySQL)
echo ========================================
echo.

echo [步骤 1/4] 检查 MySQL 服务状态...
sc query MySQL57 | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo ✓ MySQL 服务正在运行
) else (
    echo ✗ MySQL 服务未运行
    echo.
    echo 正在尝试启动 MySQL 服务...
    net start MySQL57 >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✓ MySQL 服务启动成功
    ) else (
        echo ✗ MySQL 服务启动失败（需要管理员权限）
        echo.
        echo 请执行以下操作之一：
        echo   1. 右键点击此文件，选择"以管理员身份运行"
        echo   2. 打开 phpStudy Pro 控制面板，点击"启动 MySQL"按钮
        echo   3. 手动运行: net start MySQL57 (需要管理员权限)
        echo.
        pause
        exit /b 1
    )
)
echo.

echo [步骤 2/4] 同步数据库 Schema...
echo 运行: npx prisma db push
echo.
call npx prisma db push
if %errorlevel% neq 0 (
    echo.
    echo ✗ 数据库同步失败
    echo.
    echo 可能的原因：
    echo   1. MySQL 服务未运行
    echo   2. 数据库连接信息不正确（检查 .env 文件）
    echo   3. 数据库不存在（需要先创建 kucun_dev 数据库）
    echo.
    pause
    exit /b 1
)
echo.

echo [步骤 3/4] 重新生成 Prisma Client...
echo 运行: npx prisma generate
echo.
call npx prisma generate
if %errorlevel% neq 0 (
    echo.
    echo ✗ Prisma Client 生成失败
    pause
    exit /b 1
)
echo.

echo [步骤 4/4] 验证数据库状态...
echo 运行: npx prisma migrate status
echo.
call npx prisma migrate status
echo.

echo ========================================
echo 数据库迁移完成！
echo ========================================
echo.
echo 下一步操作：
echo   1. 验证 shipping_tracking_history 表是否创建成功
echo   2. 继续开发 UI 界面
echo.
pause

