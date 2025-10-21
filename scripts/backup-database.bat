@echo off
echo ================================================================================
echo 数据库备份
echo ================================================================================
echo.

:: 从 .env 文件读取数据库配置
for /f "tokens=1,2 delims==" %%a in ('findstr /r "^DATABASE_URL" .env') do (
    set DB_URL=%%b
)

:: 解析数据库连接字符串
:: mysql://root:root@localhost:3306/kucun_dev
for /f "tokens=1,2,3,4 delims=/:@" %%a in ("%DB_URL%") do (
    set DB_USER=%%b
    set DB_PASS=%%c
    set DB_HOST=%%d
    set DB_PORT=%%e
)

:: 提取数据库名（最后一个/后面，?前面的部分）
for /f "tokens=1 delims=?" %%a in ("%DB_URL%") do (
    for %%b in (%%a) do set TEMP_URL=%%b
)
for %%a in ("%TEMP_URL:/=" "%") do set DB_NAME=%%~nxa

:: 创建备份文件名（带时间戳）
set BACKUP_FILE=backup_%DB_NAME%_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.sql
set BACKUP_FILE=%BACKUP_FILE: =0%

echo 数据库: %DB_NAME%
echo 备份文件: %BACKUP_FILE%
echo.

:: 执行备份
echo 正在备份数据库...
mysqldump -h %DB_HOST% -u %DB_USER% -p%DB_PASS% %DB_NAME% > %BACKUP_FILE%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ 备份成功: %BACKUP_FILE%
) else (
    echo.
    echo ❌ 备份失败
    exit /b 1
)

echo.
echo ================================================================================
