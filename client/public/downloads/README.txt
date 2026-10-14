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
