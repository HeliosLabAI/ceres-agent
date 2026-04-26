@echo off
chcp 65001 >nul
cls

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║                                                           ║
echo ║           CERES AI AGENT - INSTALLER BUILDER              ║
echo ║                                                           ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] Installing dependencies first...
    npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check electron-builder
if not exist "node_modules\electron-builder" (
    echo [INFO] Installing electron-builder...
    npm install electron-builder --save-dev
    if errorlevel 1 (
        echo [ERROR] Failed to install electron-builder
        pause
        exit /b 1
    )
)

REM Create icon if needed
if not exist "assets\icon.ico" (
    echo.
    echo ═══════════════════════════════════════════════════════════
    echo   ICON NOT FOUND
    echo ═══════════════════════════════════════════════════════════
    echo.
    echo Please create assets\icon.ico first:
    echo.
    echo   Method 1 - Online Converter (Recommended):
    echo     1. Open assets\icon.svg in your browser
    echo     2. Take a screenshot or save as PNG
    echo     3. Go to: https://cloudconvert.com/png-to-ico
    echo     4. Convert to ICO with all sizes: 16,32,48,64,128,256
    echo.
    echo   Method 2 - Use GIMP:
    echo     1. Open assets\icon.svg in GIMP
    echo     2. Export as icon.ico
    echo.
    pause
    exit /b 1
)

echo.
echo ═══════════════════════════════════════════════════════════
echo   BUILDING INSTALLER...
echo ═══════════════════════════════════════════════════════════
echo.

npm run build:win

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo ═══════════════════════════════════════════════════════════
echo   BUILD COMPLETE!
echo ═══════════════════════════════════════════════════════════
echo.
echo Installer location:
echo   dist\Ceres AI Agent Setup.exe
echo.
echo Portable version:
echo   dist\Ceres AI Agent.exe
echo.
pause
