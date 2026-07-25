# Kitchen recipe catalog completion

Date: 2026-07-25
Baton task: `22fd1b92-c65a-4e94-8785-4ba94ad9b88b`
Branch: `codex/complete-recipe-catalog`

## Outcome

The recipe catalog and meal-feedback surface left behind after PR #124 is now
completed on a fresh `origin/main` branch. PR #124 merged only through commit
`f76f742`; commit `98f36c8`, added to the old branch after that merge, never
reached `main`.

This continuation restores and hardens that missing work:

- Hans and Irma receive persona-specific recipe navigation and a mobile-friendly
  bilingual catalog/detail route.
- Recipe cards and details include structured ingredients, ordered steps,
  timing, reusable-image source, license, and attribution metadata.
- Hans/admin can explicitly seed reviewed sample recipes and create meal/rating
  tasks; sample data is not loaded automatically.
- Assigned residents can view their served meal history and submit a rating.
- Non-admin meal responses expose only the current user's assignment identifier
  and rating-task count, not co-resident assignment details or comments.
- Missing recipe storage produces a clean empty read state; writes still fail
  explicitly and never fall back to local production persistence.
- Meal-history load failures are visible in the UI instead of being silently
  converted to an empty list.

## Files

- `app/api/recipes/[id]/meals/route.ts`
- `app/dashboard/[persona]/recipes/page.tsx`
- `components/recipes/recipe-catalog-client.tsx`
- `lib/nav-config.ts`
- `lib/recipes.ts`
- `lib/repositories/recipe-repository.ts`
- `tests/api/recipe-meals.test.ts`
- `tests/lib/recipe-repository.test.ts`

## Verification

- `pnpm exec tsc --noEmit`
- `pnpm run lint`
- `pnpm test -- tests/api/recipe-meals.test.ts tests/lib/recipe-repository.test.ts`
- `pnpm test`
- `pnpm run build`
- Authenticated local production browser checks:
  - Hans/admin route and Recipes navigation render the clean empty state.
  - Irma/resident route and Recipes navigation render without admin controls.
  - A routed browser fixture renders bilingual title/summary, reusable-image
    metadata, ingredient checklist, ordered steps, timer, and resident-only
    serving controls.

The browser console retained the pre-existing
`/api/projects?type=scope` 500 when Mongo is unconfigured. The recipe API itself
returned its expected empty state after the repository-mode fix.

## Residual checks

- CI must repeat lint, unit tests, production build, E2E, and pipeline summary.
- Production behavior should be smoke-tested with an authenticated Hans and
  Irma session against the configured Cosmos recipe collections after merge.
- Do not seed sample recipes in production unless the owner explicitly chooses
  that content and verifies its image licenses and translations.
