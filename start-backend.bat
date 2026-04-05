@echo off
echo ============================================
echo   CodeScope AI - Starting Backend
echo ============================================
cd /d "%~dp0backend"
echo Starting FastAPI backend on http://localhost:8000
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
