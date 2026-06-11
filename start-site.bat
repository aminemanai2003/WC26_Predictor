@echo off
cd /d "%~dp0web"
call npm run build
if errorlevel 1 (
  pause
  exit /b 1
)
start "" "http://127.0.0.1:3000"
call npm start
