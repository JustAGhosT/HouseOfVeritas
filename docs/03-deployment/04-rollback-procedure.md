# House of Veritas — Rollback Procedure

This document describes how to roll back deployments when a release introduces critical issues.

---

## Overview

| Component                  | Rollback Method               | RTO (approx.) |
| -------------------------- | ----------------------------- | ------------- |
| Next.js Web App            | Redeploy previous release tag | 5–10 min      |
| Azure Functions            | Redeploy from previous commit | 5–10 min      |
| Terraform (Infrastructure) | Restore state + apply         | 15–30 min     |
| DocuSeal / Baserow         | Restart or redeploy container | 5–15 min      |
| PostgreSQL                 | Point-in-time restore         | 30–60 min     |

---

## Prerequisites

- Azure CLI >= 2.50.0
- GitHub CLI (`gh`)
- Access to Azure subscription and GitHub repo
- `AZURE_CREDENTIALS` or `az login` session

---

## 1. Roll Back Next.js Web App

The Web App is deployed from the `deploy.yml` workflow. To roll back:

### Option A: Redeploy a Previous Release

```powershell
# List recent releases
gh release list --limit 10

# Re-run deploy workflow with a previous release tag
gh workflow run deploy.yml -f environment=production -r v1.2.3
```

Replace `v1.2.3` with the last known-good release tag.

### Option B: Redeploy from a Specific Commit

```powershell
# Checkout previous commit
git checkout <previous-commit-sha>

# Trigger deploy (manual run uses current branch/ref)
gh workflow run deploy.yml -f environment=production
```

### Option C: Azure Portal — Deployment Slots (if configured)

If staging slots are configured:

1. Azure Portal → App Service → Deployment slots
2. Swap staging (previous version) back to production

---

## 2. Roll Back Azure Functions

Functions deploy from `deploy-functions.yml` when `config/azure-functions/**` changes.

```powershell
# Identify last good commit before Functions change
git log --oneline config/azure-functions/

# Checkout that commit
git checkout <commit-sha>

# Re-run Functions deploy
gh workflow run deploy-functions.yml
```

Or manually deploy from a branch/tag:

```powershell
gh workflow run deploy-functions.yml -r main
```

---

## 3. Roll Back Terraform (Infrastructure)

**Warning:** Terraform rollback can be destructive. Only proceed if infrastructure changes caused the incident.

### State Versioning

Terraform state is stored in Azure Blob Storage with versioning enabled (`terraform/environments/production/backend.hcl`). You can restore a previous state version.

### Restore Previous State

```powershell
$RESOURCE_GROUP = "hov-shared-tfstate-rg"
$STORAGE_ACCOUNT = "hovsharedtfstatesa"
$CONTAINER = "tfstate"
$BLOB = "production.terraform.tfstate"

# List state versions
az storage blob list `
  --account-name $STORAGE_ACCOUNT `
  --container-name $CONTAINER `
  --prefix $BLOB `
  --include v

# Copy previous version to current (replace VERSION_ID with actual)
az storage blob copy start `
  --account-name $STORAGE_ACCOUNT `
  --destination-container $CONTAINER `
  --destination-blob $BLOB `
  --source-uri "https://$STORAGE_ACCOUNT.blob.core.windows.net/$CONTAINER/$BLOB?versionid=VERSION_ID"
```

Then re-run Terraform apply from the commit that matches the restored state:

```powershell
cd terraform/environments/production
terraform init  # uses existing backend config
terraform plan  # verify planned changes
terraform apply # apply rollback
```

### Alternative: Revert Terraform Code

```powershell
git revert <bad-commit-sha>
git push origin main
```

The `terraform-apply.yml` workflow runs on push to `main` when `terraform/**` changes. A revert will trigger a new apply.

---

## 4. Roll Back DocuSeal / Baserow Containers

Containers run as Azure Container Instances. They use images defined in Terraform.

### Restart (No Image Change)

```powershell
az container restart --resource-group nl-prod-hov-rg-san --name aci-docuseal
az container restart --resource-group nl-prod-hov-rg-san --name aci-baserow
```

### Redeploy with Previous Image

If a container image update caused issues, revert the Terraform module that sets the image tag, then apply (see Section 3).

---

## 5. Roll Back PostgreSQL (Database)

Use only if data corruption or a bad migration occurred.

### Point-in-Time Restore (Azure Database for PostgreSQL)

```powershell
# Create restore point (restores to new server)
az postgres flexible-server restore `
  --resource-group nl-prod-hov-rg-san `
  --name nl-prod-hov-pg-san-restored `
  --source-server nl-prod-hov-pg-san `
  --restore-time "2026-02-21T10:00:00Z"

# Update application connection string to new server
# Then deallocate old server after verification
```

### Migration Rollback

If using migration tools (e.g. Flyway, Liquibase), run the corresponding down migration from the project's migration scripts.

---

## 6. Verification After Rollback

```powershell
# Web App
curl -s -o /dev/null -w "%{http_code}" https://<webapp>.azurewebsites.net

# DocuSeal
curl -s -o /dev/null -w "%{http_code}" https://docs.nexamesh.ai/health

# Baserow
curl -s -o /dev/null -w "%{http_code}" https://ops.nexamesh.ai

# Containers
az container show --resource-group nl-prod-hov-rg-san --name aci-docuseal --query instanceView.state -o tsv
az container show --resource-group nl-prod-hov-rg-san --name aci-baserow --query instanceView.state -o tsv
```

---

## 7. Post-Rollback

1. **Document** the incident and rollback in your incident log.
2. **Create a post-mortem** if the issue was significant.
3. **Update** `docs/05-project/04-changelog.md` with a rollback entry.
4. **Fix forward** — address the root cause before redeploying.

---

## Quick Reference

| Scenario            | Command                                                       |
| ------------------- | ------------------------------------------------------------- |
| Roll back Web App   | `gh workflow run deploy.yml -r <last-good-tag>`               |
| Roll back Functions | `gh workflow run deploy-functions.yml` (from reverted branch) |
| Roll back Terraform | Restore state blob version, then `terraform apply`            |
| Restart containers  | `az container restart -g nl-prod-hov-rg-san -n aci-docuseal`  |
| DB restore          | `az postgres flexible-server restore ...`                     |

---

**Last Updated:** February 2026
