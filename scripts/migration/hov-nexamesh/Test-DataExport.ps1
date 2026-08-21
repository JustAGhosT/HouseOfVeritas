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
  $files = @(Get-ChildItem -LiteralPath $resolved -Recurse -File)
  if ($files.Count -eq 0) { throw "Blob export '$resolved' contains no files." }
  $fileDigests = foreach ($file in $files) {
    "$(Get-Sha256 -Path $file.FullName)|$($file.Length)"
  }
  $aggregateBytes = [Text.Encoding]::UTF8.GetBytes(($fileDigests | Sort-Object) -join "`n")
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $aggregate = ([Convert]::ToHexString($sha.ComputeHash($aggregateBytes))).ToLowerInvariant() }
  finally { $sha.Dispose() }
  $results += [pscustomobject]@{
    kind            = "blob-export"
    path            = $resolved
    fileCount       = $files.Count
    totalBytes      = [long](($files | Measure-Object -Property Length -Sum).Sum ?? 0)
    aggregateDigest = $aggregate
  }
}

if ($MongoArchivePaths.Count -gt 0) { Assert-CommandAvailable -Name "mongorestore" }
foreach ($archivePath in $MongoArchivePaths) {
  $archive = (Resolve-Path -LiteralPath $archivePath).Path
  if ((Get-Item -LiteralPath $archive).Length -eq 0) { throw "Mongo archive '$archive' is empty." }
  & mongorestore --quiet --gzip "--archive=$archive" --dryRun 1>$null
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
