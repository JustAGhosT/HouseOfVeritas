locals {
  app_base_url                       = var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${var.domain_name}"
  mystira_oidc_client_secret_setting = var.mystira_oidc_client_secret_key_vault_secret_name != "" ? "@Microsoft.KeyVault(SecretUri=${var.key_vault_uri}secrets/${var.mystira_oidc_client_secret_key_vault_secret_name})" : var.mystira_oidc_client_secret

  # Auth.js v5 + Mystira OIDC runtime settings. Each OIDC key is emitted ONLY
  # when a value is supplied, so an unset variable leaves the setting absent and
  # the app falls back to its in-code dev default (see auth.config.ts) rather
  # than being overridden with an empty string. AUTH_TRUST_HOST is always on:
  # behind Azure App Service's proxy Auth.js must trust the forwarded host or it
  # throws UntrustedHost (which surfaces as the /api/auth/error "Server error"
  # page). AUTH_URL is left unset unless pinned, so Auth.js derives callback URLs
  # from the real request host — correct even when the public hostname differs
  # from var.domain_name.
  auth_app_settings = merge(
    { AUTH_TRUST_HOST = "true" },
    var.mystira_oidc_issuer != "" ? { MYSTIRA_OIDC_ISSUER = var.mystira_oidc_issuer } : {},
    var.mystira_oidc_client_id != "" ? { MYSTIRA_OIDC_CLIENT_ID = var.mystira_oidc_client_id } : {},
    local.mystira_oidc_client_secret_setting != "" ? { MYSTIRA_OIDC_CLIENT_SECRET = local.mystira_oidc_client_secret_setting } : {},
    var.auth_url != "" ? { AUTH_URL = var.auth_url } : {},
  )
}

resource "azurerm_service_plan" "webapp" {
  name                = "${var.web_app_name}-plan"
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "B1"

  tags = var.tags
}

resource "azurerm_application_insights" "webapp" {
  name                = "${var.web_app_name}-insights"
  resource_group_name = var.resource_group_name
  location            = var.location
  application_type    = "web"

  lifecycle {
    ignore_changes = [workspace_id]
  }

  tags = var.tags
}

resource "azurerm_linux_web_app" "main" {
  name                      = var.web_app_name
  resource_group_name       = var.resource_group_name
  location                  = var.location
  service_plan_id           = azurerm_service_plan.webapp.id
  virtual_network_subnet_id = var.app_service_subnet_id != "" ? var.app_service_subnet_id : null

  site_config {
    application_stack {
      node_version = "24-lts"
    }

    app_command_line = "node server.js"

    always_on              = true
    ftps_state             = "Disabled"
    vnet_route_all_enabled = var.app_service_subnet_id != ""

    cors {
      allowed_origins = [
        local.app_base_url,
        "https://docs.${var.domain_name}",
        "https://ops.${var.domain_name}",
      ]
    }
  }

  app_settings = merge({
    WEBSITE_NODE_DEFAULT_VERSION = "~24"
    HOSTNAME                     = "0.0.0.0"
    NODE_ENV                     = "production"
    NEXT_PUBLIC_APP_URL          = local.app_base_url

    BASEROW_URL             = "https://ops.${var.domain_name}"
    BASEROW_TOKEN           = var.baserow_api_token
    BASEROW_API_URL         = "https://ops.${var.domain_name}/api"
    BASEROW_API_TOKEN       = var.baserow_api_token
    BASEROW_DATABASE_ID     = var.baserow_database_id
    NEXT_PUBLIC_BASEROW_URL = "https://ops.${var.domain_name}"

    BASEROW_TABLE_EMPLOYEES            = var.baserow_table_employees
    BASEROW_TABLE_ASSETS               = var.baserow_table_assets
    BASEROW_TABLE_TASKS                = var.baserow_table_tasks
    BASEROW_TABLE_TIME_CLOCK           = var.baserow_table_time_clock
    BASEROW_TABLE_INCIDENTS            = var.baserow_table_incidents
    BASEROW_TABLE_VEHICLE_LOGS         = var.baserow_table_vehicle_logs
    BASEROW_TABLE_EXPENSES             = var.baserow_table_expenses
    BASEROW_TABLE_DOCUMENT_EXPIRY      = var.baserow_table_document_expiry
    BASEROW_TABLE_LEAVE_REQUESTS       = var.baserow_table_leave_requests
    BASEROW_TABLE_LOANS                = var.baserow_table_loans
    BASEROW_TABLE_PETTY_CASH           = var.baserow_table_petty_cash
    BASEROW_TABLE_ONBOARDING_CHECKLIST = var.baserow_table_onboarding_checklist
    BASEROW_TABLE_BUDGET               = var.baserow_table_budget
    BASEROW_TABLE_PPE                  = var.baserow_table_ppe
    BASEROW_TABLE_POLICY_VERSIONS      = var.baserow_table_policy_versions
    BASEROW_TABLE_CONTRACTOR_CONTRACTS = var.baserow_table_contractor_contracts
    BASEROW_TABLE_INSURANCE_CLAIMS     = var.baserow_table_insurance_claims
    BASEROW_TABLE_DEAL_RADAR_LISTINGS  = var.baserow_table_deal_radar_listings
    RADAR_ENABLED                      = tostring(var.radar_enabled)

    DOCUSEAL_URL             = "https://docs.${var.domain_name}"
    DOCUSEAL_KEY             = var.docuseal_api_key
    DOCUSEAL_API_URL         = "https://docs.${var.domain_name}/api"
    DOCUSEAL_API_KEY         = var.docuseal_api_key
    NEXT_PUBLIC_DOCUSEAL_URL = "https://docs.${var.domain_name}"

    # AUTH_SECRET encrypts the Auth.js session JWT. MYSTIRA_OIDC_* / AUTH_URL /
    # AUTH_TRUST_HOST are injected via local.auth_app_settings below.
    AUTH_SECRET = var.jwt_secret
    JWT_SECRET  = var.jwt_secret

    AZURE_STORAGE_CONNECTION_STRING       = var.storage_connection_string
    DOCUMENT_INTELLIGENCE_ENDPOINT        = var.document_intelligence_endpoint
    DOCUMENT_INTELLIGENCE_KEY             = var.document_intelligence_key
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.webapp.connection_string
    APPINSIGHTS_INSTRUMENTATIONKEY        = azurerm_application_insights.webapp.instrumentation_key
    APPLICATIONINSIGHTS_ROLE_NAME         = var.web_app_name
  }, local.auth_app_settings, var.extra_app_settings)

  identity {
    type = "SystemAssigned"
  }

  https_only = true

  tags = var.tags
}

resource "azurerm_key_vault_access_policy" "webapp" {
  key_vault_id = var.key_vault_id
  tenant_id    = azurerm_linux_web_app.main.identity[0].tenant_id
  object_id    = azurerm_linux_web_app.main.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List",
  ]
}

resource "azurerm_app_service_custom_hostname_binding" "root" {
  count               = var.custom_domain != "" ? 1 : 0
  hostname            = var.custom_domain
  app_service_name    = azurerm_linux_web_app.main.name
  resource_group_name = var.resource_group_name

  lifecycle {
    ignore_changes = [ssl_state, thumbprint]
  }
}
