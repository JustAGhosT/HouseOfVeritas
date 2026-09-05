import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n")
}

const runtimeMain = read("terraform/migrations/hov-nexamesh/runtime/main.tf")
const runtimeVariables = read("terraform/migrations/hov-nexamesh/runtime/variables.tf")
const productionVariables = read("terraform/environments/production/variables.tf")
const environmentExample = read(".env.example")
const migrationWorkflow = read(".github/workflows/hov-nexamesh-migration.yml")
const migrationRunnerVariables = read("terraform/migrations/hov-nexamesh/migration-runner/variables.tf")
const identitySettings = runtimeMain.match(
  /identity_cutover_app_settings = var\.identity_cutover_approved \? \{([\s\S]*?)\n  \} : \{\}/
)?.[1]
const strictOpenSshPublicKey = /^(ssh-(rsa|ed25519)|ecdsa-sha2-nistp(256|384|521))\s+([A-Za-z0-9+/]{4}){8,}([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?(\s+\S.*)?$/

describe("HOV NexaMesh runtime authentication contract", () => {
  it("pins the browser-facing OIDC endpoints to the NexaMesh login host", () => {
    expect(runtimeVariables).toContain(
      'default     = "https://login.hov.nexamesh.ai/connect/authorize"'
    )
    expect(runtimeVariables).toContain(
      'default     = "https://login.hov.nexamesh.ai/connect/endsession"'
    )
    expect(runtimeVariables).not.toContain("login.hov.neuralliquid.ai")
    expect(productionVariables).toContain(
      'default     = "https://login.hov.nexamesh.ai/connect/authorize"'
    )
    expect(productionVariables).toContain(
      'default     = "https://login.hov.nexamesh.ai/connect/endsession"'
    )
    expect(productionVariables).not.toContain("login.hov.neuralliquid.ai")
    expect(environmentExample).toContain(
      "MYSTIRA_OIDC_AUTHORIZATION_ENDPOINT=https://login.hov.nexamesh.ai/connect/authorize"
    )
    expect(environmentExample).toContain(
      "MYSTIRA_OIDC_END_SESSION_ENDPOINT=https://login.hov.nexamesh.ai/connect/endsession"
    )
    expect(environmentExample).not.toContain("login.hov.neuralliquid.ai")
  })

  it("emits both browser endpoints only with the gated identity settings", () => {
    expect(identitySettings).toContain(
      "MYSTIRA_OIDC_AUTHORIZATION_ENDPOINT = var.mystira_oidc_authorization_endpoint"
    )
    expect(identitySettings).toContain(
      "MYSTIRA_OIDC_END_SESSION_ENDPOINT   = var.mystira_oidc_end_session_endpoint"
    )
  })

  it("suppresses App Service setting values in Terraform plan and apply logs", () => {
    expect(runtimeMain).toContain("app_settings = sensitive(merge({")
    expect(runtimeMain).toContain(
      "}, local.key_vault_app_settings, local.identity_cutover_app_settings))"
    )
  })

  it("rejects resource creation during an approved runtime identity cutover", () => {
    expect(migrationWorkflow).toContain(
      '((.change.actions == ["create"]) and\n' +
        '               ($root != "runtime" or $identity_cutover_approved != true))'
    )
    expect(migrationWorkflow).toContain("def runtime_oidc_only:")
    expect(migrationWorkflow).toContain("(.change.before | del(.app_settings)) == (.change.after | del(.app_settings))")
    expect(migrationWorkflow).toContain('.change.actions == ["update"] and')
    expect(migrationWorkflow).toContain("MYSTIRA_OIDC_AUTHORIZATION_ENDPOINT")
    expect(migrationWorkflow).toContain("MYSTIRA_OIDC_END_SESSION_ENDPOINT")
  })

  it("fails an approved cutover if either endpoint regresses from NexaMesh", () => {
    expect(runtimeMain).toContain(
      'var.mystira_oidc_authorization_endpoint == "https://login.hov.nexamesh.ai/connect/authorize"'
    )
    expect(runtimeMain).toContain(
      'var.mystira_oidc_end_session_endpoint == "https://login.hov.nexamesh.ai/connect/endsession"'
    )
    expect(productionVariables).toContain(
      'condition     = var.mystira_oidc_authorization_endpoint == "https://login.hov.nexamesh.ai/connect/authorize"'
    )
    expect(productionVariables).toContain(
      'condition     = var.mystira_oidc_end_session_endpoint == "https://login.hov.nexamesh.ai/connect/endsession"'
    )
  })

  it("provides reviewed non-secret identity defaults when environment variables are absent", () => {
    expect(migrationWorkflow).toContain(
      "TF_VAR_mystira_oidc_issuer: ${{ vars.HOV_MYSTIRA_OIDC_ISSUER || 'https://identity.mystira.app/' }}"
    )
    expect(migrationWorkflow).toContain(
      "TF_VAR_mystira_oidc_client_id: ${{ vars.HOV_MYSTIRA_OIDC_CLIENT_ID || 'neuralliquid-hov-web' }}"
    )
    expect(migrationWorkflow).toContain(
      "TF_VAR_mystira_oidc_client_secret_name: ${{ vars.HOV_MYSTIRA_OIDC_CLIENT_SECRET_NAME || 'mystira-oidc-client-secret' }}"
    )
    expect(migrationWorkflow).toContain(
      "TF_VAR_auth_url: ${{ vars.HOV_AUTH_URL || 'https://hov.nexamesh.ai' }}"
    )
  })

  it("requires a non-secret break-glass key only when planning the private migration runner", () => {
    expect(migrationWorkflow).toContain(
      "TF_VAR_admin_ssh_public_key: ${{ vars.HOV_MIGRATION_RUNNER_ADMIN_SSH_PUBLIC_KEY }}"
    )
    expect(migrationWorkflow).toContain('if [ "$INPUT_ROOT" = migration-runner ]; then')
    expect(migrationWorkflow).toContain('test -n "${TF_VAR_admin_ssh_public_key:-}"')
    expect(migrationWorkflow).toContain("([A-Za-z0-9+/]{4}){8,}")
    expect(strictOpenSshPublicKey.test(`ssh-ed25519 ${"A".repeat(32)}`)).toBe(true)
    expect(strictOpenSshPublicKey.test("ssh-ed25519")).toBe(false)
    expect(strictOpenSshPublicKey.test("ssh-ed25519 x")).toBe(false)
  })

  it("pins the reviewed migration runner retry SKU", () => {
    expect(migrationRunnerVariables).toContain('default     = "Standard_B2als_v2"')
    expect(migrationRunnerVariables).toContain('condition     = var.vm_size == "Standard_B2als_v2"')
  })
})
