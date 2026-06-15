param(
  [switch]$InstallAutoStart,
  [switch]$Restart
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = (Resolve-Path (Join-Path $ScriptDir '..')).Path
$BackendDir = Join-Path $RootDir 'backend'
$RunnerScript = Join-Path $ScriptDir 'run-backend-foreground.ps1'
$TaskName = 'SAP-B1 Backend Auto Start'
$StartupShortcutName = 'SAP-B1 Backend Auto Start.lnk'

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

function Get-PortProcessIds {
  param([int]$Port)

  try {
    return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {
    $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
    return @(netstat -ano -p tcp |
      ForEach-Object {
        if ($_ -match $pattern) {
          [int]$Matches[1]
        }
      } |
      Select-Object -Unique)
  }
}

function Get-LanIpAddresses {
  try {
    return @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object {
        $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and
        $_.IPAddress -match '^(\d{1,3}\.){3}\d{1,3}$'
      } |
      Select-Object -ExpandProperty IPAddress -Unique)
  } catch {
    return @(ipconfig |
      ForEach-Object {
        if ($_ -match 'IPv4 Address[.\s]*:\s*([0-9.]+)') {
          $Matches[1]
        }
      } |
      Where-Object { $_ -notmatch '^(127\.|169\.254\.)' } |
      Select-Object -Unique)
  }
}

function Register-BackendAutoStart {
  $actionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$RunnerScript`""

  try {
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $actionArgs
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet `
      -AllowStartIfOnBatteries `
      -DontStopIfGoingOnBatteries `
      -RestartCount 3 `
      -RestartInterval (New-TimeSpan -Minutes 1)

    Register-ScheduledTask `
      -TaskName $TaskName `
      -Action $action `
      -Trigger $trigger `
      -Settings $settings `
      -Description 'Starts the SAP B1 Node backend when this Windows user logs in.' `
      -Force | Out-Null

    Write-Host "[ok] Scheduled Task registered: $TaskName"
    return
  } catch {
    Write-Host "[warning] Scheduled Task registration failed: $($_.Exception.Message)"
    Write-Host '[setup] Falling back to Windows Startup folder shortcut.'
  }

  $startupDir = [Environment]::GetFolderPath('Startup')
  $shortcutPath = Join-Path $startupDir $StartupShortcutName
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = 'powershell.exe'
  $shortcut.Arguments = $actionArgs
  $shortcut.WorkingDirectory = $RootDir
  $shortcut.WindowStyle = 7
  $shortcut.Save()
  Write-Host "[ok] Startup shortcut created: $shortcutPath"
}

$Port = Get-AppPort
$LogDir = Join-Path $RootDir 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if ($InstallAutoStart) {
  Write-Host "[setup] Registering Windows auto-start task: $TaskName"
  Register-BackendAutoStart
}

$existingProcessIds = Get-PortProcessIds -Port $Port
if ($Restart -and $existingProcessIds.Count -gt 0) {
  Write-Host "[restart] Stopping existing backend process(es) on port $Port`: $($existingProcessIds -join ', ')"
  foreach ($processId in $existingProcessIds) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }

  for ($attempt = 1; $attempt -le 20; $attempt++) {
    Start-Sleep -Milliseconds 250
    if ((Get-PortProcessIds -Port $Port).Count -eq 0) {
      break
    }
  }

  $existingProcessIds = Get-PortProcessIds -Port $Port
}

if ($existingProcessIds.Count -gt 0) {
  Write-Host "[start] Port $Port is already listening. Backend may already be running. PID(s): $($existingProcessIds -join ', ')"
} else {
  Write-Host "[start] Starting backend on port $Port"
  $startArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$RunnerScript`""
  Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList $startArgs `
    -WorkingDirectory $RootDir `
    -WindowStyle Hidden | Out-Null
}

$healthUrl = "http://127.0.0.1:$Port/health"
$isHealthy = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    if ($health.status -eq 'ok') {
      $isHealthy = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if ($isHealthy) {
  Write-Host "[ok] Backend health check passed: $healthUrl"
} else {
  Write-Host "[warning] Backend did not answer health check yet. Check logs\backend-service.log"
}

Write-Host ''
Write-Host 'Open on this server:'
Write-Host "  http://localhost:$Port"
Write-Host "  $healthUrl"

$lanIps = Get-LanIpAddresses
if ($lanIps.Count -gt 0) {
  Write-Host ''
  Write-Host 'Open from another LAN computer:'
  foreach ($ip in $lanIps) {
    Write-Host "  http://$ip`:$Port"
  }
} else {
  Write-Host ''
  Write-Host '[warning] No LAN IPv4 address found. Run ipconfig to check the server IP.'
}

Write-Host ''
Write-Host 'Auto-start status:'
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Write-Host "  Registered. It will start automatically when this Windows user logs in."
} elseif (Test-Path (Join-Path ([Environment]::GetFolderPath('Startup')) $StartupShortcutName)) {
  Write-Host "  Registered with Startup folder shortcut. It will start automatically when this Windows user logs in."
} else {
  Write-Host "  Not registered. Run this script with -InstallAutoStart or use INSTALL_ONE_CLICK.bat."
}
