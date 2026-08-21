[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet("Source", "Target")][string]$Boundary,
  [Parameter(Mandatory)][string]$ResourceGroup,
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9]{3,24}$')][string]$StorageAccountName,
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9-]{3,44}$')][string]$CosmosAccountName,
  [Parameter(Mandatory)][string]$OutputPath
)

. "$PSScriptRoot/Common.ps1"

$context = Assert-AzureBoundary -Boundary $Boundary -ResourceGroup $ResourceGroup -RequireResourceGroup
if ($Boundary -eq "Target") {
  Assert-PrivateEndpointReachability -HostName "$StorageAccountName.blob.core.windows.net" -Port 443
  Assert-PrivateEndpointReachability -HostName "$CosmosAccountName.mongo.cosmos.azure.com" -Port 10255
}

function Get-StringDigest([string[]]$Lines) {
  $joined = ($Lines | Sort-Object) -join "`n"
  $bytes = [Text.Encoding]::UTF8.GetBytes($joined)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ([Convert]::ToHexString($sha.ComputeHash($bytes))).ToLowerInvariant() }
  finally { $sha.Dispose() }
}

$storage = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
  "storage", "account", "show", "--name", $StorageAccountName,
  "--resource-group", $ResourceGroup, "--subscription", $context.subscriptionId,
  "--query", "{id:id,location:primaryLocation,publicNetworkAccess:publicNetworkAccess,allowBlobPublicAccess:allowBlobPublicAccess,allowSharedKeyAccess:allowSharedKeyAccess}",
  "--output", "json", "--only-show-errors"
) | Out-String | ConvertFrom-Json
$containers = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
  "storage", "container", "list", "--account-name", $StorageAccountName,
  "--auth-mode", "login", "--subscription", $context.subscriptionId,
  "--query", "[].name", "--output", "tsv", "--only-show-errors"
)
$containerInventory = @()
foreach ($container in @($containers | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
  $blobJson = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "storage", "blob", "list", "--account-name", $StorageAccountName,
    "--container-name", $container, "--auth-mode", "login", "--subscription", $context.subscriptionId,
    "--num-results", "*", "--query", "[].{name:name,size:properties.contentLength,etag:properties.etag,md5:properties.contentSettings.contentMd5}",
    "--output", "json", "--only-show-errors"
  ) | Out-String
  $blobs = @(($blobJson | ConvertFrom-Json) | Where-Object { $null -ne $_ })
  $digestLines = foreach ($blob in $blobs) {
    "$($blob.name)|$($blob.size)|$($blob.md5)"
  }
  $containerInventory += [pscustomobject]@{
    name              = $container
    objectCount       = $blobs.Count
    totalBytes        = [long](($blobs | Measure-Object -Property size -Sum).Sum ?? 0)
    metadataDigest    = Get-StringDigest -Lines @($digestLines)
    objectNamesStored = $false
  }
}

$cosmos = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
  "cosmosdb", "show", "--name", $CosmosAccountName, "--resource-group", $ResourceGroup,
  "--subscription", $context.subscriptionId,
  "--query", "{id:id,locations:locations[].locationName,publicNetworkAccess:publicNetworkAccess,disableLocalAuth:disableLocalAuth}",
  "--output", "json", "--only-show-errors"
) | Out-String | ConvertFrom-Json
$databases = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
  "cosmosdb", "mongodb", "database", "list", "--account-name", $CosmosAccountName,
  "--resource-group", $ResourceGroup, "--subscription", $context.subscriptionId,
  "--query", "[].name", "--output", "tsv", "--only-show-errors"
)
$databaseInventory = @()
foreach ($database in @($databases | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
  $collections = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "cosmosdb", "mongodb", "collection", "list", "--account-name", $CosmosAccountName,
    "--resource-group", $ResourceGroup, "--database-name", $database,
    "--subscription", $context.subscriptionId,
    "--query", "[].{name:name,shardKey:resource.shardKey}", "--output", "json", "--only-show-errors"
  ) | Out-String | ConvertFrom-Json
  $databaseInventory += [pscustomobject]@{ name = $database; collections = @($collections) }
}

Write-SafeJson -InputObject ([ordered]@{
    schemaVersion  = 1
    capturedAtUtc  = (Get-Date).ToUniversalTime().ToString("o")
    boundary       = $context
    storageAccount = $storage
    containers     = $containerInventory
    cosmosAccount  = $cosmos
    mongoDatabases = $databaseInventory
    safeguards     = @("No Blob object names were stored", "No Blob contents were read", "No Cosmos documents or keys were requested")
  }) -Path $OutputPath
Write-Host "Azure data-plane inventory completed without storing object names, object contents, Cosmos documents, or access keys."
