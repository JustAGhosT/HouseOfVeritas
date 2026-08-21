output "hostname_binding_enabled" {
  description = "Whether the isolated compatibility-hostname binding was approved and planned."
  value       = var.hostname_binding_approved
}

output "hostname" {
  description = "Compatibility hostname; does not imply Cloudflare DNS was changed."
  value       = var.hostname_binding_approved ? azurerm_app_service_custom_hostname_binding.compatibility[0].hostname : null
}

output "managed_certificate_id" {
  description = "Managed certificate resource ID when edge binding is enabled."
  value       = var.hostname_binding_approved ? azurerm_app_service_managed_certificate.compatibility[0].id : null
}

output "operator_steps_remaining" {
  description = "External mutations intentionally excluded from Terraform."
  value = [
    "Cloudflare TXT/domain verification and final DNS routing",
    "Mystira OIDC registration, callback, issuer and client-secret rotation",
    "Authentic target acceptance before source retirement",
  ]
}
