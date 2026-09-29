@echo off
chcp 65001 >nul
title [War of Genesis] LiveSync 1-Click Launcher
color 0B
cls

echo.
echo  ================================================================
echo    WAR OF GENESIS IDLE LOOT -- LIVESYNC 1-CLICK LAUNCHER
echo    (Install Node.js, load the hook, launch the game and connect the Helper)
echo  ================================================================
echo.

:: ================================================================
:: 1. KIEM TRA VA TU DONG TAI/CAI DAT NODE.JS NEU CHUA CO
:: ================================================================
where node >nul 2>&1
if not errorlevel 1 goto NODE_READY

if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    goto NODE_READY
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    goto NODE_READY
)
if exist "%LocalAppData%\Programs\node\node.exe" (
    set "PATH=%LocalAppData%\Programs\node;%PATH%"
    goto NODE_READY
)

echo  ----------------------------------------------------------------
echo   [!] Node.js is not installed on this computer.
echo   [!] Downloading and installing the official Node.js LTS release...
echo  ----------------------------------------------------------------
echo.

:: Thu cai dat qua winget (Windows Package Manager tren Win 10/11)
where winget >nul 2>&1
if not errorlevel 1 (
    echo  [*] Installing Node.js through Windows Package Manager...
    winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements >nul 2>&1
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
        goto NODE_READY
    )
)

:: Neu winget khong thanh cong, tai truc tiep file MSI tu nodejs.org
echo  [*] Downloading the Node.js installer from nodejs.org - about 30 MB...
set "NODE_MSI=%TEMP%\nodejs_installer.msi"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $wc = New-Object System.Net.WebClient; $wc.DownloadFile('https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi', '%NODE_MSI%')"

if exist "%NODE_MSI%" (
    echo  [*] Installing Node.js on this computer...
    msiexec.exe /i "%NODE_MSI%" /passive /norestart
    del /f /q "%NODE_MSI%" >nul 2>&1
)

:: Cap nhat lai bien moi truong PATH sau khi cai dat
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    goto NODE_READY
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    goto NODE_READY
)

where node >nul 2>&1
if errorlevel 1 (
    color 0C
    echo.
    echo  [ERROR] Automatic Node.js installation failed.
    echo  Please download Node.js LTS from https://nodejs.org and install it manually.
    echo.
    pause
    exit /b 1
)

:NODE_READY
echo  [OK] Node.js is ready:
node -v
echo.

:: ================================================================
:: 2. KIEM TRA DU LIEU GAME TRONG APPDATA
:: ================================================================
set "APPDATA_TARGET=%USERPROFILE%\AppData\LocalLow\Newnormal Soft\War of Genesis Idle Loot\scripts\src"
set "INIT_FILE=%APPDATA_TARGET%\init.bundle.mjs"

if exist "%INIT_FILE%" goto GAME_DATA_READY

color 0C
echo  [ERROR] Game data was not found at:
echo  "%APPDATA_TARGET%"
echo.
echo  Install and launch the game at least once before running this installer.
echo.
pause
exit /b 1

:GAME_DATA_READY

:: ================================================================
:: 3. CHUYEN VE THU MUC CHUA FILE BAT VA KIEM TRA CAC FILE HO TRO
:: ================================================================
cd /d "%~dp0"

if not exist "%~dp0install_game_hook_v2.js" (
    color 0C
    echo  [ERROR] install_game_hook_v2.js was not found in this folder!
    echo.
    echo  Download LiveSync_1Click.zip and extract all included files together:
    echo    1. cai_dat_livesync.bat
    echo    2. install_game_hook_v2.js
    echo    3. livesync_bridge.js
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0livesync_bridge.js" (
    color 0C
    echo  [ERROR] livesync_bridge.js was not found in this folder!
    echo.
    echo  Download LiveSync_1Click.zip and extract all included files together.
    echo.
    pause
    exit /b 1
)

:: ================================================================
:: 4. CAI DAT REAL-TIME HOOK VAO GAME
:: ================================================================
echo  [1/4] Installing the real-time game hook...
node "%~dp0install_game_hook_v2.js"
if errorlevel 1 (
    color 0C
    echo  [ERROR] Game hook installation failed!
    pause
    exit /b 1
)

:: ================================================================
:: 5. TAT TIEN TRINH BRIDGE CU TRONG PORT 10998
:: ================================================================
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":10998 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
ping -n 2 127.0.0.1 >nul

:: ================================================================
:: 6. KHOI DONG / KHOI DONG LAI GAME QUA STEAM
:: ================================================================
echo.
echo  [2/4] Checking and launching War of Genesis...
tasklist | findstr /I "Genesis.exe" >nul 2>&1
if errorlevel 1 (
    echo        Requesting game launch through Steam...
    start steam://run/4891320
    echo        [OK] Game launch request sent to Steam!
) else (
    echo        [!] Genesis.exe is already running!
    echo        [!] Restarting the game through Steam to load the updated hook...
    taskkill /IM "Genesis.exe" /F >nul 2>&1
    ping -n 3 127.0.0.1 >nul
    start steam://run/4891320
    echo        [OK] Game restart request sent to Steam!
)

:: ================================================================
:: 7. MO WEB HELPER TREN TRINH DUYET MAC DINH
:: ================================================================
echo.
echo  [3/4] Opening the Helper in your browser...
ping -n 3 127.0.0.1 >nul
echo        Opening bundled fork: index.html
if exist "%~dp0index.html" (
    start "" "%~dp0index.html"
) else (
    echo [NOTICE] index.html is missing. Open your fork index.html manually.
)

:: ================================================================
:: 8. KHOI DONG LIVESYNC BRIDGE TREN CONG 10998
:: ================================================================
echo.
echo  [4/4] Starting LiveSync Bridge on port 10998...
echo  ================================================================
echo   [OK] Game and Helper launch requests have been sent.
echo   [INFO] LiveSync Bridge endpoint: ws://127.0.0.1:10998
echo   [NOTE] Keep this window open while using the game and Helper.
echo  ================================================================
echo.

node "%~dp0livesync_bridge.js"

echo.
echo  [STOPPED] LiveSync Bridge has stopped.
pause
