import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import {
  isRecipeAudienceMatch,
} from "@/lib/recipes"
import { createMealFromRecipe } from "@/lib/recipe-serving"
import { getRecipeById } from "@/lib/repositories/recipe-repository"
import { logger } from "@/lib/logger"

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized.length ? normalized : undefined
}

export const POST = withRole("admin", "operator", "employee", "resident")(
  async (request, context) => {
    try {
      const params = await context.params
      const id = params?.id
      if (!id) return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })

      const recipe = await getRecipeById(id)
      if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
      if (!isRecipeAudienceMatch(recipe.audienceUserIds, context.userId) && context.role !== "admin") {
        return NextResponse.json({ error: "You cannot serve this recipe" }, { status: 403 })
      }

      const body = await request.json()
      const mealName = asString(body.mealName)
      const servedBy = asString(body.servedBy) ?? context.userId
      const createRatingTasks =
        body.createRatingTasks === undefined ? true : body.createRatingTasks === true
      const { mealInstance: meal } = await createMealFromRecipe({
        recipe,
        mealName,
        residentUserIds: body.residentUserIds,
        servedBy,
        createRatingTasks,
      })

      return NextResponse.json({ mealInstance: meal })
    } catch (error) {
      if (error instanceof Error && error.message.includes("No valid resident recipients")) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      logger.error("Failed to serve recipe", {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: "Failed to serve recipe" }, { status: 500 })
    }
  }
)
