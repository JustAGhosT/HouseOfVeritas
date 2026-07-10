# Canonical Azure Production Profile

House of Veritas production now uses canonical Azure resource names without the
old South Africa North `-san` suffix. The `-san` stack was a disposable demo
environment and should not be used as the model for new production resources.

## Environment Classes

| Class | Purpose | Naming | Current status |
| --- | --- | --- | --- |
| Canonical production | Live low-usage application stack | `nl-prod-hov-*`, `nlprodhov*` | Active |
| Optional operational services | Baserow, DocuSeal, Functions, WAF, database add-ons | Canonical names only | Disabled until justified |
| Legacy demo | Original demo stack with region suffix | `*-san`, `*san` | Retired/deleting |

The production default is intentionally small: App Service, Storage, Key Vault,
and VNet. Optional services must be enabled deliberately and cost-reviewed first.

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

## Cutover Status

The canonical stack has been created under the separate backend key
`production-canonical.terraform.tfstate` and deployed to:

| Item | Value |
| --- | --- |
| Resource group | `nl-prod-hov-rg` |
| Web App | `nl-prod-hov-app` |
| Default URL | `https://nl-prod-hov-app.azurewebsites.net` |
| Data mode | `empty` until live operational integrations are configured |
| Baserow/DocuSeal health state | `unconfigured`, not degraded |

The old `nl-prod-hov-rg-san` resource group is no longer a production fallback.
It was requested for deletion after the canonical app returned healthy.

## Required Approach For Future Changes

Azure cannot rename most resources in place. In Terraform, changing names
against an existing state can plan replacements and can destroy or orphan live
infrastructure. Keep these rules:

1. Use `production-canonical.terraform.tfstate` for canonical production.
2. Do not reintroduce `-san` names in active workflows, Terraform defaults, or
   deployment scripts.
3. Keep costly modules disabled unless a real production use case justifies
   them.
4. Treat Baserow, DocuSeal, Functions, Cosmos, PostgreSQL, Document
   Intelligence, monitoring, and Application Gateway as optional add-ons.
5. Run a targeted stale-name sweep over `.github`, `terraform`, and `config`
   before merging infrastructure changes.

## Low-Usage Cost Target

Current expected use is about four users, twice per day each. The production
stack should optimize for idle cost first.

Legacy `-san` spend from Azure Cost Management for 2026-06-10 through
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

Practical goal for the canonical baseline: keep idle/low-usage spend in the
low tens per month. Only move toward `$50-$120/month` after operational services
are actually being used.

## Do Not Do

- Do not pass canonical names to the existing `-san` state and run a broad
  `terraform apply`.
- Do not recreate the `-san` stack for production.
- Do not enable operational data services before Baserow and DocuSeal have real
  API keys, table IDs, owners, and a cost owner decision.
- Do not make `/api/health` depend on disabled optional integrations.

## Terraform Notes

The canonical tfvars template documents the low-usage profile now used by the
production defaults. The repository deployment workflows target canonical names
and default to the `production-canonical.terraform.tfstate` backend key.

Use the canonical backend key:

```powershell
terraform init -reconfigure `
  -backend-config="resource_group_name=hov-shared-tfstate-rg" `
  -backend-config="storage_account_name=hovsharedtfstatesa" `
  -backend-config="container_name=tfstate" `
  -backend-config="key=production-canonical.terraform.tfstate"
```

Then plan with copied, secret-filled tfvars:

```powershell
terraform plan -no-color `
  -var-file="canonical.tfvars" `
  -var="ssl_certificate_data=$env:SSL_CERTIFICATE_DATA" `
  -var="ssl_certificate_password=$env:SSL_CERTIFICATE_PASSWORD"
```
