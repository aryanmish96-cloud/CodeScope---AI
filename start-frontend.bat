@echo off
echo ============================================
echo   CodeScope AI - Starting Frontend
echo ============================================
cd /d "%~dp0frontend"
echo Starting React frontend on http://localhost:3000
npm run dev
pause
