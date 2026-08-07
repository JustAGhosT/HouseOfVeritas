# Knowledge base publication safeguards — rubric, control plane, enforcement

- Date: 2026-08-07
- PR: [#183](https://github.com/neuralliquid/house-of-veritas/pull/183)
- Branch: `claude/knowledge-base-process-rubric`
- Spec: [knowledge-base-process-rubric.md](../specs/knowledge-base-process-rubric.md)
- Status: merged to `main`

## What changed and why

`lib/knowledge/seed.ts` held one curated process and no stated rule for what else
belonged there. Entry-worthiness was a judgement call per PR, and nothing checked
whether an entry was safe to publish at all.

This adds that rule, in three tiers, and enforces the first one:

| Tier                | Question                          | Where it lives                          |
| ------------------- | --------------------------------- | --------------------------------------- |
| 0 — safeguards      | May this be published at all?     | `lib/knowledge/safeguards.ts`, enforced |
| 1 — priority rubric | How soon should it be authored?   | `lib/knowledge/rubrics.ts`, advisory    |
| 2 — draft quality   | Is the written entry good enough? | Spec §6, manual                         |

Both implemented tiers copy patterns already in the repo rather than inventing:
rubric-as-data from Deal Radar (`lib/services/radar/rubrics.ts`), and the
append-only actor/rationale/version event model from the Gate 0 governance
control plane.

## Files

| Area                                       | Path                                                         |
| ------------------------------------------ | ------------------------------------------------------------ |
| Safeguard definitions, profiles, evaluator | `lib/knowledge/safeguards.ts`                                |
| Tier-1 bands, floors, weights              | `lib/knowledge/rubrics.ts`                                   |
| Entry-level publication check              | `lib/knowledge/publication.ts`                               |
| Durable profile events                     | `lib/knowledge/safeguard-profile-events.ts`                  |
| Repository (memory + MongoDB)              | `lib/repositories/knowledge-safeguard-profile-repository.ts` |
| Admin API                                  | `app/api/knowledge/safeguard-profiles/route.ts`              |
| Admin UI                                   | `app/dashboard/hans/knowledge-safeguards/page.tsx`           |
| Enforcement at application                 | `app/api/knowledge/apply/route.ts`                           |
| Enforcement at search                      | `app/api/knowledge/route.ts`                                 |

New MongoDB collection: `knowledge_safeguard_profile_events`. It has never been
written to in production — nothing here has shipped before this PR.

## Things worth knowing before you touch it

**Safeguards are enforced at two chokepoints, not one.** There is no publication
API — entries live in `seed.ts` and are published by merging a PR. So
`assertPublishable()` runs at seed import against the _built-in_ profile (a bad
entry fails CI and cannot merge), and the apply/search routes re-check against
the administrator's _effective_ profile (tightening a safeguard takes effect
without a deploy). See spec §9.3.

**Two safeguards cannot be waived by anyone, including an administrator.**
`data_boundary` is POPIA; `verifiable_ground_truth` is what makes any entry
publishable at all. The rule is enforced at three layers — request schema on
write, `resolveEffectiveProfile()` on read, and `isSafeguardEnabled()` at every
evaluation. Only the third sees a profile built in code, so it is the one
actually holding the line. See spec §9.2.

**Disabled never means passed.** A switched-off safeguard is recorded in
`skippedSafeguards`; a missing or `not_applicable` result holds the candidate at
`draft`. An audit can always separate "checked and fine" from "never checked".

**Outage behaviour differs by caller on purpose.** The admin route fails closed
with 503 — a decision you cannot durably store must not appear to succeed.
Content evaluation instead falls back to `strict` and reports
`profileSource: "builtin-fallback"`, because refusing to evaluate would only move
the failure while running every safeguard is the strictest available answer.

**`KnowledgeReview` is required on any published entry.** Safeguard results are
human judgements about content, not properties derivable from it, so they are
recorded rather than computed. `tier1` is optional and advisory; if present, the
recorded score must still follow from the recorded facts or the seed refuses to
load.

## Deferred — needs a person, not a commit

**The statutory register is unverified.** `statutory_competence` names
SANS 10142-1, SAQCC and PIRB, inherited from the reviewer-trial vocabulary rather
than from anyone who checked them. Six rounds of automated review passed over
that definition without once questioning the citations, which is the limit of
what those tools check.

It needs a South African electrician, plumber or attorney, or the estate's
insurer. Until then the safeguard is deliberately biased toward being too broad:
when in doubt whether work is reserved, record a failure and publish a `safety`
entry. Needless re-scoping is wasteful; missing reserved work is dangerous.

Spec §10.0 carries the full statement, and the safeguard's own `description`
repeats it so it is visible at the point of use.

## Open, with evidence

**The priority bands barely discriminate.** Scoring 13 representative candidates
across all five domains (`tests/lib/knowledge-rubric-calibration.test.ts`), the
composite spans only 7.19–8.19 and 9 of 13 land in P0, with nothing in P2. Either
the bands are too generous or P0/P1/P2 is the wrong output shape and rank-order
would serve better.

Deliberately not fixed: re-tuning against 13 numbers invented for the analysis
would be the "asserted, not derived" failure the spec objects to. `tier1` exists
so this can be re-run against real reviewer data once ~15 entries exist.

Closed by the same measurement: `costAvoided` does **not** distort against
trade-less work (gap 0.09), and the band floors are bounded (≤0.375 composite,
never exercised by a realistic candidate).

## Next owner

Most useful next steps, in order:

1. **Author entries.** The rubric exists; the catalogue in spec §7 has ~35
   candidates with indicative tiers. The P0 maintenance and household ones are
   the obvious start.
2. Re-run the calibration once ~15 entries carry real `tier1` facts, and settle
   the band question with data.
3. Get the statutory register confirmed.

`GET /api/knowledge` ranks 50 and serves 5 so the safeguard filter can backfill;
if the knowledge base grows past ~50 plausible matches for one query, revisit
`SEARCH_CANDIDATE_LIMIT`.

## Verification

- `npx tsc --noEmit` clean, `npx eslint` clean
- Full suite green; knowledge-specific coverage is ~160 tests across 13 files
- CI green on all 7 checks
- Six Copilot review passes; every finding either fixed or explicitly answered
