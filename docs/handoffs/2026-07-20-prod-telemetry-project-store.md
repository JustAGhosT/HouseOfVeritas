# Handoff - Production telemetry and project datastore remediation

- **Date:** 2026-07-20
- **Branch:** `codex/blob-backed-project-store`
- **PR:** #98 - `fix(prod): wire telemetry and project datastore`
- **Status:** Ready to merge after CI; deployment still requires controlled Terraform apply and web app deploy after merge.
- **Area:** Next.js API routes, project persistence, Azure App Service telemetry, Terraform production config

## Problem

Live production checks after the OIDC cutover showed three gaps:

1. `nl-prod-hov-app` had no web App Insights resource or `APPLICATIONINSIGHTS_CONNECTION_STRING` app setting.
2. Project creation used `data/projects.json` under the deployed app package. That is not a real production datastore and can fail or lose data in Azure App Service.
3. The app reported `dataMode: empty`, but hardcoded project/job sample defaults still existed in source.

## What PR #98 Changes

- Adds `@azure/monitor-opentelemetry` and initializes Azure Monitor from `instrumentation.ts` when `APPLICATIONINSIGHTS_CONNECTION_STRING` is present.
- Adds `azurerm_application_insights.webapp` in `terraform/modules/webapp/main.tf`.
- Wires `APPLICATIONINSIGHTS_CONNECTION_STRING`, `APPINSIGHTS_INSTRUMENTATIONKEY`, and `APPLICATIONINSIGHTS_ROLE_NAME` into the web app settings.
- Adds repository-backed persistence for core projects, project suggestions, and job workspace metadata (areas, allocations, task grouping).
- Changes project routes to use repositories instead of directly reading/writing `data/projects.json`, `project-suggestions.json`, and job workspace JSON files.
- Changes `lib/projects.ts` member project lookup to use the repository path.
- Adds `isMongoConfigured()` in `lib/db/mongodb.ts`.
- Enables the existing Cosmos Mongo module in `terraform/environments/production/canonical.tfvars.example` so production gets `MONGODB_URI` after apply.
- Removes unused hardcoded defaults `House Revamp`, `Zeerust Arming`, and related default subprojects from `lib/projects.ts`.

## Validation Before PR

- `pnpm exec tsc --noEmit` - passed
- `pnpm run lint` - passed
- `pnpm exec vitest run tests/api/tasks.test.ts tests/api/job-workspace.test.ts` - passed, 10 tests
- `pnpm run build` - passed; pre-existing Turbopack NFT warning from `app/api/files/route.ts`
- `terraform fmt -recursive` - passed
- `terraform -chdir=terraform/environments/production validate` - passed
- PR #98 CI initially green with no actionable inline bot comments before this handoff commit

## Deployment Needed After Merge

Run both steps after PR #98 is merged:

1. Controlled infrastructure apply:
   - Workflow: `terraform-apply.yml`
   - Ref: `main`
   - Input: `confirm=APPLY`
   - Expected effect: create Cosmos Mongo resources, create web App Insights, set `MONGODB_URI`, `DB_NAME`, and App Insights settings on `nl-prod-hov-app`.
2. Web app deployment:
   - If merge touches app/lib/package/instrumentation paths, `deploy-on-merge.yml` should run automatically.
   - If it does not run or fails, manually dispatch the full deploy or rerun the deploy-on-merge workflow so the repository and telemetry code are live.

## Post-Deploy Checks

- `az webapp config appsettings list` should show non-empty `MONGODB_URI`, `DB_NAME`, and `APPLICATIONINSIGHTS_CONNECTION_STRING` for `nl-prod-hov-app`.
- `az resource list --resource-group nl-prod-hov-rg --query "[?type=='microsoft.insights/components']"` should show the HOV web App Insights component.
- `https://hov.neuralliquid.ai/api/health` should remain `healthy` and `dataMode: empty` unless explicit demo flags are set.
- Create a project through the UI while signed in as admin and confirm it persists after refresh/restart.
- Confirm visible project/job dropdowns no longer show the old hardcoded project defaults unless real records exist.

## Residual Risk

Project, project suggestion, and job workspace metadata routes now go through repositories with Mongo required in real production. Local file fallback remains only for local/test/CI when `MONGODB_URI` is absent.
