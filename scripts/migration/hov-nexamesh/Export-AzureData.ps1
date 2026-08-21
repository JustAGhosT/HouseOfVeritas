[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
  [Parameter()][string]$ResourceGroup = "nl-prod-hov-rg",
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9]{3,24}$')][string]$StorageAccountName,
  [Parameter()][string[]]$BlobContainers = @(),
  [Parameter()][string[]]$MongoDatabases = @(),
  [Parameter()][ValidatePattern('^[a-z0-9-]{3,44}$')][string]$CosmosAccountName,
  [Parameter()][string]$MongoUriEnvironmentVariable = "HOV_SOURCE_MONGODB_URI",
  [Parameter(Mandatory)][string]$OutputDirectory,
  [Parameter(Mandatory)][string]$Confirmation
)

. "$PSScriptRoot/Common.ps1"

if ($Confirmation -cne "EXPORT-SOURCE-DATA-nl-prod-hov-rg") {
  throw "Export confirmation must exactly equal 'EXPORT-SOURCE-DATA-nl-prod-hov-rg'."
}
$context = Assert-AzureBoundary -Boundary Source -ResourceGroup $ResourceGroup -RequireResourceGroup
$output = New-SafeDirectory -Path $OutputDirectory
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$artifacts = @()

if ($BlobContainers.Count -gt 0) {
  Assert-CommandAvailable -Name "azcopy"
  $storageId = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "storage", "account", "show", "--name", $StorageAccountName,
    "--resource-group", $ResourceGroup, "--subscription", $context.subscriptionId,
    "--query", "id", "--output", "tsv", "--only-show-errors"
  )
  if (($storageId -join "") -notmatch "/resourceGroups/$([regex]::Escape($ResourceGroup))/") {
    throw "Storage account is not in the exact asserted source resource group."
  }
  $previousAutoLogin = [Environment]::GetEnvironmentVariable("AZCOPY_AUTO_LOGIN_TYPE", "Process")
  $previousTenant = [Environment]::GetEnvironmentVariable("AZCOPY_TENANT_ID", "Process")
  [Environment]::SetEnvironmentVariable("AZCOPY_AUTO_LOGIN_TYPE", "AZCLI", "Process")
  [Environment]::SetEnvironmentVariable("AZCOPY_TENANT_ID", $context.tenantId, "Process")
  try {
  foreach ($container in $BlobContainers) {
    if ($container -notmatch '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$') {
      throw "Invalid Blob container name '$container'."
    }
    $destination = New-SafeDirectory -Path (Join-Path $output "blob-$container-$stamp")
    $source = "https://$StorageAccountName.blob.core.windows.net/$container"
    if ($PSCmdlet.ShouldProcess($source, "Export Blob container to protected local migration storage '$destination'")) {
      & azcopy copy $source $destination --recursive=true --from-to=BlobLocal 1>$null 2>$null
      if ($LASTEXITCODE -ne 0) { throw "AzCopy failed for a selected Blob container; detailed output was suppressed to protect object names." }
      $files = @(Get-ChildItem -LiteralPath $destination -Recurse -File)
      $artifacts += [pscustomobject]@{
        kind       = "blob-export"
        source     = "$StorageAccountName/$container"
        path       = $destination
        fileCount  = $files.Count
        totalBytes = [long](($files | Measure-Object -Property Length -Sum).Sum ?? 0)
      }
    }
  }
  } finally {
    [Environment]::SetEnvironmentVariable("AZCOPY_AUTO_LOGIN_TYPE", $previousAutoLogin, "Process")
    [Environment]::SetEnvironmentVariable("AZCOPY_TENANT_ID", $previousTenant, "Process")
  }
}

if ($MongoDatabases.Count -gt 0) {
  if ([string]::IsNullOrWhiteSpace($CosmosAccountName)) {
    throw "CosmosAccountName is required when Mongo databases are selected."
  }
  Assert-CommandAvailable -Name "mongodump"
  $cosmosId = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "cosmosdb", "show", "--name", $CosmosAccountName, "--resource-group", $ResourceGroup,
    "--subscription", $context.subscriptionId, "--query", "id", "--output", "tsv", "--only-show-errors"
  )
  if (($cosmosId -join "") -notmatch "/resourceGroups/$([regex]::Escape($ResourceGroup))/") {
    throw "Cosmos account is not in the exact asserted source resource group."
  }
  $mongoUri = Get-RequiredEnvironmentValue -Name $MongoUriEnvironmentVariable
  $parsedMongoUri = [uri]$mongoUri
  if ($parsedMongoUri.Host -cne "$CosmosAccountName.mongo.cosmos.azure.com") {
    throw "Mongo URI host does not match the exact asserted source Cosmos account."
  }
  foreach ($database in $MongoDatabases) {
    if ($database -notmatch '^[A-Za-z0-9_.-]+$') { throw "Invalid Mongo database name '$database'." }
    $archive = Join-Path $output "cosmos-$database-$stamp.archive.gz"
    if ($PSCmdlet.ShouldProcess("Cosmos Mongo database '$database'", "Create a compressed migration archive '$archive'")) {
      # The URI exists only in process memory/environment. It is never echoed or written by this script.
      & mongodump --quiet --uri $mongoUri --db $database --gzip "--archive=$archive" 1>$null 2>$null
      if ($LASTEXITCODE -ne 0) { throw "mongodump failed for the selected database." }
      if (-not (Test-Path -LiteralPath $archive) -or (Get-Item -LiteralPath $archive).Length -eq 0) {
        throw "mongodump did not create a non-empty archive."
      }
      $artifacts += [pscustomobject]@{
        kind      = "cosmos-mongo-export"
        database  = $database
        path      = $archive
        length    = (Get-Item -LiteralPath $archive).Length
        sha256    = Get-Sha256 -Path $archive
      }
    }
  }
  [Environment]::SetEnvironmentVariable($MongoUriEnvironmentVariable, $null, "Process")
}

Write-SafeJson -InputObject ([ordered]@{
    schemaVersion = 1
    capturedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    source        = $context
    artifacts     = $artifacts
    handling      = "Exports contain production data; encrypt at rest, restrict access, and never attach them to PRs or evidence manifests as content"
  }) -Path (Join-Path $output "azure-data-export-$stamp.json")
Write-Host "Selected source data exports completed. No credential values were printed or written."
