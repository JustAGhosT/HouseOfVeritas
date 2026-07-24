import { NextResponse } from "next/server"
import { getExpandedAudienceAliases, isRecipeAudienceMatch } from "@/lib/recipes"
import { withRole } from "@/lib/auth/rbac"
import {
  getRecipeById,
  listRecipeMealInstances,
  listRecipeRatings,
} from "@/lib/repositories/recipe-repository"
import { logger } from "@/lib/logger"

interface MealRatingSummary {
  mealInstanceId: string
  totalRatings: number
  averageScore: number
}

interface MealInstanceWithRatingPayload {
  id: string
  mealName?: string
  servedAt: string
  servedBy?: string
  residentUserIds: string[]
  ratingTaskId?: number
  ratingTaskCount: number
  canRate: boolean
  summary: MealRatingSummary
  currentUserRating?: {
    score: 1 | 2 | 3 | 4 | 5
    comment?: string
    submittedAt: string
  } | null
}

function asLocaleText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function toSet(values: string[]): Set<string> {
  return new Set(values.map((value) => value.toLowerCase().trim()).filter((value) => value.length > 0))
}

export const GET = withRole("admin", "operator", "employee", "resident")(
  async (_request, context) => {
    try {
      const params = await context.params
      const id = params?.id
      if (!id) return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })

      const recipe = await getRecipeById(id)
      if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
      if (!isRecipeAudienceMatch(recipe.audienceUserIds, context.userId) && context.role !== "admin") {
        return NextResponse.json({ error: "You do not have access to this recipe" }, { status: 403 })
      }
      if (context.role !== "admin" && recipe.status !== "published") {
        return NextResponse.json({ error: "Recipe is not published" }, { status: 403 })
      }

      const residentAliases = toSet(getExpandedAudienceAliases(context.userId))
      const mealInstances = await listRecipeMealInstances(id)
      const allRatings = await listRecipeRatings(id)

      const groupedRatings = new Map<string, { total: number; count: number }>()
      for (const rating of allRatings) {
        const current = groupedRatings.get(rating.mealInstanceId) ?? { total: 0, count: 0 }
        current.total += rating.score
        current.count += 1
        groupedRatings.set(rating.mealInstanceId, current)
      }

      const visibleMeals = mealInstances.filter((meal) => {
        if (context.role === "admin") return true
        const residentSet = toSet(meal.residentUserIds)
        return [...residentAliases].some((alias) => residentSet.has(alias))
      })

      const items = visibleMeals.map((meal) => {
        const mealRatings = groupedRatings.get(meal.id)
        const mealResidentSet = toSet(meal.residentUserIds)
        const summary: MealRatingSummary = {
          mealInstanceId: meal.id,
          totalRatings: mealRatings?.count ?? 0,
          averageScore: mealRatings && mealRatings.count > 0 ? mealRatings.total / mealRatings.count : 0,
        }
        const assignedTask = meal.ratingTaskAssignments?.find((assignment) =>
          residentAliases.has(assignment.residentUserId.toLowerCase())
        )
        const currentUserRating = allRatings.find((rating) => {
          if (rating.mealInstanceId !== meal.id) return false
          return residentAliases.has(rating.residentUserId.toLowerCase())
        })
        return {
          id: meal.id,
          mealName: asLocaleText(meal.mealName),
          servedAt: meal.servedAt,
          servedBy: asLocaleText(meal.servedBy),
          residentUserIds: meal.residentUserIds,
          ratingTaskId: assignedTask?.taskId,
          ratingTaskCount: meal.ratingTaskIds.length,
          canRate:
            context.role === "admin" ||
            [...residentAliases].some((alias) => mealResidentSet.has(alias)),
          summary,
          currentUserRating: currentUserRating
            ? {
                score: currentUserRating.score,
                comment: currentUserRating.comment,
                submittedAt: currentUserRating.submittedAt,
              }
            : null,
        }
      })

      return NextResponse.json({ mealInstances: items })
    } catch (error) {
      logger.error("Failed to list meals for recipe", {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: "Failed to list meals" }, { status: 500 })
    }
  }
)
