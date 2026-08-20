output "sign_fqdn" {
  description = "FQDN of the DocuSeal signing subdomain"
  value       = "${azurerm_dns_a_record.sign.name}.${data.azurerm_dns_zone.main.name}"
}

output "ops_fqdn" {
  description = "FQDN of the ops subdomain"
  value       = "${azurerm_dns_a_record.ops.name}.${data.azurerm_dns_zone.main.name}"
}

output "dns_zone_name_servers" {
  description = "Name servers of the DNS zone"
  value       = data.azurerm_dns_zone.main.name_servers
}
