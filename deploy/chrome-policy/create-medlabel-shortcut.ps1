# Creates a "MedLabel" desktop shortcut that starts Chrome with silent printing.
# Run from an elevated PowerShell prompt on each ward workstation.
#
# --kiosk-printing skips the print dialog for EVERY page printed in that Chrome
# profile. The shortcut therefore uses a dedicated profile directory, so HIS
# and other sites printed from the nurse's normal Chrome still show the dialog
# and never land on the label roll by accident.
#
# Kiosk printing sends jobs to the profile's last-used printer. Run once with
# -SetupPrinter, print one label choosing the label printer (margins: None),
# close Chrome, then use the normal MedLabel shortcut.

param(
  [string]$ProfileDir = 'C:\MedLabelChrome',
  [string]$ChromePath,
  [switch]$SetupPrinter
)

$ErrorActionPreference = 'Stop'

function Find-Chrome {
  $candidates = @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  )
  foreach ($path in $candidates) {
    if ($path -and (Test-Path $path)) {
      return $path
    }
  }
  throw 'chrome.exe not found. Pass -ChromePath.'
}

if (-not $ChromePath) {
  $ChromePath = Find-Chrome
}

New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
# Built-in Users group (SID S-1-5-32-545), so any nurse account can use the profile.
& icacls $ProfileDir /grant '*S-1-5-32-545:(OI)(CI)M' | Out-Null

$profileArg = "--user-data-dir=`"$ProfileDir`" --no-first-run"

if ($SetupPrinter) {
  Write-Host 'Opening the MedLabel profile WITH the print dialog.'
  Write-Host 'Print one label, choose the label printer, set Margins = None, then close Chrome.'
  Start-Process -FilePath $ChromePath -ArgumentList $profileArg
  exit 0
}

$shell = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'MedLabel.lnk'
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $ChromePath
$shortcut.Arguments = "$profileArg --kiosk-printing"
$shortcut.IconLocation = "$ChromePath,0"
$shortcut.Description = 'MedLabel — in tem thuốc tiêm (in không hỏi)'
$shortcut.Save()

Write-Host "Created $shortcutPath"
Write-Host 'Close every MedLabel Chrome window before using it: Chrome ignores flags when the profile is already running.'
