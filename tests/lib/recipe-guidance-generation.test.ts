import { describe, expect, it } from "vitest"
import { buildRecipeGuidanceDraft } from "@/lib/recipe-guidance-builder"
import {
  buildRecipeGuidanceGenerationRequest,
  RECIPE_GENERATION_REQUIRED_CAPABILITIES,
  recipeGuidanceGenerationRequestSchema,
} from "@/lib/recipe-guidance-generation"
import { planRecipeGuidanceMedia, reviewRecipeImageBrief } from "@/lib/recipe-guidance-media"
import type { RecipeRecord } from "@/lib/recipes"

const recipe: RecipeRecord = {
  id: "recipe-generation",
  status: "published",
  ownerUserId: "hans",
  audienceUserIds: ["hans", "irma"],
  titleEn: "Garden stew",
  titleAf: "Tuinbredie",
  image: {
    url: "https://example.com/stew.jpg",
    source: "Example library",
    license: "CC BY 4.0",
    attributionText: "Example cook",
    retrievedAt: "2026-07-31",
  },
  ingredients: [{ id: "ingredient-1", name: "Carrots" }],
  steps: [
    {
      id: "step-1",
      order: 1,
      instructionEn: "Simmer until tender.",
      instructionAf: "Prut tot sag.",
    },
  ],
  createdAt: "2026-07-31T08:00:00.000Z",
  updatedAt: "2026-07-31T08:00:00.000Z",
}

function plannedDocument() {
  const draft = buildRecipeGuidanceDraft(recipe, {
    version: 1,
    createdBy: "hans",
    now: "2026-07-31T08:05:00.000Z",
  })
  return planRecipeGuidanceMedia(draft, recipe, "2026-07-31T08:06:00.000Z")!.document
}

describe("recipe guidance generation request", () => {
  it("builds a provider-neutral request only from an approved brief", () => {
    const planned = plannedDocument()
    const brief = planned.imageBriefs[0]!
    const approved = reviewRecipeImageBrief(planned, {
      update: { action: "approve", briefId: brief.id },
      reviewerUserId: "hans",
      now: "2026-07-31T08:07:00.000Z",
    })!

    const request = buildRecipeGuidanceGenerationRequest(
      approved,
      brief.id,
      "hans",
      "2026-07-31T08:08:00.000Z"
    )

    expect(recipeGuidanceGenerationRequestSchema.safeParse(request).success).toBe(true)
    expect(request).toMatchObject({
      contractVersion: "recipe-image-generation.v1",
      requestedBy: "hans",
      target: { imageBriefId: brief.id, mediaAssetId: expect.any(String) },
      output: { storage: "hov_managed_copy_required", publicUrlAllowed: false },
      execution: { allowed: false, provider: null, modelAlias: null },
    })
    expect(request?.execution.missingCapabilities).toEqual(RECIPE_GENERATION_REQUIRED_CAPABILITIES)
  })

  it("fails closed for a draft brief or a non-planned media asset", () => {
    const planned = plannedDocument()
    const brief = planned.imageBriefs[0]!
    expect(
      buildRecipeGuidanceGenerationRequest(planned, brief.id, "hans", "2026-07-31T08:08:00.000Z")
    ).toBeNull()

    const approved = reviewRecipeImageBrief(planned, {
      update: { action: "approve", briefId: brief.id },
      reviewerUserId: "hans",
      now: "2026-07-31T08:07:00.000Z",
    })!
    const withReviewMedia = {
      ...approved,
      mediaAssets: approved.mediaAssets.map((asset) =>
        asset.imageBriefId === brief.id ? { ...asset, status: "review_required" as const } : asset
      ),
    }
    expect(
      buildRecipeGuidanceGenerationRequest(
        withReviewMedia,
        brief.id,
        "hans",
        "2026-07-31T08:08:00.000Z"
      )
    ).toBeNull()
  })
})
