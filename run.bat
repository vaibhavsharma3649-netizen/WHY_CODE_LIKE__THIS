@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "ROOT=%~dp0"
set "JAVA_HOME=%ROOT%.tools\jre\jdk-21.0.12.1+1-jre"
set "NEO4J_HOME=%ROOT%.tools\neo4j\neo4j-community-5.26.0"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo ============================================================
echo  WhyCode - local demo stack
echo ============================================================
echo.

if not exist "%ROOT%.env" (
  echo [ERROR] .env is missing.
  echo Copy .env.example to .env and set NEO4J_PASSWORD first.
  pause
  exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python was not found on PATH.
  pause
  exit /b 1
)

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo [ERROR] Bundled Java runtime not found at:
  echo   %JAVA_HOME%
  pause
  exit /b 1
)

if not exist "%NEO4J_HOME%\bin\neo4j.bat" (
  echo [ERROR] Local Neo4j not found at:
  echo   %NEO4J_HOME%
  pause
  exit /b 1
)

if not exist "%ROOT%frontend\node_modules" (
  echo [setup] Installing frontend dependencies...
  pushd "%ROOT%frontend"
  call npm.cmd install
  popd
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%.env") do if /I "%%A"=="NEO4J_URI" set "NEO4J_URI=%%B"
set "NEO4J_REMOTE="
echo %NEO4J_URI% | findstr /I /C:"localhost" /C:"127.0.0.1" >nul
if errorlevel 1 set "NEO4J_REMOTE=1"

echo [1/3] Neo4j
if defined NEO4J_REMOTE (
  echo       remote database configured in .env; skipping local Neo4j.
) else (
  call :port_open 7687
  if errorlevel 1 (
    echo       starting local Neo4j...
    start "WhyCode Neo4j" /D "%NEO4J_HOME%" cmd /k "set JAVA_HOME=%JAVA_HOME%&& bin\neo4j.bat console"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=(Get-Date).AddSeconds(90); while((Get-Date) -lt $d){ try { $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',7687); $c.Close(); exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"
    if errorlevel 1 (
      echo [ERROR] Neo4j did not open port 7687 within 90 seconds.
      pause
      exit /b 1
    )
    echo       Neo4j is ready.
  ) else (
    echo       already running on port 7687.
  )
)

if /I "%~1"=="seed" (
  echo [seed] Resetting and re-seeding the demo graph...
  python "%ROOT%scripts\seed.py" --reset
  if errorlevel 1 (
    echo [ERROR] Seeding failed.
    pause
    exit /b 1
  )
)

echo [2/3] API
call :http_ok 8000 /api/health
if errorlevel 1 (
  echo       starting FastAPI on port 8000...
  start "WhyCode API" /D "%ROOT%backend" cmd /k python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=(Get-Date).AddSeconds(90); while((Get-Date) -lt $d){ try { Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 2 | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"
  if errorlevel 1 (
    echo [ERROR] API did not become healthy within 90 seconds.
    pause
    exit /b 1
  )
  echo       API is ready.
) else (
  echo       already running on port 8000.
)

echo [3/3] Web UI
call :http_ok 5173 /
if errorlevel 1 (
  echo       starting Vite on port 5173...
  start "WhyCode UI" /D "%ROOT%frontend" cmd /k npm.cmd run dev
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=(Get-Date).AddSeconds(90); while((Get-Date) -lt $d){ try { Invoke-WebRequest 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"
  if errorlevel 1 (
    echo [ERROR] UI did not become ready within 90 seconds.
    pause
    exit /b 1
  )
  echo       UI is ready.
) else (
  echo       already running on port 5173.
)

echo.
echo ============================================================
echo  Ready:    http://127.0.0.1:5173
echo  API:      http://127.0.0.1:8000/api/health
if defined NEO4J_REMOTE (
  echo  Neo4j:    remote database from .env
) else (
  echo  Neo4j:    bolt://127.0.0.1:7687  (browser: http://127.0.0.1:7474)
)
echo.
echo  Demo login: ada@whyc.dev / whyc-demo
echo  Other users: maya, dev, sec, reader @whyc.dev
echo  Beta admin:  grace@beta.dev / whyc-demo
echo.
echo  To reset and reseed the graph, run:  run.bat seed
echo ============================================================
echo.

start "" "http://127.0.0.1:5173"
exit /b 0

:port_open
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',%1); $c.Close(); exit 0 } catch { exit 1 }"
exit /b %errorlevel%

:http_ok
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest 'http://127.0.0.1:%1%2' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
exit /b %errorlevel%
