[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
  [Parameter(Mandatory)][string]$ArtifactRoot,
  [Parameter(Mandatory)][string]$ArtifactPath,
  [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedSha256,
  [Parameter(Mandatory)][string]$Confirmation
)

. "$PSScriptRoot/Common.ps1"

$root = (Resolve-Path -LiteralPath $ArtifactRoot).Path.TrimEnd([IO.Path]::DirectorySeparatorChar)
$artifact = Get-Item -LiteralPath $ArtifactPath
if ($artifact.PSIsContainer) { throw "Artifact cleanup accepts a single file only." }
$relative = [IO.Path]::GetRelativePath($root, $artifact.FullName)
if ($relative -eq ".." -or $relative.StartsWith("..$([IO.Path]::DirectorySeparatorChar)")) {
  throw "Artifact is outside the exact restricted migration root."
}
if ($artifact.Extension -notin @(".dump", ".gz", ".archive")) {
  throw "Artifact cleanup is limited to reviewed dump/archive files."
}
if ((Get-Sha256 -Path $artifact.FullName) -cne $ExpectedSha256.ToLowerInvariant()) {
  throw "Artifact hash differs from the reviewed migration artifact."
}
$requiredConfirmation = "REMOVE-MIGRATION-ARTIFACT/$($artifact.Name)"
if ($Confirmation -cne $requiredConfirmation) {
  throw "Artifact-removal confirmation must exactly equal '$requiredConfirmation'."
}
if (-not $PSCmdlet.ShouldProcess($artifact.FullName, "Remove reviewed temporary migration artifact after its hash and verification are captured")) {
  return
}
Remove-Item -LiteralPath $artifact.FullName -Force
if (Test-Path -LiteralPath $artifact.FullName) { throw "Temporary migration artifact removal could not be verified." }
Write-Host "Temporary migration artifact was removed. This is logical deletion, not a secure-wipe claim; runner-disk teardown remains required."
