data "azurerm_client_config" "current" {}

data "terraform_remote_state" "runtime" {
  backend = "azurerm"

  config = {
    resource_group_name  = var.runtime_state_resource_group_name
    storage_account_name = var.runtime_state_storage_account_name
    container_name       = var.runtime_state_container_name
    key                  = var.runtime_state_key
    use_azuread_auth     = true
    tenant_id            = var.target_tenant_id
    subscription_id      = var.target_subscription_id
  }
}

locals {
  runtime = data.terraform_remote_state.runtime.outputs

  mandatory_tags = {
    environment = "production"
    project     = "house-of-veritas"
    owner       = "nexamesh"
    migration   = "hov-nexamesh"
  }
  tags = merge(var.tags, local.mandatory_tags)
}

check "exact_target_context" {
  assert {
    condition = (
      data.azurerm_client_config.current.tenant_id == var.target_tenant_id &&
      data.azurerm_client_config.current.subscription_id == var.target_subscription_id
    )
    error_message = "Authenticated Azure context is not the approved Celladore/nexamesh-sub target."
  }
}

check "runtime_boundary" {
  assert {
    condition = (
      startswith(lower(local.runtime.web_app_name), "nex-prod-hov-") &&
      startswith(lower(local.runtime.web_app_id), "/subscriptions/${lower(var.target_subscription_id)}/resourcegroups/nex-prod-hov-")
    )
    error_message = "Runtime state references a source or non-HOV App Service."
  }
}

check "operator_cutover_sequence" {
  assert {
    condition = (
      (!var.hostname_binding_approved && !var.brand_hostname_binding_approved) ||
      var.external_oidc_cutover_complete
    )
    error_message = "Complete the external OIDC registration/callback transaction before enabling any production hostname binding."
  }
}

# Cloudflare records, DNS proxying, Mystira OIDC registration, callbacks, issuer
# and client-secret rotation are intentionally not managed by this root. An
# operator must first publish Azure's domain-verification record in Cloudflare,
# complete the atomic OIDC transaction, and then approve this isolated binding.
resource "azurerm_app_service_custom_hostname_binding" "compatibility" {
  count = var.hostname_binding_approved ? 1 : 0

  hostname            = var.hostname
  app_service_name    = local.runtime.web_app_name
  resource_group_name = var.resource_group_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_app_service_managed_certificate" "compatibility" {
  count = var.hostname_binding_approved ? 1 : 0

  custom_hostname_binding_id = azurerm_app_service_custom_hostname_binding.compatibility[0].id
  tags                       = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_app_service_certificate_binding" "compatibility" {
  count = var.hostname_binding_approved ? 1 : 0

  hostname_binding_id = azurerm_app_service_custom_hostname_binding.compatibility[0].id
  certificate_id      = azurerm_app_service_managed_certificate.compatibility[0].id
  ssl_state           = "SniEnabled"

  lifecycle {
    prevent_destroy = true
  }
}

# Brand hostname binding — additive, alongside the compatibility hostname
# above, not a replacement for it. Same external-prerequisite boundary: this
# root still does not touch Cloudflare DNS or the Mystira OIDC registration.
resource "azurerm_app_service_custom_hostname_binding" "brand" {
  count = var.brand_hostname_binding_approved ? 1 : 0

  hostname            = var.brand_hostname
  app_service_name    = local.runtime.web_app_name
  resource_group_name = var.resource_group_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_app_service_managed_certificate" "brand" {
  count = var.brand_hostname_binding_approved ? 1 : 0

  custom_hostname_binding_id = azurerm_app_service_custom_hostname_binding.brand[0].id
  tags                       = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_app_service_certificate_binding" "brand" {
  count = var.brand_hostname_binding_approved ? 1 : 0

  hostname_binding_id = azurerm_app_service_custom_hostname_binding.brand[0].id
  certificate_id      = azurerm_app_service_managed_certificate.brand[0].id
  ssl_state           = "SniEnabled"

  lifecycle {
    prevent_destroy = true
  }
}
