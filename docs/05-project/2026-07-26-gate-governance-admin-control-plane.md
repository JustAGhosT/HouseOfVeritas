# Gate governance admin control plane

- Date: 2026-07-26
- Status: Implemented and locally verified; not deployed
- Baton task: `5445ec3b-386f-4624-b005-fd3d74ae3a13`
- Parent Gate 0 task: `9bba1180-b6a4-49cb-b1fc-45bdcbb4cd3c`

## Purpose

The Gate governance control plane gives an authenticated administrator a durable,
auditable place to record bounded Gate decisions. It is separate from kiosk
approvals because a governance decision must not trigger inventory, notification,
payment, recruitment, fieldwork, or Gate progression side effects.

The initial scope covers O1-O7 for the under-sink leak Gate 0 protocol. Existing
decisions in the evidence log are not automatically seeded into application
storage. After deployment and datastore verification, an administrator must
record the corresponding events through the interface.

## Runtime surface

| Surface                      | Purpose                                    |
| ---------------------------- | ------------------------------------------ |
| `/dashboard/hans/governance` | Admin-only decision and history interface  |
| `GET /api/governance/gates`  | Read the seven definitions and projections |
| `POST /api/governance/gates` | Append one authenticated decision event    |
| `gate_governance_events`     | MongoDB append-only event collection       |

The navigation entry appears only for the admin role. The API independently
enforces `withRole("admin")`; UI visibility is not treated as authorization.

## Decision model

The supported states are:

```text
pending
  -> approved_in_principle
  -> rejected

approved_in_principle
  -> active
  -> rejected
  -> superseded

active
  -> superseded

rejected or superseded
  -> approved_in_principle
```

Every event records the Gate and protocol version, decision ID, new state,
rationale, non-sensitive evidence references, monotonically increasing version,
idempotency key, server-derived actor ID and role, and timestamp. The API rejects
unknown fields, client-supplied actor fields, invalid transitions, stale expected
versions, and changed payloads that reuse an idempotency key.

## Activation gates

O5 cannot become active without:

- a pseudonymous reviewer candidate ID; and
- at least one current eligibility evidence reference.

O6 cannot become active without non-sensitive IDs or approvals for:

- the responsible party;
- privacy/legal reviewer;
- research owner;
- restricted store approval;
- authorized researchers;
- retention/deletion deadline;
- correction/deletion owner; and
- incident owner.

The technical restricted-store preparation and its remaining human/deployment
gates are documented in the
[O6 restricted evidence store runbook](../03-deployment/09-o6-restricted-evidence-store.md).
Terraform preparation alone does not satisfy these activation inputs.

Names, contact details, credentials, registration artifacts, consent evidence,
raw notes, and restricted-store details remain prohibited from the general
application datastore. The interface stores references, not the restricted
records themselves.

## Storage modes

- Production and ordinary development fail closed when MongoDB is not configured.
- Vitest uses an isolated in-memory repository.
- Playwright may use memory only when `E2E_TEST=1` is set explicitly.
- No demo decisions or users are enabled by this feature.

MongoDB creates unique indexes for event ID, idempotency key, and
Gate/protocol/decision/version. The current decision is a projection of immutable
history; previous events are never overwritten or deleted by the API.

## Verification evidence

Commands run on 2026-07-26:

```powershell
pnpm exec vitest run tests/lib/gate-governance.test.ts tests/api/gate-governance.test.ts tests/lib/nav-config.test.ts tests/components/gate-governance-page.test.tsx
pnpm run lint
pnpm test
pnpm run build
```

Results:

- focused tests: 18/18 passed;
- lint: passed;
- production build: passed and emitted both governance routes;
- full Vitest: 381/383 passed; the two failures are the pre-existing Windows
  CRLF workflow-parser assertions in
  `tests/lib/deployment-workflow-contract.test.ts`;
- authenticated admin browser: page rendered seven pending decisions, displayed
  activation prerequisites, and recorded an O5 approval-in-principle event with
  versioned immutable history;
- operator browser: direct navigation to the admin URL redirected to
  `/dashboard/charl`;
- local browser console retained the pre-existing unconfigured
  `/api/projects?type=scope` error; the governance API and interaction succeeded.

## Deployment acceptance

Before treating the admin surface as operational:

1. merge and deploy through the normal PR path;
2. confirm the production app resolves its MongoDB configuration;
3. use an authentic admin session to load the page and record a reversible
   approval-in-principle event;
4. reload and confirm history persists across the request and application restart;
5. confirm an operator receives API 403 and cannot remain on the page; and
6. enter O1-O7 from the evidence log without adding restricted data.

O5 and O6 remain inactive until their exact prerequisites are supplied and
accepted. Deployment of this interface does not authorize live alpha activity,
fieldwork, external contact, or Gate 1.
