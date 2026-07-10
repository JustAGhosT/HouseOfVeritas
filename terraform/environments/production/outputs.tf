output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "vnet_id" {
  description = "ID of the virtual network"
  value       = module.network.vnet_id
}

output "storage_account_name" {
  description = "Name of the storage account"
  value       = module.storage.storage_account_name
}

output "storage_blob_endpoint" {
  description = "Primary blob endpoint URL"
  value       = module.storage.primary_blob_endpoint
}

output "key_vault_uri" {
  description = "URI of the Key Vault"
  value       = module.security.key_vault_uri
}

output "database_server_fqdn" {
  description = "FQDN of the PostgreSQL server"
  value       = try(module.database[0].server_fqdn, null)
}

output "cosmos_account_name" {
  description = "Cosmos DB account name"
  value       = try(module.cosmos_mongo[0].account_name, null)
}

output "cosmos_mongo_database_name" {
  description = "Cosmos Mongo database name"
  value       = try(module.cosmos_mongo[0].mongo_database_name, null)
}

output "cosmos_mongo_collection_name" {
  description = "Cosmos Mongo collection name"
  value       = try(module.cosmos_mongo[0].mongo_collection_name, null)
}

output "cosmos_mongo_connection_string" {
  description = "Cosmos Mongo connection string"
  value       = try(module.cosmos_mongo[0].mongo_connection_string, null)
  sensitive   = true
}

output "docuseal_container_id" {
  description = "ID of the DocuSeal container"
  value       = try(module.compute[0].docuseal_container_id, null)
}

output "baserow_container_id" {
  description = "ID of the Baserow container"
  value       = try(module.compute[0].baserow_container_id, null)
}

output "application_gateway_public_ip" {
  description = "Public IP address of the Application Gateway"
  value       = try(module.gateway[0].public_ip_address, null)
}

output "docuseal_url" {
  description = "URL for DocuSeal"
  value       = "https://docs.${var.domain_name}"
}

output "baserow_url" {
  description = "URL for Baserow"
  value       = "https://ops.${var.domain_name}"
}

output "dns_records_required" {
  description = "DNS records configured"
  value = {
    docs = try(module.dns[0].docs_fqdn, null)
    ops  = try(module.dns[0].ops_fqdn, null)
  }
}

output "document_intelligence_endpoint" {
  description = "Document Intelligence endpoint URL"
  value       = try(module.cognitive[0].endpoint, null)
}

output "document_intelligence_key" {
  description = "Document Intelligence access key"
  value       = try(module.cognitive[0].primary_access_key, null)
  sensitive   = true
}

output "asset_uploads_container" {
  description = "Blob container name for asset photo uploads"
  value       = module.storage.asset_uploads_container_name
}

output "storage_connection_string" {
  description = "Storage account connection string (for app config)"
  value       = module.storage.storage_account_primary_connection_string
  sensitive   = true
}

output "web_app_url" {
  description = "URL of the Next.js Web App"
  value       = module.webapp.web_app_url
}

output "web_app_name" {
  description = "Name of the Web App"
  value       = module.webapp.web_app_name
}

output "web_app_hostname" {
  description = "Default hostname of the Web App"
  value       = module.webapp.default_hostname
}

output "function_app_url" {
  description = "URL of the Azure Function App"
  value       = try(module.functions[0].function_app_url, null)
}

output "function_app_name" {
  description = "Name of the Azure Function App"
  value       = try(module.functions[0].function_app_name, null)
}

output "function_app_hostname" {
  description = "Default hostname of the Function App"
  value       = try(module.functions[0].function_app_default_hostname, null)
}

output "runner_subnet_id" {
  description = "ID of the runner subnet (pass to phoenixvc-actions-runner Terraform)"
  value       = module.network.runner_subnet_id
}
