import {
  to = module.webapp.azurerm_app_service_custom_hostname_binding.root[0]
  id = "/subscriptions/bb4e3882-2079-4bab-8974-611bc0b8bb58/resourceGroups/nl-prod-hov-rg/providers/Microsoft.Web/sites/nl-prod-hov-app/hostNameBindings/hov.neuralliquid.ai"
}
# The operator Key Vault access policy was created by hand on 2026-08-07 to move
# the estate connection string into nl-prod-hov-kv, before the module declared
# it. Adopt it rather than trying to create a policy that already exists.
import {
  to = module.security.azurerm_key_vault_access_policy.operators["99b63adb-8f1a-4d7a-a98c-5bfe9c7fcd96"]
  id = "/subscriptions/bb4e3882-2079-4bab-8974-611bc0b8bb58/resourceGroups/nl-prod-hov-rg/providers/Microsoft.KeyVault/vaults/nl-prod-hov-kv/objectId/99b63adb-8f1a-4d7a-a98c-5bfe9c7fcd96"
}
