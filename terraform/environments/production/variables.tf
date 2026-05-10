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
  default     = "san"
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
  default     = "nl-prod-hov-rg-san"
}

# Network variables
variable "vnet_name" {
  description = "Virtual network name"
  type        = string
  default     = "nl-prod-hov-vnet-san"
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

variable "runner_subnet_prefix" {
  description = "Runner subnet prefix for CI"
  type        = string
  default     = "10.0.4.0/28"
}

# Storage variables
variable "storage_account_name" {
  description = "Storage account name (must be globally unique, no hyphens)"
  type        = string
  default     = "nlprodhovstsan"
}

# Security variables
variable "key_vault_name" {
  description = "Key Vault name (must be globally unique)"
  type        = string
  default     = "nl-prod-hov-kv-san"
}

# Database variables
variable "db_server_name" {
  description = "PostgreSQL server name"
  type        = string
  default     = "nl-prod-hov-pg-san"
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
  default     = "nlprodhovcosmosan"
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
  default     = false
}

# Container variables
variable "docuseal_container_name" {
  description = "DocuSeal container instance name"
  type        = string
  default     = "nl-prod-hov-aci-docuseal-san"
}

variable "baserow_container_name" {
  description = "Baserow container instance name"
  type        = string
  default     = "nl-prod-hov-aci-baserow-san"
}

# Gateway variables
variable "app_gateway_name" {
  description = "Application Gateway name"
  type        = string
  default     = "nl-prod-hov-agw-san"
}

# Web App variables
variable "web_app_name" {
  description = "Azure Web App name for the Next.js frontend"
  type        = string
  default     = "nl-prod-hov-app-san"
}

# Function App variables
variable "function_app_name" {
  description = "Azure Function App name"
  type        = string
  default     = "nl-prod-hov-func-san"
}

variable "functions_storage_account_name" {
  description = "Storage account for Function App code (must be globally unique, no hyphens)"
  type        = string
  default     = "nlprodhovfuncstsan"
}

variable "baserow_api_token" {
  description = "Baserow API token for function app integrations"
  type        = string
  sensitive   = true
  default     = ""
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
  default     = "nl-prod-hov-di-san"
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
  default     = "nl-prod-nexamesh-rg-san"
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
