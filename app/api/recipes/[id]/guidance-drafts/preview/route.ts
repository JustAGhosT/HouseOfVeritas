import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { RecipeGuidanceBuildError, buildRecipeGuidanceDraft } from "@/lib/recipe-guidance-builder"
import { logger } from "@/lib/logger"
import { getRecipeGuidanceRepository } from "@/lib/repositories/recipe-guidance-repository"
import { getRecipeById } from "@/lib/repositories/recipe-repository"

export const POST = withRole("admin")(async (_request, context) => {
  try {
    const recipeId = (await context.params)?.id
    if (!recipeId) {
      return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })
    }

    const recipe = await getRecipeById(recipeId)
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })

    const { repository, mode } = await getRecipeGuidanceRepository()
    const existingDocuments = await repository.listByRecipeId(recipeId)
    const nextVersion = Math.max(0, ...existingDocuments.map((document) => document.version)) + 1
    const document = buildRecipeGuidanceDraft(recipe, {
      version: nextVersion,
      createdBy: context.userId,
      now: new Date().toISOString(),
    })

    return NextResponse.json({
      data: { recipe, document },
      summary: { mode, persisted: false, nextVersion },
    })
  } catch (error) {
    if (error instanceof RecipeGuidanceBuildError) {
      return NextResponse.json({ error: "Recipe is incomplete for guidance" }, { status: 422 })
    }
    logger.error("Failed to preview recipe guidance draft", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Recipe guidance datastore is unavailable" }, { status: 503 })
  }
})
