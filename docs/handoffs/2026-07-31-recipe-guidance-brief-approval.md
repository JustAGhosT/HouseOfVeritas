# Recipe guidance image-brief approval handoff

- **Date:** 2026-07-31
- **Repository:** `C:\Users\smitj\repos\house-of-veritas`
- **Worktree:** `C:\tmp\hov-recipe-guidance-brief-approval`
- **Branch:** `feat/recipe-guidance-brief-approval`
- **Base:** `origin/main` at `33f1fa2c42362ba5183202057c5f15a01bd31c98`
- **Predecessor:** PR [#162](https://github.com/neuralliquid/house-of-veritas/pull/162)
- **Baton task:** `06df7efb-d396-4cfa-81f0-1a5b193f0759`
- **Risk tier:** API/data/UI workflow; admin review and deliberately disabled provider boundary

## Outcome

- Hans can edit deterministic bilingual image briefs and reviewed-fact/exclusion lists, then
  explicitly approve or reject a brief. Rejection requires a reason; reviewer identity and time are
  server-derived.
- Brief mutations use the existing draft CAS token, clear document-level review evidence, preserve
  stable section/role identity, and fail closed for stale, immutable, or already-approved updates.
- An admin-only endpoint constructs a provider-neutral request snapshot from an approved brief and
  planned media slot. It binds the exact recipe revision and guidance version but neither persists a
  request nor changes media status.
- Every returned request has provider/model unset and `execution.allowed=false`. Missing Sluice
  model-alias, request/response, request-ID, cost, telemetry, rights, and HOV-copy capabilities are
  explicit in the contract.

## Changed files

- `lib/recipe-guidance.ts`
- `lib/recipe-guidance-media.ts`
- `lib/recipe-guidance-generation.ts`
- `app/api/recipes/[id]/guidance-drafts/[version]/route.ts`
- `app/api/recipes/[id]/guidance-drafts/[version]/generation-requests/route.ts`
- `components/recipes/recipe-guidance-media-intake.tsx`
- `components/recipes/recipe-guidance-workspace.tsx`
- `tests/lib/recipe-guidance-media.test.ts`
- `tests/lib/recipe-guidance-generation.test.ts`
- `tests/api/recipe-guidance.test.ts`
- `tests/components/recipe-guidance-ui.test.tsx`
- `docs/05-project/task-guidance-architecture.md`
- `docs/handoffs/2026-07-31-recipe-guidance-brief-approval.md`
- `docs/README.md`

## Verification

```text
pnpm test -- tests/lib/recipe-guidance-generation.test.ts tests/lib/recipe-guidance-media.test.ts tests/lib/recipe-guidance.test.ts tests/api/recipe-guidance.test.ts tests/components/recipe-guidance-ui.test.tsx
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
pnpm exec prettier --check <changed TypeScript and Markdown files>
git diff --check
```

- Focused Vitest: 5 files, 78 tests passed.
- TypeScript passed.
- Lint and production build passed; the build generated 125 static pages and emitted the new
  generation-request route.
- A visible local Chromium replay used a synthetic E2E-only Hans session with fixture-intercepted
  recipe, guidance, upload, scope, brief-review, and generation-request APIs. It proved draft brief
  rendering, explicit approval, the approved read-only state, disabled request construction, and
  the message `Execution remains disabled and nothing was persisted.` Final console evidence had
  zero errors and zero warnings. Screenshot:
  `output/playwright/recipe-guidance-brief-approval.png` (ignored local artifact).
- The first browser attempt hit a pre-existing user-owned app on port 3000 and was discarded. The
  clean replay ran this worktree's build on isolated port 3100; the pre-existing process was not
  stopped or changed.

## Review remediation

- PR #163 review feedback was addressed by keeping brief-editor identity stable, synchronizing
  only fields whose persisted brief values changed, and preserving unsaved edits in other briefs.
- The generation-request action is now shown only when the approved brief still has a matching
  `planned` media asset, so an uploaded `review_required` slot cannot offer an action guaranteed to
  return 409.
- Approved image briefs now fail schema parsing unless both grounded reviewed facts and explicit
  exclusions are present, matching the mutation and generation-request gates.
- Review-remediation verification: 4 focused files with 51 tests passed, TypeScript passed, lint
  passed, and the production build generated 125 static pages. The first sandboxed build retry hit
  a Windows access denial on the generated `.next/trace-build`; removing that exact generated file
  and rerunning outside the sandbox passed.

## Boundaries and next slice

No Sluice/provider call, image generation, request persistence, media-status transition, direct
provider fallback, public package, OmniPost action, migration apply, deployment, production-data
mutation, auth/secret change, or demo-data enablement is part of this slice.

The next decision requires live Sluice evidence for model alias, request/response schema,
request-ID propagation, cost and telemetry fields, rights enforcement, HOV storage-copy behavior,
timeouts, and failure semantics. Do not add an execution route until those contracts are proven and
the external effect is separately authorized.

## Trace envelope

- **Task:** `06df7efb-d396-4cfa-81f0-1a5b193f0759`
- **Routing:** Veritas Gateway, Ledger, Shield, Surface/Studio, Proof
- **External effects:** Baton coordination and GitHub branch/PR only; no provider, deployment,
  publication, migration, or production-data effect
