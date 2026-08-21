[CmdletBinding()]
param(
  [Parameter()][string]$ResourceGroup = "nex-prod-hov-rg",
  [Parameter(Mandatory)][string]$PlanJsonPath,
  [Parameter(Mandatory)][string]$OutputPath
)

. "$PSScriptRoot/Common.ps1"

$context = Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup
$planPath = (Resolve-Path -LiteralPath $PlanJsonPath).Path
$planRaw = Get-Content -LiteralPath $planPath -Raw
$plan = $planRaw | ConvertFrom-Json -Depth 100
$failures = [Collections.Generic.List[string]]::new()

$forbiddenFragments = [ordered]@{
  "source tenant ID"       = "9530cd32-9e33-47f0-9247-ed964730b580"
  "source subscription ID" = "bb4e3882-2079-4bab-8974-611bc0b8bb58"
  "source resource name"    = "nl-prod-"
  "source canonical state"  = "production-canonical.terraform.tfstate"
}
foreach ($entry in $forbiddenFragments.GetEnumerator()) {
  if ($planRaw.Contains($entry.Value, [StringComparison]::OrdinalIgnoreCase)) {
    $failures.Add("Plan contains forbidden $($entry.Key).")
  }
}
if (-not $planRaw.Contains($context.tenantId, [StringComparison]::OrdinalIgnoreCase)) {
  $failures.Add("Plan does not contain the exact target tenant assertion.")
}
if (-not $planRaw.Contains($context.subscriptionId, [StringComparison]::OrdinalIgnoreCase)) {
  $failures.Add("Plan does not contain the exact target subscription assertion.")
}

$summary = [ordered]@{ create = 0; update = 0; noOp = 0; read = 0 }
foreach ($change in @($plan.resource_changes)) {
  $actions = @($change.change.actions)
  if ($actions -contains "delete") {
    $failures.Add("$($change.address) contains a destroy or replacement action.")
  }
  if ($actions -contains "update") {
    $failures.Add("$($change.address) contains an update; migration target plans must be create-only apart from reads/no-ops.")
  }
  if ($change.change.PSObject.Properties.Name -contains "importing" -and $null -ne $change.change.importing) {
    $failures.Add("$($change.address) contains an import action.")
  }
  if ($actions.Count -eq 1) {
    switch ($actions[0]) {
      "create" { $summary.create++ }
      "update" { $summary.update++ }
      "no-op" { $summary.noOp++ }
      "read" { $summary.read++ }
    }
  }

  $after = $change.change.after
  if ($null -ne $after -and $after.PSObject.Properties.Name -contains "resource_group_name") {
    $plannedResourceGroup = [string]$after.resource_group_name
    if ($plannedResourceGroup -and $plannedResourceGroup -notmatch '^nex-prod-hov(?:-tfstate)?-rg$') {
      $failures.Add("$($change.address) targets non-HOV resource group '$plannedResourceGroup'.")
    }
  }
  if ($change.type -eq "azurerm_role_assignment" -and $null -ne $after) {
    $scope = [string]$after.scope
    if ($scope -and -not $scope.Contains($context.subscriptionId, [StringComparison]::OrdinalIgnoreCase)) {
      $failures.Add("$($change.address) has a role-assignment scope outside nexamesh-sub.")
    }
    if ($scope -and $scope -match '/resourceGroups/([^/]+)' -and $Matches[1] -notmatch '^nex-prod-hov(?:-tfstate)?-rg$') {
      $failures.Add("$($change.address) has a cross-product resource-group role assignment.")
    }
  }
}

if ($summary.create -lt 1) {
  $failures.Add("Plan contains no target resource creates.")
}

if ($failures.Count -gt 0) {
  throw "Target Terraform plan policy failed: $($failures -join ' ')"
}

Write-SafeJson -InputObject ([ordered]@{
    schemaVersion  = 1
    verifiedAtUtc  = (Get-Date).ToUniversalTime().ToString("o")
    target         = $context
    planSha256     = Get-Sha256 -Path $planPath
    planLength     = (Get-Item -LiteralPath $planPath).Length
    actionSummary  = $summary
    policy         = @(
      "exact target tenant and subscription assertions present",
      "no source IDs, nl-prod names, source state key, imports, destroys, replacements, or cross-product role assignments"
    )
    planContentWasCopiedToEvidence = $false
  }) -Path $OutputPath
Write-Host "Target Terraform plan passed fail-closed migration policy. Only its digest and action counts were recorded."
