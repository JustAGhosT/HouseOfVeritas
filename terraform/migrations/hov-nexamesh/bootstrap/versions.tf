terraform {
  required_version = ">= 1.9.0, < 2.0.0"

  required_providers {
    azapi = {
      source  = "Azure/azapi"
      version = "= 2.11.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 4.81.0"
    }
  }

  # The first initialization must use `terraform init -backend=false` because
  # this root creates its own backend. After the bootstrap apply, migrate the
  # local bootstrap state with the reviewed backend.hcl values.
  backend "azurerm" {}
}

provider "azurerm" {
  tenant_id           = var.target_tenant_id
  subscription_id     = var.target_subscription_id
  storage_use_azuread = true

  features {
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }
}

provider "azapi" {
  tenant_id       = var.target_tenant_id
  subscription_id = var.target_subscription_id
}
