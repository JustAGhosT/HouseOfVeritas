[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
  [Parameter()][string]$ResourceGroup = "nex-prod-hov-rg",
  [Parameter(Mandatory)][ValidatePattern('^nex-prod-hov-[a-z0-9-]+$')][string]$WebAppName,
  [Parameter(Mandatory)][string]$ExpectedDatabase,
  [Parameter(Mandatory)][string]$ExpectedRuntimeRole,
  [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$ExpectedCommit,
  [Parameter(Mandatory)][string]$Confirmation,
  [Parameter(Mandatory)][string]$OutputPath,
  [ValidateRange(60, 900)][int]$TimeoutSeconds = 300
)

. "$PSScriptRoot/Common.ps1"

$requiredConfirmation = "RESTART-PERSISTENCE-nex-prod-hov-rg/$WebAppName"
if ($Confirmation -cne $requiredConfirmation) {
  throw "Restart confirmation must exactly equal '$requiredConfirmation'."
}
$context = Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup -RequireResourceGroup
Assert-CommandAvailable -Name "psql"
Assert-PrivateEndpointReachability -HostName (Get-RequiredEnvironmentValue -Name "HOV_TARGET_PGHOST") -Port ([int]([Environment]::GetEnvironmentVariable("HOV_TARGET_PGPORT", "Process") ?? "5432"))

$defaultHostname = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
  "webapp", "show", "--name", $WebAppName, "--resource-group", $ResourceGroup,
  "--subscription", $context.subscriptionId, "--query", "defaultHostName",
  "--output", "tsv", "--only-show-errors"
)
$defaultHostname = ($defaultHostname -join "").Trim()
if ($defaultHostname -cne "$WebAppName.azurewebsites.net") {
  throw "Azure returned an unexpected target web-app hostname."
}
$healthUri = "https://$defaultHostname/api/health"

function Assert-ExactHealth([string]$Uri, [string]$Commit) {
  $health = Invoke-RestMethod -Uri $Uri -Method Get -TimeoutSec 20
  if ($health.status -cne "healthy" -or $health.build.commit -cne $Commit) {
    throw "Target health did not report the exact expected healthy build."
  }
  if ($health.backend -cne "postgres" -or $health.dataMode -cne "live") {
    throw "Target health did not report the intended PostgreSQL live-mode selection."
  }
}

$identity = Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
  Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--command", "SELECT current_database() || E'\t' || current_user;"
  )
}
$parts = (($identity -join "").Trim() -split "`t")
if ($parts.Count -ne 2 -or $parts[0] -cne $ExpectedDatabase -or $parts[1] -cne $ExpectedRuntimeRole) {
  throw "Persistence probe is not connected as the exact target runtime database identity."
}

Assert-ExactHealth -Uri $healthUri -Commit $ExpectedCommit
if (-not $PSCmdlet.ShouldProcess("$ResourceGroup/$WebAppName", "Write a synthetic database marker, restart target App Service, verify persistence, then remove the marker")) {
  return
}

$marker = [guid]::NewGuid().ToString()
$escapedMarker = $marker.Replace("'", "''")
$controlTable = "migration_persistence_probe_$([guid]::NewGuid().ToString('N'))"
$writeSql = @"
CREATE TABLE public.$controlTable (
  marker uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.$controlTable(marker) VALUES ('$escapedMarker'::uuid);
"@
$cleanupNeeded = $false
try {
  Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
    $null = Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
      "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--command", $writeSql
    )
  }
  $cleanupNeeded = $true

  $null = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "webapp", "restart", "--name", $WebAppName, "--resource-group", $ResourceGroup,
    "--subscription", $context.subscriptionId, "--only-show-errors"
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $healthy = $false
  do {
    Start-Sleep -Seconds 10
    try {
      Assert-ExactHealth -Uri $healthUri -Commit $ExpectedCommit
      $healthy = $true
    } catch {
      if ((Get-Date) -ge $deadline) { throw }
    }
  } while (-not $healthy)

  $count = Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
    Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
      "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
      "--command", "SELECT count(*) FROM public.$controlTable WHERE marker = '$escapedMarker'::uuid;"
    )
  }
  if ((($count -join "").Trim()) -cne "1") {
    throw "Synthetic SQL marker did not survive the target runtime restart."
  }

} finally {
  if ($cleanupNeeded) {
    Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
      $null = Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
        "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1",
        "--command", "DROP TABLE public.$controlTable;"
      )
    }
  }
}
Write-SafeJson -InputObject ([ordered]@{
    schemaVersion          = 1
    capturedAtUtc          = (Get-Date).ToUniversalTime().ToString("o")
    resourceGroup          = $ResourceGroup
    webAppName             = $WebAppName
    defaultHostname        = $defaultHostname
    expectedCommit         = $ExpectedCommit
    postgresBackend        = "verified"
    markerSurvivedRestart  = $true
    syntheticTableRemoved  = $true
  }) -Path $OutputPath
Write-Host "Exact-build target restart persistence control passed and the synthetic row was removed."
