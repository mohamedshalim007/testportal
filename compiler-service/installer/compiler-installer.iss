; D:\testcomplier\full_project\compiler-service\installer\compiler-installer.iss
; Inno Setup Script for JMC Compiler Service

[Setup]
; General settings
AppId={{JMCCompilerService-2024}
AppName=JMC Compiler Service
AppVersion=1.0.0
AppPublisher=JMC Education
AppPublisherURL=https://exam.jmc.edu
AppSupportURL=https://exam.jmc.edu/support
AppUpdatesURL=https://exam.jmc.edu/updates
DefaultDirName={commonpf}\JMCCompiler
DefaultGroupName=JMC Compiler
AllowNoIcons=yes
UninstallDisplayIcon={app}\CompilerService.exe
UninstallDisplayName=JMC Compiler Service

; Installation settings
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
SetupIconFile=compiler.ico
Uninstallable=yes
CreateUninstallRegKey=yes

; Output settings
OutputDir=.
OutputBaseFilename=JMCCompilerSetup
Compression=lzma2
SolidCompression=yes

; Disable welcome page for silent install
DisableWelcomePage=no
DisableDirPage=no
DisableProgramGroupPage=yes

; Architecture
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Main executable
Source: "..\publish\CompilerService.exe"; DestDir: "{app}"; Flags: ignoreversion
; Dependencies
Source: "..\publish\*.dll"; DestDir: "{app}"; Flags: ignoreversion
; Documentation
Source: "README.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\JMC Compiler Service"; Filename: "{app}\CompilerService.exe"
Name: "{group}\Uninstall JMC Compiler"; Filename: "{uninstallexe}"
Name: "{commondesktop}\JMC Compiler"; Filename: "{app}\CompilerService.exe"

[Run]
; Install as Windows Service
Filename: "{app}\CompilerService.exe"; Parameters: "--install"; Flags: runhidden runascurrentuser; StatusMsg: "Installing compiler service..."

[Registry]
; Register custom protocol
Root: HKCR; Subkey: "jmccompiler"; ValueType: string; ValueData: "URL:JMC Compiler Protocol"; Flags: uninsdeletekey
Root: HKCR; Subkey: "jmccompiler"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCR; Subkey: "jmccompiler\shell\open\command"; ValueType: string; ValueData: """{app}\CompilerService.exe"" --start"

; Register for all users
Root: HKLM; Subkey: "SOFTWARE\JMCCompiler"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"
Root: HKLM; Subkey: "SOFTWARE\JMCCompiler"; ValueType: string; ValueName: "Version"; ValueData: "1.0.0"

[UninstallRun]
; Stop service before uninstall
Filename: "{app}\CompilerService.exe"; Parameters: "--stop"; Flags: runhidden; StatusMsg: "Stopping compiler service..."

[UninstallDelete]
; Remove files
Type: filesandordirs; Name: "{app}"

[Code]
function IsServiceInstalled(ServiceName: string): Boolean;
var
  ResultCode: Integer;
begin
  Result := False;
  if Exec('sc', 'query ' + ServiceName, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := ResultCode = 0;
  end;
end;

function IsServiceRunning(ServiceName: string): Boolean;
var
  ResultCode: Integer;
begin
  Result := False;
  if Exec('sc', 'query ' + ServiceName + ' | findstr RUNNING', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := ResultCode = 0;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Wait for service to start
    Sleep(3000);
    
    if IsServiceRunning('JMCCompiler') then
    begin
      MsgBox('✅ JMC Compiler Service installed and running successfully!', mbInformation, MB_OK);
    end
    else
    begin
      MsgBox('⚠️ Service installed but not running. Please start it manually.', mbInformation, MB_OK);
    end;
  end;
end;

function InitializeSetup(): Boolean;
begin
  // Check if already installed
  if IsServiceInstalled('JMCCompiler') then
  begin
    if MsgBox('JMC Compiler Service is already installed. Do you want to reinstall?', mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
      Exit;
    end;
  end;
  Result := True;
end;