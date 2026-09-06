[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
  [Parameter()][string]$ResourceGroup = "nex-prod-hov-rg",
  [Parameter(Mandatory)][ValidatePattern('^nex-prod-hov-[a-z0-9-]+$')][string]$VaultName,
  [Parameter(Mandatory)][ValidatePattern('^[0-9A-Za-z-]{1,127}$')][string]$SecretName,
  [Parameter(Mandatory)][string]$SecretValueEnvironmentVariable,
  [Parameter(Mandatory)][string]$Confirmation,
  [Parameter()][ValidatePattern('^nex-prod-hov-[a-z0-9-]+$')][string]$WebAppName,
  [Parameter()][ValidatePattern('^[0-9A-Za-z_.]+$')][string]$AppSettingName,
  [Parameter()][string]$OutputPath
)

. "$PSScriptRoot/Common.ps1"

$requiredConfirmation = "SEED-TARGET-SECRET/$VaultName/$SecretName"
if ($Confirmation -cne $requiredConfirmation) {
  throw "Secret-seeding confirmation must exactly equal '$requiredConfirmation'."
}
$context = Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup -RequireResourceGroup
$vaultJson = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
  "keyvault", "show", "--name", $VaultName, "--resource-group", $ResourceGroup,
  "--subscription", $context.subscriptionId,
  "--query", "{id:id,uri:properties.vaultUri,rbac:properties.enableRbacAuthorization,publicNetworkAccess:properties.publicNetworkAccess}",
  "--output", "json", "--only-show-errors"
)
$vault = ($vaultJson -join [Environment]::NewLine) | ConvertFrom-Json
if (-not $vault.rbac -or $vault.publicNetworkAccess -ne "Disabled") {
  throw "Target Key Vault must use RBAC authorization with public network access disabled."
}
$vaultHost = ([uri]$vault.uri).Host
Assert-PrivateEndpointReachability -HostName $vaultHost -Port 443

if (-not $PSCmdlet.ShouldProcess("$VaultName/$SecretName", "Seed a secret from process-only input through the target private endpoint")) {
  return
}

$secretValue = Get-RequiredEnvironmentValue -Name $SecretValueEnvironmentVariable
$token = $null
$body = $null
try {
  $tokenOutput = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
      "account", "get-access-token", "--resource", "https://vault.azure.net",
      "--query", "accessToken", "--output", "tsv", "--only-show-errors"
    )
  $token = ($tokenOutput -join "").Trim()
  $headers = @{ Authorization = "Bearer $token" }
  $body = @{ value = $secretValue; attributes = @{ enabled = $true } } | ConvertTo-Json -Compress
  try {
    Invoke-RestMethod -Method Put -Uri "$($vault.uri)secrets/$SecretName`?api-version=7.4" `
      -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 20 | Out-Null
    $versions = Invoke-RestMethod -Method Get -Uri "$($vault.uri)secrets/$SecretName/versions?api-version=7.4" `
      -Headers $headers -TimeoutSec 20
    if (@($versions.value).Count -lt 1) { throw "metadata verification failed" }
  } catch {
    throw "Target Key Vault secret seed or metadata verification failed; sensitive response details were suppressed."
  }
} finally {
  $secretValue = $null
  $body = $null
  $tokenOutput = $null
  $token = $null
  $headers = $null
  [Environment]::SetEnvironmentVariable($SecretValueEnvironmentVariable, $null, "Process")
}

if ($WebAppName) {
  if (-not $AppSettingName) { throw "AppSettingName is required when WebAppName is supplied." }
  $appId = "/subscriptions/$($context.subscriptionId)/resourceGroups/$ResourceGroup/providers/Microsoft.Web/sites/$WebAppName"
  $null = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "rest", "--method", "post", "--uri", "https://management.azure.com$appId/config/configreferences/appsettings/refresh?api-version=2022-03-01",
    "--output", "none", "--only-show-errors"
  )
  $referenceJson = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "rest", "--method", "get", "--uri", "https://management.azure.com$appId/config/configreferences/appsettings/$AppSettingName`?api-version=2022-03-01",
    "--output", "json", "--only-show-errors"
  )
  $reference = ($referenceJson -join [Environment]::NewLine) | ConvertFrom-Json
  if ($reference.properties.status -cne "Resolved" -or
    $reference.properties.source -cne "KeyVault" -or
    $reference.properties.vaultName -cne $VaultName -or
    $reference.properties.secretName -cne $SecretName) {
    throw "Target App Service Key Vault reference is not resolved."
  }
}
if ($OutputPath) {
  Write-SafeJson -InputObject ([ordered]@{
      schemaVersion       = 1
      completedAtUtc      = (Get-Date).ToUniversalTime().ToString("o")
      vaultName           = $VaultName
      secretName          = $SecretName
      webAppName          = $WebAppName
      appSettingName      = $AppSettingName
      referenceStatus     = if ($WebAppName) { "Resolved" } else { "not-requested" }
      secretValueRecorded = $false
    }) -Path $OutputPath
}
Write-Host "Target Key Vault secret was seeded through the private endpoint and metadata verification passed. The process input was cleared."
