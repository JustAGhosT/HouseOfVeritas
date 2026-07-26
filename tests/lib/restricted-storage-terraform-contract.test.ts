import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n")
}

const moduleMain = read("terraform/modules/restricted-storage/main.tf")
const moduleOutputs = read("terraform/modules/restricted-storage/outputs.tf")
const productionMain = read("terraform/environments/production/main.tf")
const productionVariables = read("terraform/environments/production/variables.tf")

describe("O6 restricted storage Terraform contract", () => {
  it("is absent by default and requires private activation inputs", () => {
    expect(productionVariables).toMatch(
      /variable "enable_restricted_evidence_store"[\s\S]*?default\s+= false/
    )
    expect(productionVariables).toMatch(
      /variable "restricted_evidence_researcher_object_ids"[\s\S]*?default\s+= \[\]/
    )
    expect(productionMain).toContain("count  = var.enable_restricted_evidence_store ? 1 : 0")
  })

  it("enforces private Entra-only storage without application credentials", () => {
    expect(moduleMain).toMatch(/allow_nested_items_to_be_public\s+= false/)
    expect(moduleMain).toMatch(/shared_access_key_enabled\s+= false/)
    expect(moduleMain).toMatch(/public_network_access_enabled\s+= false/)
    expect(moduleMain).toMatch(/default_to_oauth_authentication\s+= true/)
    expect(moduleMain).toMatch(/default_action\s+= "Deny"/)
    expect(moduleMain).toMatch(/subresource_names\s+= \["blob"\]/)
    expect(moduleMain).toMatch(/role_definition_name\s+= "Storage Blob Data Contributor"/)
    expect(moduleMain).toMatch(/local_authentication_enabled\s+= false/)
    expect(moduleOutputs).not.toMatch(/access_key|connection_string/i)
  })

  it("uses the ARM control plane for a private container", () => {
    expect(moduleMain).toContain(
      "Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01"
    )
    expect(moduleMain).toContain('publicAccess                = "None"')
    expect(moduleMain).toContain("denyEncryptionScopeOverride = true")
    expect(moduleMain).not.toContain('resource "azurerm_storage_container"')
  })

  it("bounds evidence lifetime and records blob access operations", () => {
    expect(moduleMain).toContain(
      "delete_after_days_since_creation_greater_than = var.retention_days"
    )
    expect(moduleMain).toContain("delete_after_days_since_creation = var.retention_days")
    expect(moduleMain).toContain('category = "StorageRead"')
    expect(moduleMain).toContain('category = "StorageWrite"')
    expect(moduleMain).toContain('category = "StorageDelete"')
    expect(moduleMain).toContain('category = "AllMetrics"')
  })
})
