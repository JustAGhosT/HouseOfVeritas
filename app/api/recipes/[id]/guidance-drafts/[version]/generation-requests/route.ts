import { NextResponse } from "next/server"
import { z } from "zod"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { buildRecipeGuidanceGenerationRequest } from "@/lib/recipe-guidance-generation"
import { createRecipeRevisionId } from "@/lib/recipe-guidance"
import { getRecipeGuidanceRepository } from "@/lib/repositories/recipe-guidance-repository"
import { getRecipeById } from "@/lib/repositories/recipe-repository"

const requestSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    imageBriefId: z.string().trim().min(1).max(200),
  })
  .strict()

function parseVersion(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const version = Number(value)
  return Number.isSafeInteger(version) ? version : null
}

export const POST = withRole("admin")(async (request, context) => {
  try {
    const params = await context.params
    const recipeId = params?.id
    const version = parseVersion(params?.version)
    if (!recipeId || version === null) {
      return NextResponse.json(
        { error: "Recipe and guidance version are required" },
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
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid generation request contract input" },
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
        { error: "Generation requests can only be prepared from draft or in-review guidance" },
        { status: 409 }
      )
    }
    if (parsed.data.expectedUpdatedAt !== document.updatedAt) {
      return NextResponse.json(
        { error: "Recipe guidance changed; refresh and retry" },
        { status: 409 }
      )
    }
    if (document.recipeRevisionId !== createRecipeRevisionId(recipe.id, recipe.updatedAt)) {
      return NextResponse.json(
        { error: "Recipe changed; create a new guidance draft" },
        { status: 409 }
      )
    }

    const contract = buildRecipeGuidanceGenerationRequest(
      document,
      parsed.data.imageBriefId,
      context.userId,
      new Date().toISOString()
    )
    if (!contract) {
      return NextResponse.json(
        { error: "An approved brief with a planned media slot is required" },
        { status: 409 }
      )
    }

    return NextResponse.json({
      data: { request: contract },
      summary: {
        mode,
        version: document.version,
        executionAllowed: false,
        persisted: false,
      },
    })
  } catch (error) {
    logger.error("Failed to prepare recipe guidance generation request", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Recipe guidance datastore is unavailable" }, { status: 503 })
  }
})
