import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n")
}

const workflow = read(".github/workflows/hov-nexamesh-migration.yml")
const teardownMain = read("terraform/migrations/hov-nexamesh/migration-runner-teardown/main.tf")
const teardownVersions = read(
  "terraform/migrations/hov-nexamesh/migration-runner-teardown/versions.tf"
)
const teardownPolicy = read("scripts/migration/hov-nexamesh/Assert-RunnerTeardownPlan.ps1")

const expectedAddresses = [
  "terraform_data.target_guard",
  "azurerm_public_ip.nat",
  "azurerm_nat_gateway.migration",
  "azurerm_nat_gateway_public_ip_association.migration",
  "azurerm_subnet_nat_gateway_association.migration",
  "azurerm_network_interface.migration",
  "azurerm_linux_virtual_machine.migration",
  "azurerm_virtual_machine_extension.tooling_readiness",
  "azurerm_role_assignment.target_blob",
  "azurerm_role_assignment.target_secrets",
  "azurerm_postgresql_flexible_server_active_directory_administrator.migration",
]

describe("HOV migration-runner teardown contract", () => {
  it("uses the existing runner state with a dedicated delete-only policy", () => {
    expect(workflow).toContain("- migration-runner-teardown")
    expect(workflow).toContain(
      "migration-runner|migration-runner-teardown) state_key='hov/prod/migration-runner.tfstate'"
    )
    expect(workflow).toContain('if [ "$INPUT_ROOT" = migration-runner-teardown ]; then')
    expect(workflow).toContain("Assert-RunnerTeardownPlan.ps1")
    expect(workflow).toContain("teardown-plan-evidence.json")
  })

  it("removes exactly the temporary runner state addresses", () => {
    const removedAddresses = [...teardownMain.matchAll(/from = ([a-z0-9_.]+)/g)].map(
      (match) => match[1]
    )

    expect(removedAddresses).toEqual(expectedAddresses)
    expect(teardownMain.match(/\bresource\s+"/g)).toBeNull()
    expect(teardownMain.match(/destroy = true/g)).toHaveLength(expectedAddresses.length)
    for (const address of expectedAddresses) {
      expect(workflow).toContain(address)
    }
  })

  it("pins the target boundary and rejects non-delete actions", () => {
    expect(teardownVersions).toContain('version = "= 4.81.0"')
    expect(teardownVersions).toContain("tenant_id       = var.target_tenant_id")
    expect(teardownVersions).toContain("subscription_id = var.target_subscription_id")
    expect(teardownPolicy).toContain('$actions[0] -cne "delete"')
    expect(teardownPolicy).toContain("AllowedResourceAddressesCsv.Split")
    expect(teardownPolicy).toContain("$change.address -cnotin $AllowedResourceAddresses")
    expect(teardownPolicy).toContain("sourceRetirement   = $false")
  })
})
