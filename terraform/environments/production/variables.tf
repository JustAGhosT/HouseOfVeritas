variable "environment" {
  description = "Environment name (prod, dev, staging)"
  type        = string
  default     = "prod"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "South Africa North"
}

variable "location_short" {
  description = "Short location code for naming"
  type        = string
  default     = ""
}

variable "project_prefix" {
  description = "Project naming prefix"
  type        = string
  default     = "nl"
}

variable "project_name" {
  description = "Project short name"
  type        = string
  default     = "hov"
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "nl-prod-hov-rg"
}

# Network variables
variable "vnet_name" {
  description = "Virtual network name"
  type        = string
  default     = "nl-prod-hov-vnet"
}

variable "vnet_address_space" {
  description = "Address space for VNet"
  type        = string
  default     = "10.0.0.0/16"
}

variable "gateway_subnet_prefix" {
  description = "Gateway subnet prefix"
  type        = string
  default     = "10.0.1.0/24"
}

variable "container_subnet_prefix" {
  description = "Container subnet prefix"
  type        = string
  default     = "10.0.2.0/24"
}

variable "database_subnet_prefix" {
  description = "Database subnet prefix"
  type        = string
  default     = "10.0.3.0/24"
}


# Storage variables
variable "storage_account_name" {
  description = "Storage account name (must be globally unique, no hyphens)"
  type        = string
  default     = "nlprodhovst"
}

variable "storage_account_replication_type" {
  description = "Storage account replication type"
  type        = string
  default     = "LRS"

  validation {
    condition     = contains(["LRS", "GRS", "RAGRS", "ZRS", "GZRS", "RAGZRS"], var.storage_account_replication_type)
    error_message = "storage_account_replication_type must be one of LRS, GRS, RAGRS, ZRS, GZRS, or RAGZRS."
  }
}

variable "storage_network_default_action" {
  description = "Default network action for the storage account firewall"
  type        = string
  default     = "Allow"

  validation {
    condition     = contains(["Allow", "Deny"], var.storage_network_default_action)
    error_message = "storage_network_default_action must be Allow or Deny."
  }
}

# Security variables
variable "key_vault_name" {
  description = "Key Vault name (must be globally unique)"
  type        = string
  default     = "nl-prod-hov-kv"
}

variable "terraform_key_vault_access_policy_object_id" {
  description = "Microsoft Entra object ID for the deploy principal granted Key Vault data-plane access"
  type        = string
  default     = "593a093c-d4fd-4390-977b-a64abfc97606"
}

variable "key_vault_network_default_action" {
  description = "Default network action for the Key Vault firewall"
  type        = string
  default     = "Allow"

  validation {
    condition     = contains(["Allow", "Deny"], var.key_vault_network_default_action)
    error_message = "key_vault_network_default_action must be Allow or Deny."
  }
}

# Database variables
variable "db_server_name" {
  description = "PostgreSQL server name"
  type        = string
  default     = "nl-prod-hov-pg"
}

variable "db_admin_username" {
  description = "Database admin username"
  type        = string
  default     = "hov_admin"
}

variable "db_admin_password" {
  description = "Database admin password"
  type        = string
  sensitive   = true
}

variable "cosmos_account_name" {
  description = "Cosmos DB account name (Mongo API)"
  type        = string
  default     = "nlprodhovcosmos"
}

variable "cosmos_mongo_database_name" {
  description = "Cosmos Mongo database name"
  type        = string
  default     = "house_of_veritas"
}

variable "cosmos_mongo_collection_name" {
  description = "Cosmos Mongo collection name"
  type        = string
  default     = "kiosk_requests"
}

variable "cosmos_mongo_throughput" {
  description = "Cosmos Mongo throughput (RU/s)"
  type        = number
  default     = 400
}

variable "cosmos_public_network_access_enabled" {
  description = "Enable public network access for Cosmos DB"
  type        = bool
  default     = true
}

variable "cosmos_enable_free_tier" {
  description = "Enable Cosmos DB free tier"
  type        = bool
  default     = true
}

variable "enable_cosmos_mongo" {
  description = "Whether to provision Cosmos DB Mongo resources"
  type        = bool
  default     = false
}

variable "enable_database" {
  description = "Whether to provision PostgreSQL Flexible Server resources"
  type        = bool
  default     = false
}

variable "enable_operational_services" {
  description = "Whether to provision always-on DocuSeal and Baserow container instances"
  type        = bool
  default     = false
}

variable "enable_application_gateway" {
  description = "Whether to provision Application Gateway WAF and its public IP"
  type        = bool
  default     = false
}

variable "enable_dns_records" {
  description = "Whether Terraform should manage docs/ops/root Azure DNS records"
  type        = bool
  default     = false
}

variable "enable_functions" {
  description = "Whether to provision the Azure Function App automation stack"
  type        = bool
  default     = false
}

variable "enable_monitoring" {
  description = "Whether to provision Log Analytics and metric alerts"
  type        = bool
  default     = false
}

variable "enable_radar_alerts" {
  description = "Whether to provision Deal Radar ingestion alert rules"
  type        = bool
  default     = false
}

variable "enable_document_intelligence" {
  description = "Whether to provision Azure AI Document Intelligence"
  type        = bool
  default     = false
}

# Container variables
variable "docuseal_container_name" {
  description = "DocuSeal container instance name"
  type        = string
  default     = "nl-prod-hov-aci-docuseal"
}

variable "baserow_container_name" {
  description = "Baserow container instance name"
  type        = string
  default     = "nl-prod-hov-aci-baserow"
}

# Gateway variables
variable "app_gateway_name" {
  description = "Application Gateway name"
  type        = string
  default     = "nl-prod-hov-agw"
}

# Web App variables
variable "web_app_name" {
  description = "Azure Web App name for the Next.js frontend"
  type        = string
  default     = "nl-prod-hov-app"
}

# Function App variables
variable "function_app_name" {
  description = "Azure Function App name"
  type        = string
  default     = "nl-prod-hov-func"
}

variable "functions_storage_account_name" {
  description = "Storage account for Function App code (must be globally unique, no hyphens)"
  type        = string
  default     = "nlprodhovfuncst"
}

variable "baserow_api_token" {
  description = "Baserow API token for function app integrations"
  type        = string
  sensitive   = true
  default     = ""
}

variable "baserow_database_id" {
  description = "Baserow database ID for operational data"
  type        = string
  default     = ""
}

variable "baserow_table_employees" {
  description = "Baserow table ID for Employees"
  type        = string
  default     = "0"
}

variable "baserow_table_assets" {
  description = "Baserow table ID for Assets"
  type        = string
  default     = "0"
}

variable "baserow_table_tasks" {
  description = "Baserow table ID for Tasks"
  type        = string
  default     = "0"
}

variable "baserow_table_time_clock" {
  description = "Baserow table ID for Time Clock Entries"
  type        = string
  default     = "0"
}

variable "baserow_table_incidents" {
  description = "Baserow table ID for Incidents"
  type        = string
  default     = "0"
}

variable "baserow_table_vehicle_logs" {
  description = "Baserow table ID for Vehicle Logs"
  type        = string
  default     = "0"
}

variable "baserow_table_expenses" {
  description = "Baserow table ID for Expenses"
  type        = string
  default     = "0"
}

variable "baserow_table_document_expiry" {
  description = "Baserow table ID for Document Expiry"
  type        = string
  default     = "0"
}

variable "baserow_table_leave_requests" {
  description = "Baserow table ID for Leave Requests"
  type        = string
  default     = "0"
}

variable "baserow_table_loans" {
  description = "Baserow table ID for Loans/Advances"
  type        = string
  default     = "0"
}

variable "baserow_table_petty_cash" {
  description = "Baserow table ID for Petty Cash"
  type        = string
  default     = "0"
}

variable "baserow_table_onboarding_checklist" {
  description = "Baserow table ID for Onboarding Checklist"
  type        = string
  default     = "0"
}

variable "baserow_table_budget" {
  description = "Baserow table ID for Budget"
  type        = string
  default     = "0"
}

variable "baserow_table_ppe" {
  description = "Baserow table ID for PPE/Equipment"
  type        = string
  default     = "0"
}

variable "baserow_table_policy_versions" {
  description = "Baserow table ID for Policy Versions"
  type        = string
  default     = "0"
}

variable "baserow_table_contractor_contracts" {
  description = "Baserow table ID for Contractor Contracts"
  type        = string
  default     = "0"
}

variable "baserow_table_insurance_claims" {
  description = "Baserow table ID for Insurance Claims"
  type        = string
  default     = "0"
}

variable "baserow_table_deal_radar_listings" {
  description = "Baserow table ID for Deal Radar listings"
  type        = string
  default     = ""
}

variable "baserow_table_deal_radar_quarantine" {
  description = "Baserow table ID for Deal Radar quarantine"
  type        = string
  default     = ""
}

variable "radar_enabled" {
  description = "Expose and publish the public Deal Radar experience"
  type        = bool
  default     = false
}

variable "radar_seed_enabled" {
  description = "Allow the Deal Radar seed source to run"
  type        = bool
  default     = false
}

variable "radar_row_delta_threshold_pct" {
  description = "Percent row-count delta that quarantines a Deal Radar ingestion batch"
  type        = number
  default     = 60
}

variable "docuseal_api_key" {
  description = "DocuSeal API key for function app integrations"
  type        = string
  sensitive   = true
  default     = ""
}

variable "docuseal_webhook_secret" {
  description = "Secret for validating DocuSeal webhook signatures"
  type        = string
  sensitive   = true
  default     = ""
}

variable "acs_connection_string" {
  description = "Azure Communication Services connection string for email"
  type        = string
  sensitive   = true
  default     = ""
}

variable "admin_phone" {
  description = "Admin phone number for SMS alerts"
  type        = string
  default     = ""
}

# Domain variables
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "nexamesh.ai"
}
variable "custom_domain" {
  description = "Canonical custom hostname bound to the HOV web app. DNS is owned by neuralliquid-org."
  type        = string
  default     = "hov.neuralliquid.ai"
}

# -----------------------------------------------------------------------------
# Auth.js v5 + Mystira OIDC (relying party: neuralliquid-hov-web)
# -----------------------------------------------------------------------------
# The issuer defaults to the deployed Mystira dev IdP, which is the identity
# provider HOV currently authenticates against. When a dedicated staging/prod
# Mystira issuer is provisioned, override MYSTIRA_OIDC_ISSUER (and supply the
# matching client secret from Key Vault / GitHub secrets). The issuer host is
# public config, not a secret — see .env.example.
variable "mystira_oidc_issuer" {
  description = "Mystira OIDC issuer URL"
  type        = string
  default     = "https://identity.mystira.app"
}

variable "mystira_oidc_client_id" {
  description = "Mystira OIDC client ID for the House of Veritas relying party"
  type        = string
  default     = "neuralliquid-hov-web"
}

# Supply via a GitHub Actions secret / untracked tfvars — never commit the value.
# When empty, the app falls back to its in-code dev client secret, which matches
# the seeded neuralliquid-hov-web client on the dev IdP above.
variable "mystira_oidc_client_secret" {
  description = "Mystira OIDC client secret for the House of Veritas relying party"
  type        = string
  sensitive   = true
  default     = ""
}

# Pinned to the canonical public host. Auth.js MUST emit callback URLs on the
# exact host the Mystira IdP allowlists for the neuralliquid-hov-web client
# (https://hov.neuralliquid.ai/api/auth/callback/mystira). The app is reachable
# at both hov.neuralliquid.ai and nl-prod-hov-app.azurewebsites.net; deriving the
# callback from the request host would produce the azurewebsites.net URL, which
# the IdP rejects (ID2043). Pinning AUTH_URL forces the allowlisted host
# regardless of entry point. Change this only alongside the IdP redirect-URI
# allowlist in phoenixvc/mystira-workspace.
variable "auth_url" {
  description = "Canonical public base URL for Auth.js (must match the IdP-allowlisted callback host)"
  type        = string
  default     = "https://hov.neuralliquid.ai"
}

# SMTP variables
variable "smtp_host" {
  description = "SMTP server host (used by DocuSeal — ACS Email exposes SMTP relay at smtp.azurecomm.net)"
  type        = string
  default     = "smtp.azurecomm.net"
}

variable "smtp_port" {
  description = "SMTP server port"
  type        = string
  default     = "587"
}

variable "smtp_username" {
  description = "SMTP username"
  type        = string
  default     = "apikey"
}

variable "smtp_password" {
  description = "SMTP password"
  type        = string
  sensitive   = true
}

# Document Intelligence (OCR) variables
variable "document_intelligence_name" {
  description = "Name of the Document Intelligence account"
  type        = string
  default     = "nl-prod-hov-di"
}

# DNS variables
variable "dns_zone_name" {
  description = "Azure DNS zone name"
  type        = string
  default     = "nexamesh.ai"
}

variable "dns_zone_resource_group" {
  description = "Resource group containing the DNS zone"
  type        = string
  default     = "mys-global-shared-rg"
}

# SSL Certificate variables
variable "ssl_certificate_data" {
  description = "SSL certificate data (base64 encoded PFX)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ssl_certificate_password" {
  description = "SSL certificate password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "deployer_ip" {
  description = "Public IP of the deployer (CI runner) to whitelist on Key Vault and Storage firewalls"
  type        = string
  default     = ""
}

variable "ci_allowed_ip_ranges" {
  description = "CIDR blocks for CI runners (e.g. GitHub Actions IPs from api.github.com/meta). When set, used instead of deployer_ip for persistent firewall rules."
  type        = list(string)
  default     = []
}
variable "mystira_oidc_client_secret_key_vault_secret_name" {
  description = "Name of the HOV Key Vault secret containing the Mystira OIDC client secret. Leave empty until the secret exists and issuer cutover is approved."
  type        = string
  default     = "mystira-oidc-client-secret"
}
