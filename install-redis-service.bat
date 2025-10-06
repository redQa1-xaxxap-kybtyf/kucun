@echo off
echo ================================================
echo Redis Windows Service Installation Script
echo ================================================
echo.

REM Check for administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Error: This script requires administrator privileges
    echo Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo [Step 1/4] Checking if Redis service already exists...
sc query Redis >nul 2>&1
if %errorLevel% equ 0 (
    echo Redis service already exists. Stopping and removing it...
    net stop Redis >nul 2>&1
    sc delete Redis
    timeout /t 2 /nobreak >nul
)

echo [Step 2/4] Creating Redis service...
sc.exe create Redis binpath="E:\erkai123\Redis-8.0.3-Windows-x64-cygwin-with-Service\RedisService.exe" start= auto
if %errorLevel% neq 0 (
    echo Error: Failed to create Redis service
    pause
    exit /b 1
)

echo [Step 3/4] Starting Redis service...
net start Redis
if %errorLevel% neq 0 (
    echo Error: Failed to start Redis service
    pause
    exit /b 1
)

echo [Step 4/4] Verifying Redis service status...
sc query Redis

echo.
echo ================================================
echo Redis service installed and started successfully!
echo ================================================
echo.
echo Service Name: Redis
echo Startup Type: Automatic (will start on boot)
echo Port: 6379
echo.

pause
