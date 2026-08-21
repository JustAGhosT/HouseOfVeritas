output "web_app_id" {
  description = "Target HOV App Service resource ID."
  value       = azurerm_linux_web_app.runtime.id
}

output "web_app_name" {
  description = "Target HOV App Service name."
  value       = azurerm_linux_web_app.runtime.name
}

output "default_hostname" {
  description = "Azure-provided target hostname used for pre-cutover acceptance."
  value       = azurerm_linux_web_app.runtime.default_hostname
}

output "managed_identity_principal_id" {
  description = "System-assigned runtime principal ID for target-only data-plane checks."
  value       = azurerm_linux_web_app.runtime.identity[0].principal_id
}

output "log_analytics_workspace_id" {
  description = "Target Log Analytics workspace resource ID."
  value       = azurerm_log_analytics_workspace.runtime.id
}

output "application_insights_id" {
  description = "Target workspace-based Application Insights resource ID."
  value       = azurerm_application_insights.runtime.id
}

output "identity_cutover_settings_enabled" {
  description = "Whether external OIDC/Auth URL settings were deliberately emitted."
  value       = var.identity_cutover_approved
}

output "postgres_role_bootstrap_required" {
  description = "Explicit out-of-band gate: create the scoped Entra database role for the runtime principal before data acceptance."
  value       = local.foundation.scoped_role_bootstrap_required
}

output "postgres_runtime_principal_name" {
  description = "Exact Entra database principal name to create with least privilege after the runtime identity exists."
  value       = var.postgres_runtime_principal_name
}

output "postgres_runtime_principal_object_id" {
  description = "App Service managed-identity object ID used by the scoped PostgreSQL role bootstrap."
  value       = azurerm_linux_web_app.runtime.identity[0].principal_id
}
