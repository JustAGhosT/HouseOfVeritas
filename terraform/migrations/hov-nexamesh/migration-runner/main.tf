data "azurerm_client_config" "current" {}

data "terraform_remote_state" "foundation" {
  backend = "azurerm"

  config = {
    resource_group_name  = "nex-prod-hov-tfstate-rg"
    storage_account_name = "nexprodhovtfstate"
    container_name       = "tfstate"
    key                  = "hov/prod/foundation-data.tfstate"
    tenant_id            = var.target_tenant_id
    subscription_id      = var.target_subscription_id
    use_azuread_auth     = true
  }
}

locals {
  vm_name = "nex-prod-hov-migration-vm"

  required_tags = {
    environment = "production"
    project     = "house-of-veritas"
    product     = "hov"
    portfolio   = "nexamesh"
    managed_by  = "terraform"
    state_scope = "hov-migration-runner"
    temporary   = "true"
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

    precondition {
      condition     = data.terraform_remote_state.foundation.outputs.resource_group_name == "nex-prod-hov-rg"
      error_message = "Foundation remote state is not the approved HOV target resource group."
    }

    precondition {
      condition     = data.terraform_remote_state.foundation.outputs.location == var.location
      error_message = "Foundation remote state region does not match the approved migration region."
    }
  }
}

resource "azurerm_public_ip" "nat" {
  name                = "nex-prod-hov-migration-nat-pip"
  resource_group_name = data.terraform_remote_state.foundation.outputs.resource_group_name
  location            = var.location
  allocation_method   = "Static"
  sku                 = "Standard"
  zones               = ["1"]
  tags                = local.tags

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [terraform_data.target_guard]
}

resource "azurerm_nat_gateway" "migration" {
  name                    = "nex-prod-hov-migration-nat"
  resource_group_name     = data.terraform_remote_state.foundation.outputs.resource_group_name
  location                = var.location
  sku_name                = "Standard"
  idle_timeout_in_minutes = 10
  zones                   = ["1"]
  tags                    = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_nat_gateway_public_ip_association" "migration" {
  nat_gateway_id       = azurerm_nat_gateway.migration.id
  public_ip_address_id = azurerm_public_ip.nat.id

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_subnet_nat_gateway_association" "migration" {
  subnet_id      = data.terraform_remote_state.foundation.outputs.migration_runner_subnet_id
  nat_gateway_id = azurerm_nat_gateway.migration.id

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_network_interface" "migration" {
  name                = "${local.vm_name}-nic"
  resource_group_name = data.terraform_remote_state.foundation.outputs.resource_group_name
  location            = var.location
  tags                = local.tags

  ip_configuration {
    name                          = "private"
    subnet_id                     = data.terraform_remote_state.foundation.outputs.migration_runner_subnet_id
    private_ip_address_allocation = "Dynamic"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_linux_virtual_machine" "migration" {
  name                                                   = local.vm_name
  computer_name                                          = "hovmigration"
  resource_group_name                                    = data.terraform_remote_state.foundation.outputs.resource_group_name
  location                                               = var.location
  size                                                   = var.vm_size
  admin_username                                         = var.admin_username
  disable_password_authentication                        = true
  network_interface_ids                                  = [azurerm_network_interface.migration.id]
  provision_vm_agent                                     = true
  allow_extension_operations                             = true
  custom_data                                            = base64encode(file("${path.module}/cloud-init.yaml"))
  secure_boot_enabled                                    = true
  vtpm_enabled                                           = true
  patch_assessment_mode                                  = "AutomaticByPlatform"
  patch_mode                                             = "AutomaticByPlatform"
  reboot_setting                                         = "IfRequired"
  bypass_platform_safety_checks_on_user_schedule_enabled = false
  tags                                                   = local.tags

  admin_ssh_key {
    username   = var.admin_username
    public_key = trimspace(var.admin_ssh_public_key)
  }

  identity {
    type = "SystemAssigned"
  }

  os_disk {
    name                 = "${local.vm_name}-osdisk"
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "24.04.202608070"
  }

  boot_diagnostics {}

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [azurerm_subnet_nat_gateway_association.migration]
}

resource "azurerm_virtual_machine_extension" "tooling_readiness" {
  name                       = "hov-migration-tooling-readiness"
  virtual_machine_id         = azurerm_linux_virtual_machine.migration.id
  publisher                  = "Microsoft.Azure.Extensions"
  type                       = "CustomScript"
  type_handler_version       = "2.1"
  auto_upgrade_minor_version = false
  automatic_upgrade_enabled  = false

  settings = jsonencode({
    commandToExecute = "bash -lc 'cloud-init status --wait --long && /usr/local/sbin/hov-verify-migration-tools'"
  })

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_role_assignment" "target_blob" {
  scope                = data.terraform_remote_state.foundation.outputs.app_storage_account_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_linux_virtual_machine.migration.identity[0].principal_id
  principal_type       = "ServicePrincipal"

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_role_assignment" "target_secrets" {
  scope                = data.terraform_remote_state.foundation.outputs.key_vault_id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = azurerm_linux_virtual_machine.migration.identity[0].principal_id
  principal_type       = "ServicePrincipal"

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_postgresql_flexible_server_active_directory_administrator" "migration" {
  server_name         = data.terraform_remote_state.foundation.outputs.postgres_server_name
  resource_group_name = data.terraform_remote_state.foundation.outputs.resource_group_name
  tenant_id           = var.target_tenant_id
  object_id           = azurerm_linux_virtual_machine.migration.identity[0].principal_id
  principal_name      = azurerm_linux_virtual_machine.migration.name
  principal_type      = "ServicePrincipal"

  lifecycle {
    prevent_destroy = true
  }
}
