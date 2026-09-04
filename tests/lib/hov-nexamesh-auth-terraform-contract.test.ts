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
const identitySettings = runtimeMain.match(
  /identity_cutover_app_settings = var\.identity_cutover_approved \? \{([\s\S]*?)\n  \} : \{\}/
)?.[1]

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
})
