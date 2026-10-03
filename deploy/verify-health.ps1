# Checks MedLabel /health (and optionally update assets).
# Run from the server or a ward workstation:
#   powershell -ExecutionPolicy Bypass -File .\deploy\verify-health.ps1
#   powershell -ExecutionPolicy Bypass -File .\deploy\verify-health.ps1 -BaseUrl http://medlabel.local:8080 -CheckUpdates

param(
  [string]$BaseUrl = 'http://127.0.0.1:8080',
  [switch]$CheckUpdates,
  [int]$TimeoutSec = 10
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')

function Invoke-Get([string]$Url) {
  return Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
}

Write-Host "GET $BaseUrl/health"
try {
  $response = Invoke-Get "$BaseUrl/health"
} catch {
  Write-Error "Health request failed: $($_.Exception.Message)"
  exit 1
}

$body = $response.Content
Write-Host $body

if ($response.StatusCode -ne 200) {
  Write-Error "Expected HTTP 200, got $($response.StatusCode). If body has db not up, check .env PG* and network to HIS."
  exit 1
}

try {
  $json = $body | ConvertFrom-Json
} catch {
  Write-Error 'Health response is not JSON.'
  exit 1
}

if (-not $json.ok -or $json.db -ne 'up' -or $json.service -ne 'medlabel') {
  Write-Error 'Health JSON missing ok/db=up/service=medlabel.'
  exit 1
}

Write-Host "[OK] API healthy (apiVersion=$($json.apiVersion))" -ForegroundColor Green

if ($CheckUpdates) {
  Write-Host "GET $BaseUrl/updates.xml"
  $xmlResponse = Invoke-Get "$BaseUrl/updates.xml"
  if ($xmlResponse.StatusCode -ne 200) {
    Write-Error "updates.xml returned HTTP $($xmlResponse.StatusCode)"
    exit 1
  }
  if ($xmlResponse.Content -notmatch 'appid=') {
    Write-Error 'updates.xml does not look like a Chrome update manifest.'
    exit 1
  }
  Write-Host '[OK] updates.xml reachable' -ForegroundColor Green

  if ($xmlResponse.Content -match 'codebase="([^"]+\.crx)"') {
    $crxUrl = $Matches[1]
    if ($crxUrl -notmatch '^https?://') {
      $crxUrl = "$BaseUrl/$($crxUrl.TrimStart('/'))"
    }
    Write-Host "GET $crxUrl"
    $crx = Invoke-Get $crxUrl
    $ct = $crx.Headers['Content-Type']
    if ($crx.StatusCode -ne 200) {
      Write-Error ".crx returned HTTP $($crx.StatusCode)"
      exit 1
    }
    Write-Host "[OK] .crx reachable (Content-Type: $ct)" -ForegroundColor Green
  } else {
    Write-Warning 'Could not parse codebase .crx URL from updates.xml'
  }
}

exit 0
