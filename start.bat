@echo off
echo ========================================================
echo         CareAudit AI - Startup Script
echo    AI prepares - Human decides - AI audits
echo ========================================================
echo.

:: -- Step 1: Check Python --
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH!
    pause
    exit /b 1
)

:: -- Step 2: Check Node.js --
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH!
    pause
    exit /b 1
)

:: -- Step 3: Set up Python Virtual Environment --
echo [1/6] Setting up Python virtual environment...
cd /d "%~dp0backend"
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo Virtual environment activated.

:: -- Step 4: Install Python Dependencies --
echo [2/6] Installing Python dependencies...
pip install -r requirements.txt --quiet 2>nul
echo Python dependencies installed.

:: -- Step 5: Initialize Database and Seed Data --
echo [3/6] Initializing DuckDB database...
set PYTHONIOENCODING=utf-8
python -c "from app.database import init_database; init_database()"
echo.
echo [4/6] Seeding demo data...
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
python backend\scripts\seed_full.py
echo.

:: -- Step 6: Install Frontend Dependencies --
echo [5/6] Installing frontend dependencies...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    call npm install --quiet 2>nul
)
echo Frontend dependencies ready.

:: -- Step 7: Start Backend and Frontend --
echo [6/6] Starting CareAudit AI...
echo.
echo ========================================================
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo   Frontend: http://localhost:3001
echo ========================================================
echo.
echo Starting backend (FastAPI) and frontend (Next.js)...
echo Press Ctrl+C to stop both servers.
echo.

:: Start Backend in background
cd /d "%~dp0backend"
set PYTHONIOENCODING=utf-8
start "CareAudit-Backend" cmd /c "call venv\Scripts\activate.bat && set PYTHONIOENCODING=utf-8 && uvicorn app.main:app --reload --port 8000"

:: Start Frontend in foreground
cd /d "%~dp0frontend"
node "node_modules/next/dist/bin/next" dev

pause
