@echo off
REM Double-click to run the Nemchyo app in your web browser.
REM IMPORTANT: start the backend first (backend\start-backend.cmd).
cd /d "%~dp0"
echo Starting Nemchyo (web). A browser tab will open at http://localhost:8081
echo (Backend must be running: backend\start-backend.cmd)
echo.
npx expo start --web
