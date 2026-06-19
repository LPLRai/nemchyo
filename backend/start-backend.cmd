@echo off
REM Double-click this file to start the messenger backend (Pocketbase).
REM Admin UI: http://127.0.0.1:8090/_/
cd /d "%~dp0"
echo Starting Pocketbase on http://127.0.0.1:8090 ...
echo Admin UI:  http://127.0.0.1:8090/_/
echo Press Ctrl+C in this window to stop the server.
echo.
pocketbase.exe serve --http=127.0.0.1:8090
pause
