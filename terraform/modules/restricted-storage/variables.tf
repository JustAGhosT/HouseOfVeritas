variable "resource_group_name" {
  description = "Name of the resource group that owns the restricted evidence store"
  type        = string
}

variable "location" {
  description = "Azure region for the restricted evidence store"
  type        = string
}

variable "storage_account_name" {
  description = "Globally unique lowercase name for the restricted evidence storage account"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "storage_account_name must contain 3-24 lowercase alphanumeric characters."
  }
}

variable "container_name" {
  description = "Private Blob container used for restricted O6 evidence"
  type        = string
  default     = "reviewer-evidence"

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$", var.container_name))
    error_message = "container_name must be a valid 3-63 character lowercase Blob container name."
  }
}

variable "account_replication_type" {
  description = "Replication type for the restricted evidence storage account"
  type        = string
  default     = "LRS"

  validation {
    condition     = contains(["LRS", "ZRS", "GRS", "GZRS"], var.account_replication_type)
    error_message = "account_replication_type must be LRS, ZRS, GRS, or GZRS."
  }
}

variable "private_endpoint_subnet_id" {
  description = "ID of the subnet dedicated to Azure Private Endpoints"
  type        = string
}

variable "vnet_id" {
  description = "ID of the virtual network linked to the Blob private DNS zone"
  type        = string
}

variable "private_dns_zone_name" {
  description = "Private DNS zone for Azure Blob Private Link"
  type        = string
  default     = "privatelink.blob.core.windows.net"
}

variable "authorized_researcher_object_ids" {
  description = "Approved Microsoft Entra object IDs granted Blob data contributor access"
  type        = set(string)
  default     = []

  validation {
    condition = alltrue([
      for object_id in var.authorized_researcher_object_ids :
      can(regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$", object_id))
    ])
    error_message = "Every authorized researcher object ID must be a valid Microsoft Entra UUID."
  }
}

variable "retention_days" {
  description = "Maximum age in days before restricted base blobs, versions, and snapshots are deleted"
  type        = number
  default     = 90

  validation {
    condition     = var.retention_days >= 30 && var.retention_days <= 365
    error_message = "retention_days must be between 30 and 365 days."
  }
}

variable "soft_delete_days" {
  description = "Short recovery period for accidental Blob or container deletion"
  type        = number
  default     = 7

  validation {
    condition     = var.soft_delete_days >= 1 && var.soft_delete_days <= 30
    error_message = "soft_delete_days must be between 1 and 30 days."
  }
}

variable "audit_workspace_name" {
  description = "Name of the dedicated Log Analytics workspace for restricted Blob access events"
  type        = string
}

variable "audit_log_retention_days" {
  description = "Retention in days for restricted Blob access audit events"
  type        = number
  default     = 180

  validation {
    condition     = var.audit_log_retention_days >= 30 && var.audit_log_retention_days <= 730
    error_message = "audit_log_retention_days must be between 30 and 730 days."
  }
}

variable "tags" {
  description = "Tags applied to restricted evidence resources"
  type        = map(string)
  default     = {}
}
