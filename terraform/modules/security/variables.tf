variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "key_vault_name" {
  description = "Name of the Key Vault (must be globally unique)"
  type        = string
}

variable "container_subnet_id" {
  description = "ID of the container subnet"
  type        = string
}

variable "runner_subnet_id" {
  description = "ID of the runner subnet (for CI runner access)"
  type        = string
}

variable "db_admin_password" {
  description = "Database administrator password"
  type        = string
  sensitive   = true
}

variable "docuseal_secret_key" {
  description = "DocuSeal secret key"
  type        = string
  sensitive   = true
  default     = "changeme-docuseal-secret" # Change in production
}

variable "baserow_secret_key" {
  description = "Baserow secret key"
  type        = string
  sensitive   = true
  default     = "changeme-baserow-secret" # Change in production
}

variable "smtp_password" {
  description = "SMTP password for email notifications"
  type        = string
  sensitive   = true
  default     = "" # Set in production
}

variable "deployer_ip_addresses" {
  description = "IP addresses (CIDR) allowed to manage Key Vault (e.g. CI runner)"
  type        = list(string)
  default     = []
}

variable "terraform_access_policy_object_id" {
  description = "Microsoft Entra object ID that Terraform grants Key Vault data-plane access to"
  type        = string

  validation {
    condition     = length(trimspace(var.terraform_access_policy_object_id)) > 0
    error_message = "terraform_access_policy_object_id must be the object ID of the deploy principal."
  }
}

variable "network_default_action" {
  description = "Default network action for the Key Vault firewall"
  type        = string
  default     = "Deny"

  validation {
    condition     = contains(["Allow", "Deny"], var.network_default_action)
    error_message = "network_default_action must be Allow or Deny."
  }
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
