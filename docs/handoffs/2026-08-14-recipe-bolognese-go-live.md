# Handoff — Two household recipes and missing-title seed

- **Date:** 2026-08-14
- **Repository:** `C:\Users\smitj\repos\house-of-veritas`
- **Risk tier:** Isolated catalog seed; no auth, deploy, or production write
- **Baton catalog/seed:** `9bd59d41-2b05-4561-85ec-16ac895a1f63`
- **Baton parent:** `35a3685d-dd61-44c4-8965-2b0cc1d1965a`

## Goal

Add two published bilingual household recipes to the explicit catalog seed, and let admin seed insert only titles that are not already stored.

## Recipes

1. **Spaghetti Bolognese (Savoury Mince)** — oil, 500 g mince, two onions, carrot, tomatoes, spice, spaghetti, leftover rice.
2. **Bacon, Sausage and Sirloin Skillet** — one pan; bacon and sausage first, then potato and chopped onion/carrot/green pepper; three tomatoes only wet the pan; sirloin last.
3. **Smoky Boerewors, Bacon and Tomato Rice Pot** — one pot; brown the coil whole; vegetables; rice; slice the wors back on top. Saves sirloin, potatoes, and spaghetti.
4. **Loaded Bacon, Tomato and Cheddar Potato Bake** — salted tomatoes, layered potatoes, bacon, pepper, cheddar at 190°C.
5. **Cheesy Bacon, Tomato and Pepper Spaghetti** — cheddar stirred through off the boil with pasta water.
6. **Boerewors, Potato and Cheddar Skillet** — parboil potatoes, brown the coil whole, melt cheddar on top.
7. **Cheesy Boerewors and Tomato Pasta Bake** — underdone spaghetti, tomato sauce, cheddar at 200°C or melt in a covered pan.
8. **Sirloin, Onion and Pepper Rice Bowls** — flash-fry sliced sirloin; cheddar optional.

All are audience `hans` + `irma`, with licensed Wikimedia image metadata.

## Code

- `SAMPLE_RECIPES` in `lib/recipes.ts` now includes those two recipes after the existing fried-rice and pap-sauce fixtures.
- `seedSampleRecipes({ force: false })` inserts missing English titles only. It no longer skips the whole catalog when any recipe already exists.
- `force: true` still inserts a full copy of every sample recipe.

## Changed files

- `lib/recipes.ts`
- `lib/repositories/recipe-repository.ts`
- `tests/lib/recipes.test.ts`
- `tests/lib/recipe-repository.test.ts`
- `docs/handoffs/2026-08-14-recipe-bolognese-go-live.md`
- `docs/README.md`
- `docs/README.agent.yaml`

## Verification

```text
pnpm test -- tests/lib/recipes.test.ts tests/lib/recipe-repository.test.ts
pnpm run lint
```

## Next owner action

1. Review and merge the PR.
2. After deploy, Hans can seed with `force: false` to insert only the missing titles. Do not send `force: true` unless duplicates are intended.
3. Irma can cook from `/dashboard/irma/recipes` using the canonical recipe card.

## Boundaries

No production write, demo-data default, provider call, or public package in this slice.
