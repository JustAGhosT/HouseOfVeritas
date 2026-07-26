# Main Terraform configuration for House of Veritas - Production Environment

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.58"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.11"
    }
  }

  backend "azurerm" {
    # Backend configuration provided via backend-config during init
    # terraform init -backend-config="backend.hcl"
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }

    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.common_tags
}

# Network Module
module "network" {
  source = "../../modules/network"

  resource_group_name            = azurerm_resource_group.main.name
  location                       = azurerm_resource_group.main.location
  environment                    = var.environment
  vnet_name                      = var.vnet_name
  vnet_address_space             = var.vnet_address_space
  gateway_subnet_prefix          = var.gateway_subnet_prefix
  container_subnet_prefix        = var.container_subnet_prefix
  database_subnet_prefix         = var.database_subnet_prefix
  app_service_subnet_prefix      = var.app_service_subnet_prefix
  private_endpoint_subnet_prefix = var.private_endpoint_subnet_prefix

  tags = local.common_tags
}

# Storage Module
module "storage" {
  source = "../../modules/storage"

  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  storage_account_name     = var.storage_account_name
  account_replication_type = var.storage_account_replication_type
  network_default_action   = var.storage_network_default_action
  container_subnet_id      = module.network.container_subnet_id
  database_subnet_id       = module.network.database_subnet_id
  deployer_ip_addresses    = local.ci_ip_rules_storage

  tags = local.common_tags
}

# O6 restricted evidence storage is isolated from the application's general
# storage account and remains absent unless human privacy prerequisites are
# supplied through private Terraform inputs.
module "restricted_evidence_storage" {
  source = "../../modules/restricted-storage"
  count  = var.enable_restricted_evidence_store ? 1 : 0

  resource_group_name              = azurerm_resource_group.main.name
  location                         = azurerm_resource_group.main.location
  storage_account_name             = var.restricted_evidence_storage_account_name
  account_replication_type         = var.restricted_evidence_replication_type
  container_name                   = var.restricted_evidence_container_name
  private_endpoint_subnet_id       = module.network.private_endpoint_subnet_id
  vnet_id                          = module.network.vnet_id
  authorized_researcher_object_ids = var.restricted_evidence_researcher_object_ids
  retention_days                   = var.restricted_evidence_retention_days
  soft_delete_days                 = var.restricted_evidence_soft_delete_days
  audit_workspace_name             = var.restricted_evidence_audit_workspace_name
  audit_log_retention_days         = var.restricted_evidence_audit_retention_days

  tags = merge(local.common_tags, {
    DataClass = "Restricted"
    Purpose   = "O6ReviewerEvidence"
  })

  depends_on = [module.network]
}

# Security Module (Key Vault)
module "security" {
  source = "../../modules/security"

  resource_group_name               = azurerm_resource_group.main.name
  location                          = azurerm_resource_group.main.location
  key_vault_name                    = var.key_vault_name
  network_default_action            = var.key_vault_network_default_action
  container_subnet_id               = module.network.container_subnet_id
  terraform_access_policy_object_id = var.terraform_key_vault_access_policy_object_id
  deployer_ip_addresses             = local.ci_ip_rules_keyvault
  db_admin_password                 = var.db_admin_password
  docuseal_secret_key               = random_password.docuseal_secret.result
  baserow_secret_key                = random_password.baserow_secret.result
  smtp_password                     = var.smtp_password

  tags = local.common_tags
}

# Database Module
module "database" {
  source = "../../modules/database"
  count  = var.enable_database ? 1 : 0

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  server_name         = var.db_server_name
  admin_username      = var.db_admin_username
  admin_password      = var.db_admin_password
  sku_name            = var.db_sku_name
  storage_mb          = var.db_storage_mb
  app_database_name   = var.db_app_database_name
  database_subnet_id  = module.network.database_subnet_id
  vnet_id             = module.network.vnet_id

  tags = local.common_tags

  depends_on = [module.network, module.security]
}

module "cosmos_mongo" {
  source = "../../modules/cosmosdb-mongo"
  count  = var.enable_cosmos_mongo ? 1 : 0

  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  account_name                  = var.cosmos_account_name
  mongo_database_name           = var.cosmos_mongo_database_name
  mongo_collection_name         = var.cosmos_mongo_collection_name
  throughput                    = var.cosmos_mongo_throughput
  public_network_access_enabled = var.cosmos_public_network_access_enabled
  private_endpoint_subnet_id    = module.network.private_endpoint_subnet_id
  vnet_id                       = module.network.vnet_id
  enable_free_tier              = var.cosmos_enable_free_tier

  tags = local.common_tags

  depends_on = [module.network]
}

# Compute Module (Container Instances)
module "compute" {
  source = "../../modules/compute"
  count  = var.enable_operational_services && var.enable_database ? 1 : 0

  resource_group_name   = azurerm_resource_group.main.name
  location              = azurerm_resource_group.main.location
  environment           = var.environment
  container_subnet_id   = module.network.container_subnet_id
  storage_account_name  = module.storage.storage_account_name
  storage_account_key   = module.storage.primary_access_key
  key_vault_id          = module.security.key_vault_id
  domain_name           = var.domain_name
  docuseal_database_url = module.database[0].connection_string_docuseal
  docuseal_secret_key   = random_password.docuseal_secret.result
  baserow_database_url  = module.database[0].connection_string_baserow
  baserow_secret_key    = random_password.baserow_secret.result
  smtp_host             = var.smtp_host
  smtp_port             = var.smtp_port
  smtp_username         = var.smtp_username
  smtp_password         = var.smtp_password

  tags = local.common_tags

  depends_on = [module.network, module.storage, module.database, module.security]
}

# Gateway Module (Application Gateway)
module "gateway" {
  source = "../../modules/gateway"
  count  = var.enable_application_gateway && var.enable_operational_services ? 1 : 0

  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  environment              = var.environment
  gateway_subnet_id        = module.network.gateway_subnet_id
  domain_name              = var.domain_name
  docuseal_ip_address      = module.compute[0].docuseal_ip_address
  baserow_ip_address       = module.compute[0].baserow_ip_address
  ssl_certificate_data     = var.ssl_certificate_data
  ssl_certificate_password = var.ssl_certificate_password

  tags = local.common_tags

  depends_on = [module.network, module.compute]
}

# Cognitive Services Module (Document Intelligence / OCR)
module "cognitive" {
  source = "../../modules/cognitive"
  count  = var.enable_document_intelligence ? 1 : 0

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  account_name        = var.document_intelligence_name

  tags = local.common_tags
}

# Functions Module (Azure Function App for automation)
module "functions" {
  source = "../../modules/functions"
  count  = var.enable_functions ? 1 : 0

  resource_group_name                 = azurerm_resource_group.main.name
  location                            = azurerm_resource_group.main.location
  function_app_name                   = var.function_app_name
  functions_storage_account_name      = var.functions_storage_account_name
  domain_name                         = var.domain_name
  key_vault_id                        = module.security.key_vault_id
  storage_connection_string           = module.storage.storage_account_primary_connection_string
  baserow_api_token                   = var.baserow_api_token
  baserow_table_employees             = var.baserow_table_employees
  baserow_table_assets                = var.baserow_table_assets
  baserow_table_tasks                 = var.baserow_table_tasks
  baserow_table_time_clock            = var.baserow_table_time_clock
  baserow_table_incidents             = var.baserow_table_incidents
  baserow_table_vehicle_logs          = var.baserow_table_vehicle_logs
  baserow_table_expenses              = var.baserow_table_expenses
  baserow_table_document_expiry       = var.baserow_table_document_expiry
  baserow_table_deal_radar_listings   = var.baserow_table_deal_radar_listings
  baserow_table_deal_radar_quarantine = var.baserow_table_deal_radar_quarantine
  radar_enabled                       = var.radar_enabled
  radar_seed_enabled                  = var.radar_seed_enabled
  radar_row_delta_threshold_pct       = var.radar_row_delta_threshold_pct
  docuseal_api_key                    = var.docuseal_api_key
  docuseal_webhook_secret             = var.docuseal_webhook_secret
  acs_connection_string               = var.acs_connection_string
  admin_phone                         = var.admin_phone

  tags = local.common_tags

  depends_on = [module.network, module.storage, module.security]
}

# Web App Module (Next.js frontend)
module "webapp" {
  source = "../../modules/webapp"

  resource_group_name                              = azurerm_resource_group.main.name
  location                                         = azurerm_resource_group.main.location
  web_app_name                                     = var.web_app_name
  domain_name                                      = var.domain_name
  custom_domain                                    = var.custom_domain
  key_vault_id                                     = module.security.key_vault_id
  key_vault_uri                                    = module.security.key_vault_uri
  jwt_secret                                       = random_password.jwt_secret.result
  mystira_oidc_issuer                              = var.mystira_oidc_issuer
  mystira_oidc_client_id                           = var.mystira_oidc_client_id
  mystira_oidc_client_secret                       = var.mystira_oidc_client_secret
  mystira_oidc_client_secret_key_vault_secret_name = var.mystira_oidc_client_secret_key_vault_secret_name
  auth_url                                         = var.auth_url
  app_service_subnet_id                            = module.network.app_service_subnet_id
  storage_connection_string                        = module.storage.storage_account_primary_connection_string
  baserow_api_token                                = var.baserow_api_token
  baserow_database_id                              = var.baserow_database_id
  baserow_table_employees                          = var.baserow_table_employees
  baserow_table_assets                             = var.baserow_table_assets
  baserow_table_tasks                              = var.baserow_table_tasks
  baserow_table_time_clock                         = var.baserow_table_time_clock
  baserow_table_incidents                          = var.baserow_table_incidents
  baserow_table_vehicle_logs                       = var.baserow_table_vehicle_logs
  baserow_table_expenses                           = var.baserow_table_expenses
  baserow_table_document_expiry                    = var.baserow_table_document_expiry
  baserow_table_leave_requests                     = var.baserow_table_leave_requests
  baserow_table_loans                              = var.baserow_table_loans
  baserow_table_petty_cash                         = var.baserow_table_petty_cash
  baserow_table_onboarding_checklist               = var.baserow_table_onboarding_checklist
  baserow_table_budget                             = var.baserow_table_budget
  baserow_table_ppe                                = var.baserow_table_ppe
  baserow_table_policy_versions                    = var.baserow_table_policy_versions
  baserow_table_contractor_contracts               = var.baserow_table_contractor_contracts
  baserow_table_insurance_claims                   = var.baserow_table_insurance_claims
  baserow_table_deal_radar_listings                = var.baserow_table_deal_radar_listings
  radar_enabled                                    = var.radar_enabled
  docuseal_api_key                                 = var.docuseal_api_key
  document_intelligence_endpoint                   = try(module.cognitive[0].endpoint, "")
  document_intelligence_key                        = try(module.cognitive[0].primary_access_key, "")
  extra_app_settings = {
    DATABASE_URL          = try(module.database[0].connection_string_app, "")
    POSTGRES_URL          = try(module.database[0].connection_string_app, "")
    MONGODB_URI           = try(module.cosmos_mongo[0].mongo_connection_string, "")
    DB_NAME               = try(module.cosmos_mongo[0].mongo_database_name, "")
    SLUICE_BASE_URL       = var.sluice_base_url
    SLUICE_GUIDANCE_MODEL = var.sluice_guidance_model
    SLUICE_API_KEY        = var.sluice_api_key_key_vault_secret_name != "" ? "@Microsoft.KeyVault(SecretUri=${module.security.key_vault_uri}secrets/${var.sluice_api_key_key_vault_secret_name})" : ""
  }

  tags = local.common_tags

  depends_on = [module.network, module.storage, module.security, module.database]
}

# DNS Module (Azure DNS records for nexamesh.ai)
module "dns" {
  source = "../../modules/dns"
  count  = var.enable_dns_records && var.enable_application_gateway && var.enable_operational_services ? 1 : 0

  dns_zone_name           = var.dns_zone_name
  dns_zone_resource_group = var.dns_zone_resource_group
  gateway_public_ip       = module.gateway[0].public_ip_address
  create_root_record      = true

  tags = local.common_tags

  depends_on = [module.gateway]
}


# Monitoring Module (alerts, budgets, Log Analytics)
module "monitoring" {
  source = "../../modules/monitoring"
  count  = var.enable_monitoring && var.enable_functions ? 1 : 0

  resource_group_name       = azurerm_resource_group.main.name
  resource_group_id         = azurerm_resource_group.main.id
  location                  = azurerm_resource_group.main.location
  workspace_name            = "${var.project_prefix}-${var.environment}-${var.project_name}-law-${var.location_short}"
  alert_email               = "hans@nexamesh.ai"
  database_server_id        = try(module.database[0].server_id, "")
  enable_database_alerts    = var.enable_database
  function_app_id           = module.functions[0].function_app_id
  function_app_insights_id  = module.functions[0].application_insights_id
  enable_function_alerts    = true
  enable_radar_alerts       = var.enable_radar_alerts
  web_app_id                = module.webapp.web_app_id
  enable_webapp_alerts      = true
  enable_consumption_budget = false # MS-AZR-0036P (Visual Studio) does not support Cost Management

  tags = local.common_tags

  depends_on = [module.webapp]
}

# Random passwords for application secrets
resource "random_password" "docuseal_secret" {
  length  = 64
  special = true
}

resource "random_password" "baserow_secret" {
  length  = 64
  special = true
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

# Local values
locals {
  common_tags = {
    Environment = var.environment
    Project     = "House of Veritas"
    ManagedBy   = "Terraform"
    Owner       = "Hans Jurgens Smit"
  }

  deployer_ip_trimmed  = trimspace(var.deployer_ip)
  deployer_ip_public   = local.deployer_ip_trimmed != "" && !can(regex("^(10\\.|172\\.|192\\.168\\.)", local.deployer_ip_trimmed)) ? [local.deployer_ip_trimmed] : []
  azure_internal_cidrs = ["172.128.0.0/9"]

  ci_ip_rules_keyvault = distinct(concat(local.deployer_ip_public, local.azure_internal_cidrs))
  ci_ip_rules_storage  = local.deployer_ip_public
}
