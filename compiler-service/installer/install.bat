@echo off
REM D:\testcomplier\full_project\compiler-service\installer\install.bat
REM Simple batch installer for all users

setlocal enabledelayedexpansion
title JMC Compiler Service Installer

:: Check for admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] This installer requires administrator privileges.
    echo [!] Please run as Administrator.
    pause
    exit /b 1
)

echo ================================================
echo   JMC Compiler Service Installer
echo ================================================
echo.

set INSTALL_DIR=C:\Program Files\JMCCompiler
set SERVICE_NAME=JMCCompiler
set EXE_PATH=%INSTALL_DIR%\CompilerService.exe

:: Create install directory
if not exist "%INSTALL_DIR%" (
    echo [1/5] Creating install directory...
    mkdir "%INSTALL_DIR%"
) else (
    echo [1/5] Install directory already exists...
)

:: Copy files
echo [2/5] Copying files...
if exist "%~dp0..\publish\CompilerService.exe" (
    copy /Y "%~dp0..\publish\CompilerService.exe" "%INSTALL_DIR%\" >nul
    echo   ✅ CompilerService.exe copied
) else (
    echo   ❌ CompilerService.exe not found!
    pause
    exit /b 1
)

:: Copy dependencies
if exist "%~dp0..\publish\*.dll" (
    copy /Y "%~dp0..\publish\*.dll" "%INSTALL_DIR%\" >nul 2>nul
)

:: Install service
echo [3/5] Installing Windows Service...
sc query %SERVICE_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo   ⚠️ Service already exists. Removing...
    sc stop %SERVICE_NAME% >nul 2>&1
    sc delete %SERVICE_NAME% >nul 2>&1
    timeout /t 2 /nobreak >nul
)

sc create %SERVICE_NAME% binPath= "%EXE_PATH%" start= auto DisplayName= "JMC Compiler Service"
if %errorlevel% equ 0 (
    echo   ✅ Service created
) else (
    echo   ❌ Failed to create service
    pause
    exit /b 1
)

:: Start service
echo [4/5] Starting service...
sc start %SERVICE_NAME%
if %errorlevel% equ 0 (
    echo   ✅ Service started
) else (
    echo   ⚠️ Service may need manual start
)

:: Register protocol
echo [5/5] Registering custom protocol...
(
echo Windows Registry Editor Version 5.00
echo.
echo [HKEY_CLASSES_ROOT\jmccompiler]
echo @="URL:JMC Compiler Protocol"
echo "URL Protocol"=""
echo.
echo [HKEY_CLASSES_ROOT\jmccompiler\shell\open\command]
echo @="\"%EXE_PATH%\" --start"
) > "%TEMP%\jmc_protocol.reg"

regedit /s "%TEMP%\jmc_protocol.reg"
if %errorlevel% equ 0 (
    echo   ✅ Protocol registered
) else (
    echo   ⚠️ Protocol registration may have failed
)

echo.
echo ================================================
echo   ✅ Installation complete!
echo ================================================
echo.
echo   📍 Install Location: %INSTALL_DIR%
echo   🌐 Service URL: http://localhost:5001
echo   🔗 Protocol: jmccompiler://
echo.
echo   To verify: http://localhost:5001/health
echo   To uninstall: sc stop %SERVICE_NAME% ^& sc delete %SERVICE_NAME%
echo.
pause