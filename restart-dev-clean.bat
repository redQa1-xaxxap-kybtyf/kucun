@echo off
echo Stopping all Node.js processes...
taskkill /F /IM node.exe 2>nul
timeout /t 3 /nobreak >nul

echo Clearing .next cache...
if exist .next (
    rmdir /s /q .next
    echo .next cache deleted
) else (
    echo No .next directory found
)

echo Starting development server...
npm run dev

