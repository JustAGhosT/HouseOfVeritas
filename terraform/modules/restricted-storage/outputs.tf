output "storage_account_id" {
  description = "Resource ID of the restricted evidence storage account"
  value       = azurerm_storage_account.restricted.id
}

output "storage_account_name" {
  description = "Name of the restricted evidence storage account"
  value       = azurerm_storage_account.restricted.name
}

output "blob_endpoint" {
  description = "Private-network Blob endpoint for the restricted evidence account"
  value       = azurerm_storage_account.restricted.primary_blob_endpoint
}

output "container_resource_id" {
  description = "ARM resource ID of the restricted evidence container"
  value       = azapi_resource.evidence_container.id
}

output "private_endpoint_id" {
  description = "Resource ID of the restricted Blob private endpoint"
  value       = azurerm_private_endpoint.blob.id
}

output "audit_workspace_id" {
  description = "Resource ID of the restricted evidence audit workspace"
  value       = azurerm_log_analytics_workspace.audit.id
}
