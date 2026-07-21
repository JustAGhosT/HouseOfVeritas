# Handoff - Project datastore and AI suggestion hardening

- **Date:** 2026-07-22
- **Repo:** `C:\Users\smitj\repos\house-of-veritas`
- **Current branch:** `main`
- **Status:** PRs merged, CI green, production deployed, local tree clean.
- **Area:** Project datastore APIs, AI project suggestions, upload path validation, production verification

## Current State

`main` is at:

- `308f832` - PR #103 `fix(ai): use real project suggestions`
- `b87ee08` - PR #102 `fix(projects): harden datastore API writes`
- `14d8942` - PR #101 `fix(test): force file fallback for job workspace routes`

The production app is deployed and healthy at `https://hov.neuralliquid.ai`.

## What Changed

### PR #102 - Project Datastore Hardening

- Strips Mongo `_id` fields from project, suggestion, and job workspace API responses.
- Prevents client-supplied Mongo/internal fields from poisoning project and suggestion replacement writes.
- Resolves Mongo connection URL and DB name at connection time instead of module-load time.
- Uses UUID-backed IDs for project, suggestion, area, and allocation creates.
- Rejects invalid project `type` values instead of silently coercing them.
- Replaces suggestion create/review flows with targeted repository writes instead of rewriting the full collection for normal operations.
- Normalizes local file upload category segments and rejects unsafe local delete path segments.
- Adds regression tests for API validation and Mongo helper sanitization.

### PR #103 - AI Project Suggestion Cleanup

- Removes hardcoded AI project suggestion defaults such as `House Revamp`, `Zeerust Arming`, `Garage`, `Garden Revamp`, and `Kitchen Cupboards`.
- `suggest-project` and `suggest-project-from-photo` now load options from the project repository, which uses the configured production datastore.
- When no projects exist, `suggest-project` returns an explicit empty state with `suggested: null`.
- When real project options exist but AI is unavailable, `suggest-project` falls back to the first real option, matching the existing AI integration ADR.
- Adds route tests for empty state, repository-backed options, deterministic fallback, and photo suggestions.

## Validation Evidence

Local validation run during the closeout:

- `pnpm exec vitest run tests/api/job-workspace.test.ts tests/lib/projects.test.ts tests/lib/mongodb.test.ts` - passed
- `pnpm exec vitest run tests/api/ai-project-suggestions.test.ts tests/api/job-workspace.test.ts tests/lib/mongodb.test.ts` - passed
- `pnpm exec vitest run tests/api/ai-project-suggestions.test.ts` - passed after bot-review fix
- `pnpm exec tsc --noEmit` - passed
- `pnpm run lint` - passed
- `pnpm run build` - passed

GitHub Actions:

- PR #102 checks passed: Build & Test, E2E Tests, Infrastructure Verification, Pipeline Summary, Validate Configuration.
- PR #103 checks passed: Build & Test, E2E Tests, Infrastructure Verification, Pipeline Summary, Validate Configuration.
- Post-merge `Deploy on Merge` passed for PR #102 and PR #103.
- Post-merge `Deployment Checklist` passed for PR #102 and PR #103.

Production check after PR #103 deploy:

- `Invoke-RestMethod -Uri https://hov.neuralliquid.ai/api/health`
- Result: `status=healthy`, `dataMode=empty`

## Bot Review

PR #103 received one non-blocking Codex review comment:

- Concern: `suggest-project` should still fall back to the first option when AI is unavailable.
- Resolution: restored deterministic fallback to `options[0]`, but only after options are loaded from the real project repository. Added a regression test.

## Known Warnings

- `pnpm run build` exits 0 but still reports the existing Turbopack NFT warning:
  - Import trace: `next.config.mjs` -> `app/api/files/route.ts`
  - Message: "Encountered unexpected file in NFT list"
- GitHub Actions emits Node 20 deprecation annotations for several actions being forced to Node 24.
- GitHub push output reports existing Dependabot/security alerts on the default branch: 41 vulnerabilities, including 12 high. This was not addressed in these PRs.

## Residual Risks And Next Actions

1. Exercise the admin project create/edit flow in a browser with a signed-in production admin and confirm records persist across refresh.
2. Check project/job dropdowns in production after real records exist; they should show datastore-backed names only.
3. Continue dummy-data cleanup outside the project suggestion path:
   - `app/dashboard/charl/page.tsx` still contains visible static project names such as `Electrical Work` and `Plumbing`.
   - `lib/services/baserow.ts` still has mock fixture project names gated by demo behavior.
   - `app/api/ocr/route.ts` still returns mock OCR output and reports `mode: "demo"` when Azure Document Intelligence is not configured.
4. Decide whether to treat the Turbopack NFT warning as a separate CI hygiene task. It is not currently failing build/deploy.
5. Address GitHub Actions Node 20 deprecation annotations by updating action/runtime usage if repository policy requires warning-free CI.
6. Triage Dependabot/security alerts separately; do not fold dependency remediation into feature/data cleanup PRs.

## Trace Envelope

- **Baton project:** `house-of-veritas` (`da62c803-1a03-45a4-9ce1-b6e86dd8d23d`)
- **Baton task:** No matching in-progress task found for this closeout.
- **Risk tier:** API/data/storage production path.
- **Files changed by PR #102:** project API routes, project repositories, Mongo helper, job workspace repository, file upload route, focused tests.
- **Files changed by PR #103:** AI project suggestion routes, `tests/api/ai-project-suggestions.test.ts`.
- **Gates passed:** focused Vitest, TypeScript, lint, build, PR CI, post-merge deploy, production health.
- **Manual/browser checks:** Not performed in this closeout.
