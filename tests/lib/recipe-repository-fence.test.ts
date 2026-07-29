import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RecipeRecord } from "@/lib/recipes"

const mongoMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  getCollection: vi.fn(),
  replaceOne: vi.fn(),
}))

vi.mock("@/lib/db/mongodb", () => ({
  getCollection: mongoMocks.getCollection,
  isMongoConfigured: () => true,
  withoutMongoId: <T extends { _id?: unknown }>(document: T) => {
    const { _id, ...rest } = document
    return rest
  },
}))

import { getRecipeById, replaceRecipe } from "@/lib/repositories/recipe-repository"

const recipe: RecipeRecord = {
  id: "recipe-1",
  ownerUserId: "hans",
  status: "draft",
  audienceUserIds: ["hans"],
  titleEn: "Supper",
  titleAf: "Aandete",
  ingredients: [],
  steps: [],
  image: {
    url: "https://images.example/recipe.jpg",
    source: "Example",
    license: "CC BY 4.0",
    attributionText: "Example Author, CC BY 4.0",
    retrievedAt: "2026-07-29",
  },
  createdAt: "2026-07-29T08:00:00.000Z",
  updatedAt: "2026-07-29T08:00:00.000Z",
}

describe("recipe repository mutation fencing", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CI", "")
    vi.stubEnv("E2E_TEST", "")
    vi.stubEnv("MONGODB_URI", "mongodb://configured")
    mongoMocks.findOne.mockReset()
    mongoMocks.replaceOne.mockReset().mockResolvedValue({ matchedCount: 1 })
    mongoMocks.getCollection.mockReset().mockResolvedValue({
      findOne: mongoMocks.findOne,
      replaceOne: mongoMocks.replaceOne,
    })
  })

  it("conditions a live replacement on a newer fencing token", async () => {
    const updated = await replaceRecipe(recipe, { mutationFence: 11 })

    expect(updated).not.toHaveProperty("mutationFence")
    expect(mongoMocks.replaceOne).toHaveBeenCalledWith(
      {
        id: recipe.id,
        $or: [{ mutationFence: { $exists: false } }, { mutationFence: { $lt: 11 } }],
      },
      expect.objectContaining({ id: recipe.id, mutationFence: 11 })
    )
  })

  it("does not expose an internal fencing token on reads", async () => {
    mongoMocks.findOne.mockResolvedValueOnce({ ...recipe, mutationFence: 11 })

    await expect(getRecipeById(recipe.id)).resolves.toEqual(recipe)
  })
})
