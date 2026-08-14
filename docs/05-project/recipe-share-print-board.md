# Recipe share/print board

Visual target for shared and printed recipes.

**Reference image:** [assets/recipe-board-loaded-vienna-omelette.jpg](assets/recipe-board-loaded-vienna-omelette.jpg)

Source file: `C:\Users\smitj\Downloads\IMG-20260728-WA0036.jpg` (WhatsApp screenshot, preserved 2026-08-14). The board is the “Loaded Vienna, Potato & Onion Omelette” poster already named in [recipe-guidance-document-plan.md](recipe-guidance-document-plan.md).

## Goal

When a cook shares or prints a recipe, the output should look like this poster: one tall page, cream paper, green border, hero skillet photo, ingredients and method side by side, heat/timer badges, serve-with and chef-tips, optional upgrades along the bottom.

HOV must compose that page from approved recipe facts and approved photos. Do not generate the whole poster as one model image. Do not invent quantities, timers, or stock.

## Layout contract

Portrait infographic. Left column is facts; right column is the method.

| Region | What the screenshot shows | Source of truth |
| --- | --- | --- |
| Masthead | Stacked title, red accent on the dish name | Reviewed `titleEn` / `titleAf` |
| Attribute ribbon | Hearty · Easy · One-pan comfort food | Reviewed tags only |
| Metric strip | Serves 4, prep 15 min, cook 35–45 min | `servings`, `prepMinutes`, `cookMinutes` |
| Hero | Finished dish in a skillet | Approved licensed/uploaded hero |
| Ingredients | Bullets with quantities | Canonical `ingredients[]` |
| Safety callout | “About salt” lightbulb | Reviewed safety text, not model-only |
| Serve with | Pairings with small icons | Approved serve-with records |
| Chef’s tips | Green checkmarks | Reviewed tips |
| Method | Numbered steps 1–7 | Canonical `steps[]` in order |
| Step photo | Small process still per step | Approved step media, or omit |
| Heat/timer badge | Boil / med-high / low / grill + minutes | Structured timer + heat cue |
| Optional upgrades | Cheese, herbs, heat, mustard, chakalaka | Optional buy-lane items, marked optional |
| Footer | One-line close + “Enjoy!” | Reviewed footer copy |

## Share/print rules

- Render as HTML/CSS (or an equivalent deterministic layout) and export PNG/PDF. WhatsApp share-sheet and print must use the same composition.
- All labels, quantities, and timers are real text. Photos are separate approved assets.
- Do not put private inventory counts, other residents, or unreviewed AI copy on the shared image.
- Bilingual: same layout, `en` or `af` (or paired lines if space allows).
- Empty media: keep the step and badge; do not invent a photo.
- Optional upgrades stay optional. They must not look like required ingredients.

## Out of scope

Sluice generating the full poster. OmniPost auto-post. Demo recipes enabled by default.

## Baton

Parent epic: `d05f589e-7503-42be-bdc6-bc2011614273`. Board renderer: `18299213-7740-45e3-9a5a-904642b68f3d`. Share/print actions: `9746b6f9-b29c-4e7b-82ad-f67d76ad806e`.
