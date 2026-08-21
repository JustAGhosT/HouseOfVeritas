terraform {
  required_version = ">= 1.9.0, < 2.0.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.58"
    }
  }

  backend "azurerm" {}
}

provider "azurerm" {
  subscription_id = var.target_subscription_id
  tenant_id       = var.target_tenant_id

  features {
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }
}
