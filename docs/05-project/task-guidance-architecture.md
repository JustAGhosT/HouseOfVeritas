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
