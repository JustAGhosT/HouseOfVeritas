variable "target_tenant_id" {
  description = "Exact Celladore Systems tenant ID authorized for the migration runner."
  type        = string
  default     = "5384ef74-e517-4b22-9472-df990f61e8b5"

  validation {
    condition     = var.target_tenant_id == "5384ef74-e517-4b22-9472-df990f61e8b5"
    error_message = "The migration runner may run only in the approved Celladore Systems tenant."
  }
}

variable "target_subscription_id" {
  description = "Exact nexamesh-sub subscription ID authorized for the migration runner."
  type        = string
  default     = "8a5dc70a-bafa-4a04-a281-9b4862a70810"

  validation {
    condition     = var.target_subscription_id == "8a5dc70a-bafa-4a04-a281-9b4862a70810"
    error_message = "The migration runner may run only in the approved nexamesh-sub subscription."
  }
}

variable "location" {
  description = "Approved migration runner region."
  type        = string
  default     = "southafricanorth"

  validation {
    condition     = var.location == "southafricanorth"
    error_message = "The approved HOV migration target region is southafricanorth."
  }
}

variable "admin_username" {
  description = "Non-secret local administrator username; password authentication is disabled."
  type        = string
  default     = "hovmigration"
}

variable "admin_ssh_public_key" {
  description = "Non-secret SSH public key retained only for break-glass console recovery; the VM has no inbound path."
  type        = string

  validation {
    condition     = can(regex("^(ssh-(rsa|ed25519)|ecdsa-sha2-nistp(256|384|521))[[:space:]]+([A-Za-z0-9+/]{4}){8,}([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?([[:space:]]+[^[:space:]].*)?$", trimspace(var.admin_ssh_public_key)))
    error_message = "Supply a valid OpenSSH public key. Never supply a private key."
  }
}

variable "vm_size" {
  description = "Reviewed temporary migration runner size."
  type        = string
  default     = "Standard_B2als_v2"

  validation {
    condition     = var.vm_size == "Standard_B2als_v2"
    error_message = "The reviewed temporary migration runner size is Standard_B2als_v2."
  }
}

variable "tags" {
  description = "Additional non-sensitive migration runner tags."
  type        = map(string)
  default     = {}
}
