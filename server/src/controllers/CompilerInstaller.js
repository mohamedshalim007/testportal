// Add these routes in app.js after the compiler routes

// Download just the exe
app.get('/api/compiler/download-exe', (req, res) => {
  const compilerPath = 'D:\\testcomplier\\full_project\\compiler-service\\publish\\CompilerService.exe';
  if (!fs.existsSync(compilerPath)) {
    return res.status(404).json({ error: 'CompilerService.exe not found' });
  }
  res.download(compilerPath, 'CompilerService.exe');
});

// Download just the batch file
app.get('/api/compiler/download-batch', (req, res) => {
  const batchContent = `@echo off
color 0A
title Compiler Service Starter
echo ========================================
echo   Compiler Service Starter
echo ========================================
echo.

set "BATCH_DIR=%~dp0"
if "%BATCH_DIR:~-1%"=="\\" set "BATCH_DIR=%BATCH_DIR:~0,-1%"

cd /d "%BATCH_DIR%"

if exist "CompilerService.exe" (
    echo [SUCCESS] Found CompilerService.exe
    echo [INFO] Starting compiler on http://localhost:5001
    echo.
    start "" "CompilerService.exe" --urls=http://localhost:5001
    timeout /t 2 /nobreak >nul
    echo.
    echo ========================================
    echo   COMPILER SERVICE STARTED!
    echo ========================================
    echo.
    echo [SUCCESS] Service is running on http://localhost:5001
    echo [INFO] Keep this window open
    echo [INFO] Refresh your browser
) else (
    echo [ERROR] CompilerService.exe not found!
    echo [INFO] Files in this folder:
    dir /b
)
pause`;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="start-compiler.bat"');
  res.send(batchContent);
});