$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = (Resolve-Path (Join-Path $ScriptDir '..')).Path
$BackendDir = Join-Path $RootDir 'backend'
$LogDir = Join-Path $RootDir 'logs'
$LogPath = Join-Path $LogDir 'backend-service.log'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location $BackendDir

"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting SAP B1 backend from $BackendDir" |
  Out-File -FilePath $LogPath -Append -Encoding utf8

& node server.js *>> $LogPath
$ExitCode = $LASTEXITCODE

"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Backend stopped with exit code $ExitCode" |
  Out-File -FilePath $LogPath -Append -Encoding utf8

exit $ExitCode
