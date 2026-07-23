variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "server_name" {
  description = "Name of the PostgreSQL server"
  type        = string
}

variable "admin_username" {
  description = "Administrator username"
  type        = string
  default     = "hov_admin"
}

variable "admin_password" {
  description = "Administrator password"
  type        = string
  sensitive   = true
}

variable "sku_name" {
  description = "PostgreSQL Flexible Server Terraform SKU. B_Standard_B1ms maps to the lowest burstable Standard_B1ms SKU available in South Africa North."
  type        = string
  default     = "B_Standard_B1ms"
}

variable "storage_mb" {
  description = "Provisioned PostgreSQL storage in MB. 32768 is the minimum managed disk size returned for South Africa North."
  type        = number
  default     = 32768
}

variable "app_database_name" {
  description = "Database name for the House of Veritas web application"
  type        = string
  default     = "house_of_veritas"
}

variable "database_subnet_id" {
  description = "ID of the database subnet"
  type        = string
}

variable "vnet_id" {
  description = "ID of the virtual network"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
