output "resource_group_name" {
  description = "Target HOV resource group name."
  value       = azurerm_resource_group.hov.name
}

output "resource_group_id" {
  description = "Target HOV resource group ID."
  value       = azurerm_resource_group.hov.id
}

output "location" {
  description = "Target HOV Azure region."
  value       = azurerm_resource_group.hov.location
}

output "vnet_id" {
  description = "Target HOV virtual network ID."
  value       = azurerm_virtual_network.hov.id
}

output "app_service_subnet_id" {
  description = "Subnet ID reserved for App Service VNet integration."
  value       = azurerm_subnet.app_service.id
}

output "postgres_subnet_id" {
  description = "Delegated PostgreSQL subnet ID."
  value       = azurerm_subnet.postgres.id
}

output "private_endpoints_subnet_id" {
  description = "Subnet ID for HOV private endpoints."
  value       = azurerm_subnet.private_endpoints.id
}

output "migration_runner_subnet_id" {
  description = "Delegated subnet for a separately reviewed ephemeral migration runner."
  value       = azurerm_subnet.migration_runner.id
}

output "key_vault_id" {
  description = "Target HOV Key Vault ID."
  value       = azurerm_key_vault.hov.id
}

output "key_vault_name" {
  description = "Target HOV Key Vault name."
  value       = azurerm_key_vault.hov.name
}

output "key_vault_uri" {
  description = "Target HOV Key Vault URI."
  value       = azurerm_key_vault.hov.vault_uri
}

output "app_storage_account_id" {
  description = "Target HOV application storage account ID."
  value       = azurerm_storage_account.app.id
}

output "app_storage_account_name" {
  description = "Target HOV application storage account name."
  value       = azurerm_storage_account.app.name
}

output "app_storage_blob_endpoint" {
  description = "Private-network HOV Blob service endpoint."
  value       = azurerm_storage_account.app.primary_blob_endpoint
}

output "postgres_server_id" {
  description = "Target HOV PostgreSQL Flexible Server ID."
  value       = azurerm_postgresql_flexible_server.hov.id
}

output "postgres_server_name" {
  description = "Target HOV PostgreSQL Flexible Server name."
  value       = azurerm_postgresql_flexible_server.hov.name
}

output "postgres_server_fqdn" {
  description = "Private target PostgreSQL server FQDN; this is not a DSN."
  value       = azurerm_postgresql_flexible_server.hov.fqdn
}

output "postgres_database_name" {
  description = "Target HOV estate database name."
  value       = azurerm_postgresql_flexible_server_database.hov.name
}

output "cosmos_account_id" {
  description = "Target HOV Cosmos DB account ID."
  value       = azapi_resource.cosmos.id
}

output "cosmos_account_name" {
  description = "Target HOV Cosmos DB account name."
  value       = azapi_resource.cosmos.name
}

output "cosmos_mongo_database_name" {
  description = "Target HOV Cosmos Mongo database name."
  value       = azapi_resource.cosmos_mongo_database.name
}

output "cosmos_mongo_collection_name" {
  description = "Target HOV Cosmos Mongo collection name."
  value       = azapi_resource.cosmos_mongo_collection.name
}

output "postgres_authentication_mode" {
  description = "Authentication contract for migration and runtime clients."
  value       = "entra-only"
}

output "cosmos_runtime_connection_secret_name" {
  description = "Expected Key Vault secret name populated out of band with the Cosmos Mongo runtime connection string."
  value       = "cosmos-mongo-connection-string"
}

output "scoped_role_bootstrap_required" {
  description = "Explicit gate: scoped Entra database roles are created out of band after runtime identity provisioning."
  value       = true
}

output "migration_runner_required" {
  description = "Explicit gate: private data services are unreachable until the reviewed ephemeral runner is provisioned in its delegated subnet."
  value       = true
}
