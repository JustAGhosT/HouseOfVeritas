variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "web_app_name" {
  description = "Name of the Web App"
  type        = string
}

variable "domain_name" {
  description = "Root domain name"
  type        = string
}

variable "custom_domain" {
  description = "Custom domain to bind (empty to skip)"
  type        = string
  default     = ""
}

variable "key_vault_id" {
  description = "Key Vault ID for managed identity access"
  type        = string
}

variable "baserow_api_token" {
  description = "Baserow API token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "baserow_database_id" {
  description = "Baserow database ID"
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

variable "radar_enabled" {
  description = "Expose the public Deal Radar surface"
  type        = bool
  default     = false
}

variable "docuseal_api_key" {
  description = "DocuSeal API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "jwt_secret" {
  description = "JWT signing secret for auth (also used as Auth.js AUTH_SECRET)"
  type        = string
  sensitive   = true
}

variable "mystira_oidc_issuer" {
  description = "Mystira OIDC issuer URL (relying party: neuralliquid-hov-web). Empty leaves the app on its in-code dev default."
  type        = string
  default     = ""
}

variable "mystira_oidc_authorization_endpoint" {
  description = "Browser-facing Mystira authorization endpoint. May use an HOV-owned custom hostname while issuer/token endpoints remain canonical Mystira Identity."
  type        = string
  default     = ""

  validation {
    condition     = var.mystira_oidc_authorization_endpoint == "" || can(regex("^https://[^/]+/connect/authorize$", var.mystira_oidc_authorization_endpoint))
    error_message = "mystira_oidc_authorization_endpoint must be empty or an HTTPS /connect/authorize URL."
  }
}

variable "mystira_oidc_client_id" {
  description = "Mystira OIDC client ID for the House of Veritas relying party"
  type        = string
  default     = ""
}

variable "mystira_oidc_client_secret" {
  description = "Mystira OIDC client secret for the House of Veritas relying party"
  type        = string
  sensitive   = true
  default     = ""
}

variable "auth_url" {
  description = "Canonical public base URL for Auth.js (e.g. https://hov.neuralliquid.ai). Leave empty to let Auth.js derive it from the trusted request host."
  type        = string
  default     = ""
}

variable "app_service_subnet_id" {
  description = "Subnet ID for App Service regional VNet integration"
  type        = string
  default     = ""
}

variable "storage_connection_string" {
  description = "Azure Storage connection string"
  type        = string
  sensitive   = true
  default     = ""
}

variable "document_intelligence_endpoint" {
  description = "Document Intelligence endpoint"
  type        = string
  default     = ""
}

variable "document_intelligence_key" {
  description = "Document Intelligence key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "extra_app_settings" {
  description = "Additional app settings to merge"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
variable "key_vault_uri" {
  description = "Key Vault URI used for App Service Key Vault references"
  type        = string
}
variable "mystira_oidc_client_secret_key_vault_secret_name" {
  description = "Name of the HOV Key Vault secret containing the Mystira OIDC client secret. When set, MYSTIRA_OIDC_CLIENT_SECRET is emitted as a Key Vault reference."
  type        = string
  default     = ""
}
