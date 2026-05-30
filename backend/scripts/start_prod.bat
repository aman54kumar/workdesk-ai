@echo off
setlocal
cd /d "%~dp0.."

if not exist "venv\Scripts\activate.bat" (
  echo [WorkDesk] ERROR: venv not found in %CD%
  echo Create it: python -m venv venv ^&^& venv\Scripts\activate ^&^& pip install -r requirements.txt
  exit /b 1
)

if not exist ".env" (
  echo [WorkDesk] ERROR: .env not found. Copy .env.example to .env and configure it.
  exit /b 1
)

call venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
