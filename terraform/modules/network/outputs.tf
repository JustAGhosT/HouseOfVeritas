output "vnet_id" {
  description = "ID of the virtual network"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "Name of the virtual network"
  value       = azurerm_virtual_network.main.name
}

output "gateway_subnet_id" {
  description = "ID of the gateway subnet"
  value       = azurerm_subnet.gateway.id
}

output "container_subnet_id" {
  description = "ID of the container subnet"
  value       = azurerm_subnet.containers.id
}

output "database_subnet_id" {
  description = "ID of the database subnet"
  value       = azurerm_subnet.database.id
}

output "app_service_subnet_id" {
  description = "ID of the App Service integration subnet"
  value       = azurerm_subnet.app_service.id
}

output "private_endpoint_subnet_id" {
  description = "ID of the private endpoint subnet"
  value       = azurerm_subnet.private_endpoints.id
}

output "gateway_nsg_id" {
  description = "ID of the gateway NSG"
  value       = azurerm_network_security_group.gateway.id
}

output "container_nsg_id" {
  description = "ID of the container NSG"
  value       = azurerm_network_security_group.containers.id
}

output "database_nsg_id" {
  description = "ID of the database NSG"
  value       = azurerm_network_security_group.database.id
}