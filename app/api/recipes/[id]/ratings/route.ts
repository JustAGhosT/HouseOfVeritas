import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { updateTask } from "@/lib/services/baserow"
import { withRole } from "@/lib/auth/rbac"
import { getExpandedAudienceAliases, isRecipeAudienceMatch } from "@/lib/recipes"
import {
  getRecipeById,
  getRecipeMealInstanceById,
  getRecipeRating,
  getRecipeRatingSummary,
  listRecipeRatings,
  upsertRecipeRating,
} from "@/lib/repositories/recipe-repository"
import { logger } from "@/lib/logger"

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function asInt1To5(value: unknown): 1 | 2 | 3 | 4 | 5 | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) return null
  return value as 1 | 2 | 3 | 4 | 5
}

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10)
    return Number.isInteger(parsed) ? parsed : null
  }
  return null
}

function canAccessRecipe(contextRole: string, contextUserId: string, audienceUserIds: string[]): boolean {
  if (contextRole === "admin") return true
  return isRecipeAudienceMatch(audienceUserIds, contextUserId)
}

function normalizeResidentUserId(userId: string, residentIds: string[]): string {
  const normalizedUserId = userId.toLowerCase().trim()
  const aliasMatch = residentIds.find((residentId) =>
    getExpandedAudienceAliases(residentId).includes(normalizedUserId)
  )
  return aliasMatch ?? userId
}

function hasTaskForMeal(taskId: number, taskIds: number[]): boolean {
  return taskIds.includes(taskId)
}

function taskBelongsToResident(
  taskId: number,
  mealInstance: Awaited<ReturnType<typeof getRecipeMealInstanceById>>,
  userId: string
): boolean {
  const normalizedAliases = getExpandedAudienceAliases(userId)
  const assignment = mealInstance?.ratingTaskAssignments?.find((entry) => entry.taskId === taskId)
  if (assignment) return normalizedAliases.includes(assignment.residentUserId.toLowerCase())
  return hasTaskForMeal(taskId, mealInstance?.ratingTaskIds ?? [])
}

export const GET = withRole("admin", "operator", "employee", "resident")(
  async (request, context) => {
    try {
      const params = await context.params
      const id = params?.id
      if (!id) return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })

      const recipe = await getRecipeById(id)
      if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
      if (!canAccessRecipe(context.role, context.userId, recipe.audienceUserIds)) {
        return NextResponse.json({ error: "You do not have access to this recipe" }, { status: 403 })
      }
      if (context.role !== "admin" && recipe.status !== "published") {
        return NextResponse.json({ error: "Recipe is not published" }, { status: 403 })
      }

      const mealInstanceId = asString(new URL(request.url).searchParams.get("mealInstanceId"))
      const ratings = mealInstanceId
        ? (await listRecipeRatings(id)).filter((rating) => rating.mealInstanceId === mealInstanceId)
        : await listRecipeRatings(id)
      const summary = await getRecipeRatingSummary(id)

      return NextResponse.json({ ratings, summary })
    } catch (error) {
      logger.error("Failed to list ratings", {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: "Failed to list ratings" }, { status: 500 })
    }
  }
)

export const POST = withRole("admin", "operator", "employee", "resident")(
  async (request, context) => {
    try {
      const params = await context.params
      const id = params?.id
      if (!id) return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })

      const recipe = await getRecipeById(id)
      if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
      if (!canAccessRecipe(context.role, context.userId, recipe.audienceUserIds)) {
        return NextResponse.json({ error: "You do not have access to this recipe" }, { status: 403 })
      }
      if (context.role !== "admin" && recipe.status !== "published") {
        return NextResponse.json({ error: "Recipe is not published" }, { status: 403 })
      }

      const body = await request.json()
      const mealInstanceId = asString(body.mealInstanceId)
      const score = asInt1To5(body.score)
      const taskId = asInt(body.taskId)
      if (!mealInstanceId) return NextResponse.json({ error: "mealInstanceId is required" }, { status: 400 })
      if (!score) return NextResponse.json({ error: "score must be an integer 1 to 5" }, { status: 400 })

      const meal = await getRecipeMealInstanceById(mealInstanceId)
      if (!meal || meal.recipeId !== id) {
        return NextResponse.json({ error: "Meal instance not found for this recipe" }, { status: 404 })
      }

      const isResidentAssigned = isRecipeAudienceMatch(meal.residentUserIds, context.userId)
      if (!isResidentAssigned && context.role !== "admin") {
        return NextResponse.json({ error: "You are not assigned this rating task" }, { status: 403 })
      }

      if (taskId !== null && !hasTaskForMeal(taskId, meal.ratingTaskIds)) {
        return NextResponse.json(
          { error: "taskId does not match this meal instance" },
          { status: 400 }
        )
      }

      if (taskId !== null && !taskBelongsToResident(taskId, meal, context.userId) && context.role !== "admin") {
        return NextResponse.json(
          { error: "taskId does not match this meal instance" },
          { status: 400 }
        )
      }

      const residentUserId = normalizeResidentUserId(context.userId, meal.residentUserIds)
      const ratingPayload = await getRecipeRating(id, mealInstanceId, residentUserId)

      const rating = await upsertRecipeRating({
        id: ratingPayload?.id ?? `rating-${randomUUID()}`,
        recipeId: id,
        mealInstanceId,
        residentUserId,
        score,
        comment: asString(body.comment),
        taskId,
        submittedBy: context.userId,
        submittedAt: ratingPayload?.submittedAt ?? new Date().toISOString(),
      })

      if (taskId) {
        await updateTask(taskId, {
          status: "Completed",
          completionNotes: `Rating submitted: ${score}/5`,
        }).catch(() => null)
      }

      const summary = await getRecipeRatingSummary(id)
      return NextResponse.json({ rating, summary })
    } catch (error) {
      logger.error("Failed to submit recipe rating", {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: "Failed to submit rating" }, { status: 500 })
    }
  }
)
