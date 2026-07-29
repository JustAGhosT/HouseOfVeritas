import { NextResponse } from "next/server"
import { z } from "zod"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import {
  createRecipeRevisionId,
  getRecipeGuidancePublicationReadiness,
  parseRecipeGuidanceDocument,
  recipeGuidanceReviewEvidenceSchema,
  type RecipeGuidanceDocument,
} from "@/lib/recipe-guidance"
import {
  RecipeGuidanceConflictError,
  getRecipeGuidanceRepository,
} from "@/lib/repositories/recipe-guidance-repository"
import {
  RecipeMutationConflictError,
  withRecipeMutationLock,
} from "@/lib/repositories/recipe-mutation-lock"
import { getRecipeById } from "@/lib/repositories/recipe-repository"

const concurrencyToken = z.string().datetime({ offset: true })
const transitionInputSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("submit_for_review"), expectedUpdatedAt: concurrencyToken })
    .strict(),
  z
    .object({
      action: z.literal("approve_review"),
      expectedUpdatedAt: concurrencyToken,
      evidence: recipeGuidanceReviewEvidenceSchema,
    })
    .strict(),
  z.object({ action: z.literal("publish"), expectedUpdatedAt: concurrencyToken }).strict(),
  z.object({ action: z.literal("archive"), expectedUpdatedAt: concurrencyToken }).strict(),
])
type TransitionInput = z.infer<typeof transitionInputSchema>

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

async function applyTransition(params: {
  recipeId: string
  version: number
  input: TransitionInput
  userId: string
}): Promise<NextResponse> {
  const recipe = await getRecipeById(params.recipeId)
  if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })

  const { repository, mode } = await getRecipeGuidanceRepository()
  const document = (await repository.listByRecipeId(params.recipeId)).find(
    (candidate) => candidate.version === params.version
  )
  if (!document) {
    return NextResponse.json({ error: "Recipe guidance draft not found" }, { status: 404 })
  }

  const { action, expectedUpdatedAt } = params.input
  if (
    action !== "archive" &&
    document.recipeRevisionId !== createRecipeRevisionId(recipe.id, recipe.updatedAt)
  ) {
    return NextResponse.json(
      { error: "Recipe changed; create a new guidance draft" },
      { status: 409 }
    )
  }

  const now = advanceTimestamp(document.updatedAt)
  let candidate: unknown
  if (action === "submit_for_review") {
    if (document.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft guidance can be submitted for review" },
        { status: 409 }
      )
    }
    candidate = { ...withoutReview(document), status: "in_review", updatedAt: now }
  } else if (action === "approve_review") {
    if (document.status !== "in_review") {
      return NextResponse.json(
        { error: "Only in-review guidance can record review approval" },
        { status: 409 }
      )
    }
    candidate = {
      ...document,
      reviewedBy: params.userId,
      reviewedAt: now,
      reviewEvidence: params.input.evidence,
      updatedAt: now,
    }
  } else if (action === "publish") {
    if (document.status !== "in_review") {
      return NextResponse.json(
        { error: "Only in-review guidance can be published" },
        { status: 409 }
      )
    }
    const readiness = getRecipeGuidancePublicationReadiness(document)
    if (!readiness.ready) {
      return NextResponse.json(
        { error: "Recipe guidance is not ready to publish", issues: readiness.issues },
        { status: 422 }
      )
    }
    candidate = {
      ...document,
      status: "published",
      publishedBy: params.userId,
      publishedAt: now,
      updatedAt: now,
    }
  } else {
    if (document.status !== "published") {
      return NextResponse.json(
        { error: "Only published guidance can be archived" },
        { status: 409 }
      )
    }
    candidate = { ...document, status: "archived", updatedAt: now }
  }

  const replacement = parseRecipeGuidanceDocument(candidate)
  if (!replacement) {
    return NextResponse.json(
      { error: "Recipe guidance transition violates the document contract" },
      { status: 422 }
    )
  }
  const updatedDocument = await repository.replace(replacement, expectedUpdatedAt)
  return NextResponse.json({
    data: { document: updatedDocument },
    summary: { mode, action, status: updatedDocument.status, version: updatedDocument.version },
  })
}

export const POST = withRole("admin")(async (request, context) => {
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
    const parsedInput = transitionInputSchema.safeParse(input)
    if (!parsedInput.success) {
      return NextResponse.json({ error: "Invalid recipe guidance transition" }, { status: 400 })
    }

    const transition = () =>
      applyTransition({
        recipeId,
        version,
        input: parsedInput.data,
        userId: context.userId,
      })
    return parsedInput.data.action === "publish"
      ? await withRecipeMutationLock(recipeId, transition)
      : await transition()
  } catch (error) {
    if (
      error instanceof RecipeGuidanceConflictError ||
      error instanceof RecipeMutationConflictError
    ) {
      return NextResponse.json(
        { error: "Recipe guidance changed; refresh and retry" },
        { status: 409 }
      )
    }
    logger.error("Failed to transition recipe guidance", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Recipe guidance datastore is unavailable" }, { status: 503 })
  }
})
