resource "azurerm_cosmosdb_account" "main" {
  name                          = var.account_name
  location                      = var.location
  resource_group_name           = var.resource_group_name
  offer_type                    = "Standard"
  kind                          = "MongoDB"
  enable_free_tier              = var.enable_free_tier
  public_network_access_enabled = var.public_network_access_enabled

  consistency_policy {
    consistency_level = var.consistency_level
  }

  geo_location {
    location          = var.location
    failover_priority = 0
  }

  capabilities {
    name = "EnableMongo"
  }

  tags = var.tags
}

resource "azurerm_private_dns_zone" "mongo" {
  count               = var.public_network_access_enabled ? 0 : 1
  name                = var.private_dns_zone_name
  resource_group_name = var.resource_group_name

  tags = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "mongo" {
  count                 = var.public_network_access_enabled ? 0 : 1
  name                  = "${var.account_name}-mongo-dns-link"
  resource_group_name   = var.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.mongo[0].name
  virtual_network_id    = var.vnet_id
  registration_enabled  = false

  tags = var.tags
}

resource "azurerm_private_endpoint" "mongo" {
  count               = var.public_network_access_enabled ? 0 : 1
  name                = "${var.account_name}-pe"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_endpoint_subnet_id

  private_service_connection {
    name                           = "${var.account_name}-mongo-psc"
    private_connection_resource_id = azurerm_cosmosdb_account.main.id
    is_manual_connection           = false
    subresource_names              = ["MongoDB"]
  }

  private_dns_zone_group {
    name                 = "mongo"
    private_dns_zone_ids = [azurerm_private_dns_zone.mongo[0].id]
  }

  tags = var.tags
}

resource "azurerm_cosmosdb_mongo_database" "main" {
  name                = var.mongo_database_name
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  throughput          = var.throughput
}

resource "azurerm_cosmosdb_mongo_collection" "main" {
  name                = var.mongo_collection_name
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_mongo_database.main.name
  throughput          = var.throughput
}