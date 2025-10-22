@echo off
echo 正在重新生成 Prisma Client...
echo.

REM 删除临时文件
echo 清理临时文件...
del /F /Q "node_modules\.prisma\client\*.tmp*" 2>nul

REM 等待一秒
timeout /t 1 /nobreak >nul

REM 重新生成
echo 生成 Prisma Client...
npx prisma generate

echo.
echo 完成!
pause

