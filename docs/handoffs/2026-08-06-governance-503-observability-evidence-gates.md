# Gate governance 503, production observability, and the evidence gates

- **Date:** 2026-08-06
- **Repository:** `C:\Users\smitj\repos\house-of-veritas`
- **Branch at handoff:** `main` @ `78909ee`
- **Baton tasks:** `5445ec3b` (Gate governance), `374f9f21` (reviewer acceptance),
  `a8f1fb26` (theme acceptance), `7bbf0537` (resident guidance), `f2a96a56`
  (observability, closed), `27275297` (Renovate)
- **Area:** Gate governance datastore, Azure Monitor telemetry, production
  acceptance probes

## Why this session happened

Every open Baton evidence gate was blocked, and the common blocker looked like a
single unexplained symptom: an admin read of `/api/governance/gates` returned
**HTTP 500** in production on 2026-08-01.

## What shipped

| PR   | Change                                                                   | State                                |
| ---- | ------------------------------------------------------------------------ | ------------------------------------ |
| #176 | Gate governance fails closed with 503 when the datastore is unreachable  | merged `25586a3`, deployed           |
| #177 | Onboarding no longer opens the login modal over an authenticated session | merged `2c79e13`, deployed           |
| #178 | Operator-authorised governance durable-write probe                       | merged `a604d64`, deployed           |
| #180 | `lib/logger` output routed into Azure Monitor                            | merged `78909ee`, deployed, verified |

### #176 — the 500

`isMongoConfigured()` only proves `MONGODB_URI` is a non-empty string; it never
proves the cluster answers. An _unconfigured_ store raised
`GateGovernanceStoreUnavailableError` and returned 503 as intended, but a
_configured but unreachable_ store raised a raw `MongoServerSelectionError` out of
`getCollection()`, matched no handler in the route's catch, and fell through to 500. The fail-closed contract only ever covered "not configured".

Driver connectivity errors are now mapped to
`GateGovernanceStoreUnavailableError` across connect, index creation, reads and
writes. Conflict, idempotency-reuse and duplicate-key outcomes are deliberately
left unmapped so they keep their own status codes.

**This makes the endpoint fail correctly. It does not make Cosmos reachable.**

Why it escaped review: all seven existing governance tests run under
`NODE_ENV=test`, which short-circuits `getGateGovernanceRepository()` to the
in-memory repository. The Mongo branch — the only path production takes — had
zero coverage. `tests/lib/gate-governance-repository.test.ts` now covers it via
the convention used elsewhere in the repo (`vi.stubEnv("NODE_ENV", "production")`
plus a mocked `@/lib/db/mongodb`).

### #177 — a second, unrelated bug

Found while writing E2E coverage: an overlay was swallowing every click.
`app/onboarding/page.tsx` called `openLoginModal()` whenever `!isAuthenticated`,
with no guard for the session probe still being in flight. `isAuthenticated` is
`!!user` and `user` is null until the probe resolves, so the effect fired on
**every** mount including fully authenticated ones — and `LoginModalProvider` has
no auto-close. Every visit to `/onboarding` rendered a "Bound by Oath" dialog over
the onboarding card, blocking both exits.

`components/dashboard-layout.tsx` gates on `requiresAuth` (set only after a real 401) and was always correct; onboarding was the outlier.

### #180 — observability

`traces` and `exceptions` were **empty over a 90-day window** while `requests`,
`dependencies` and `customMetrics` filled normally. `useAzureMonitor()` does not
capture plain `console` output, and `lib/logger.ts` writes via `console.*`, so
every `logger.*` call in the codebase reached stdout and nothing else.

Entries now also emit through the OpenTelemetry logs API. The sink is **injected
from `instrumentation.ts`**, not imported inside `lib/logger.ts`, because that
module is reachable from the Edge runtime which cannot load the OTel SDK.

Verified post-deploy — `traces` now contains `Next.js server starting`
(severity 1) where it had been empty for 90 days.

**Scope limit:** this populates `traces`, not `exceptions`. Errors arrive as
severity-ERROR log records. Do not expect `exceptions` to fill.

## Two hypotheses that were wrong

Recorded because both cost time and both looked plausible.

1. **"Infrastructure is the prime suspect."** It is not. The web app has VNet
   integration into `prod-appservice-subnet` with `vnetRouteAllEnabled=true`; the
   Cosmos private endpoint connection is **Approved**; the
   `privatelink.mongo.cosmos.azure.com` zone holds correct A records
   (`nlprodhovcosmos` → `10.0.5.4`) and is linked to the VNet. Cosmos
   `publicNetworkAccess` is `Disabled` by design. The private-link path is
   textbook-correct on paper.

2. **"Empty Baserow/DocuSeal credentials are a misconfiguration."** They are a
   deliberate low-cost stack decision — see Baton `a7021a7c` and `4bbeb0d5`.
   `BASEROW_API_TOKEN`, `BASEROW_DATABASE_ID` and `DOCUSEAL_API_KEY` are
   intentionally empty, and task persistence was moved onto Cosmos Mongo in July.

Consequence of (2): **Cosmos is not just the governance store, it is the entire
production data layer.** If it is unreachable, task persistence is down too, and
the resident guidance gate cannot pass for that reason alone.

## The open question

Whether Cosmos is reachable **right now** is unknown and untested.

Telemetry starts abruptly at `2026-08-06T07:34:30Z` — the #176 deploy restart.
The App Insights component was created 2026-07-20 with 90-day retention, so this
is not a retention cutoff. There is **no historical data covering the 2026-08-01
failure**, and it is unrecoverable. The leading theory is that the app had not
been restarted since the connection string was applied.

Because the app restarted today with current configuration, the 500 may already
be resolved. Nobody has checked, because there is no unauthenticated Mongo-backed
route: `/api/health` only probes Baserow and DocuSeal, and
`GET /api/kiosk/requests` is `withAuth` despite `/api/kiosk` being in
`PUBLIC_PATHS`.

## Next action — one command answers it

```powershell
pwsh scripts/run-post-deploy-gate0.ps1 -GovernanceWrite
```

Needs a legitimate short-lived production **admin** session, and an **employee**
session for the denial probes. The runner reads them via
`Read-Host -AsSecureString` into process environment only and restores prior
values in a `finally`; the probe policy forces `retries=0`, `trace=off`,
`screenshot=off`.

The first read is the decisive diagnostic:

- **200** → Cosmos is reachable; today's restart resolved it.
- **503** → configured but unreachable; #176 is working as intended and the fault
  is connectivity.

Either way the Cosmos call now appears in App Insights `dependencies`, and any
`MongoDB connection error` now appears in `traces` — neither was true this
morning.

`-GovernanceWrite` is opt-in, runs only after the read-only probes pass, echoes
the decision back, and requires a case-sensitive `WRITE` confirmation. The owner
authorised a production governance write on 2026-08-06. The probe keeps that
authorisation narrow: the decision comes from `POST_DEPLOY_GOVERNANCE_DECISION` at
run time and is never hardcoded, O5 and O6 are refused by the probe itself, and
`status: "active"` is refused outright.

## Remaining blockers

All four open evidence gates need a legitimate production session. None can be
closed from code.

| Gate                                | Needs                                     |
| ----------------------------------- | ----------------------------------------- |
| `374f9f21` reviewer acceptance      | admin + employee sessions                 |
| `5445ec3b` governance durable write | admin session (write authorised)          |
| `a8f1fb26` theme acceptance         | admin session + a pending-onboarding user |
| `7bbf0537` resident guidance        | resident session **and** working Cosmos   |

`7bbf0537` additionally needs real Baserow, uploads and Sluice, so no honest
local proof exists. No mocked substitute was written for it on purpose.

## Notes for the next session

- **Resource group naming trap.** App Insights and all HOV production resources
  live in `nl-prod-hov-rg`. The Deployment Checklist output references
  `nl-prod-hov-rg-san`, which **does not exist** in the subscription. Query
  `nl-prod-hov-rg` (appId `071a085a-1a61-43bb-b558-48c466cec0d7`).
- **No bot reviewed any of this.** The Codex connector returned "reached your
  Codex usage limits for code reviews" on #176, #177, #178 and #180. Every merge
  today rode on CI plus human/agent review. Top up credits before relying on it.
- **`role=operator` does not exist in production.** Lucky is `employee`. The
  denial probe now runs as `employee` by owner decision; operator scenarios are
  retained behind `-IncludeOperator` and skip when no session is supplied.
- **Local full-suite runs are flaky on this machine.** `pnpm test` intermittently
  produces 10s timeouts under load, which cascade into false
  `not.toHaveBeenCalled()` failures in neighbouring tests as a leaked mock call
  lands late. Every implicated file passes in isolation and CI is consistently
  green. Do not run `pnpm test` and `pnpm run test:e2e` concurrently.
- **PR #179 is superseded by #165** and should be closed. It was cut from
  `7c2b75d` before #165 landed, so it re-adds `scripts/run-post-deploy-gate0.ps1`
  as a new file and re-applies a `playwright.config.ts` change already on `main`.
  Rebasing will not help — #176 and #178 have since extended that runner.
  Reasoning is posted as a comment on the PR; closing it was blocked by local
  permission rules.
- **The primary checkout is mid-rebase.** `C:\Users\smitj\repos\house-of-veritas`
  is in a stopped rebase of `agent/publish-investor-gate0-runner` onto
  `origin/main`, with an unresolved `AA` conflict on
  `scripts/run-post-deploy-gate0.ps1`. Given #179 should be closed,
  `git rebase --abort` is the likely resolution.
- **Renovate has never run on this repo** (Baton `27275297`): no Renovate PR
  exists in any state and no Dependency Dashboard issue was ever created, despite
  `renovate.json` enabling it. 73 packages are behind. `pnpm audit` is clean, so
  this is drift rather than an incident.
