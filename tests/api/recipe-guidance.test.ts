import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET as listDrafts } from "@/app/api/recipes/[id]/guidance-drafts/route"
import { POST as previewDraft } from "@/app/api/recipes/[id]/guidance-drafts/preview/route"
import { GET as readPublished } from "@/app/api/recipes/[id]/guidance/route"
import { buildRecipeGuidanceDraft } from "@/lib/recipe-guidance-builder"
import { getRecipeGuidanceRepository } from "@/lib/repositories/recipe-guidance-repository"
import { getRecipeById } from "@/lib/repositories/recipe-repository"
import type { RecipeRecord } from "@/lib/recipes"

vi.mock("@/lib/repositories/recipe-guidance-repository", () => ({
  getRecipeGuidanceRepository: vi.fn(),
}))

vi.mock("@/lib/repositories/recipe-repository", () => ({
  getRecipeById: vi.fn(),
}))

const routeContext = { params: Promise.resolve({ id: "recipe-1" }) }
const recipe: RecipeRecord = {
  id: "recipe-1",
  status: "published",
  ownerUserId: "hans",
  audienceUserIds: ["hans", "irma"],
  titleEn: "Household supper",
  titleAf: "Huishoudelike aandete",
  image: {
    url: "https://images.example/recipe.jpg",
    source: "Example library",
    license: "CC BY 4.0",
    attributionText: "Example Author, CC BY 4.0",
    retrievedAt: "2026-07-28",
  },
  ingredients: [{ id: "ingredient-1", name: "Rice" }],
  steps: [
    {
      id: "step-1",
      order: 1,
      instructionEn: "Cook the rice.",
      instructionAf: "Kook die rys.",
    },
  ],
  createdAt: "2026-07-28T09:00:00.000Z",
  updatedAt: "2026-07-29T09:00:00.000Z",
}
const existingDocument = buildRecipeGuidanceDraft(recipe, {
  version: 2,
  createdBy: "hans",
  now: "2026-07-29T09:30:00.000Z",
})
const repository = {
  listByRecipeId: vi.fn(),
  findById: vi.fn(),
  findLatestPublished: vi.fn(),
  create: vi.fn(),
  replace: vi.fn(),
}

function requestFor(path: string, userId: string, role: string, method = "GET") {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "x-user-id": userId,
      "x-user-role": role,
      "x-user-email": `${userId}@example.com`,
    },
  })
}

describe("recipe guidance APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRecipeById).mockResolvedValue(recipe)
    repository.listByRecipeId.mockResolvedValue([existingDocument])
    repository.findLatestPublished.mockResolvedValue(existingDocument)
    vi.mocked(getRecipeGuidanceRepository).mockResolvedValue({
      repository,
      mode: "memory",
    })
  })

  it("returns admin-only stored draft versions", async () => {
    const response = await listDrafts(
      requestFor("/api/recipes/recipe-1/guidance-drafts", "hans", "admin"),
      routeContext
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        documents: [
          {
            id: existingDocument.id,
            recipeId: existingDocument.recipeId,
            version: existingDocument.version,
          },
        ],
      },
      summary: { count: 1, mode: "memory" },
    })
  })

  it("builds a non-persisting preview at the next version", async () => {
    const response = await previewDraft(
      requestFor("/api/recipes/recipe-1/guidance-drafts/preview", "hans", "admin", "POST"),
      routeContext
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.recipe).toEqual(recipe)
    expect(body.data.document).toMatchObject({
      recipeId: "recipe-1",
      version: 3,
      status: "draft",
    })
    expect(body.summary).toEqual({ mode: "memory", persisted: false, nextVersion: 3 })
    expect(repository.create).not.toHaveBeenCalled()
  })

  it("does not expose draft listing or preview to residents", async () => {
    const listResponse = await listDrafts(
      requestFor("/api/recipes/recipe-1/guidance-drafts", "irma", "resident"),
      routeContext
    )
    const previewResponse = await previewDraft(
      requestFor("/api/recipes/recipe-1/guidance-drafts/preview", "irma", "resident", "POST"),
      routeContext
    )

    expect(listResponse.status).toBe(403)
    expect(previewResponse.status).toBe(403)
    expect(getRecipeGuidanceRepository).not.toHaveBeenCalled()
  })

  it("returns the latest published guidance to an authorized recipe audience member", async () => {
    const response = await readPublished(
      requestFor("/api/recipes/recipe-1/guidance", "irma", "resident"),
      routeContext
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: { recipe: { id: recipe.id }, document: { id: existingDocument.id } },
      summary: { version: 2 },
    })
  })

  it("checks recipe audience before reading guidance state", async () => {
    const response = await readPublished(
      requestFor("/api/recipes/recipe-1/guidance", "lucky", "employee"),
      routeContext
    )

    expect(response.status).toBe(403)
    expect(repository.findLatestPublished).not.toHaveBeenCalled()
  })

  it("fails closed instead of pairing a document with a newer recipe revision", async () => {
    vi.mocked(getRecipeById).mockResolvedValue({
      ...recipe,
      ingredients: [{ id: "ingredient-new", name: "Updated rice" }],
      updatedAt: "2026-07-29T10:00:00.000Z",
    })

    const response = await readPublished(
      requestFor("/api/recipes/recipe-1/guidance", "irma", "resident"),
      routeContext
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Published guidance recipe revision is unavailable",
    })
  })
})
