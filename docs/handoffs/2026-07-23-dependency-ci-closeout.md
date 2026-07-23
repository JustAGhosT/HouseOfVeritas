# Handoff - Dependency security and CI closeout

- **Date:** 2026-07-23
- **Repo:** `C:\Users\smitj\repos\house-of-veritas`
- **Current branch:** `main`
- **Status:** PRs merged, CI green, production deployed, local tree clean.
- **Area:** Dependency security alerts, Renovate/Dependabot follow-up, Turbopack build warning, CI parallelization

## Current State

`main` is at:

- `9f0478b` - PR #114 `Clean build warning and parallelize CI`
- `08c46d7` - PR #113 `build(deps): bump the npm_and_yarn group across 1 directory with 2 updates`
- `6292ff3` - PR #112 `Resolve dependency security alerts`
- `0dff1c8` - PR #111 `Pin App Service runtime to Node 22`

Production is deployed and healthy at `https://nl-prod-hov-app.azurewebsites.net/api/health`.

## What Changed

### PR #112 - Dependency Security Alert Sweep

- Added `pnpm.overrides` for vulnerable transitive packages across telemetry, PDF generation, Twilio, Next/sharp, ESLint, and Vitest/Vite dependency chains.
- Bumped `vitest` and `@vitest/coverage-v8` to `4.1.10`.
- Regenerated `pnpm-lock.yaml`.
- Reduced open Dependabot alerts from 50 to 11.

### PR #113 - Auth.js Security Follow-Up

- Merged Dependabot's follow-up patch for the remaining Auth.js cluster.
- Bumped `next-auth` from `5.0.0-beta.31` to `5.0.0-beta.32`.
- Bumped transitive `@auth/core` from `0.41.2` to `0.41.3`.
- Open Dependabot alerts are now `0`.

### PR #114 - Build Warning And CI Parallelization

- Removed the Turbopack NFT warning by replacing dynamic local upload path construction in `/api/files` and `/api/files/serve` with fixed-root sanitized paths.
- Sanitized generated local upload filename stems.
- Rejected slash and backslash traversal in local file delete and serve paths.
- Split `Deployment Checklist` app gates into parallel jobs: `Lint`, `Unit Tests`, `Production Build`, `E2E Tests`, `Validate Configuration`, and `Infrastructure Verification`.
- Split `Deploy on Merge` into parallel `Quality Checks` and `Build Application` lanes before Azure deployment.
- Updated dependency-bot PR summaries so intentionally skipped infra checks display as skipped instead of failed.

## Validation Evidence

Local validation:

- `pnpm exec prettier --check .github/workflows/deployment-checklist.yml .github/workflows/deploy-on-merge.yml app/api/files/route.ts app/api/files/serve/route.ts` - passed
- `pnpm run lint` - passed
- `pnpm test` - passed, 43 files and 299 tests
- `pnpm run build` - passed with no Turbopack NFT warning
- `pnpm audit --audit-level low` - passed during the dependency-security sweep

GitHub Actions:

- PR #112 checks passed: Build & Test, E2E Tests, Infrastructure Verification, Pipeline Summary, Validate Configuration.
- PR #113 checks passed before merge; post-merge Deployment Checklist was rerun and passed after an infra-job cancellation.
- PR #114 checks passed with the new parallel job layout.
- Post-merge `Deploy on Merge` passed for PR #112, PR #113, and PR #114.
- Post-merge `Deployment Checklist` passed for PR #112, PR #113, and PR #114.

Production checks:

- `curl.exe -fsS https://nl-prod-hov-app.azurewebsites.net/api/health`
- Result: `status=healthy`, `dataMode=empty`, Baserow and DocuSeal unconfigured.
- App Service runtime remained `NODE|22-lts` with `WEBSITE_NODE_DEFAULT_VERSION=~22`.

GitHub/security checks:

- Open Dependabot alerts: `0`.
- Open PR queue: `0`.

## Known Warnings

None from this slice.

The prior Turbopack warning from `next.config.mjs` -> `app/api/files/route.ts` is resolved.

## Residual Risks And Next Actions

1. Watch the next scheduled Renovate run and confirm dependency-bot PR summaries show skipped infra checks correctly.
2. Keep Node pinned to 22 until Azure App Service offers a proven Node 24 runtime stack for this app.
