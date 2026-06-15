param(
  [switch]$SkipStart
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = (Resolve-Path (Join-Path $ScriptDir '..')).Path
$BackendDir = Join-Path $RootDir 'backend'
$FrontendDir = Join-Path $RootDir 'frontend'
$StartScript = Join-Path $ScriptDir 'start-backend-service.ps1'

function Write-Step {
  param([string]$Message)
  Write-Host ''
  Write-Host "== $Message =="
}

function Invoke-NpmInstall {
  param([string]$ProjectDir)

  Push-Location $ProjectDir
  try {
    if (Test-Path 'package-lock.json') {
      npm.cmd ci
    } else {
      npm.cmd install
    }

    if ($LASTEXITCODE -ne 0) {
      throw "npm install failed in $ProjectDir"
    }
  } finally {
    Pop-Location
  }
}

function Get-AppPort {
  $envPath = Join-Path $BackendDir '.env'
  if (Test-Path $envPath) {
    $portLine = Get-Content $envPath | Where-Object { $_ -match '^\s*PORT\s*=\s*(\d+)\s*$' } | Select-Object -First 1
    if ($portLine -match '^\s*PORT\s*=\s*(\d+)\s*$') {
      return [int]$Matches[1]
    }
  }

  return 5001
}

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-FirewallRule {
  param([int]$Port)

  if (-not (Test-IsAdministrator)) {
    Write-Host "[warning] Not running as Administrator. If LAN cannot open the app, add inbound firewall rule for TCP port $Port."
    return
  }

  try {
    $ruleName = "SAP B1 Web $Port"
    $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $existingRule) {
      New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $Port | Out-Null
      Write-Host "[ok] Added Windows Firewall inbound rule for TCP port $Port."
    } else {
      Write-Host "[ok] Windows Firewall rule already exists for TCP port $Port."
    }
  } catch {
    Write-Host "[warning] Could not add firewall rule automatically: $($_.Exception.Message)"
  }
}

Write-Step 'Checking Node.js and npm'
node --version
npm.cmd --version

Write-Step 'Installing root dependencies'
Invoke-NpmInstall -ProjectDir $RootDir

Write-Step 'Installing backend dependencies'
Invoke-NpmInstall -ProjectDir $BackendDir

Write-Step 'Installing frontend dependencies'
Invoke-NpmInstall -ProjectDir $FrontendDir

Write-Step 'Building frontend production files'
Push-Location $FrontendDir
try {
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw 'Frontend build failed'
  }
} finally {
  Pop-Location
}

$Port = Get-AppPort
Write-Step 'Preparing LAN access'
Ensure-FirewallRule -Port $Port

if (-not $SkipStart) {
  Write-Step 'Starting backend and registering auto-start'
  & $StartScript -InstallAutoStart -Restart
}

Write-Host ''
Write-Host '[done] Install completed.'
