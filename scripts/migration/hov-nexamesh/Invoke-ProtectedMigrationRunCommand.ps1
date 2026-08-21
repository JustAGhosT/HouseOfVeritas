[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
  [Parameter()][string]$ResourceGroup = "nex-prod-hov-rg",
  [Parameter(Mandatory)][ValidatePattern('^nex-prod-hov-[a-z0-9-]+$')][string]$VmName,
  [Parameter(Mandatory)][ValidatePattern('^hov-migration-[a-z0-9-]+$')][string]$RunCommandName,
  [Parameter(Mandatory)][string]$ScriptPath,
  [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedScriptSha256,
  [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$ExpectedImagePublisher,
  [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$ExpectedImageOffer,
  [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$ExpectedImageSku,
  [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$ExpectedImageVersion,
  [Parameter()][ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+$')][string]$ExpectedPowerShellVersion = "7.6.5",
  [Parameter()][ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+$')][string]$ExpectedAzureCliVersion = "2.89.1",
  [Parameter()][ValidatePattern('^[0-9]+\.[0-9]+$')][string]$ExpectedPostgresClientVersion = "16.15",
  [Parameter()][ValidatePattern('^v[0-9]+\.[0-9]+\.[0-9]+$')][string]$ExpectedNodeVersion = "v22.23.2",
  [Parameter()][ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+$')][string]$ExpectedAzCopyVersion = "10.32.6",
  [Parameter()][string[]]$RequiredCommands = @(),
  [Parameter()][hashtable]$Parameters = @{},
  [Parameter()][hashtable]$ProtectedParameterBindings = @{},
  [Parameter(Mandatory)][string]$OutputPath,
  [Parameter(Mandatory)][string]$Confirmation,
  [ValidateRange(300, 14400)][int]$TimeoutSeconds = 7200
)

. "$PSScriptRoot/Common.ps1"

function Get-StringSha256 {
  [CmdletBinding()]
  param([Parameter(Mandatory)][string]$Value)

  $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
  try {
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
  } finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
}

$requiredConfirmation = "RUN-MIGRATION-COMMAND/$VmName/$RunCommandName"
if ($Confirmation -cne $requiredConfirmation) {
  throw "Run-command confirmation must exactly equal '$requiredConfirmation'."
}
$context = Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup -RequireResourceGroup
$environmentNamePattern = '^[A-Za-z_][A-Za-z0-9_]*$'
$sensitiveNamePattern = '(?i)(password|secret|token|credential|connection|string|dsn|uri|key)'

$publicParameterNames = @($Parameters.Keys | ForEach-Object { [string]$_ } | Sort-Object -Unique)
$protectedParameterNames = @($ProtectedParameterBindings.Keys | ForEach-Object { [string]$_ } | Sort-Object -Unique)
foreach ($name in @($publicParameterNames + $protectedParameterNames)) {
  if ($name -cnotmatch $environmentNamePattern) {
    throw "Managed Run Command parameter names must be safe process-environment names."
  }
}
if (@($publicParameterNames | Where-Object { $_ -match $sensitiveNamePattern }).Count -gt 0) {
  throw "Sensitive-looking Run Command parameters must use ProtectedParameterBindings, never public Parameters."
}
if (@($publicParameterNames | Where-Object { $protectedParameterNames -ccontains $_ }).Count -gt 0) {
  throw "A Run Command parameter name cannot be both public and protected."
}
foreach ($environmentName in $ProtectedParameterBindings.Values) {
  if ([string]$environmentName -cnotmatch $environmentNamePattern) {
    throw "ProtectedParameterBindings values must name safe local process-environment variables."
  }
}

$coreCommands = @("az", "azcopy", "base64", "cat", "jq", "mktemp", "node", "psql", "pwsh", "sha256sum", "stat")
$allRequiredCommands = @($coreCommands + $RequiredCommands | Sort-Object -Unique)
foreach ($commandName in $allRequiredCommands) {
  if ($commandName -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._+-]*$') {
    throw "RequiredCommands must contain executable names, not paths or shell expressions."
  }
}

$scriptFile = (Resolve-Path -LiteralPath $ScriptPath).Path
$scriptHash = Get-Sha256 -Path $scriptFile
if ($scriptHash -cne $ExpectedScriptSha256.ToLowerInvariant()) {
  throw "Managed Run Command script hash does not match the separately reviewed digest."
}
$payloadBytes = [IO.File]::ReadAllBytes($scriptFile)
try {
  $payloadBase64 = [Convert]::ToBase64String($payloadBytes)
} finally {
  [Array]::Clear($payloadBytes, 0, $payloadBytes.Length)
}

$vmJson = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
  "vm", "show", "--name", $VmName, "--resource-group", $ResourceGroup,
  "--subscription", $context.subscriptionId, "--show-details",
  "--query", "{id:id,location:location,powerState:powerState,publicIps:publicIps,osType:storageProfile.osDisk.osType,imagePublisher:storageProfile.imageReference.publisher,imageOffer:storageProfile.imageReference.offer,imageSku:storageProfile.imageReference.sku,imageVersion:storageProfile.imageReference.exactVersion,identityType:identity.type,principalId:identity.principalId}",
  "--output", "json", "--only-show-errors"
)
$vm = ($vmJson -join [Environment]::NewLine) | ConvertFrom-Json
if ($vm.location -cne "southafricanorth") {
  throw "Migration VM must be in the asserted target region."
}
if ($vm.osType -cne "Linux" -or $vm.powerState -cne "VM running") {
  throw "Migration VM must be a running Linux VM."
}
if ($vm.imagePublisher -cne $ExpectedImagePublisher -or
  $vm.imageOffer -cne $ExpectedImageOffer -or
  $vm.imageSku -cne $ExpectedImageSku -or
  $vm.imageVersion -cne $ExpectedImageVersion) {
  throw "Migration VM image does not match the separately reviewed publisher, offer, SKU and version."
}
if (-not [string]::IsNullOrWhiteSpace([string]$vm.publicIps)) {
  throw "Migration VM has a public IP. Refusing protected migration execution."
}
if ([string]::IsNullOrWhiteSpace([string]$vm.principalId) -or [string]$vm.identityType -notmatch "SystemAssigned") {
  throw "Migration VM must have a system-assigned managed identity."
}

$publicNamesLiteral = if ($publicParameterNames.Count -eq 0) {
  '@()'
} else {
  '@(' + (($publicParameterNames | ForEach-Object { "'$_'" }) -join ', ') + ')'
}
$launcher = @'
param([Parameter(Mandatory)][string]$PayloadPath)
$ErrorActionPreference = "Stop"
$allowedPublicParameterNames = __PUBLIC_PARAMETER_NAMES__
$payloadArguments = @{}
try {
  foreach ($name in $allowedPublicParameterNames) {
    $value = [Environment]::GetEnvironmentVariable($name, "Process")
    if ($null -eq $value) { exit 21 }
    $payloadArguments[$name] = $value
  }
  & $PayloadPath @payloadArguments *> $null
  if (-not $?) { exit 22 }
  exit 0
} catch {
  exit 23
} finally {
  foreach ($name in $allowedPublicParameterNames) {
    [Environment]::SetEnvironmentVariable($name, $null, "Process")
  }
  $payloadArguments.Clear()
}
'@.Replace('__PUBLIC_PARAMETER_NAMES__', $publicNamesLiteral)
$launcherBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($launcher))

$requiredCommandLines = ($allRequiredCommands | ForEach-Object { "  '$_'" }) -join "`n"
$protectedNameLines = ($protectedParameterNames | ForEach-Object { "  '$_'" }) -join "`n"
$wrapper = @'
#!/usr/bin/env bash
set -uo pipefail
umask 077

exec 3>&1 4>&2
temporary_directory=''
wrapper_path="$0"
protected_environment_names=(
__PROTECTED_ENVIRONMENT_NAMES__
)
required_commands=(
__REQUIRED_COMMANDS__
)
expected_pwsh_version='__EXPECTED_PWSH_VERSION__'
expected_azure_cli_version='__EXPECTED_AZURE_CLI_VERSION__'
expected_psql_version='__EXPECTED_PSQL_VERSION__'
expected_node_version='__EXPECTED_NODE_VERSION__'
expected_azcopy_version='__EXPECTED_AZCOPY_VERSION__'

cleanup() {
  local name
  for name in "${protected_environment_names[@]}"; do
    unset "$name" || true
  done
  if [[ -n "$temporary_directory" && "$temporary_directory" == /tmp/* ]]; then
    rm -rf -- "$temporary_directory" >/dev/null 2>&1 || true
  fi
  case "$wrapper_path" in
    /var/lib/waagent/*|/tmp/*) rm -f -- "$wrapper_path" >/dev/null 2>&1 || true ;;
  esac
  unset payload_base64 launcher_base64 expected_payload_sha256 temporary_directory
}

migration_main() {
  local command_name payload_path launcher_path payload_stdout payload_stderr actual_payload_sha256 sha256_output tooling_readiness_path
  for command_name in "${required_commands[@]}"; do
    command -v -- "$command_name" >/dev/null 2>&1 || return 31
  done
  tooling_readiness_path='/var/lib/hov-migration/tooling-ready.json'
  [[ -f "$tooling_readiness_path" ]] || return 32
  [[ "$(stat --format '%U:%G:%a' "$tooling_readiness_path")" == 'root:root:640' ]] || return 33
  jq --exit-status \
    --arg boot_id "$(cat /proc/sys/kernel/random/boot_id)" \
    --arg pwsh "$expected_pwsh_version" \
    --arg azure_cli "$expected_azure_cli_version" \
    --arg psql "$expected_psql_version" \
    --arg node "$expected_node_version" \
    --arg azcopy "$expected_azcopy_version" \
    '.status == "ready" and .reboot_required == false and .boot_id == $boot_id and
     .versions.pwsh == $pwsh and .versions.azure_cli == $azure_cli and
     (.versions.psql | contains($psql)) and .versions.node == $node and
     (.versions.azcopy | contains($azcopy))' "$tooling_readiness_path" >/dev/null 2>&1 || return 34

  [[ "$(pwsh -NoLogo -NoProfile -NonInteractive -Command '$PSVersionTable.PSVersion.ToString()' 2>/dev/null)" == "$expected_pwsh_version" ]] || return 35
  [[ "$(az version --output json 2>/dev/null | jq --raw-output '."azure-cli"')" == "$expected_azure_cli_version" ]] || return 36
  [[ "$(node --version 2>/dev/null)" == "$expected_node_version" ]] || return 37
  [[ "$(psql --version 2>/dev/null)" == *" $expected_psql_version"* ]] || return 38
  [[ "$(azcopy --version 2>/dev/null)" == *"$expected_azcopy_version"* ]] || return 39

  temporary_directory="$(mktemp -d /tmp/hov-migration-run-command.XXXXXXXX)" || return 40
  chmod 700 "$temporary_directory" || return 41
  payload_path="$temporary_directory/payload.ps1"
  launcher_path="$temporary_directory/launcher.ps1"
  payload_stdout="$temporary_directory/payload.stdout"
  payload_stderr="$temporary_directory/payload.stderr"
  payload_base64='__PAYLOAD_BASE64__'
  launcher_base64='__LAUNCHER_BASE64__'
  expected_payload_sha256='__PAYLOAD_SHA256__'

  printf '%s' "$payload_base64" | base64 --decode > "$payload_path" || return 42
  printf '%s' "$launcher_base64" | base64 --decode > "$launcher_path" || return 43
  chmod 600 "$payload_path" "$launcher_path" || return 44
  sha256_output="$(sha256sum "$payload_path")" || return 45
  actual_payload_sha256="${sha256_output%% *}"
  [[ "$actual_payload_sha256" == "$expected_payload_sha256" ]] || return 46

  pwsh -NoLogo -NoProfile -NonInteractive -File "$launcher_path" "$payload_path" \
    >"$payload_stdout" 2>"$payload_stderr" || return 47
}

set +e
migration_main >/dev/null 2>&1
status=$?
set -e
cleanup
if [[ $status -eq 0 ]]; then
  printf '%s\n' 'reviewed migration payload succeeded; payload output was not recorded' >&3
else
  printf '%s\n' 'reviewed migration payload failed; payload output was not recorded' >&4
fi
exit "$status"
'@
$wrapper = $wrapper.Replace('__PROTECTED_ENVIRONMENT_NAMES__', $protectedNameLines).
  Replace('__REQUIRED_COMMANDS__', $requiredCommandLines).
  Replace('__EXPECTED_PWSH_VERSION__', $ExpectedPowerShellVersion).
  Replace('__EXPECTED_AZURE_CLI_VERSION__', $ExpectedAzureCliVersion).
  Replace('__EXPECTED_PSQL_VERSION__', $ExpectedPostgresClientVersion).
  Replace('__EXPECTED_NODE_VERSION__', $ExpectedNodeVersion).
  Replace('__EXPECTED_AZCOPY_VERSION__', $ExpectedAzCopyVersion).
  Replace('__PAYLOAD_BASE64__', $payloadBase64).
  Replace('__LAUNCHER_BASE64__', $launcherBase64).
  Replace('__PAYLOAD_SHA256__', $scriptHash)
$wrapperHash = Get-StringSha256 -Value $wrapper

$publicParameters = foreach ($entry in $Parameters.GetEnumerator()) {
  [ordered]@{ name = [string]$entry.Key; value = [string]$entry.Value }
}
$protectedParameters = @()
$body = $null
$token = $null
$response = $null
try {
  if (-not $PSCmdlet.ShouldProcess("$ResourceGroup/$VmName", "Execute reviewed PowerShell payload through a verified Linux Managed Run Command wrapper")) {
    return
  }
  foreach ($entry in $ProtectedParameterBindings.GetEnumerator()) {
    $protectedParameters += [ordered]@{
      name  = [string]$entry.Key
      value = Get-RequiredEnvironmentValue -Name ([string]$entry.Value)
    }
  }

  $token = (Invoke-NativeCommand -FilePath "az" -ArgumentList @(
      "account", "get-access-token", "--resource", "https://management.azure.com/",
      "--query", "accessToken", "--output", "tsv", "--only-show-errors"
    ) -join "").Trim()
  $body = [ordered]@{
    location   = $vm.location
    properties = [ordered]@{
      source              = @{ script = $wrapper }
      parameters          = @($publicParameters)
      protectedParameters = @($protectedParameters)
      asyncExecution      = $false
      timeoutInSeconds    = $TimeoutSeconds
      treatFailureAsDeploymentFailure = $true
    }
  } | ConvertTo-Json -Depth 20 -Compress
  $uri = "https://management.azure.com$($vm.id)/runCommands/$RunCommandName`?api-version=2024-07-01"
  try {
    $response = Invoke-RestMethod -Method Put -Uri $uri -Headers @{ Authorization = "Bearer $token" } `
      -ContentType "application/json" -Body $body -TimeoutSec ($TimeoutSeconds + 60)
  } catch {
    throw "Managed Run Command failed; response details were suppressed because protected operations must not enter general logs."
  }
  $pollDeadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds + 60)
  while ($response.properties.provisioningState -notin @("Succeeded", "Failed", "Canceled")) {
    if ([DateTime]::UtcNow -ge $pollDeadline) {
      throw "Managed Run Command did not reach a terminal state before the approved timeout."
    }
    Start-Sleep -Seconds 5
    try {
      $response = Invoke-RestMethod -Method Get -Uri $uri -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 30
    } catch {
      throw "Managed Run Command status polling failed; response details were suppressed because protected operations must not enter general logs."
    }
  }
  if ($response.properties.provisioningState -cne "Succeeded") {
    throw "Managed Run Command did not reach Succeeded state."
  }

  Write-SafeJson -InputObject ([ordered]@{
      schemaVersion           = 2
      completedAtUtc          = (Get-Date).ToUniversalTime().ToString("o")
      target                  = $context
      vmName                  = $VmName
      vmPrincipalId           = $vm.principalId
      vmImage                 = [ordered]@{
        publisher = $vm.imagePublisher
        offer     = $vm.imageOffer
        sku       = $vm.imageSku
        version   = $vm.imageVersion
      }
      requiredCommands        = $allRequiredCommands
      expectedToolVersions    = [ordered]@{
        powershell = $ExpectedPowerShellVersion
        azureCli   = $ExpectedAzureCliVersion
        postgres   = $ExpectedPostgresClientVersion
        node       = $ExpectedNodeVersion
        azcopy     = $ExpectedAzCopyVersion
      }
      runCommandName          = $RunCommandName
      payloadSha256           = $scriptHash
      linuxWrapperSha256      = $wrapperHash
      publicParameterNames    = $publicParameterNames
      protectedParameterNames = $protectedParameterNames
      protectedValuesRecorded = $false
      payloadStdoutRecorded   = $false
      payloadStderrRecorded   = $false
      provisioningState       = "Succeeded"
    }) -Path $OutputPath
} finally {
  foreach ($environmentName in $ProtectedParameterBindings.Values) {
    [Environment]::SetEnvironmentVariable([string]$environmentName, $null, "Process")
  }
  $protectedParameters = $null
  $payloadBase64 = $null
  $launcherBase64 = $null
  $wrapper = $null
  $body = $null
  $token = $null
  $response = $null
}
Write-Host "Managed Run Command succeeded. Payload output and protected values were not recorded."
