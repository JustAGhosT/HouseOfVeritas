# Recipe Guidance Document Plan

## Intake and scope

- **Goal:** Create reviewable recipe boards section by section and content type by content type,
  with English and Afrikaans content, household inventory/buy-list grounding, and purpose-built
  images routed through Sluice.
- **Primary users:** Hans authors and approves; Irma reads and cooks from a mobile device.
- **Affected domains:** Recipes, pantry/inventory, shopping, preferences, task guidance, media
  storage, Sluice routing, public publishing, accessibility, and content governance.
- **Risk:** API/data/UI workflow with food-safety, generated-media, cost, and publishing concerns.
- **Non-goals:** Automatically publishing model output, calling model providers directly, treating
  uncertain stock or prices as fact, enabling demo recipes by default, or making Sluice a permanent
  image store.
- **Assumption:** “Document” means a reusable structured recipe guidance pack rendered in the app,
  not a single unstructured PDF or Markdown blob. Export can be added from the same structure later.
- **Baton task:** `b20f81a8-8ab4-4a54-8a10-657292cd811b`.

## Outcome

An author starts with a recipe title such as `<title>`, supplies or reviews the recipe facts, and
builds a versioned guidance document. The system drafts the document structure, prepares an image
brief for each visual section, routes approved generation requests through Sluice, stores approved
outputs in HOV-managed storage, and publishes only after a human has reviewed the text, images,
attribution, allergens, and safety guidance.

The final visual can resemble the supplied “Loaded Vienna, Potato & Onion Omelette” board, but it
must be composed by a deterministic layout renderer from approved content blocks. Sluice generates
the photographic panels, not the complete poster. Titles, ingredient quantities, temperatures,
timers, prices, warnings, icons, and labels remain real text rendered by HOV so they are accurate,
accessible, translatable, searchable, and correctable.

The existing recipe record remains the source of truth for ingredients, servings, times, audience,
and bilingual instructions. The guidance document is a versioned presentation derived from that
record. Generated images are separate media assets referenced by the recipe and guidance sections;
they are not embedded as base64 in MongoDB and are not owned by Sluice.

## Current-state constraints

House of Veritas already has:

- a bilingual `RecipeRecord` with one licensed hero image and ordered steps;
- a versioned `GuidancePack` with materials, tools, safety, steps, visual cues, checks, and warnings;
- `recipeToGuidanceDraft()`, which maps recipe text into a guidance draft;
- a Sluice client for vision-assisted task guidance through `/v1/chat/completions`;
- authenticated upload storage and Mongo-backed guidance persistence.

It does not yet have:

- recipe-section media or image references on guidance steps;
- a recipe-document generation/review workflow;
- a HOV adapter for image generation through Sluice;
- a confirmed production Sluice image-generation capability.

Sluice ADR-14 and its implementation plan currently describe media generation as **proposed** and
state that no image/video provider entries, media routes, or media-shaped cost events exist. HOV
must therefore implement the content model and review workflow independently of provider readiness,
and keep generation controls unavailable until Sluice capability verification passes.

## Canonical recipe document

Every recipe document uses the following order. A section may be marked not applicable, but the
order stays stable so authors, readers, tests, and exports share one contract.

### 1. Identity and status

- Stable recipe ID and document version.
- Draft, in review, published, or archived status.
- Owner and explicit audience IDs.
- English title and Afrikaans title.
- Last content reviewer, media reviewer, and approval timestamps.

No draft or generated asset is visible to a resident until the complete document version is
published for that resident's audience.

### 2. Hero

- Finished-dish image.
- Bilingual title and one-sentence summary.
- Servings, preparation time, cooking time, cuisine, and category.
- Concise image attribution/provenance disclosure.

The hero image must show the plausible finished result. It must not contain generated labels or
instructions; localized text belongs in the UI, not inside the pixels.

### 3. Before you start

- Allergen and dietary notices.
- Food-safety warnings and stop conditions.
- Required tools and cookware.
- Preparation assumptions such as preheated oven, thawed ingredients, or cooked leftover rice.

Safety text is deterministic and reviewable. Images may illustrate a cue, but may never replace a
temperature, duration, hygiene instruction, or warning.

### 4. Ingredients

- Grouped ingredient sections in cooking order.
- Quantity, unit, name, and preparation note.
- Explicit optional ingredients and reviewed substitutions.
- A mobile checklist state that is local to the viewer and does not alter the recipe.

Use a single ingredient-layout image only when it adds practical value. It must match the listed
quantities and must not imply that an omitted allergen or ingredient is present.

### 5. Preparation

- Mise-en-place steps such as washing, chopping, measuring, draining, or preheating.
- One action-focused section per meaningful state change.
- Timer, visual cue, completion check, and warning where applicable.
- One approved image per section when the visual state helps the cook.

### 6. Cooking

- Ordered cooking steps, preserving the recipe's canonical order.
- Heat level, duration, observable state, and measurable completion check.
- Food-safety temperature where relevant.
- Recovery advice only when safe and tested.
- One approved image per meaningful stage; combine trivial actions into a single visual section.

### 7. Finish and serve

- Final seasoning or texture adjustment.
- Resting, plating, portioning, and serving guidance.
- A final-state image may reuse the hero only when it depicts the same serving state.

### 8. Storage and reheating

- Cooling, refrigeration/freezing, storage duration, and reheating instructions.
- Discard conditions and allergen cross-contact reminders where relevant.
- No generated image is required unless it conveys a non-obvious container or portioning method.

### 9. Provenance and feedback

- Recipe author/source and revision history.
- Media source, provider/model, generation request ID, rights basis, and reviewer.
- Visible attribution when required by the source or output terms.
- Rating and served-meal history remain linked records, not generated claims.

## Board composition, content type by content type

The board is a view of the canonical recipe document, not a separately authored image. Each block
has its own data source, validator, renderer, and review state.

| Content block        | Example-board role                              | Canonical source                           | Generation and validation rule                                                    |
| -------------------- | ----------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| Masthead             | Large recipe name and promise                   | Reviewed bilingual title and summary       | HOV renders text; the promise must be supported by recipe facts                   |
| Hero panel           | Finished omelette photograph                    | Approved hero media asset                  | Sluice or licensed/uploaded image; review ingredient and final-state fidelity     |
| Attribute ribbon     | “Hearty”, “easy”, “one-pan”                     | Computed/reviewed tags                     | Derive from nutrition, equipment, and step facts; no unsupported marketing claims |
| Metric strip         | Serves, prep time, cook time                    | Structured recipe fields                   | Deterministic icons and text; totals must reconcile with step timers              |
| Ingredient list      | Quantity and preparation list                   | Canonical ingredients                      | Render real text; join to a household availability snapshot                       |
| Availability mark    | In house, low, expiring, reserved, buy, unknown | Inventory allocation result                | Never generated; timestamp and explain uncertain or stale state                   |
| Cost summary         | On-hand value, buy cost, cost/serving           | Price snapshot plus required quantities    | Show estimate/range, currency, source, timestamp, and confidence                  |
| Method step          | Numbered instruction and photo                  | Canonical ordered step plus approved media | Text is reviewed; Sluice can create only the step photograph                      |
| Heat/timer card      | Boil, medium-high, 8–10 min                     | Structured heat, timer, and completion cue | Deterministic badge; retain a measurable completion condition                     |
| Safety/tip card      | Salt, doneness, cross-contact advice            | Reviewed safety/rationale fields           | Human-reviewed rule content; no model-only safety claims                          |
| Serve-with block     | Pairings and serving suggestions                | Approved suggestion records                | Must declare ingredients that add to the buy list or allergens                    |
| Upgrade/substitution | Cheese, herbs, heat, mustard, chakalaka         | Approved option branches                   | Recompute cost, availability, allergens, nutrition, and score per option          |
| Decision rationale   | Why this recipe fits today                      | Optimization result                        | Show the leading factors and trade-offs, not an opaque “AI picked this” label     |
| Footer               | Short approved editorial note                   | Reviewed publication copy                  | No hidden household facts or fabricated outcome claim                             |

### Deterministic composition pipeline

1. Snapshot the recipe version, invited actors, pantry allocations, price observations, and active
   optimization profile.
2. Build typed content blocks in reading order.
3. Validate each block independently: bilingual copy, quantities, timing, safety, data freshness,
   price provenance, and actor visibility.
4. Prepare and approve image briefs for only the blocks that need a photograph.
5. Route those image requests through the Sluice capability gate and approve/store each result.
6. Render app, print, public-web, and social variants from the same approved blocks using fixed
   templates, licensed SVG icons, fonts, and design tokens.
7. Run overflow, contrast, responsive-crop, link, structured-data, and text/image-consistency checks.
8. Require human preview and approval before internal publication, public export, or OmniPost handoff.

This avoids the common failure mode where a single image model produces beautiful food but misspells
headings, changes quantities, drops a step, invents an ingredient, or renders contradictory timers.

## Household inventory and buy-list grounding

Recipe planning must distinguish ownership from usable allocation. An ingredient can exist in the
house while being expired, reserved for another meal, below the required quantity, inaccessible to
the selected actor, or unsafe for one of the diners.

Use these explicit states:

- **Available:** Enough usable, unreserved quantity exists for this recipe.
- **Partial:** Some usable quantity exists; buy only the calculated shortfall.
- **Use soon:** Available and near expiry, so using it improves the waste score.
- **Reserved:** Present but allocated elsewhere; do not count it without an approved reallocation.
- **Restricted:** Present but excluded by allergy, diet, ownership, or another hard rule.
- **Unavailable:** Confirmed absent or unusable.
- **Unknown/stale:** Inventory or price evidence is incomplete or older than the configured window.

For ingredient `i`, calculate the shopping requirement from normalized units:

```text
buyQuantity(i) = max(0, required(i) - usableAvailable(i) - approvedSubstitute(i))
```

The calculation needs unit conversion, yield/waste factors, package-size rounding, and a reservation
ledger. The board should show “in house”, “use soon”, “buy 500 g”, or “check stock”; it must not
collapse unknown into unavailable. Prices are timestamped observations. Show an estimated range
when the selected retailer/package is unresolved, and never publish private household stock or
purchase prices on a public recipe page.

### Shopping output

Generate one explainable list with:

- item, required quantity, usable-on-hand quantity, shortfall, purchase quantity, and package count;
- preferred substitution and the reason it is safe/acceptable;
- estimated price range, retailer/source, observed timestamp, and confidence;
- which recipe/option caused the need;
- allergen/cross-contact warning; and
- an actor/owner for buying or confirming stock.

The shopping leader approves changes. A recipe draft does not silently reserve inventory or create
external orders.

## Multi-objective recipe optimization

Optimization should filter by hard constraints first and rank the remaining candidates second.
Never trade a hard safety or access constraint for a better score.

### Hard constraints

- allergy and cross-contact rules for every diner;
- dietary/religious exclusions and explicitly disliked ingredients when configured as blocking;
- unusable/restricted inventory and safe-substitution validity; ordinary purchasable shortfalls are
  not blocking unless an explicit no-shopping mode is active;
- available equipment, cook capability, maximum time, and serving count;
- budget ceiling when the household marks it non-negotiable; and
- visibility/consent rules for the selected actors.

### Ranked objectives

Score each feasible recipe on normalized, explainable dimensions:

- **Price:** expected buy cost and cost per serving.
- **Pantry use/waste:** use-soon ingredients consumed and avoidable leftovers.
- **Taste:** per-actor and group rating history, with confidence and recency.
- **Novelty:** distance from recently served meals, bounded so novelty does not overwhelm preference.
- **Nutrition:** reviewed nutritional targets and dietary balance, not unverified model estimates.
- **Effort:** active time, complexity, cleanup, and equipment burden.
- **Availability:** proportion already usable in the house and uncertainty penalty.
- **Seasonality/local fit:** ingredient availability and accepted local substitutions.
- **Learning value:** strategically try uncertain options to improve preference knowledge, within a
  configurable exploration budget.

Store the score vector and selected weights with the meal plan. A simple first implementation is a
weighted score over feasible recipes; a later implementation can show a Pareto frontier rather than
pretending there is one universally best answer.

Missing but purchasable ingredients remain feasible. Their shortfalls contribute to price,
availability, effort, and shopping-list scores. Only an unsafe/unusable item, invalid substitution,
or explicit no-shopping constraint can eliminate the recipe for inventory reasons.

### Actor-specific views

| Actor/view      | Optimized presentation                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Hans/admin      | Full costs, stock confidence, alternatives, generation spend, approvals, and audit trail                   |
| Irma/cook       | Clear one-step cook mode, available/buy indicators, substitutions, timers, and safety                      |
| Shopping leader | Consolidated shortfalls, package rounding, retailer/price evidence, and owner assignment                   |
| Diner           | Allergens, dietary fit, portion, taste/novelty rationale, and feedback controls                            |
| Public reader   | Sanitized recipe facts, images, attribution, and options; no residents, pantry, private prices, or ratings |

For group meals, keep individual preference signals user-scoped. Aggregate them for the group score
without exposing who disliked, restricted, or could not afford a particular option.

## Defensibility and moat

Generated recipes and attractive boards are commodity features. The defensible opportunity is the
closed operational learning loop:

```text
live pantry + freshness + local price observations
  -> constrained, explainable recipe choice
  -> approved buy list and actual purchases
  -> cooked/served meal and substitutions used
  -> per-actor taste, effort, waste, and repeat feedback
  -> better household-specific planning
```

The strongest moat candidates are:

- a high-quality private dataset connecting what was actually in the house, bought, substituted,
  cooked, liked, wasted, and repeated;
- reliable English/Afrikaans and South African ingredient, package, retailer, and substitution
  normalization;
- household/group preference resolution that respects allergies, privacy, budget, and ownership;
- trusted provenance: reviewed instructions, media rights, price timestamps, and explainable choices;
- workflow integration across pantry, shopping, meal execution, feedback, and publication; and
- accumulated performance evidence such as cost/serving error, waste avoided, completion friction,
  repeat rate, and preference-prediction accuracy.

This becomes defensible only through repeated real use and correction. Do not call the model, image
style, prompt library, or public recipe count a moat by itself. The private learning data must remain
exportable, revocable, user-scoped, and unavailable to external publishing pipelines.

## External publishing strategy

### Recommendation

Use three layers with different responsibilities:

1. **HOV private canonical record:** recipe, household state, actor preferences, approvals, and
   provenance. This remains the only authoring source of truth.
2. **Public recipe site/read model:** a separate public surface or subdomain fed only by an approved
   `PublicRecipePackage`. It owns stable canonical URLs, bilingual public pages, print views, image
   variants, discovery metadata, and analytics. It contains no private household state.
3. **OmniPost distribution:** receives a reference to an already-public package, adapts it into
   channel-specific posts, schedules/approves distribution, and links back to the canonical page.

Do not make OmniPost the recipe CMS and do not make a social post the canonical recipe. This split
lets public pages remain stable when platform integrations or post formats change.

### Public recipe package

The versioned export should contain only approved public fields:

- stable public ID, slug, locale, canonical/alternate URLs, author/brand, and publication dates;
- title, summary, servings, times, categories, cuisine, keywords, and public nutrition facts;
- ingredient and instruction sections with anchor IDs and approved step images;
- public hero crops in `16:9`, `4:3`, and `1:1`;
- media attribution/rights disclosure, allergens, safety, substitutions, and serving notes;
- aggregate ratings only when the displayed values are real, eligible, and privacy-safe; and
- a content hash so downstream retries cannot silently publish a different recipe version.

The public site should emit
[Google-supported Recipe structured data](https://developers.google.com/search/docs/appearance/structured-data/recipe)
using `Recipe`, explicit `HowToSection`/`HowToStep` records, crawlable step images, and `ItemList` on
collection pages. Google recommends multiple high-resolution hero aspect ratios and notes that valid
markup is eligibility, not a guarantee of rich-result placement.

### OmniPost handoff

Use an outbox/event contract rather than synchronous cross-repo writes:

```json
{
  "eventType": "public_recipe.published",
  "recipeId": "stable-public-id",
  "version": 3,
  "locale": "en-ZA",
  "canonicalUrl": "https://<public-host>/recipes/<slug>",
  "contentHash": "sha256:...",
  "heroImageUrl": "https://<public-host>/media/<id>-4x3.webp",
  "suggestedChannels": ["pinterest", "instagram", "facebook", "x"],
  "idempotencyKey": "hov-recipe:<id>:v3:en-ZA"
}
```

OmniPost should fetch the immutable public package, create platform-specific drafts, and require
channel approval. It must retain the provider post ID, public URL, publish timestamp, source recipe
version, and content hash before HOV labels distribution successful.

Current OmniPost evidence supports a durable scheduler and content tracking, but external acceptance
is channel-specific: X still has an operator/provider gate and Pinterest remains a sandbox/trial
handoff. Treat every other connector as unavailable or unproven until its exact account, adapter,
delivery ID, and public URL are verified. Start with public web pages and manually approved OmniPost
drafts; enable automatic scheduling one channel at a time after legitimate acceptance.

### Publishing content variants

- **Public web:** Complete bilingual recipe, structured data, print view, and all approved steps.
- **Pinterest:** Tall recipe-board teaser or step carousel linking to the canonical recipe.
- **Instagram/Facebook:** Hero or carousel plus concise method highlights and canonical link where
  the channel permits it.
- **X:** Short hook, key constraint/value, hero image, and canonical link; never force the full
  recipe into a thread unless deliberately authored.
- **Email/newsletter/RSS:** Summary, hero, key metrics, and canonical link from the same package.

Public performance can inform editorial strategy, but social engagement must not be merged into a
resident's private taste profile without explicit consent and a documented identity boundary.

## Section contract

Each document section should use a typed record rather than free-form HTML:

```ts
interface RecipeTimer {
  id: string;
  labelEn: string;
  labelAf: string;
  minimumSeconds: number;
  maximumSeconds?: number;
}

interface RecipeGuidanceSection {
  id: string;
  kind:
    | "hero"
    | "before-you-start"
    | "ingredients"
    | "preparation"
    | "cooking"
    | "finish-and-serve"
    | "storage-and-reheating"
    | "provenance";
  order: number;
  titleEn: string;
  titleAf: string;
  instructionEn: string;
  instructionAf: string;
  visualCueEn?: string;
  visualCueAf?: string;
  checkEn?: string;
  checkAf?: string;
  warningEn?: string;
  warningAf?: string;
  timers?: RecipeTimer[];
  ingredientIds?: string[];
  mediaAssetIds: string[];
}
```

The implementation may extend `GuidanceStep` or introduce a recipe-specific section type, but it
must not duplicate canonical ingredient quantities or silently merge English and Afrikaans into a
single field. `recipeToGuidanceDraft()` should remain deterministic and should preserve section,
visual-cue, check, warning, timer ranges, and media-reference information once those fields exist.

## Media asset contract

Use one shared media record for sourced, uploaded, and generated images:

```ts
interface RecipeMediaAsset {
  id: string;
  recipeId: string;
  sectionId?: string;
  role: "hero" | "ingredient-layout" | "step" | "serving" | "storage";
  status:
    | "planned"
    | "requested"
    | "generated"
    | "reviewed"
    | "approved"
    | "rejected"
    | "unavailable";
  storageUrl?: string;
  thumbnailUrl?: string;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  width?: number;
  height?: number;
  altTextEn?: string;
  altTextAf?: string;
  sourceType: "licensed" | "uploaded" | "sluice-generated";
  sourceUrl?: string;
  author?: string;
  licenseOrRights: string;
  attributionText: string;
  retrievedOrGeneratedAt?: string;
  promptVersion?: string;
  promptText?: string;
  provider?: string;
  model?: string;
  sluiceRequestId?: string;
  contentHash?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}
```

Alt text remains absent while an asset is only planned, requested, generated, rejected, or
unavailable. Schema validation must require reviewed, non-empty English and Afrikaans alt text for
every approved or publishable asset; the implementation should express that invariant with a
status-discriminated schema rather than fabricated placeholder text.

`promptText` can contain household recipe details but must not contain credentials, private user
data, or unrelated operational context. If prompt retention is undesirable, store a prompt hash and
an approved, redacted prompt summary instead. The final choice should be explicit in the privacy
review before implementation.

## Image brief for every visual section

Before any generation call, create and review an `ImageBrief` containing:

- semantic purpose: what the image must help the cook understand;
- subject and exact cooking stage;
- ingredients and cookware that must be visible;
- visual completion cue and unsafe states to avoid depicting;
- continuity references to approved hero/previous-step assets;
- camera angle, framing, lighting, background, and target aspect ratio;
- exclusions: no people unless necessary, no text in image, no brands, no extra ingredients, no
  unsafe handling, and no misleading doneness;
- requested output count, normally one candidate plus at most one deliberate retry;
- bilingual alt text derived from the approved image, not merely copied from the prompt.

Suggested ratios are `16:9` for hero/detail, `4:3` for a desktop step view, and `1:1` only for compact
cards. The UI should use responsive crops without hiding the critical cooking state.

## Sluice generation boundary

### Capability gate

Generation is enabled only after all of the following are proven in the target environment:

1. A Sluice-routed image model alias is configured and callable with the HOV virtual key.
2. The request contract and response contract are versioned and covered by consumer tests.
3. Sluice records provider/risk metadata and returns a stable request ID.
4. Docket accepts media-shaped usage/cost events.
5. Output rights and provider-risk policy are approved for HOV recipe use.
6. Returned bytes or signed URLs can be copied into HOV storage without making Sluice the archive.
7. Unconfigured, unauthorized, timed-out, rejected, or unsafe calls return an explicit unavailable
   state and never trigger a direct-provider fallback.

Until this gate passes, authors can create image briefs, attach licensed/uploaded media, and use a
truthful **Image generation unavailable** state. They cannot see a button that pretends generation
will work.

### Request metadata

Every call should include non-sensitive governance metadata:

```json
{
  "consumer": "house-of-veritas",
  "capability": "recipe-guidance-image",
  "route_hint": "recipe-image",
  "stage": "development|test|production",
  "recipe_id": "stable-id",
  "document_version": 1,
  "section_id": "stable-section-id",
  "media_role": "hero|ingredient-layout|step|serving|storage"
}
```

Do not send resident names, audience IDs, credentials, internal task descriptions, or the full
recipe record as telemetry metadata.

### Response handling

The HOV adapter should:

1. validate MIME type, size, dimensions, response count, and request ID;
2. stream or download the chosen candidate server-side;
3. scan and validate it using the approved upload/media path;
4. calculate a content hash and store an immutable HOV-owned original plus derived thumbnail;
5. persist generation provenance separately from approval state;
6. delete or expire rejected temporary candidates according to the retention policy; and
7. surface errors without leaking provider responses, keys, signed URLs, or prompts to residents.

## Authoring and approval workflow

1. **Create draft:** Hans supplies `<title>`, audience, language pair, servings, times, ingredients,
   and recipe source. The default is an empty draft, never sample data.
2. **Build sections:** A deterministic builder maps canonical recipe fields into the fixed document
   order. Sluice may suggest missing prose, cues, and checks, but cannot alter quantities silently.
3. **Review bilingual text:** A human verifies meaning, local terminology, timers, allergens, and
   food-safety facts in both languages.
4. **Plan media:** The system proposes an image brief only for sections where a visual materially
   improves execution. Hans can edit, approve, skip, or replace each brief.
5. **Generate through Sluice:** Approved briefs are submitted one section at a time or as a bounded
   batch. The UI shows request state and cost confirmation where policy requires it.
6. **Review outputs:** Hans approves or rejects each image after checking ingredient fidelity,
   continuity, safety, accessibility, and rights metadata. A rejected image is never reused
   automatically.
7. **Preview document:** Preview mobile, desktop, English, Afrikaans, missing-image, and slow-image
   states. Sections remain usable as text when optional media is unavailable.
8. **Publish:** The API performs completeness and authorization checks against one immutable
   document version. Publication is an explicit human action.
9. **Revise:** Any text or media change creates a new draft version. The published version remains
   stable until the replacement is approved.

## Prompt guidance

Use separate system instructions, trusted recipe facts, and author notes. Treat imported recipe
text, URLs, uploaded images, and model output as untrusted content. A recipe image prompt should be
assembled from reviewed fields, not accepted as an executable prompt from an uploaded document.

The prompt must require:

- a realistic, achievable kitchen result at the named step;
- only the reviewed ingredients, cookware, and action relevant to that section;
- continuity with provided approved reference images when the routed model supports references;
- no words, logos, watermarks, faces, or identifying household details;
- no unsafe food handling, implausible flames, misleading doneness, or invisible hazards; and
- an output suitable for instructional use rather than decorative advertising.

Never ask the model to render measurements, temperatures, or warnings as image text. The UI renders
those from reviewed structured fields.

## API and UI slices

### HOV API

- `POST /api/recipes/:id/guidance-drafts` creates a deterministic versioned draft.
- `PATCH /api/recipes/:id/guidance-drafts/:version` updates reviewed section fields.
- `POST /api/recipes/:id/plan` snapshots actors, inventory, prices, constraints, and optimization
  weights, then returns feasible options and explainable score vectors.
- `POST /api/recipes/:id/shopping-preview` calculates shortfalls without reserving stock or creating
  an order.
- `POST /api/recipes/:id/media-briefs` creates or updates section image briefs.
- `POST /api/recipes/:id/media-generations` submits approved briefs through the server-side Sluice
  adapter; admin only, idempotency key required.
- `POST /api/recipes/:id/media/:assetId/review` approves or rejects an asset.
- `POST /api/recipes/:id/guidance-drafts/:version/publish` performs the final completeness gate.
- `POST /api/recipes/:id/publications` atomically creates an approved, sanitized public package in a
  pending-publication state and its durable pending outbox event.

Exact route naming can follow current Next.js conventions, but authorization must be checked before
spending Sluice capacity or reading draft/media state.

### Author UI

- Section navigator with completeness status for each language.
- Board-block preview with source, validation, inventory/price freshness, and actor-visibility state.
- Optimization controls with hard constraints separated from weighted preferences and a visible
  score explanation.
- Side-by-side text and approved image, with prompt/brief details behind an admin disclosure.
- Generate, retry, reject, approve, upload replacement, and skip-optional-image actions.
- Clear separation between generated, reviewed, and published states.
- Per-request progress without optimistic claims that an image is already persisted.

### Reader UI

- Hero, ingredients checklist, and one step at a time on mobile.
- Available, partial, use-soon, buy, restricted, and unknown indicators based on one timestamped
  household snapshot.
- Image, instruction, timer, visual cue, check, and warning kept in the same step context.
- Language toggle that does not reset the current step or ingredient checklist.
- Useful text-first behavior when an optional image fails to load.
- Visible provenance/attribution disclosure without exposing internal prompts or provider URLs.

## Delivery plan

### Phase 0 — Confirm the cross-repo contract

- Track the Sluice image-routing dependency separately in the Sluice project.
- Select the first approved image model alias and document risk/output-rights decisions for HOV.
- Agree the request/response, request ID, error, idempotency, reference-image, and cost-event shapes.
- Keep HOV generation disabled until production-like integration evidence exists.

### Phase 1 — Document and media model

- Add typed recipe sections, board blocks, media assets, image briefs, lifecycle states, and schema
  validation.
- Define storage paths, immutable hashes, thumbnail derivation, retention, and version ownership.
- Extend `recipeToGuidanceDraft()` without making GuidancePack a second recipe source of truth.
- Migrate existing single hero images into the media shape without losing source/license metadata.

### Phase 2 — Deterministic document builder

- Build the fixed section order from a recipe record.
- Add bilingual completeness, ingredient reference, step order, timer, allergen, and safety checks.
- Add normalized quantities, inventory allocations, price snapshots, availability states, and a
  shopping-shortfall preview.
- Create preview/read APIs plus text-first mobile, desktop, and recipe-board rendering.
- Verify empty, live, and explicit-demo modes.

### Phase 3 — Constraint and preference optimizer

- Implement hard feasibility rules before any ranking.
- Add explainable score vectors for price, pantry use, waste, taste, novelty, nutrition, effort,
  availability, seasonality, and bounded exploration.
- Add actor-specific and group views without exposing private individual preferences.
- Record actual purchase, substitution, serving, rating, and waste outcomes for later learning.

### Phase 4 — Image planning and human review

- Add image briefs and per-section media planning.
- Support existing licensed media and authenticated uploads before generation is live.
- Add approval/rejection, alt-text, provenance, and audit UI.

### Phase 5 — Sluice adapter and controlled generation

- Implement the server-only adapter against the confirmed Sluice contract.
- Add idempotency, timeout, bounded retry, response validation, storage copy, hashing, and telemetry.
- Gate by admin role, environment capability, approved brief, and per-request policy/cost decision.
- Do not add a direct-provider fallback.

### Phase 6 — Internal publishing and exports

- Enforce one immutable reviewed version at publish time.
- Add resident reader flows and optional printable/PDF export from the same structured document.
- Run legitimate browser acceptance with Hans authoring and Irma reading; synthetic checks do not
  substitute for authenticated operator acceptance.

### Phase 7 — Public site and OmniPost distribution

- Create the sanitized, versioned `PublicRecipePackage` and separate public read model.
- Publish stable localized public pages, print views, sitemap, canonical/alternate URLs, and Recipe
  JSON-LD validated with the Rich Results Test.
- Persist the pending publication state and idempotent outbox event atomically before external work.
- Have the publication worker render and verify the public URL/content hash, then mark the event
  releasable for OmniPost; reconciliation repairs any stalled pending publication.
- Add an OmniPost intake adapter that creates drafts from immutable packages and links to the
  canonical page.
- Prove one channel at a time with real provider IDs/public URLs and keep unproven channels disabled.
- Feed aggregate public performance into editorial analytics, not private resident preference data.

## Validation plan

### Schema and unit tests

- Section ordering, unique IDs, ingredient references, and version immutability.
- English/Afrikaans completeness and locale-safe alt text.
- Media lifecycle transitions and rejection handling.
- Prompt construction excludes secrets/PII and treats imported content as untrusted.
- Recipe adapter preserves canonical order, timers, sections, cues, warnings, and media references.
- Unit conversion, usable allocation, package rounding, price age, shortfall, and option recomputation.
- Hard constraints cannot be outweighed; score vectors are stable, explainable, and actor-scoped.
- Board layouts use real text blocks and cannot receive model-rendered quantities or warnings.
- Public export removes audience, inventory, private prices, residents, and individual feedback.

### API and integration tests

- Unauthorized users cannot create drafts, see private media, approve assets, or publish.
- Authorization occurs before any Sluice call or media cost.
- Idempotency prevents duplicate billed generation/storage records.
- Malformed, oversized, wrong-MIME, missing-request-ID, unsafe, and timed-out responses fail closed.
- Sluice unavailable means explicit unavailability and no direct-provider request.
- Approved output is copied to HOV storage with hash/provenance before it becomes publishable.
- Shopping preview has no reservation, order, or external side effect.
- Public package creation atomically persists a pending outbox event; delivery cannot release it to
  OmniPost until the public URL and content hash verify.
- Reconciliation recovers a public page whose worker crashed between external publication and the
  internal success transition.
- OmniPost retries preserve recipe version/content hash and cannot duplicate a channel publication.

### UI and browser tests

- Hans can build, review, reject/retry, approve, preview, and publish.
- Irma sees only published audience-matched versions.
- Mobile step navigation keeps its place across language changes.
- Missing and slow images preserve complete readable instructions.
- Keyboard, screen-reader, alt-text, focus, loading, and error states are usable.
- Board/print overflow, bilingual wrapping, responsive image crops, and ingredient/step cross-links
  pass for short and long recipes.
- Actor-specific views expose only the inventory, price, preference, and approval detail each role
  is allowed to see.

### Quality gates for implementation PRs

Run `pnpm run lint`, the focused unit/API/browser tests, and `pnpm run build` for schema, API,
routing, or type-sensitive changes. Record Sluice and Docket request evidence without prompts,
images, signed URLs, credentials, or resident identifiers.

## Publication gate

A recipe guidance version can publish only when:

- required identity, audience, bilingual summary, ingredient, and ordered-step fields are complete;
- ingredient quantities and step references are internally consistent;
- inventory and price labels show their snapshot time and distinguish unknown from unavailable;
- every suggestion passes hard actor/allergy/equipment constraints and retains its score rationale;
- food-safety, allergen, storage, and reheating fields have been reviewed where applicable;
- every required image is approved, stored by HOV, has bilingual alt text, and has complete rights
  and provenance metadata;
- optional unavailable images are explicitly waived and the text-only section remains usable;
- no asset remains merely generated or under review;
- the author has previewed both languages and the mobile step flow; and
- an authorized human explicitly publishes the immutable version.

External publication adds a second, independent gate: private fields are removed, the public package
hash matches the rendered page, structured data validates, rights permit public use, localized URLs
resolve, and the canonical public page is live before any OmniPost draft or schedule is created.

## Residual decisions

The implementation owner still needs explicit answers to these bounded decisions:

1. Which Sluice image model alias is approved first for HOV, and what output-rights policy applies?
2. Are generated prompts retained verbatim, redacted, or represented only by version plus hash?
3. Which sections require images versus allowing a text-only waiver?
4. What are the candidate-image retention period and per-recipe generation budget?
5. Which inventory/pricing source wins when household, receipt, and retailer observations disagree?
6. What default optimization profiles should ship, and who may change hard constraints or weights?
7. Which public brand/domain owns the recipe site, and will it live in this repo or a separate
   public-web repository?
8. Which OmniPost channel is the first legitimately accepted distribution target?
9. Is printable/PDF export part of the first release or a later consumer of the same structure?

These decisions do not block the deterministic section model, licensed/uploaded media support, or
review UI. They do block claiming that Sluice image generation is production-ready.
