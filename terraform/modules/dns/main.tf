# DNS Module - Azure DNS records for House of Veritas

data "azurerm_dns_zone" "main" {
  name                = var.dns_zone_name
  resource_group_name = var.dns_zone_resource_group
}

resource "azurerm_dns_a_record" "sign" {
  name                = "sign"
  zone_name           = data.azurerm_dns_zone.main.name
  resource_group_name = var.dns_zone_resource_group
  ttl                 = 300
  records             = [var.gateway_public_ip]

  tags = var.tags
}

resource "azurerm_dns_a_record" "ops" {
  name                = "ops"
  zone_name           = data.azurerm_dns_zone.main.name
  resource_group_name = var.dns_zone_resource_group
  ttl                 = 300
  records             = [var.gateway_public_ip]

  tags = var.tags
}

resource "azurerm_dns_a_record" "root" {
  count               = var.create_root_record ? 1 : 0
  name                = "@"
  zone_name           = data.azurerm_dns_zone.main.name
  resource_group_name = var.dns_zone_resource_group
  ttl                 = 300
  records             = [var.gateway_public_ip]

  tags = var.tags
}

resource "azurerm_dns_txt_record" "acme_challenge" {
  count               = var.acme_challenge_value != "" ? 1 : 0
  name                = "_acme-challenge"
  zone_name           = data.azurerm_dns_zone.main.name
  resource_group_name = var.dns_zone_resource_group
  ttl                 = 60

  record {
    value = var.acme_challenge_value
  }

  tags = var.tags
}
