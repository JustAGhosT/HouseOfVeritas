[CmdletBinding()]
param(
  [Parameter()][string]$ResourceGroup = "nex-prod-hov-rg",
  [Parameter(Mandatory)][string]$PlanJsonPath,
  [Parameter(Mandatory)][string[]]$AllowedResourceAddresses,
  [Parameter(Mandatory)][string]$OutputPath
)

. "$PSScriptRoot/Common.ps1"

$context = Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup
$planPath = (Resolve-Path -LiteralPath $PlanJsonPath).Path
$raw = Get-Content -LiteralPath $planPath -Raw
$plan = $raw | ConvertFrom-Json -Depth 100
$failures = [Collections.Generic.List[string]]::new()

foreach ($forbidden in @("9530cd32-9e33-47f0-9247-ed964730b580", "bb4e3882-2079-4bab-8974-611bc0b8bb58", "nl-prod-")) {
  if ($raw.Contains($forbidden, [StringComparison]::OrdinalIgnoreCase)) {
    $failures.Add("Teardown plan contains a forbidden source-bound fragment.")
  }
}
if (-not $raw.Contains($context.tenantId, [StringComparison]::OrdinalIgnoreCase) -or
    -not $raw.Contains($context.subscriptionId, [StringComparison]::OrdinalIgnoreCase)) {
  $failures.Add("Teardown plan lacks exact target tenant/subscription assertions.")
}

$deleted = @()
foreach ($change in @($plan.resource_changes)) {
  $actions = @($change.change.actions)
  if ($change.change.PSObject.Properties.Name -contains "importing" -and $null -ne $change.change.importing) {
    $failures.Add("$($change.address) contains an import action.")
  }
  if ($actions.Count -eq 1 -and $actions[0] -in @("no-op", "read")) { continue }
  if ($actions.Count -ne 1 -or $actions[0] -cne "delete") {
    $failures.Add("$($change.address) is not a delete-only runner change.")
    continue
  }
  if ($change.address -notin $AllowedResourceAddresses) {
    $failures.Add("$($change.address) is not in the exact approved runner teardown allowlist.")
  }
  $deleted += $change.address
}
foreach ($allowed in $AllowedResourceAddresses) {
  if ($allowed -notin $deleted) { $failures.Add("Approved runner resource '$allowed' is absent from the teardown plan.") }
}
if ($failures.Count -gt 0) { throw "Runner teardown plan policy failed: $($failures -join ' ')" }

Write-SafeJson -InputObject ([ordered]@{
    schemaVersion      = 1
    verifiedAtUtc      = (Get-Date).ToUniversalTime().ToString("o")
    target             = $context
    planSha256         = Get-Sha256 -Path $planPath
    deletedAddresses   = @($deleted | Sort-Object)
    sourceRetirement   = $false
    allowlistExact     = $true
  }) -Path $OutputPath
Write-Host "Runner teardown plan contains only the exact allowlisted target runner resources."
