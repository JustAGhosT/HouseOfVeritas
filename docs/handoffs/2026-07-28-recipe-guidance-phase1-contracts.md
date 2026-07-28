# Recipe guidance Phase 1 contracts handoff

- **Date:** 2026-07-28
- **Repository:** `C:\Users\smitj\repos\house-of-veritas`
- **Worktree:** `C:\tmp\hov-recipe-guidance-phase1`
- **Branch:** `feat/recipe-guidance-phase1`
- **Base:** `origin/main` at `fcc959ef1716f4ac88f5eace7fa6314392470873`
- **Source plan:** PR [#155](https://github.com/neuralliquid/house-of-veritas/pull/155)
- **Baton task:** `72faced1-f208-4fec-84e5-c3a1275d6223`
- **Risk tier:** isolated recipe/guidance data contracts; no API, persistence, UI, provider, or deployment change

## Outcome

This is the first bounded implementation slice from the recipe guidance plan. It establishes the
typed and schema-validated contracts needed before persistence or UI work begins:

- the canonical nine-section recipe document order and typed board blocks;
- document draft, review, publish, and archive states;
- image brief and media lifecycle states, with bilingual alt text required only at approval;
- a document-level invariant that generated media references an approved brief with the same section
  and role throughout its lifecycle, including rejected and unavailable terminal states;
- an approved matching brief before media can enter the cost-bearing requested state;
- licensed, uploaded, and generated provenance shapes;
- external media locations and HOV-managed media with an internal storage ID, internal application
  path, and immutable SHA-256 identifier, with complete HTTP(S) URL validation for external media;
- a fail-closed rule that generated media cannot be approved until copied into HOV storage;
- structured exact, range, and seconds-based timers;
- an explicit immutable recipe revision ID on documents, ingredient references, step references, and
  adapted shared-guidance source fields, derived from the source recipe ID and update timestamp;
- document-internal section, image-brief, media-asset, and media-block reference validation;
- same-section ownership for media blocks and publication gates for review metadata, required-section
  section-appropriate substantive content, approved referenced media, and terminal asset states;
- non-bypassable identity, ingredients, and cooking content at publication even if applicability is
  changed;
- rejection of every unreviewed or section-inappropriate populated block at publication;
- published identity metrics and step-media references in preparation/cooking sections;
- tuple-level immutable recipe provenance validation for shared guidance drafts and sourced steps;
- alt text forbidden before media approval, keeping unreviewed descriptions out of durable assets;
- a truthful adapter for legacy hero images that preserves attribution while marking them
  `review_required` instead of fabricating alt text or approval, including normalization of accepted
  relative image paths; and
- stable source recipe, ingredient, and step references in `recipeToGuidanceDraft()`.

No Sluice request is possible through this slice. It does not add routes, persistence, migrations,
uploads, authoring UI, reader UI, public packages, OmniPost handoff, demo data, or deployment.

## Changed files

- `lib/recipe-guidance.ts`
- `lib/guidance.ts`
- `tests/lib/recipe-guidance.test.ts`
- `tests/lib/guidance.test.ts`
- `docs/handoffs/2026-07-28-recipe-guidance-phase1-contracts.md`
- `docs/README.md`

## Verification

Passed:

```text
pnpm exec tsc --noEmit
pnpm run lint
pnpm test -- tests/lib/guidance.test.ts tests/lib/recipe-guidance.test.ts
pnpm run build
pnpm exec prettier --check lib/recipe-guidance.ts lib/guidance.ts tests/lib/recipe-guidance.test.ts tests/lib/guidance.test.ts
git diff --check
```

- Focused result at the latest review-fix head: 2 files, 25 tests passed.
- Production build completed and generated 125 routes/pages.
- No browser check was required because no route, component, or interaction changed.

The complete `pnpm test` run reached 76 passing files and 433 passing tests, with two failures in the
unchanged `tests/lib/deployment-workflow-contract.test.ts`. On Windows, its LF-only job-boundary
split captures later workflow jobs and therefore sees their legitimate `actions/checkout` steps.
Shortest replay:

```text
pnpm test -- tests/lib/deployment-workflow-contract.test.ts
```

The feature diff does not touch that test or either deployment workflow. Keep this warning separate
from recipe implementation unless a CI-contract maintenance task explicitly takes ownership.

## Next slice

Phase 1 can continue with a repository and migration strategy for versioned recipe guidance
documents and media assets. Before adding writes, decide whether the existing Mongo guidance
collection is extended or recipe guidance receives its own collection, then cover empty, live, and
explicit-demo modes. Sluice generation remains disabled until the separate cross-repo capability
contract and rights/cost gates are proven.

## Trace envelope

- **Task:** `72faced1-f208-4fec-84e5-c3a1275d6223`
- **Routing:** Veritas Compass/recipe workflow, Ledger/data contracts, Shield/privacy boundaries,
  Proof/validation
- **Files inspected:** `CLAUDE.md`, `AGENT_TEAMS.md`, relevant `.claude/rules/`, existing recipe,
  guidance, repositories, tests, PR #155 plan/reviews, and Baton task state
- **Gates passed:** focused tests, TypeScript, lint, formatting, build, diff check
- **Gate warning:** unrelated Windows workflow-contract parser, exact replay above
- **Context retained:** schema invariants and residual cross-repo decisions in the source plan and
  this handoff; dependency-install output and transient build artifacts intentionally discarded
