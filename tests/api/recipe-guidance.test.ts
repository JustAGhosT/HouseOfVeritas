import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  GET as listDrafts,
  POST as createDraft,
} from "@/app/api/recipes/[id]/guidance-drafts/route"
import { PATCH as updateDraftSection } from "@/app/api/recipes/[id]/guidance-drafts/[version]/route"
import { GET as inspectPublicationReadiness } from "@/app/api/recipes/[id]/guidance-drafts/[version]/publication-readiness/route"
import { POST as transitionDraft } from "@/app/api/recipes/[id]/guidance-drafts/[version]/transitions/route"
import { POST as previewDraft } from "@/app/api/recipes/[id]/guidance-drafts/preview/route"
import { GET as readPublished } from "@/app/api/recipes/[id]/guidance/route"
import { buildRecipeGuidanceDraft } from "@/lib/recipe-guidance-builder"
import { parseRecipeGuidanceDocument } from "@/lib/recipe-guidance"
import { getRecipeGuidanceRepository } from "@/lib/repositories/recipe-guidance-repository"
import { getRecipeById } from "@/lib/repositories/recipe-repository"
import type { RecipeRecord } from "@/lib/recipes"

vi.mock("@/lib/repositories/recipe-guidance-repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repositories/recipe-guidance-repository")>()),
  getRecipeGuidanceRepository: vi.fn(),
}))

vi.mock("@/lib/repositories/recipe-repository", () => ({
  getRecipeById: vi.fn(),
}))

const routeContext = { params: Promise.resolve({ id: "recipe-1" }) }
const versionRouteContext = { params: Promise.resolve({ id: "recipe-1", version: "2" }) }
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
const reviewEvidence = {
  bilingualContentReviewed: true,
  allergensAndSafetyReviewed: true,
  provenanceAndRightsReviewed: true,
  optionalMediaWaiverAssetIds: [],
} as const
const repository = {
  listByRecipeId: vi.fn(),
  findById: vi.fn(),
  findLatestPublished: vi.fn(),
  create: vi.fn(),
  replace: vi.fn(),
}

function buildPublishableInReviewDocument() {
  const document = parseRecipeGuidanceDocument({
    ...existingDocument,
    status: "in_review",
    reviewedBy: "hans",
    reviewedAt: "2026-07-29T09:45:00.000Z",
    reviewEvidence,
    sections: existingDocument.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) =>
        block.type === "text" ? { ...block, source: "reviewed" as const } : block
      ),
    })),
    mediaAssets: existingDocument.mediaAssets.map((asset) => ({
      ...asset,
      status: "approved" as const,
      altText: { en: "Finished household supper.", af: "Voltooide huishoudelike aandete." },
      reviewedBy: "hans",
      reviewedAt: "2026-07-29T09:45:00.000Z",
    })),
  })
  if (!document) throw new Error("Expected publishable in-review fixture")
  return document
}

function buildPublishedDocument() {
  const inReview = buildPublishableInReviewDocument()
  const document = parseRecipeGuidanceDocument({
    ...inReview,
    status: "published",
    publishedBy: "hans",
    publishedAt: "2026-07-29T10:00:00.000Z",
    updatedAt: "2026-07-29T10:00:00.000Z",
  })
  if (!document) throw new Error("Expected published fixture")
  return document
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

function jsonRequestFor(path: string, userId: string, role: string, method: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-user-id": userId,
      "x-user-role": role,
      "x-user-email": `${userId}@example.com`,
    },
    body: JSON.stringify(body),
  })
}

describe("recipe guidance APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRecipeById).mockResolvedValue(recipe)
    repository.listByRecipeId.mockResolvedValue([existingDocument])
    repository.findLatestPublished.mockResolvedValue(existingDocument)
    repository.create.mockImplementation(async (document) => document)
    repository.replace.mockImplementation(async (document) => document)
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

  it("persists an explicit deterministic draft at the next version", async () => {
    const response = await createDraft(
      requestFor("/api/recipes/recipe-1/guidance-drafts", "hans", "admin", "POST"),
      routeContext
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.recipe).toEqual(recipe)
    expect(body.data.document).toMatchObject({
      recipeId: "recipe-1",
      version: 3,
      status: "draft",
      createdBy: "hans",
    })
    expect(body.summary).toEqual({ mode: "memory", persisted: true, version: 3 })
    expect(repository.create).toHaveBeenCalledOnce()
  })

  it("returns a refreshable conflict when concurrent draft creation wins", async () => {
    const { RecipeGuidanceConflictError } =
      await import("@/lib/repositories/recipe-guidance-repository")
    repository.create.mockRejectedValueOnce(new RecipeGuidanceConflictError("duplicate"))

    const response = await createDraft(
      requestFor("/api/recipes/recipe-1/guidance-drafts", "hans", "admin", "POST"),
      routeContext
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Recipe guidance version already exists; refresh and retry",
    })
  })

  it("updates one human-reviewed section with optimistic concurrency", async () => {
    const identity = existingDocument.sections.find((section) => section.kind === "identity")!
    const reviewedBlocks = identity.blocks.map((block) =>
      block.type === "text" ? { ...block, source: "reviewed" as const } : block
    )

    const response = await updateDraftSection(
      jsonRequestFor("/api/recipes/recipe-1/guidance-drafts/2", "hans", "admin", "PATCH", {
        expectedUpdatedAt: existingDocument.updatedAt,
        section: {
          kind: "identity",
          applicability: "required",
          blocks: reviewedBlocks,
        },
      }),
      versionRouteContext
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary).toEqual({ mode: "memory", version: 2, updatedSection: "identity" })
    expect(repository.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existingDocument.id,
        sections: expect.arrayContaining([
          expect.objectContaining({ id: identity.id, kind: "identity", blocks: reviewedBlocks }),
        ]),
      }),
      existingDocument.updatedAt
    )
    const replacement = repository.replace.mock.calls[0][0]
    expect(new Date(replacement.updatedAt).getTime()).toBeGreaterThan(
      new Date(existingDocument.updatedAt).getTime()
    )
  })

  it("rejects recipe-sourced text through the reviewed section endpoint", async () => {
    const identity = existingDocument.sections.find((section) => section.kind === "identity")!

    const response = await updateDraftSection(
      jsonRequestFor("/api/recipes/recipe-1/guidance-drafts/2", "hans", "admin", "PATCH", {
        expectedUpdatedAt: existingDocument.updatedAt,
        section: {
          kind: "identity",
          applicability: "required",
          blocks: identity.blocks,
        },
      }),
      versionRouteContext
    )

    expect(response.status).toBe(400)
    expect(repository.replace).not.toHaveBeenCalled()
  })

  it("rejects section blocks that conflict with the immutable recipe manifest", async () => {
    const cooking = existingDocument.sections.find((section) => section.kind === "cooking")!
    const invalidBlocks = cooking.blocks.map((block) =>
      block.type === "step_reference"
        ? { ...block, recipeStepId: "step-from-another-recipe" }
        : block
    )

    const response = await updateDraftSection(
      jsonRequestFor("/api/recipes/recipe-1/guidance-drafts/2", "hans", "admin", "PATCH", {
        expectedUpdatedAt: existingDocument.updatedAt,
        section: {
          kind: "cooking",
          applicability: "required",
          blocks: invalidBlocks,
        },
      }),
      versionRouteContext
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Section update conflicts with the guidance document",
    })
    expect(repository.replace).not.toHaveBeenCalled()
  })

  it("fails closed when the recipe changed after the draft snapshot", async () => {
    vi.mocked(getRecipeById).mockResolvedValue({
      ...recipe,
      updatedAt: "2026-07-29T10:00:00.000Z",
    })
    const cooking = existingDocument.sections.find((section) => section.kind === "cooking")!

    const response = await updateDraftSection(
      jsonRequestFor("/api/recipes/recipe-1/guidance-drafts/2", "hans", "admin", "PATCH", {
        expectedUpdatedAt: existingDocument.updatedAt,
        section: {
          kind: "cooking",
          applicability: "required",
          blocks: cooking.blocks,
        },
      }),
      versionRouteContext
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Recipe changed; create a new guidance draft",
    })
    expect(repository.replace).not.toHaveBeenCalled()
  })

  it("maps stale optimistic concurrency tokens to a refreshable conflict", async () => {
    const { RecipeGuidanceConflictError } =
      await import("@/lib/repositories/recipe-guidance-repository")
    repository.replace.mockRejectedValueOnce(new RecipeGuidanceConflictError("stale"))
    const cooking = existingDocument.sections.find((section) => section.kind === "cooking")!

    const response = await updateDraftSection(
      jsonRequestFor("/api/recipes/recipe-1/guidance-drafts/2", "hans", "admin", "PATCH", {
        expectedUpdatedAt: existingDocument.updatedAt,
        section: {
          kind: "cooking",
          applicability: "required",
          blocks: cooking.blocks,
        },
      }),
      versionRouteContext
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Recipe guidance changed; refresh and retry",
    })
  })

  it("invalidates completed review evidence when an in-review section changes", async () => {
    const inReview = buildPublishableInReviewDocument()
    repository.listByRecipeId.mockResolvedValueOnce([inReview])
    const identity = inReview.sections.find((section) => section.kind === "identity")!

    const response = await updateDraftSection(
      jsonRequestFor("/api/recipes/recipe-1/guidance-drafts/2", "hans", "admin", "PATCH", {
        expectedUpdatedAt: inReview.updatedAt,
        section: {
          kind: "identity",
          applicability: "required",
          blocks: identity.blocks,
        },
      }),
      versionRouteContext
    )

    expect(response.status).toBe(200)
    const replacement = repository.replace.mock.calls[0][0]
    expect(replacement).not.toHaveProperty("reviewedBy")
    expect(replacement).not.toHaveProperty("reviewedAt")
    expect(replacement).not.toHaveProperty("reviewEvidence")
  })

  it("submits a draft for review and records explicit review approval", async () => {
    const submitResponse = await transitionDraft(
      jsonRequestFor(
        "/api/recipes/recipe-1/guidance-drafts/2/transitions",
        "hans",
        "admin",
        "POST",
        {
          action: "submit_for_review",
          expectedUpdatedAt: existingDocument.updatedAt,
        }
      ),
      versionRouteContext
    )
    expect(submitResponse.status).toBe(200)
    expect(repository.replace).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "in_review" }),
      existingDocument.updatedAt
    )

    const inReview = { ...existingDocument, status: "in_review" as const }
    repository.listByRecipeId.mockResolvedValueOnce([inReview])
    const approveResponse = await transitionDraft(
      jsonRequestFor(
        "/api/recipes/recipe-1/guidance-drafts/2/transitions",
        "hans",
        "admin",
        "POST",
        {
          action: "approve_review",
          expectedUpdatedAt: inReview.updatedAt,
          evidence: reviewEvidence,
        }
      ),
      versionRouteContext
    )

    expect(approveResponse.status).toBe(200)
    expect(repository.replace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "in_review",
        reviewedBy: "hans",
        reviewEvidence,
      }),
      inReview.updatedAt
    )
  })

  it("reports deterministic publication blockers and refuses incomplete publication", async () => {
    const readinessResponse = await inspectPublicationReadiness(
      requestFor("/api/recipes/recipe-1/guidance-drafts/2/publication-readiness", "hans", "admin"),
      versionRouteContext
    )
    const readinessBody = await readinessResponse.json()
    expect(readinessResponse.status).toBe(200)
    expect(readinessBody.data.ready).toBe(false)
    expect(readinessBody.data.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "reviewEvidence" })])
    )

    repository.listByRecipeId.mockResolvedValueOnce([
      { ...existingDocument, status: "in_review" as const },
    ])
    const publishResponse = await transitionDraft(
      jsonRequestFor(
        "/api/recipes/recipe-1/guidance-drafts/2/transitions",
        "hans",
        "admin",
        "POST",
        {
          action: "publish",
          expectedUpdatedAt: existingDocument.updatedAt,
        }
      ),
      versionRouteContext
    )
    expect(publishResponse.status).toBe(422)
    await expect(publishResponse.json()).resolves.toMatchObject({
      error: "Recipe guidance is not ready to publish",
    })
    expect(repository.replace).not.toHaveBeenCalled()
  })

  it("publishes only a reviewed ready version and archives it without changing content", async () => {
    const inReview = buildPublishableInReviewDocument()
    repository.listByRecipeId.mockResolvedValueOnce([inReview])
    const publishResponse = await transitionDraft(
      jsonRequestFor(
        "/api/recipes/recipe-1/guidance-drafts/2/transitions",
        "hans",
        "admin",
        "POST",
        {
          action: "publish",
          expectedUpdatedAt: inReview.updatedAt,
        }
      ),
      versionRouteContext
    )
    expect(publishResponse.status).toBe(200)
    expect(repository.replace).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "published", publishedBy: "hans" }),
      inReview.updatedAt
    )

    const published = buildPublishedDocument()
    repository.listByRecipeId.mockResolvedValueOnce([published])
    const archiveResponse = await transitionDraft(
      jsonRequestFor(
        "/api/recipes/recipe-1/guidance-drafts/2/transitions",
        "hans",
        "admin",
        "POST",
        {
          action: "archive",
          expectedUpdatedAt: published.updatedAt,
        }
      ),
      versionRouteContext
    )
    expect(archiveResponse.status).toBe(200)
    expect(repository.replace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: published.id,
        status: "archived",
        sections: published.sections,
        mediaAssets: published.mediaAssets,
      }),
      published.updatedAt
    )
  })

  it("keeps lifecycle and readiness routes admin-only", async () => {
    const transitionResponse = await transitionDraft(
      jsonRequestFor(
        "/api/recipes/recipe-1/guidance-drafts/2/transitions",
        "irma",
        "resident",
        "POST",
        {
          action: "submit_for_review",
          expectedUpdatedAt: existingDocument.updatedAt,
        }
      ),
      versionRouteContext
    )
    const readinessResponse = await inspectPublicationReadiness(
      requestFor(
        "/api/recipes/recipe-1/guidance-drafts/2/publication-readiness",
        "irma",
        "resident"
      ),
      versionRouteContext
    )

    expect(transitionResponse.status).toBe(403)
    expect(readinessResponse.status).toBe(403)
    expect(getRecipeGuidanceRepository).not.toHaveBeenCalled()
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
    const createResponse = await createDraft(
      requestFor("/api/recipes/recipe-1/guidance-drafts", "irma", "resident", "POST"),
      routeContext
    )
    const updateResponse = await updateDraftSection(
      jsonRequestFor("/api/recipes/recipe-1/guidance-drafts/2", "irma", "resident", "PATCH", {}),
      versionRouteContext
    )

    expect(listResponse.status).toBe(403)
    expect(previewResponse.status).toBe(403)
    expect(createResponse.status).toBe(403)
    expect(updateResponse.status).toBe(403)
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
