import { describe, expect, it } from "vitest"
import { SAMPLE_RECIPES, findMissingSampleRecipes } from "@/lib/recipes"

function requiredText(value: string | undefined): string {
  expect(value?.trim().length).toBeGreaterThan(0)
  return value as string
}

describe("sample recipe catalog", () => {
  it("includes a published bilingual spaghetti bolognese for Hans and Irma", () => {
    const recipe = SAMPLE_RECIPES.find((item) =>
      item.titleEn.toLowerCase().includes("spaghetti bolognese")
    )

    expect(recipe).toBeDefined()
    expect(recipe?.status).toBe("published")
    expect(recipe?.audienceUserIds).toEqual(["hans", "irma"])
    expect(recipe?.servings).toBe(4)
    expect(requiredText(recipe?.titleAf).toLowerCase()).toContain("spaghetti bolognese")
    expect(requiredText(recipe?.summaryEn).toLowerCase()).toContain("mince")
    expect(requiredText(recipe?.summaryAf).toLowerCase()).toContain("mince")

    const ingredientNames = (recipe?.ingredients ?? []).map((ingredient) =>
      ingredient.name.toLowerCase()
    )
    expect(ingredientNames).toEqual(
      expect.arrayContaining([
        "cooking oil",
        "onions",
        "carrot",
        "beef mince",
        "ripe tomatoes",
        "spaghetti",
        "uncooked rice",
      ])
    )

    expect(recipe?.ingredients.some((ingredient) => String(ingredient.quantity) === "500")).toBe(
      true
    )
    expect(recipe?.steps.length).toBeGreaterThanOrEqual(7)
    expect(recipe?.steps.every((step) => step.instructionEn.trim() && step.instructionAf.trim())).toBe(
      true
    )
    expect(recipe?.image.source).toBe("Wikimedia Commons")
    expect(recipe?.image.license).toMatch(/^CC /)
    expect(recipe?.image.url).toContain("wikimedia.org")
    expect(requiredText(recipe?.image.attributionText)).toContain(recipe?.image.author ?? "")
  })

  it("finds only sample recipes whose English titles are not already stored", () => {
    const existing = [{ titleEn: SAMPLE_RECIPES[0].titleEn }]
    const missing = findMissingSampleRecipes(existing)

    expect(missing).toHaveLength(SAMPLE_RECIPES.length - 1)
    expect(missing.map((recipe) => recipe.titleEn)).not.toContain(SAMPLE_RECIPES[0].titleEn)
    expect(missing.some((recipe) => recipe.titleEn.toLowerCase().includes("spaghetti bolognese"))).toBe(
      true
    )
    expect(missing.some((recipe) => recipe.titleEn.toLowerCase().includes("sirloin skillet"))).toBe(
      true
    )
  })

  it("includes a published bilingual one-pan skillet for Hans and Irma", () => {
    const recipe = SAMPLE_RECIPES.find((item) =>
      item.titleEn.toLowerCase().includes("sirloin skillet")
    )

    expect(recipe).toBeDefined()
    expect(recipe?.status).toBe("published")
    expect(recipe?.audienceUserIds).toEqual(["hans", "irma"])
    expect(requiredText(recipe?.titleAf).toLowerCase()).toContain("sirloin")
    expect(requiredText(recipe?.summaryEn).toLowerCase()).toContain("three tomatoes")

    const ingredientNames = (recipe?.ingredients ?? []).map((ingredient) =>
      ingredient.name.toLowerCase()
    )
    expect(ingredientNames).toEqual(
      expect.arrayContaining([
        "bacon",
        "sausage",
        "sirloin",
        "potatoes",
        "onion",
        "carrot",
        "green pepper",
        "ripe tomatoes",
      ])
    )
    expect(recipe?.ingredients.some((ingredient) => ingredient.quantity === 3)).toBe(true)
    expect(recipe?.steps).toHaveLength(4)
    expect(recipe?.steps.every((step) => step.instructionEn.trim() && step.instructionAf.trim())).toBe(
      true
    )
    expect(recipe?.image.source).toBe("Wikimedia Commons")
    expect(recipe?.image.license).toMatch(/^CC /)
    expect(requiredText(recipe?.image.attributionText)).toContain(recipe?.image.author ?? "")
  })
})
