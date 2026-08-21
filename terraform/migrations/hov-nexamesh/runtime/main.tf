data "azurerm_client_config" "current" {}

data "terraform_remote_state" "foundation" {
  backend = "azurerm"

  config = {
    resource_group_name  = var.foundation_state_resource_group_name
    storage_account_name = var.foundation_state_storage_account_name
    container_name       = var.foundation_state_container_name
    key                  = var.foundation_state_key
    use_azuread_auth     = true
    tenant_id            = var.target_tenant_id
    subscription_id      = var.target_subscription_id
  }
}

locals {
  foundation            = data.terraform_remote_state.foundation.outputs
  key_vault_secret_base = "${trimsuffix(local.foundation.key_vault_uri, "/")}/secrets"

  mandatory_tags = {
    environment = "production"
    project     = "house-of-veritas"
    owner       = "nexamesh"
    migration   = "hov-nexamesh"
  }
  tags = merge(var.tags, local.mandatory_tags)

  key_vault_app_settings = {
    AUTH_SECRET                    = "@Microsoft.KeyVault(SecretUri=${local.key_vault_secret_base}/${var.auth_secret_name})"
    JWT_SECRET                     = "@Microsoft.KeyVault(SecretUri=${local.key_vault_secret_base}/${var.auth_secret_name})"
    COSMOS_MONGO_CONNECTION_STRING = "@Microsoft.KeyVault(SecretUri=${local.key_vault_secret_base}/${local.foundation.cosmos_runtime_connection_secret_name})"
    BASEROW_API_TOKEN              = "@Microsoft.KeyVault(SecretUri=${local.key_vault_secret_base}/${var.baserow_api_token_secret_name})"
    DOCUSEAL_API_KEY               = "@Microsoft.KeyVault(SecretUri=${local.key_vault_secret_base}/${var.docuseal_api_key_secret_name})"
  }

  identity_cutover_app_settings = var.identity_cutover_approved ? {
    MYSTIRA_OIDC_ISSUER        = var.mystira_oidc_issuer
    MYSTIRA_OIDC_CLIENT_ID     = var.mystira_oidc_client_id
    MYSTIRA_OIDC_CLIENT_SECRET = "@Microsoft.KeyVault(SecretUri=${local.key_vault_secret_base}/${var.mystira_oidc_client_secret_name})"
    AUTH_URL                   = var.auth_url
  } : {}
}

check "exact_target_context" {
  assert {
    condition = (
      data.azurerm_client_config.current.tenant_id == var.target_tenant_id &&
      data.azurerm_client_config.current.subscription_id == var.target_subscription_id
    )
    error_message = "Authenticated Azure context is not the approved Celladore/nexamesh-sub target."
  }
}

check "foundation_boundary" {
  assert {
    condition = (
      local.foundation.resource_group_name == var.resource_group_name &&
      local.foundation.location == var.location &&
      startswith(lower(local.foundation.resource_group_id), "/subscriptions/${lower(var.target_subscription_id)}/resourcegroups/nex-prod-hov-") &&
      startswith(lower(local.foundation.resource_group_name), "nex-prod-hov-")
    )
    error_message = "Foundation state is outside the approved target boundary or references a NeuralLiquid source resource."
  }
}

check "identity_cutover_complete" {
  assert {
    condition = !var.identity_cutover_approved || alltrue([
      var.mystira_oidc_issuer != "",
      var.mystira_oidc_client_id != "",
      var.mystira_oidc_client_secret_name != "",
      var.auth_url != "",
      can(regex("^https://", var.mystira_oidc_issuer)),
      can(regex("^https://", var.auth_url)),
    ])
    error_message = "Approved identity cutover requires complete HTTPS issuer, client, Key Vault secret-name, and AUTH_URL settings."
  }
}

resource "azurerm_service_plan" "runtime" {
  name                = var.service_plan_name
  resource_group_name = local.foundation.resource_group_name
  location            = local.foundation.location
  os_type             = "Linux"
  sku_name            = "B1"

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_log_analytics_workspace" "runtime" {
  name                = var.log_analytics_workspace_name
  resource_group_name = local.foundation.resource_group_name
  location            = local.foundation.location
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_application_insights" "runtime" {
  name                = var.application_insights_name
  resource_group_name = local.foundation.resource_group_name
  location            = local.foundation.location
  application_type    = "web"
  workspace_id        = azurerm_log_analytics_workspace.runtime.id

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_linux_web_app" "runtime" {
  name                      = var.web_app_name
  resource_group_name       = local.foundation.resource_group_name
  location                  = local.foundation.location
  service_plan_id           = azurerm_service_plan.runtime.id
  virtual_network_subnet_id = local.foundation.app_service_subnet_id

  https_only                    = true
  public_network_access_enabled = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on               = true
    ftps_state              = "Disabled"
    http2_enabled           = true
    minimum_tls_version     = "1.2"
    scm_minimum_tls_version = "1.2"
    vnet_route_all_enabled  = true

    application_stack {
      node_version = "22-lts"
    }
  }

  app_settings = merge({
    NODE_ENV                              = "production"
    WEBSITE_NODE_DEFAULT_VERSION          = "~22"
    HOSTNAME                              = "0.0.0.0"
    AUTH_TRUST_HOST                       = "true"
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.runtime.connection_string
    APPLICATIONINSIGHTS_ROLE_NAME         = var.web_app_name
    AZURE_STORAGE_ACCOUNT_NAME            = local.foundation.app_storage_account_name
    AZURE_STORAGE_CONTAINER               = var.app_storage_container_name
    AZURE_POSTGRES_HOST                   = local.foundation.postgres_server_fqdn
    AZURE_POSTGRES_DATABASE               = local.foundation.postgres_database_name
    AZURE_POSTGRES_USER                   = var.postgres_runtime_principal_name
    AZURE_POSTGRES_AUTH_MODE              = local.foundation.postgres_authentication_mode
    ESTATE_BACKEND                        = "postgres"
    BASEROW_URL                           = var.baserow_url
    BASEROW_API_URL                       = "${trimsuffix(var.baserow_url, "/")}/api"
    DOCUSEAL_URL                          = var.docuseal_url
    DOCUSEAL_API_URL                      = "${trimsuffix(var.docuseal_url, "/")}/api"
    RADAR_ENABLED                         = "false"
    ALLOW_DEMO_DATA                       = "false"
    ALLOW_DEMO_USERS                      = "false"
  }, local.key_vault_app_settings, local.identity_cutover_app_settings)

  tags = local.tags

  lifecycle {
    prevent_destroy = true

    precondition {
      condition = (
        local.foundation.scoped_role_bootstrap_required == true &&
        local.foundation.postgres_authentication_mode == "entra-only"
      )
      error_message = "Foundation must require scoped Entra PostgreSQL role bootstrap; static/admin DSNs are forbidden."
    }
  }
}

resource "azurerm_role_assignment" "key_vault_secrets_user" {
  scope                            = local.foundation.key_vault_id
  role_definition_id               = "/subscriptions/${var.target_subscription_id}/providers/Microsoft.Authorization/roleDefinitions/4633458b-17de-408a-b874-0445c86b69e6"
  principal_id                     = azurerm_linux_web_app.runtime.identity[0].principal_id
  principal_type                   = "ServicePrincipal"
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "blob_data_contributor" {
  scope                            = local.foundation.app_storage_account_id
  role_definition_id               = "/subscriptions/${var.target_subscription_id}/providers/Microsoft.Authorization/roleDefinitions/ba92f5b4-2d11-453d-a403-e96b0029c9fe"
  principal_id                     = azurerm_linux_web_app.runtime.identity[0].principal_id
  principal_type                   = "ServicePrincipal"
  skip_service_principal_aad_check = true
}
