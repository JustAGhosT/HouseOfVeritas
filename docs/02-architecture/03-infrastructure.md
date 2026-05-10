# Infrastructure Architecture

## Azure Resource Map

```text
Subscription: 22f9eb18-6553-4b7d-9451-47d0195085fe
Region: South Africa North

Resource Groups
├── hov-shared-tfstate-rg           (Terraform state backend)
│   └── hovsharedtfstatesa           Storage Account (LRS)
│       └── tfstate                  Blob Container
│
└── nl-prod-hov-rg-san               (Production workload)
    ├── Network
    │   ├── prod-vnet                 VNet 10.0.0.0/16
    │   │   ├── prod-gateway-subnet   10.0.1.0/24
    │   │   ├── prod-container-subnet 10.0.2.0/24 (delegated: ACI)
    │   │   └── prod-database-subnet  10.0.3.0/24 (endpoints: SQL, Storage)
    │   ├── prod-gateway-nsg          Allow 80, 443 inbound
    │   ├── prod-container-nsg        Allow gateway subnet only
    │   └── prod-database-nsg         Allow container subnet on 5432 only
    │
    ├── Compute
    │   ├── prod-docuseal              ACI (2 CPU, 4 GB) — port 3000
    │   └── prod-baserow               ACI (2 CPU, 4 GB) — port 80
    │
    ├── Database
    │   ├── nl-prod-hov-pg-san         PostgreSQL Flexible (B_Standard_B1ms)
    │   │   ├── docuseal_production    Database
    │   │   └── baserow_production     Database
    │   ├── nl-prod-hov-cosmos-san     Cosmos DB (Mongo API)
    │   │   └── house_of_veritas       Database for kiosk requests, audit fallback
    │   │       ├── Network: Private endpoints with VNet integration
    │   │       ├── Private DNS Zone: privatelink.mongo.cosmos.azure.com
    │   │       └── Access: Managed identity (production) / connection string fallback (local/dev)
    │   └── Private DNS Zone           private.postgres.database.azure.com
    │
    ├── Storage
    │   └── nlprodhovstsan             Storage Account (GRS)
    │       ├── documents              Blob container (cool 90d, archive 365d)
    │       ├── backups                Blob container (cool 7d, delete 30d)
    │       ├── asset-uploads          Blob container (photo uploads)
    │       ├── tfstate                Blob container
    │       ├── docuseal-data          File share (10 GB)
    │       └── baserow-data           File share (10 GB)
    │
    ├── Security
    │   └── nl-prod-hov-kv-san         Key Vault (standard)
    │       ├── db-admin-password
    │       ├── cosmos-connection-string  (fallback for local/dev; rotate regularly)
    │       ├── docuseal-secret-key
    │       ├── baserow-secret-key
    │       └── smtp-password
    │
    ├── Gateway
    │   ├── prod-appgw                 Application Gateway WAF v2
    │   └── prod-gateway-pip           Public IP (static)
    │
    └── Cognitive
        └── nl-prod-hov-di-san         Document Intelligence (S0)
```

## Terraform Module Structure

```text
terraform/
├── environments/
│   └── production/
│       ├── main.tf              Root config, wires all modules
│       ├── variables.tf         Input variables with defaults
│       ├── outputs.tf           Deployment outputs
│       ├── backend.hcl          State backend config
│       └── terraform.tfvars     Local overrides (gitignored)
│
└── modules/
    ├── network/                 VNet, subnets, NSGs
    ├── storage/                 Storage account, containers, lifecycle
    ├── security/                Key Vault, access policies, secrets
    ├── database/                PostgreSQL Flexible Server, databases, DNS
    ├── cosmosdb-mongo/           Cosmos DB (Mongo API)
    ├── compute/                 Container Instances, file shares, KV access
    ├── gateway/                 Application Gateway, public IP, WAF
    ├── cognitive/               Document Intelligence (OCR)
    └── dns/                     Azure DNS A records for nexamesh.ai
```

## Module Dependencies

```text
network ─────────────┬──────────────────────────────────┐
                     │                                  │
              ┌──────▼──────┐                    ┌──────▼──────┐
              │   storage   │                    │  security   │
              └──────┬──────┘                    └──────┬──────┘
                     │                                  │
              ┌──────▼──────────────────────────────────▼──┐
              │              database                       │
              └──────────────────┬──────────────────────────┘
                                 │
              ┌──────────────────▼──────────────────────────┐
              │              compute                        │
              └──────────────────┬──────────────────────────┘
                                 │
              ┌──────────────────▼──────────────────────────┐
              │              gateway                        │
              └──────────────────┬──────────────────────────┘
                                 │
              ┌──────────────────▼──────┐     ┌─────────────┐
              │          dns            │     │  cognitive   │
              └─────────────────────────┘     └─────────────┘
```

## DNS Configuration

| Record             | Type | Target                 | Zone                      |
| ------------------ | ---- | ---------------------- | ------------------------- |
| `docs.nexamesh.ai` | A    | Application Gateway IP | `nl-prod-nexamesh-rg-san` |
| `ops.nexamesh.ai`  | A    | Application Gateway IP | `nl-prod-nexamesh-rg-san` |
| `nexamesh.ai`      | A    | Application Gateway IP | `nl-prod-nexamesh-rg-san` |

## Traffic Flow

```text
User Browser
  │
  ▼
docs.nexamesh.ai / ops.nexamesh.ai  (Azure DNS)
  │
  ▼
Application Gateway (WAF v2, SSL termination)
  │
  ├──► prod-docuseal (ACI) :3000  ──► docuseal_production (PostgreSQL)
  │                                    └──► documents (Blob Storage)
  │
  └──► prod-baserow  (ACI) :80   ──► baserow_production (PostgreSQL)
                                      └──► asset-uploads (Blob Storage)

Document Intelligence (nl-prod-hov-di-san)
  └──► Called by app API for OCR scanning
```

## Cost Estimate (Monthly)

| Service                  | SKU               | Est. Cost (ZAR)               |
| ------------------------ | ----------------- | ----------------------------- |
| PostgreSQL Flexible      | B_Standard_B1ms   | R400                          |
| Cosmos DB (Mongo API)    | 400 RU/s          | R150                          |
| Container Instances (x2) | 2 CPU / 4 GB each | R300                          |
| Application Gateway      | WAF_v2 (1 unit)   | R150                          |
| Storage Account          | Standard GRS      | R50                           |
| Key Vault + DNS          | Standard          | R50                           |
| Document Intelligence    | S0                | R0 (free tier for low volume) |
| **Total**                |                   | **~R1100**                    |
