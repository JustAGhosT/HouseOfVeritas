import { randomUUID } from "crypto"
import { toISODateString } from "@/lib/utils"
import { createTask } from "@/lib/services/baserow"
import {
  getExpandedAudienceAliases,
  RATING_RECIPE_RECIPIENTS,
  resolveTaskRecipientPersona,
  TASK_RECIPIENT_TO_BASEROW_ID,
  type RecipeMealInstance,
  type RecipeRecord,
} from "@/lib/recipes"
import { createRecipeMealInstance } from "@/lib/repositories/recipe-repository"

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function dedupeSorted(values: string[]): string[] {
  return [...new Set(values)]
}

function collectRatingTaskResidents(
  input: unknown,
  fallbackResidents: string[]
): string[] {
  if (Array.isArray(input) && input.length > 0) {
    return dedupeSorted(
      input
        .map((value) => asString(value)?.toLowerCase())
        .filter((value): value is string => !!value)
    )
  }

  return dedupeSorted((fallbackResidents ?? []).map((value) => value.toLowerCase()))
}

function resolveResidentPersonas(residentUserIds: string[]): string[] {
  return dedupeSorted(
    residentUserIds
      .map((residentUserId) => resolveTaskRecipientPersona(residentUserId))
      .filter((persona): persona is string => Boolean(persona))
  )
}

export interface CreateMealFromRecipeInput {
  recipe: RecipeRecord
  mealName?: string
  residentUserIds?: unknown
  servedBy?: string
  createRatingTasks?: boolean
}

export interface CreateMealFromRecipeResult {
  mealInstance: RecipeMealInstance
}

export async function createMealFromRecipe(
  input: CreateMealFromRecipeInput
): Promise<CreateMealFromRecipeResult> {
  const now = new Date().toISOString()
  const mealInstanceId = `meal-${randomUUID()}`
  const createRatingTasks = input.createRatingTasks !== false
  const requestedResidents = collectRatingTaskResidents(
    input.residentUserIds,
    input.recipe.audienceUserIds.length > 0 ? input.recipe.audienceUserIds : RATING_RECIPE_RECIPIENTS
  )

  const residentPersonas = dedupeSorted(
    requestedResidents.flatMap((residentUserId) => getExpandedAudienceAliases(residentUserId))
  )
  const residentUserIds = resolveResidentPersonas(residentPersonas)

  if (residentUserIds.length === 0) {
    throw new Error("No valid resident recipients were provided or configured for this recipe")
  }

  const ratingTaskIds: number[] = []
  const ratingTaskAssignments: Array<{ residentUserId: string; taskId: number }> = []

  if (createRatingTasks) {
    for (const persona of residentUserIds) {
      const assignedTo = TASK_RECIPIENT_TO_BASEROW_ID[persona]
      if (!assignedTo) continue

      const task = await createTask({
        title: `Rate meal: ${input.recipe.titleEn}`,
        description:
          `Meal rating needed for ${input.mealName ?? input.recipe.titleEn}\n` +
          `Recipe ID: ${input.recipe.id}\n` +
          `Meal Instance ID: ${mealInstanceId}\n` +
          `Meal name: ${input.mealName ?? ""}\n` +
          `Resident: ${persona}\n` +
          `Served by: ${input.servedBy}\n` +
          `Please submit rating (1-5) via the meal rating endpoint.\n`,
        assignedTo,
        dueDate: toISODateString(),
        priority: "Medium",
        status: "Not Started",
        project: "Kitchen",
      })

      if (task?.id) {
        ratingTaskIds.push(task.id)
        ratingTaskAssignments.push({ residentUserId: persona, taskId: task.id })
      }
    }
  }

  const meal = await createRecipeMealInstance({
    id: mealInstanceId,
    recipeId: input.recipe.id,
    recipeTitleEn: input.recipe.titleEn,
    recipeTitleAf: input.recipe.titleAf,
    mealName: asString(input.mealName),
    residentUserIds,
    servedBy: asString(input.servedBy),
    servedAt: now,
    ratingTaskIds,
    ratingTaskAssignments,
    createdBy: input.servedBy ?? "system",
    createdAt: now,
    updatedAt: now,
  })

  return { mealInstance: meal }
}
