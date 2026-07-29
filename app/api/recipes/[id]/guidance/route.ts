import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { isRecipeAudienceMatch } from "@/lib/recipes"
import { getRecipeGuidanceRepository } from "@/lib/repositories/recipe-guidance-repository"
import { getRecipeById } from "@/lib/repositories/recipe-repository"

export const GET = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (_request, context) => {
  try {
    const recipeId = (await context.params)?.id
    if (!recipeId) {
      return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })
    }

    const recipe = await getRecipeById(recipeId)
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
    if (context.role !== "admin") {
      if (recipe.status !== "published") {
        return NextResponse.json({ error: "Recipe is not published" }, { status: 403 })
      }
      if (!isRecipeAudienceMatch(recipe.audienceUserIds, context.userId)) {
        return NextResponse.json(
          { error: "You do not have access to this recipe" },
          { status: 403 }
        )
      }
    }

    const { repository } = await getRecipeGuidanceRepository()
    const document = await repository.findLatestPublished(recipeId)
    if (!document) {
      return NextResponse.json({ error: "Published recipe guidance not found" }, { status: 404 })
    }
    if (
      context.role !== "admin" &&
      !isRecipeAudienceMatch(document.audienceUserIds, context.userId)
    ) {
      return NextResponse.json(
        { error: "You do not have access to this guidance" },
        { status: 403 }
      )
    }

    return NextResponse.json({
      data: { recipe, document },
      summary: { version: document.version },
    })
  } catch (error) {
    logger.error("Failed to read published recipe guidance", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Recipe guidance datastore is unavailable" }, { status: 503 })
  }
})
