# D:\testcomplier\full_project\compiler-service\installer\install.ps1
# PowerShell installer for all users

param(
    [switch]$Silent,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$ServiceName = "JMCCompiler"
$InstallPath = "C:\Program Files\JMCCompiler"
$ExePath = "$InstallPath\CompilerService.exe"

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# Check if running as admin
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Uninstall function
function Uninstall-Service {
    Write-ColorOutput Yellow "🔄 Uninstalling $ServiceName..."
    
    # Stop service
    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        Write-ColorOutput Green "✅ Service stopped"
    }
    
    # Delete service
    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
        sc.exe delete $ServiceName
        Write-ColorOutput Green "✅ Service deleted"
    }
    
    # Remove from registry
    if (Test-Path "HKCR:\jmccompiler") {
        Remove-Item -Path "HKCR:\jmccompiler" -Recurse -Force
        Write-ColorOutput Green "✅ Protocol removed"
    }
    
    # Remove files
    if (Test-Path $InstallPath) {
        Remove-Item -Path $InstallPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-ColorOutput Green "✅ Files removed"
    }
    
    Write-ColorOutput Green "✅ Uninstall complete!"
}

# Install function
function Install-Service {
    Write-ColorOutput Cyan "🚀 Installing JMC Compiler Service..."
    
    # Check admin rights
    if (-not (Test-Administrator)) {
        if (-not $Silent) {
            Write-ColorOutput Red "❌ This installer requires administrator privileges."
            Write-ColorOutput Yellow "Please run PowerShell as Administrator."
        }
        return $false
    }
    
    # Create install directory
    if (-not (Test-Path $InstallPath)) {
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
        Write-ColorOutput Green "✅ Created install directory"
    }
    
    # Copy files
    $SourcePath = Split-Path -Parent $MyInvocation.MyCommand.Path
    $SourceExe = Join-Path $SourcePath "..\publish\CompilerService.exe"
    
    if (Test-Path $SourceExe) {
        Copy-Item -Path $SourceExe -Destination $InstallPath -Force
        Write-ColorOutput Green "✅ Copied executable"
    } else {
        Write-ColorOutput Red "❌ CompilerService.exe not found"
        return $false
    }
    
    # Copy additional files
    Get-ChildItem -Path (Join-Path $SourcePath "..\publish") -Filter "*.dll" | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $InstallPath -Force
    }
    
    # Install service
    Write-ColorOutput Cyan "📦 Installing Windows Service..."
    
    # Check if service exists and remove it
    $serviceExists = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($serviceExists) {
        Write-ColorOutput Yellow "⚠️ Service already exists. Removing..."
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        sc.exe delete $ServiceName
        Start-Sleep -Seconds 2
    }
    
    # Create service
    $serviceArgs = @(
        "create", $ServiceName,
        "binPath=", "`"$ExePath`"",
        "start=", "auto",
        "DisplayName=", "JMC Compiler Service",
        "description=", "Local compiler service for JMC Exam Portal"
    )
    
    & sc.exe $serviceArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "✅ Service created"
    } else {
        Write-ColorOutput Red "❌ Failed to create service"
        return $false
    }
    
    # Start service
    Write-ColorOutput Cyan "▶️ Starting service..."
    Start-Service -Name $ServiceName
    
    if (Get-Service -Name $ServiceName | Where-Object { $_.Status -eq 'Running' }) {
        Write-ColorOutput Green "✅ Service started"
    } else {
        Write-ColorOutput Yellow "⚠️ Service not running, starting manually..."
        Start-Service -Name $ServiceName
    }
    
    # Register protocol
    Write-ColorOutput Cyan "📝 Registering custom protocol..."
    try {
        $protocolKey = "HKCR:\jmccompiler"
        New-Item -Path $protocolKey -Force | Out-Null
        Set-ItemProperty -Path $protocolKey -Name "(Default)" -Value "URL:JMC Compiler Protocol"
        Set-ItemProperty -Path $protocolKey -Name "URL Protocol" -Value ""
        
        $commandKey = "$protocolKey\shell\open\command"
        New-Item -Path $commandKey -Force | Out-Null
        Set-ItemProperty -Path $commandKey -Name "(Default)" -Value "`"$ExePath`" --start"
        
        Write-ColorOutput Green "✅ Protocol registered"
    } catch {
        Write-ColorOutput Yellow "⚠️ Protocol registration failed: $($_.Exception.Message)"
    }
    
    # Test the service
    Write-ColorOutput Cyan "🔍 Testing service..."
    Start-Sleep -Seconds 2
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5001/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput Green "✅ Service is responding on http://localhost:5001"
        }
    } catch {
        Write-ColorOutput Yellow "⚠️ Service started but health check failed"
    }
    
    Write-ColorOutput Green ""
    Write-ColorOutput Green "🎉 Installation complete!"
    Write-ColorOutput Green "📍 Service Location: $InstallPath"
    Write-ColorOutput Green "🌐 Service URL: http://localhost:5001"
    Write-ColorOutput Green "🔗 Protocol: jmccompiler://"
    
    return $true
}

# Main script
if ($Uninstall) {
    if (Test-Administrator) {
        Uninstall-Service
    } else {
        Write-ColorOutput Red "❌ Uninstall requires administrator privileges."
    }
} else {
    Install-Service
}