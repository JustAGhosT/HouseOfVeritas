import { describe, expect, it } from "vitest"
import { RecipeGuidanceBuildError, buildRecipeGuidanceDraft } from "@/lib/recipe-guidance-builder"
import { RECIPE_GUIDANCE_SECTION_KINDS } from "@/lib/recipe-guidance"
import type { RecipeRecord } from "@/lib/recipes"

const now = "2026-07-29T10:00:00.000Z"

const recipe: RecipeRecord = {
  id: "recipe-1",
  status: "published",
  ownerUserId: "hans",
  audienceUserIds: ["irma", "hans"],
  titleEn: "Household supper",
  summaryEn: "A practical supper.",
  titleAf: "Huishoudelike aandete",
  summaryAf: "'n Praktiese aandete.",
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 20,
  image: {
    url: "https://images.example/recipe.jpg",
    source: "Example library",
    author: "Example Author",
    license: "CC BY 4.0",
    attributionText: "Example Author, CC BY 4.0",
    retrievedAt: "2026-07-28",
  },
  ingredients: [
    { id: "ingredient-1", name: "Rice", quantity: 2, unit: "cups" },
    { id: "ingredient-2", name: "Eggs", quantity: 4 },
  ],
  steps: [
    {
      id: "step-2",
      order: 2,
      instructionEn: "Serve.",
      instructionAf: "Bedien.",
    },
    {
      id: "step-1",
      order: 1,
      instructionEn: "Cook the rice.",
      instructionAf: "Kook die rys.",
      timerMinutes: 10,
    },
  ],
  createdAt: "2026-07-28T09:00:00.000Z",
  updatedAt: "2026-07-29T09:00:00.000Z",
}

describe("buildRecipeGuidanceDraft", () => {
  it("builds the same canonical document for the same explicit inputs", () => {
    const options = { version: 2, createdBy: "hans", now }

    expect(buildRecipeGuidanceDraft(recipe, options)).toEqual(
      buildRecipeGuidanceDraft(recipe, options)
    )
  })

  it("preserves the immutable recipe manifests and fixed section order", () => {
    const document = buildRecipeGuidanceDraft(recipe, {
      version: 2,
      createdBy: "hans",
      now,
    })

    expect(document.recipeRevisionId).toBe(`recipe-1@${recipe.updatedAt}`)
    expect(document.recipeIngredientIds).toEqual(["ingredient-1", "ingredient-2"])
    expect(document.recipeStepIds).toEqual(["step-1", "step-2"])
    expect(document.sections.map((section) => section.kind)).toEqual(RECIPE_GUIDANCE_SECTION_KINDS)
    expect(document.sections.find((section) => section.kind === "ingredients")?.blocks).toEqual([
      expect.objectContaining({
        type: "ingredient_references",
        ingredientIds: ["ingredient-1", "ingredient-2"],
      }),
    ])
  })

  it("maps ordered steps and timers without inventing reviewed prose", () => {
    const document = buildRecipeGuidanceDraft(recipe, {
      version: 1,
      createdBy: "hans",
      now,
    })
    const identity = document.sections.find((section) => section.kind === "identity")
    const cooking = document.sections.find((section) => section.kind === "cooking")

    expect(identity?.blocks).toEqual([
      expect.objectContaining({
        type: "text",
        source: "recipe",
        text: { en: recipe.titleEn, af: recipe.titleAf },
      }),
      expect.objectContaining({
        type: "text",
        source: "recipe",
        text: { en: recipe.summaryEn, af: recipe.summaryAf },
      }),
      expect.objectContaining({ type: "metrics" }),
    ])
    expect(cooking?.blocks).toEqual([
      expect.objectContaining({
        type: "step_reference",
        recipeStepId: "step-1",
        timer: { minimumSeconds: 600 },
      }),
      expect.objectContaining({ type: "step_reference", recipeStepId: "step-2" }),
    ])
  })

  it("keeps licensed hero media review-required", () => {
    const document = buildRecipeGuidanceDraft(recipe, {
      version: 1,
      createdBy: "hans",
      now,
    })

    expect(document.mediaAssets).toEqual([
      expect.objectContaining({
        role: "hero",
        status: "review_required",
        source: expect.objectContaining({ type: "licensed", license: "CC BY 4.0" }),
      }),
    ])
    expect(document.imageBriefs).toEqual([])
  })

  it("rejects recipes that cannot supply canonical ingredient and step references", () => {
    expect(() =>
      buildRecipeGuidanceDraft(
        { ...recipe, ingredients: [] },
        { version: 1, createdBy: "hans", now }
      )
    ).toThrow(RecipeGuidanceBuildError)
  })
})
