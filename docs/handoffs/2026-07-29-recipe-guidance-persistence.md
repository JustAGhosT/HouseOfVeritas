# Recipe guidance persistence and migration handoff

- **Date:** 2026-07-29
- **Repository:** `C:\Users\smitj\repos\house-of-veritas`
- **Worktree:** `C:\tmp\hov-recipe-guidance-persistence`
- **Branch:** `feat/recipe-guidance-persistence`
- **Base:** `origin/main` at `686d4954c069d2f2b5aa934e6b7e9e3624d885c8`
- **Predecessor:** PR [#156](https://github.com/neuralliquid/house-of-veritas/pull/156)
- **Baton task:** `3a36dc41-3376-441a-a11d-f2b5bef648c4`
- **Risk tier:** API/data workflow; no production migration or deployment

## Decision

Use a dedicated `recipe_guidance_documents` collection behind a recipe-guidance repository.
Do not extend `task_guidance` with the richer aggregate.

`GuidancePack` remains the compact task attachment/read model. `RecipeGuidanceDocument` has a
different lifecycle and stronger invariants: immutable recipe revision manifests, canonical
section ordering, image briefs, media provenance, review gates, and publishable versions. A
separate collection keeps both contracts narrow, allows independent indexes, and permits rollback
without rewriting existing task bindings.

## Implemented boundary

- Added memory, explicit-demo file, and Mongo implementations behind one repository contract.
- Added unique Mongo indexes for document identity and `(recipeId, version)`, plus the published
  version lookup index.
- Schema-validates every stored read and write and strips Mongo `_id` fields.
- Uses `updatedAt` optimistic concurrency for mutable versions.
- Requires `updatedAt` to advance on every replacement and serializes explicit-demo file mutations
  across their complete read/check/write sequence.
- Requires new versions to begin as drafts. Rejects duplicate versions, immutable identity changes,
  recipe-manifest changes, direct draft-to-published transitions, published-content changes, and
  archived-version changes.
- Keeps tests/E2E empty by default and requires `ALLOW_DEMO_DATA=true` before local JSON persistence
  is available without Mongo. The flag enables storage, not seed content.

## Migration strategy

Migration is inventory and rebuild first, not an in-place collection rewrite:

1. Read legacy recipe-backed `GuidancePack` records without changing `task_guidance` or bindings.
2. Reject incoherent source/draft recipe provenance, missing recipes, and stale recipe snapshots.
3. Skip recipe revisions already present in `recipe_guidance_documents`.
4. Select only one rebuild candidate for each recipe revision; classify other matching legacy packs
   as `duplicate_legacy_revision`.
5. Mark the selected coherent record `rebuild_from_recipe_required` so a later authorized runner can
   build the canonical nine-section draft from the recipe and route it through human review.
6. Never copy a legacy `published` status into the richer document or infer missing review/media
   evidence.

The planner always returns `writesAuthorized: false`. No production inventory, migration, or write
was run in this slice.

## Changed files

- `lib/repositories/recipe-guidance-repository.ts`
- `lib/recipe-guidance-migration.ts`
- `tests/lib/recipe-guidance-repository.test.ts`
- `tests/lib/recipe-guidance-migration.test.ts`
- `docs/05-project/task-guidance-architecture.md`
- `docs/04-configuration/05-persistence-env.md`
- `docs/handoffs/2026-07-29-recipe-guidance-persistence.md`
- `docs/README.md`

## Verification

Passed before final closeout:

```text
pnpm exec prettier --check <four new TypeScript files>
pnpm exec vitest run tests/lib/recipe-guidance-repository.test.ts tests/lib/recipe-guidance-migration.test.ts tests/lib/recipe-guidance.test.ts
pnpm exec tsc --noEmit
pnpm run lint
```

- Focused result after the final manifest-immutability remediation: 3 files, 43 tests passed.
- The first worktree dependency install timed out and left partial links. Those generated links were
  replaced with a local junction to the primary checkout's lockfile-matching `node_modules`; no
  package or lockfile changed.
- `pnpm run build` could not complete under that junction. Turbopack rejected the external dependency
  junction before compilation. The webpack fallback compiled successfully, then failed on generated
  types for unchanged `app/api/ai/refine-description/route.ts`; the route has no feature diff. Treat
  this as a local tooling/pre-existing route-contract warning and rely on exact-head CI for the
  canonical production-build gate.
- Review remediation added regression coverage for reused/stale concurrency tokens, concurrent
  demo-file mutations, Mongo duplicate and zero-match conflicts, invalid Mongo documents, and
  duplicate legacy packs for one recipe revision.

## Next slice

Build the deterministic canonical draft builder and preview/read API against this repository. Keep
Sluice generation, bulk migration apply, public publishing, OmniPost, and deployment out of scope.
Any future migration apply must require explicit authorization, record per-item outcomes, be
idempotent, and preserve the legacy records until acceptance is complete.

## Trace envelope

- **Task:** `3a36dc41-3376-441a-a11d-f2b5bef648c4`
- **Routing:** Veritas Ledger/data persistence, Shield/fail-closed provenance, Proof/tests
- **Gates:** focused tests, TypeScript, formatting, lint; build warning recorded above
- **External effects:** Baton task/relation only; no database, Sluice, deployment, or production writes
