# Task Guidance Architecture

Task guidance is a cross-cutting content capability for estate tasks. Cooking recipes, maintenance
procedures, checklists, troubleshooting instructions, and safety notes use the same ordered guidance
shape while retaining their domain-specific source records.

## Data ownership

- `GuidancePack` stores versioned, structured content: kind, locale, materials, tools, safety notes,
  ordered steps, visual cues, quality checks, and source provenance.
- `TaskGuidanceBinding` points a task to its active guidance version. The Baserow task contract is not
  changed.
- Uploaded source photos remain in the authenticated upload store. Guidance stores the returned file
  URL and metadata rather than image bytes.
- Production guidance requires the configured Mongo datastore. Tests and non-production,
  unconfigured development use JSON files under `data/`.

### Recipe document storage boundary

Recipe guidance documents use the dedicated Mongo collection `recipe_guidance_documents`; they are
not embedded into `task_guidance`. The richer recipe aggregate owns immutable recipe revision
manifests, canonical sections, media and image-brief lifecycles, and publication review evidence.
Keeping it separate prevents those invariants from weakening the smaller, task-oriented
`GuidancePack` contract.

- Document IDs are unique, and `(recipeId, version)` is a unique version key.
- Recipe revision IDs and their ordered ingredient/step manifests are immutable within a document
  version; a canonical recipe change requires a new version.
- Stored values are schema-validated on reads and writes; invalid persisted documents fail closed.
- Draft and in-review replacements use `updatedAt` optimistic concurrency. Published content is
  immutable; a published version may only transition to archived without changing its content, and
  an archived version cannot change.
- Every replacement must advance `updatedAt`. Explicit-demo file mutations serialize the complete
  read/check/write operation within the process so concurrent writers receive the same conflict
  guarantees as Mongo compare-and-swap updates.
- Tests and E2E use an empty in-memory repository. With Mongo unconfigured, ordinary runtime fails
  closed. Local JSON persistence is available only when `ALLOW_DEMO_DATA=true`; enabling it does not
  seed any recipe guidance.
- Existing `task_guidance` records and task bindings remain readable. Migration first inventories
  recipe-backed legacy packs, verifies their recipe snapshot, and requires a rebuild from the
  canonical recipe. It selects at most one rebuild for each recipe revision and never promotes
  legacy publication or review state automatically.

### Deterministic recipe draft and read boundary

`buildRecipeGuidanceDraft()` maps one immutable recipe snapshot into the fixed nine-section order.
It copies canonical ingredient and ordered step IDs, converts recipe timers to seconds, carries the
bilingual title and summary as recipe-sourced (not human-reviewed) text, and adapts licensed hero
media into `review_required` or `unavailable` state. It never invents safety, allergen, storage, or
image-brief content. A zero-minute recipe value means no timer and is omitted because guidance timer
durations must be positive. A zero-serving recipe sentinel is likewise omitted because guidance
serving counts must be positive; other valid preparation/cooking metrics remain available.

- `POST /api/recipes/:id/guidance-drafts/preview` is admin-only and returns the next deterministic
  version with `persisted: false`; it does not call repository create/replace methods.
- `GET /api/recipes/:id/guidance-drafts` is admin-only and lists stored versions for review.
- `POST /api/recipes/:id/guidance-drafts` is admin-only and explicitly persists the next
  deterministic version. The repository's unique `(recipeId, version)` key closes concurrent
  creation races with a refreshable conflict; preview remains non-persisting.
- `PATCH /api/recipes/:id/guidance-drafts/:version` is admin-only and replaces one named section of
  a `draft` or `in_review` document. The request supplies `expectedUpdatedAt`; the server preserves
  the stable section ID, advances `updatedAt`, schema-validates the complete aggregate, and uses the
  repository compare-and-swap replacement. Updated text must be explicitly human-reviewed, and any
  completed document-level review evidence is cleared when a section changes.
- Section updates fail closed if the canonical recipe has changed since the immutable draft
  snapshot. Clients must create a new version rather than editing old ingredient or step facts.
- `GET /api/recipes/:id/guidance-drafts/:version/publication-readiness` is admin-only and returns a
  deterministic list of publication blockers without changing state. A stale recipe revision is a
  blocker alongside incomplete sections, unreviewed text, unfinished media, missing approval
  evidence, or unwaived unavailable optional media.
- `POST /api/recipes/:id/guidance-drafts/:version/transitions` is admin-only and accepts one explicit
  `submit_for_review`, `approve_review`, `publish`, or `archive` action with
  `expectedUpdatedAt`. Review approval records server-owned reviewer identity/time plus explicit
  bilingual, allergen/safety, provenance/rights, and optional-media-waiver evidence. Publication
  reuses the readiness contract and fails closed with actionable issues.
- Lifecycle order is `draft -> in_review -> published -> archived`. In-review versions cannot move
  back to draft, published versions can only be archived without content changes, and archived
  versions remain immutable.
- Recipe `PATCH` and guidance `publish` share a per-recipe mutation lease. Test/demo execution uses
  an in-process fail-fast lock; live Mongo uses an expiring `recipe_mutation_locks` lease keyed by
  recipe ID. The owner renews that lease while the mutation remains active and releases it with an
  owner-token condition. Each acquisition increments a durable shared fencing token. The final
  recipe or guidance replacement runs in the same Mongo transaction as an owner-and-fence check on
  that shared lease document, so both collections have one ordering point and a stalled older write
  cannot commit after lease takeover. Publication acquires the lease before re-reading the recipe
  and guidance version, so a concurrent recipe edit cannot land between revision validation and the
  publication write.
- `GET /api/recipes/:id/guidance` returns only the latest published version after checking both the
  recipe and document audience for non-admin users. It returns the recipe alongside the document
  only when their immutable revision IDs match; until historical recipe snapshots are available, a
  stale published document fails closed instead of resolving references against newer facts.
- Preview and published-read responses include the authorized canonical recipe snapshot so clients
  can resolve immutable ingredient and step references without reconstructing facts.
- Every route fails closed when the dedicated guidance store is unavailable. These internal
  lifecycle mutations perform no Sluice work, public-package export, migration apply, OmniPost
  action, deployment, or production-data operation.

## Request flow

1. A resident opens Guidance from a task and captures or chooses a photo.
2. The resident describes the desired result and constraints.
3. `POST /api/guidance/analyze` sends the bounded image and description through Sluice's
   OpenAI-compatible gateway and validates the response against the shared guidance schema.
4. The resident reviews the visual cues, checks, warnings, materials, and ordered steps.
5. On approval, the photo is stored through `POST /api/uploads`, then `POST /api/guidance` creates a
   versioned pack and updates the active task binding.
6. `GET /api/guidance?taskId=...` resolves the active guidance without changing the task API.

Recipes are compatible through `recipeToGuidanceDraft()`. This keeps recipe authoring and licensing
metadata in the recipe domain while allowing the same step viewer to be reused in future task links.

## Interaction and safety

- Mobile shows one large, actionable step at a time with camera capture, clear next/previous controls,
  and visible safety/quality callouts.
- Desktop uses a split reference-photo and instruction layout. Icon controls expose mouse tooltips.
- AI output is advisory and requires review before attachment. The prompt must identify uncertainty
  and stop conditions for structural, electrical, gas, asbestos, and other hazardous work.
- Sluice owns provider and model routing. HOV requests the vision-capable `cheap-long-context` policy
  alias and sends consumer, capability, stage, and task metadata for governance and cost attribution.
- HOV does not fall back to a direct model provider. No demo guidance is generated when Sluice or
  persistence is unconfigured; the API returns an explicit unavailable state.

## Runtime configuration

- `SLUICE_BASE_URL` points to the LiteLLM gateway.
- `SLUICE_API_KEY` is a service virtual key delivered to App Service through an HOV Key Vault
  reference. Never expose it to the browser.
- `SLUICE_GUIDANCE_MODEL` defaults to the `cheap-long-context` policy alias.
