# PIRB domain reviewer testing surface

- Date: 2026-07-26
- Status: Synthetic admin testing surface implemented locally; live PIRB integration not enabled
- Baton task: `1d10b5fd-1b1b-4216-ada5-80942663fc83`
- Parent Gate 0 task: `9bba1180-b6a4-49cb-b1fc-45bdcbb4cd3c`
- Trial pack: `DSR-SYNTH-001-v1`
- Domain profile: `za-domestic-drainage-v1`

## Outcome

The first integration stage is an admin-only Domain Reviewer Lab, not a live
candidate or registry workflow. It makes the versioned synthetic plumbing-review
contract testable before HOV transmits candidate information, calls a registry,
contacts a professional, creates a restricted record, or relies on a review.

| Surface                                   | Purpose                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `/dashboard/hans/reviewer-lab`            | Run an ephemeral variant-first synthetic rehearsal                 |
| `GET /api/reviewer-trials/domain-safety`  | Read the fixed pack, profile, variants, gates, and provider status |
| `POST /api/reviewer-trials/domain-safety` | Validate and evaluate one no-reliance rehearsal without storing it |

Both API operations require the admin role. The navigation entry is admin-only,
but API RBAC remains the independent authorization boundary.

## Test contract

The lab uses fixed synthetic candidate ID `DSR-SIM-001` and variants:

- A: electrical-proximity stop and escalation;
- B: rejection of an unsupported dimension inference; and
- C: rejection of supplier-funded commercial steering.

The facilitator records only enumerated critical-gate, quality, severity,
reproducibility, and behavior categories. There is deliberately no free-text
evidence field. The server rejects unknown input, PII-shaped keys, credential or
registration numbers, real-household fields, live data classes, registry calls,
production access, contact, invitations, postings, recordings, and payments.

An accepted result can only be:

- `ready_for_internal_replay`;
- `revise_test_surface`; or
- `close_without_reliance`.

Every result fixes reliance to `none`, PIRB eligibility to `not_evaluated`, O5
activation to false, persistence to false, and external effects to false. A
successful rehearsal is therefore evidence about the test surface contract only.

## PIRB integration boundary

The current provider status is `manual_preview_only`. The UI links to the official
PIRB site but does not scrape it, submit a registration number, or claim an API
contract that PIRB has not published and HOV has not approved.

The later PIRB adapter must declare:

```text
purpose: verify current individual standing for a privately nominated candidate
inputs: restricted candidate mapping and credential evidence
outputs: candidate ID, verification source, timestamp, status, verifier ID,
         profile version, evidence reference, and re-verification due date
side effects: exact registry request and any provider processing
idempotency: provider/request-dependent; re-query before retry
storage: restricted evidence outside HOV; minimized reference in governance only
owner: named O5 decision owner and privacy reviewer
```

Before enabling that adapter:

1. O6 must have an approved restricted store, accountable role IDs, authorized
   researchers, retention/deletion deadline, and incident path;
2. the privacy reviewer must approve the exact PIRB fields, purpose, provider
   terms, storage location, access, and deletion behavior;
3. the owner must privately map a real candidate to a pseudonymous ID;
4. HOV must confirm the supported official verification route and must not rely
   on fragile or prohibited scraping;
5. credentials and personal information must never enter Git, Baton, general
   chat, logs, or the HOV general application datastore; and
6. an authenticated browser acceptance must prove admin access, non-admin denial,
   synthetic evaluation, and zero persistence/external effects.

The repository preparation for prerequisite 1 is defined in the
[O6 restricted evidence store runbook](../03-deployment/09-o6-restricted-evidence-store.md).
It is disabled by default and is not deployment or O6 approval.

No candidate contact, appointment, payment, safety reliance, O5 activation, or
Gate progression is authorized by this surface.

## Validation

Required verification for this API/UI/auth slice:

```powershell
pnpm exec vitest run tests/lib/domain-safety-trial.test.ts tests/api/domain-safety-reviewer-trial.test.ts tests/components/domain-reviewer-lab-page.test.tsx tests/lib/nav-config.test.ts
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
```

Browser acceptance must use the explicit local E2E test mode: admin can complete
a synthetic rehearsal, while an operator cannot remain on the page and receives
API 403. No demo data or user flags are required.

Local results on 2026-07-26:

- focused Vitest: 13/13 passed across contract, API, component, and navigation;
- lint: passed;
- TypeScript: passed after the production build refreshed Next.js route types;
- production build: passed and emitted both reviewer-lab routes;
- full Vitest: 392/394 passed; the two failures are the pre-existing Windows
  CRLF job-boundary assertions in `deployment-workflow-contract.test.ts`;
- admin browser: Variant B completed as `ready_for_internal_replay` with
  reliance `none`, PIRB eligibility `not_evaluated`, and `Not persisted`;
- operator browser: direct page navigation redirected to `/dashboard/charl` and
  the API returned HTTP 403; and
- the dashboard retained the pre-existing unconfigured `/api/projects?type=scope`
  error and local realtime reconnect noise; the reviewer-lab GET and POST both
  completed successfully.
