# Handoff - Kitchen recipes for Hans and Irma

- **Date:** 2026-07-24
- **Repo:** `C:\Users\smitj\repos\house-of-veritas`
- **Production:** `https://hov.neuralliquid.ai`
- **Status:** Next feature; no recipe implementation started.
- **Audience:** Hans and Irma initially.
- **Languages:** English and Afrikaans unless the product owner changes the bilingual pair.
- **Area:** Kitchen content, meal planning, recipe presentation, open-source media

## Product Goal

Create a practical recipe experience for Hans and Irma. Each recipe should provide:

- a clearly sourced, open-license picture;
- bilingual title, summary, ingredients, and instructions;
- numbered step-by-step preparation and cooking instructions;
- ingredient quantities, units, servings, prep time, and cook time;
- readable mobile presentation for kitchen use;
- a useful empty state when no recipes are configured.

The first screen should be the usable recipe list/detail experience, not a marketing page.

## Content and Licensing Requirements

- Store the image source URL, author/creator, license, attribution text, and retrieval date with every image.
- Prefer Wikimedia Commons, Unsplash, Pexels, or another source with a clear reusable license.
- Do not copy images without a license record or silently hotlink unstable assets.
- Keep recipe text and image metadata separate so content can be corrected without replacing media.
- Make attribution visible from the recipe detail view.

## Suggested Data Model

`Recipe` should have a stable ID, status (`draft`, `published`, `archived`), owner/audience links, image metadata, servings, prep/cook times, cuisine/category, and localized fields.

Use structured arrays rather than one large text field:

- `ingredients[]`: quantity, unit, ingredient name, optional preparation note, optional group/section;
- `steps[]`: ordinal, English instruction, Afrikaans instruction, optional timer and section;
- localized title/summary fields for `en` and `af`.

Keep recipe ownership and visibility explicit. Initial visibility can be Hans and Irma only, with a future household-wide option. Do not expose private drafts through the general resident inventory or kitchen APIs.

## Architecture Direction

- Reuse Mystira/Auth.js session resolution and existing HOV RBAC.
- Use the established repository boundary and existing Cosmos Mongo account for recipe records.
- Store only image references and attribution in Cosmos; use Azure Blob Storage for any HOV-hosted image copy.
- Add a dedicated recipe repository/API rather than extending the kitchen incident/meal-feedback route.
- Keep recipe generation/import separate from published content. Any AI-assisted translation or drafting must remain human-reviewable before publish.
- Preserve the existing kitchen meal-planning and feedback workflows; recipes should become a source those workflows can reference.

## Recommended Delivery Order

1. Inspect the current Irma meal-planning UI and existing kitchen route, then define the recipe schema and visibility rules.
2. Add Cosmos repository and API routes for list, detail, create/edit draft, publish, and archive.
3. Add a mobile recipe list/detail view with language toggle or paired bilingual sections, ingredient checklist, and numbered steps.
4. Add image sourcing/import with license and attribution validation.
5. Add Hans authoring/review controls and Irma read/use controls.
6. Add tests for authorization, bilingual completeness, ingredient/step validation, image attribution, empty states, and mobile browser flow.
7. Seed no demo recipes by default. Use an explicit import or controlled fixture for initial real recipes.

## Acceptance Criteria

- Hans can create and edit a draft recipe in both languages.
- Hans can publish or archive a recipe.
- Irma can view published recipes intended for her and use them comfortably on a phone.
- A published recipe cannot omit required bilingual fields, ingredients, ordered steps, or image license metadata.
- Every recipe image displays attributable source information.
- Unauthorized users cannot read private drafts or modify recipes.
- The feature works with empty Cosmos state and does not invent recipes by default.

## Current HOV Closeout Context

- Inventory persistence was merged in PR #123 as `e2cc6ba` and deployed successfully.
- Production health is healthy; `MONGODB_URI` and `DB_NAME` are configured.
- The existing kitchen endpoint handles meal feedback and cross-contamination reports; it is not a recipe repository.
- Existing Irma dashboard meal sections are empty-state surfaces and are likely the natural entry point for published recipes.

## Next Owner Action

Start with schema and UI inventory, then implement the recipe repository/API as a separate PR. Before sourcing images, record the permitted source/license policy in code and tests.
