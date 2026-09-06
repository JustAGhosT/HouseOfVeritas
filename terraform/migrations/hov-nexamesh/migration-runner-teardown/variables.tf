variable "target_tenant_id" {
  description = "Exact Celladore Systems tenant ID authorized for migration-runner teardown."
  type        = string
  default     = "5384ef74-e517-4b22-9472-df990f61e8b5"

  validation {
    condition     = var.target_tenant_id == "5384ef74-e517-4b22-9472-df990f61e8b5"
    error_message = "Migration-runner teardown may run only in the approved Celladore Systems tenant."
  }
}

variable "target_subscription_id" {
  description = "Exact nexamesh-sub subscription ID authorized for migration-runner teardown."
  type        = string
  default     = "8a5dc70a-bafa-4a04-a281-9b4862a70810"

  validation {
    condition     = var.target_subscription_id == "8a5dc70a-bafa-4a04-a281-9b4862a70810"
    error_message = "Migration-runner teardown may run only in the approved nexamesh-sub subscription."
  }
}
