[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
  [Parameter()][string]$ResourceGroup = "nex-prod-hov-rg",
  [Parameter(Mandatory)][string]$ExpectedDatabase,
  [Parameter(Mandatory)][string]$ExpectedConnectedRole,
  [Parameter(Mandatory)][string]$RestoreOwnerRole,
  [Parameter(Mandatory)][string]$DumpPath,
  [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedSha256,
  [Parameter(Mandatory)][string]$Confirmation
)

. "$PSScriptRoot/Common.ps1"

$requiredConfirmation = "RESTORE-nex-prod-hov-rg/$ExpectedDatabase"
if ($Confirmation -cne $requiredConfirmation) {
  throw "Restore confirmation must exactly equal '$requiredConfirmation'."
}
$null = Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup -RequireResourceGroup
Assert-CommandAvailable -Name "psql"
Assert-CommandAvailable -Name "pg_restore"
Assert-PrivateEndpointReachability -HostName (Get-RequiredEnvironmentValue -Name "HOV_TARGET_PGHOST") -Port ([int]([Environment]::GetEnvironmentVariable("HOV_TARGET_PGPORT", "Process") ?? "5432"))

$resolvedDump = (Resolve-Path -LiteralPath $DumpPath).Path
if ((Get-Sha256 -Path $resolvedDump) -cne $ExpectedSha256.ToLowerInvariant()) {
  throw "Backup SHA-256 does not match the separately reviewed digest."
}

$preflight = Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
  Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--command", "SELECT current_database() || E'\t' || current_user || E'\t' || (SELECT count(*) FROM pg_tables WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema');"
  )
}
$parts = (($preflight -join "").Trim() -split "`t")
if ($parts.Count -ne 3 -or $parts[0] -cne $ExpectedDatabase -or $parts[1] -cne $ExpectedConnectedRole) {
  throw "Target PostgreSQL connection does not match the exact expected database and connected role."
}
if ([int]$parts[2] -ne 0) {
  throw "Refusing restore: target database is not empty. Restore rehearsal and production restore require a newly created empty database."
}

if (-not $PSCmdlet.ShouldProcess("$ResourceGroup/$ExpectedDatabase", "Restore reviewed PostgreSQL backup as owner '$RestoreOwnerRole'")) {
  return
}
Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
  $null = Invoke-NativeCommand -FilePath "pg_restore" -ArgumentList @(
    "--exit-on-error", "--single-transaction", "--no-owner", "--no-privileges",
    "--role=$RestoreOwnerRole", "--dbname=$ExpectedDatabase", $resolvedDump
  )
  $null = Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--command", "ANALYZE;"
  )
}

$ownerCheck = Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
  Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--command", "SELECT (SELECT count(*) FROM pg_tables WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema' AND tableowner <> '$($RestoreOwnerRole.Replace("'", "''"))') + (SELECT count(*) FROM information_schema.sequences s JOIN pg_class c ON c.relname = s.sequence_name JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = s.sequence_schema WHERE pg_get_userbyid(c.relowner) <> '$($RestoreOwnerRole.Replace("'", "''"))');"
  )
}
if ([int](($ownerCheck -join "").Trim()) -ne 0) {
  throw "Restore completed but one or more application tables are not owned by the approved HOV owner role."
}
Write-Host "Restore completed into the exact target database. Run Measure-Postgres.ps1 and Test-PostgresControls.ps1 before deployment."
