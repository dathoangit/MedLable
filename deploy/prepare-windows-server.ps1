# Pre-flight checks for a MedLabel Windows server (NSSM path, not Docker).
# Run from an elevated PowerShell prompt on the hospital server:
#   powershell -ExecutionPolicy Bypass -File .\deploy\prepare-windows-server.ps1
#
# Optional:
#   -OpenFirewall          add inbound TCP rule for PORT (default from .env / 8080)
#   -FirewallRemoteAddress restrict to a subnet, e.g. 10.0.0.0/8
#   -SkipDbCheck           skip TCP probe to PGHOST:PGPORT

param(
  [string]$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [switch]$OpenFirewall,
  [string]$FirewallRemoteAddress = 'Any',
  [switch]$SkipDbCheck
)

$ErrorActionPreference = 'Stop'
$failed = 0

function Write-Ok([string]$Message) { Write-Host "[OK]  $Message" -ForegroundColor Green }
function Write-Bad([string]$Message) { Write-Host "[FAIL] $Message" -ForegroundColor Red; $script:failed++ }
function Write-WarnLine([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }

function Read-DotEnv([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) {
    return $map
  }
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $map[$key] = $value
  }
  return $map
}

Write-Host "MedLabel prepare — AppRoot=$AppRoot"
Write-Host ''
Write-Host 'Manual (DBA / IT) before production:'
Write-Host '  1. Run deploy\rotate-db-password.sql as a Postgres superuser on HIS.'
Write-Host '  2. Put the new password only in the server .env (never commit it).'
Write-Host '  3. Ask IT for DNS: medlabel.local -> this server IP.'
Write-Host ''

$envFile = Join-Path $AppRoot '.env'
$envExample = Join-Path $AppRoot '.env.example'
if (-not (Test-Path $envFile)) {
  if (Test-Path $envExample) {
    Copy-Item -LiteralPath $envExample -Destination $envFile
    Write-WarnLine "Created .env from .env.example — edit PGPASSWORD (and PG* if needed) before going live."
  } else {
    Write-Bad "Missing .env and .env.example under $AppRoot"
  }
} else {
  Write-Ok '.env present'
}

$envMap = Read-DotEnv $envFile
$pgHost = if ($envMap['PGHOST']) { $envMap['PGHOST'] } else { '' }
$pgPort = if ($envMap['PGPORT']) { [int]$envMap['PGPORT'] } else { 5432 }
$pgPassword = if ($envMap['PGPASSWORD']) { $envMap['PGPASSWORD'] } else { '' }
$listenPort = if ($envMap['PORT']) { [int]$envMap['PORT'] } else { 8080 }

if (-not $pgPassword -or $pgPassword -eq 'change-me') {
  Write-Bad 'PGPASSWORD is empty or still "change-me". Rotate HIS password and put the new value in .env.'
} else {
  Write-Ok 'PGPASSWORD is set (value not printed)'
}

if (-not $pgHost) {
  Write-Bad 'PGHOST missing in .env'
} elseif (-not $SkipDbCheck) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect($pgHost, $pgPort, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(5000, $false)
    if (-not $ok) {
      $client.Close()
      Write-Bad "Cannot reach Postgres at ${pgHost}:${pgPort} within 5s (network / firewall)."
    } else {
      $client.EndConnect($iar) | Out-Null
      $client.Close()
      Write-Ok "TCP connect to Postgres ${pgHost}:${pgPort} succeeded"
    }
  } catch {
    Write-Bad "Postgres probe ${pgHost}:${pgPort} failed: $($_.Exception.Message)"
  }
} else {
  Write-WarnLine 'Skipped Postgres TCP check (-SkipDbCheck)'
}

try {
  $dns = [System.Net.Dns]::GetHostAddresses('medlabel.local')
  $addrs = ($dns | ForEach-Object { $_.IPAddressToString }) -join ', '
  Write-Ok "DNS medlabel.local resolves to: $addrs"
} catch {
  Write-WarnLine 'DNS medlabel.local does not resolve from this host. Ask IT for the A/CNAME record (extension + policy depend on the name).'
}

$ruleName = 'MedLabel API'
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($OpenFirewall) {
  if ($existing) {
    Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  }
  New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $listenPort `
    -RemoteAddress $FirewallRemoteAddress `
    -Profile Any | Out-Null
  Write-Ok "Firewall inbound TCP $listenPort allowed from $FirewallRemoteAddress (rule: $ruleName)"
} elseif ($existing) {
  Write-Ok "Firewall rule already present: $ruleName"
} else {
  Write-WarnLine "No firewall rule '$ruleName'. Re-run with -OpenFirewall (prefer -FirewallRemoteAddress <ward-subnet>)."
}

Write-Host ''
if ($failed -gt 0) {
  Write-Host "[FAIL] $failed check(s) failed. Fix them before setup-windows-server.ps1." -ForegroundColor Red
  exit 1
}
Write-Ok 'Prepare checks passed. Next: setup-windows-server.ps1'
exit 0
