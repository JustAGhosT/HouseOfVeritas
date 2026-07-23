# Handoff - HOV Mystira OIDC production closeout

- **Date:** 2026-07-23
- **Repo:** `C:\Users\smitj\repos\house-of-veritas`
- **Branch:** `main`
- **Baton tasks:** `4caa078e-a290-4ead-b551-9009d9469f83`, `8fa30c89-a27c-4f2a-b517-d2b651e146ab`
- **Area:** Mystira Identity issuer, OIDC client secret, Azure Key Vault reference

## Live Production Evidence

Checked on 2026-07-23:

- HOV production App Service `nl-prod-hov-app` has `MYSTIRA_OIDC_ISSUER=https://identity.mystira.app`.
- HOV production App Service has `MYSTIRA_OIDC_CLIENT_ID=neuralliquid-hov-web`.
- HOV production App Service has `MYSTIRA_OIDC_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://nl-prod-hov-kv.vault.azure.net/secrets/mystira-oidc-client-secret)`.
- App Service config reference status for `MYSTIRA_OIDC_CLIENT_SECRET` is `Resolved` with `identityType=SystemAssigned`.
- HOV production managed identity is SystemAssigned with principal ID `77a6c4b6-699b-4d4f-9c6e-d65228d3916d`.
- Key Vault `nl-prod-hov-kv` uses access policies, not RBAC (`enableRbacAuthorization=false`).
- Local interactive Azure user cannot list Key Vault secrets; that is expected and does not contradict the App Service reference status.
- `https://identity.mystira.app/.well-known/openid-configuration` returns a standards-compliant OpenIddict discovery document with `/connect/authorize`, `/connect/token`, `/connect/userinfo`, `/connect/endsession`, `/connect/revoke`, `/connect/introspect`, and JWKS endpoints.
- `https://hov.neuralliquid.ai/api/health` returns `status=healthy` with clean empty data mode.

## Repo State

Terraform production defaults now match the live production posture:

- `mystira_oidc_issuer` defaults to `https://identity.mystira.app`.
- `mystira_oidc_client_id` defaults to `neuralliquid-hov-web`.
- `mystira_oidc_client_secret_key_vault_secret_name` defaults to `mystira-oidc-client-secret`.
- `terraform/modules/webapp` emits `MYSTIRA_OIDC_CLIENT_SECRET` as an App Service Key Vault reference when the secret-name variable is set.
- `terraform/modules/webapp` grants the web app SystemAssigned managed identity `Get` and `List` secret permissions on the HOV Key Vault.

## Closeout

The old Baton tasks were stale. The production issuer cutover and Key Vault secret reference are already live and resolved. No HOV runtime code change was required in this closeout pass.

Residual manual check: a browser login round trip can still be used as a final smoke check when an operator account is available, but the infrastructure/configuration blockers tracked by these tasks are closed.
