variable "target_tenant_id" {
  description = "Exact Celladore Systems tenant ID. Source-tenant credentials are rejected."
  type        = string
  default     = "5384ef74-e517-4b22-9472-df990f61e8b5"

  validation {
    condition     = var.target_tenant_id == "5384ef74-e517-4b22-9472-df990f61e8b5"
    error_message = "Runtime may target only the approved Celladore Systems tenant."
  }
}

variable "target_subscription_id" {
  description = "Exact nexamesh-sub subscription ID. The NeuralLiquid source subscription is forbidden."
  type        = string
  default     = "8a5dc70a-bafa-4a04-a281-9b4862a70810"

  validation {
    condition     = var.target_subscription_id == "8a5dc70a-bafa-4a04-a281-9b4862a70810"
    error_message = "Runtime may target only nexamesh-sub."
  }
}

variable "location" {
  description = "Approved Azure region for the target HOV runtime."
  type        = string
  default     = "southafricanorth"

  validation {
    condition     = var.location == "southafricanorth"
    error_message = "The HOV target runtime must remain in southafricanorth."
  }
}

variable "resource_group_name" {
  description = "Exact target resource group created by the foundation-data root."
  type        = string
  default     = "nex-prod-hov-rg"

  validation {
    condition     = var.resource_group_name == "nex-prod-hov-rg"
    error_message = "The runtime root may manage only nex-prod-hov-rg."
  }
}

variable "foundation_state_resource_group_name" {
  description = "Target-only Terraform state resource group."
  type        = string
  default     = "nex-prod-hov-tfstate-rg"

  validation {
    condition     = var.foundation_state_resource_group_name == "nex-prod-hov-tfstate-rg"
    error_message = "Foundation state must come from the target-only backend resource group."
  }
}

variable "foundation_state_storage_account_name" {
  description = "Target-only Terraform state storage account."
  type        = string
  default     = "nexprodhovtfstate"

  validation {
    condition     = var.foundation_state_storage_account_name == "nexprodhovtfstate"
    error_message = "Foundation state must come from the approved target-only storage account."
  }
}

variable "foundation_state_container_name" {
  description = "Target-only Terraform state container."
  type        = string
  default     = "tfstate"
}

variable "foundation_state_key" {
  description = "Foundation-data state key; never point this at source production state."
  type        = string
  default     = "hov/prod/foundation-data.tfstate"

  validation {
    condition     = var.foundation_state_key == "hov/prod/foundation-data.tfstate"
    error_message = "Runtime must consume only the target foundation-data state key."
  }
}

variable "service_plan_name" {
  description = "Target-only Linux App Service plan name."
  type        = string
  default     = "nex-prod-hov-plan"

  validation {
    condition     = startswith(var.service_plan_name, "nex-prod-hov-")
    error_message = "Service plan names must use the nex-prod-hov prefix."
  }
}

variable "web_app_name" {
  description = "Globally unique target HOV App Service name."
  type        = string
  default     = "nex-prod-hov-app"

  validation {
    condition     = startswith(var.web_app_name, "nex-prod-hov-")
    error_message = "Web App names must use the nex-prod-hov prefix."
  }
}

variable "postgres_runtime_principal_name" {
  description = "Reviewed PostgreSQL Entra database principal name created out of band for the App Service identity."
  type        = string
  default     = "nex-prod-hov-app"

  validation {
    condition     = var.postgres_runtime_principal_name == "nex-prod-hov-app"
    error_message = "The initial scoped PostgreSQL runtime principal must be nex-prod-hov-app."
  }
}

variable "log_analytics_workspace_name" {
  description = "Target-only Log Analytics workspace name."
  type        = string
  default     = "nex-prod-hov-law"
}

variable "application_insights_name" {
  description = "Target-only workspace-based Application Insights component name."
  type        = string
  default     = "nex-prod-hov-app-insights"
}

variable "app_storage_container_name" {
  description = "Blob container used by the HOV runtime."
  type        = string
  default     = "house-of-veritas"
}

variable "auth_secret_name" {
  description = "Key Vault secret name containing the Auth.js session secret."
  type        = string
  default     = "auth-secret"
}

variable "baserow_api_token_secret_name" {
  description = "Key Vault secret name containing the external Baserow API token."
  type        = string
  default     = "baserow-api-token"
}

variable "docuseal_api_key_secret_name" {
  description = "Key Vault secret name containing the external DocuSeal API key."
  type        = string
  default     = "docuseal-api-key"
}

variable "baserow_url" {
  description = "External NexaMesh Baserow base URL."
  type        = string
  default     = "https://ops.nexamesh.ai"

  validation {
    condition     = can(regex("^https://", var.baserow_url))
    error_message = "Baserow must use HTTPS."
  }
}

variable "docuseal_url" {
  description = "External NexaMesh DocuSeal base URL."
  type        = string
  default     = "https://sign.nexamesh.ai"

  validation {
    condition     = can(regex("^https://", var.docuseal_url))
    error_message = "DocuSeal must use HTTPS."
  }
}

variable "identity_cutover_approved" {
  description = "Explicit atomic-cutover gate. Keep false during target build and data rehearsal."
  type        = bool
  default     = false
}

variable "mystira_oidc_issuer" {
  description = "Mystira issuer to emit only during an independently approved atomic identity cutover."
  type        = string
  default     = ""
}

variable "mystira_oidc_authorization_endpoint" {
  description = "NexaMesh browser-facing Mystira authorization endpoint to emit during the approved identity cutover."
  type        = string
  default     = "https://login.hov.nexamesh.ai/connect/authorize"

  validation {
    condition     = var.mystira_oidc_authorization_endpoint == "https://login.hov.nexamesh.ai/connect/authorize"
    error_message = "The HOV NexaMesh migration authorization endpoint must remain https://login.hov.nexamesh.ai/connect/authorize."
  }
}

variable "mystira_oidc_end_session_endpoint" {
  description = "NexaMesh browser-facing Mystira end-session endpoint to emit during the approved identity cutover."
  type        = string
  default     = "https://login.hov.nexamesh.ai/connect/endsession"

  validation {
    condition     = var.mystira_oidc_end_session_endpoint == "https://login.hov.nexamesh.ai/connect/endsession"
    error_message = "The HOV NexaMesh migration end-session endpoint must remain https://login.hov.nexamesh.ai/connect/endsession."
  }
}

variable "mystira_oidc_client_id" {
  description = "Target HOV relying-party client ID to emit only during approved cutover."
  type        = string
  default     = ""
}

variable "mystira_oidc_client_secret_name" {
  description = "Key Vault secret name for the cutover client secret; never the secret value."
  type        = string
  default     = ""
}

variable "auth_url" {
  description = "Canonical public Auth.js URL to emit only during approved DNS/identity cutover."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags merged with mandatory environment and project tags."
  type        = map(string)
  default     = {}
}
