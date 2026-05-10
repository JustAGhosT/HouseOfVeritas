# Main Terraform configuration for House of Veritas - Production Environment

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.80"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
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

  resource_group_name     = azurerm_resource_group.main.name
  location                = azurerm_resource_group.main.location
  environment             = var.environment
  vnet_name               = var.vnet_name
  vnet_address_space      = var.vnet_address_space
  gateway_subnet_prefix   = var.gateway_subnet_prefix
  container_subnet_prefix = var.container_subnet_prefix
  database_subnet_prefix  = var.database_subnet_prefix
  runner_subnet_prefix    = var.runner_subnet_prefix

  tags = local.common_tags
}

# Storage Module
module "storage" {
  source = "../../modules/storage"

  resource_group_name   = azurerm_resource_group.main.name
  location              = azurerm_resource_group.main.location
  storage_account_name  = var.storage_account_name
  container_subnet_id   = module.network.container_subnet_id
  database_subnet_id    = module.network.database_subnet_id
  runner_subnet_id      = module.network.runner_subnet_id
  deployer_ip_addresses = local.ci_ip_rules_storage

  tags = local.common_tags
}

# Security Module (Key Vault)
module "security" {
  source = "../../modules/security"

  resource_group_name   = azurerm_resource_group.main.name
  location              = azurerm_resource_group.main.location
  key_vault_name        = var.key_vault_name
  container_subnet_id   = module.network.container_subnet_id
  runner_subnet_id      = module.network.runner_subnet_id
  deployer_ip_addresses = local.ci_ip_rules_keyvault
  db_admin_password     = var.db_admin_password
  docuseal_secret_key   = random_password.docuseal_secret.result
  baserow_secret_key    = random_password.baserow_secret.result
  smtp_password         = var.smtp_password

  tags = local.common_tags
}

# Database Module
module "database" {
  source = "../../modules/database"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  server_name         = var.db_server_name
  admin_username      = var.db_admin_username
  admin_password      = var.db_admin_password
  database_subnet_id  = module.network.database_subnet_id
  vnet_id             = module.network.vnet_id

  tags = local.common_tags

  depends_on = [module.network, module.security]
}

module "cosmos_mongo" {
  source = "../../modules/cosmosdb-mongo"

  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  account_name                  = var.cosmos_account_name
  mongo_database_name           = var.cosmos_mongo_database_name
  mongo_collection_name         = var.cosmos_mongo_collection_name
  throughput                    = var.cosmos_mongo_throughput
  public_network_access_enabled = var.cosmos_public_network_access_enabled
  enable_free_tier              = var.cosmos_enable_free_tier

  tags = local.common_tags

  depends_on = [module.network]
}

# Compute Module (Container Instances)
module "compute" {
  source = "../../modules/compute"

  resource_group_name   = azurerm_resource_group.main.name
  location              = azurerm_resource_group.main.location
  environment           = var.environment
  container_subnet_id   = module.network.container_subnet_id
  storage_account_name  = module.storage.storage_account_name
  storage_account_key   = module.storage.primary_access_key
  key_vault_id          = module.security.key_vault_id
  domain_name           = var.domain_name
  docuseal_database_url = module.database.connection_string_docuseal
  docuseal_secret_key   = random_password.docuseal_secret.result
  baserow_database_url  = module.database.connection_string_baserow
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

  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  environment              = var.environment
  gateway_subnet_id        = module.network.gateway_subnet_id
  domain_name              = var.domain_name
  docuseal_ip_address      = module.compute.docuseal_ip_address
  baserow_ip_address       = module.compute.baserow_ip_address
  ssl_certificate_data     = var.ssl_certificate_data
  ssl_certificate_password = var.ssl_certificate_password

  tags = local.common_tags

  depends_on = [module.network, module.compute]
}

# Cognitive Services Module (Document Intelligence / OCR)
module "cognitive" {
  source = "../../modules/cognitive"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  account_name        = var.document_intelligence_name

  tags = local.common_tags
}

# Functions Module (Azure Function App for automation)
module "functions" {
  source = "../../modules/functions"

  resource_group_name            = azurerm_resource_group.main.name
  location                       = azurerm_resource_group.main.location
  function_app_name              = var.function_app_name
  functions_storage_account_name = var.functions_storage_account_name
  domain_name                    = var.domain_name
  key_vault_id                   = module.security.key_vault_id
  storage_connection_string      = module.storage.storage_account_primary_connection_string
  baserow_api_token              = var.baserow_api_token
  docuseal_api_key               = var.docuseal_api_key
  docuseal_webhook_secret        = var.docuseal_webhook_secret
  acs_connection_string          = var.acs_connection_string
  admin_phone                    = var.admin_phone

  tags = local.common_tags

  depends_on = [module.network, module.storage, module.security]
}

# Web App Module (Next.js frontend)
module "webapp" {
  source = "../../modules/webapp"

  resource_group_name            = azurerm_resource_group.main.name
  location                       = azurerm_resource_group.main.location
  web_app_name                   = var.web_app_name
  domain_name                    = var.domain_name
  key_vault_id                   = module.security.key_vault_id
  jwt_secret                     = random_password.jwt_secret.result
  storage_connection_string      = module.storage.storage_account_primary_connection_string
  baserow_api_token              = var.baserow_api_token
  docuseal_api_key               = var.docuseal_api_key
  document_intelligence_endpoint = module.cognitive.endpoint
  document_intelligence_key      = module.cognitive.primary_access_key
  extra_app_settings = {
    MONGODB_URI = module.cosmos_mongo.mongo_connection_string
    DB_NAME     = module.cosmos_mongo.mongo_database_name
  }

  tags = local.common_tags

  depends_on = [module.network, module.storage, module.security, module.cognitive, module.cosmos_mongo]
}

# DNS Module (Azure DNS records for nexamesh.ai)
module "dns" {
  source = "../../modules/dns"

  dns_zone_name           = var.dns_zone_name
  dns_zone_resource_group = var.dns_zone_resource_group
  gateway_public_ip       = module.gateway.public_ip_address
  create_root_record      = true

  tags = local.common_tags

  depends_on = [module.gateway]
}

# Runner infrastructure is in phoenixvc-actions-runner repo (deploys into runner_subnet_id)

# Monitoring Module (alerts, budgets, Log Analytics)
module "monitoring" {
  source = "../../modules/monitoring"

  resource_group_name       = azurerm_resource_group.main.name
  resource_group_id         = azurerm_resource_group.main.id
  location                  = azurerm_resource_group.main.location
  workspace_name            = "${var.project_prefix}-${var.environment}-${var.project_name}-law-${var.location_short}"
  alert_email               = "hans@nexamesh.ai"
  database_server_id        = module.database.server_id
  enable_database_alerts    = true
  function_app_id           = module.functions.function_app_id
  enable_function_alerts    = true
  web_app_id                = module.webapp.web_app_id
  enable_webapp_alerts      = true
  enable_consumption_budget = false # MS-AZR-0036P (Visual Studio) does not support Cost Management

  tags = local.common_tags

  depends_on = [module.database, module.functions, module.webapp]
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
