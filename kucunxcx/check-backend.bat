@echo off
chcp 65001 >nul
echo ========================================
echo 检查后端服务状态
echo ========================================
echo.

echo 1. 检查后端服务是否运行在 3000 端口...
netstat -ano | findstr :3000
if %errorlevel% neq 0 (
    echo ❌ 后端服务未运行
    echo.
    echo 请先启动后端服务:
    echo   cd E:\kucun
    echo   npm run dev
    pause
    exit /b 1
)
echo ✅ 检测到 3000 端口有进程运行
echo.

echo 2. 测试后端 API 连接...
curl -s http://localhost:3000/api/products?page=1^&limit=1 >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 无法连接到后端 API
    echo.
    echo 可能的原因:
    echo   - 后端服务未正确启动
    echo   - 端口被其他程序占用
    echo   - 防火墙阻止了连接
    pause
    exit /b 1
)
echo ✅ 后端 API 连接成功
echo.

echo 3. 测试登录接口...
curl -s -X POST http://localhost:3000/api/auth/mini-login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"testuser\",\"password\":\"test123456\"}" ^
  >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 登录接口测试失败
    pause
    exit /b 1
)
echo ✅ 登录接口正常
echo.

echo ========================================
echo ✅ 后端服务检查完成！
echo ========================================
echo.
echo 现在可以打开微信开发者工具测试小程序了
echo.
echo 测试账号:
echo   用户名: testuser
echo   密码: test123456
echo.
pause
