# Functions Module - Azure Function App for House of Veritas automation

resource "azurerm_service_plan" "functions" {
  name                = "${var.function_app_name}-plan"
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "B1"

  tags = var.tags
}

resource "azurerm_storage_account" "functions" {
  name                     = var.functions_storage_account_name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  tags = var.tags
}

resource "azurerm_application_insights" "functions" {
  name                = "${var.function_app_name}-insights"
  resource_group_name = var.resource_group_name
  location            = var.location
  application_type    = "other"

  lifecycle {
    ignore_changes = [workspace_id]
  }

  tags = var.tags
}

resource "azurerm_linux_function_app" "main" {
  name                = var.function_app_name
  resource_group_name = var.resource_group_name
  location            = var.location
  https_only          = true

  storage_account_name       = azurerm_storage_account.functions.name
  storage_account_access_key = azurerm_storage_account.functions.primary_access_key
  service_plan_id            = azurerm_service_plan.functions.id

  site_config {
    application_stack {
      python_version = "3.11"
    }

    cors {
      allowed_origins = [
        "https://docs.${var.domain_name}",
        "https://ops.${var.domain_name}",
        "https://${var.domain_name}",
      ]
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME       = "python"
    APPINSIGHTS_INSTRUMENTATIONKEY = azurerm_application_insights.functions.instrumentation_key

    BASEROW_URL             = "https://ops.${var.domain_name}"
    BASEROW_TOKEN           = var.baserow_api_token
    DOCUSEAL_URL            = "https://docs.${var.domain_name}"
    DOCUSEAL_API_KEY        = var.docuseal_api_key
    DOCUSEAL_WEBHOOK_SECRET = var.docuseal_webhook_secret

    TABLE_EMPLOYEES       = var.baserow_table_employees
    TABLE_ASSETS          = var.baserow_table_assets
    TABLE_TASKS           = var.baserow_table_tasks
    TABLE_TIME_CLOCK      = var.baserow_table_time_clock
    TABLE_INCIDENTS       = var.baserow_table_incidents
    TABLE_VEHICLE_LOGS    = var.baserow_table_vehicle_logs
    TABLE_EXPENSES        = var.baserow_table_expenses
    TABLE_DOCUMENT_EXPIRY = var.baserow_table_document_expiry

    ACS_CONNECTION_STRING = var.acs_connection_string
    EMAIL_FROM            = "alerts@${var.domain_name}"
    ADMIN_EMAIL      = "hans@${var.domain_name}"
    ADMIN_PHONE      = var.admin_phone

    AZURE_STORAGE_CONNECTION_STRING = var.storage_connection_string
    BACKUP_CONTAINER                = "backups"
    ARCHIVE_CONTAINER               = "archive"
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

resource "azurerm_key_vault_access_policy" "functions" {
  key_vault_id = var.key_vault_id
  tenant_id    = azurerm_linux_function_app.main.identity[0].tenant_id
  object_id    = azurerm_linux_function_app.main.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List",
  ]
}
