# Gate 0 reviewer testing and follow-ups handoff

- Date: 2026-07-27
- Repository: `C:\Users\smitj\repos\house-of-veritas`
- Default branch: `main`
- Remote `main` at handoff refresh: `1126fd2ed55aa7245daef812ed277edd8713bf10`
- Production runtime at handoff refresh: `2a42ee54cd4b8d5b3e8ae94888daa9194cb1c684`
- Baton project: `house-of-veritas` (`da62c803-1a03-45a4-9ce1-b6e86dd8d23d`)
- Status: current Gate 0 discovery slice is closed for now; local synthetic reviewer
  acceptance passed; human O5/O6 and production-auth acceptance remain separate
  follow-ups

## Current decision

The original Gate 0 discovery task
`9bba1180-b6a4-49cb-b1fc-45bdcbb4cd3c` is administratively complete. Its O5
and O6 checklist entries were marked complete only because the owner asked to
close the current slice and move the unresolved prerequisites into durable,
separate tasks. That action is not evidence that O5 or O6 passed.

The repository now has:

1. an admin-only Gate governance control plane;
2. an admin-only, ephemeral Domain Reviewer Lab using fictional scenarios;
3. a disabled-by-default Terraform definition and runbook for a dedicated O6
   restricted evidence store; and
4. passing local synthetic admin/operator browser acceptance for the Domain
   Reviewer Lab.

No live PIRB verification, candidate contact, real household evidence,
restricted record, Terraform apply, Azure RBAC change, payment, O5/O6
activation, or Gate progression has occurred.

## Delivered sequence

| PR                                                                | Merge commit | Outcome                                                                                                     |
| ----------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| [#149](https://github.com/neuralliquid/house-of-veritas/pull/149) | `032c7d6`    | Admin-only append-only Gate governance control plane with fail-closed activation prerequisites.             |
| [#150](https://github.com/neuralliquid/house-of-veritas/pull/150) | `2a42ee5`    | Synthetic Domain Reviewer Lab, provider boundary, API/UI/auth tests, and review fixes.                      |
| [#151](https://github.com/neuralliquid/house-of-veritas/pull/151) | `1126fd2`    | Disabled-by-default O6 restricted-store Terraform, retention/RBAC/diagnostics controls, tests, and runbook. |

PRs #149, #150, and #151 are closed and merged. PR #151's Terraform Plan and
Deployment Checklist passed, and it had no actionable review findings or
unresolved threads before merge. PR #151 did not apply Terraform or redeploy the
application.

## Canonical artifacts

Read these in order:

1. [Previous alpha/Gate 0 handoff](2026-07-26-alpha-review-e2e-gate0-handoff.md)
2. [Gate governance admin control plane](../05-project/2026-07-26-gate-governance-admin-control-plane.md)
3. [PIRB Domain Reviewer testing surface](../05-project/2026-07-26-pirb-domain-reviewer-testing-surface.md)
4. [Independent Domain Reviewer sourcing](../05-project/2026-07-26-independent-domain-reviewer-sourcing.md)
5. [O6 restricted evidence store runbook](../03-deployment/09-o6-restricted-evidence-store.md)
6. [Current Azure preparation plan](../../.azure/plan.md)

Key implementation paths:

- `app/dashboard/hans/governance/page.tsx`
- `app/api/governance/gates/route.ts`
- `lib/repositories/gate-governance-repository.ts`
- `app/dashboard/hans/reviewer-lab/page.tsx`
- `app/api/reviewer-trials/domain-safety/route.ts`
- `lib/reviewer-trials/domain-safety-trial.ts`
- `terraform/modules/restricted-storage/`
- `tests/lib/restricted-storage-terraform-contract.test.ts`

## Local synthetic reviewer acceptance

Baton task `7d0f57f3-a827-4911-a9eb-63c3b8884c38` is complete.

Repository gates run on 2026-07-26:

```powershell
pnpm exec vitest run tests/lib/domain-safety-trial.test.ts tests/api/domain-safety-reviewer-trial.test.ts tests/components/domain-reviewer-lab-page.test.tsx tests/lib/nav-config.test.ts
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
```

Results:

- focused Vitest: 15/15 passed;
- lint: passed;
- TypeScript: passed;
- production build: passed and emitted the reviewer-lab page and API route;
- local health: HTTP 200 on the built E2E runtime;
- synthetic admin `hans` reached `/dashboard/hans/reviewer-lab`;
- fictional Variant B completed with six critical gates `Pass`, seven quality
  dimensions `Clear`, and all three fail-closed acknowledgements checked;
- disposition: `ready_for_internal_replay`;
- reliance: `none`;
- PIRB eligibility: `not_evaluated`;
- result labels: `Not persisted`, `No external effects`, `O5 inactive`, and
  `0 critical gates incomplete`;
- reload removed the evaluation and reset Variant B, proving the browser result
  was ephemeral;
- synthetic operator `charl` was redirected from the reviewer-lab route to
  `/dashboard/charl`; and
- operator `GET /api/reviewer-trials/domain-safety` returned HTTP 403 with
  `Insufficient permissions`.

Known unrelated local console noise remained:

- `/api/projects?type=scope` returned HTTP 500 in the unconfigured local data
  mode; and
- the intentional operator API denial appeared as HTTP 403 in the console.

The local server, browser sessions, session data, generated Playwright artifacts,
and temporary logs were removed after testing. No source files changed during
the acceptance run.

## Live state refreshed for this handoff

On 2026-07-27, a fresh public health request returned:

```json
{
  "status": "healthy",
  "build": {
    "commit": "2a42ee54cd4b8d5b3e8ae94888daa9194cb1c684"
  },
  "dataMode": "empty"
}
```

`baserow` and `docuseal` were `unconfigured`, consistent with the low-usage
canonical stack. Remote `main` was `1126fd2`, so the production runtime contains
the reviewer lab from PR #150 but not the later Terraform-only PR #151 commit.
Recheck this state live before relying on it in a future session.

## Separate open follow-ups

| Baton task                             | Status       | Owner/action                                                                                                                                                 |
| -------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `1b3f29a9-0391-4ac5-95a6-8d8f0bf8d2fe` | `todo`       | Privately nominate the qualified independent plumbing reviewer and approve the bounded eligibility/protocol, conflicts, compensation, and consent decisions. |
| `7fede6f2-50e9-4d30-93c6-3ad2d17e50af` | `todo`       | Complete the O6 privacy/accountability record, named owners, approved Entra researcher IDs, exact Terraform plan review, and separate apply approval.        |
| `374f9f21-c76e-4547-a16e-b8238c26ddb1` | `todo`       | Run production-auth synthetic reviewer acceptance with legitimate short-lived admin and operator sessions.                                                   |
| `5445ec3b-386f-4624-b005-fd3d74ae3a13` | `inprogress` | Prove authentic production governance write/reload/restart persistence plus operator page/API denial.                                                        |

Production-auth reviewer and governance acceptance were not run because neither
an approved production admin session nor an operator session was available in
the current environment. Report these checks as skipped until legitimate
short-lived sessions are supplied. Never expose or persist session material.

## O5 and O6 remain hard gates

The follow-up split changes task organization only. It does not authorize:

- accepting or contacting a reviewer;
- PIRB lookup, scraping, registry requests, or credential transmission;
- invitation, booking, contracting, escrow, compensation, or payment;
- real household or participant evidence;
- a restricted record or recording;
- Terraform apply, Azure resource creation, or RBAC mutation;
- activating O5 or O6; or
- advancing Gate 0 or beginning Gate 1 implementation.

Identity, contact details, registration or credential evidence, relationship and
conflict narratives, compensation terms, consent evidence, raw notes, household
information, restricted-store details, and session tokens must remain outside
Git, Baton, prompts, and general chat.

## Restricted-store state

The restricted-store module is present but absent by default:

```hcl
enable_restricted_evidence_store = false
restricted_evidence_researcher_object_ids = []
```

Validation completed before PR #151 merged:

- Terraform initialization, formatting, and validation passed;
- the disabled-default plan contained zero restricted-store resource changes;
- the enabled synthetic targeted plan proposed nine module creates, no deletes,
  and one unrelated pre-existing VNet state/provider normalization;
- an empty researcher set failed closed;
- equal 30-day retention and soft-delete values failed closed; and
- focused restricted-storage contract tests passed 4/4.

Do not apply the saved or reconstructed synthetic plan. A future apply requires
the exact production plan to be regenerated and reviewed after private O6 inputs
exist. The unrelated production baseline changes must also be reconciled first.

## Recommended continuation

Safe next actions without new external authority:

1. refresh `main`, Baton, open PRs, workflow state, and public health;
2. replay the focused synthetic reviewer tests or local browser acceptance;
3. review synthetic-only wording and fail-closed boundaries; and
4. prepare production-auth probes without inserting or storing session material.

The next human-owned actions are the O5 and O6 follow-up tasks. Once legitimate
production sessions are available, complete the two production acceptance tasks
before considering any live integration. After O5/O6 evidence exists, stop for
explicit approval of the exact external action or Terraform apply; do not infer
authority from this handoff.

## Copy-pastable continuation

```text
Continue House of Veritas Gate 0 reviewer work from docs/handoffs/2026-07-27-gate0-reviewer-testing-followups-handoff.md.

Repo: C:\Users\smitj\repos\house-of-veritas
Baton project: house-of-veritas (da62c803-1a03-45a4-9ce1-b6e86dd8d23d)
Remote main at handoff: 1126fd2ed55aa7245daef812ed277edd8713bf10
Production runtime at handoff: 2a42ee54cd4b8d5b3e8ae94888daa9194cb1c684

First refresh Git/main, PR and workflow state, public /api/health build identity, and these Baton tasks:
- O5 reviewer/protocol: 1b3f29a9-0391-4ac5-95a6-8d8f0bf8d2fe
- O6 privacy/store activation: 7fede6f2-50e9-4d30-93c6-3ad2d17e50af
- production reviewer acceptance: 374f9f21-c76e-4547-a16e-b8238c26ddb1
- governance production persistence: 5445ec3b-386f-4624-b005-fd3d74ae3a13

The old Gate 0 checklist was administratively closed and superseded into these tasks; O5/O6 did not pass. Local synthetic Domain Reviewer Lab acceptance passed with admin Variant B, no persistence/external effects, reload reset, operator redirect, and API 403. Production-auth checks remain skipped until legitimate short-lived admin/operator sessions are supplied.

Do not expose session material or private O5/O6 inputs. Do not call PIRB, contact or pay candidates, use real household evidence, create restricted records, apply Terraform, activate O5/O6, or advance a Gate without the exact private prerequisites and explicit approval.
```
