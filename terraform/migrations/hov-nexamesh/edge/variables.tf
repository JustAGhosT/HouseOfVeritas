variable "target_tenant_id" {
  description = "Exact Celladore Systems target tenant."
  type        = string
  default     = "5384ef74-e517-4b22-9472-df990f61e8b5"

  validation {
    condition     = var.target_tenant_id == "5384ef74-e517-4b22-9472-df990f61e8b5"
    error_message = "Edge may target only the approved Celladore Systems tenant."
  }
}

variable "target_subscription_id" {
  description = "Exact nexamesh-sub target subscription."
  type        = string
  default     = "8a5dc70a-bafa-4a04-a281-9b4862a70810"

  validation {
    condition     = var.target_subscription_id == "8a5dc70a-bafa-4a04-a281-9b4862a70810"
    error_message = "Edge may target only nexamesh-sub."
  }
}

variable "resource_group_name" {
  description = "Exact target HOV resource group."
  type        = string
  default     = "nex-prod-hov-rg"

  validation {
    condition     = var.resource_group_name == "nex-prod-hov-rg"
    error_message = "Edge may manage only nex-prod-hov-rg."
  }
}

variable "runtime_state_resource_group_name" {
  description = "Target-only Terraform backend resource group."
  type        = string
  default     = "nex-prod-hov-tfstate-rg"
}

variable "runtime_state_storage_account_name" {
  description = "Target-only Terraform backend storage account."
  type        = string
  default     = "nexprodhovtfstate"
}

variable "runtime_state_container_name" {
  description = "Target-only Terraform backend container."
  type        = string
  default     = "tfstate"
}

variable "runtime_state_key" {
  description = "Target runtime state key. Source state keys are forbidden."
  type        = string
  default     = "hov/prod/runtime.tfstate"

  validation {
    condition     = var.runtime_state_key == "hov/prod/runtime.tfstate"
    error_message = "Edge must consume only the isolated target runtime state."
  }
}

variable "hostname" {
  description = "Compatibility hostname to bind after external DNS ownership verification."
  type        = string
  default     = "hov.neuralliquid.ai"

  validation {
    condition     = var.hostname == "hov.neuralliquid.ai"
    error_message = "This edge root is isolated to the approved HOV compatibility hostname."
  }
}

variable "hostname_binding_approved" {
  description = "Explicit gate set only after Cloudflare TXT verification and operator review."
  type        = bool
  default     = false
}

variable "brand_hostname" {
  description = "Brand hostname to bind after external DNS ownership verification. Bound in addition to, not instead of, the compatibility hostname."
  type        = string
  default     = "hov.nexamesh.ai"

  validation {
    condition     = var.brand_hostname == "hov.nexamesh.ai"
    error_message = "This edge root is isolated to the approved HOV brand hostname."
  }
}

variable "brand_hostname_binding_approved" {
  description = "Explicit gate set only after Cloudflare TXT verification and operator review, for the brand hostname."
  type        = bool
  default     = false
}

variable "external_oidc_cutover_complete" {
  description = "Operator attestation that the separately managed OIDC registration/callback transaction is complete."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags merged with mandatory target tags."
  type        = map(string)
  default     = {}
}
