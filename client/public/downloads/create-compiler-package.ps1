# create-compiler-package.ps1
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CREATING FINAL COMPILER PACKAGE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$downloadsPath = "D:\testcomplier\full_project\client\public\downloads"

# Check if CompilerService.exe exists
if (!(Test-Path "$downloadsPath\CompilerService.exe")) {
    Write-Host "CompilerService.exe not found! Building first..." -ForegroundColor Red
    cd D:\testcomplier\full_project\compiler-service\JMCCompilerService
    dotnet clean
    dotnet build -c Release
    dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o ..\publish
    Copy-Item "..\publish\CompilerService.exe" "$downloadsPath\CompilerService.exe" -Force
    Copy-Item "..\publish\appsettings.json" "$downloadsPath\appsettings.json" -Force
    Write-Host "CompilerService.exe built and copied" -ForegroundColor Green
} else {
    Write-Host "CompilerService.exe found" -ForegroundColor Green
}

# Create the batch file - FIXED with proper space handling
$batchContent = @'
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
'@

# Save the batch file
$batchPath = "$downloadsPath\start-compiler.bat"
$batchContent | Out-File -FilePath $batchPath -Encoding ascii
Write-Host "start-compiler.bat created (with space handling)" -ForegroundColor Green

# Create appsettings.json if missing
if (!(Test-Path "$downloadsPath\appsettings.json")) {
    @'
{
  "Urls": "http://localhost:5001",
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  },
  "AllowedHosts": "*",
  "Compiler": {
    "TimeoutSeconds": 10,
    "MaxMemoryMB": 256,
    "MaxOutputLines": 1000
  }
}
'@ | Out-File -FilePath "$downloadsPath\appsettings.json" -Encoding utf8
    Write-Host "appsettings.json created" -ForegroundColor Green
} else {
    Write-Host "appsettings.json already exists" -ForegroundColor Green
}

# Create README
@'
========================================
    COMPILER SERVICE - USER GUIDE
========================================

FILES INCLUDED:
- CompilerService.exe  (Main service - self-contained)
- start-compiler.bat   (Quick start script)
- appsettings.json     (Configuration file)

HOW TO START:
1. Extract ALL files to a folder on your computer
2. Right-click "start-compiler.bat"
3. Select "Run as administrator"
4. The service will start on http://localhost:5001
5. Keep the window open
6. Go back to the exam portal and refresh

IMPORTANT:
- DO NOT delete the extracted files
- Keep the Command Prompt window OPEN
- The compiler must be running for code to work
- Works with ANY folder name (even with spaces!)

TROUBLESHOOTING:

If the compiler doesn't start:
- Make sure you extracted ALL files from the ZIP
- Right-click -> "Run as administrator"
- Windows Defender may ask for permission - click "Allow"

If you see "Cannot find .NET" error:
- Download and install .NET 8.0 Runtime:
  https://dotnet.microsoft.com/en-us/download/dotnet/8.0

If port 5001 is in use:
- Edit appsettings.json and change the port number
- Change "Urls": "http://localhost:5001" to "Urls": "http://localhost:5002"

========================================
'@ | Out-File -FilePath "$downloadsPath\README.txt" -Encoding utf8
Write-Host "README.txt created" -ForegroundColor Green

# Create temporary folder for packaging
$packageDir = "D:\testcomplier\compiler-package-final"
if (Test-Path $packageDir) { Remove-Item $packageDir -Recurse -Force }
New-Item -ItemType Directory -Path $packageDir -Force | Out-Null

# Copy all files
Copy-Item "$downloadsPath\CompilerService.exe" "$packageDir\CompilerService.exe" -Force
Copy-Item "$downloadsPath\start-compiler.bat" "$packageDir\start-compiler.bat" -Force
Copy-Item "$downloadsPath\appsettings.json" "$packageDir\appsettings.json" -Force
Copy-Item "$downloadsPath\README.txt" "$packageDir\README.txt" -Force

# Remove old zip if exists
$zipPath = "$downloadsPath\compiler-service.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Create the ZIP
Compress-Archive -Path "$packageDir\*" -DestinationPath $zipPath -Force

# Clean up
Remove-Item $packageDir -Recurse -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  PACKAGE CREATED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$fileInfo = Get-Item $zipPath
Write-Host ""
Write-Host "File: $($fileInfo.Name)" -ForegroundColor Cyan
Write-Host "Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host "Location: $($fileInfo.DirectoryName)" -ForegroundColor Cyan
Write-Host ""
Write-Host "ZIP contains:" -ForegroundColor Yellow
Write-Host "   - CompilerService.exe (self-contained)" -ForegroundColor White
Write-Host "   - start-compiler.bat (works from any location, handles spaces)" -ForegroundColor White
Write-Host "   - appsettings.json (port configuration)" -ForegroundColor White
Write-Host "   - README.txt (user guide)" -ForegroundColor White
Write-Host ""
Write-Host "The ZIP is ready for users to download!" -ForegroundColor Green
Write-Host ""
Write-Host "Works with ANY folder name including:" -ForegroundColor Yellow
Write-Host "   - compiler-service" -ForegroundColor Gray
Write-Host "   - compiler-service (1)" -ForegroundColor Gray
Write-Host "   - compiler-service (2)" -ForegroundColor Gray
Write-Host "   - My Compiler Folder (with spaces)" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Refresh your browser" -ForegroundColor White
Write-Host "2. Click 'Download Package' on the Instructions page" -ForegroundColor White
Write-Host "3. Extract and run start-compiler.bat as Administrator" -ForegroundColor White
Write-Host "4. Refresh the page after the compiler starts" -ForegroundColor White