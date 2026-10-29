@echo off
setlocal EnableExtensions
cd /d "%~dp0frontend"

echo ============================================================
echo  WhyCode - frontend production build
echo ============================================================
echo.

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found on PATH.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [setup] Installing frontend dependencies...
  call npm.cmd install
  if errorlevel 1 goto fail
)

call npm.cmd run build
if errorlevel 1 goto fail

echo.
echo Build complete.
echo Output: %~dp0frontend\dist
echo.
dir /b "%~dp0frontend\dist"
exit /b 0

:fail
echo.
echo [ERROR] Build failed.
pause
exit /b 1
