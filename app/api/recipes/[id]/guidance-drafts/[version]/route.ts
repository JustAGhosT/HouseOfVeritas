import { NextResponse } from "next/server"
import { z } from "zod"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import {
  createRecipeRevisionId,
  localizedTextSchema,
  parseRecipeGuidanceDocument,
  recipeGuidanceSectionSchema,
  type RecipeGuidanceDocument,
} from "@/lib/recipe-guidance"
import {
  RecipeGuidanceConflictError,
  getRecipeGuidanceRepository,
} from "@/lib/repositories/recipe-guidance-repository"
import { getRecipeById } from "@/lib/repositories/recipe-repository"

const sectionUpdateSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    section: recipeGuidanceSectionSchema
      .pick({ kind: true, applicability: true, blocks: true })
      .strict(),
  })
  .strict()

const mediaReviewSchema = z.discriminatedUnion("decision", [
  z
    .object({
      decision: z.literal("approve"),
      assetId: z.string().trim().min(1).max(200),
      altText: localizedTextSchema,
    })
    .strict(),
  z
    .object({
      decision: z.literal("reject"),
      assetId: z.string().trim().min(1).max(200),
      rejectionReason: z.string().trim().min(1).max(1_000),
    })
    .strict(),
])

const draftUpdateSchema = z.union([
  sectionUpdateSchema,
  z
    .object({
      expectedUpdatedAt: z.string().datetime({ offset: true }),
      mediaReview: mediaReviewSchema,
    })
    .strict(),
])

function parseVersion(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const version = Number(value)
  return Number.isSafeInteger(version) ? version : null
}

function advanceTimestamp(current: string): string {
  return new Date(Math.max(Date.now(), new Date(current).getTime() + 1)).toISOString()
}

function withoutReview(document: RecipeGuidanceDocument): RecipeGuidanceDocument {
  const mutable = { ...document }
  delete mutable.reviewedBy
  delete mutable.reviewedAt
  delete mutable.reviewEvidence
  return mutable
}

export const PATCH = withRole("admin")(async (request, context) => {
  try {
    const params = await context.params
    const recipeId = params?.id
    const version = parseVersion(params?.version)
    if (!recipeId) {
      return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })
    }
    if (version === null) {
      return NextResponse.json(
        { error: "A positive guidance version is required" },
        { status: 400 }
      )
    }

    let input: unknown
    try {
      input = await request.json()
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: "Malformed JSON in request body" }, { status: 400 })
      }
      throw error
    }
    const parsed = draftUpdateSchema.safeParse(input)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid recipe guidance draft update" }, { status: 400 })
    }
    if (
      "section" in parsed.data &&
      parsed.data.section.blocks.some(
        (block) => block.type === "text" && block.source !== "reviewed"
      )
    ) {
      return NextResponse.json(
        { error: "Updated text must be marked as human reviewed" },
        { status: 400 }
      )
    }

    const recipe = await getRecipeById(recipeId)
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })

    const { repository, mode } = await getRecipeGuidanceRepository()
    const document = (await repository.listByRecipeId(recipeId)).find(
      (candidate) => candidate.version === version
    )
    if (!document) {
      return NextResponse.json({ error: "Recipe guidance draft not found" }, { status: 404 })
    }
    if (document.status !== "draft" && document.status !== "in_review") {
      return NextResponse.json(
        { error: "Only draft or in-review guidance can be updated" },
        { status: 409 }
      )
    }
    if (document.recipeRevisionId !== createRecipeRevisionId(recipe.id, recipe.updatedAt)) {
      return NextResponse.json(
        { error: "Recipe changed; create a new guidance draft" },
        { status: 409 }
      )
    }

    const now = advanceTimestamp(document.updatedAt)
    let candidate: unknown
    let summary: Record<string, unknown>
    let invalidUpdateError = "Section update conflicts with the guidance document"
    if ("section" in parsed.data) {
      const sectionUpdate = parsed.data.section
      const sectionIndex = document.sections.findIndex(
        (section) => section.kind === sectionUpdate.kind
      )
      const currentSection = document.sections[sectionIndex]
      if (sectionIndex === -1 || !currentSection) {
        return NextResponse.json({ error: "Recipe guidance section not found" }, { status: 404 })
      }

      const sections = [...document.sections]
      sections[sectionIndex] = {
        id: currentSection.id,
        ...sectionUpdate,
      }
      candidate = { ...withoutReview(document), sections, updatedAt: now }
      summary = { mode, version: document.version, updatedSection: currentSection.kind }
    } else {
      invalidUpdateError = "Media review conflicts with the guidance document"
      const mediaReview = parsed.data.mediaReview
      const mediaAssetIndex = document.mediaAssets.findIndex(
        (asset) => asset.id === mediaReview.assetId
      )
      const currentAsset = document.mediaAssets[mediaAssetIndex]
      if (mediaAssetIndex === -1 || !currentAsset) {
        return NextResponse.json(
          { error: "Recipe guidance media asset not found" },
          { status: 404 }
        )
      }
      if (currentAsset.status !== "review_required") {
        return NextResponse.json(
          { error: "Only review-required media can record a review decision" },
          { status: 409 }
        )
      }

      const mediaAssets = [...document.mediaAssets]
      mediaAssets[mediaAssetIndex] =
        mediaReview.decision === "approve"
          ? {
              ...currentAsset,
              status: "approved",
              altText: mediaReview.altText,
              reviewedBy: context.userId,
              reviewedAt: now,
            }
          : {
              ...currentAsset,
              status: "rejected",
              rejectionReason: mediaReview.rejectionReason,
              reviewedBy: context.userId,
              reviewedAt: now,
            }
      candidate = { ...withoutReview(document), mediaAssets, updatedAt: now }
      summary = {
        mode,
        version: document.version,
        reviewedMediaAsset: currentAsset.id,
        decision: mediaReview.decision,
      }
    }

    const replacement = parseRecipeGuidanceDocument(candidate)
    if (!replacement) {
      return NextResponse.json({ error: invalidUpdateError }, { status: 400 })
    }

    const updatedDocument = await repository.replace(replacement, parsed.data.expectedUpdatedAt)
    return NextResponse.json({
      data: { document: updatedDocument },
      summary,
    })
  } catch (error) {
    if (error instanceof RecipeGuidanceConflictError) {
      return NextResponse.json(
        { error: "Recipe guidance changed; refresh and retry" },
        { status: 409 }
      )
    }
    logger.error("Failed to update recipe guidance draft", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Recipe guidance datastore is unavailable" }, { status: 503 })
  }
})
