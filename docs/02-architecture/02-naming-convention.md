# House of Veritas - Azure Resource Naming Convention

## Naming Pattern

```text
nl-{env}-hov-{resourcetype}
```

### Components

| Component        | Description                | Values                     |
| ---------------- | -------------------------- | -------------------------- |
| `nl`             | Namespace/Prefix           | Always `nl`                |
| `{env}`          | Environment                | `prod`, `dev`, `staging`   |
| `hov`            | Project Code               | House of Veritas           |
| `{resourcetype}` | Resource type abbreviation | See below                  |
| `{location}`     | Azure region short code    | Deprecated for production resource names |

### Resource Type Abbreviations

| Resource               | Abbreviation | Example                           |
| ---------------------- | ------------ | --------------------------------- |
| Resource Group         | `rg`         | `nl-prod-hov-rg`                  |
| Virtual Network        | `vnet`       | `nl-prod-hov-vnet`                |
| Subnet                 | `snet`       | `nl-prod-hov-snet-containers`     |
| Network Security Group | `nsg`        | `nl-prod-hov-nsg`                 |
| Storage Account        | `st`         | `nlprodhovst` (no hyphens)        |
| Key Vault              | `kv`         | `nl-prod-hov-kv`                  |
| PostgreSQL Server      | `pg`         | `nl-prod-hov-pg`                  |
| Container Instance     | `aci`        | `nl-prod-hov-aci-docuseal`        |
| Application Gateway    | `agw`        | `nl-prod-hov-agw`                 |
| Function App           | `func`       | `nl-prod-hov-func`                |
| Container Registry     | `cr`         | `nlprodhovcr` (no hyphens)        |
| Public IP              | `pip`        | `nl-prod-hov-pip-agw`             |
| Log Analytics          | `log`        | `nl-prod-hov-log`                 |
| App Insights           | `appi`       | `nl-prod-hov-appi`                |

### Special Cases

Some Azure resources don't allow hyphens in names:

- **Storage Accounts**: `nlprodhovst` (concatenated)
- **Container Registry**: `nlprodhovcr` (concatenated)

### Location Codes

| Azure Region       | Short Code |
| ------------------ | ---------- |
| South Africa North | `san`      |
| West Europe        | `weu`      |
| North Europe       | `neu`      |
| East US            | `eus`      |
| West US            | `wus`      |

Region suffixes such as `-san` are retained only in historical references to
the retired demo stack. Active production resources must omit the region suffix.

## Resource Inventory

### Production Environment (`prod`) - Live Baseline

| Resource           | Name                           | Purpose                  |
| ------------------ | ------------------------------ | ------------------------ |
| Resource Group     | `nl-prod-hov-rg`               | All production resources |
| Virtual Network    | `nl-prod-hov-vnet`             | Network isolation        |
| Storage Account    | `nlprodhovst`                  | Document/backup storage  |
| Key Vault          | `nl-prod-hov-kv`               | Secrets management       |
| Web App            | `nl-prod-hov-app`              | Next.js application      |

### Production Environment (`prod`) - Optional Add-Ons

These names are reserved for future production services, but the services are
not part of the low-usage baseline. Enable them only when there is a live
operational requirement, integration credentials are ready, and the cost impact
has an owner decision.

| Resource              | Name                       | Purpose                  |
| --------------------- | -------------------------- | ------------------------ |
| PostgreSQL            | `nl-prod-hov-pg`           | Optional database server |
| Cosmos DB             | `nlprodhovcosmos`          | Optional document store  |
| Document Intelligence | `nl-prod-hov-di`           | Optional OCR             |
| App Gateway           | `nl-prod-hov-agw`          | Optional WAF/edge        |
| DocuSeal Container    | `nl-prod-hov-aci-docuseal` | Optional document signing |
| Baserow Container     | `nl-prod-hov-aci-baserow`  | Optional operations data |
| Function App          | `nl-prod-hov-func`         | Optional automation jobs |

### Retired Demo Stack

Names ending in `-san` or `san`, such as `nl-prod-hov-rg-san` and
`nlprodhovstsan`, belonged to the disposable demo stack. Do not use them for
new production work, GitHub Actions defaults, Terraform examples, or runbooks.

### Development Environment (`dev`)

| Resource        | Name                  | Purpose                 |
| --------------- | --------------------- | ----------------------- |
| Resource Group  | `nl-dev-hov-rg`       | Development resources   |
| Virtual Network | `nl-dev-hov-vnet`     | Network isolation       |
| PostgreSQL      | `nl-dev-hov-pg`       | Database server         |
| Storage Account | `nldevhovst`          | Document/backup storage |
| Key Vault       | `nl-dev-hov-kv`       | Secrets management      |

## Tags

All resources should have these tags:

```hcl
tags = {
  Project     = "HouseOfVeritas"
  Environment = "Production"  # or Development, Staging
  ManagedBy   = "Terraform"
  Owner       = "Hans"
  CostCenter  = "Operations"
}
```

## Environment Variables

Update these in your configuration:

```bash
# .env or GitHub Secrets
AZURE_RESOURCE_GROUP=nl-prod-hov-rg
AZURE_KEY_VAULT_NAME=nl-prod-hov-kv
AZURE_STORAGE_ACCOUNT=nlprodhovst
AZURE_FUNCTION_APP=nl-prod-hov-func
AZURE_ENV=prod
AZURE_LOCATION=southafricanorth
```

## Terraform Usage

```hcl
# variables.tf
variable "environment" {
  default = "prod"
}

variable "location_short" {
  default = ""
}

# locals.tf
locals {
  name_prefix = "nl-${var.environment}-hov"

  resource_group_name = "${local.name_prefix}-rg"
  vnet_name           = "${local.name_prefix}-vnet"
  keyvault_name       = "${local.name_prefix}-kv"
  postgres_name       = "${local.name_prefix}-pg"
  storage_name        = "nl${var.environment}hovst"
}
```
