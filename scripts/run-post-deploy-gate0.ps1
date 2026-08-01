[CmdletBinding()]
param(
  [switch]$UseChunkedCookies
)

$ErrorActionPreference = "Stop"

$baseUrl = "https://hov.neuralliquid.ai"
$environmentNames = @(
  "BASE_URL",
  "POST_DEPLOY_PROBE",
  "POST_DEPLOY_ADMIN_SESSION",
  "POST_DEPLOY_OPERATOR_SESSION",
  "POST_DEPLOY_ADMIN_SESSION_COOKIES",
  "POST_DEPLOY_OPERATOR_SESSION_COOKIES"
)

function Read-SecretToProcessEnvironment {
  param([Parameter(Mandatory)][string]$Name)

  $secureValue = Read-Host -Prompt "$Name value (input hidden)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)

  try {
    [Environment]::SetEnvironmentVariable(
      $Name,
      [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr),
      "Process"
    )
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

# Preserve the caller's process state so running this script never persists or
# exposes a session outside this one PowerShell invocation.
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
  $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

$exitCode = 1

try {
  [Environment]::SetEnvironmentVariable("BASE_URL", $baseUrl, "Process")
  [Environment]::SetEnvironmentVariable("POST_DEPLOY_PROBE", "true", "Process")

  if ($UseChunkedCookies) {
    Read-SecretToProcessEnvironment "POST_DEPLOY_ADMIN_SESSION_COOKIES"
    Read-SecretToProcessEnvironment "POST_DEPLOY_OPERATOR_SESSION_COOKIES"
  } else {
    Read-SecretToProcessEnvironment "POST_DEPLOY_ADMIN_SESSION"
    Read-SecretToProcessEnvironment "POST_DEPLOY_OPERATOR_SESSION"
  }

  Write-Host "Running the production-auth Gate 0 acceptance probe against $baseUrl."
  # The production probe policy disables retries, traces, and screenshots. Use
  # a console-only reporter as a second boundary so no HTML report is retained.
  & pnpm run test:e2e:post-deploy-gate0 -- --reporter=line
  $exitCode = $LASTEXITCODE
} finally {
  foreach ($name in $environmentNames) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], "Process")
  }
}

exit $exitCode
