@echo off
color 0A
title Compiler Service Starter
echo ========================================
echo   Compiler Service Starter
echo ========================================
echo.

:: Get the directory where this batch file is located
set "BATCH_DIR=%~dp0"
if "%BATCH_DIR:~-1%"=="\" set "BATCH_DIR=%BATCH_DIR:~0,-1%"

echo [INFO] Batch file location: %BATCH_DIR%
echo.

:: Change to the batch file directory (handles spaces with quotes)
cd /d "%BATCH_DIR%"
echo [INFO] Changed to: %cd%
echo.

:: Check if compiler exists (use full path with quotes)
if exist "%BATCH_DIR%\CompilerService.exe" (
    echo [SUCCESS] Found CompilerService.exe
    echo [INFO] Starting compiler on http://localhost:5001
    echo.
    
    :: Start the compiler with full path and quotes (handles spaces)
    start "" "%BATCH_DIR%\CompilerService.exe" --urls=http://localhost:5001
    
    :: Wait a moment for it to start
    timeout /t 3 /nobreak >nul
    
    echo.
    echo ========================================
    echo   COMPILER SERVICE STARTED!
    echo ========================================
    echo.
    echo [SUCCESS] Service is running on http://localhost:5001
    echo [INFO] Keep this window open
    echo [INFO] Refresh your browser
    echo.
    
    :: Test if the compiler is actually running
    echo [INFO] Testing connection...
    curl -s http://localhost:5001/health >nul 2>&1
    if errorlevel 1 (
        echo [WARNING] Compiler may not be responding. Check the port.
    ) else (
        echo [SUCCESS] Compiler is responding!
    )
) else (
    echo [ERROR] CompilerService.exe not found!
    echo [INFO] Current folder: %cd%
    echo.
    echo [INFO] Files in this folder:
    dir /b
    echo.
    echo [INFO] Please make sure CompilerService.exe is in this folder
)
pause
