variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "account_name" {
  description = "Cosmos DB account name (must be globally unique, lowercase alphanumeric)"
  type        = string
}

variable "mongo_database_name" {
  description = "Mongo database name"
  type        = string
}

variable "mongo_collection_name" {
  description = "Mongo collection name"
  type        = string
}

variable "throughput" {
  description = "Provisioned throughput (RU/s). Must be between 400 and 1000000."
  type        = number
  default     = 400

  validation {
    condition     = var.throughput >= 400 && var.throughput <= 1000000
    error_message = "Throughput must be between 400 and 1000000 RU/s."
  }
}

variable "public_network_access_enabled" {
  description = "Whether public network access is enabled. Defaults to true for backward compatibility. SECURITY NOTICE: This default will change to false in a future release. All calling modules/environments should explicitly set public_network_access_enabled = false for production security before the enforced change."
  type        = bool
  default     = false
}

variable "private_endpoint_subnet_id" {
  description = "Subnet ID for the Cosmos DB private endpoint when public network access is disabled"
  type        = string
  default     = ""
}

variable "vnet_id" {
  description = "VNet ID linked to the Cosmos DB private DNS zone when public network access is disabled"
  type        = string
  default     = ""
}

variable "private_dns_zone_name" {
  description = "Private DNS zone name for Cosmos DB Mongo private endpoints"
  type        = string
  default     = "privatelink.mongo.cosmos.azure.com"
}

variable "enable_free_tier" {
  description = "Enable Cosmos DB free tier"
  type        = bool
  default     = false
}

variable "consistency_level" {
  description = "Consistency level. Allowed values: Eventual, ConsistentPrefix, Session, BoundedStaleness, Strong"
  type        = string
  default     = "Session"

  validation {
    condition     = contains(["Eventual", "ConsistentPrefix", "Session", "BoundedStaleness", "Strong"], var.consistency_level)
    error_message = "Consistency level must be one of: Eventual, ConsistentPrefix, Session, BoundedStaleness, Strong."
  }
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
