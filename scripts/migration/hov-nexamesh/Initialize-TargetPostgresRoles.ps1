[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
  [Parameter()][string]$ResourceGroup = "nex-prod-hov-rg",
  [Parameter(Mandatory)][ValidatePattern('^houseofveritas$')][string]$TargetDatabase,
  [Parameter(Mandatory)][ValidatePattern('^[A-Za-z][A-Za-z0-9_.-]{1,62}$')][string]$ExpectedEntraAdminRole,
  [Parameter(Mandatory)][ValidatePattern('^nex-prod-hov-[a-z0-9-]+$')][string]$AppServicePrincipalName,
  [Parameter(Mandatory)][ValidatePattern('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')][string]$AppServicePrincipalObjectId,
  [Parameter()][ValidatePattern('^hov_owner$')][string]$OwnerRole = "hov_owner",
  [Parameter(Mandatory)][string]$OutputPath,
  [Parameter(Mandatory)][string]$Confirmation
)

. "$PSScriptRoot/Common.ps1"

$requiredConfirmation = "INITIALIZE-POSTGRES-ROLES/$TargetDatabase/$AppServicePrincipalName"
if ($Confirmation -cne $requiredConfirmation) {
  throw "Role initialization confirmation must exactly equal '$requiredConfirmation'."
}
$null = Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup -RequireResourceGroup
Assert-CommandAvailable -Name "psql"
$hostName = Get-RequiredEnvironmentValue -Name "HOV_TARGET_PGHOST"
Assert-PrivateEndpointReachability -HostName $hostName -Port ([int]([Environment]::GetEnvironmentVariable("HOV_TARGET_PGPORT", "Process") ?? "5432"))
if ((Get-RequiredEnvironmentValue -Name "HOV_TARGET_PGDATABASE") -cne "postgres") {
  throw "Role initialization must begin through the postgres database using the temporary Entra administrator connection."
}

$runtimeRoleSql = $AppServicePrincipalName.Replace("'", "''")
$ownerRoleSql = $OwnerRole.Replace("'", "''")
$databaseSql = $TargetDatabase.Replace("'", "''")
$objectIdSql = $AppServicePrincipalObjectId.ToLowerInvariant()
$preflightSql = @"
SELECT current_database() || E'\t' || current_user || E'\t' ||
       (SELECT count(*) FROM pg_roles WHERE rolname = '$runtimeRoleSql')::text || E'\t' ||
       (SELECT count(*) FROM pg_catalog.pgaadauth_list_principals(false)
          WHERE rolname = '$runtimeRoleSql')::text || E'\t' ||
       (SELECT count(*) FROM pg_catalog.pgaadauth_list_principals(false)
          WHERE rolname = '$runtimeRoleSql'
            AND lower(objectId) = '$objectIdSql'
            AND principalType = 'service'
            AND isAdmin = 0)::text || E'\t' ||
       (SELECT count(*) FROM pg_database WHERE datname = '$databaseSql')::text;
"@
$preflight = Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
  Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--command", $preflightSql
  )
}
$preflightParts = (($preflight -join "").Trim() -split "`t")
if ($preflightParts.Count -ne 6 -or $preflightParts[0] -cne "postgres" -or $preflightParts[1] -cne $ExpectedEntraAdminRole) {
  throw "PostgreSQL bootstrap connection is not the exact postgres database and expected Entra administrator role."
}
if ($preflightParts[5] -cne "1") {
  throw "The exact target application database does not exist."
}
$runtimeRoleExists = $preflightParts[2] -ceq "1"
$mappedPrincipalCount = [int]$preflightParts[3]
$exactMappedPrincipalCount = [int]$preflightParts[4]
if ($mappedPrincipalCount -gt 0 -and $exactMappedPrincipalCount -ne 1) {
  throw "The existing PostgreSQL Entra role name is mapped to a different object, type, or admin posture."
}
if ($runtimeRoleExists -and $exactMappedPrincipalCount -ne 1) {
  throw "The runtime PostgreSQL role exists without the exact expected App Service Entra mapping."
}

if (-not $PSCmdlet.ShouldProcess("$ResourceGroup/$TargetDatabase", "Create and grant the exact App Service Entra PostgreSQL runtime role and HOV owner role")) {
  return
}

if (-not $runtimeRoleExists) {
  $createPrincipalSql = "SELECT pg_catalog.pgaadauth_create_principal_with_oid('$runtimeRoleSql', '$objectIdSql', 'service', false, false);"
  Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
    $null = Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
      "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--command", $createPrincipalSql
    )
  }
}

$clusterGrantSql = @"
DO `$role_setup`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$ownerRoleSql') THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT', '$ownerRoleSql');
  END IF;
END
`$role_setup`$;
ALTER ROLE "$OwnerRole" NOLOGIN NOCREATEDB NOCREATEROLE NOINHERIT;
ALTER ROLE "$AppServicePrincipalName" NOCREATEDB NOCREATEROLE INHERIT;
GRANT "$OwnerRole" TO "$AppServicePrincipalName";
REVOKE CONNECT ON DATABASE "$TargetDatabase" FROM PUBLIC;
GRANT CONNECT ON DATABASE "$TargetDatabase" TO "$AppServicePrincipalName";
"@
Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
  $null = Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
    "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--command", $clusterGrantSql
  )
}

# pgaadauth_list_principals() only exists in the "postgres" maintenance database on Azure
# Database for PostgreSQL Flexible Server, so the Entra-mapping check must run here, before
# the HOV_TARGET_PGDATABASE switch below -- querying it from the target database fails with
# "function pgaadauth_list_principals(...) does not exist".
$entraMappingSql = @"
SELECT (SELECT count(*) FROM pg_catalog.pgaadauth_list_principals(false)
          WHERE rolname = '$runtimeRoleSql'
            AND lower(objectId) = '$objectIdSql'
            AND principalType = 'service'
            AND isAdmin = 0)::text;
"@
$entraMappingCount = ((Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
      Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
        "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
        "--command", $entraMappingSql
      )
    }) -join "").Trim()

$previousDatabase = [Environment]::GetEnvironmentVariable("HOV_TARGET_PGDATABASE", "Process")
try {
  [Environment]::SetEnvironmentVariable("HOV_TARGET_PGDATABASE", $TargetDatabase, "Process")
  $databaseGrantSql = @"
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO "$OwnerRole";
GRANT USAGE ON SCHEMA public TO "$AppServicePrincipalName";
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO "$AppServicePrincipalName";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "$AppServicePrincipalName";
ALTER DEFAULT PRIVILEGES FOR ROLE "$OwnerRole" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES TO "$AppServicePrincipalName";
ALTER DEFAULT PRIVILEGES FOR ROLE "$OwnerRole" IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "$AppServicePrincipalName";
"@
  Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
    $null = Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
      "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--command", $databaseGrantSql
    )
  }

  # Booleans are stringified via explicit CASE, not ::text -- this server's boolean::text
  # output was observed to render "true"/"false" rather than PostgreSQL's traditional "t"/"f",
  # which silently failed every -cne "t"/"f" comparison below despite the underlying grants
  # being exactly correct. CASE fixes the output contract at the comparison site regardless of
  # engine/version bool_out behavior. The owner-lockdown check uses EXISTS instead of a scalar
  # subquery so a missing "$OwnerRole" role also yields a deterministic 'f' instead of NULL
  # (which would otherwise collapse the whole || chain below to NULL).
  $verificationSql = @"
SELECT current_database() || E'\t' || current_user || E'\t' ||
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_roles
         WHERE rolname = '$ownerRoleSql'
           AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb
           AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls
       ) THEN 't' ELSE 'f' END || E'\t' ||
       CASE WHEN pg_has_role('$runtimeRoleSql', '$ownerRoleSql', 'MEMBER') THEN 't' ELSE 'f' END || E'\t' ||
       CASE WHEN has_database_privilege('public', current_database(), 'CONNECT') THEN 't' ELSE 'f' END || E'\t' ||
       CASE WHEN has_database_privilege('$runtimeRoleSql', current_database(), 'CONNECT') THEN 't' ELSE 'f' END || E'\t' ||
       CASE WHEN has_schema_privilege('public', 'public', 'CREATE') THEN 't' ELSE 'f' END;
"@
  $verification = Invoke-WithPostgresEnvironment -Prefix HOV_TARGET -ScriptBlock {
    Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
      "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
      "--command", $verificationSql
    )
  }
} finally {
  [Environment]::SetEnvironmentVariable("HOV_TARGET_PGDATABASE", $previousDatabase, "Process")
}

$verificationParts = (($verification -join "").Trim() -split "`t")
# Diagnostic detail for the failure branch below. Built unconditionally (cheap) so a
# thrown mismatch names exactly which field(s) failed instead of a single generic message --
# a verification query whose `||` concatenation hits a NULL sub-expression collapses the
# entire tab-joined row to an empty string, which trips only the Count check with every
# individual field looking blank rather than visibly wrong.
$verificationFieldNames = @(
  "database", "entraAdminUser", "ownerLockedDown", "runtimeOwnerMembership",
  "publicConnect", "runtimeConnect", "publicSchemaCreate"
)
$verificationFieldDiagnostics = for ($i = 0; $i -lt $verificationParts.Count; $i++) {
  $label = if ($i -lt $verificationFieldNames.Count) { $verificationFieldNames[$i] } else { "extra$i" }
  "[${i}:${label}]=[$($verificationParts[$i])]"
}
$verificationDiagnosticText = "entraMappingCount=[$entraMappingCount] verificationParts.Count=$($verificationParts.Count) " +
  ($verificationFieldDiagnostics -join " ")
if ($verificationParts.Count -ne 7 -or
  $verificationParts[0] -cne $TargetDatabase -or
  $verificationParts[1] -cne $ExpectedEntraAdminRole -or
  $entraMappingCount -cne "1" -or
  $verificationParts[2] -cne "t" -or
  $verificationParts[3] -cne "t" -or
  $verificationParts[4] -cne "f" -or
  $verificationParts[5] -cne "t" -or
  $verificationParts[6] -cne "f") {
  throw "PostgreSQL role, Entra mapping, membership, CONNECT, or schema-public verification failed. $verificationDiagnosticText"
}

Write-SafeJson -InputObject ([ordered]@{
    schemaVersion               = 1
    completedAtUtc              = (Get-Date).ToUniversalTime().ToString("o")
    database                    = $TargetDatabase
    entraAdministratorRole      = $ExpectedEntraAdminRole
    runtimeRole                 = $AppServicePrincipalName
    runtimePrincipalObjectId    = $objectIdSql
    runtimePrincipalType        = "service"
    runtimePrincipalIsAdmin     = $false
    ownerRole                   = $OwnerRole
    ownerRoleLogin              = $false
    runtimeOwnerMembership      = "granted"
    publicDatabaseConnect       = "revoked"
    publicSchemaCreate          = "revoked"
    existingAndDefaultPrivileges = "granted"
    secretValuesRecorded        = $false
  }) -Path $OutputPath
Write-Host "Target PostgreSQL Entra runtime and owner roles were initialized and verified; no credential values were recorded."
