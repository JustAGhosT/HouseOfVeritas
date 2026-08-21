[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter()][string]$ResourceGroup = "nl-prod-hov-rg",
  [Parameter(Mandatory)][string]$ExpectedDatabase,
  [Parameter(Mandatory)][string]$ExpectedRole,
  [Parameter(Mandatory)][string]$OutputDirectory,
  [Parameter()][ValidateSet("Rehearsal", "Final")][string]$SnapshotKind = "Rehearsal",
  [switch]$CrossBoundaryMigrationRunner
)

. "$PSScriptRoot/Common.ps1"

if ($CrossBoundaryMigrationRunner) {
  if ($ResourceGroup -cne "nex-prod-hov-rg") { throw "Cross-boundary backup requires ResourceGroup nex-prod-hov-rg." }
  $null = Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup -RequireResourceGroup
  if ((Get-RequiredEnvironmentValue -Name "HOV_SOURCE_PGHOST") -cne "nl-prod-shared-pg.postgres.database.azure.com") {
    throw "Cross-boundary backup host does not match the exact approved source PostgreSQL server."
  }
} else {
  $null = Assert-AzureBoundary -Boundary Source -ResourceGroup $ResourceGroup -RequireResourceGroup
}
Assert-CommandAvailable -Name "psql"
Assert-CommandAvailable -Name "pg_dump"
$output = New-SafeDirectory -Path $OutputDirectory
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$dumpPath = Join-Path $output "hov-postgres-$($SnapshotKind.ToLowerInvariant())-$stamp.dump"
$metadataPath = Join-Path $output "hov-postgres-$($SnapshotKind.ToLowerInvariant())-$stamp.json"

$identity = Invoke-WithPostgresEnvironment -Prefix HOV_SOURCE -ScriptBlock {
  Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--command", "SELECT current_database() || E'\t' || current_user || E'\t' || pg_is_in_recovery();"
  )
}
$parts = (($identity -join "").Trim() -split "`t")
if ($parts.Count -ne 3 -or $parts[0] -cne $ExpectedDatabase -or $parts[1] -cne $ExpectedRole) {
  throw "Source PostgreSQL connection does not match the exact expected database and role."
}
if ($parts[2] -cne "f") {
  throw "Refusing backup from a recovering PostgreSQL server."
}

if (-not $PSCmdlet.ShouldProcess($ExpectedDatabase, "Create a source-consistent custom-format pg_dump at '$dumpPath'")) {
  return
}
Invoke-WithPostgresEnvironment -Prefix HOV_SOURCE -ScriptBlock {
  $null = Invoke-NativeCommand -FilePath "pg_dump" -ArgumentList @(
    "--format=custom", "--compress=9", "--no-owner", "--no-acl",
    "--serializable-deferrable", "--file=$dumpPath"
  )
}
if (-not (Test-Path -LiteralPath $dumpPath) -or (Get-Item -LiteralPath $dumpPath).Length -eq 0) {
  throw "pg_dump did not create a non-empty backup."
}

$metadata = [ordered]@{
  schemaVersion = 1
  capturedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  snapshotKind  = $SnapshotKind
  database      = $ExpectedDatabase
  sourceRole    = $ExpectedRole
  fileName      = Split-Path -Leaf $dumpPath
  length        = (Get-Item -LiteralPath $dumpPath).Length
  sha256        = Get-Sha256 -Path $dumpPath
  containsData  = $true
  handling      = "POPIA-sensitive encrypted-at-rest migration artifact; never attach to PRs or general evidence logs"
}
Write-SafeJson -InputObject $metadata -Path $metadataPath
Write-Host "PostgreSQL backup created. Only its path, size, and digest were reported."
