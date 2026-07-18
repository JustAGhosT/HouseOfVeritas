variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "environment" {
  description = "Environment name (production, staging, etc.)"
  type        = string
}

variable "vnet_name" {
  description = "Name of the virtual network"
  type        = string
}

variable "vnet_address_space" {
  description = "Address space for the VNet"
  type        = string
  default     = "10.0.0.0/16"
}

variable "gateway_subnet_prefix" {
  description = "Address prefix for gateway subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "container_subnet_prefix" {
  description = "Address prefix for container subnet"
  type        = string
  default     = "10.0.2.0/24"
}

variable "database_subnet_prefix" {
  description = "Address prefix for database subnet"
  type        = string
  default     = "10.0.3.0/24"
}


variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
