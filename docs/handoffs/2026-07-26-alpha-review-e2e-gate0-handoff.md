# Alpha reviewer E2E and Gate 0 handoff

- Date: 2026-07-26
- Repository: `C:\Users\smitj\repos\house-of-veritas`
- Default branch: `main`
- Runtime commit verified before this docs-only handoff: `f56e83118635ae869c126ebcec7c5d6ceaf29f44`
- Baton project: `house-of-veritas` (`da62c803-1a03-45a4-9ce1-b6e86dd8d23d`)
- Baton task: `9bba1180-b6a4-49cb-b1fc-45bdcbb4cd3c`
- Trace ID: `hov-alpha-review-e2e-20260726`
- Status: Synthetic operational E2E complete and production-verified; live human alpha and Gate 0 decisions remain open

## Goal and current decision

House of Veritas is validating the under-sink leak Household Resolution Graph
wedge before product implementation or field collection. The independent-reviewer
work is provider-neutral and separates:

- `DomainSafetyReviewer`: independently credentialed plumbing authority for the
  bounded observation/escalation protocol; and
- `AlphaExperienceReviewer`: personal, recommended, target-role, language,
  accessibility, or marketplace reviewer for synthetic usability and
  comprehension only.

A personal or recommended reviewer is permitted for alpha experience testing when
the nomination, relationship, conflict, compensation, consent, privacy, and
limited-authority conditions pass. That reviewer cannot approve plumbing safety,
count as customer or market evidence, satisfy a Gate 0 interview, or advance a
Gate unless they separately qualify under the applicable study/profile.

## Delivered sequence

| PR                                                                | Merge commit | Outcome                                                                                                 |
| ----------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| [#144](https://github.com/neuralliquid/house-of-veritas/pull/144) | `340dd99`    | Owner decision brief, retention limits, accountability fields, and Gate 0 activation boundaries.        |
| [#145](https://github.com/neuralliquid/house-of-veritas/pull/145) | `1d4467d`    | Provider-neutral reviewer sourcing, RentAHuman alternatives, role abstraction, and trial rules.         |
| [#146](https://github.com/neuralliquid/house-of-veritas/pull/146) | `0615b67`    | Runnable `AER-SYNTH-001-v1` personal/recommended alpha trial pack and structural dry-run.               |
| [#147](https://github.com/neuralliquid/house-of-veritas/pull/147) | `f56e831`    | Deterministic `alpha-review-e2e-v1` lifecycle, negative regressions, CI, deployment, and runtime proof. |

## Canonical artifacts

Read these in order:

1. [Gate 0 owner decision brief](../05-project/2026-07-26-gate-0-owner-decision-brief.md)
2. [Gate 0 discovery package](../05-project/2026-07-26-under-sink-leak-gate-0-discovery-package.md)
3. [Independent reviewer sourcing and micro-trial](../05-project/2026-07-26-independent-domain-reviewer-sourcing.md)
4. [Alpha experience reviewer trial pack](../05-project/2026-07-26-alpha-experience-reviewer-trial-pack.md)
5. [Alpha operational E2E evidence](../05-project/2026-07-26-alpha-review-operational-e2e.md)
6. [Gate 0 evidence log](../05-project/2026-07-26-under-sink-leak-gate-0-evidence-log.md)

Executable evidence:

- `scripts/verify-alpha-review-e2e.mjs`
- `tests/fixtures/alpha-review/synthetic-complete.json`
- `tests/fixtures/alpha-review/unsafe-live-shaped.json`
- `tests/fixtures/alpha-review/unsafe-pii-shaped.json`
- `tests/lib/alpha-review-e2e-harness.test.ts`

## What the operational E2E proves

The read-only harness validates this exact sequence:

```text
synthetic nomination
  -> activation preflight
  -> invitation preview
  -> simulated consent acknowledgement
  -> assigned variant on first exposure
  -> minimized finding
  -> no-reliance closeout
  -> retention review scheduled
```

Successful trace:

```text
Candidate ID: AER-SIM-001
Pack: AER-SYNTH-001-v1
Variant: B
Events: 8 in exact order
Disposition: revise_before_more_alpha
Reliance: none
External effects: none
Restricted record: not created
Evidence claims: all false
```

The regressions fail closed when a fixture attempts live/external effects or adds
an identifying field. The validator also rejects unknown fields, reordered or
repeated lifecycle events, late variant introduction, baseline priming, Variant E
as a session variant, unminimized findings, invalid dispositions, created
restricted records, and participant/usability/customer/market/safety/Gate claims.

This is deterministic operational evidence, not a simulated person's opinion and
not participant or usability evidence.

## Replay path

From the repository root:

```powershell
git switch main
git pull --ff-only
pnpm run verify:alpha-review-e2e
pnpm exec vitest run tests/lib/alpha-review-e2e-harness.test.ts
pnpm run lint
pnpm run build
```

Expected harness output:

```json
{
  "candidateId": "AER-SIM-001",
  "disposition": "revise_before_more_alpha",
  "eventCount": 8,
  "mode": "synthetic_harness",
  "packVersion": "AER-SYNTH-001-v1",
  "status": "passed",
  "variant": "B"
}
```

Windows note: the full local unit run on 2026-07-26 produced `364/366` because two
untouched assertions in `tests/lib/deployment-workflow-contract.test.ts` parse
workflow job boundaries using LF-only patterns while the Windows checkout uses
CRLF. Do not attribute those two local failures to the alpha harness. Linux PR and
main CI passed the full unit suite. The repository-wide format check also has a
broad pre-existing baseline; focused formatting of the touched files passed.

## Production and CI evidence

PR #147:

- [run 30201822214](https://github.com/neuralliquid/house-of-veritas/actions/runs/30201822214)
- lint, full unit tests, production build, Playwright E2E, infrastructure,
  configuration, and pipeline summary passed.

After merge:

- [Deployment Checklist 30201943732](https://github.com/neuralliquid/house-of-veritas/actions/runs/30201943732) passed every job, including Playwright E2E.
- [Deploy on Merge 30201943729](https://github.com/neuralliquid/house-of-veritas/actions/runs/30201943729) passed quality checks, full unit tests, build, App Service deployment,
  exact-build verification, and post-deploy API probes.
- The authenticated probe output was `success`, not a missing-session skip.
- `GET https://nl-prod-hov-app.azurewebsites.net/api/health` returned HTTP 200,
  `status: healthy`, `build.commit: f56e83118635ae869c126ebcec7c5d6ceaf29f44`,
  and `dataMode: empty` on 2026-07-26.

The later handoff-only merge does not alter runtime behavior. Recheck live workflow
and health state rather than assuming this snapshot remains current.

## Open Gate 0 checklist

Every Baton checklist item remains open:

| ID  | Required owner decision                                                                                |
| --- | ------------------------------------------------------------------------------------------------------ |
| O1  | Approve `moat` instead of `NOAT`.                                                                      |
| O2  | Approve South Africa as the first test market.                                                         |
| O3  | Approve a private staffed household or small private estate as the customer unit.                      |
| O4  | Approve photo-to-resolution coordination as the first problem test.                                    |
| O5  | Nominate and accept an eligible independent qualified plumbing reviewer.                               |
| O6  | Approve privacy/safety protocol, restricted store, access, retention, correction/deletion, and owners. |
| O7  | Accept or revise subscription-funded neutral comparison with commerce and steering exclusions.         |

Approval of O1-O4 or O7 does not remove O5/O6 preconditions. Do not begin Gate 1
implementation until the signed Gate 0 decision exists.

## Exact inputs required for a live alpha session

These must be held outside Git and Baton:

1. candidate identity and contact path mapped to a pseudonymous candidate ID;
2. nomination source and relationship or recommendation chain;
3. relationship, employment, household, vendor, commercial, and power-imbalance
   conflict disposition;
4. paid, volunteer, in-kind, or waived compensation decision and conditions;
5. direct invitation language confirming that declining or criticism has no
   negative consequence;
6. note-taking choice and any separately approved recording consent;
7. restricted store, record owner, deletion/correction owner, and concrete review
   or deletion date;
8. named facilitator;
9. tested, reachable `DomainSafetyReviewer` escalation owner and approved contact
   path; and
10. tested, reachable privacy escalation owner and approved contact path.

Do not place names, contact details, relationship narratives, compensation
amounts, registration numbers, identity evidence, consent evidence, raw notes,
recordings, household information, or credentials in Git, Baton, prompts, or
general chat.

## Approval and execution boundary

Safe without new external authority:

- recheck repository, Baton, PR, CI, deployment, and public health state;
- replay the synthetic harness and tests;
- review or revise synthetic-only wording in a PR; and
- prepare invitation, nomination, consent, and closeout previews without sending
  them or inserting personal information.

Requires explicit human approval for the exact target/action:

- naming or accepting a candidate;
- sending an invitation or message;
- posting a bounty or quote request;
- transmitting candidate/application data to a provider;
- booking, contracting, escrow, or payment;
- creating a restricted record or recording;
- using real household/participant evidence; and
- approving a reviewer, protocol, Gate, production policy, or purchase.

Before retrying any external action, query the provider state. Messaging, posting,
booking, escrow, and payment are not assumed idempotent.

## Recommended next owner/action

The next owner is the House of Veritas human decision owner. They should:

1. approve or revise O1-O7 in the evidence log;
2. identify the responsible party, research/privacy/deletion/incident owners, and
   restricted store;
3. nominate credentialed plumbing-review candidate IDs for calibration;
4. optionally nominate one personal or recommended `AlphaExperienceReviewer` by
   candidate ID and complete the private activation record; and
5. explicitly approve the exact invitation preview before any contact.

After those inputs exist, the next agent should preflight both live escalation
routes, render the assigned-variant invitation/session pack, stop for approval of
the final external effect, run only the approved session, store restricted
evidence outside Git/Baton, and record only the minimized closeout.

## Copy-pastable continuation

```text
Continue House of Veritas Gate 0 from docs/handoffs/2026-07-26-alpha-review-e2e-gate0-handoff.md.

Repo: C:\Users\smitj\repos\house-of-veritas
Baton project: house-of-veritas (da62c803-1a03-45a4-9ce1-b6e86dd8d23d)
Baton task: 9bba1180-b6a4-49cb-b1fc-45bdcbb4cd3c
Last production-verified runtime commit: f56e83118635ae869c126ebcec7c5d6ceaf29f44

First recheck live main/worktree, PR #147, runs 30201822214, 30201943732, and 30201943729, production /api/health build identity, and the Baton task. Replay pnpm run verify:alpha-review-e2e and the focused Vitest file if the harness changed. Preserve the distinction between synthetic operational E2E and a live human alpha session.

O1-O7 remain open. Do not contact/invite/pay a reviewer, post a bounty, process personal or household data, create a restricted record, approve a protocol, or begin Gate 1 without the exact human approvals and private activation inputs. If the owner supplies them, keep identity/contact/relationship/compensation/consent details outside Git and Baton, preflight named reachable domain-safety and privacy routes, preview the assigned-variant session, and stop for approval before the first external effect.
```
