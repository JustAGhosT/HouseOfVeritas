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
- `PATCH /api/recipes/:id/guidance-drafts/:version` is admin-only and replaces one named section or
  records an approve/reject decision for one `review_required` media asset in a `draft` or
  `in_review` document. The request supplies `expectedUpdatedAt`; the server preserves stable IDs,
  derives media reviewer identity/time, advances `updatedAt`, schema-validates the complete
  aggregate, and uses repository compare-and-swap replacement. Updated text must be explicitly
  human-reviewed, media approval requires bilingual alt text, media rejection requires a reason,
  and any completed document-level review evidence is cleared when content changes.
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
- Recipe `PATCH` and guidance `publish` share a per-recipe mutation lock. Test/demo execution uses an
  in-process fail-fast lock; live Mongo stores a persistent owner record in
  `recipe_mutation_locks`. There is no automatic timeout takeover: a second owner cannot begin while
  the first write may still be in flight. A confirmed target-write success releases the owner token;
  an ambiguous target-write failure retains it for operator recovery after the original writer is
  proven stopped. This Cosmos-compatible fail-closed policy avoids unsupported cross-collection
  transactions while preventing recipe edits and publication writes from overlapping. A failed
  owner-scoped release is surfaced to the caller and recovered only through
  `docs/03-deployment/recipe-mutation-lock-recovery.md`. Ambiguous acquisitions are reconciled by
  exact owner token or fail closed with the same token logged for recovery evidence.
- `GET /api/recipes/:id/guidance` returns only the latest published version after checking both the
  recipe and document audience for non-admin users. It returns the recipe alongside the document
  only when their immutable revision IDs match; until historical recipe snapshots are available, a
  stale published document fails closed instead of resolving references against newer facts.
- Preview and published-read responses include the authorized canonical recipe snapshot so clients
  can resolve immutable ingredient and step references without reconstructing facts.
- Every route fails closed when the dedicated guidance store is unavailable. These internal
  lifecycle mutations perform no Sluice work, public-package export, migration apply, OmniPost
  action, deployment, or production-data operation.

### Recipe guidance author and reader clients

The shared Recipes surface consumes the lifecycle contracts without recreating their rules in the
browser.

- Hans receives an admin-only guidance workspace alongside the canonical recipe. It lists immutable
  versions, labels deterministic previews as non-persisted, creates drafts explicitly, and sends the
  current `updatedAt` token with every section, media-review, and lifecycle mutation.
- A `409` response reloads the current version and requires Hans to review it before retrying. The
  client does not merge stale edits or silently repeat a mutation.
- Section authoring preserves canonical ingredient, step, metric, and media-reference blocks.
  Editable bilingual text is marked `source: "reviewed"` only through an explicit save action.
- Media approval requires English and Afrikaans alternative text. Rejection requires a reason.
  Reviewer identity and timestamps remain server-owned.
- Publication controls render the server's deterministic readiness issues. The client collects the
  three required review confirmations and explicit unavailable-media waivers, but the transition
  route remains the authority for approval and publication.
- Irma's Recipes route requests only `GET /api/recipes/:id/guidance`. A published document renders
  bilingual reviewed sections, canonical ingredient references as a checklist, ordered canonical
  steps and timers, approved media, and attribution. A `404` leaves the canonical authorized recipe
  visible; other failures are explicit and retryable.
- The UI neither seeds guidance nor enables demo data. Browser fixtures intercept requests in local
  verification only and do not write to a repository or external service.

### Recipe guidance media intake and planning

Recipe media intake reuses the authenticated upload store with `resourceType=recipe-guidance` and
the canonical recipe ID as `resourceId`. Only admins may create, list, or delete these scoped
uploads. Admins may read drafts; non-admin reads require the exact upload to be an approved,
referenced HOV asset in the latest revision-matching published document and require both recipe and
document audience membership. Generic upload listings omit both task-guidance and recipe-guidance
files so private media cannot leak through an unscoped query. The server derives uploader identity
and upload time; clients cannot claim either value.

- `PATCH /api/recipes/:id/guidance-drafts/:version` accepts `mediaPlan: { action:
"create_missing" }` with `expectedUpdatedAt`. It deterministically adds draft bilingual image
  briefs, planned media assets, and section references only for missing supported slots. Repeating
  the plan is idempotent and performs no provider call.
- The same route accepts `mediaAttachment` with a planned or replaceable asset ID, a recipe-scoped
  upload ID, and explicit rights-basis and attribution text. The server verifies recipe scope and
  image MIME/category, hashes the stored bytes, and records uploaded provenance plus an internal
  HOV storage ID/path. Missing bytes, invalid rights, cross-recipe uploads, and stale concurrency
  tokens fail closed.
- Attached files enter `review_required`; they do not gain alt text or publication status. Hans
  must still use the existing bilingual approve/reject workflow. Approved media cannot be replaced
  through intake.
- Deterministic planning is descriptive only. It does not approve briefs, request generation,
  invoke Sluice, use a direct provider, publish packages, enqueue OmniPost, seed demo data, or write
  production data outside the authenticated upload and explicitly selected draft mutations.

### Recipe image-brief review and disabled generation requests

Hans may edit deterministic bilingual image briefs and their reviewed-fact and excluded-content
lists while a guidance document is `draft` or `in_review`. Every mutation carries `expectedUpdatedAt`.
The server preserves the brief's section/role identity, derives the reviewer ID and timestamp, clears
document-level review evidence, and rejects edits to immutable or already-approved briefs. Approval
is explicit; rejection requires a reason and returns the brief to a human-editable state without
silently approving later edits.

`POST /api/recipes/:id/guidance-drafts/:version/generation-requests` creates a validated,
non-persisted snapshot only for an approved brief attached to a still-planned media slot. The
contract binds the immutable recipe revision, guidance version, media slot, approved bilingual
brief, reviewed facts, exclusions, requesting admin, HOV-copy output requirement, and a stable
request ID. It always returns `execution.allowed=false`, with no provider or model alias, and lists
the Sluice capabilities that remain unproven: model alias, request/response shape, request-ID
propagation, cost reporting, telemetry, rights enforcement, and HOV storage copy.

Request construction never changes the media status to `requested`, stores a job, calls Sluice,
falls back to a provider, or exposes an execution endpoint. Provider execution remains fail-closed
until those capabilities are evidenced and a separately authorized slice introduces the execution
boundary.

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
