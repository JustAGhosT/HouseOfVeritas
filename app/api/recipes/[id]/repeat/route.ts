import { NextResponse } from "next/server"
import { isRecipeAudienceMatch } from "@/lib/recipes"
import { withRole } from "@/lib/auth/rbac"
import { createMealFromRecipe } from "@/lib/recipe-serving"
import {
  getRecipeById,
  getRecipeMealInstanceById,
  getRecipeRatingSummary,
  listRecipeMealInstances,
  listRecipeRatings,
} from "@/lib/repositories/recipe-repository"
import { logger } from "@/lib/logger"

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value
  return value === 1 || value === "1" || value === "true" || value === "yes"
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function buildMealSummary(mealId: string, ratings: number[]): { mealInstanceId: string; totalRatings: number; averageScore: number } {
  if (ratings.length === 0) {
    return {
      mealInstanceId: mealId,
      totalRatings: 0,
      averageScore: 0,
    }
  }

  const total = ratings.reduce((sum, value) => sum + value, 0)
  return {
    mealInstanceId: mealId,
    totalRatings: ratings.length,
    averageScore: Number((total / ratings.length).toFixed(2)),
  }
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
        return NextResponse.json({ error: "You cannot repeat this recipe" }, { status: 403 })
      }

      const body = (await request.json().catch(() => ({}))) as {
        sourceMealInstanceId?: string
        fromLatest?: boolean | string
        mealName?: string
        residentUserIds?: string[]
        createRatingTasks?: boolean
        servedBy?: string
      }

      let sourceMeal = null as Awaited<ReturnType<typeof getRecipeMealInstanceById>>
      if (asString(body?.sourceMealInstanceId)) {
        const sourceMealInstanceId = asString(body.sourceMealInstanceId)
        if (sourceMealInstanceId) {
          const candidate = await getRecipeMealInstanceById(sourceMealInstanceId)
          if (!candidate || candidate.recipeId !== id) {
            return NextResponse.json(
              { error: "Source meal instance not found for this recipe" },
              { status: 404 }
            )
          }
          sourceMeal = candidate
        }
      } else if (asBoolean(body?.fromLatest)) {
        const history = await listRecipeMealInstances(id)
        if (history.length > 0) {
          sourceMeal = history[0]
        } else {
          return NextResponse.json({ error: "No meal instance found to repeat" }, { status: 404 })
        }
      }

      if (sourceMeal && context.role !== "admin" && !isRecipeAudienceMatch(sourceMeal.residentUserIds, context.userId)) {
        return NextResponse.json(
          { error: "You are not assigned to the source meal" },
          { status: 403 }
        )
      }

      const sourceMealId = sourceMeal?.id
      const sourceSummary = sourceMeal
        ? buildMealSummary(
            sourceMeal.id,
            (await listRecipeRatings(id))
              .filter((rating) => rating.mealInstanceId === sourceMeal?.id)
              .map((rating) => rating.score)
          )
        : null

      const mealName =
        asString(body.mealName) ??
        (sourceMeal?.mealName ? `${sourceMeal.mealName} (repeat)` : recipe.titleEn)

      const servedBy = asString(body.servedBy) ?? context.userId
      const createRatingTasks = body.createRatingTasks === undefined ? true : body.createRatingTasks === true

      const { mealInstance: meal } = await createMealFromRecipe({
        recipe,
        mealName,
        residentUserIds: body?.residentUserIds,
        servedBy,
        createRatingTasks,
      })

      const summary = await getRecipeRatingSummary(id)

      return NextResponse.json({
        mealInstance: meal,
        sourceMealInstanceId: sourceMealId,
        sourceSummary,
        ratingSummary: summary,
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes("No valid resident recipients")) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      logger.error("Failed to repeat recipe meal", {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: "Failed to repeat meal" }, { status: 500 })
    }
  }
)
