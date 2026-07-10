# Canonical Azure Naming Migration

House of Veritas is moving away from region-suffixed Azure resource names such
as `nl-prod-hov-rg-san`. The canonical production names remove the region code:

| Resource | Current | Canonical |
| --- | --- | --- |
| Resource group | `nl-prod-hov-rg-san` | `nl-prod-hov-rg` |
| Virtual network | `nl-prod-hov-vnet-san` | `nl-prod-hov-vnet` |
| Storage account | `nlprodhovstsan` | `nlprodhovst` |
| Key Vault | `nl-prod-hov-kv-san` | `nl-prod-hov-kv` |
| PostgreSQL | `nl-prod-hov-pg-san` | `nl-prod-hov-pg` |
| Cosmos DB | `nlprodhovcosmosan` | `nlprodhovcosmos` |
| Document Intelligence | `nl-prod-hov-di-san` | `nl-prod-hov-di` |
| Web App | `nl-prod-hov-app-san` | `nl-prod-hov-app` |
| Function App | `nl-prod-hov-func-san` | `nl-prod-hov-func` |

## Required Approach

Azure cannot rename most of these resources in place. In Terraform, changing
these names against the existing production state will plan replacements and can
destroy or orphan live infrastructure. Use a parallel canonical stack instead:

1. Keep the existing `-san` stack untouched and serving production.
2. Create a separate canonical Terraform state key for the canonical stack.
3. Apply the canonical stack using
   `terraform/environments/production/canonical.tfvars.example` as the template.
4. Deploy the app to the canonical Web App and Function App.
5. Bring up operational data services under canonical infrastructure.
6. Smoke-check canonical endpoints and health.
7. Cut over DNS and GitHub Actions variables to canonical names.
8. Retire the `-san` stack only after backups and validation are complete.

## Low-Usage Cost Target

Current expected use is about four users, twice per day each. The production
stack should optimize for idle cost first.

Current `-san` spend from Azure Cost Management for 2026-06-10 through
2026-07-10 was about `$33.52`, almost entirely Cosmos DB:

| Service | Cost |
| --- | ---: |
| Azure Cosmos DB | `$33.51` |
| Azure App Service | `$0.01` |
| Key Vault and Storage | `<$0.01` |

The previously planned operational-data target was too expensive for this usage
level because it included WAF_v2 Application Gateway and two always-on Azure
Container Instances. That shape would likely idle around `$630-$700/month`.

Use this cheaper target instead:

| Area | Low-usage decision | Monthly target |
| --- | --- | ---: |
| Edge/WAF | Do not deploy Application Gateway WAF_v2 yet | save about `$380+` |
| Baserow/DocuSeal | Prefer scale-to-zero hosting before production cutover | save most idle compute |
| Cosmos DB | Remove if kiosk data can move to Postgres/Baserow; otherwise use free tier | save about `$33` |
| Functions | Prefer Consumption plan or fold jobs into app until volume justifies B1 | save about `$14` |
| Storage | Use LRS until backup/DR policy requires GRS | small saving |

Practical goal for the canonical stack: keep idle/low-usage spend around
`$50-$120/month`, not `$600+`.

## Do Not Do

- Do not pass canonical names to the existing `-san` state and run a broad
  `terraform apply`.
- Do not destroy the `-san` resource group until the canonical stack has served
  production traffic and backups have been verified.
- Do not enable operational data in the app before Baserow and DocuSeal have
  real API keys and table IDs configured.

## Terraform Notes

The canonical tfvars template documents the low-usage profile now used by the
production defaults. The repository deployment workflows target canonical names
and default to the `production-canonical.terraform.tfstate` backend key.

Use a distinct backend key for the canonical state, for example:

```powershell
terraform init -reconfigure `
  -backend-config="resource_group_name=hov-shared-tfstate-rg" `
  -backend-config="storage_account_name=hovsharedtfstatesa" `
  -backend-config="container_name=tfstate" `
  -backend-config="key=house-of-veritas-prod-canonical.tfstate"
```

Then plan with copied, secret-filled tfvars:

```powershell
terraform plan -no-color `
  -var-file="canonical.tfvars" `
  -var="ssl_certificate_data=$env:SSL_CERTIFICATE_DATA" `
  -var="ssl_certificate_password=$env:SSL_CERTIFICATE_PASSWORD"
```
