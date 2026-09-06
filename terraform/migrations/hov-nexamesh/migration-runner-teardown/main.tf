data "azurerm_client_config" "current" {}

data "azurerm_resource_group" "target" {
  name = "nex-prod-hov-rg"
}

removed {
  from = terraform_data.target_guard
  lifecycle { destroy = true }
}

removed {
  from = azurerm_public_ip.nat
  lifecycle { destroy = true }
}

removed {
  from = azurerm_nat_gateway.migration
  lifecycle { destroy = true }
}

removed {
  from = azurerm_nat_gateway_public_ip_association.migration
  lifecycle { destroy = true }
}

removed {
  from = azurerm_subnet_nat_gateway_association.migration
  lifecycle { destroy = true }
}

removed {
  from = azurerm_network_interface.migration
  lifecycle { destroy = true }
}

removed {
  from = azurerm_linux_virtual_machine.migration
  lifecycle { destroy = true }
}

removed {
  from = azurerm_virtual_machine_extension.tooling_readiness
  lifecycle { destroy = true }
}

removed {
  from = azurerm_role_assignment.target_blob
  lifecycle { destroy = true }
}

removed {
  from = azurerm_role_assignment.target_secrets
  lifecycle { destroy = true }
}

removed {
  from = azurerm_postgresql_flexible_server_active_directory_administrator.migration
  lifecycle { destroy = true }
}
