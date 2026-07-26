locals {
  blob_service_resource_id = "${azurerm_storage_account.restricted.id}/blobServices/default"
}

resource "azurerm_storage_account" "restricted" {
  name                     = var.storage_account_name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = var.account_replication_type
  account_kind             = "StorageV2"
  access_tier              = "Hot"

  https_traffic_only_enabled        = true
  min_tls_version                   = "TLS1_2"
  allow_nested_items_to_be_public   = false
  shared_access_key_enabled         = false
  public_network_access_enabled     = false
  default_to_oauth_authentication   = true
  infrastructure_encryption_enabled = true
  cross_tenant_replication_enabled  = false
  local_user_enabled                = false
  allowed_copy_scope                = "PrivateLink"

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = var.soft_delete_days
    }

    container_delete_retention_policy {
      days = var.soft_delete_days
    }
  }

  network_rules {
    default_action = "Deny"
    bypass         = ["Logging", "Metrics"]
  }

  lifecycle {
    precondition {
      condition     = length(var.authorized_researcher_object_ids) > 0
      error_message = "At least one approved authorized researcher Microsoft Entra object ID is required."
    }

    precondition {
      condition     = var.soft_delete_days < var.retention_days
      error_message = "soft_delete_days must be shorter than retention_days."
    }
  }

  tags = var.tags
}

# Use the ARM control plane so the container can be provisioned while Shared Key
# authorization remains disabled. No connection string or storage key is needed.
resource "azapi_resource" "evidence_container" {
  type      = "Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01"
  name      = var.container_name
  parent_id = local.blob_service_resource_id

  body = {
    properties = {
      defaultEncryptionScope      = "$account-encryption-key"
      denyEncryptionScopeOverride = true
      publicAccess                = "None"
      metadata = {
        data_class       = "restricted"
        purpose          = "o6-reviewer-evidence"
        application_read = "prohibited"
      }
    }
  }

  response_export_values = []
}

resource "azurerm_storage_management_policy" "retention" {
  storage_account_id = azurerm_storage_account.restricted.id

  rule {
    name    = "delete-restricted-evidence"
    enabled = true

    filters {
      prefix_match = ["${var.container_name}/"]
      blob_types   = ["blockBlob"]
    }

    actions {
      base_blob {
        delete_after_days_since_creation_greater_than = var.retention_days
      }

      snapshot {
        delete_after_days_since_creation_greater_than = var.retention_days
      }

      version {
        delete_after_days_since_creation = var.retention_days
      }
    }
  }

  depends_on = [azapi_resource.evidence_container]
}

resource "azurerm_private_dns_zone" "blob" {
  name                = var.private_dns_zone_name
  resource_group_name = var.resource_group_name

  tags = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "blob" {
  name                  = "${var.storage_account_name}-blob-dns-link"
  resource_group_name   = var.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.blob.name
  virtual_network_id    = var.vnet_id
  registration_enabled  = false

  tags = var.tags
}

resource "azurerm_private_endpoint" "blob" {
  name                = "${var.storage_account_name}-blob-pe"
  resource_group_name = var.resource_group_name
  location            = var.location
  subnet_id           = var.private_endpoint_subnet_id

  private_service_connection {
    name                           = "${var.storage_account_name}-blob-psc"
    private_connection_resource_id = azurerm_storage_account.restricted.id
    is_manual_connection           = false
    subresource_names              = ["blob"]
  }

  private_dns_zone_group {
    name                 = "blob"
    private_dns_zone_ids = [azurerm_private_dns_zone.blob.id]
  }

  tags = var.tags
}

resource "azurerm_role_assignment" "authorized_researchers" {
  for_each = var.authorized_researcher_object_ids

  scope                = azurerm_storage_account.restricted.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = each.value
}

resource "azurerm_log_analytics_workspace" "audit" {
  name                = var.audit_workspace_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = var.audit_log_retention_days

  local_authentication_enabled = false

  tags = var.tags
}

resource "azurerm_monitor_diagnostic_setting" "blob_access" {
  name                       = "restricted-blob-access"
  target_resource_id         = local.blob_service_resource_id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.audit.id

  enabled_log {
    category = "StorageRead"
  }

  enabled_log {
    category = "StorageWrite"
  }

  enabled_log {
    category = "StorageDelete"
  }

  enabled_metric {
    category = "AllMetrics"
  }

  depends_on = [azapi_resource.evidence_container]
}
