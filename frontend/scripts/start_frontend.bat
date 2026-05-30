@echo off
setlocal
set "DIST=%~dp0..\dist\frontend\browser"

if not exist "%DIST%\index.html" (
  echo [WorkDesk] ERROR: Production build not found at:
  echo   %DIST%
  echo Run from repo: cd frontend ^&^& npx ng build --configuration production
  exit /b 1
)

where serve >nul 2>&1
if errorlevel 1 (
  echo [WorkDesk] ERROR: 'serve' not on PATH. Install: npm install -g serve
  exit /b 1
)

serve "%DIST%" -l tcp://0.0.0.0:80 -s
