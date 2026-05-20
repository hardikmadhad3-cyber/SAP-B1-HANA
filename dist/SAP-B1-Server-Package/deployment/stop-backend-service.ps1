param(
  [switch]$RemoveAutoStart
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = (Resolve-Path (Join-Path $ScriptDir '..')).Path
$BackendDir = Join-Path $RootDir 'backend'
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

$Port = Get-AppPort
try {
  $processIds = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
    Select-Object -ExpandProperty OwningProcess -Unique)
} catch {
  $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
  $processIds = @(netstat -ano -p tcp |
    ForEach-Object {
      if ($_ -match $pattern) {
        [int]$Matches[1]
      }
    } |
    Select-Object -Unique)
}

if ($processIds.Count -eq 0) {
  Write-Host "[stop] No process is listening on port $Port."
} else {
  foreach ($processId in $processIds) {
    Write-Host "[stop] Stopping PID $processId on port $Port"
    Stop-Process -Id $processId -Force
  }
}

if ($RemoveAutoStart) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[setup] Removed auto-start task: $TaskName"
  } else {
    Write-Host "[setup] Auto-start task was not registered."
  }

  $startupShortcut = Join-Path ([Environment]::GetFolderPath('Startup')) $StartupShortcutName
  if (Test-Path $startupShortcut) {
    Remove-Item -Force $startupShortcut
    Write-Host "[setup] Removed Startup folder shortcut: $startupShortcut"
  }
}
