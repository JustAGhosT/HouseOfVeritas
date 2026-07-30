# Recipe guidance review and publication lifecycle handoff

- **Date:** 2026-07-29
- **Repository:** `C:\Users\smitj\repos\house-of-veritas`
- **Worktree:** `C:\tmp\hov-recipe-guidance-lifecycle`
- **Branch:** `feat/recipe-guidance-lifecycle`
- **Base:** `origin/main` at `eaeb96f0e217f8285d68b53849bf95079e972f3f`
- **Predecessor:** PR [#159](https://github.com/neuralliquid/house-of-veritas/pull/159)
- **Baton task:** `4d87956b-9f04-4795-b896-5e9db54007aa`
- **Risk tier:** API/data/auth workflow; internal recipe lifecycle only

## Outcome

Added a fail-closed lifecycle around the versioned recipe-guidance documents.

- `POST /api/recipes/:id/guidance-drafts/:version/transitions` supports explicit
  `submit_for_review`, `approve_review`, `publish`, and `archive` actions.
- Every transition is admin-only, validates the current immutable recipe revision where applicable,
  and uses `expectedUpdatedAt` compare-and-swap persistence.
- Review approval records the authenticated reviewer and time plus explicit confirmation of
  bilingual content, allergens/food safety, provenance/rights, and named optional-media waivers.
- `GET /api/recipes/:id/guidance-drafts/:version/publication-readiness` reports deterministic
  blockers without changing state.
- Publication requires reviewed publishable blocks, complete canonical ingredient/step coverage,
  terminal media states, approved referenced media, explicit waivers for unavailable optional
  media, and complete review evidence.
- Editing a section after approval clears document-level review evidence so the changed version
  must be reviewed again.
- The repository rejects backward `in_review -> draft` movement. Published content remains
  immutable and may only be archived without content changes; archived content stays immutable.
- Recipe edits and publication share a fail-fast, per-recipe mutation lock. Live Mongo stores a
  persistent owner record in `recipe_mutation_locks`; there is no automatic timeout takeover while
  a target write may still be in flight. Confirmed success releases the owner token, while an
  ambiguous target-write failure deliberately retains it for operator recovery after the original
  writer is proven stopped. This Cosmos-compatible fail-closed policy closes the cross-collection
  recipe-revision and stalled-write cases without unsupported cross-collection transactions. A
  failed owner-scoped release is surfaced as an error; the evidence and recovery procedure is in
  `docs/03-deployment/recipe-mutation-lock-recovery.md`.
- Existing audience-authorized reads continue to return only the latest published version.

## Changed files

- `app/api/recipes/[id]/guidance-drafts/[version]/route.ts`
- `app/api/recipes/[id]/guidance-drafts/[version]/publication-readiness/route.ts`
- `app/api/recipes/[id]/guidance-drafts/[version]/transitions/route.ts`
- `app/api/recipes/[id]/route.ts`
- `lib/recipe-guidance.ts`
- `lib/repositories/recipe-guidance-repository.ts`
- `lib/repositories/recipe-mutation-lock.ts`
- `lib/repositories/recipe-repository.ts`
- `tests/api/recipe-guidance.test.ts`
- `tests/lib/recipe-guidance.test.ts`
- `tests/lib/recipe-guidance-repository.test.ts`
- `tests/lib/recipe-mutation-lock.test.ts`
- `docs/05-project/task-guidance-architecture.md`
- `docs/03-deployment/recipe-mutation-lock-recovery.md`
- `docs/handoffs/2026-07-29-recipe-guidance-lifecycle.md`
- `docs/README.md`

## Verification

Passed locally:

```text
pnpm exec vitest run tests/api/recipe-guidance.test.ts tests/lib/recipe-guidance.test.ts tests/lib/recipe-guidance-repository.test.ts tests/lib/recipe-guidance-builder.test.ts tests/lib/recipe-mutation-lock.test.ts
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
pnpm exec prettier --check <changed TypeScript and Markdown files>
git diff --check
```

- Focused result: 5 files, 77 tests passed.
- TypeScript, full repository lint, and production build passed.
- Build generated all 125 routes, including the readiness and transition routes.
- Browser verification is not applicable because this slice adds no page or interactive UI.

## Boundaries and next slice

No deployment, production-data write, migration apply, Sluice/provider call, image generation,
public package, OmniPost action, or browser acceptance was performed.

The next bounded slice is the text-first Hans authoring/review/preview UI and Irma mobile reader
against these stable lifecycle contracts. Media planning and licensed/uploaded media review can
follow without pretending the separate Sluice image-generation capability is available.

## Trace envelope

- **Task:** `4d87956b-9f04-4795-b896-5e9db54007aa`
- **Routing:** Veritas Gateway/routes, Ledger/data, Shield/auth, Proof/verification,
  Journey/Compass workflow
- **Files inspected:** project instructions, security/testing/TypeScript/Next.js rules, recipe
  guidance contracts, repository, authoring/read routes, focused tests, architecture, and prior
  handoffs
- **External effects:** Baton task creation/update only; no runtime, provider, deployment, or
  production-data effect
