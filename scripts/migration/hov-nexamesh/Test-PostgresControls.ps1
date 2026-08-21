[CmdletBinding()]
param(
  [Parameter()][string]$ResourceGroup = "nex-prod-hov-rg",
  [Parameter(Mandatory)][string]$ExpectedDatabase,
  [Parameter(Mandatory)][string]$ExpectedRuntimeRole,
  [Parameter(Mandatory)][string]$ExpectedOwnerRole,
  [Parameter(Mandatory)][string]$OutputPath
)

. "$PSScriptRoot/Common.ps1"

$null = Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup -RequireResourceGroup
Assert-CommandAvailable -Name "psql"
Assert-PrivateEndpointReachability -HostName (Get-RequiredEnvironmentValue -Name "HOV_TARGET_PGHOST") -Port ([int]([Environment]::GetEnvironmentVariable("HOV_TARGET_PGPORT", "Process") ?? "5432"))

$escapedRuntime = $ExpectedRuntimeRole.Replace("'", "''")
$escapedOwner = $ExpectedOwnerRole.Replace("'", "''")
$controlTable = "__hov_migration_control_$([guid]::NewGuid().ToString('N'))"
$positiveSql = @"
BEGIN;
CREATE TABLE public.$controlTable (id uuid PRIMARY KEY, control_date date NOT NULL);
INSERT INTO public.$controlTable (id, control_date) VALUES (gen_random_uuid(), DATE '2026-07-18');
SELECT count(*) || E'\t' || min(control_date)::text FROM public.$controlTable;
ROLLBACK;
SELECT current_database() || E'\t' || current_user || E'\t' ||
       rolsuper::text || E'\t' || rolcreatedb::text || E'\t' || rolcreaterole::text || E'\t' || rolreplication::text || E'\t' ||
       pg_has_role(current_user, '$escapedOwner', 'MEMBER')::text || E'\t' ||
       has_database_privilege('public', current_database(), 'CONNECT')::text
FROM pg_roles WHERE rolname = '$escapedRuntime';
"@
$positive = Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
  Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--command", $positiveSql
  )
}
$lines = @($positive | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
if ($lines.Count -ne 2) {
  throw "Unexpected PostgreSQL control output."
}
$writeControl = $lines[0].Trim() -split "`t"
$roleControl = $lines[1].Trim() -split "`t"
if ($writeControl[0] -cne "1" -or $writeControl[1] -cne "2026-07-18") {
  throw "Transactional SQL DDL/write/DATE positive control failed."
}
if ($roleControl.Count -ne 8 -or $roleControl[0] -cne $ExpectedDatabase -or $roleControl[1] -cne $ExpectedRuntimeRole) {
  throw "Runtime connection identity does not match the expected database and role."
}
if ($roleControl[2] -ne "f" -or $roleControl[3] -ne "f" -or $roleControl[4] -ne "f" -or $roleControl[5] -ne "f") {
  throw "Runtime role has prohibited server-level privileges."
}
if ($roleControl[6] -ne "t") {
  throw "Runtime role is not a member of the approved schema-owner role required by the current application DDL model."
}
if ($roleControl[7] -ne "f") {
  throw "PUBLIC still has CONNECT on the HOV target database."
}

$negativeDatabase = Get-RequiredEnvironmentValue -Name "HOV_TARGET_NEGATIVE_PGDATABASE"
if ($negativeDatabase -ceq $ExpectedDatabase) {
  throw "HOV_TARGET_NEGATIVE_PGDATABASE must name a separate denial-control database."
}
$previousDatabase = [Environment]::GetEnvironmentVariable("HOV_TARGET_PGDATABASE", "Process")
try {
  [Environment]::SetEnvironmentVariable("HOV_TARGET_PGDATABASE", $negativeDatabase, "Process")
  $negativeAllowed = $false
  Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
    & psql --no-psqlrc --quiet --tuples-only --no-align --set ON_ERROR_STOP=1 --command "SELECT 1;" 1>$null 2>$null
    $script:negativeAllowed = ($LASTEXITCODE -eq 0)
  } | Out-Null
  if ($negativeAllowed) {
    throw "Negative control failed: runtime role connected to the prohibited database '$negativeDatabase'."
  }
} finally {
  [Environment]::SetEnvironmentVariable("HOV_TARGET_PGDATABASE", $previousDatabase, "Process")
}

Write-SafeJson -InputObject ([ordered]@{
    schemaVersion          = 1
    capturedAtUtc          = (Get-Date).ToUniversalTime().ToString("o")
    database               = $ExpectedDatabase
    runtimeRole            = $ExpectedRuntimeRole
    ownerRole              = $ExpectedOwnerRole
    transactionalDdlWrite  = "passed-and-rolled-back"
    dateFidelity           = "passed"
    serverPrivilegeDenials = "passed"
    publicConnectRevoked   = "passed"
    crossDatabaseDenial    = "passed"
  }) -Path $OutputPath
Write-Host "PostgreSQL positive and negative controls passed."
