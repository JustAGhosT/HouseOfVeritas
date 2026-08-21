[CmdletBinding()]
param(
  [Parameter()][string]$ResourceGroup = "nl-prod-hov-rg",
  [Parameter(Mandatory)][string]$OutputDirectory,
  [switch]$IncludePostgresMetadata
)

. "$PSScriptRoot/Common.ps1"

$context = Assert-AzureBoundary -Boundary Source -ResourceGroup $ResourceGroup -RequireResourceGroup
$output = New-SafeDirectory -Path $OutputDirectory
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")

$resources = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
  "resource", "list", "--resource-group", $ResourceGroup,
  "--subscription", $context.subscriptionId,
  "--query", "[].{id:id,name:name,type:type,location:location,kind:kind}",
  "--output", "json", "--only-show-errors"
) | Out-String | ConvertFrom-Json

$webApps = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
  "webapp", "list", "--resource-group", $ResourceGroup,
  "--subscription", $context.subscriptionId,
  "--query", "[].name", "--output", "tsv", "--only-show-errors"
)
$webAppInventory = @()
foreach ($webApp in @($webApps | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
  $settings = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "webapp", "config", "appsettings", "list", "--name", $webApp,
    "--resource-group", $ResourceGroup, "--subscription", $context.subscriptionId,
    "--query", "[].{name:name,keyVaultReference:starts_with(value, '@Microsoft.KeyVault(')}",
    "--output", "json", "--only-show-errors"
  ) | Out-String | ConvertFrom-Json
  $bindings = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "webapp", "config", "hostname", "list", "--webapp-name", $webApp,
    "--resource-group", $ResourceGroup, "--subscription", $context.subscriptionId,
    "--query", "[].{name:name,sslState:sslState,hostNameType:hostNameType}",
    "--output", "json", "--only-show-errors"
  ) | Out-String | ConvertFrom-Json
  $webAppInventory += [pscustomobject]@{
    name              = $webApp
    appSettingMetadata = @($settings)
    hostnameBindings   = @($bindings)
  }
}

$vaults = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
  "keyvault", "list", "--resource-group", $ResourceGroup,
  "--subscription", $context.subscriptionId,
  "--query", "[].{name:name,id:id,enableRbacAuthorization:properties.enableRbacAuthorization,publicNetworkAccess:properties.publicNetworkAccess}",
  "--output", "json", "--only-show-errors"
) | Out-String | ConvertFrom-Json
$vaultInventory = @()
foreach ($vault in @($vaults)) {
  $secretMetadata = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "keyvault", "secret", "list", "--vault-name", $vault.name,
    "--subscription", $context.subscriptionId,
    "--query", "[].{name:name,enabled:attributes.enabled,updated:attributes.updated}",
    "--output", "json", "--only-show-errors"
  ) | Out-String | ConvertFrom-Json
  $vaultInventory += [pscustomobject]@{
    name                    = $vault.name
    id                      = $vault.id
    enableRbacAuthorization = $vault.enableRbacAuthorization
    publicNetworkAccess     = $vault.publicNetworkAccess
    secretMetadata          = @($secretMetadata)
  }
}

$inventory = [ordered]@{
  schemaVersion  = 1
  capturedAtUtc  = (Get-Date).ToUniversalTime().ToString("o")
  boundary       = $context
  resources      = @($resources)
  webApps        = $webAppInventory
  keyVaults      = $vaultInventory
  safeguards     = @(
    "No application-setting values were written",
    "No Key Vault secret values were requested",
    "No database row contents were requested"
  )
}
Write-SafeJson -InputObject $inventory -Path (Join-Path $output "source-azure-inventory-$stamp.json")

if ($IncludePostgresMetadata) {
  Assert-CommandAvailable -Name "psql"
  $metadataSql = @'
SELECT json_build_object(
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'current_role', current_user,
  'extensions', COALESCE((SELECT json_agg(extname ORDER BY extname) FROM pg_extension), '[]'::json),
  'schemas', COALESCE((SELECT json_agg(json_build_object('schema', nspname, 'owner', pg_get_userbyid(nspowner)) ORDER BY nspname) FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'), '[]'::json),
  'tables', COALESCE((SELECT json_agg(json_build_object('schema', pt.schemaname, 'table', pt.tablename, 'owner', pt.tableowner, 'estimated_rows', COALESCE(st.n_live_tup, 0)) ORDER BY pt.schemaname, pt.tablename) FROM pg_tables pt LEFT JOIN pg_stat_user_tables st ON st.schemaname = pt.schemaname AND st.relname = pt.tablename WHERE pt.schemaname NOT LIKE 'pg_%' AND pt.schemaname <> 'information_schema'), '[]'::json),
  'indexes', COALESCE((SELECT json_agg(json_build_object('schema', schemaname, 'index', indexname, 'table', tablename) ORDER BY schemaname, indexname) FROM pg_indexes WHERE schemaname NOT LIKE 'pg_%'), '[]'::json)
);
'@
  $postgresJson = Invoke-WithPostgresEnvironment -Prefix HOV_SOURCE -ScriptBlock {
    Invoke-NativeCommand -FilePath "psql" -ArgumentList @(
      "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
      "--command", $metadataSql
    )
  }
  $postgresMetadata = ($postgresJson -join [Environment]::NewLine).Trim() | ConvertFrom-Json
  Write-SafeJson -InputObject ([ordered]@{
      schemaVersion = 1
      capturedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
      metadata      = $postgresMetadata
    }) -Path (Join-Path $output "source-postgres-metadata-$stamp.json")
}

Write-Host "Source inventory completed. Evidence contains metadata only: $output"
