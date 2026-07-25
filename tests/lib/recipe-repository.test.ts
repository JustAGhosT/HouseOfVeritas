import {
  countRecipes,
  createRecipe,
  getRecipeById,
  getRecipeMealInstanceById,
  getRecipeRating,
  listRecipeMealInstances,
  listRecipeRatings,
  listRecipes,
} from "@/lib/repositories/recipe-repository"
import type { RecipeRecord } from "@/lib/recipes"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const recipe: RecipeRecord = {
  id: "recipe-1",
  ownerUserId: "hans",
  status: "draft",
  audienceUserIds: ["hans", "irma"],
  titleEn: "Household supper",
  titleAf: "Huishoudelike aandete",
  summaryEn: "A practical supper.",
  summaryAf: "'n Praktiese aandete.",
  ingredients: [],
  steps: [],
  image: {
    url: "https://images.example/recipe.jpg",
    source: "Example",
    license: "CC BY 4.0",
    attributionText: "Example Author, CC BY 4.0",
    retrievedAt: "2026-07-25",
  },
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
}

describe("recipe repository clean production defaults", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CI", "")
    vi.stubEnv("E2E_TEST", "")
    vi.stubEnv("MONGODB_URI", "")
    vi.stubEnv("MONGO_URL", "")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns explicit empty read results when the production datastore is unconfigured", async () => {
    await expect(listRecipes()).resolves.toEqual([])
    await expect(countRecipes()).resolves.toBe(0)
    await expect(getRecipeById("recipe-1")).resolves.toBeNull()
    await expect(listRecipeMealInstances("recipe-1")).resolves.toEqual([])
    await expect(getRecipeMealInstanceById("meal-1")).resolves.toBeNull()
    await expect(listRecipeRatings("recipe-1")).resolves.toEqual([])
    await expect(getRecipeRating("recipe-1", "meal-1", "irma")).resolves.toBeNull()
  })

  it("rejects writes instead of persisting production data to a local fallback", async () => {
    await expect(createRecipe(recipe)).rejects.toThrow(
      "Recipe datastore is not configured. Set MONGODB_URI for production."
    )
  })
})
