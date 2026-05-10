# MVP Launch Checklist

This is the operational checklist for taking House of Veritas live for the first time. Run through it once before pressing the green button.

Naming convention reminder: all Azure resources follow `nl-prod-hov-{type}-san` (`{project_prefix}-{environment}-{project_name}-{resource_type}-{location_short}`). Defaults are in `terraform/environments/production/variables.tf`.

## 1. GitHub repo settings

- [ ] Branch protection on `main`: required reviews, required checks (`Build & Test`, `E2E Tests`, `Deployment Checklist`).
- [ ] Environments → `production`: required reviewers configured.
- [ ] Repo secrets set (see § 4). Repo variables set (see § 5).

## 2. Local dev sanity

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm test:e2e   # optional, slower
```

All four should succeed cleanly. Fix anything red before promoting to CI.

## 3. Azure prerequisites

- [ ] Subscription chosen, owner has Contributor + User Access Administrator.
- [ ] Service principal created (`az ad sp create-for-rbac --sdk-auth`) — JSON output goes into `AZURE_CREDENTIALS` secret.
- [ ] Resource group `nl-prod-hov-rg-san` exists in `southafricanorth`.
- [ ] Terraform state backend created: resource group `hov-shared-tfstate-rg`, storage account `hovsharedtfstatesa`, container `tfstate` (one-time via `config/scripts/bootstrap-azure.sh`).
- [ ] Custom domain in DNS: `nexamesh.ai` (or `houseofv.com`) with the App Gateway public IP.

## 4. GitHub Actions secrets

| Secret | Purpose |
| --- | --- |
| `AZURE_CREDENTIALS` | SP JSON for `azure/login@v2` |
| `TF_STATE_RESOURCE_GROUP` | `hov-shared-tfstate-rg` |
| `TF_STATE_STORAGE_ACCOUNT` | `hovsharedtfstatesa` |
| `TF_STATE_CONTAINER` | `tfstate` |
| `TF_STATE_KEY` | `production.terraform.tfstate` |
| `DB_ADMIN_PASSWORD` | PostgreSQL admin password |
| `ACS_CONNECTION_STRING` | Azure Communication Services Email connection string (Functions + Next.js) |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | DocuSeal SMTP relay — point at ACS at `smtp.azurecomm.net:587` |
| `SSL_CERTIFICATE_DATA` | base64-encoded PFX |
| `SSL_CERTIFICATE_PASSWORD` | PFX password |
| `DOCUSEAL_URL` / `BASEROW_URL` | post-deploy health checks |
| `BASEROW_TOKEN` | for seed scripts |

## 5. GitHub Actions vars

| Var | Default if unset |
| --- | --- |
| `WEBAPP_NAME` | `nl-prod-hov-app-san` |
| `DOMAIN_NAME` | `nexamesh.ai` |

## 6. App Service / Function App settings

These are the runtime env vars the Next.js app reads. Set in Azure App Service → Configuration (or via Key Vault references).

| Group | Vars |
| --- | --- |
| Auth | `JWT_SECRET`, `INVITE_JWT_SECRET` |
| Baserow | `BASEROW_API_URL`, `BASEROW_API_TOKEN`, `BASEROW_DATABASE_ID`, all `BASEROW_TABLE_*` IDs |
| DocuSeal | `DOCUSEAL_API_URL`, `DOCUSEAL_API_TOKEN`, `DOCUSEAL_WEBHOOK_SECRET` |
| Email | `ACS_CONNECTION_STRING` (Azure Communication Services), `EMAIL_FROM` |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| Storage | `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_ACCOUNT_KEY`, `AZURE_STORAGE_CONTAINER_DOCUMENTS`, `AZURE_STORAGE_CONTAINER_UPLOADS` |
| OCR | `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_DOCUMENT_INTELLIGENCE_KEY` |
| Mongo | `MONGODB_URI` (kiosk + audit-log fallback) |
| Postgres | `POSTGRES_URL` (audit-log primary) |
| Redis | `REDIS_URL` (optional — rate-limit persistence) |

Critical secrets must come from Key Vault references, not literal app settings.

## 7. First-run deployment

1. **Plan**: trigger `terraform-plan.yml` from a draft PR. Review the diff comment.
2. **Apply infra**: trigger `Full Deployment Pipeline` (`workflow_dispatch`) with `deploy_infrastructure=true`, `seed_data=false`, environment `production`. Self-hosted runner picks up the terraform job.
3. **Verify infra outputs**: check `Output Infrastructure Details` step in the Actions summary.
4. **Seed data**: re-run with `deploy_infrastructure=false`, `seed_data=true` once Baserow is reachable.
5. **Smoke**: hit `https://${WEBAPP_NAME}.azurewebsites.net/api/health` — expect `{ status: "healthy" }`.
6. **Login**: log in as Hans, Charl, Lucky, Irma — each should land on their persona dashboard.
7. **Daily todo**: open `/dashboard/${persona}/tasks`, confirm the **Today** filter is the default and that counts render. Create one task and tick it off.

## 8. Rollback

See `docs/03-deployment/04-rollback-procedure.md`. Short version: redeploy the previous build artifact via `workflow_dispatch` with `deploy_infrastructure=false`.

## 9. Post-launch (first 48 hours)

- [ ] Watch Log Analytics workspace `nl-prod-hov-law-san` for 5xx spikes.
- [ ] Check `deployment-checklist.yml` daily 06:00 UTC scheduled run for infrastructure drift issues.
- [ ] Confirm audit log table is filling (`SELECT COUNT(*) FROM audit_logs WHERE timestamp > NOW() - INTERVAL '1 day';`).
- [ ] Verify scheduled Azure Functions are firing: RecurringTasks, DocumentExpiryAlert, OvertimeCalculator, BudgetReport.
