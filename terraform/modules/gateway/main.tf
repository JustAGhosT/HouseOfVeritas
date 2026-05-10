# Gateway Module - Application Gateway with WAF for House of Veritas

locals {
  has_ssl = var.ssl_certificate_data != ""
}

# Public IP for Application Gateway
resource "azurerm_public_ip" "gateway" {
  name                = "${var.environment}-gateway-pip"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = var.tags
}

# Application Gateway
resource "azurerm_application_gateway" "main" {
  name                = "${var.environment}-appgw"
  location            = var.location
  resource_group_name = var.resource_group_name

  sku {
    name     = "WAF_v2"
    tier     = "WAF_v2"
    capacity = 1
  }

  gateway_ip_configuration {
    name      = "gateway-ip-config"
    subnet_id = var.gateway_subnet_id
  }

  dynamic "frontend_port" {
    for_each = toset(local.has_ssl ? ["enabled"] : [])
    content {
      name = "https-port"
      port = 443
    }
  }

  frontend_port {
    name = "http-port"
    port = 80
  }

  frontend_ip_configuration {
    name                 = "frontend-ip-config"
    public_ip_address_id = azurerm_public_ip.gateway.id
  }

  # Backend pools
  backend_address_pool {
    name         = "docuseal-backend"
    ip_addresses = [var.docuseal_ip_address]
  }

  backend_address_pool {
    name         = "baserow-backend"
    ip_addresses = [var.baserow_ip_address]
  }

  # Backend HTTP settings
  backend_http_settings {
    name                  = "docuseal-http-settings"
    cookie_based_affinity = "Disabled"
    port                  = 3000
    protocol              = "Http"
    request_timeout       = 60
    probe_name            = "docuseal-probe"
  }

  backend_http_settings {
    name                  = "baserow-http-settings"
    cookie_based_affinity = "Disabled"
    port                  = 80
    protocol              = "Http"
    request_timeout       = 60
    probe_name            = "baserow-probe"
  }

  # Health probes
  probe {
    name                = "docuseal-probe"
    protocol            = "Http"
    path                = "/"
    host                = "docs.${var.domain_name}"
    interval            = 30
    timeout             = 30
    unhealthy_threshold = 3

    match {
      status_code = ["200-399"]
    }
  }

  probe {
    name                = "baserow-probe"
    protocol            = "Http"
    path                = "/api/health/"
    host                = "ops.${var.domain_name}"
    interval            = 30
    timeout             = 30
    unhealthy_threshold = 3

    match {
      status_code = ["200-399"]
    }
  }

  # HTTP listeners (always present)
  http_listener {
    name                           = "docuseal-http-listener"
    frontend_ip_configuration_name = "frontend-ip-config"
    frontend_port_name             = "http-port"
    protocol                       = "Http"
    host_name                      = "docs.${var.domain_name}"
  }

  http_listener {
    name                           = "baserow-http-listener"
    frontend_ip_configuration_name = "frontend-ip-config"
    frontend_port_name             = "http-port"
    protocol                       = "Http"
    host_name                      = "ops.${var.domain_name}"
  }

  # HTTPS listeners (only when SSL cert is provided)
  # No ssl_profile — listeners inherit gateway-level ssl_policy (AppGwSslPolicy20220101 = TLS 1.2 and 1.3)
  dynamic "http_listener" {
    for_each = toset(local.has_ssl ? ["enabled"] : [])
    content {
      name                           = "docuseal-https-listener"
      frontend_ip_configuration_name = "frontend-ip-config"
      frontend_port_name             = "https-port"
      protocol                       = "Https"
      ssl_certificate_name           = "ssl-cert"
      host_name                      = "docs.${var.domain_name}"
    }
  }

  dynamic "http_listener" {
    for_each = toset(local.has_ssl ? ["enabled"] : [])
    content {
      name                           = "baserow-https-listener"
      frontend_ip_configuration_name = "frontend-ip-config"
      frontend_port_name             = "https-port"
      protocol                       = "Https"
      ssl_certificate_name           = "ssl-cert"
      host_name                      = "ops.${var.domain_name}"
    }
  }

  # SSL Certificate (only when provided)
  dynamic "ssl_certificate" {
    for_each = toset(local.has_ssl ? ["enabled"] : [])
    content {
      name     = "ssl-cert"
      data     = var.ssl_certificate_data
      password = var.ssl_certificate_password
    }
  }

  # HTTP-only routing (when no SSL - route HTTP directly to backends)
  dynamic "request_routing_rule" {
    for_each = toset(local.has_ssl ? [] : ["enabled"])
    content {
      name                       = "docuseal-routing"
      rule_type                  = "Basic"
      http_listener_name         = "docuseal-http-listener"
      backend_address_pool_name  = "docuseal-backend"
      backend_http_settings_name = "docuseal-http-settings"
      priority                   = 200
    }
  }

  dynamic "request_routing_rule" {
    for_each = toset(local.has_ssl ? [] : ["enabled"])
    content {
      name                       = "baserow-routing"
      rule_type                  = "Basic"
      http_listener_name         = "baserow-http-listener"
      backend_address_pool_name  = "baserow-backend"
      backend_http_settings_name = "baserow-http-settings"
      priority                   = 300
    }
  }

  # SSL routing (when SSL - redirect HTTP to HTTPS, route HTTPS to backends)
  dynamic "request_routing_rule" {
    for_each = toset(local.has_ssl ? ["enabled"] : [])
    content {
      name                        = "http-to-https-docuseal"
      rule_type                   = "Basic"
      http_listener_name          = "docuseal-http-listener"
      redirect_configuration_name = "docuseal-http-to-https"
      priority                    = 100
    }
  }

  dynamic "request_routing_rule" {
    for_each = toset(local.has_ssl ? ["enabled"] : [])
    content {
      name                        = "http-to-https-baserow"
      rule_type                   = "Basic"
      http_listener_name          = "baserow-http-listener"
      redirect_configuration_name = "baserow-http-to-https"
      priority                    = 110
    }
  }

  dynamic "request_routing_rule" {
    for_each = toset(local.has_ssl ? ["enabled"] : [])
    content {
      name                       = "docuseal-https-routing"
      rule_type                  = "Basic"
      http_listener_name         = "docuseal-https-listener"
      backend_address_pool_name  = "docuseal-backend"
      backend_http_settings_name = "docuseal-http-settings"
      priority                   = 210
    }
  }

  dynamic "request_routing_rule" {
    for_each = toset(local.has_ssl ? ["enabled"] : [])
    content {
      name                       = "baserow-https-routing"
      rule_type                  = "Basic"
      http_listener_name         = "baserow-https-listener"
      backend_address_pool_name  = "baserow-backend"
      backend_http_settings_name = "baserow-http-settings"
      priority                   = 310
    }
  }

  # Redirect configurations (only when SSL cert is provided)
  dynamic "redirect_configuration" {
    for_each = toset(local.has_ssl ? ["enabled"] : [])
    content {
      name                 = "docuseal-http-to-https"
      redirect_type        = "Permanent"
      target_listener_name = "docuseal-https-listener"
      include_path         = true
      include_query_string = true
    }
  }

  dynamic "redirect_configuration" {
    for_each = toset(local.has_ssl ? ["enabled"] : [])
    content {
      name                 = "baserow-http-to-https"
      redirect_type        = "Permanent"
      target_listener_name = "baserow-https-listener"
      include_path         = true
      include_query_string = true
    }
  }

  # WAF configuration - OWASP 3.2 with SQL injection rules enabled
  waf_configuration {
    enabled          = true
    firewall_mode    = "Prevention"
    rule_set_type    = "OWASP"
    rule_set_version = "3.2"
    # No disabled_rule_group - all OWASP rules (including 942 SQL injection) active
  }

  # Gateway-level SSL policy — ALWAYS set (static block) to avoid Azure default AppGwSslPolicy20150501 (deprecated Aug 2025)
  # AppGwSslPolicy20220101 = TLS 1.2 and 1.3
  ssl_policy {
    policy_type = "Predefined"
    policy_name = "AppGwSslPolicy20220101"
  }

  tags = var.tags
}
