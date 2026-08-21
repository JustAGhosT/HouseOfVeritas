[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet("Source", "Target")][string]$Boundary,
  [Parameter(Mandatory)][string]$ResourceGroup,
  [Parameter(Mandatory)][string]$ExpectedDatabase,
  [Parameter(Mandatory)][string]$ExpectedRole,
  [Parameter(Mandatory)][string]$OutputPath,
  [switch]$SkipContentChecksums,
  [switch]$CrossBoundaryMigrationRunner
)

. "$PSScriptRoot/Common.ps1"

if ($Boundary -eq "Source" -and $CrossBoundaryMigrationRunner) {
  if ($ResourceGroup -cne "nex-prod-hov-rg") { throw "Cross-boundary measurement requires ResourceGroup nex-prod-hov-rg." }
  $null = Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup -RequireResourceGroup
  if ((Get-RequiredEnvironmentValue -Name "HOV_SOURCE_PGHOST") -cne "nl-prod-shared-pg.postgres.database.azure.com") {
    throw "Cross-boundary measurement host does not match the exact approved source PostgreSQL server."
  }
} else {
  $null = Assert-AzureBoundary -Boundary $Boundary -ResourceGroup $ResourceGroup -RequireResourceGroup
}
Assert-CommandAvailable -Name "psql"
$prefix = if ($Boundary -eq "Source") { "HOV_SOURCE" } else { "HOV_TARGET" }
if ($Boundary -eq "Target") {
  Assert-PrivateEndpointReachability -HostName (Get-RequiredEnvironmentValue -Name "HOV_TARGET_PGHOST") -Port ([int]([Environment]::GetEnvironmentVariable("HOV_TARGET_PGPORT", "Process") ?? "5432"))
}

function Quote-PgIdentifier([string]$Value) {
  return '"' + $Value.Replace('"', '""') + '"'
}

$identitySql = @'
SELECT current_database() || E'\t' || current_user || E'\t' || current_setting('server_version') || E'\t' || current_setting('TimeZone') || E'\t' || (DATE '2026-07-18')::text;
'@
$identityLine = Invoke-WithPostgresEnvironment -Prefix $prefix -ScriptBlock {
  Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--command", $identitySql
  )
}
$identity = (($identityLine -join "").Trim() -split "`t")
if ($identity.Count -ne 5 -or $identity[0] -cne $ExpectedDatabase -or $identity[1] -cne $ExpectedRole) {
  throw "PostgreSQL connection did not resolve to the exact expected database and role."
}
if ($identity[4] -cne "2026-07-18") {
  throw "PostgreSQL DATE fidelity control failed."
}

$extensions = Invoke-WithPostgresEnvironment -Prefix $prefix -ScriptBlock {
  Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--command", "SELECT extname || E'\t' || extversion FROM pg_extension ORDER BY extname;"
  )
}
$owners = Invoke-WithPostgresEnvironment -Prefix $prefix -ScriptBlock {
  Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--command", "SELECT 'table' || E'\t' || schemaname || E'\t' || tablename || E'\t' || tableowner FROM pg_tables WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema' UNION ALL SELECT 'sequence' || E'\t' || sequence_schema || E'\t' || sequence_name || E'\t' || pg_get_userbyid(c.relowner) FROM information_schema.sequences s JOIN pg_class c ON c.relname = s.sequence_name JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = s.sequence_schema ORDER BY 1, 2, 3;"
  )
}
$indexes = Invoke-WithPostgresEnvironment -Prefix $prefix -ScriptBlock {
  Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--command", "SELECT schemaname || E'\t' || tablename || E'\t' || indexname || E'\t' || md5(indexdef) FROM pg_indexes WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema' ORDER BY schemaname, tablename, indexname;"
  )
}
$tableNames = Invoke-WithPostgresEnvironment -Prefix $prefix -ScriptBlock {
  Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--command", "SELECT schemaname || E'\t' || tablename FROM pg_tables WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema' ORDER BY schemaname, tablename;"
  )
}

$tableMeasurements = @()
foreach ($line in @($tableNames | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
  $parts = $line.Trim() -split "`t", 2
  $schema = $parts[0]
  $table = $parts[1]
  $qualified = "$(Quote-PgIdentifier $schema).$(Quote-PgIdentifier $table)"
  $hashExpression = if ($SkipContentChecksums) {
    "SELECT COUNT(*)::text FROM $qualified;"
  } else {
    "SELECT COUNT(*)::text || E'\t' || COALESCE(md5(string_agg(row_hash, '' ORDER BY row_hash)), md5('')) FROM (SELECT md5(row_to_json(t)::text) AS row_hash FROM $qualified AS t) AS measured;"
  }
  $measurementLine = Invoke-WithPostgresEnvironment -Prefix $prefix -ScriptBlock {
    Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
      "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
      "--command", $hashExpression
    )
  }
  $measurement = (($measurementLine -join "").Trim() -split "`t", 2)
  $tableMeasurements += [pscustomobject]@{
    schema        = $schema
    table         = $table
    rowCount      = [long]$measurement[0]
    contentDigest = if ($SkipContentChecksums) { $null } else { $measurement[1] }
  }
}

$ownerRecords = foreach ($line in @($owners | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
  $parts = $line.Trim() -split "`t", 4
  [pscustomobject]@{ type = $parts[0]; schema = $parts[1]; name = $parts[2]; owner = $parts[3] }
}
$extensionRecords = foreach ($line in @($extensions | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
  $parts = $line.Trim() -split "`t", 2
  [pscustomobject]@{ name = $parts[0]; version = $parts[1] }
}
$indexRecords = foreach ($line in @($indexes | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
  $parts = $line.Trim() -split "`t", 4
  [pscustomobject]@{ schema = $parts[0]; table = $parts[1]; name = $parts[2]; definitionDigest = $parts[3] }
}

$measurement = [ordered]@{
  schemaVersion        = 1
  capturedAtUtc        = (Get-Date).ToUniversalTime().ToString("o")
  boundary             = $Boundary
  database             = $identity[0]
  role                 = $identity[1]
  serverVersion        = $identity[2]
  serverTimeZone       = $identity[3]
  dateFidelityControl  = $identity[4]
  extensions           = @($extensionRecords)
  objectOwners         = @($ownerRecords)
  indexes              = @($indexRecords)
  tables               = @($tableMeasurements)
  contentChecksumsUsed = -not $SkipContentChecksums
}
Write-SafeJson -InputObject $measurement -Path $OutputPath
Write-Host "PostgreSQL metadata and non-reversible table digests written to $OutputPath"
