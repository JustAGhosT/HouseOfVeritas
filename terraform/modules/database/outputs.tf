output "server_id" {
  description = "ID of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.id
}

output "server_fqdn" {
  description = "FQDN of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "docuseal_database_name" {
  description = "Name of the DocuSeal database"
  value       = azurerm_postgresql_flexible_server_database.docuseal.name
}

output "baserow_database_name" {
  description = "Name of the Baserow database"
  value       = azurerm_postgresql_flexible_server_database.baserow.name
}

output "app_database_name" {
  description = "Name of the House of Veritas application database"
  value       = azurerm_postgresql_flexible_server_database.app.name
}

output "connection_string_docuseal" {
  description = "Connection string for DocuSeal database"
  value       = "postgresql://${var.admin_username}:${var.admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.docuseal.name}?sslmode=require"
  sensitive   = true
}

output "connection_string_baserow" {
  description = "Connection string for Baserow database"
  value       = "postgresql://${var.admin_username}:${var.admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.baserow.name}?sslmode=require"
  sensitive   = true
}

output "connection_string_app" {
  description = "Connection string for the House of Veritas application database"
  value       = "postgresql://${var.admin_username}:${var.admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.app.name}?sslmode=require"
  sensitive   = true
}
