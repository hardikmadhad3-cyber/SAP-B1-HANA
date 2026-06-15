param(
  [switch]$IncludeEnv
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = (Resolve-Path (Join-Path $ScriptDir '..')).Path
$DistDir = Join-Path $RootDir 'dist'
$PackageName = 'SAP-B1-Server-Package'
$PackageDir = Join-Path $DistDir $PackageName
$ZipPath = Join-Path $DistDir "$PackageName.zip"

function Invoke-Robocopy {
  param(
    [string]$Source,
    [string]$Destination,
    [string[]]$ExtraArgs = @()
  )

  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  & robocopy $Source $Destination /E /XD node_modules .git logs dist uploads /XF *.log @ExtraArgs /NFL /NDL /NJH /NJS /NP
  if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed from $Source to $Destination with exit code $LASTEXITCODE"
  }
}

if (Test-Path $PackageDir) {
  try {
    Remove-Item -Recurse -Force $PackageDir
  } catch {
    Write-Host "[warning] Package directory is in use. Reusing it after clearing its contents."
    Get-ChildItem -Force -Path $PackageDir | Remove-Item -Recurse -Force
  }
}
if (Test-Path $ZipPath) {
  Remove-Item -Force $ZipPath
}

New-Item -ItemType Directory -Force -Path $PackageDir | Out-Null

$frontendBuild = Join-Path $RootDir 'frontend\build\index.html'
if (-not (Test-Path $frontendBuild)) {
  Write-Host '[build] frontend/build not found. Building frontend first.'
  Push-Location (Join-Path $RootDir 'frontend')
  try {
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
      throw 'Frontend build failed'
    }
  } finally {
    Pop-Location
  }
}

$backendExtraArgs = @()
if (-not $IncludeEnv) {
  $backendExtraArgs += @('/XF', '.env', '*.log')
}

Invoke-Robocopy -Source (Join-Path $RootDir 'backend') -Destination (Join-Path $PackageDir 'backend') -ExtraArgs $backendExtraArgs
Invoke-Robocopy -Source (Join-Path $RootDir 'frontend') -Destination (Join-Path $PackageDir 'frontend') -ExtraArgs @('/XF', '*.log')
Invoke-Robocopy -Source (Join-Path $RootDir 'deployment') -Destination (Join-Path $PackageDir 'deployment')

$rootFiles = @(
  'package.json',
  'package-lock.json',
  'INSTALL_ONE_CLICK.bat',
  'START_BACKEND_SERVICE.bat',
  'STOP_BACKEND_SERVICE.bat',
  'BUILD_SERVER_PACKAGE.bat',
  'SAP_B1_SERVER_START_GUIDE.txt'
)

foreach ($file in $rootFiles) {
  $sourcePath = Join-Path $RootDir $file
  if (Test-Path $sourcePath) {
    Copy-Item -Path $sourcePath -Destination (Join-Path $PackageDir $file) -Force
  }
}

Compress-Archive -Path (Join-Path $PackageDir '*') -DestinationPath $ZipPath -Force

Write-Host ''
Write-Host "[done] Server package created:"
Write-Host "  $ZipPath"
if (-not $IncludeEnv) {
  Write-Host ''
  Write-Host '[note] backend\.env was not included. Copy it manually or rebuild with -IncludeEnv for a trusted internal package.'
}
