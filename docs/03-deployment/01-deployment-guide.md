# House of Veritas — Deployment Guide

## Overview

This guide covers end-to-end deployment of the House of Veritas platform on Azure, including infrastructure provisioning, DNS configuration, SSL certificates, CI/CD pipelines, and application integration.

### Platform Components

| Component             | Purpose                          | Azure Service      |
| --------------------- | -------------------------------- | ------------------ |
| DocuSeal              | Document signing & templates     | Container Instance |
| Baserow               | Operational tracking & data      | Container Instance |
| PostgreSQL            | Application databases            | Flexible Server    |
| Cosmos DB (Mongo)     | Kiosk requests, audit fallback   | Cosmos DB          |
| Blob Storage          | Documents, backups, asset photos | Storage Account    |
| Document Intelligence | OCR scanning for documents       | Cognitive Services |
| Application Gateway   | SSL termination, WAF, routing    | App Gateway WAF v2 |
| Key Vault             | Secrets management               | Key Vault          |
| DNS                   | Domain routing                   | Azure DNS          |

### Architecture

```text
Internet → Application Gateway (WAF + SSL) → Container Instances → PostgreSQL
                                                    ↓
                                              Blob Storage
                                              Document Intelligence
                                              Cosmos DB (Mongo API)
```

- **Domain:** nexamesh.ai (docs.nexamesh.ai, ops.nexamesh.ai)
- **Region:** South Africa North
- **Monthly cost:** ~R1100

---

## Prerequisites

- Azure CLI >= 2.50.0
- Terraform >= 1.5.0
- GitHub account with repository access
- PowerShell 7+ (Windows) or Bash (Linux/macOS)

---

## Step 1: Azure Authentication

### Create Service Principal

```powershell
az login
az account list --output table

$SUBSCRIPTION_ID = "22f9eb18-6553-4b7d-9451-47d0195085fe"
az account set --subscription $SUBSCRIPTION_ID

az ad sp create-for-rbac `
  --name "sp-houseofveritas-terraform" `
  --role "Contributor" `
  --scopes "/subscriptions/$SUBSCRIPTION_ID" `
  --sdk-auth | Out-File -FilePath azure-credentials.json

$creds = Get-Content azure-credentials.json | ConvertFrom-Json
Write-Host "ARM_CLIENT_ID: $($creds.clientId)"
Write-Host "ARM_CLIENT_SECRET: $($creds.clientSecret)"
Write-Host "ARM_TENANT_ID: $($creds.tenantId)"
Write-Host "ARM_SUBSCRIPTION_ID: $($creds.subscriptionId)"
```

### Set Environment Variables

All secrets are stored in `.env.local` at the project root (gitignored). Load them into your session:

```powershell
# Load from .env.local
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
  }
}

# Verify
Write-Host "ARM_CLIENT_ID: $env:ARM_CLIENT_ID"
```

See `.env.local` for the full list of environment variables and secrets.

---

## Step 2: Terraform State Backend

Create the storage account for remote Terraform state.

```powershell
$RESOURCE_GROUP = "hov-shared-tfstate-rg"
$STORAGE_ACCOUNT = "hovsharedtfstatesa"
$CONTAINER = "tfstate"
$LOCATION = "southafricanorth"

az group create `
  --name $RESOURCE_GROUP `
  --location $LOCATION `
  --tags "Purpose=TerraformState" "Project=HouseOfVeritas"

az storage account create `
  --name $STORAGE_ACCOUNT `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION `
  --sku Standard_LRS `
  --kind StorageV2 `
  --encryption-services blob `
  --min-tls-version TLS1_2 `
  --allow-blob-public-access false

$ACCOUNT_KEY = az storage account keys list `
  --resource-group $RESOURCE_GROUP `
  --account-name $STORAGE_ACCOUNT `
  --query '[0].value' -o tsv

az storage container create `
  --name $CONTAINER `
  --account-name $STORAGE_ACCOUNT `
  --account-key $ACCOUNT_KEY `
  --public-access off

az storage account blob-service-properties update `
  --account-name $STORAGE_ACCOUNT `
  --resource-group $RESOURCE_GROUP `
  --enable-versioning true
```

### Backend Configuration

File: `terraform/environments/production/backend.hcl`

```hcl
resource_group_name  = "hov-shared-tfstate-rg"
storage_account_name = "hovsharedtfstatesa"
container_name       = "tfstate"
key                  = "production.terraform.tfstate"
```

---

## Step 3: Configure Secrets

All secrets live in **`.env.local`** at the project root. This file is gitignored and should never be committed.

### .env.local (local development & deployment)

The file contains all credentials needed for local Terraform runs:

| Variable                   | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `ARM_CLIENT_ID`            | Service Principal App ID                    |
| `ARM_CLIENT_SECRET`        | Service Principal Password                  |
| `ARM_TENANT_ID`            | Azure AD Tenant ID                          |
| `ARM_SUBSCRIPTION_ID`      | Azure Subscription ID                       |
| `TF_STATE_RESOURCE_GROUP`  | Terraform state resource group              |
| `TF_STATE_STORAGE_ACCOUNT` | Terraform state storage account             |
| `TF_STATE_CONTAINER`       | Terraform state container                   |
| `TF_STATE_KEY`             | Terraform state blob key                    |
| `TF_STATE_STORAGE_KEY`     | Storage account access key                  |
| `DB_ADMIN_PASSWORD`        | PostgreSQL admin password                   |
| `DOMAIN_NAME`              | Active domain (`nexamesh.ai`)               |
| `SMTP_HOST`                | SMTP server host                            |
| `SMTP_PORT`                | SMTP server port                            |
| `SMTP_USERNAME`            | SMTP username                               |
| `SMTP_PASSWORD`            | SMTP password / API key                     |
| `SSL_CERTIFICATE_DATA`     | Base64-encoded PFX (empty until configured) |
| `SSL_CERTIFICATE_PASSWORD` | PFX password (empty until configured)       |

### terraform.tfvars (Terraform variable overrides)

Create `terraform/environments/production/terraform.tfvars` referencing your `.env.local` values:

```hcl
domain_name       = "nexamesh.ai"
db_admin_password = "<from .env.local DB_ADMIN_PASSWORD>"
smtp_password     = "<from .env.local SMTP_PASSWORD>"
```

> **Note:** Both `.env.local` and `*.tfvars` are in `.gitignore`.

### GitHub Repository Secrets (CI/CD)

Mirror `.env.local` values into GitHub. Navigate to: **Settings → Secrets and variables → Actions**

#### Secrets

| Secret                     | Source in `.env.local`                  |
| -------------------------- | --------------------------------------- |
| `AZURE_CREDENTIALS`        | Full JSON from `azure-credentials.json` |
| `ARM_CLIENT_ID`            | `ARM_CLIENT_ID`                         |
| `ARM_CLIENT_SECRET`        | `ARM_CLIENT_SECRET`                     |
| `ARM_TENANT_ID`            | `ARM_TENANT_ID`                         |
| `ARM_SUBSCRIPTION_ID`      | `ARM_SUBSCRIPTION_ID`                   |
| `DB_ADMIN_PASSWORD`        | `DB_ADMIN_PASSWORD`                     |
| `SMTP_USERNAME`            | `SMTP_USERNAME`                         |
| `SMTP_PASSWORD`            | `SMTP_PASSWORD`                         |
| `SSL_CERTIFICATE_DATA`     | `SSL_CERTIFICATE_DATA`                  |
| `SSL_CERTIFICATE_PASSWORD` | `SSL_CERTIFICATE_PASSWORD`              |
| `TF_STATE_RESOURCE_GROUP`  | `TF_STATE_RESOURCE_GROUP`               |
| `TF_STATE_STORAGE_ACCOUNT` | `TF_STATE_STORAGE_ACCOUNT`              |
| `TF_STATE_CONTAINER`       | `TF_STATE_CONTAINER`                    |
| `TF_STATE_KEY`             | `TF_STATE_KEY`                          |

#### Variables (non-sensitive)

| Variable      | Value         | Description                    |
| ------------- | ------------- | ------------------------------ |
| `DOMAIN_NAME` | `nexamesh.ai` | Active domain for the platform |

---

## Step 4: Deploy Infrastructure

### Initialize and Plan

```powershell
Set-Location terraform\environments\production

terraform init -backend-config="backend.hcl" -upgrade
terraform fmt -check -recursive
terraform validate

terraform plan -var-file="terraform.tfvars" -out=tfplan
```

### Review Plan

Expected resources (~42):

| Category  | Resources                                         | Count |
| --------- | ------------------------------------------------- | ----- |
| Network   | VNet, 3 subnets, 3 NSGs, 3 associations           | 10    |
| Storage   | Storage account, 4 containers, lifecycle policy   | 6     |
| Security  | Key Vault, access policies, 4 secrets             | 6     |
| Database  | PostgreSQL server, 2 databases, DNS zone, configs | 7     |
| Compute   | 2 container groups, 2 file shares, 2 KV policies  | 6     |
| Gateway   | Application Gateway, public IP                    | 2     |
| Cognitive | Document Intelligence account                     | 1     |
| DNS       | 3 A records (docs, ops, root)                     | 3     |
| Other     | Random passwords                                  | 2     |

### Apply

```powershell
terraform apply tfplan

terraform output -json | Out-File deployment-outputs.json

# Key outputs
terraform output application_gateway_public_ip
terraform output document_intelligence_endpoint
terraform output storage_blob_endpoint
```

---

## Step 5: DNS Configuration

DNS records are automatically created by the DNS Terraform module pointing to the Application Gateway IP:

| Record             | Type | Target                 |
| ------------------ | ---- | ---------------------- |
| `docs.nexamesh.ai` | A    | Application Gateway IP |
| `ops.nexamesh.ai`  | A    | Application Gateway IP |
| `nexamesh.ai`      | A    | Application Gateway IP |

### Verify DNS Propagation

```powershell
Resolve-DnsName docs.nexamesh.ai
Resolve-DnsName ops.nexamesh.ai
```

### Azure DNS Zone

The DNS zone `nexamesh.ai` is in resource group `nl-prod-nexamesh-rg-san`. Ensure the domain registrar's nameservers point to:

- `ns1-09.azure-dns.com`
- `ns2-09.azure-dns.net`
- `ns3-09.azure-dns.org`
- `ns4-09.azure-dns.info`

---

## Step 6: SSL Certificates

The Application Gateway starts in HTTP-only mode. Once DNS is propagated, generate an SSL certificate.

### Option A: Let's Encrypt (Free)

```powershell
# Using win-acme (Windows)
# Download from https://www.win-acme.com/

.\wacs.exe --target manual --host "*.nexamesh.ai,nexamesh.ai" `
  --validation dns-manual `
  --store pfxfile --pfxfilepath C:\certs\nexamesh.pfx `
  --pfxpassword "YourSecurePassword123!"

# Base64 encode for Terraform / GitHub Secrets
$pfxBytes = [System.IO.File]::ReadAllBytes("C:\certs\nexamesh.pfx")
$base64 = [Convert]::ToBase64String($pfxBytes)
$base64 | Out-File certificate-base64.txt
```

For DNS validation, add a TXT record via Azure DNS (or update `acme_challenge_value` in Terraform):

```powershell
az network dns record-set txt add-record `
  --resource-group nl-prod-nexamesh-rg-san `
  --zone-name nexamesh.ai `
  --record-set-name _acme-challenge `
  --value "<acme-challenge-value>"
```

### Option B: Azure-managed Certificate

Upload to Key Vault after generation:

```powershell
az keyvault certificate import `
  --vault-name "nl-prod-hov-kv-san" `
  --name "ssl-wildcard" `
  --file certificate.pfx `
  --password "YourSecurePassword123!"
```

### Enable SSL in Terraform

Add to `terraform.tfvars`:

```hcl
ssl_certificate_data     = "<base64-encoded-pfx>"
ssl_certificate_password = "YourSecurePassword123!"
```

Then re-plan and apply. The gateway module automatically adds HTTPS listeners and HTTP→HTTPS redirects when SSL data is provided.

---

## Step 7: Azure Services Integration

### 7.1 Document Intelligence (OCR)

Provisioned automatically by the `cognitive` Terraform module as `nl-prod-hov-di-san`.

**Retrieve credentials:**

```powershell
terraform output document_intelligence_endpoint
terraform output -raw document_intelligence_key
```

**App configuration keys:**

| Key                 | Source                                            |
| ------------------- | ------------------------------------------------- |
| `AZURE_DI_ENDPOINT` | `terraform output document_intelligence_endpoint` |
| `AZURE_DI_KEY`      | `terraform output -raw document_intelligence_key` |

**Usage (Python example):**

```python
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

client = DocumentAnalysisClient(
    endpoint=os.environ["AZURE_DI_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["AZURE_DI_KEY"])
)

poller = client.begin_analyze_document("prebuilt-document", document=file_stream)
result = poller.result()
```

### 7.2 Blob Storage (Asset Photo Uploads)

The `asset-uploads` container is provisioned automatically alongside `documents` and `backups`.

**Retrieve credentials:**

```powershell
terraform output storage_account_name
terraform output storage_blob_endpoint
terraform output -raw storage_connection_string
```

**App configuration keys:**

| Key                               | Source                                            |
| --------------------------------- | ------------------------------------------------- |
| `AZURE_STORAGE_ACCOUNT`           | `nlprodhovstsan`                                  |
| `AZURE_STORAGE_CONNECTION_STRING` | `terraform output -raw storage_connection_string` |
| `AZURE_STORAGE_CONTAINER_ASSETS`  | `asset-uploads`                                   |
| `AZURE_STORAGE_CONTAINER_DOCS`    | `documents`                                       |

**Usage (Python example):**

```python
from azure.storage.blob import BlobServiceClient

blob_service = BlobServiceClient.from_connection_string(
    os.environ["AZURE_STORAGE_CONNECTION_STRING"]
)
container = blob_service.get_container_client("asset-uploads")
container.upload_blob(name=filename, data=file_data, overwrite=True)
```

### 7.3 Storage Containers Summary

| Container       | Purpose                        | Lifecycle                    |
| --------------- | ------------------------------ | ---------------------------- |
| `documents`     | Signed documents from DocuSeal | Cool at 90d, Archive at 365d |
| `backups`       | Database and config backups    | Cool at 7d, Delete at 30d    |
| `asset-uploads` | Asset registry photos          | No auto-tiering              |
| `tfstate`       | Terraform state files          | Versioned                    |

### 7.4 Cosmos DB (Mongo API)

Provisioned automatically by the `cosmosdb-mongo` Terraform module as `nl-prod-hov-cosmos-san`.

**Retrieve credentials:**

```powershell
terraform output cosmos_mongo_database_name
terraform output -raw cosmos_mongo_connection_string
```

**App configuration keys:**

| Key                       | Source                                                 |
| ------------------------- | ------------------------------------------------------ |
| `COSMOS_MONGO_CONNECTION` | `terraform output -raw cosmos_mongo_connection_string` |
| `COSMOS_MONGO_DATABASE`   | `terraform output cosmos_mongo_database_name`          |
| `COSMOS_MONGO_COLLECTION` | `kiosk_requests` (default)                             |

**Usage examples:**

Python (pymongo):

```python
from pymongo import MongoClient
import os

client = MongoClient(os.environ["COSMOS_MONGO_CONNECTION"])
db = client[os.environ["COSMOS_MONGO_DATABASE"]]
collection = db["kiosk_requests"]

# Insert a kiosk request
doc = {
    "type": "stock_order",
    "employeeId": "lucky",
    "employeeName": "Lucky",
    "data": {"itemName": "Garden tools", "quantity": 5},
    "timestamp": "2025-01-15T10:30:00Z",
    "status": "pending"
}
collection.insert_one(doc)

# Query pending requests
pending = collection.find({"status": "pending"})
```

Node.js (mongodb driver):

```typescript
import { MongoClient } from "mongodb"

const client = new MongoClient(process.env.COSMOS_MONGO_CONNECTION!)
await client.connect()
const db = client.db(process.env.COSMOS_MONGO_DATABASE)
const collection = db.collection("kiosk_requests")

// Insert a kiosk request
await collection.insertOne({
  type: "stock_order",
  employeeId: "lucky",
  employeeName: "Lucky",
  data: { itemName: "Garden tools", quantity: 5 },
  timestamp: new Date().toISOString(),
  status: "pending",
})

// Query pending requests
const pending = await collection.find({ status: "pending" }).toArray()
```

**Collection: `kiosk_requests`**

| Field          | Type   | Description                                     |
| -------------- | ------ | ----------------------------------------------- |
| `type`         | string | `stock_order`, `salary_advance`, `issue_report` |
| `employeeId`   | string | Employee identifier                             |
| `employeeName` | string | Display name                                    |
| `data`         | object | Request-specific payload                        |
| `timestamp`    | string | ISO 8601 timestamp                              |
| `status`       | string | `pending`, `approved`, `rejected`, `completed`  |

**Configuring apps to use Cosmos Mongo API:**

1. Set environment variables from Terraform outputs
2. Install `pymongo` (Python) or use MongoDB drivers for your language
3. Connect using the connection string (includes auth credentials)
4. Use the database name `house_of_veritas` (or your configured value)

---

## Step 8: CI/CD Pipeline

### Workflows

| Workflow                   | Trigger                             | Purpose                                            |
| -------------------------- | ----------------------------------- | -------------------------------------------------- |
| `terraform-plan.yml`       | PR to `main`                        | Validates Terraform, comments plan on PR           |
| `terraform-apply.yml`      | Push to `main` (terraform/ changes) | Applies infrastructure changes                     |
| `deploy.yml`               | Manual / Release tag                | Full deployment (build, infra, containers, verify) |
| `deploy-functions.yml`     | Manual                              | Deploys Azure Functions                            |
| `terraform-destroy.yml`    | Manual (requires "DESTROY" input)   | Tears down infrastructure                          |
| `deployment-checklist.yml` | PR / Push / Schedule                | Validates infrastructure health                    |

### Pipeline Flow

```text
PR Created → terraform-plan (validate + plan + PR comment)
     ↓
Merge to main → terraform-apply (plan + apply + tag)
     ↓
Release tag → deploy.yml (full pipeline):
  1. Pre-deployment validation
  2. Build Next.js app
  3. Deploy infrastructure (Terraform)
  4. Deploy DocuSeal container
  5. Deploy Baserow container
  6. Seed data (optional)
  7. Post-deployment verification
  8. Deployment summary
```

### Deploy Manually

Trigger via GitHub Actions UI or CLI:

```powershell
gh workflow run deploy.yml `
  -f environment=production `
  -f deploy_infrastructure=true `
  -f seed_data=false
```

---

## Step 9: Application Setup

### 9.1 DocuSeal (docs.nexamesh.ai)

1. Navigate to `https://docs.nexamesh.ai` (or `http://` before SSL)
2. Create admin account (first user becomes admin)
3. Configure email settings in Settings → Email
4. Upload document templates via Templates → New Template

**API access:**

```powershell
$DOCUSEAL_API_KEY = "your-api-key"
$DOCUSEAL_URL = "https://docs.nexamesh.ai"

$headers = @{
  "X-Auth-Token" = $DOCUSEAL_API_KEY
  "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "$DOCUSEAL_URL/api/templates" `
  -Method Get -Headers $headers
```

### 9.2 Baserow (ops.nexamesh.ai)

1. Navigate to `https://ops.nexamesh.ai` (or `http://` before SSL)
2. Create admin account
3. Create workspace: "House of Veritas Operations"
4. Import or create tables for:
   - Employee Registry
   - Asset Registry
   - Task Management
   - Incident Management
   - Vehicle Logs
   - Financial Tracking

### 9.3 Webhooks

Register DocuSeal webhook for automated processing:

```powershell
$body = @{
  url = "https://nl-prod-hov-func-san.azurewebsites.net/api/docuseal-webhook"
  events = @("submission.completed", "submission.expired")
} | ConvertTo-Json

Invoke-RestMethod -Uri "$DOCUSEAL_URL/api/webhooks" `
  -Method Post -Headers $headers -Body $body
```

---

## Step 10: User Onboarding

### User Accounts

| User  | Email               | Role              | Access                    |
| ----- | ------------------- | ----------------- | ------------------------- |
| Hans  | <hans@nexamesh.ai>  | Administrator     | Full access               |
| Charl | <charl@nexamesh.ai> | Workshop Operator | Tasks, Assets, Time       |
| Lucky | <lucky@nexamesh.ai> | Gardener          | Tasks, Expenses, Vehicles |
| Irma  | <irma@nexamesh.ai>  | Household         | Tasks, Documents          |

### Go-Live Checklist

```powershell
# Verify containers are running
az container show --resource-group nl-prod-hov-rg-san --name prod-docuseal --query instanceView.state
az container show --resource-group nl-prod-hov-rg-san --name prod-baserow --query instanceView.state

# Check Application Gateway health
az network application-gateway show-backend-health `
  --resource-group nl-prod-hov-rg-san `
  --name prod-appgw

# Verify DNS resolution
Resolve-DnsName docs.nexamesh.ai
Resolve-DnsName ops.nexamesh.ai

# Check database
az postgres flexible-server show `
  --resource-group nl-prod-hov-rg-san `
  --name nl-prod-hov-pg-san `
  --query state

# Test Document Intelligence
az cognitiveservices account show `
  --resource-group nl-prod-hov-rg-san `
  --name nl-prod-hov-di-san `
  --query provisioningState
```

---

## All Secrets & Configuration Reference

### Terraform Variables

| Variable                       | Default                   | Source                       |
| ------------------------------ | ------------------------- | ---------------------------- |
| `domain_name`                  | `nexamesh.ai`             | tfvars                       |
| `db_admin_password`            | —                         | tfvars (sensitive)           |
| `smtp_password`                | —                         | tfvars (sensitive)           |
| `ssl_certificate_data`         | `""`                      | tfvars (sensitive, optional) |
| `ssl_certificate_password`     | `""`                      | tfvars (sensitive, optional) |
| `dns_zone_name`                | `nexamesh.ai`             | default                      |
| `dns_zone_resource_group`      | `nl-prod-nexamesh-rg-san` | default                      |
| `document_intelligence_name`   | `nl-prod-hov-di-san`      | default                      |
| `storage_account_name`         | `nlprodhovstsan`          | default                      |
| `key_vault_name`               | `nl-prod-hov-kv-san`      | default                      |
| `db_server_name`               | `nl-prod-hov-pg-san`      | default                      |
| `cosmos_account_name`          | `nlprodhovcosmosan`       | default                      |
| `cosmos_mongo_database_name`   | `house_of_veritas`        | default                      |
| `cosmos_mongo_collection_name` | `kiosk_requests`          | default                      |
| `resource_group_name`          | `nl-prod-hov-rg-san`      | default                      |

### Terraform Outputs (post-deploy)

| Output                           | Purpose                                    |
| -------------------------------- | ------------------------------------------ |
| `application_gateway_public_ip`  | Public entry point IP                      |
| `document_intelligence_endpoint` | OCR API endpoint                           |
| `document_intelligence_key`      | OCR API key (sensitive)                    |
| `storage_connection_string`      | Blob storage connection (sensitive)        |
| `storage_blob_endpoint`          | Blob endpoint URL                          |
| `asset_uploads_container`        | Container name for photos                  |
| `key_vault_uri`                  | Key Vault URI                              |
| `database_server_fqdn`           | PostgreSQL FQDN                            |
| `cosmos_mongo_connection_string` | Cosmos Mongo connection string (sensitive) |
| `cosmos_mongo_database_name`     | Cosmos Mongo database name                 |
| `docuseal_url`                   | `https://docs.nexamesh.ai`                 |
| `baserow_url`                    | `https://ops.nexamesh.ai`                  |

---

## Troubleshooting

### Container Issues

```powershell
# View logs
az container logs --resource-group nl-prod-hov-rg-san --name prod-docuseal --tail 100
az container logs --resource-group nl-prod-hov-rg-san --name prod-baserow --tail 100

# Restart
az container restart --resource-group nl-prod-hov-rg-san --name prod-docuseal
az container restart --resource-group nl-prod-hov-rg-san --name prod-baserow
```

### Terraform State Lock

```powershell
az storage blob lease break `
  --account-name hovsharedtfstatesa `
  --container-name tfstate `
  --blob-name production.terraform.tfstate
```

### DNS Not Resolving

```powershell
# Verify Azure DNS records
az network dns record-set a list `
  --resource-group nl-prod-nexamesh-rg-san `
  --zone-name nexamesh.ai `
  --output table

# Check nameserver delegation
Resolve-DnsName -Name nexamesh.ai -Type NS
```

---

## Security & Compliance

- All subnets private except gateway; NSG deny-by-default
- Managed identities for container KV access
- Key Vault with network ACLs (container subnet only)
- TLS 1.2+ enforced on Application Gateway, storage, and database
- WAF (OWASP 3.2) on Application Gateway
- Blob versioning and soft-delete enabled
- POPIA, BCEA, ECT Act compliant
- Full audit trails on all document operations

---

**Last Updated:** February 2026
**Terraform Version:** 1.14.5 (pre-installed on self-hosted runner via HashiCorp APT repo)
**Azure Provider Version:** ~> 3.80
