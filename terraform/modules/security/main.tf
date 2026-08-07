# Security Module - Azure Key Vault for House of Veritas

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                        = var.key_vault_name
  location                    = var.location
  resource_group_name         = var.resource_group_name
  enabled_for_disk_encryption = true
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days  = 7
  purge_protection_enabled    = true

  sku_name = "standard"

  network_acls {
    bypass                     = "AzureServices"
    default_action             = var.network_default_action
    ip_rules                   = var.deployer_ip_addresses
    virtual_network_subnet_ids = [var.container_subnet_id]
  }

  tags = var.tags
}

# Access Policy for Terraform Service Principal
resource "azurerm_key_vault_access_policy" "terraform" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = var.terraform_access_policy_object_id

  secret_permissions = [
    "Get",
    "List",
    "Set",
    "Delete",
    "Recover",
    "Backup",
    "Restore",
    "Purge"
  ]

  certificate_permissions = [
    "Get",
    "List",
    "Create",
    "Update",
    "Delete"
  ]
}

# Operator access policies.
#
# This vault uses the access-policy model, so subscription Owner grants nothing
# on it — an operator who needs to read or place a secret by hand must be listed
# here. One such policy was added out of band on 2026-08-07 to move the estate
# connection string into this vault; declaring it makes that grant reviewable
# instead of invisible.
#
# Deliberately narrower than the deploy principal's policy: no Delete, Purge or
# certificate rights.
resource "azurerm_key_vault_access_policy" "operators" {
  for_each = toset(var.operator_access_policy_object_ids)

  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = each.value

  secret_permissions = [
    "Get",
    "List",
    "Set"
  ]
}

# Secrets (placeholders - actual values set manually or via pipeline)
resource "azurerm_key_vault_secret" "db_password" {
  name         = "db-admin-password"
  value        = var.db_admin_password
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "docuseal_secret_key" {
  name         = "docuseal-secret-key"
  value        = var.docuseal_secret_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "baserow_secret_key" {
  name         = "baserow-secret-key"
  value        = var.baserow_secret_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "smtp_password" {
  name         = "smtp-password"
  value        = var.smtp_password
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}
