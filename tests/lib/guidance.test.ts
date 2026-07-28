import { describe, expect, it } from "vitest"
import { parseGuidanceDraft, recipeToGuidanceDraft } from "@/lib/guidance"
import type { RecipeRecord } from "@/lib/recipes"

describe("task guidance", () => {
  it("normalizes AI step ordering", () => {
    const draft = parseGuidanceDraft({
      kind: "procedure",
      locale: "en",
      title: "Repair the sill",
      summary: "Prepare and repair the damaged plaster.",
      materials: ["Cement"],
      tools: ["Trowel"],
      safety: ["Wear eye protection"],
      steps: [
        { order: 8, title: "Prepare", instruction: "Remove loose material." },
        { order: 4, title: "Repair", instruction: "Apply the repair mix." },
      ],
    })

    expect(draft?.steps.map((step) => step.order)).toEqual([1, 2])
  })

  it("rejects guidance without actionable steps", () => {
    expect(
      parseGuidanceDraft({
        kind: "procedure",
        locale: "en",
        title: "Incomplete",
        summary: "No steps supplied.",
        steps: [],
      })
    ).toBeNull()
  })

  it("rejects contradictory immutable recipe provenance", () => {
    expect(
      parseGuidanceDraft({
        kind: "recipe",
        locale: "en",
        title: "Fried rice",
        summary: "A quick meal.",
        sourceRecipeId: "recipe-a",
        sourceRecipeUpdatedAt: "2026-07-24T00:00:00.000Z",
        sourceRecipeRevisionId: "recipe-b@2026-07-24T00:00:00.000Z",
        steps: [
          {
            order: 1,
            title: "Cook",
            instruction: "Cook the rice.",
            sourceRecipeStepId: "cook",
            sourceRecipeRevisionId: "recipe-c@2026-07-24T00:00:00.000Z",
          },
        ],
      })
    ).toBeNull()
  })

  it("adapts recipes into the shared guidance shape", () => {
    const recipe = {
      id: "recipe-1",
      status: "published",
      ownerUserId: "hans",
      audienceUserIds: ["irma"],
      titleEn: "Fried rice",
      titleAf: "Gebraaide rys",
      summaryEn: "A quick meal.",
      summaryAf: "n Vinnige maaltyd.",
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 20,
      cuisine: "Household",
      category: "Dinner",
      image: {
        url: "/rice.jpg",
        source: "local",
        author: "House",
        license: "Owned",
        attributionText: "House",
        retrievedAt: "2026-07-24",
      },
      ingredients: [{ id: "rice", quantity: "2", unit: "cups", name: "rice" }],
      steps: [
        {
          id: "cook",
          order: 1,
          instructionEn: "Cook the rice.",
          instructionAf: "Kook die rys.",
        },
      ],
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
    } satisfies RecipeRecord

    const guidance = recipeToGuidanceDraft(recipe, "af")
    expect(guidance.kind).toBe("recipe")
    expect(guidance.title).toBe("Gebraaide rys")
    expect(guidance.steps[0].instruction).toBe("Kook die rys.")
    expect(guidance.sourceRecipeId).toBe("recipe-1")
    expect(guidance.sourceRecipeRevisionId).toBe("recipe-1@2026-07-24T00:00:00.000Z")
    expect(guidance.sourceRecipeIngredientIds).toEqual(["rice"])
    expect(guidance.steps[0].sourceRecipeStepId).toBe("cook")
    expect(guidance.steps[0].sourceRecipeRevisionId).toBe("recipe-1@2026-07-24T00:00:00.000Z")
  })
})
