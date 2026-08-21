variable "target_tenant_id" {
  description = "Exact Celladore Systems tenant ID authorized for this target root."
  type        = string
  default     = "5384ef74-e517-4b22-9472-df990f61e8b5"

  validation {
    condition     = var.target_tenant_id == "5384ef74-e517-4b22-9472-df990f61e8b5"
    error_message = "Foundation/data may run only in the approved Celladore Systems tenant."
  }
}

variable "target_subscription_id" {
  description = "Exact nexamesh-sub subscription ID authorized for this target root."
  type        = string
  default     = "8a5dc70a-bafa-4a04-a281-9b4862a70810"

  validation {
    condition     = var.target_subscription_id == "8a5dc70a-bafa-4a04-a281-9b4862a70810"
    error_message = "Foundation/data may run only in the approved nexamesh-sub subscription."
  }
}

variable "location" {
  description = "Approved primary Azure region for HOV estate data."
  type        = string
  default     = "southafricanorth"

  validation {
    condition     = var.location == "southafricanorth"
    error_message = "The approved HOV migration target region is southafricanorth."
  }
}

variable "resource_group_name" {
  description = "Isolated HOV target resource group."
  type        = string
  default     = "nex-prod-hov-rg"

  validation {
    condition     = var.resource_group_name == "nex-prod-hov-rg"
    error_message = "The foundation/data resource group must be nex-prod-hov-rg."
  }
}

variable "vnet_name" {
  description = "HOV target virtual network name."
  type        = string
  default     = "nex-prod-hov-vnet"

  validation {
    condition     = var.vnet_name == "nex-prod-hov-vnet"
    error_message = "The target VNet must use the reviewed nex-prod-hov-vnet name."
  }
}

variable "vnet_address_space" {
  description = "Address space reserved for the isolated HOV target VNet."
  type        = list(string)
  default     = ["10.42.0.0/16"]
}

variable "app_service_subnet_prefixes" {
  description = "Address prefixes for outbound App Service VNet integration."
  type        = list(string)
  default     = ["10.42.1.0/24"]
}

variable "postgres_subnet_prefixes" {
  description = "Address prefixes for the delegated PostgreSQL subnet."
  type        = list(string)
  default     = ["10.42.2.0/24"]
}

variable "private_endpoints_subnet_prefixes" {
  description = "Address prefixes for Storage, Key Vault and Cosmos private endpoints."
  type        = list(string)
  default     = ["10.42.3.0/24"]
}

variable "migration_runner_subnet_prefixes" {
  description = "Address prefixes for separately gated, ephemeral migration runners."
  type        = list(string)
  default     = ["10.42.4.0/24"]
}

variable "app_storage_account_name" {
  description = "Globally unique HOV application storage account name."
  type        = string
  default     = "nexprodhovst"

  validation {
    condition     = var.app_storage_account_name == "nexprodhovst"
    error_message = "Use the reviewed target application storage account name."
  }
}

variable "key_vault_name" {
  description = "Globally unique target HOV Key Vault name."
  type        = string
  default     = "nex-prod-hov-kv"

  validation {
    condition     = var.key_vault_name == "nex-prod-hov-kv"
    error_message = "Use the reviewed target Key Vault name nex-prod-hov-kv."
  }
}

variable "postgres_server_name" {
  description = "Globally unique target HOV PostgreSQL Flexible Server name."
  type        = string
  default     = "nex-prod-hov-pg"

  validation {
    condition     = var.postgres_server_name == "nex-prod-hov-pg"
    error_message = "Use the reviewed target PostgreSQL server name nex-prod-hov-pg."
  }
}

variable "postgres_database_name" {
  description = "Dedicated HOV estate database name."
  type        = string
  default     = "houseofveritas"

  validation {
    condition     = var.postgres_database_name == "houseofveritas"
    error_message = "The target estate database must be houseofveritas."
  }
}

variable "cosmos_account_name" {
  description = "Globally unique target HOV Cosmos DB account name."
  type        = string
  default     = "nexprodhovcosmos"

  validation {
    condition     = var.cosmos_account_name == "nexprodhovcosmos"
    error_message = "Use the reviewed target Cosmos account name."
  }
}

variable "cosmos_mongo_database_name" {
  description = "Target Cosmos Mongo database name."
  type        = string
  default     = "house_of_veritas"
}

variable "cosmos_mongo_collection_name" {
  description = "Target Cosmos Mongo collection for verified kiosk documents."
  type        = string
  default     = "kiosk_requests"
}

variable "tags" {
  description = "Additional non-sensitive tags applied to target resources."
  type        = map(string)
  default     = {}
}
