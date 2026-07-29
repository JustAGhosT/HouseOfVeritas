import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RecipeRecord } from "@/lib/recipes"

const mongoMocks = vi.hoisted(() => ({
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

import { replaceRecipe } from "@/lib/repositories/recipe-repository"

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

describe("recipe repository transaction session", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CI", "")
    vi.stubEnv("E2E_TEST", "")
    vi.stubEnv("MONGODB_URI", "mongodb://configured")
    mongoMocks.replaceOne.mockReset().mockResolvedValue({ matchedCount: 1 })
    mongoMocks.getCollection.mockReset().mockResolvedValue({
      replaceOne: mongoMocks.replaceOne,
    })
  })

  it("uses the supplied Mongo session for the target replacement", async () => {
    const session = { id: "session-1" }

    await expect(replaceRecipe(recipe, { session: session as never })).resolves.toEqual(
      expect.objectContaining({ id: recipe.id })
    )
    expect(mongoMocks.replaceOne).toHaveBeenCalledWith(
      { id: recipe.id },
      expect.objectContaining({ id: recipe.id }),
      { session }
    )
  })
})
