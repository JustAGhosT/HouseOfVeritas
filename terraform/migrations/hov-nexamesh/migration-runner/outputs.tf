output "virtual_machine_id" {
  description = "Resource ID used as the Managed Run Command target."
  value       = azurerm_linux_virtual_machine.migration.id
}

output "virtual_machine_name" {
  description = "Temporary private migration VM name."
  value       = azurerm_linux_virtual_machine.migration.name
}

output "virtual_machine_private_ip" {
  description = "Private-only migration VM address."
  value       = azurerm_network_interface.migration.private_ip_address
}

output "virtual_machine_principal_id" {
  description = "System-assigned identity principal used for target-only data-plane roles."
  value       = azurerm_linux_virtual_machine.migration.identity[0].principal_id
}

output "run_command_resource_group_name" {
  description = "Resource group for protected Managed Run Command operations."
  value       = data.terraform_remote_state.foundation.outputs.resource_group_name
}

output "nat_egress_ip" {
  description = "Stable runner egress IP for separately approved source firewall allowlisting."
  value       = azurerm_public_ip.nat.ip_address
}

output "tooling_readiness_extension_id" {
  description = "VM extension whose successful provisioning proves cloud-init and the migration tool checks completed."
  value       = azurerm_virtual_machine_extension.tooling_readiness.id
}

output "tooling_readiness_marker" {
  description = "Non-secret in-guest JSON evidence path populated after all required tools and reboot state pass verification."
  value       = "/var/lib/hov-migration/tooling-ready.json"
}

output "managed_run_command_powershell_interpreter" {
  description = "Linux interpreter that a reviewed Managed Run Command shell wrapper must use for repository .ps1 payloads."
  value       = "/usr/bin/pwsh -NoLogo -NoProfile -NonInteractive -File"
}

output "postgres_temporary_entra_admin_principal_id" {
  description = "Temporary runner identity currently owned by this state as the PostgreSQL Entra administrator."
  value       = azurerm_postgresql_flexible_server_active_directory_administrator.migration.object_id
}

output "postgres_admin_handoff_required_before_teardown" {
  description = "The temporary Entra administrator must be replaced by an approved durable operator or break-glass principal before runner teardown."
  value       = true
}

output "teardown_separately_approved" {
  description = "Deletion remains blocked until restore proof and a separate teardown approval."
  value       = false
}
