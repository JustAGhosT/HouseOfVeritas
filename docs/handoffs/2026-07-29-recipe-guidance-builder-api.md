# Recipe guidance deterministic builder and read API handoff

- **Date:** 2026-07-29
- **Repository:** `C:\Users\smitj\repos\house-of-veritas`
- **Worktree:** `C:\tmp\hov-recipe-guidance-builder-api`
- **Branch:** `feat/recipe-guidance-builder-api`
- **Base:** `origin/main` at `4375160b66ac9bece1229413fe77d51c0ccd2869`
- **Predecessor:** PR [#157](https://github.com/neuralliquid/house-of-veritas/pull/157)
- **Baton task:** `35ee0bfe-73bf-4d43-b689-320fd1cfc83e`
- **Risk tier:** API/data workflow; read and non-persisting preview only

## Outcome

Added the deterministic bridge from canonical `RecipeRecord` snapshots to versioned
`RecipeGuidanceDocument` drafts and exposed bounded preview/read surfaces.

- Builds the fixed nine-section order with stable IDs for an explicit version and timestamp.
- Preserves immutable recipe revision, ingredient, and ordered step manifests.
- Carries title and summary in both languages as recipe-sourced text requiring later human review.
- Converts recipe step timers to structured seconds without changing their meaning.
- Keeps licensed hero media review-required and creates no image briefs or generated-media claims.
- Rejects recipes without canonical ingredients or steps and schema-validates the completed draft.
- Lists stored draft versions for admins without mutating them.
- Produces an admin-only preview of the next version and explicitly reports `persisted: false`.
- Returns only the latest published guidance to authorized recipe/document audience members.
- Includes the authorized recipe snapshot beside reference-based documents for deterministic
  rendering, and fails closed if that snapshot no longer matches the published document revision.

## Changed files

- `lib/recipe-guidance-builder.ts`
- `app/api/recipes/[id]/guidance-drafts/route.ts`
- `app/api/recipes/[id]/guidance-drafts/preview/route.ts`
- `app/api/recipes/[id]/guidance/route.ts`
- `tests/lib/recipe-guidance-builder.test.ts`
- `tests/api/recipe-guidance.test.ts`
- `docs/05-project/task-guidance-architecture.md`
- `docs/handoffs/2026-07-29-recipe-guidance-builder-api.md`
- `docs/README.md`

## Verification

Passed locally:

```text
pnpm exec vitest run tests/lib/recipe-guidance-builder.test.ts tests/api/recipe-guidance.test.ts tests/lib/recipe-guidance.test.ts tests/lib/recipe-guidance-repository.test.ts
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
pnpm exec prettier --check <changed TypeScript and Markdown files>
git diff --check
```

- Focused result after review remediation: 4 files, 51 tests passed.
- Production build passed with all 125 routes generated, including the three new recipe-guidance
  routes.
- Exact-head review remediation rejects a published read when only a newer recipe revision is
  available, preventing immutable ingredient and step references from resolving against changed
  facts.
- Zero-minute recipe values are treated as no timer so valid recipes do not produce an invalid
  guidance timer.
- Browser verification is not applicable because this slice adds no page or interactive UI.
- Exact-head CI remains required before merge.

## Residual boundary and next slice

No preview is persisted. No authoring update, review transition, publication, migration apply,
Sluice request, public package, OmniPost action, or deployment is implemented. The next bounded
slice can add explicit draft creation and reviewed section updates with optimistic concurrency, or
build the text-first author/reader rendering against these read contracts.

## Trace envelope

- **Task:** `35ee0bfe-73bf-4d43-b689-320fd1cfc83e`
- **Routing:** Veritas Ledger/data, Gateway/routes, Journey/Compass workflow, Proof/verification
- **External effects:** Baton and GitHub workflow only; no data, provider, publication, or deploy
  effects
