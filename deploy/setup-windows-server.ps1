# Builds MedLabel and installs it as a Windows service via NSSM.
# Run from an elevated PowerShell prompt on the hospital server (repo root):
#   powershell -ExecutionPolicy Bypass -File .\deploy\setup-windows-server.ps1
#
# Prerequisites: Node.js 22 LTS, Yarn, NSSM on PATH (or -NssmPath).
# Optional: -SkipPrepare to skip prepare-windows-server.ps1
#           -OpenFirewall / -FirewallRemoteAddress forwarded to prepare

param(
  [string]$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$ServiceName = 'MedLabel',
  [string]$NssmPath = 'nssm',
  [switch]$SkipPrepare,
  [switch]$OpenFirewall,
  [string]$FirewallRemoteAddress = 'Any'
)

$ErrorActionPreference = 'Stop'

function Assert-Command([string]$Name, [string]$Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name was not found on PATH. $Hint"
  }
}

Write-Host "MedLabel setup — AppRoot=$AppRoot"

Assert-Command 'node' 'Install Node.js 22 LTS from https://nodejs.org/'
Assert-Command 'yarn' 'Enable corepack (corepack enable) or install Yarn.'

$nodeVersion = (& node -v).Trim()
if ($nodeVersion -notmatch '^v22\.') {
  Write-Warning "Node $nodeVersion detected; docs recommend Node.js 22 LTS."
} else {
  Write-Host "Node $nodeVersion"
}

if (-not (Get-Command $NssmPath -ErrorAction SilentlyContinue)) {
  throw "NSSM not found ($NssmPath). Download from https://nssm.cc/download and put nssm.exe on PATH, or pass -NssmPath."
}

if (-not $SkipPrepare) {
  $prepareArgs = @{
    AppRoot = $AppRoot
  }
  if ($OpenFirewall) {
    $prepareArgs['OpenFirewall'] = $true
    $prepareArgs['FirewallRemoteAddress'] = $FirewallRemoteAddress
  }
  & (Join-Path $PSScriptRoot 'prepare-windows-server.ps1') @prepareArgs
  if ($LASTEXITCODE -ne 0) {
    throw 'prepare-windows-server.ps1 failed. Fix the reported issues or re-run with -SkipPrepare only if you accept the risk.'
  }
}

Push-Location $AppRoot
try {
  Write-Host 'yarn install...'
  & yarn install
  if ($LASTEXITCODE -ne 0) { throw "yarn install failed (exit $LASTEXITCODE)" }

  Write-Host 'yarn build...'
  & yarn build
  if ($LASTEXITCODE -ne 0) { throw "yarn build failed (exit $LASTEXITCODE)" }
} finally {
  Pop-Location
}

$serverJs = Join-Path $AppRoot 'dist\server.js'
if (-not (Test-Path $serverJs)) {
  throw "Build did not produce $serverJs"
}

& (Join-Path $PSScriptRoot 'install-windows-service.ps1') `
  -AppRoot $AppRoot `
  -ServiceName $ServiceName `
  -NssmPath $NssmPath

Write-Host ''
Write-Host 'Server install complete. Verify with:'
Write-Host "  powershell -ExecutionPolicy Bypass -File .\deploy\verify-health.ps1"
Write-Host 'Then publish extension artifacts:'
Write-Host '  powershell -ExecutionPolicy Bypass -File .\deploy\publish-extension-updates.ps1 -SourceDir <extension-release-folder>'
