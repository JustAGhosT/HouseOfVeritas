variable "target_tenant_id" {
  description = "Exact Celladore Systems tenant ID authorized for the HOV target."
  type        = string
  default     = "5384ef74-e517-4b22-9472-df990f61e8b5"

  validation {
    condition     = var.target_tenant_id == "5384ef74-e517-4b22-9472-df990f61e8b5"
    error_message = "The bootstrap root may run only in the approved Celladore Systems tenant."
  }
}

variable "target_subscription_id" {
  description = "Exact nexamesh-sub subscription ID authorized for the HOV target."
  type        = string
  default     = "8a5dc70a-bafa-4a04-a281-9b4862a70810"

  validation {
    condition     = var.target_subscription_id == "8a5dc70a-bafa-4a04-a281-9b4862a70810"
    error_message = "The bootstrap root may run only in the approved nexamesh-sub subscription."
  }
}

variable "location" {
  description = "Azure region for the target-only Terraform backend."
  type        = string
  default     = "southafricanorth"

  validation {
    condition     = var.location == "southafricanorth"
    error_message = "The approved HOV migration target region is southafricanorth."
  }
}

variable "resource_group_name" {
  description = "Dedicated target-only Terraform backend resource group."
  type        = string
  default     = "nex-prod-hov-tfstate-rg"

  validation {
    condition     = var.resource_group_name == "nex-prod-hov-tfstate-rg"
    error_message = "The bootstrap resource group must be nex-prod-hov-tfstate-rg."
  }
}

variable "storage_account_name" {
  description = "Globally unique target-only Terraform state storage account."
  type        = string
  default     = "nexprodhovtfstate"

  validation {
    condition     = var.storage_account_name == "nexprodhovtfstate"
    error_message = "The reviewed backend storage account name is nexprodhovtfstate."
  }
}

variable "state_container_name" {
  description = "Private blob container for HOV target Terraform states."
  type        = string
  default     = "tfstate"

  validation {
    condition     = var.state_container_name == "tfstate"
    error_message = "The target state container must be tfstate."
  }
}

variable "backend_allowed_ip_cidrs" {
  description = "Explicit public IPv4 CIDRs allowed to reach the state Blob endpoint during planning and deployment."
  type        = list(string)

  validation {
    condition = length(var.backend_allowed_ip_cidrs) > 0 && alltrue([
      for cidr in var.backend_allowed_ip_cidrs : can(cidrnetmask(cidr)) && !contains(["0.0.0.0/0", "::/0"], cidr)
    ])
    error_message = "Supply at least one bounded operator or runner CIDR; unrestricted state access is prohibited."
  }
}

variable "tags" {
  description = "Additional non-sensitive tags for the target backend resources."
  type        = map(string)
  default     = {}
}
