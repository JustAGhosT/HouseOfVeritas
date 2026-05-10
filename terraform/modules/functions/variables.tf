variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "function_app_name" {
  description = "Name of the Azure Function App"
  type        = string
}

variable "functions_storage_account_name" {
  description = "Storage account name for Function App code (must be globally unique, no hyphens)"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

variable "key_vault_id" {
  description = "ID of the Key Vault"
  type        = string
}

variable "storage_connection_string" {
  description = "Connection string for the main storage account (backups, documents)"
  type        = string
  sensitive   = true
}

variable "baserow_api_token" {
  description = "Baserow API token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "docuseal_api_key" {
  description = "DocuSeal API key"
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

variable "baserow_table_employees" {
  description = "Baserow table ID for Employees"
  type        = string
  default     = "1"
}

variable "baserow_table_assets" {
  description = "Baserow table ID for Assets"
  type        = string
  default     = "2"
}

variable "baserow_table_tasks" {
  description = "Baserow table ID for Tasks"
  type        = string
  default     = "3"
}

variable "baserow_table_time_clock" {
  description = "Baserow table ID for Time Clock Entries"
  type        = string
  default     = "4"
}

variable "baserow_table_incidents" {
  description = "Baserow table ID for Incidents"
  type        = string
  default     = "5"
}

variable "baserow_table_vehicle_logs" {
  description = "Baserow table ID for Vehicle Logs"
  type        = string
  default     = "6"
}

variable "baserow_table_expenses" {
  description = "Baserow table ID for Expenses"
  type        = string
  default     = "7"
}

variable "baserow_table_document_expiry" {
  description = "Baserow table ID for Document Expiry"
  type        = string
  default     = "8"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
