@echo off
echo ========================================
echo 启动 MySQL 服务 (phpStudy)
echo ========================================
echo.

echo 正在启动 MySQL57 服务...
net start MySQL57

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo MySQL 服务启动成功！
    echo ========================================
    echo.
    echo 现在可以运行以下命令完成数据库迁移：
    echo   1. npx prisma db push
    echo   2. npx prisma generate
    echo.
) else (
    echo.
    echo ========================================
    echo MySQL 服务启动失败！
    echo ========================================
    echo.
    echo 可能的原因：
    echo   1. 需要管理员权限（请右键点击此文件，选择"以管理员身份运行"）
    echo   2. MySQL 服务已经在运行
    echo   3. 服务名称不正确
    echo.
    echo 请尝试以下方法：
    echo   1. 右键点击此文件，选择"以管理员身份运行"
    echo   2. 或者打开 phpStudy Pro 控制面板，点击"启动 MySQL"按钮
    echo.
)

pause

