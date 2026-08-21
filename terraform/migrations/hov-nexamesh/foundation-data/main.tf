data "azurerm_client_config" "current" {}

locals {
  required_tags = {
    environment = "production"
    project     = "house-of-veritas"
    product     = "hov"
    portfolio   = "nexamesh"
    managed_by  = "terraform"
    state_scope = "hov-foundation-data"
    data_class  = "popia-sensitive"
  }

  tags = merge(local.required_tags, var.tags)
}

resource "terraform_data" "target_guard" {
  lifecycle {
    precondition {
      condition     = data.azurerm_client_config.current.tenant_id == var.target_tenant_id
      error_message = "Authenticated Azure tenant does not match the approved Celladore Systems tenant."
    }

    precondition {
      condition     = data.azurerm_client_config.current.subscription_id == var.target_subscription_id
      error_message = "Authenticated Azure subscription does not match the approved nexamesh-sub subscription."
    }
  }
}

resource "azurerm_resource_group" "hov" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.tags

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [terraform_data.target_guard]
}

resource "azurerm_virtual_network" "hov" {
  name                = var.vnet_name
  resource_group_name = azurerm_resource_group.hov.name
  location            = azurerm_resource_group.hov.location
  address_space       = var.vnet_address_space
  tags                = local.tags
}

resource "azurerm_network_security_group" "app_service" {
  name                = "nex-prod-hov-app-nsg"
  resource_group_name = azurerm_resource_group.hov.name
  location            = azurerm_resource_group.hov.location
  tags                = local.tags
}

resource "azurerm_network_security_group" "postgres" {
  name                = "nex-prod-hov-pg-nsg"
  resource_group_name = azurerm_resource_group.hov.name
  location            = azurerm_resource_group.hov.location
  tags                = local.tags

  security_rule {
    name                       = "allow-postgres-from-app-subnet"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefixes    = var.app_service_subnet_prefixes
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "allow-postgres-from-migration-subnet"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefixes    = var.migration_runner_subnet_prefixes
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_security_group" "private_endpoints" {
  name                = "nex-prod-hov-pe-nsg"
  resource_group_name = azurerm_resource_group.hov.name
  location            = azurerm_resource_group.hov.location
  tags                = local.tags
}

resource "azurerm_network_security_group" "migration_runner" {
  name                = "nex-prod-hov-migration-nsg"
  resource_group_name = azurerm_resource_group.hov.name
  location            = azurerm_resource_group.hov.location
  tags                = local.tags

  security_rule {
    name                       = "deny-all-inbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet" "app_service" {
  name                 = "nex-prod-hov-app-snet"
  resource_group_name  = azurerm_resource_group.hov.name
  virtual_network_name = azurerm_virtual_network.hov.name
  address_prefixes     = var.app_service_subnet_prefixes

  delegation {
    name = "app-service-delegation"

    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

resource "azurerm_subnet" "postgres" {
  name                 = "nex-prod-hov-pg-snet"
  resource_group_name  = azurerm_resource_group.hov.name
  virtual_network_name = azurerm_virtual_network.hov.name
  address_prefixes     = var.postgres_subnet_prefixes
  service_endpoints    = ["Microsoft.Storage"]

  delegation {
    name = "postgres-flexible-server-delegation"

    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "private_endpoints" {
  name                              = "nex-prod-hov-pe-snet"
  resource_group_name               = azurerm_resource_group.hov.name
  virtual_network_name              = azurerm_virtual_network.hov.name
  address_prefixes                  = var.private_endpoints_subnet_prefixes
  private_endpoint_network_policies = "Disabled"
}

resource "azurerm_subnet" "migration_runner" {
  name                 = "nex-prod-hov-migration-snet"
  resource_group_name  = azurerm_resource_group.hov.name
  virtual_network_name = azurerm_virtual_network.hov.name
  address_prefixes     = var.migration_runner_subnet_prefixes
}

resource "azurerm_subnet_network_security_group_association" "app_service" {
  subnet_id                 = azurerm_subnet.app_service.id
  network_security_group_id = azurerm_network_security_group.app_service.id
}

resource "azurerm_subnet_network_security_group_association" "postgres" {
  subnet_id                 = azurerm_subnet.postgres.id
  network_security_group_id = azurerm_network_security_group.postgres.id
}

resource "azurerm_subnet_network_security_group_association" "private_endpoints" {
  subnet_id                 = azurerm_subnet.private_endpoints.id
  network_security_group_id = azurerm_network_security_group.private_endpoints.id
}

resource "azurerm_subnet_network_security_group_association" "migration_runner" {
  subnet_id                 = azurerm_subnet.migration_runner.id
  network_security_group_id = azurerm_network_security_group.migration_runner.id
}

resource "azurerm_private_dns_zone" "postgres" {
  name                = "private.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.hov.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone" "blob" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = azurerm_resource_group.hov.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone" "vault" {
  name                = "privatelink.vaultcore.azure.net"
  resource_group_name = azurerm_resource_group.hov.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone" "cosmos_mongo" {
  name                = "privatelink.mongo.cosmos.azure.com"
  resource_group_name = azurerm_resource_group.hov.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "nex-prod-hov-pg-dns-link"
  resource_group_name   = azurerm_resource_group.hov.name
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  virtual_network_id    = azurerm_virtual_network.hov.id
  registration_enabled  = false
  tags                  = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "blob" {
  name                  = "nex-prod-hov-blob-dns-link"
  resource_group_name   = azurerm_resource_group.hov.name
  private_dns_zone_name = azurerm_private_dns_zone.blob.name
  virtual_network_id    = azurerm_virtual_network.hov.id
  registration_enabled  = false
  tags                  = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "vault" {
  name                  = "nex-prod-hov-kv-dns-link"
  resource_group_name   = azurerm_resource_group.hov.name
  private_dns_zone_name = azurerm_private_dns_zone.vault.name
  virtual_network_id    = azurerm_virtual_network.hov.id
  registration_enabled  = false
  tags                  = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "cosmos_mongo" {
  name                  = "nex-prod-hov-cosmos-dns-link"
  resource_group_name   = azurerm_resource_group.hov.name
  private_dns_zone_name = azurerm_private_dns_zone.cosmos_mongo.name
  virtual_network_id    = azurerm_virtual_network.hov.id
  registration_enabled  = false
  tags                  = local.tags
}

resource "azurerm_storage_account" "app" {
  name                              = var.app_storage_account_name
  resource_group_name               = azurerm_resource_group.hov.name
  location                          = azurerm_resource_group.hov.location
  account_tier                      = "Standard"
  account_replication_type          = "ZRS"
  account_kind                      = "StorageV2"
  min_tls_version                   = "TLS1_2"
  public_network_access_enabled     = false
  shared_access_key_enabled         = false
  default_to_oauth_authentication   = true
  allow_nested_items_to_be_public   = false
  infrastructure_encryption_enabled = true

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 30
    }

    container_delete_retention_policy {
      days = 30
    }
  }

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
  }

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azapi_resource" "app_containers" {
  for_each = toset(["asset-uploads", "documents", "migration-staging"])

  type      = "Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01"
  name      = each.value
  parent_id = "${azurerm_storage_account.app.id}/blobServices/default"

  body = {
    properties = {
      publicAccess = "None"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_private_endpoint" "blob" {
  name                = "nex-prod-hov-blob-pe"
  resource_group_name = azurerm_resource_group.hov.name
  location            = azurerm_resource_group.hov.location
  subnet_id           = azurerm_subnet.private_endpoints.id
  tags                = local.tags

  private_service_connection {
    name                           = "nex-prod-hov-blob-psc"
    private_connection_resource_id = azurerm_storage_account.app.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "blob"
    private_dns_zone_ids = [azurerm_private_dns_zone.blob.id]
  }
}

resource "azurerm_key_vault" "hov" {
  name                          = var.key_vault_name
  resource_group_name           = azurerm_resource_group.hov.name
  location                      = azurerm_resource_group.hov.location
  tenant_id                     = var.target_tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  purge_protection_enabled      = true
  soft_delete_retention_days    = 90
  public_network_access_enabled = false

  network_acls {
    bypass         = "AzureServices"
    default_action = "Deny"
  }

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_private_endpoint" "key_vault" {
  name                = "nex-prod-hov-kv-pe"
  resource_group_name = azurerm_resource_group.hov.name
  location            = azurerm_resource_group.hov.location
  subnet_id           = azurerm_subnet.private_endpoints.id
  tags                = local.tags

  private_service_connection {
    name                           = "nex-prod-hov-kv-psc"
    private_connection_resource_id = azurerm_key_vault.hov.id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "vault"
    private_dns_zone_ids = [azurerm_private_dns_zone.vault.id]
  }
}

resource "azurerm_postgresql_flexible_server" "hov" {
  name                          = var.postgres_server_name
  resource_group_name           = azurerm_resource_group.hov.name
  location                      = azurerm_resource_group.hov.location
  version                       = "16"
  delegated_subnet_id           = azurerm_subnet.postgres.id
  private_dns_zone_id           = azurerm_private_dns_zone.postgres.id
  public_network_access_enabled = false
  sku_name                      = "B_Standard_B2s"
  storage_mb                    = 32768
  backup_retention_days         = 14
  geo_redundant_backup_enabled  = true

  authentication {
    active_directory_auth_enabled = true
    password_auth_enabled         = false
    tenant_id                     = var.target_tenant_id
  }

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]
}

resource "azurerm_postgresql_flexible_server_database" "hov" {
  name      = var.postgres_database_name
  server_id = azurerm_postgresql_flexible_server.hov.id
  charset   = "UTF8"
  collation = "en_US.utf8"

  lifecycle {
    prevent_destroy = true
  }
}

# AzAPI is intentional: AzureRM exports Cosmos account keys into Terraform
# state. ARM PUT responses do not contain the runtime keys, keeping this state
# free of Cosmos credentials. Runtime key retrieval and Key Vault insertion are
# separate, audited migration steps.
resource "azapi_resource" "cosmos" {
  type      = "Microsoft.DocumentDB/databaseAccounts@2024-05-15"
  name      = var.cosmos_account_name
  parent_id = azurerm_resource_group.hov.id
  location  = azurerm_resource_group.hov.location
  tags      = local.tags

  body = {
    kind = "MongoDB"
    properties = {
      databaseAccountOfferType = "Standard"
      publicNetworkAccess      = "Disabled"
      minimalTlsVersion        = "Tls12"
      enableAutomaticFailover  = false
      locations = [{
        locationName     = azurerm_resource_group.hov.location
        failoverPriority = 0
        isZoneRedundant  = false
      }]
      consistencyPolicy = {
        defaultConsistencyLevel = "Session"
      }
      capabilities = [{
        name = "EnableMongo"
      }]
      apiProperties = {
        serverVersion = "4.2"
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azapi_resource" "cosmos_mongo_database" {
  type      = "Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2024-05-15"
  name      = var.cosmos_mongo_database_name
  parent_id = azapi_resource.cosmos.id

  body = {
    properties = {
      resource = {
        id = var.cosmos_mongo_database_name
      }
      options = {}
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azapi_resource" "cosmos_mongo_collection" {
  type      = "Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2024-05-15"
  name      = var.cosmos_mongo_collection_name
  parent_id = azapi_resource.cosmos_mongo_database.id

  body = {
    properties = {
      resource = {
        id = var.cosmos_mongo_collection_name
        shardKey = {
          _id = "Hash"
        }
      }
      options = {
        throughput = 400
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_private_endpoint" "cosmos_mongo" {
  name                = "nex-prod-hov-cosmos-pe"
  resource_group_name = azurerm_resource_group.hov.name
  location            = azurerm_resource_group.hov.location
  subnet_id           = azurerm_subnet.private_endpoints.id
  tags                = local.tags

  private_service_connection {
    name                           = "nex-prod-hov-cosmos-psc"
    private_connection_resource_id = azapi_resource.cosmos.id
    subresource_names              = ["MongoDB"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "cosmos-mongo"
    private_dns_zone_ids = [azurerm_private_dns_zone.cosmos_mongo.id]
  }
}
