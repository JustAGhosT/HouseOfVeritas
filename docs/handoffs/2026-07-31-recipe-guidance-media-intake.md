# Recipe guidance media intake and planning handoff

- **Date:** 2026-07-31
- **Repository:** `C:\Users\smitj\repos\house-of-veritas`
- **Worktree:** `C:\tmp\hov-recipe-guidance-media-intake`
- **Branch:** `feat/recipe-guidance-media-intake`
- **Base:** `origin/main` at `d1e4e3498e2ba954d51194b5718004a712437c42`
- **Predecessor:** PR [#161](https://github.com/neuralliquid/house-of-veritas/pull/161)
- **Baton task:** `2853ec21-dfd7-4e54-91c9-4e5c09871b2c`
- **Risk tier:** API/data/UI workflow; authenticated private uploads and draft aggregate mutations

## Outcome

- Recipe-guidance upload mutation/listing is admin-only, bound to one canonical recipe, and excluded
  from generic upload listings. Audience reads fail closed unless the upload is an approved,
  referenced asset in the latest revision-matching published guidance.
- Deterministic planning creates missing bilingual draft image briefs, planned media assets, and
  section references without calling Sluice or another provider.
- Hans can upload or select a private recipe image, choose a planned/replaceable slot, record rights
  basis and attribution, and attach it for review.
- Attachment derives uploader/time from stored metadata, hashes the stored bytes, records an HOV
  storage ID/internal URL, preserves the optional image brief, restores a missing reference, and
  enters `review_required`.
- Cross-recipe, non-image, missing-content, invalid-rights, unauthorized, approved-replacement, and
  stale-CAS paths fail closed.

## Changed files

- `lib/recipe-guidance-media.ts`
- `lib/recipe-guidance.ts`
- `lib/uploads.ts`
- `app/api/uploads/route.ts`
- `app/api/uploads/[id]/route.ts`
- `app/api/recipes/[id]/guidance-drafts/[version]/route.ts`
- `components/recipes/recipe-guidance-media-intake.tsx`
- `components/recipes/recipe-guidance-workspace.tsx`
- `tests/lib/recipe-guidance-media.test.ts`
- `tests/api/recipe-guidance.test.ts`
- `tests/api/uploads.test.ts`
- `tests/components/recipe-guidance-ui.test.tsx`
- `docs/05-project/task-guidance-architecture.md`
- `docs/handoffs/2026-07-31-recipe-guidance-media-intake.md`
- `docs/README.md`

## Verification

Completed before PR publication:

```text
pnpm test -- tests/lib/recipe-guidance-media.test.ts tests/api/recipe-guidance.test.ts tests/api/uploads.test.ts tests/components/recipe-guidance-ui.test.tsx tests/lib/recipe-guidance.test.ts tests/lib/recipe-guidance-repository.test.ts
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
pnpm exec prettier --check <changed TypeScript and Markdown files>
git diff --check
```

- Focused Vitest replay: 6 files, 87 tests passed.
- TypeScript, lint, and production build passed; the build emitted 125 routes.
- An authenticated Chromium replay against the local production build passed with retries and trace
  disabled. It proved five-slot deterministic planning, private-upload selection,
  rights/attribution gating, and the attachment request. No application console warning/error or
  failing API response occurred. Screenshot: `output/playwright/recipe-guidance-media-intake.png`.
- The browser used fixture-intercepted recipe, upload, and draft responses; it did not write
  repository, production, or provider data. The upload API's empty-list behavior remains covered by
  focused API/component tests rather than this replay.
- One earlier combined Windows run hit transient `EPERM` locks in temporary test/repository/build
  files. Isolated replays of the affected suites and TypeScript check passed; no source defect was
  reproduced.

## Boundaries and next slice

No Sluice/provider call, image generation, brief approval, public package, OmniPost action,
migration apply, deployment, production-data mutation, or demo-data enablement is part of this
slice. Deployment health for predecessor merge `d1e4e349` succeeded separately; it is not authentic
user acceptance.

The next bounded decision is whether to add human image-brief editing/approval and a provider-neutral
request contract. Keep execution disabled until Sluice proves model alias, request/response,
request-ID, cost, telemetry, rights, storage-copy, and fail-closed capability contracts.

## Trace envelope

- **Task:** `2853ec21-dfd7-4e54-91c9-4e5c09871b2c`
- **Routing:** Veritas Gateway uploads/API, Ledger guidance aggregate, Shield access/provenance,
  Surface/Studio admin UI, Proof tests/browser verification
- **External effects:** Baton task creation/update and later GitHub branch/PR only; no provider,
  publication, migration, deployment, or production-data effect
