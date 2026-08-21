[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
  [Parameter()][string]$ResourceGroup = "nex-prod-hov-rg",
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9]{3,24}$')][string]$StorageAccountName,
  [Parameter()][string[]]$BlobMappings = @(),
  [Parameter()][ValidatePattern('^[a-z0-9-]{3,44}$')][string]$CosmosAccountName,
  [Parameter()][string[]]$MongoMappings = @(),
  [Parameter()][string]$MongoUriEnvironmentVariable = "HOV_TARGET_MONGODB_URI",
  [Parameter(Mandatory)][string]$Confirmation,
  [Parameter(Mandatory)][string]$OutputPath
)

. "$PSScriptRoot/Common.ps1"

if ($Confirmation -cne "IMPORT-TARGET-DATA-nex-prod-hov-rg") {
  throw "Import confirmation must exactly equal 'IMPORT-TARGET-DATA-nex-prod-hov-rg'."
}
$context = Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup -RequireResourceGroup
$results = @()

if ($BlobMappings.Count -gt 0) {
  Assert-CommandAvailable -Name "azcopy"
  Assert-PrivateEndpointReachability -HostName "$StorageAccountName.blob.core.windows.net" -Port 443
  $storageId = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "storage", "account", "show", "--name", $StorageAccountName,
    "--resource-group", $ResourceGroup, "--subscription", $context.subscriptionId,
    "--query", "id", "--output", "tsv", "--only-show-errors"
  )
  if (($storageId -join "") -notmatch "/resourceGroups/$([regex]::Escape($ResourceGroup))/") { throw "Target Storage account boundary mismatch." }
  $oldAutoLogin = [Environment]::GetEnvironmentVariable("AZCOPY_AUTO_LOGIN_TYPE", "Process")
  $oldTenant = [Environment]::GetEnvironmentVariable("AZCOPY_TENANT_ID", "Process")
  try {
    [Environment]::SetEnvironmentVariable("AZCOPY_AUTO_LOGIN_TYPE", "AZCLI", "Process")
    [Environment]::SetEnvironmentVariable("AZCOPY_TENANT_ID", $context.tenantId, "Process")
    foreach ($mapping in $BlobMappings) {
      $parts = $mapping -split "=", 2
      if ($parts.Count -ne 2 -or $parts[0] -notmatch '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$') { throw "Blob mappings must be container=directory." }
      $container = $parts[0]
      $directory = (Resolve-Path -LiteralPath $parts[1]).Path
      $existing = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
        "storage", "blob", "list", "--account-name", $StorageAccountName,
        "--container-name", $container, "--auth-mode", "login", "--num-results", "1",
        "--subscription", $context.subscriptionId, "--query", "length(@)", "--output", "tsv", "--only-show-errors"
      )
      if ([int](($existing -join "").Trim()) -ne 0) { throw "Target Blob container '$container' is not empty." }
      if ($PSCmdlet.ShouldProcess("$StorageAccountName/$container", "Import reviewed Blob export from protected migration storage")) {
        $sourceTree = Get-DirectoryTreeDigest -Path $directory
        & azcopy copy (Join-Path $directory "*") "https://$StorageAccountName.blob.core.windows.net/$container" --recursive=true --from-to=LocalBlob 1>$null 2>$null
        if ($LASTEXITCODE -ne 0) { throw "AzCopy target import failed; detailed output was suppressed to protect object names." }
        $verificationDirectory = New-SafeDirectory -Path (Join-Path ([IO.Path]::GetTempPath()) "hov-blob-verify-$([guid]::NewGuid().ToString('N'))")
        try {
          & azcopy copy "https://$StorageAccountName.blob.core.windows.net/$container" $verificationDirectory --recursive=true --from-to=BlobLocal 1>$null 2>$null
          if ($LASTEXITCODE -ne 0) { throw "AzCopy target verification download failed; detailed output was suppressed to protect object names." }
          $downloadRoot = Join-Path $verificationDirectory $container
          if (-not (Test-Path -LiteralPath $downloadRoot)) { $downloadRoot = $verificationDirectory }
          $targetTree = Get-DirectoryTreeDigest -Path $downloadRoot
          if ($targetTree.fileCount -ne $sourceTree.fileCount -or
            $targetTree.totalBytes -ne $sourceTree.totalBytes -or
            $targetTree.aggregateDigest -cne $sourceTree.aggregateDigest) {
            throw "Target Blob content verification did not match the reviewed source export."
          }
          $results += [pscustomobject]@{
            kind = "blob-import"; container = $container; status = "completed-and-verified"
            fileCount = $targetTree.fileCount; totalBytes = $targetTree.totalBytes
            aggregateDigest = $targetTree.aggregateDigest
          }
        } finally {
          Remove-Item -LiteralPath $verificationDirectory -Recurse -Force -ErrorAction SilentlyContinue
        }
      }
    }
  } finally {
    [Environment]::SetEnvironmentVariable("AZCOPY_AUTO_LOGIN_TYPE", $oldAutoLogin, "Process")
    [Environment]::SetEnvironmentVariable("AZCOPY_TENANT_ID", $oldTenant, "Process")
  }
}

if ($MongoMappings.Count -gt 0) {
  if (-not $CosmosAccountName) { throw "CosmosAccountName is required for Mongo imports." }
  Assert-CommandAvailable -Name "mongosh"
  Assert-CommandAvailable -Name "mongorestore"
  Assert-PrivateEndpointReachability -HostName "$CosmosAccountName.mongo.cosmos.azure.com" -Port 10255
  $cosmosId = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "cosmosdb", "show", "--name", $CosmosAccountName, "--resource-group", $ResourceGroup,
    "--subscription", $context.subscriptionId, "--query", "id", "--output", "tsv", "--only-show-errors"
  )
  if (($cosmosId -join "") -notmatch "/resourceGroups/$([regex]::Escape($ResourceGroup))/") { throw "Target Cosmos account boundary mismatch." }
  $mongoUri = Get-RequiredEnvironmentValue -Name $MongoUriEnvironmentVariable
  if (([uri]$mongoUri).Host -cne "$CosmosAccountName.mongo.cosmos.azure.com") { throw "Target Mongo URI boundary mismatch." }
  try {
    foreach ($mapping in $MongoMappings) {
      $parts = $mapping -split "=", 2
      if ($parts.Count -ne 2 -or $parts[0] -notmatch '^[A-Za-z0-9_.-]+$') { throw "Mongo mappings must be database=archive." }
      $database = $parts[0]
      $archive = (Resolve-Path -LiteralPath $parts[1]).Path
      $countJson = & mongosh $mongoUri --quiet --eval "JSON.stringify(db.getSiblingDB('$database').getCollectionNames().map(n => ({name:n,count:db.getSiblingDB('$database').getCollection(n).countDocuments({})})))" 2>$null
      if ($LASTEXITCODE -ne 0) { throw "Target Cosmos emptiness check failed; details were suppressed." }
      $counts = ($countJson -join "") | ConvertFrom-Json
      if (@($counts | Where-Object { $_.count -ne 0 }).Count -gt 0) { throw "Target Cosmos database '$database' is not empty." }
      if ($PSCmdlet.ShouldProcess("$CosmosAccountName/$database", "Import reviewed Cosmos Mongo archive without dropping existing data")) {
        & mongorestore --quiet --uri $mongoUri --gzip "--archive=$archive" --stopOnError --nsInclude "$database.*" 1>$null 2>$null
        if ($LASTEXITCODE -ne 0) { throw "Target Cosmos Mongo restore failed; details were suppressed." }
        $results += [pscustomobject]@{ kind = "cosmos-mongo-import"; database = $database; status = "completed"; archiveSha256 = Get-Sha256 -Path $archive }
      }
    }
  } finally {
    $mongoUri = $null
    [Environment]::SetEnvironmentVariable($MongoUriEnvironmentVariable, $null, "Process")
  }
}

Write-SafeJson -InputObject ([ordered]@{
    schemaVersion = 1
    capturedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    target        = $context
    results       = $results
  }) -Path $OutputPath
Write-Host "Selected target imports completed through private endpoints. Run target inventories and application-level controls before cutover."
