# One-shot ward workstation setup: Chrome force-install policy + MedLabel shortcut.
# Run from an elevated PowerShell prompt on each managed workstation:
#
#   powershell -ExecutionPolicy Bypass -File .\deploy\chrome-policy\setup-ward-workstation.ps1
#
# Hard requirement: machine must be domain-joined, Entra ID joined, or CBCM-enrolled
# (see install-medlabel-policy.ps1). Printing setup is two-step:
#   1) -SetupPrinter only (pick label printer once)
#   2) full run without -SetupPrinter (creates kiosk shortcut)
#
#   .\setup-ward-workstation.ps1 -SetupPrinter
#   .\setup-ward-workstation.ps1

param(
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId = 'kmcaolgjiahblobhmnniihieggicjlkp',

  [ValidatePattern('^https?://[^/\s]+$')]
  [string]$ServerOrigin = 'http://medlabel.local:8080',

  [string]$CloudManagementEnrollmentToken,
  [string]$ChromePath,
  [string]$ProfileDir = 'C:\MedLabelChrome',
  [switch]$SetupPrinter,
  [switch]$SkipPolicy,
  [switch]$SkipShortcut,
  [switch]$SkipHealthCheck
)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot

if ($SetupPrinter) {
  $shortcutArgs = @{ SetupPrinter = $true; ProfileDir = $ProfileDir }
  if ($ChromePath) { $shortcutArgs['ChromePath'] = $ChromePath }
  & (Join-Path $here 'create-medlabel-shortcut.ps1') @shortcutArgs
  Write-Host ''
  Write-Host 'After choosing the label printer (Margins = None) and closing Chrome, re-run without -SetupPrinter.'
  exit 0
}

if (-not $SkipPolicy) {
  $policyArgs = @{
    ExtensionId  = $ExtensionId
    ServerOrigin = $ServerOrigin
  }
  if ($CloudManagementEnrollmentToken) {
    $policyArgs['CloudManagementEnrollmentToken'] = $CloudManagementEnrollmentToken
  }
  & (Join-Path $here 'install-medlabel-policy.ps1') @policyArgs
}

if (-not $SkipShortcut) {
  $shortcutArgs = @{ ProfileDir = $ProfileDir }
  if ($ChromePath) { $shortcutArgs['ChromePath'] = $ChromePath }
  & (Join-Path $here 'create-medlabel-shortcut.ps1') @shortcutArgs
}

if (-not $SkipHealthCheck) {
  $verify = Join-Path $here '..\verify-health.ps1'
  & $verify -BaseUrl $ServerOrigin -CheckUpdates
  if ($LASTEXITCODE -ne 0) {
    throw 'Server health/update check failed from this workstation. Fix network/DNS before asking nurses to use MedLabel.'
  }
}

Write-Host ''
Write-Host 'Acceptance checklist (one test machine):'
Write-Host '  [ ] chrome://policy shows ExtensionInstallForcelist with no error'
Write-Host "  [ ] chrome://extensions shows MedLabel, Installed by your administrator, ID $ExtensionId"
Write-Host '  [ ] MedLabel options -> Kiểm tra kết nối reports OK'
Write-Host '  [ ] Look up a known mã hồ sơ; labels print with no dialog'
Write-Host "  [ ] Nurse's normal Chrome still shows the print dialog for HIS pages"
Write-Host '  [ ] After a new publish-extension-updates.ps1, Update in chrome://extensions bumps the version'
Write-Host '  [ ] Without clicking Update, the next release arrives within ~5 hours'
Write-Host ''
Write-Host 'If the label printer was never chosen in this profile, run once with -SetupPrinter first.'
