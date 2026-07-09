# Agent Backlog

Prioritized go-live work from the latest harness and clean-defaults pass.

Last updated: 2026-07-09

## P0 Go-Live Blockers

| #   | Action                                                     | Effort | Owner chain                                          | Notes                                                                                                                                                       |
| --- | ---------------------------------------------------------- | ------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Prove clean-default mode end to end                        | 2h     | `veritas-ledger`, `veritas-proof`, `veritas-surface` | Run API and browser smoke with `ALLOW_DEMO_DATA=false` and `ALLOW_DEMO_USERS=false`; verify no seeded operational records or demo badges.                   |
| 2   | Add regression tests for empty/live/demo data modes        | 4h     | `veritas-proof`, `veritas-ledger`                    | Cover Baserow fallbacks, DocuSeal templates/submissions, OCR, biometric, payroll, calendar, stats, incidents, notifications.                                |
| 3   | Audit unwrapped or public-looking API routes               | 3h     | `veritas-shield`, `veritas-gateway`                  | Classify routes that do not use `withAuth`/`withRole`; document intentional public routes and wrap the rest.                                                |
| 4   | Replace remaining non-logger console calls in app code     | 1h     | `veritas-refinery`, `veritas-radar`                  | Current hits include onboarding, expenses, widget error boundary, and motion context. Exempt `lib/logger.ts` and service worker diagnostics if intentional. |
| 5   | Remove or justify CI `continue-on-error` before production | 1h     | `veritas-pipeline`, `veritas-launch`                 | Review `deployment-checklist.yml` and `terraform-plan.yml`; go-live checks should fail closed unless explicitly advisory.                                   |

## P1 Release Readiness

| #   | Action                                                           | Effort | Owner chain                          | Notes                                                                                                         |
| --- | ---------------------------------------------------------------- | ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 6   | Browser smoke core dashboards in empty mode                      | 2h     | `veritas-studio`, `veritas-proof`    | Check Hans, Charl, Lucky, Irma, kiosk, calendar, payroll, OCR, biometric, inventory, documents.               |
| 7   | Add API route tests for high-risk integration endpoints          | 3h     | `veritas-proof`, `veritas-gateway`   | Include 401/403, unconfigured integration responses, and no demo payload by default.                          |
| 8   | Persist or explicitly scope volatile stores                      | 4h     | `veritas-vault`, `veritas-blueprint` | Audit log, rate limiter, calendar local event store, realtime/event streams, and in-memory incident fallback. |
| 9   | Update Terraform plan PR comments instead of creating duplicates | 1h     | `veritas-pipeline`                   | Current assessment flags repeated plan comments as CI noise.                                                  |
| 10  | Verify production environment variable inventory                 | 1h     | `veritas-beacon`, `veritas-launch`   | Confirm required Azure/Baserow/DocuSeal/Twilio/Auth variables and document optional demo flags as false.      |

## P2 Hardening

| #   | Action                                                       | Effort | Owner chain                          | Notes                                                                       |
| --- | ------------------------------------------------------------ | ------ | ------------------------------------ | --------------------------------------------------------------------------- |
| 11  | Expand E2E coverage for admin access control and rate limits | 3h     | `veritas-proof`, `veritas-shield`    | Prioritize negative-path tests.                                             |
| 12  | Add service tests for Baserow, DocuSeal, audit log, uploads  | 4h     | `veritas-proof`, `veritas-vault`     | Focus on timeout, error, empty, live, and demo behaviors.                   |
| 13  | Review remaining dashboard navigation gaps                   | 2h     | `veritas-surface`, `veritas-compass` | Verify nav links resolve or are disabled; Hans Team route was added.        |
| 14  | Capture go-live handoff and release checklist                | 1h     | `veritas-nexus`, `veritas-archive`   | Include changed files, flags, verification, residual risks, and next owner. |

## Current Demo-Default Status

- `.env.example` sets `ALLOW_DEMO_DATA=false` and `ALLOW_DEMO_USERS=false`.
- Code gates demo operational data on the literal value `ALLOW_DEMO_DATA === "true"`.
- Code gates demo users on the literal value `ALLOW_DEMO_USERS === "true"`.
- `.env.local` currently has no `ALLOW_DEMO_DATA` or `ALLOW_DEMO_USERS` entries.
- Remaining work is proof: add regression coverage and browser/API smoke checks before go-live.
