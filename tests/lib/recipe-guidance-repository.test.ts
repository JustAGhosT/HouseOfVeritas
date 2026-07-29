import { beforeEach, describe, expect, it, vi } from "vitest"
import { RECIPE_GUIDANCE_SECTION_KINDS } from "@/lib/recipe-guidance"

const mongoMocks = vi.hoisted(() => ({
  configured: false,
  createIndex: vi.fn(),
  getCollection: vi.fn(),
}))

vi.mock("@/lib/db/mongodb", () => ({
  getCollection: mongoMocks.getCollection,
  isMongoConfigured: () => mongoMocks.configured,
  withoutMongoId: <T extends { _id?: unknown }>(document: T) => {
    const { _id, ...rest } = document
    return rest
  },
}))

import {
  RECIPE_GUIDANCE_COLLECTION,
  RecipeGuidanceConflictError,
  RecipeGuidanceStoreUnavailableError,
  getRecipeGuidanceRepository,
  resetRecipeGuidanceRepositoryForTests,
} from "@/lib/repositories/recipe-guidance-repository"

const now = "2026-07-29T08:00:00.000Z"

function buildDocument() {
  return {
    id: "recipe-1:guidance:1",
    recipeId: "recipe-1",
    recipeRevisionId: `recipe-1@${now}`,
    recipeUpdatedAt: now,
    recipeIngredientIds: ["ingredient-1"],
    recipeStepIds: ["step-1"],
    version: 1,
    status: "draft" as const,
    ownerUserId: "hans",
    audienceUserIds: ["irma"],
    sections: RECIPE_GUIDANCE_SECTION_KINDS.map((kind) => ({
      id: `section:${kind}`,
      kind,
      applicability: "required" as const,
      blocks: [],
    })),
    mediaAssets: [],
    imageBriefs: [],
    createdBy: "hans",
    createdAt: now,
    updatedAt: now,
  }
}

describe("recipe guidance repository", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("CI", "")
    vi.stubEnv("E2E_TEST", "")
    vi.stubEnv("ALLOW_DEMO_DATA", "false")
    mongoMocks.configured = false
    mongoMocks.createIndex.mockReset().mockResolvedValue("index")
    mongoMocks.getCollection.mockReset()
    resetRecipeGuidanceRepositoryForTests()
  })

  it("starts empty in test mode and stores independent document copies", async () => {
    const { repository, mode } = await getRecipeGuidanceRepository()
    const document = buildDocument()

    expect(mode).toBe("memory")
    expect(await repository.listByRecipeId(document.recipeId)).toEqual([])

    const stored = await repository.create(document)
    stored.ownerUserId = "changed-outside-repository"

    expect((await repository.findById(document.id))?.ownerUserId).toBe("hans")
    expect(await repository.listByRecipeId(document.recipeId)).toHaveLength(1)
  })

  it("rejects duplicate versions and stale replacements", async () => {
    const { repository } = await getRecipeGuidanceRepository()
    const document = buildDocument()
    await repository.create(document)

    await expect(repository.create({ ...document, id: "another-id" })).rejects.toBeInstanceOf(
      RecipeGuidanceConflictError
    )
    await expect(
      repository.replace(
        { ...document, status: "in_review", updatedAt: "2026-07-29T08:01:00.000Z" },
        "2026-07-29T07:59:00.000Z"
      )
    ).rejects.toBeInstanceOf(RecipeGuidanceConflictError)
  })

  it("requires every new version to begin as a draft", async () => {
    const { repository } = await getRecipeGuidanceRepository()

    await expect(
      repository.create({ ...buildDocument(), status: "in_review" })
    ).rejects.toBeInstanceOf(RecipeGuidanceConflictError)
  })

  it("fails closed when ordinary runtime has neither Mongo nor explicit demo mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    resetRecipeGuidanceRepositoryForTests()

    await expect(getRecipeGuidanceRepository()).rejects.toBeInstanceOf(
      RecipeGuidanceStoreUnavailableError
    )
  })

  it("uses an empty file store only when demo data is explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("ALLOW_DEMO_DATA", "true")
    resetRecipeGuidanceRepositoryForTests()

    const { repository, mode } = await getRecipeGuidanceRepository()

    expect(mode).toBe("file")
    expect(await repository.listByRecipeId("missing")).toEqual([])
  })

  it("uses the dedicated live collection and creates version indexes", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true
    mongoMocks.getCollection.mockResolvedValue({ createIndex: mongoMocks.createIndex })
    resetRecipeGuidanceRepositoryForTests()

    const { mode } = await getRecipeGuidanceRepository()

    expect(mode).toBe("mongodb")
    expect(mongoMocks.getCollection).toHaveBeenCalledWith(RECIPE_GUIDANCE_COLLECTION)
    expect(mongoMocks.createIndex).toHaveBeenCalledWith(
      { recipeId: 1, version: 1 },
      { unique: true }
    )
    expect(mongoMocks.createIndex).toHaveBeenCalledWith({
      recipeId: 1,
      status: 1,
      version: -1,
    })
  })
})
