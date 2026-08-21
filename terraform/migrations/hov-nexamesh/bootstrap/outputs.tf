output "resource_group_name" {
  description = "Target-only Terraform backend resource group."
  value       = azurerm_resource_group.state.name
}

output "storage_account_name" {
  description = "Target-only Terraform backend storage account."
  value       = azurerm_storage_account.state.name
}

output "state_container_name" {
  description = "Private Terraform state container."
  value       = azapi_resource.state_container.name
}

output "bootstrap_state_key" {
  description = "Backend key used after the bootstrap state is migrated from local state."
  value       = "hov/prod/bootstrap.tfstate"
}

output "foundation_data_state_key" {
  description = "Backend key reserved for the target foundation/data root."
  value       = "hov/prod/foundation-data.tfstate"
}

output "backend_subscription_id" {
  description = "Subscription assertion for backend clients."
  value       = var.target_subscription_id
}

output "backend_tenant_id" {
  description = "Tenant assertion for backend clients."
  value       = var.target_tenant_id
}
