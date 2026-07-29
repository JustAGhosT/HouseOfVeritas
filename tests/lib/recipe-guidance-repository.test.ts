import { rm } from "fs/promises"
import { join } from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RECIPE_GUIDANCE_SECTION_KINDS } from "@/lib/recipe-guidance"

const mongoMocks = vi.hoisted(() => ({
  configured: false,
  createIndex: vi.fn(),
  findOne: vi.fn(),
  getCollection: vi.fn(),
  insertOne: vi.fn(),
  replaceOne: vi.fn(),
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
  RecipeGuidanceIntegrityError,
  RecipeGuidanceStoreUnavailableError,
  getRecipeGuidanceRepository,
  resetRecipeGuidanceRepositoryForTests,
} from "@/lib/repositories/recipe-guidance-repository"

const now = "2026-07-29T08:00:00.000Z"
const demoFile = join(process.cwd(), "data", "recipe-guidance-documents.json")

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
  beforeEach(async () => {
    await rm(demoFile, { force: true })
    vi.unstubAllEnvs()
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("CI", "")
    vi.stubEnv("E2E_TEST", "")
    vi.stubEnv("ALLOW_DEMO_DATA", "false")
    mongoMocks.configured = false
    mongoMocks.createIndex.mockReset().mockResolvedValue("index")
    mongoMocks.findOne.mockReset()
    mongoMocks.getCollection.mockReset()
    mongoMocks.insertOne.mockReset()
    mongoMocks.replaceOne.mockReset()
    resetRecipeGuidanceRepositoryForTests()
  })

  afterEach(async () => {
    await rm(demoFile, { force: true })
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

  it("advances the concurrency token and rejects its reuse", async () => {
    const { repository } = await getRecipeGuidanceRepository()
    const document = buildDocument()
    await repository.create(document)

    await expect(
      repository.replace({ ...document, status: "in_review" }, document.updatedAt)
    ).rejects.toBeInstanceOf(RecipeGuidanceConflictError)

    const firstUpdate = {
      ...document,
      status: "in_review" as const,
      updatedAt: "2026-07-29T08:01:00.000Z",
    }
    await expect(repository.replace(firstUpdate, document.updatedAt)).resolves.toEqual(firstUpdate)

    await expect(
      repository.replace(
        { ...firstUpdate, updatedAt: "2026-07-29T08:02:00.000Z" },
        document.updatedAt
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

  it("serializes concurrent demo-file creates and compare-and-swap updates", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("ALLOW_DEMO_DATA", "true")
    resetRecipeGuidanceRepositoryForTests()
    const { repository } = await getRecipeGuidanceRepository()
    const document = buildDocument()
    const secondVersion = { ...document, id: "recipe-1:guidance:2", version: 2 }

    await Promise.all([repository.create(document), repository.create(secondVersion)])
    expect(await repository.listByRecipeId(document.recipeId)).toHaveLength(2)

    const results = await Promise.allSettled([
      repository.replace(
        { ...document, status: "in_review", updatedAt: "2026-07-29T08:01:00.000Z" },
        document.updatedAt
      ),
      repository.replace(
        { ...document, status: "in_review", updatedAt: "2026-07-29T08:02:00.000Z" },
        document.updatedAt
      ),
    ])

    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"])
    expect(results[1].status === "rejected" ? results[1].reason : null).toBeInstanceOf(
      RecipeGuidanceConflictError
    )
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

  it("maps Mongo duplicate and zero-match compare-and-swap results to conflicts", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true
    mongoMocks.getCollection.mockResolvedValue({
      createIndex: mongoMocks.createIndex,
      findOne: mongoMocks.findOne,
      insertOne: mongoMocks.insertOne,
      replaceOne: mongoMocks.replaceOne,
    })
    resetRecipeGuidanceRepositoryForTests()
    const { repository } = await getRecipeGuidanceRepository()
    const document = buildDocument()

    mongoMocks.insertOne.mockRejectedValueOnce({ code: 11000 })
    await expect(repository.create(document)).rejects.toBeInstanceOf(RecipeGuidanceConflictError)

    mongoMocks.findOne.mockResolvedValueOnce(document)
    mongoMocks.replaceOne.mockResolvedValueOnce({ matchedCount: 0 })
    await expect(
      repository.replace(
        { ...document, status: "in_review", updatedAt: "2026-07-29T08:01:00.000Z" },
        document.updatedAt
      )
    ).rejects.toBeInstanceOf(RecipeGuidanceConflictError)
  })

  it("fails closed when Mongo returns an invalid stored document", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true
    mongoMocks.findOne.mockResolvedValueOnce({ id: "invalid" })
    mongoMocks.getCollection.mockResolvedValue({
      createIndex: mongoMocks.createIndex,
      findOne: mongoMocks.findOne,
    })
    resetRecipeGuidanceRepositoryForTests()
    const { repository } = await getRecipeGuidanceRepository()

    await expect(repository.findById("invalid")).rejects.toBeInstanceOf(
      RecipeGuidanceIntegrityError
    )
  })
})
