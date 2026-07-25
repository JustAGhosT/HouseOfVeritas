# Unmerged feature branch reconciliation

Date: 2026-07-25

Baton task: `c3ee5451-1be1-4744-9ae0-2405379c21e0`

Trace: `hov-unmerged-feature-reconciliation-20260725`

## Decision

The apparent unmerged remote branches do not represent a queue of product
features that can safely be merged in sequence. Most are retained heads from
squash-merged pull requests, one contains a superseded deployment-smoke
approach, and one is a stale infrastructure experiment.

The only genuine post-merge product commit was the recipe catalog and meal
feedback work on `codex/kitchen-recipes-handoff`. It was completed, hardened,
and squash-merged through
[PR #137](https://github.com/neuralliquid/house-of-veritas/pull/137) as
`c3eb190ef2ae111e77e365db4031257a1c797762`.

No other safe, unfinished application feature remains on the reviewed remote
branches.

## Reconciliation

Git ancestry alone reports these branch commits as unique because GitHub
squash-merges create a new commit on `main`. The pull request result and the
current implementation are therefore the authoritative evidence.

| Remote branch                                 | Apparent unique tip | Resolution                                                                                                                                                                                                                  |
| --------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codex/deploy-workflow-dispatch`              | `328533a`           | Squash-merged by PR #132 (`2dfc5e7`).                                                                                                                                                                                       |
| `codex/task-cosmos-persistence`               | `97d96d9`           | Squash-merged by PR #130 (`bb35830`).                                                                                                                                                                                       |
| `codex/task-cosmos-ci-fix`                    | `8b8d89a`           | Squash-merged by PR #131 (`8cd6146`).                                                                                                                                                                                       |
| `docs/env-example-mystira-oidc`               | `8ab44e6`           | Squash-merged by PR #66 (`7c5795f`).                                                                                                                                                                                        |
| `codex/noat-positioning-handoff`              | `511c121`           | Squash-merged by PR #136 (`06a1f19`).                                                                                                                                                                                       |
| `codex/mystira-auth-inventory-sluice-preview` | `233ccd5`           | PR #121 merged the auth/invite/infra slice (`31c6ee9`); stale PR #122 was closed and the inventory persistence slice was completed by PR #123.                                                                              |
| `codex/kitchen-recipes-handoff`               | `98f36c8`           | Its earlier baseline merged in PR #124; the later recipe/feedback commit was completed by PR #137 (`c3eb190`).                                                                                                              |
| `codex/inventory-cosmos-repository`           | `d3f91d2`           | Inventory persistence merged in PR #123. The later Playwright deployment-smoke commits belonged to closed PR #125 and are superseded by the narrower authenticated API probes in PR #126 plus failure reporting in PR #128. |
| `feat/minimal-cost-mvp`                       | `c7e670a`           | Do not merge. Its intent is mostly superseded by current opt-in Terraform switches, while its monitoring removal conflicts with the live production topology and needs an explicit owner decision.                          |

## Why `feat/minimal-cost-mvp` is not mergeable

The branch predates substantial Terraform evolution. Comparing it with current
`main` changes 29 Terraform files with 1,345 additions and 319 deletions. A
cherry-pick would restore an older pattern that comments modules out instead of
using the current explicit feature switches.

Current production Terraform defaults these optional stacks to disabled:

- `enable_operational_services = false`
- `enable_application_gateway = false`
- `enable_dns_records = false`
- `enable_functions = false`
- `enable_monitoring = false`
- `enable_document_intelligence = false`

The canonical production profile also disables Application Gateway, DNS,
Functions, Terraform-managed monitoring, Radar alerts, and Document
Intelligence. Live Azure inventory for `nl-prod-hov-rg` confirms there is no
Application Gateway or Document Intelligence resource.

Live production does retain `nl-prod-hov-app-insights`. Removing or replacing
that observability is a cost-versus-operations decision, not an unmerged
feature. The old branch must remain unmerged unless an owner explicitly scopes
a current-state cost assessment and approves the monitoring trade-off.

## Sluice video-guidance candidate

The proposed picture-to-explanatory-video flow is recorded under Gate 0 task
`9bba1180-b6a4-49cb-b1fc-45bdcbb4cd3c` as an experiment, not as an unreviewed
implementation branch.

Its defensible value is not generic video generation. It is a governed
Household Resolution Graph artifact that binds:

- the household or asset context;
- the approved procedure version;
- role and language;
- stop and escalation conditions;
- reviewer corrections and retained outcomes.

The first bounded experiment should compare a storyboard or short video with
text-and-image guidance for an under-sink task, with qualified review and
measurements for comprehension, safe action, escalation, correction count,
completion time, and willingness to use it. Gate 0 explicitly remains
research-only until its procurement and safety conditions are met.

## Operational handling

- Preserve the reviewed remote branches for now; this reconciliation does not
  authorize remote branch deletion.
- Do not revive PR #125 or cherry-pick `feat/minimal-cost-mvp`.
- Treat PR #137 as the completion point for the only genuine unmerged
  application feature found.
- Route the video-guidance concept through Gate 0 before creating product code,
  production data flows, or Sluice integration credentials.

## Evidence

- Live GitHub PR state and merge commits were queried on 2026-07-25.
- Current `main` Terraform switches and canonical profile were inspected.
- Live Azure resource inventory was queried read-only for `nl-prod-hov-rg`.
- Production recipe deployment was verified by successful Deploy-on-Merge run
  `30156713677`, HTTP 200 health with `dataMode=empty`, and a 401 response from
  the newly deployed authenticated meal route.
