# Recipe guidance authoring and reader UI handoff

- **Date:** 2026-07-31
- **Repository:** `C:\Users\smitj\repos\house-of-veritas`
- **Worktree:** `C:\tmp\hov-recipe-guidance-ui`
- **Branch:** `feat/recipe-guidance-ui`
- **Base:** `origin/main` at `58ae371e195a1a864d8a0ab5a6e405fc62e474fa`
- **Predecessor:** PR [#160](https://github.com/neuralliquid/house-of-veritas/pull/160)
- **Baton task:** `ba705f21-05af-49ca-971c-48605bfd120f`
- **Risk tier:** API/data/UI workflow; internal recipe lifecycle and audience-authorized read only

## Outcome

Added the text-first clients for the stable recipe-guidance lifecycle.

- Hans's existing Recipes route now includes an admin review workspace.
- The workspace previews the next deterministic version without persistence, creates drafts
  explicitly, lists stored versions, and renders the selected version.
- Bilingual section edits preserve server-owned section IDs and canonical reference blocks. Saved
  text is marked human-reviewed and every mutation sends `expectedUpdatedAt`.
- Review-required media can be approved with bilingual alt text or rejected with a reason.
- Readiness blockers come directly from the server. Review confirmation, optional-media waivers,
  submit, approve, publish, and archive actions use the existing lifecycle endpoints.
- A `409` reloads the current documents and tells the user to review before retrying.
- Irma's Recipes route requests the latest audience-authorized published guidance and renders a
  mobile bilingual document with ingredient checkboxes, ordered canonical steps, timers, notices,
  approved media, attribution, and published-revision status.
- Missing published guidance leaves the canonical recipe visible. Datastore and revision failures
  remain explicit and retryable.
- A schema-valid published browser fixture exercises the UI without seeding demo or production data.

## Changed files

- `components/recipes/recipe-catalog-client.tsx`
- `components/recipes/recipe-guidance-workspace.tsx`
- `components/recipes/recipe-guidance-document-view.tsx`
- `components/recipes/published-recipe-guidance.tsx`
- `tests/components/recipe-guidance-ui.test.tsx`
- `tests/fixtures/recipe-guidance/ui-flow.json`
- `docs/05-project/task-guidance-architecture.md`
- `docs/handoffs/2026-07-31-recipe-guidance-ui.md`
- `docs/README.md`

## Verification

Passed locally:

```text
pnpm exec vitest run tests/components/recipe-guidance-ui.test.tsx tests/api/recipe-guidance.test.ts tests/lib/recipe-guidance.test.ts tests/lib/recipe-guidance-repository.test.ts tests/lib/recipe-guidance-builder.test.ts tests/lib/recipe-mutation-lock.test.ts
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
pnpm exec prettier --check <changed TypeScript, JSON, and Markdown files>
git diff --check
```

- Focused result: 6 files, 85 tests passed.
- TypeScript, full repository lint, and production build passed.
- Build generated all 125 routes.
- Playwright CLI used local synthetic Auth.js sessions and intercepted fixture responses:
  - Hans desktop showed the review workspace, empty version state, preview/create actions, and an
    explicit non-persisted preview after interaction.
  - Irma mobile showed published bilingual guidance, ingredient checklist, canonical step, timer,
    and published-revision marker.
  - Both final browser sessions had zero console errors or warnings.
- Screenshots are retained in ignored local artifacts:
  - `output/playwright/hans-recipe-guidance-workspace.png`
  - `output/playwright/irma-published-recipe-mobile.png`

## Boundaries and next slice

No deployment, production-data write, migration apply, recipe seed, demo-data enablement,
uploaded-media intake, media planning, Sluice/provider call, image generation, public package,
OmniPost action, or authentic production acceptance was performed.

The next bounded slice is authenticated uploaded-media intake and deterministic media planning for
recipe guidance, including rights metadata and storage provenance. Keep Sluice-backed generation
disabled until its separate capability, governance, and fail-closed contracts are proven.

## Trace envelope

- **Task:** `ba705f21-05af-49ca-971c-48605bfd120f`
- **Routing:** Veritas Surface/Studio UI, Gateway lifecycle contracts, Ledger data boundary,
  Shield authorization, Proof tests/browser verification, Journey/Compass workflow
- **Context retained:** stable UI/API contracts, browser fixture, architecture boundary, this
  handoff
- **Context discarded:** local Auth.js test cookies, intercepted runtime routes, Playwright CLI
  session logs
- **External effects:** Baton task creation/update only; no deployment, provider, or data effect
