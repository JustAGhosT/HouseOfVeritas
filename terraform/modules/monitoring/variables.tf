variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "resource_group_id" {
  description = "ID of the resource group (for budget scope)"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "workspace_name" {
  description = "Log Analytics workspace name"
  type        = string
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
}

variable "database_server_id" {
  description = "PostgreSQL server resource ID for monitoring"
  type        = string
  default     = ""
}

variable "enable_database_alerts" {
  description = "Whether to create database metric alerts"
  type        = bool
  default     = false
}

variable "function_app_id" {
  description = "Function App resource ID for monitoring"
  type        = string
  default     = ""
}

variable "function_app_insights_id" {
  description = "Application Insights component ID for the Function App"
  type        = string
  default     = ""
}

variable "enable_function_alerts" {
  description = "Whether to create function app metric alerts"
  type        = bool
  default     = false
}

variable "enable_radar_alerts" {
  description = "Whether to create Deal Radar ingestion alerts"
  type        = bool
  default     = false
}

variable "web_app_id" {
  description = "Web App resource ID for monitoring"
  type        = string
  default     = ""
}

variable "enable_webapp_alerts" {
  description = "Whether to create web app metric alerts"
  type        = bool
  default     = false
}

variable "enable_consumption_budget" {
  description = "Create consumption budget. Requires EA, Web direct, or MCA subscription. Disable for Visual Studio/MSDN (offerType None). Opt-in; set true when subscription supports Cost Management."
  type        = bool
  default     = false
}

variable "monthly_budget" {
  description = "Monthly budget in ZAR (used when enable_consumption_budget is true)"
  type        = number
  default     = 1000
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
