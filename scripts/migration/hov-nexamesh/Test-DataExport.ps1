[CmdletBinding()]
param(
  [Parameter()][string[]]$BlobExportDirectories = @(),
  [Parameter()][string[]]$MongoArchivePaths = @(),
  [Parameter(Mandatory)][string]$OutputPath
)

. "$PSScriptRoot/Common.ps1"

$results = @()
foreach ($directory in $BlobExportDirectories) {
  $resolved = (Resolve-Path -LiteralPath $directory).Path
  $tree = Get-DirectoryTreeDigest -Path $resolved
  if ($tree.fileCount -eq 0) { throw "Blob export '$resolved' contains no files." }
  $results += [pscustomobject]@{
    kind            = "blob-export"
    path            = $resolved
    fileCount       = $tree.fileCount
    totalBytes      = $tree.totalBytes
    aggregateDigest = $tree.aggregateDigest
  }
}

if ($MongoArchivePaths.Count -gt 0) { Assert-CommandAvailable -Name "mongorestore" }
foreach ($archivePath in $MongoArchivePaths) {
  $archive = (Resolve-Path -LiteralPath $archivePath).Path
  if ((Get-Item -LiteralPath $archive).Length -eq 0) { throw "Mongo archive '$archive' is empty." }
  & mongorestore --quiet --gzip "--archive=$archive" --dryRun 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { throw "mongorestore dry-run validation failed for a selected archive." }
  $results += [pscustomobject]@{
    kind   = "cosmos-mongo-export"
    path   = $archive
    length = (Get-Item -LiteralPath $archive).Length
    sha256 = Get-Sha256 -Path $archive
    dryRun = "passed"
  }
}

Write-SafeJson -InputObject ([ordered]@{
    schemaVersion = 1
    verifiedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    artifacts     = $results
  }) -Path $OutputPath
Write-Host "Selected export artifacts passed local integrity validation."
