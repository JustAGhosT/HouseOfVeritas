# Compute Module - Azure Container Instances for DocuSeal and Baserow

# DocuSeal Container Instance
resource "azurerm_container_group" "docuseal" {
  name                = "${var.environment}-docuseal"
  location            = var.location
  resource_group_name = var.resource_group_name
  os_type             = "Linux"
  restart_policy      = "Always"
  ip_address_type     = "Private"

  subnet_ids = [var.container_subnet_id]

  container {
    name   = "docuseal"
    image  = "docuseal/docuseal:2.3.0"
    cpu    = "2"
    memory = "4"

    ports {
      port     = 3000
      protocol = "TCP"
    }

    environment_variables = {
      DATABASE_URL  = var.docuseal_database_url
      SMTP_HOST     = var.smtp_host
      SMTP_PORT     = var.smtp_port
      SMTP_USERNAME = var.smtp_username
      BASE_URL      = "https://sign.${var.domain_name}"
    }

    secure_environment_variables = {
      SECRET_KEY_BASE = var.docuseal_secret_key
      SMTP_PASSWORD   = var.smtp_password
    }

    volume {
      name       = "docuseal-data"
      mount_path = "/data"

      storage_account_name = var.storage_account_name
      storage_account_key  = var.storage_account_key
      share_name           = azurerm_storage_share.docuseal.name
    }
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

# Baserow Container Instance
resource "azurerm_container_group" "baserow" {
  name                = "${var.environment}-baserow"
  location            = var.location
  resource_group_name = var.resource_group_name
  os_type             = "Linux"
  restart_policy      = "Always"
  ip_address_type     = "Private"

  subnet_ids = [var.container_subnet_id]

  container {
    name   = "baserow"
    image  = "baserow/baserow:1.25.2"
    cpu    = "2"
    memory = "4"

    ports {
      port     = 80
      protocol = "TCP"
    }

    environment_variables = {
      DATABASE_URL                           = var.baserow_database_url
      BASEROW_PUBLIC_URL                     = "https://ops.${var.domain_name}"
      EMAIL_SMTP_HOST                        = var.smtp_host
      EMAIL_SMTP_PORT                        = var.smtp_port
      EMAIL_SMTP_USER                        = var.smtp_username
      EMAIL_SMTP_USE_TLS                     = "true"
      BASEROW_ENABLE_SECURE_PROXY_SSL_HEADER = "true"
    }

    secure_environment_variables = {
      SECRET_KEY          = var.baserow_secret_key
      EMAIL_SMTP_PASSWORD = var.smtp_password
    }

    volume {
      name       = "baserow-data"
      mount_path = "/baserow/data"

      storage_account_name = var.storage_account_name
      storage_account_key  = var.storage_account_key
      share_name           = azurerm_storage_share.baserow.name
    }
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

# Azure File Shares for persistent storage
resource "azurerm_storage_share" "docuseal" {
  name                 = "docuseal-data"
  storage_account_name = var.storage_account_name
  quota                = 10 # 10GB
}

resource "azurerm_storage_share" "baserow" {
  name                 = "baserow-data"
  storage_account_name = var.storage_account_name
  quota                = 10 # 10GB
}

# Grant Key Vault access to container managed identities
resource "azurerm_key_vault_access_policy" "docuseal" {
  key_vault_id = var.key_vault_id
  tenant_id    = azurerm_container_group.docuseal.identity[0].tenant_id
  object_id    = azurerm_container_group.docuseal.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List"
  ]
}

resource "azurerm_key_vault_access_policy" "baserow" {
  key_vault_id = var.key_vault_id
  tenant_id    = azurerm_container_group.baserow.identity[0].tenant_id
  object_id    = azurerm_container_group.baserow.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List"
  ]
}
