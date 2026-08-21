data "azurerm_client_config" "current" {}

locals {
  required_tags = {
    environment = "production"
    project     = "house-of-veritas"
    product     = "hov"
    portfolio   = "nexamesh"
    managed_by  = "terraform"
    state_scope = "hov-target-only"
    data_class  = "terraform-state"
  }

  tags = merge(local.required_tags, var.tags)
}

resource "terraform_data" "target_guard" {
  lifecycle {
    precondition {
      condition     = data.azurerm_client_config.current.tenant_id == var.target_tenant_id
      error_message = "Authenticated Azure tenant does not match the approved Celladore Systems tenant."
    }

    precondition {
      condition     = data.azurerm_client_config.current.subscription_id == var.target_subscription_id
      error_message = "Authenticated Azure subscription does not match the approved nexamesh-sub subscription."
    }
  }
}

resource "azurerm_resource_group" "state" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.tags

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [terraform_data.target_guard]
}

resource "azurerm_storage_account" "state" {
  name                              = var.storage_account_name
  resource_group_name               = azurerm_resource_group.state.name
  location                          = azurerm_resource_group.state.location
  account_tier                      = "Standard"
  account_replication_type          = "ZRS"
  account_kind                      = "StorageV2"
  min_tls_version                   = "TLS1_2"
  public_network_access_enabled     = true
  shared_access_key_enabled         = false
  default_to_oauth_authentication   = true
  allow_nested_items_to_be_public   = false
  infrastructure_encryption_enabled = true

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 30
    }

    container_delete_retention_policy {
      days = 30
    }
  }

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
    ip_rules       = var.backend_allowed_ip_cidrs
  }

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

# Use the ARM control plane so bootstrap never needs a storage access key and
# does not depend on data-plane role propagation to create the state container.
resource "azapi_resource" "state_container" {
  type      = "Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01"
  name      = var.state_container_name
  parent_id = "${azurerm_storage_account.state.id}/blobServices/default"

  body = {
    properties = {
      publicAccess = "None"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_role_assignment" "bootstrap_state_owner" {
  scope                = azurerm_storage_account.state.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = data.azurerm_client_config.current.object_id
}
