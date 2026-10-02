# Force-installs the MedLabel extension on a ward workstation via Chrome policy.
# Run from an elevated PowerShell prompt on each workstation (or push the same
# registry values through GPO):
#
#   .\install-medlabel-policy.ps1 -ExtensionId <32 a-p chars> -ServerOrigin http://medlabel.local:8080
#
# Chrome only force-installs extensions from outside the Chrome Web Store when
# the machine is joined to Active Directory, joined to Azure AD / Entra ID, or
# enrolled in Chrome Browser Cloud Management (CBCM). On any other machine the
# policy is accepted but the extension is blocked. For machines without a
# domain, pass a CBCM enrollment token from admin.google.com.
#
#   .\install-medlabel-policy.ps1 -Remove -ExtensionId <id>   # roll back

param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId,

  [ValidatePattern('^https?://[^/\s]+$')]
  [string]$ServerOrigin = 'http://medlabel.local:8080',

  [string]$CloudManagementEnrollmentToken,

  [switch]$Remove
)

$ErrorActionPreference = 'Stop'

$chromePolicyKey = 'HKLM:\SOFTWARE\Policies\Google\Chrome'
$forcelistKey = Join-Path $chromePolicyKey 'ExtensionInstallForcelist'

function Remove-ExistingEntries {
  if (-not (Test-Path $forcelistKey)) {
    return
  }
  $item = Get-Item $forcelistKey
  foreach ($name in $item.Property) {
    $value = $item.GetValue($name)
    if ($value -eq $ExtensionId -or $value -like "$ExtensionId;*") {
      Remove-ItemProperty -Path $forcelistKey -Name $name
    }
  }
}

function Get-NextForcelistIndex {
  $used = (Get-Item $forcelistKey).Property |
    Where-Object { $_ -match '^\d+$' } |
    ForEach-Object { [int]$_ }
  $index = 1
  while ($used -contains $index) {
    $index++
  }
  return $index
}

function Test-ManagedForOffStoreInstall {
  if ((Get-CimInstance Win32_ComputerSystem).PartOfDomain) {
    return 'Active Directory domain'
  }
  $dsreg = (& dsregcmd /status) 2>$null | Out-String
  if ($dsreg -match 'AzureAdJoined\s*:\s*YES') {
    return 'Azure AD / Entra ID'
  }
  $token = (Get-ItemProperty -Path $chromePolicyKey -Name CloudManagementEnrollmentToken -ErrorAction SilentlyContinue).CloudManagementEnrollmentToken
  if ($token) {
    return 'Chrome Browser Cloud Management'
  }
  return $null
}

if ($Remove) {
  Remove-ExistingEntries
  Write-Host "Removed MedLabel ($ExtensionId) from ExtensionInstallForcelist. Chrome uninstalls it on next policy refresh."
  exit 0
}

New-Item -Path $forcelistKey -Force | Out-Null

if ($CloudManagementEnrollmentToken) {
  New-ItemProperty -Path $chromePolicyKey -Name CloudManagementEnrollmentToken `
    -Value $CloudManagementEnrollmentToken -PropertyType String -Force | Out-Null
  Write-Host 'Wrote CBCM enrollment token. Chrome enrolls on next launch.'
}

Remove-ExistingEntries
$index = Get-NextForcelistIndex
$updateUrl = "$ServerOrigin/updates.xml"
New-ItemProperty -Path $forcelistKey -Name "$index" `
  -Value "$ExtensionId;$updateUrl" -PropertyType String -Force | Out-Null
Write-Host "ExtensionInstallForcelist\$index = $ExtensionId;$updateUrl"

$managedBy = Test-ManagedForOffStoreInstall
if ($managedBy) {
  Write-Host "Machine is managed via $managedBy — off-store install allowed."
} else {
  Write-Warning (
    'This machine is not domain-joined, not Azure AD-joined and has no CBCM ' +
    'token. Chrome will BLOCK the MedLabel extension. Join the domain or rerun ' +
    'with -CloudManagementEnrollmentToken.'
  )
}

Write-Host 'Restart Chrome, then check chrome://policy and chrome://extensions.'
