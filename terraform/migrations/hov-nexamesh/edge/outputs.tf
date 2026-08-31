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

output "brand_hostname_binding_enabled" {
  description = "Whether the isolated brand-hostname binding was approved and planned."
  value       = var.brand_hostname_binding_approved
}

output "brand_hostname" {
  description = "Brand hostname; does not imply Cloudflare DNS was changed."
  value       = var.brand_hostname_binding_approved ? azurerm_app_service_custom_hostname_binding.brand[0].hostname : null
}

output "brand_managed_certificate_id" {
  description = "Managed certificate resource ID when brand hostname binding is enabled."
  value       = var.brand_hostname_binding_approved ? azurerm_app_service_managed_certificate.brand[0].id : null
}

output "operator_steps_remaining" {
  description = "External mutations intentionally excluded from Terraform."
  value = [
    "Cloudflare TXT/domain verification and final DNS routing for each bound hostname",
    "Mystira OIDC registration, callback, issuer and client-secret rotation (add hov.nexamesh.ai redirect URIs/CORS origin alongside the existing hov.neuralliquid.ai entries)",
    "A real sign-in at each newly bound hostname before declaring that hostname's cutover done",
    "Authentic target acceptance before source retirement",
  ]
}
