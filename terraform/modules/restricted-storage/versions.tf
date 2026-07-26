terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 4.58"
    }
    azapi = {
      source  = "Azure/azapi"
      version = ">= 2.11"
    }
  }
}
