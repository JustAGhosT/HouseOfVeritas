[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$EvidenceRoot,
  [Parameter(Mandatory)][string[]]$ArtifactPaths,
  [Parameter(Mandatory)][string]$OutputPath
)

. "$PSScriptRoot/Common.ps1"

$root = (Resolve-Path -LiteralPath $EvidenceRoot).Path.TrimEnd([IO.Path]::DirectorySeparatorChar)
$manifestPath = [IO.Path]::GetFullPath($OutputPath)
$manifestRelativePath = [IO.Path]::GetRelativePath($root, $manifestPath)
if ($manifestRelativePath -eq ".." -or $manifestRelativePath.StartsWith("..$([IO.Path]::DirectorySeparatorChar)")) {
  throw "Evidence manifest output must remain inside the declared evidence root."
}
$entries = @()
foreach ($artifactPath in $ArtifactPaths) {
  $artifact = Get-Item -LiteralPath $artifactPath
  if ($artifact.PSIsContainer) { throw "Evidence manifests accept files only: '$artifactPath'." }
  $fullPath = $artifact.FullName
  $relativePath = [IO.Path]::GetRelativePath($root, $fullPath)
  if ($relativePath -eq ".." -or $relativePath.StartsWith("..$([IO.Path]::DirectorySeparatorChar)")) {
    throw "Artifact '$fullPath' is outside the declared evidence root."
  }
  if ($fullPath -ceq $manifestPath) { throw "The manifest cannot hash itself." }
  if ($artifact.Name -match '(?i)(?:^\.env|\.tfvars$|\.tfstate(?:\.|$)|credentials?|secrets?|\.pem$|\.key$|\.pfx$)') {
    throw "Secret/state-bearing file '$($artifact.Name)' cannot be registered as general evidence. Record an independently calculated digest in a restricted migration record instead."
  }
  $entries += [pscustomobject]@{
    path         = $relativePath.Replace([IO.Path]::DirectorySeparatorChar, '/')
    length       = $artifact.Length
    sha256       = Get-Sha256 -Path $fullPath
    lastWriteUtc = $artifact.LastWriteTimeUtc.ToString("o")
  }
}

Write-SafeJson -InputObject ([ordered]@{
    schemaVersion = 1
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    root           = $root
    artifacts      = @($entries | Sort-Object path)
    containsArtifactContents = $false
  }) -Path $manifestPath
Write-Host "Evidence manifest written with SHA-256 digests only: $manifestPath"
