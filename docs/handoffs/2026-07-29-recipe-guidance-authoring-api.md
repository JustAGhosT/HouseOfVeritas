# Recipe guidance draft creation and section authoring API handoff

- **Date:** 2026-07-29
- **Repository:** `C:\Users\smitj\repos\house-of-veritas`
- **Worktree:** `C:\tmp\hov-recipe-guidance-authoring-api`
- **Branch:** `feat/recipe-guidance-authoring-api`
- **Base:** `origin/main` at `be1e13fc83b37d3eb761c36c049189a8337aed58`
- **Predecessor:** PR [#158](https://github.com/neuralliquid/house-of-veritas/pull/158)
- **Baton task:** `618c898e-b945-4dbe-8551-9a62727aaf0e`
- **Risk tier:** API/data/auth workflow; bounded admin authoring only

## Outcome

Added the explicit persistence and reviewed-section authoring surfaces after the deterministic
preview/read slice.

- `POST /api/recipes/:id/guidance-drafts` builds and persists the next deterministic version.
- Concurrent next-version creation returns a refreshable conflict through the repository's unique
  version constraint.
- `PATCH /api/recipes/:id/guidance-drafts/:version` replaces one section in a draft or in-review
  document while preserving the section's stable ID.
- Patch requests require `expectedUpdatedAt`; successful replacements advance `updatedAt` and use
  the repository compare-and-swap contract.
- Updated text must be explicitly marked `reviewed`; recipe-sourced text is rejected by this human
  authoring endpoint.
- The complete document is schema-validated before persistence, so foreign recipe references,
  duplicate IDs, invalid media links, and other cross-aggregate violations fail closed.
- A draft whose immutable recipe revision is no longer current cannot be edited; the author must
  create a new version from the current recipe.
- Both write surfaces are admin-only and authorization runs before recipe or draft state is read.

## Changed files

- `app/api/recipes/[id]/guidance-drafts/route.ts`
- `app/api/recipes/[id]/guidance-drafts/[version]/route.ts`
- `tests/api/recipe-guidance.test.ts`
- `docs/05-project/task-guidance-architecture.md`
- `docs/handoffs/2026-07-29-recipe-guidance-authoring-api.md`
- `docs/README.md`

## Verification

Passed locally:

```text
pnpm exec vitest run tests/api/recipe-guidance.test.ts tests/lib/recipe-guidance.test.ts tests/lib/recipe-guidance-repository.test.ts tests/lib/recipe-guidance-builder.test.ts
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
pnpm exec prettier --check <changed TypeScript and Markdown files>
git diff --check
```

- Focused result: 4 files, 59 tests passed.
- TypeScript, full repository lint, Prettier, and diff checks passed.
- Production build passed with all 125 routes generated, including the new versioned draft route.
- Browser verification is not applicable because this slice adds no page or interactive UI.
- Exact-head CI and review remain required before merge.

## Residual boundary and next slice

This slice does not transition a document into review, record document-level review evidence,
publish or archive a version, create or approve image briefs, call Sluice, apply migrations, create
public packages, invoke OmniPost, or deploy. The next bounded slice can add explicit review-state
transitions and publication completeness gates, or build the text-first author/reader UI against
the current contracts.

## Trace envelope

- **Task:** `618c898e-b945-4dbe-8551-9a62727aaf0e`
- **Routing:** Veritas Gateway/routes, Ledger/data, Shield/auth, Proof/verification,
  Journey/Compass workflow
- **External effects:** Baton and GitHub workflow only; no provider, publication, migration, or
  deploy effects
