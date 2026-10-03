# Copies extension release artifacts into UPDATE_DIR in the safe order:
#   1) .crx first, then 2) updates.xml
# so Chrome never sees a version it cannot download.
#
#   powershell -ExecutionPolicy Bypass -File .\deploy\publish-extension-updates.ps1 `
#     -SourceDir C:\path\to\MedLabelExtension\release
#
# No service restart needed.

param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDir,

  [string]$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$UpdateDir
)

$ErrorActionPreference = 'Stop'

if (-not $UpdateDir) {
  $UpdateDir = Join-Path $AppRoot 'updates'
}

if (-not (Test-Path -LiteralPath $SourceDir)) {
  throw "SourceDir not found: $SourceDir"
}

New-Item -ItemType Directory -Force -Path $UpdateDir | Out-Null

$crxFiles = @(Get-ChildItem -LiteralPath $SourceDir -Filter 'medlabel-*.crx' -File | Sort-Object Name)
$xmlPath = Join-Path $SourceDir 'updates.xml'

if ($crxFiles.Count -eq 0) {
  throw "No medlabel-*.crx in $SourceDir"
}
if (-not (Test-Path -LiteralPath $xmlPath)) {
  throw "Missing updates.xml in $SourceDir"
}

foreach ($crx in $crxFiles) {
  $dest = Join-Path $UpdateDir $crx.Name
  Copy-Item -LiteralPath $crx.FullName -Destination $dest -Force
  Write-Host "Copied $($crx.Name) -> $dest"
}

$destXml = Join-Path $UpdateDir 'updates.xml'
Copy-Item -LiteralPath $xmlPath -Destination $destXml -Force
Write-Host "Copied updates.xml -> $destXml"

Write-Host ''
Write-Host 'Publish complete. Verify from a workstation:'
Write-Host '  powershell -ExecutionPolicy Bypass -File .\deploy\verify-health.ps1 -BaseUrl http://medlabel.local:8080 -CheckUpdates'
