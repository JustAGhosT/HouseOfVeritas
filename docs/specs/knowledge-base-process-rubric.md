# Knowledge Base — Process Selection, Publication Safeguard, and Quality Rubric

|                    |                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Status**         | Active — implemented and enforced at publication and application; §10 open questions stand                                     |
| **Applies to**     | `lib/knowledge/**`, `lib/guidance.ts`, `app/api/knowledge/**`, `app/api/guidance/**`                                           |
| **Pattern source** | `lib/services/radar/rubrics.ts` (rubric-as-data), `lib/reviewer-trials/domain-safety-trial.ts` (gates + quality dimensions)    |
| **Related**        | [property-deal-radar.md](property-deal-radar.md), [task-guidance-architecture.md](../05-project/task-guidance-architecture.md) |

---

## 1. Why this exists

`lib/knowledge/seed.ts` currently holds **one** curated process (copper-pipe condensation, EN + AF).
Expanding it is a content problem, not an engineering one — and content decisions made ad hoc
produce a knowledge base that is inconsistently safe, inconsistently useful, and impossible to
review at a glance.

Two failure modes are already visible in how the codebase is built:

- **Deal Radar solved the equivalent problem for property.** Its thresholds live as data in
  `rubrics.ts` with a documented "why" per band, explicitly _not_ hardcoded in a UI. The knowledge
  base has no such artefact — entry-worthiness is currently a judgement call per PR.
- **The domain-safety trial already encodes what "unsafe" means** (`DOMAIN_SAFETY_CRITICAL_GATES`:
  credential process, jurisdiction and experience, independence, critical-defect recall, unsafe
  assertion, data boundary — with a parallel `DOMAIN_SAFETY_FINDING_CATEGORIES` naming the failures).
  Those gates were built for reviewer rehearsal, not for content admission — but they are the right
  checks, and the knowledge base should reuse their vocabulary rather than invent a second one.

This document supplies the missing rubric: **which processes House of Veritas should carry, which it
must refuse to carry as procedures, and what "good enough to publish" means.**

## 2. What "process" means here

A process is a `KnowledgeEntry` whose `guidance.kind` is one of the five values already declared in
`lib/guidance.ts`:

| `GuidanceKind`    | Shape                                                   | Example                                     |
| ----------------- | ------------------------------------------------------- | ------------------------------------------- |
| `procedure`       | Do this, in order, to a known outcome                   | Fit pipe lagging                            |
| `troubleshooting` | Diagnose first, then branch                             | Copper-pipe condensation (the current seed) |
| `checklist`       | Verify state, no transformation                         | Pre-trip vehicle check                      |
| `safety`          | Recognise, stop, escalate — **no DIY steps**            | Hot work / welding on the estate            |
| `recipe`          | Household consumable, provenance-bound to `lib/recipes` | Meal-plan dishes                            |

The `safety` kind matters most to this rubric. It is the designated home for work the estate must
_not_ self-perform — and it is what a Tier-0 safeguard failure converts a candidate into, rather than a
rejection that leaves the topic undocumented.

## 3. The pipeline

```
candidate topic
   │
   ├─ Tier 0  Publication safeguards ── any FAIL ──▶ re-scope as `safety` stop-and-escalate entry
   │                            └─ untested ──▶ stays `draft`
   ▼
   ├─ Tier 1  Priority rubric ──▶ composite 0–10 ──▶ P0 / P1 / P2 / decline
   ▼
   ├─ author against GuidanceDraft
   ▼
   └─ Tier 2  Draft quality ── any `failure` ──▶ back to draft
                            └─ all `clear`  ──▶ publish
```

---

## 4. Tier 0 — Publication safeguards

Hard pass/fail. These mirror `DOMAIN_SAFETY_CRITICAL_GATES` so the knowledge base and the reviewer
trial speak one language.

The trial vocabulary has two distinct sets — `DOMAIN_SAFETY_CRITICAL_GATES` (what is tested) and
`DOMAIN_SAFETY_FINDING_CATEGORIES` (what a failure is called). Both columns are given so the mapping
stays honest; they are not interchangeable.

| Safeguard                 | Fails when                                                                                                                                                                                            | Trial gate               | Trial finding            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------ |
| `statutory_competence`    | South African law, municipal bylaw, or the estate's insurance reserves the work to a registered person — electrical CoC work under SANS 10142-1, gas installation (SAQCC), notifiable plumbing (PIRB) | `credential_process`     | `credential_process_gap` |
| `irreversible_harm`       | One plausible mistake causes death, serious injury, or fire — live mains, arc flash, gas, work at height, tree felling, confined space, structural removal                                            | `critical_defect_recall` | `missing_escalation`     |
| `verifiable_ground_truth` | Any dimension, torque, ratio, rating, dose, or timing in the entry cannot be traced to a citable source (manufacturer spec, SANS clause, supplier datasheet)                                          | `unsafe_assertion`       | `unsupported_dimension`  |
| `commercial_neutrality`   | Suppliers are ranked or recommended rather than listed as availability with a scope note                                                                                                              | `independence`           | `supplier_steering`      |
| `data_boundary`           | The entry embeds household PII, an address, an identifiable person, or a photograph of the real estate                                                                                                | `data_boundary`          | `real_data_request`      |
| `diagnosis_before_action` | The procedure can be applied to the wrong root cause and make it worse, with no confirm-first step                                                                                                    | — (new; see §8.1)        | —                        |

The trial's `jurisdiction_experience` gate has no knowledge-base analogue: it tests a _reviewer's_
scope, not an entry's. It is deliberately not carried over.

**Disposition** — deliberately parallel to `evaluateDomainSafetyTrial`:

| Condition                  | Outcome                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Any safeguard `fail`       | Not publishable as `procedure`/`troubleshooting`. Re-scope to a `safety` entry naming the recognition signals, the stop rule, and who to call. |
| Any safeguard `not_tested` | Remains `draft`. Absence of evidence is not a pass.                                                                                            |
| All safeguards `pass`      | Proceeds to Tier 1.                                                                                                                            |

A safeguard failure is **not** a reason to leave the topic out of the knowledge base. An estate that welds
badly is more dangerous than one with a `safety` entry explaining why it doesn't weld.

---

## 5. Tier 1 — Priority rubric

Same conventions as `lib/services/radar/rubrics.ts`:

- Money in **integer cents** (ZAR) via the `rands()` helper.
- _Higher-is-better_ band tables are ordered **descending**; the first band whose threshold is `<=`
  the value wins.
- _Lower-is-better_ tables are ordered **ascending**; the first band whose threshold is `>=` wins.
- Every threshold carries a "why".

### 5.1 Scored dimensions

**`recurrence`** — times per year the estate actually performs the task. _Higher-is-better._
Authoring cost is once; value accrues per use.

| Threshold | Score | Why                                                            |
| --------- | ----- | -------------------------------------------------------------- |
| 24        | 10    | Fortnightly or more — the entry pays for itself within a month |
| 12        | 8     | Monthly                                                        |
| 4         | 6     | Quarterly — still routine enough to be forgotten between runs  |
| 2         | 4     | Semi-annual                                                    |
| 1         | 2     | Annual — the persona relearns it each time, but slowly         |

Sanity ceiling: `recurrence > 365` is a capture error (cf. `MAX_PLAUSIBLE_ERF_M2`).

Floor: a candidate performed less than annually matches no band, so `RECURRENCE_FLOOR = 1` catches
it (cf. `LAND_ERF_FLOOR`). Every table below carries an explicit floor for the same reason — the gap
was found by §8.4 and is now covered by `tests/lib/knowledge-rubrics.test.ts`.

**`costAvoided`** — cents saved per occurrence versus calling a trade. _Higher-is-better._

| Threshold      | Score | Why                                        |
| -------------- | ----- | ------------------------------------------ |
| `rands(2_500)` | 10    | A full contractor visit with materials     |
| `rands(1_200)` | 8     | Call-out plus an hour of labour            |
| `rands(600)`   | 6     | Around the typical SA trade call-out floor |
| `rands(250)`   | 4     | Sub-call-out; convenience value only       |
| `rands(100)`   | 2     | Marginal                                   |

Unknown `costAvoided` scores **3**, not the neutral 5 — an unquantified saving should not read as an
average one (mirrors `FLIP_PCT_UNKNOWN_SUBSCORE`).

**`consequenceOfDelay`** — how fast unattended damage compounds. _Higher-is-better._

| Level                    | Score | Why                                                                |
| ------------------------ | ----- | ------------------------------------------------------------------ |
| `compounding-structural` | 10    | Damp into plaster/brick, roof leak, corrosion — cost grows monthly |
| `compounding-asset`      | 8     | Pump, engine, or battery destroyed by neglect                      |
| `degrading`              | 6     | Garden loss, food spoilage — recoverable but real                  |
| `cosmetic`               | 4     | Looks worse, works fine                                            |
| `none`                   | 2     | Purely elective                                                    |

**`personaFit`** — does a named persona actually own this work? _Higher-is-better._

| Level                    | Score | Why                                                        |
| ------------------------ | ----- | ---------------------------------------------------------- |
| `named-owner-routine`    | 10    | Sits inside charl/lucky/irma/hans's standing scope         |
| `named-owner-occasional` | 8     | Clearly theirs, but not weekly                             |
| `shared`                 | 6     | Two or more personas; needs an explicit owner in the entry |
| `unassigned`             | 3     | Nobody currently does this                                 |
| `outside-estate-roles`   | 1     | Would require hiring for it                                |

**`assetCoverage`** — does the estate own the thing? _Higher-is-better._

| Level            | Score | Why                                             |
| ---------------- | ----- | ----------------------------------------------- |
| `owned-multiple` | 10    | Applies to several assets; one entry, many uses |
| `owned-single`   | 8     | One asset on site                               |
| `planned`        | 5     | Acquisition is on the roadmap                   |
| `not-owned`      | 1     | Speculative content                             |

**`repeatability`** — how stable the steps are across instances. _Higher-is-better._

| Level                  | Score | Why                                                               |
| ---------------------- | ----- | ----------------------------------------------------------------- |
| `deterministic`        | 10    | Identical every time — tyre pressures, mix ratios                 |
| `parameterised`        | 8     | Same steps, values vary by asset                                  |
| `diagnostic-branching` | 6     | A tree, not a line — authorable but longer                        |
| `case-by-case`         | 3     | Barely generalisable; likely belongs in per-task guidance instead |

**`retrievability`** — will `rankKnowledge` actually surface it? _Higher-is-better._ Scored on
distinct symptom phrases / keywords available, because `WEIGHTS.symptomPhrase` (5) dominates match
scoring and the default `minScore` is 3.

| Threshold (symptoms / keywords) | Score | Why                                                   |
| ------------------------------- | ----- | ----------------------------------------------------- |
| ≥8 / ≥10                        | 10    | Rich vocabulary; matches loose natural phrasing       |
| ≥5 / ≥8                         | 8     | Comfortably clears `minScore` on a single symptom hit |
| ≥3 / ≥5                         | 6     | Workable                                              |
| ≥1 / ≥3                         | 4     | Findable only by near-exact phrasing                  |

**`authoringEffort`** — hours to draft _and verify sources_. **Lower-is-better** (ascending table).

| Threshold | Score | Why                                    |
| --------- | ----- | -------------------------------------- |
| 2         | 10    | Single session                         |
| 4         | 8     | Half a day                             |
| 8         | 6     | Full day including source verification |
| 16        | 4     | Multi-day; needs its own task          |
| 32        | 2     | Effectively a project                  |

**`localeReach`** — bilingual reach. _Higher-is-better._ Seeds are English-first; Charl and Lucky are
the personas most likely to need Afrikaans.

| Level                  | Score | Why                                                    |
| ---------------------- | ----- | ------------------------------------------------------ |
| `both-locales-planned` | 10    | EN + AF authored together, as the copper-pipe seed was |
| `en-sufficient`        | 7     | Audience for this entry reads English                  |
| `af-gap`               | 3     | Primary persona needs AF and it is not planned         |

### 5.2 Weights and composite

```
recurrence          3    ─┐
costAvoided         3    ─┤ heavy drivers: use-frequency and rand value
consequenceOfDelay  2    ─┤
personaFit          2    ─┤ supporting: is it really ours to do?
assetCoverage       2    ─┘
repeatability       1
retrievability      1
authoringEffort     1
localeReach         1
                   ──
total weight       16
```

`composite = Σ(subScore × weight) / 16`, giving 0–10.

Missing facts fall back to a **neutral 5** (`NEUTRAL_SUBSCORE`), except `costAvoided` as noted.

### 5.3 Priority bands

| Composite | Tier   | Action                                              |
| --------- | ------ | --------------------------------------------------- |
| ≥ 7.5     | **P0** | Author now — next knowledge-base PR                 |
| 6.0 – 7.4 | **P1** | Author this quarter                                 |
| 4.5 – 5.9 | **P2** | Backlog; revisit when the asset or persona changes  |
| < 4.5     | —      | Decline. Record the score so it is not re-proposed. |

---

## 6. Tier 2 — Draft quality rubric

Applied to a written draft. Three-valued, matching `DOMAIN_SAFETY_QUALITY_DIMENSIONS`:
`clear` / `friction` / `failure`.

| Dimension                 | `clear` means                                                                                                   | `failure` means                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `evidence_classification` | Observed symptom and inferred cause are separated in the prose                                                  | The entry states a cause as fact from a symptom alone |
| `stop_rule_quality`       | `safety[]` is non-empty **and** ≥1 step carries a `warning` — i.e. `hasGuidanceSafetyBoundaries()` returns true | The helper returns false                              |
| `diagnosis_first`         | The first step confirms root cause before any irreversible action                                               | Step 1 modifies the asset                             |
| `check_per_step`          | Every action step has a `check` the persona can answer yes/no                                                   | Steps end without a verifiable state                  |
| `materials_specificity`   | Materials name size, grade, or spec ("closed-cell 15mm", not "insulation")                                      | Category nouns only                                   |
| `supplier_neutrality`     | ≥2 suppliers, or one with an explicit availability-only note                                                    | A single supplier reads as an endorsement             |
| `plain_language`          | Readable by the target persona; trade jargon defined on first use                                               | Requires trade knowledge the persona lacks            |
| `locale_parity`           | AF variant exists where §5.1 `localeReach` demanded it                                                          | AF persona, EN-only entry                             |
| `provenance`              | Derived entries carry `sourceRecipe*` / citations                                                               | Derived content with no source link                   |

**Disposition:** any `failure` → back to `draft` (cf. `revise_test_surface`). Any `not_tested` →
cannot publish (cf. `close_without_reliance`). All `clear`/`friction` → publishable.

`stop_rule_quality` is the one dimension already machine-checkable: `hasGuidanceSafetyBoundaries()`
in `lib/guidance.ts` is enforced on the authoring path (`app/api/guidance/route.ts:201`) and on the
Sluice path (`lib/integrations/sluice.ts:235`), but `app/api/knowledge/apply/route.ts:56` only
_reports_ it as a flag. Promoting that to enforcement is the smallest concrete follow-up from this
rubric.

---

## 7. Process catalogue for House of Veritas

Candidates by the five `KNOWLEDGE_DOMAINS`, with the Tier-0 outcome and an indicative Tier-1 band.
Tiers below are indicative pending per-entry scoring; §8 works three of them fully.

### maintenance — Charl, Hans

| Process                                                | Safeguard                                            | Tier        | Note                                                  |
| ------------------------------------------------------ | ---------------------------------------------------- | ----------- | ----------------------------------------------------- |
| Copper-pipe condensation → wall damp                   | pass                                                 | **shipped** | EN + AF in `seed.ts`                                  |
| Geyser drip tray, TP valve and vacuum breaker check    | pass                                                 | P0          | High consequence, annual-plus, cheap to verify        |
| Gutter and downpipe clearing before the rains          | pass                                                 | P0          | Seasonal, compounding-structural                      |
| Silicone reseal of shower / bath / sink junctions      | pass                                                 | P0          | Recurs, cheap, prevents damp                          |
| Blocked drain — plunger and rod, stop-before-chemicals | pass                                                 | P1          | Must branch to escalation on sewer mains              |
| Door and window seal replacement                       | pass                                                 | P1          | Deterministic, low value per run                      |
| Borehole / pressure-pump fault triage                  | pass                                                 | P1          | Compounding-asset; needs pump spec sourcing           |
| Interior repaint after damp remediation                | pass                                                 | P2          | Depends on the damp entry landing first               |
| **Consumer-unit / DB board work**                      | **fail** `statutory_competence`, `irreversible_harm` | `safety`    | Recognition + isolate + call a registered electrician |
| **Roof-sheet or tile replacement**                     | **fail** `irreversible_harm` (height)                | `safety`    | Ground-level inspection only                          |

### vehicle — Charl

| Process                                      | Safeguard                    | Tier     | Note                                                  |
| -------------------------------------------- | ---------------------------- | -------- | ----------------------------------------------------- |
| Tyre pressure, tread and spare check         | pass                         | P0       | Deterministic, fortnightly, safety-relevant           |
| Pre-trip lights, wipers and fluids checklist | pass                         | P0       | `checklist` kind; very low authoring effort           |
| Battery terminal clean and charge test       | pass                         | P1       | Compounding-asset                                     |
| Jump-starting safely                         | pass                         | P1       | Needs a firm stop rule on lithium / damaged batteries |
| Bakkie load securing                         | pass                         | P1       | Legal and safety relevant for estate transport        |
| Oil and filter service interval log          | pass                         | P2       | Logging belongs in the asset registry more than here  |
| **Brake or steering component work**         | **fail** `irreversible_harm` | `safety` | Recognition and stop only                             |

### garden — Lucky

| Process                                    | Safeguard                    | Tier     | Note                                                         |
| ------------------------------------------ | ---------------------------- | -------- | ------------------------------------------------------------ |
| Irrigation zone test and dripper repair    | pass                         | P0       | Recurs, cheap, AF variant needed                             |
| Mower service — blade, air filter, oil     | pass                         | P0       | Deterministic, compounding-asset                             |
| Compost heap build and turn schedule       | pass                         | P1       | Degrading consequence only                                   |
| Lawn feed and water budget by season       | pass                         | P1       | Parameterised; ties to the utility tracking module           |
| Pesticide / herbicide handling and storage | pass _if_ label-sourced      | P1       | `verifiable_ground_truth` hinges on citing the product label |
| **Tree felling and large-limb pruning**    | **fail** `irreversible_harm` | `safety` | Height + stored energy; arborist escalation                  |

### household — Irma

| Process                                     | Safeguard | Tier               | Note                                            |
| ------------------------------------------- | --------- | ------------------ | ----------------------------------------------- |
| Meal planning and pantry rotation           | pass      | **partly shipped** | `lib/recipe-guidance.ts` covers the recipe half |
| Allergy-safe substitution procedure         | pass      | P0                 | High consequence; must cite the allergen source |
| Fire extinguisher and blanket monthly check | pass      | P0                 | `checklist`; near-zero authoring effort         |
| First-aid kit inventory and expiry          | pass      | P0                 | Same                                            |
| Stain and laundry treatment by fabric       | pass      | P2                 | Low consequence, high variety                   |

### workshop — Charl

| Process                                           | Safeguard                                               | Tier        | Note                                    |
| ------------------------------------------------- | ------------------------------------------------------- | ----------- | --------------------------------------- |
| Concrete mix, pigment and casting                 | pass                                                    | **shipped** | `lib/concrete-mix-guidance.ts`          |
| Tool checkout, return and condition log           | pass                                                    | P0          | Feeds the equipment/loan module         |
| Timber cutting — measurement, support, PPE        | pass                                                    | P1          | Deterministic; PPE stop rules mandatory |
| Drill and bit selection by material               | pass                                                    | P2          | Reference-shaped; low consequence       |
| **Welding and hot work**                          | **fail** `irreversible_harm`                            | `safety`    | See §8.3                                |
| **Angle-grinder disc work**                       | **fail** `irreversible_harm`                            | `safety`    | Disc burst, kickback, sparks near fuel  |
| **Building or modifying mains-powered equipment** | **fail** `irreversible_harm`, `verifiable_ground_truth` | decline     | No safe entry exists; see §8.3          |

---

## 8. Worked examples

### 8.1 Copper-pipe condensation — the reference entry

Safeguards: all pass. `diagnosis_before_action` passes _because_ step 1 is the dry-and-watch test that
separates condensation from a leak, with the warning "Do not insulate or foam over the pipe until
this is answered". That step is precisely what the safeguard exists to require — insulating a leak hides
it and accelerates corrosion.

| Dimension          | Value                       | Sub   | ×w      |
| ------------------ | --------------------------- | ----- | ------- |
| recurrence         | ~4/yr seasonal              | 6     | 18      |
| costAvoided        | ~R900 plumber call-out      | 6     | 18      |
| consequenceOfDelay | compounding-structural      | 10    | 20      |
| personaFit         | named-owner-routine (charl) | 10    | 20      |
| assetCoverage      | owned-multiple              | 10    | 20      |
| repeatability      | diagnostic-branching        | 6     | 6       |
| retrievability     | 11 symptoms / 15 keywords   | 10    | 10      |
| authoringEffort    | ~8h incl. EN+AF             | 6     | 6       |
| localeReach        | both-locales-planned        | 10    | 10      |
|                    |                             | **Σ** | **128** |

`128 / 16 = 8.0` → **P0**. Consistent with it being the entry that shipped first.

### 8.2 Fire extinguisher monthly check — cheapest P0

Safeguards: all pass. Sub-scores: recurrence 8 (monthly), costAvoided 3 (unknown — no trade equivalent),
consequenceOfDelay 10, personaFit 8, assetCoverage 10, repeatability 10, retrievability 6,
authoringEffort 10, localeReach 10.

`(8·3 + 3·3 + 10·2 + 8·2 + 10·2 + 10 + 6 + 10 + 10) / 16 = 125/16 = 7.81` → **P0**.

Note how the unknown-cost penalty (3, not 5) costs it 0.375 and it _still_ clears P0 — the safety
consequence and near-zero authoring effort carry it. That is the rubric behaving correctly.

### 8.3 Welding — the safeguard case

Welding was raised directly in session as a candidate, in two forms. They resolve differently:

**"How to weld safely on the estate"** — fails `irreversible_harm`: arc flash causes permanent
retinal injury without correctly rated auto-darkening protection, and hot work near the workshop's
fuel and timber is a live fire risk. Disposition: publish as a **`safety` entry**, not a procedure —
recognition of hot-work conditions, mandatory PPE, a fire-watch rule, and escalation to a contracted
welder for anything structural.

**"How to build a DIY welder"** — fails `irreversible_harm` _and_ `verifiable_ground_truth`. The
common home-built designs rewind a microwave-oven transformer, which yields an unfused, unisolated,
unenclosed high-current source with lethal stored energy and no thermal protection. No citable
source establishes safe parameters for such a build, so there is nothing the rubric could ground an
entry in. Disposition: **decline**, and record it here so it is not re-proposed. The estate's
alternative is a certified entry-level inverter unit, which is a purchasing decision, not a
knowledge-base entry.

This is the rubric earning its keep: the same topic produces a published safety entry and a recorded
decline, rather than an argument.

### 8.4 "Which welder should the estate buy?" — the Tier-1 decline

The third form of the same topic, and the most instructive, because **it fails nowhere in Tier 0**.
Choosing what to purchase injures nobody: there is no statutory reservation on reading a spec sheet,
no irreversible harm, no unsourceable claim (manufacturer duty-cycle and amperage figures are
citable), no supplier steering if alternatives are listed neutrally, no PII. All six safeguards pass.

It declines on **worth**, not safety:

| Dimension          | Value                                   |   Sub |     ×w |
| ------------------ | --------------------------------------- | ----: | -----: |
| recurrence         | once per decade — below the table floor |     1 |      3 |
| costAvoided        | unknown; a purchase, not a saving       |     3 |      9 |
| consequenceOfDelay | none — not buying harms nothing         |     2 |      4 |
| personaFit         | shared (Charl operates, Hans budgets)   |     6 |     12 |
| assetCoverage      | not-owned                               |     1 |      2 |
| repeatability      | deterministic — a selection matrix      |    10 |     10 |
| retrievability     | not symptom-shaped; few phrases         |     4 |      4 |
| authoringEffort    | ~4h                                     |     8 |      8 |
| localeReach        | en-sufficient                           |     7 |      7 |
|                    |                                         | **Σ** | **59** |

`59 / 16 = 3.69` → **decline**. A deliberately generous re-read of every dimension (recurrence 2,
costAvoided 5, personaFit 8, assetCoverage 5, retrievability 6) still only reaches `82/16 = 5.13` —
P2 backlog, never P0. The verdict is stable, which is what makes it a good fixture.

**Why this is the case worth testing.** The three welding variants exercise three different code
paths that a naive implementation would collapse into one "reject":

| Candidate             | Tier 0            | Tier 1 | Disposition            |
| --------------------- | ----------------- | ------ | ---------------------- |
| How to weld safely    | 1 safeguard fails | n/a    | re-scope to `safety`   |
| How to build a welder | 2 safeguards fail | n/a    | decline (unsafe)       |
| Which welder to buy   | all pass          | 3.69   | decline (not worth it) |

"Declined because it would hurt someone" and "declined because it isn't worth authoring" must not
produce the same record — the first is permanent, the second should be revisited if the estate
actually buys a welder (`assetCoverage` moves `not-owned` → `owned-single`). Any implementation of
`evaluateKnowledgeCandidate()` that returns a bare boolean fails this fixture set.

**Gap this exposed.** `recurrence` has no floor band below `1`/yr, so a once-per-decade candidate
matches nothing and the sub-score is undefined. Deal Radar has exactly this construct —
`LAND_ERF_FLOOR = 3` catches erf sizes under the smallest band. Tier 1 needs the same: an explicit
`RECURRENCE_FLOOR` (proposed: **1**, since a task done less than annually is close to worthless to
document), and a floor for every other higher-is-better table. The `1` used above is that proposal,
not a derived value.

---

## 9. The data implementation

Shipped alongside this document:

1. **`lib/knowledge/rubrics.ts`** — every band table, floor, ordinal sub-score and weight from §5 as
   exported data, each threshold carrying its "why".
2. **`lib/knowledge/safeguards.ts`** — `KNOWLEDGE_PUBLICATION_SAFEGUARDS`, the profile model below, and
   `evaluateKnowledgeCandidate()` returning a disposition, structured like
   `evaluateDomainSafetyTrial()`.
3. **`tests/lib/knowledge-rubrics.test.ts`**, **`tests/lib/knowledge-safeguards.test.ts`** — 38 tests,
   including the §8 worked examples as executable fixtures.

4. **`lib/knowledge/safeguard-profile-events.ts`**, **`lib/repositories/knowledge-safeguard-profile-repository.ts`**,
   **`app/api/knowledge/safeguard-profiles/route.ts`**, **`app/dashboard/hans/knowledge-safeguards/page.tsx`** —
   the admin control plane described in §9.2.

5. **`lib/knowledge/publication.ts`**, `KnowledgeEntry.review`, and the safeguard check in
   `app/api/knowledge/apply/route.ts` — enforcement at both chokepoints, described in §9.3. This
   also closed the `hasGuidanceSafetyBoundaries()` gap: it is now a refusal, not a flag.

6. **Vocabulary.** These were originally called _gates_, which collided with two established senses
   in this repo — the Gate 0 / O1–O7 governance protocol, and `DOMAIN_SAFETY_CRITICAL_GATES` in the
   reviewer trial. They are now **safeguards** throughout: `KNOWLEDGE_PUBLICATION_SAFEGUARDS`,
   `lib/knowledge/safeguards.ts`, `/api/knowledge/safeguard-profiles`,
   `knowledge_safeguard_profile_events`. "Gate" in this document now refers only to Gate 0. The one
   place the old word survives is `trialGate`, which points _at_ the reviewer trial's gates and is
   meant to.

Still open:

7. Record the Tier-1 composite alongside the Tier-0 review, so authoring priority is auditable after
   the fact as well. `KnowledgeReview` is the obvious home now that it exists.
8. `GET /api/knowledge` serves published entries without re-checking them against the effective
   profile. It is safe transitively — an entry cannot be `published` without clearing its built-in
   safeguards — but an administrator _tightening_ a safeguard does not currently hide matching entries from
   search, only stop them being applied. Retrieval is sync and pure; making it profile-aware means
   making it async.

### 9.1 Safeguards are selectable per profile

Not every safeguard applies to every kind of entry — a recipe has no root cause to misdiagnose, and
cooking is not a statutorily reserved activity. A `KnowledgeSafeguardProfile` names the safeguards it switches
**off**; everything else runs.

| Profile            | Disables                                          | Rationale                                                        |
| ------------------ | ------------------------------------------------- | ---------------------------------------------------------------- |
| `strict` (default) | nothing                                           | Any `procedure` or `troubleshooting` entry                       |
| `household-recipe` | `statutory_competence`, `diagnosis_before_action` | Allergen safety and sourcing still safeguard — that is the point |
| `checklist`        | `diagnosis_before_action`                         | Inspect-and-record content transforms nothing                    |

`withSafeguardDisabled()` / `withSafeguardEnabled()` return new profiles rather than mutating, so a profile is
a value that can be stored, diffed and audited.

Three safety properties hold regardless of configuration, and each has a test:

- **Default-on, structurally.** A profile carries only a disable list, so there is no enable list to
  forget. A safeguard added later applies to every existing profile immediately.
- **Disabled ≠ passed.** A switched-off safeguard is recorded in `skippedSafeguards`, never folded into
  passes. An audit can always separate "checked and fine" from "never checked".
- **Missing ≠ passed.** A safeguard with no submitted result is `not_tested` and holds the candidate at
  `draft`. So is an explicit `not_applicable` — only the profile may waive a safeguard, not the submitter.

Disabling every safeguard does not manufacture an approval: Tier 0 becomes vacuous, but Tier 1 still
judges the candidate and all six skips are on the record.

### 9.2 The admin control plane

Profiles are durable records, not constants. An administrator changes them at
`/dashboard/hans/knowledge-safeguards`; the API is `GET`/`POST /api/knowledge/safeguard-profiles`, both behind
`withRole("admin")` enforced independently of UI visibility.

The storage model is the append-only event log already used by `gate_governance_events`: every
change carries an actor ID derived server-side, a required rationale, a monotonic version with
optimistic concurrency, and an idempotency key fingerprinted against the payload. Nothing is updated
in place, so "who turned this safeguard off, when, and why" is always answerable.

Knowledge profiles get their **own** collection, `knowledge_safeguard_profile_events`. Sharing
`gate_governance_events` would have meant putting an open-ended configuration lifecycle inside a
collection built for the bounded Gate 0 O1–O7 state machine, and forcing the Gate 0 projection to
filter foreign events.

Resolution order is stored record → built-in of the same id → `strict`.

**Two safeguards cannot be waived by anyone, including an administrator:**

| Safeguard                 | Why it is not a policy choice                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `data_boundary`           | POPIA. Embedding household PII is not something an operator may elect to allow.                                         |
| `verifiable_ground_truth` | It is what makes any entry safe to publish, including a `safety` entry. Waiving it leaves nothing to ground content in. |

The rule is enforced at three layers, which is what makes it an invariant of the system rather than a
property of one code path:

| Layer                                    | Covers               | Behaviour                                                                 |
| ---------------------------------------- | -------------------- | ------------------------------------------------------------------------- |
| `knowledgeSafeguardProfileRequestSchema` | API writes           | Rejects the request outright                                              |
| `resolveEffectiveProfile()`              | Reads from the store | Strips the safeguard, reports it; caller logs a datastore-integrity error |
| `isSafeguardEnabled()`                   | **Every** evaluation | A non-waivable safeguard is enabled whatever the profile says             |

Only the third sees a profile built in code or handed straight to the evaluator by a caller, so it is
the one that actually holds the line — the other two are defence in depth and give better errors.
`withSafeguardDisabled()` treats a non-waivable safeguard as a no-op for the same reason.

The remaining four safeguards are waivable with a recorded rationale.

**Outage behaviour differs by caller, deliberately.** The admin route fails closed with 503, matching
the governance route — you cannot record a decision you cannot durably store. But `loadEffectiveSafeguardProfile()`,
which content evaluation calls, never throws: it falls back to `strict` and reports
`profileSource: "builtin-fallback"`. Refusing to evaluate would not be safer, it would just move the
failure; running every safeguard is the strictest available answer. The source is recorded on every
evaluation so a configured relaxation silently reverting during an outage is visible rather than
mysterious.

The UI separates a **built-in waiver** (a recipe not needing an electrical licence) from an
**operator relaxation** (`relaxedBeyondBuiltin`), because those are different things to review.

### 9.3 Where the safeguards actually bite

There is no publication API. Entries live in `seed.ts` and are published by merging a PR, so the
safeguards are enforced at two chokepoints rather than one.

| Layer                                  | Profile used                    | Question it answers         | Failure mode                                          |
| -------------------------------------- | ------------------------------- | --------------------------- | ----------------------------------------------------- |
| Seed module load (`assertPublishable`) | built-in                        | "Should this have shipped?" | Seed throws on import — CI fails, the PR cannot merge |
| `POST /api/knowledge/apply`            | **effective** (administrator's) | "May it be used right now?" | `409` with the failed or untested safeguards named    |

The second layer is what makes the control plane worth having: tightening a safeguard stops entries being
turned into work immediately, with no deploy and no seed edit. The first stops an entry that never
cleared its safeguards from existing at all.

Safeguard results are judgements about content, not properties derivable from it, so they are **recorded**
on the entry as `KnowledgeReview` rather than computed. The schema refuses `status: "published"`
without one — that is the mechanism that makes a git-versioned seed enforceable.

`hasGuidanceSafetyBoundaries()` is enforced in the same check. It was previously computed at
`app/api/knowledge/apply/route.ts` and then only reported, which is the failure mode this whole
document exists to prevent: a safety signal that is measured and ignored.

### 9.4 Two deliberate divergences from the plan

- **The band helpers are duplicated, not imported.** §9 originally proposed reusing `ScoreBand` and
  `rands()` from `lib/services/radar/rubrics.ts`. Coupling the estate knowledge base to the property
  deal tool buys nothing and neither copy is complex enough to drift meaningfully. Extracting a
  shared `lib/scoring/bands.ts` is the follow-up if a third consumer appears.
- **`verifiable_ground_truth` declines rather than re-scopes.** Every other safeguard failure re-scopes
  the candidate into a `safety` entry. That one cannot: a safety entry makes claims too, so a topic
  with no citable ground truth has nothing to become. This is what separates §8.3's two welding
  cases in code.

## 10. Open questions

- **Is the statutory register accurate?** The `statutory_competence` safeguard names SANS 10142-1, SAQCC
  gas, and PIRB from the existing reviewer-trial vocabulary. That list should be confirmed by a
  competent person before it is relied on — this document is not legal advice, and a wrong safeguard here
  fails in the dangerous direction.
- **Does `costAvoided` distort toward trade-substitution content?** It weights 3, which may
  systematically under-rank household and garden processes where no trade equivalent exists. The
  fire-extinguisher example clears P0 anyway, but a second such case would justify re-weighting.
- **Where does per-task guidance end and curated knowledge begin?** `repeatability: case-by-case`
  scores 3 precisely to push one-off content into `lib/guidance` packs instead — but the boundary is
  asserted here, not agreed.
- **Are the band floor _values_ right?** Every table now has a floor (§9), which closes the crash
  case §8.4 found. But the values themselves are asserted, not derived — `RECURRENCE_FLOOR = 1` says
  a once-per-decade task is worth almost nothing to document, which is a judgement no evidence backs
  yet.
- **Should a Tier-1 decline expire?** A safeguard decline is permanent; a worth-based decline is a
  snapshot of what the estate owns and does today. §8.4 declines "which welder to buy" partly on
  `assetCoverage: not-owned` — which changes the moment one is bought. Declines probably need a
  recorded re-evaluation trigger, not just a recorded score.
