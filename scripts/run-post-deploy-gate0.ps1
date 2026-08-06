[CmdletBinding()]
param(
  [switch]$UseChunkedCookies,
  # Production issues no identity with role=operator, so the denial probe runs as
  # an employee by default. Pass this only when a genuine operator session exists;
  # otherwise the operator scenarios skip rather than silently passing.
  [switch]$IncludeOperator,
  # Opt in to the durable-write acceptance. This APPENDS ONE REAL RECORD to
  # production governance storage, runs only after the read-only probes pass, and
  # asks for the decision plus an explicit WRITE confirmation first.
  [switch]$GovernanceWrite
)

$ErrorActionPreference = "Stop"

$baseUrl = "https://hov.neuralliquid.ai"
$denialRoles = @("EMPLOYEE")
if ($IncludeOperator) {
  $denialRoles += "OPERATOR"
}

$environmentNames = @(
  "BASE_URL",
  "POST_DEPLOY_PROBE",
  "POST_DEPLOY_ADMIN_SESSION",
  "POST_DEPLOY_OPERATOR_SESSION",
  "POST_DEPLOY_EMPLOYEE_SESSION",
  "POST_DEPLOY_ADMIN_SESSION_COOKIES",
  "POST_DEPLOY_OPERATOR_SESSION_COOKIES",
  "POST_DEPLOY_EMPLOYEE_SESSION_COOKIES",
  "POST_DEPLOY_GOVERNANCE_DECISION"
)

function Read-SecretToProcessEnvironment {
  param([Parameter(Mandatory)][string]$Name)

  $secureValue = Read-Host -Prompt "$Name value (input hidden)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  $plainValue = $null

  try {
    $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ([string]::IsNullOrWhiteSpace($plainValue)) {
      throw "$Name must not be blank."
    }

    [Environment]::SetEnvironmentVariable(
      $Name,
      $plainValue,
      "Process"
    )
  } finally {
    $plainValue = $null
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

  $roles = @("ADMIN") + $denialRoles
  $suffix = if ($UseChunkedCookies) { "_COOKIES" } else { "" }
  $unusedSuffix = if ($UseChunkedCookies) { "" } else { "_COOKIES" }

  foreach ($role in $roles) {
    # Clear the form that is not in use so a stale value from a previous shape
    # can never be picked up alongside the one being entered now.
    [Environment]::SetEnvironmentVariable("POST_DEPLOY_${role}_SESSION${unusedSuffix}", $null, "Process")
    Read-SecretToProcessEnvironment "POST_DEPLOY_${role}_SESSION${suffix}"
  }

  Write-Host "Running the production-auth Gate 0 acceptance probe against $baseUrl."
  Write-Host "Denial roles this run: $($denialRoles -join ', '). Any role without a supplied session skips."
  # The production probe policy disables retries, traces, and screenshots. Use
  # a console-only reporter as a second boundary so no HTML report is retained.
  & pnpm run test:e2e:post-deploy-gate0 -- --reporter=line
  $exitCode = $LASTEXITCODE

  if ($GovernanceWrite) {
    if ($exitCode -ne 0) {
      Write-Host "Read-only acceptance failed. Refusing to run the mutating governance write." -ForegroundColor Yellow
    } else {
      # Governance content is not a secret — it is recorded verbatim in an
      # append-only production record — so it is echoed back for confirmation
      # before anything is written.
      Write-Host ""
      Write-Host "The next step APPENDS ONE REAL RECORD to production governance storage." -ForegroundColor Yellow
      Write-Host 'Supply the decision as JSON, e.g.' -ForegroundColor Yellow
      Write-Host '  {"decisionId":"O1","status":"approved_in_principle","rationale":"Owner accepted ...","evidenceRefs":[]}'
      $decision = Read-Host -Prompt "POST_DEPLOY_GOVERNANCE_DECISION"

      if ([string]::IsNullOrWhiteSpace($decision)) {
        Write-Host "No decision supplied; skipping the governance write." -ForegroundColor Yellow
      } else {
        Write-Host ""
        Write-Host "About to write: $decision"
        $confirm = Read-Host -Prompt "Type WRITE to confirm"
        if ($confirm -ceq "WRITE") {
          [Environment]::SetEnvironmentVariable("POST_DEPLOY_GOVERNANCE_DECISION", $decision, "Process")
          & pnpm run test:e2e:post-deploy-governance-write -- --reporter=line
          $exitCode = $LASTEXITCODE
        } else {
          Write-Host "Not confirmed; nothing was written." -ForegroundColor Yellow
        }
      }
    }
  }
} finally {
  foreach ($name in $environmentNames) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], "Process")
  }
}

exit $exitCode
