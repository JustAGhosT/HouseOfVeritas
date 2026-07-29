import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { getRecipeGuidanceRepository } from "@/lib/repositories/recipe-guidance-repository"
import { getRecipeById } from "@/lib/repositories/recipe-repository"

export const GET = withRole("admin")(async (_request, context) => {
  try {
    const recipeId = (await context.params)?.id
    if (!recipeId) {
      return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })
    }
    if (!(await getRecipeById(recipeId))) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
    }

    const { repository, mode } = await getRecipeGuidanceRepository()
    const documents = await repository.listByRecipeId(recipeId)
    return NextResponse.json({
      data: { documents },
      summary: { count: documents.length, mode },
    })
  } catch (error) {
    logger.error("Failed to list recipe guidance drafts", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Recipe guidance datastore is unavailable" }, { status: 503 })
  }
})
