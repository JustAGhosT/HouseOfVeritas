import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const runCommand = readFileSync(
  resolve(process.cwd(), "scripts/migration/hov-nexamesh/Invoke-ProtectedMigrationRunCommand.ps1"),
  "utf8"
).replace(/\r\n/g, "\n")

const runnerReadme = readFileSync(
  resolve(process.cwd(), "terraform/migrations/hov-nexamesh/migration-runner/README.md"),
  "utf8"
).replace(/\r\n/g, "\n")

const keyVaultSecretPayload = readFileSync(
  resolve(process.cwd(), "scripts/migration/hov-nexamesh/Set-TargetKeyVaultSecret.ps1"),
  "utf8"
).replace(/\r\n/g, "\n")

describe("HOV protected migration Run Command contract", () => {
  it("uses a cleanup-bound POSIX launcher without recording protected payload output", () => {
    expect(runCommand).toContain("#!/usr/bin/env bash")
    expect(runCommand).toContain('$wrapper = $wrapper.Replace("`r`n", "`n")')
    expect(runCommand).toContain("umask 077")
    expect(runCommand).toContain("mktemp -d /tmp/hov-migration-run-command.XXXXXXXX")
    expect(runCommand).toContain('chmod 700 "$temporary_directory"')
    expect(runCommand).toContain('export AZURE_CONFIG_DIR="$temporary_directory/.azure"')
    expect(runCommand).toContain(
      "az login --identity --allow-no-subscriptions --output none --only-show-errors"
    )
    expect(runCommand).toContain(
      'az account set --subscription "$expected_target_subscription" --only-show-errors'
    )
    expect(runCommand).toContain("expected_target_subscription='__EXPECTED_TARGET_SUBSCRIPTION__'")
    expect(runCommand).toContain("Replace('__EXPECTED_TARGET_SUBSCRIPTION__', $context.subscriptionId)")
    expect(runCommand).toContain('common_path="$temporary_directory/Common.ps1"')
    expect(runCommand).toContain('chmod 600 "$payload_path" "$common_path" "$launcher_path"')
    expect(runCommand).toContain('[[ "$actual_common_sha256" == "$expected_common_sha256" ]]')
    expect(runCommand).toContain("Managed Run Command Common.ps1 hash does not match")
    expect(runCommand).toContain(
      '/usr/bin/pwsh -NoLogo -NoProfile -NonInteractive -File "$launcher_path" "$payload_path"'
    )
    expect(runCommand).toContain('$ConfirmPreference = "None"')
    expect(runCommand).toContain('"HOV_SAFE_STAGE/key-vault-write" = 66')
    expect(runCommand).toContain('$safeExitCode = $safeStageExitCodes[[string]$_.Exception.Message]')
    expect(runCommand).toContain('& $PayloadPath @payloadArguments *> $null')
    expect(runCommand).not.toContain('@payloadArguments -Confirm:$false')
    expect(runCommand).toContain(
      '$publicParameterNames -contains "Confirm" -or $publicParameterNames -contains "cf"'
    )
    expect(runCommand).toContain('throw "Confirm and cf are reserved by the protected launcher."')
    expect(runCommand).toContain("$_ -match '(?i)EnvironmentVariable$'")
    expect(runCommand).toContain(
      "$referencedEnvironmentName -notin $protectedParameterNames"
    )
    expect(runCommand).toContain(
      "Environment-variable reference parameters must name a bound protected parameter."
    )
    expect(runCommand).toContain("$PublicMetadataParameterNames")
    expect(runCommand).toContain("$name -notin $publicParameterNames")
    expect(runCommand).toContain("[string]$Parameters[$name] -cnotmatch $metadataValuePattern")
    expect(runCommand).toContain(
      "Allowed public metadata parameters must exist and contain only a bounded resource identifier."
    )
    expect(runCommand).toContain('$_ -notin $environmentReferenceParameterNames')
    expect(runCommand).toContain('$_ -notin $publicMetadataNames')
    expect(runCommand).toContain('$token = ($tokenOutput -join "").Trim()')
    expect(runCommand).not.toContain(') -join "").Trim()')
    expect(keyVaultSecretPayload).toContain('$token = ($tokenOutput -join "").Trim()')
    expect(keyVaultSecretPayload).not.toContain(') -join "").Trim()')
    expect(keyVaultSecretPayload).toContain('$reference.properties.status -cne "Resolved"')
    expect(keyVaultSecretPayload).not.toContain('$reference.properties.source -cne "KeyVault"')
    expect(keyVaultSecretPayload).toContain('$operationStage = "key-vault-write"')
    expect(keyVaultSecretPayload).toContain('throw "HOV_SAFE_STAGE/$operationStage"')
    expect(keyVaultSecretPayload).toContain(
      "Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup"
    )
    expect(keyVaultSecretPayload).not.toContain(
      "Assert-AzureBoundary -Boundary Target -ResourceGroup $ResourceGroup -RequireResourceGroup"
    )
    expect(runCommand).toContain('unset "$name" || true')
    expect(runCommand).toContain("expected_target_subscription AZURE_CONFIG_DIR temporary_directory")
    expect(runCommand).toContain('rm -rf -- "$temporary_directory"')
    expect(runCommand).toContain("trap cleanup EXIT")
    expect(runCommand).toContain("trap 'exit 129' HUP")
    expect(runCommand).toContain("trap 'exit 130' INT")
    expect(runCommand).toContain("trap 'exit 143' TERM")
    expect(runCommand).toContain("local payload_status=$?")
    expect(runCommand).toContain('return "$payload_status"')
    expect(runCommand).not.toContain('2>"$payload_stderr" || return 47')
    expect(runCommand).toContain("set +e\nmigration_main >/dev/null 2>&1\nstatus=$?\nset -e")
    expect(runCommand).toContain('exit "$status"')
    expect(runCommand).toContain("payload output was not recorded")
    expect(runCommand).toContain("protectedValuesRecorded = $false")
    expect(runCommand).toContain("commonSha256            = $commonHash")
    expect(runnerReadme).toContain(
      "launcher makes protected Run Command execution technically available"
    )
    expect(runnerReadme).toContain("mode-0600 files inside a mode-0700 temporary directory")
    expect(runnerReadme).not.toContain("protected migration\ncommand gate remains blocked")
  })
})
