# Installs MedLabel as a Windows service via NSSM.
# Run from an elevated PowerShell prompt on the hospital server:
#   powershell -ExecutionPolicy Bypass -File .\deploy\install-windows-service.ps1 -AppRoot C:\MedLabel
#
# NSSM: https://nssm.cc/download  (place nssm.exe on PATH, or pass -NssmPath)
# Requires Node.js and a production build: yarn && yarn build

param(
  [string]$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$ServiceName = 'MedLabel',
  [string]$NssmPath = 'nssm'
)

$ErrorActionPreference = 'Stop'

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  throw 'node.exe was not found on PATH. Install Node.js LTS first.'
}

$serverJs = Join-Path $AppRoot 'dist\server.js'
if (-not (Test-Path $serverJs)) {
  throw "Missing $serverJs. From $AppRoot run: yarn && yarn build"
}

$envFile = Join-Path $AppRoot '.env'
if (-not (Test-Path $envFile)) {
  throw "Missing $envFile. Copy .env.example and fill in the rotated DB password."
}

& $NssmPath stop $ServiceName 2>$null | Out-Null
& $NssmPath remove $ServiceName confirm 2>$null | Out-Null

& $NssmPath install $ServiceName $node $serverJs
if ($LASTEXITCODE -ne 0) {
  throw "nssm install failed (exit $LASTEXITCODE). Install NSSM and pass -NssmPath if it is not on PATH."
}

# AppDirectory is the working directory, so dotenv loads AppRoot\.env
# and UPDATE_DIR=updates resolves next to the repo.
& $NssmPath set $ServiceName AppDirectory $AppRoot
& $NssmPath set $ServiceName DisplayName 'MedLabel API'
& $NssmPath set $ServiceName Description 'HIS lookup API and Chrome extension update host'
& $NssmPath set $ServiceName Start SERVICE_AUTO_START
& $NssmPath set $ServiceName AppStdout (Join-Path $AppRoot 'logs\service-out.log')
& $NssmPath set $ServiceName AppStderr (Join-Path $AppRoot 'logs\service-err.log')
& $NssmPath set $ServiceName AppRotateFiles 1
& $NssmPath set $ServiceName AppRotateBytes 10485760
& $NssmPath set $ServiceName AppExit Default Restart
& $NssmPath set $ServiceName AppRestartDelay 5000

New-Item -ItemType Directory -Force -Path (Join-Path $AppRoot 'logs') | Out-Null

& $NssmPath start $ServiceName
Write-Host "Service $ServiceName started. Check: GET http://127.0.0.1:8080/health"
