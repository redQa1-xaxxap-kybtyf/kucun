@echo off
REM ========================================
REM MySQL 服务重启脚本（管理员权限）
REM ========================================
REM 双击此文件即可自动以管理员权限重启 MySQL 服务
REM ========================================

echo ========================================
echo MySQL 服务重启脚本
echo ========================================
echo.

REM 检查管理员权限
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] 管理员权限验证通过
    echo.
    goto :run_script
) else (
    echo [!] 需要管理员权限，正在请求提升权限...
    echo.
    
    REM 请求管理员权限并重新运行
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:run_script
echo [*] 正在重启 MySQL 服务...
echo.

REM 停止 MySQL 服务
echo [1/3] 停止 MySQL 服务...
net stop MySQL57 2>nul
if %errorLevel% == 0 (
    echo [OK] MySQL 服务已停止
) else (
    echo [!] MySQL 服务未运行或停止失败
)
echo.

REM 等待 2 秒
timeout /t 2 /nobreak >nul

REM 启动 MySQL 服务
echo [2/3] 启动 MySQL 服务...
net start MySQL57
if %errorLevel% == 0 (
    echo [OK] MySQL 服务已启动
) else (
    echo [X] MySQL 服务启动失败！
    echo.
    echo 可能的原因:
    echo 1. my.ini 配置文件有语法错误
    echo 2. MySQL 数据目录权限问题
    echo 3. 端口 3306 被占用
    echo.
    echo 请检查错误日志:
    echo    D:\phpstudy_pro\Extensions\MySQL5.7.26\data\*.err
    echo.
    pause
    exit /b 1
)
echo.

REM 验证服务状态
echo [3/3] 验证服务状态...
sc query MySQL57 | find "RUNNING" >nul
if %errorLevel% == 0 (
    echo [OK] MySQL 服务运行正常
    echo.
    echo ========================================
    echo 成功！MySQL 服务已重启
    echo ========================================
    echo.
    echo 下一步: 验证配置是否生效
    echo    运行以下命令:
    echo    mysql -u root -proot -e "SHOW VARIABLES LIKE 'default_storage_engine';"
    echo    mysql -u root -proot -e "SHOW VARIABLES LIKE 'character_set_server';"
    echo    mysql -u root -proot -e "SHOW VARIABLES LIKE 'collation_server';"
    echo.
) else (
    echo [X] MySQL 服务状态异常
    echo.
)

pause

