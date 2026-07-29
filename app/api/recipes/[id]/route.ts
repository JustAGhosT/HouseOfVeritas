import { NextResponse } from "next/server"
import {
  isRecipeAudienceMatch,
  KNOWN_RECIPE_STATUSES,
  normalizeRecipeAudienceUserIds,
  type RecipeCreatePayload,
  type RecipeRecord,
} from "@/lib/recipes"
import { getRecipeById, replaceRecipe } from "@/lib/repositories/recipe-repository"
import {
  RecipeMutationConflictError,
  withRecipeMutationLock,
} from "@/lib/repositories/recipe-mutation-lock"
import { logger } from "@/lib/logger"
import { withRole } from "@/lib/auth/rbac"

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized.length ? normalized : undefined
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  if (!Number.isInteger(value) || value < 0) return undefined
  return value
}

function ensureValidRecipeStatus(value: unknown): value is (typeof KNOWN_RECIPE_STATUSES)[number] {
  return typeof value === "string" && (KNOWN_RECIPE_STATUSES as string[]).includes(value)
}

function buildRecipePayload(
  base: RecipeRecord,
  updates: Partial<RecipeCreatePayload>
): RecipeRecord {
  const audienceUserIds = normalizeRecipeAudienceUserIds(
    updates.audienceUserIds ?? base.audienceUserIds
  )
  const titleEn = asString(updates.titleEn ?? base.titleEn) as string
  const titleAf = asString(updates.titleAf ?? base.titleAf) as string
  const ingredients = updates.ingredients
    ? updates.ingredients
        .filter((ingredient) => asString(ingredient.name))
        .map((ingredient, index) => ({
          id: asString(ingredient.id) ?? `ing-${base.id}-${index + 1}`,
          quantity: ingredient.quantity,
          unit: asString(ingredient.unit),
          name: asString(ingredient.name) as string,
          preparationNote: asString(ingredient.preparationNote),
          section: asString(ingredient.section),
        }))
    : base.ingredients
  const steps = updates.steps
    ? updates.steps.map((step, index) => ({
        id: asString(step.id) ?? `step-${base.id}-${index + 1}`,
        order: asNonNegativeInt(step.order as number) || index + 1,
        instructionEn: asString(step.instructionEn) ?? "",
        instructionAf: asString(step.instructionAf) ?? "",
        timerMinutes: asNonNegativeInt(step.timerMinutes as number),
        section: asString(step.section),
      }))
    : base.steps

  return {
    ...base,
    status: updates.status ?? base.status,
    audienceUserIds,
    titleEn,
    summaryEn: asString(updates.summaryEn) ?? base.summaryEn,
    titleAf,
    summaryAf: asString(updates.summaryAf) ?? base.summaryAf,
    servings: asNonNegativeInt(updates.servings) ?? base.servings,
    prepMinutes: asNonNegativeInt(updates.prepMinutes) ?? base.prepMinutes,
    cookMinutes: asNonNegativeInt(updates.cookMinutes) ?? base.cookMinutes,
    cuisine: asString(updates.cuisine) ?? base.cuisine,
    category: asString(updates.category) ?? base.category,
    image: (updates as RecipeCreatePayload).image ?? base.image,
    ingredients,
    steps,
    updatedAt: new Date().toISOString(),
  }
}

function validateRecipe(recipe: RecipeRecord): string | null {
  if (!recipe.titleEn || !recipe.titleAf) return "titleEn and titleAf are required"
  if (!recipe.image?.url) return "Image URL is required"
  if (!recipe.image?.source) return "Image source is required"
  if (!recipe.image?.license) return "Image license is required"
  if (!recipe.image?.attributionText) return "Image attribution text is required"
  if (recipe.ingredients.length === 0) return "At least one ingredient is required"
  if (recipe.steps.length === 0) return "At least one step is required"
  if (recipe.steps.some((step) => !step.instructionEn || !step.instructionAf)) {
    return "All steps must include English and Afrikaans instructions"
  }
  return null
}

async function ensureEditableRecipe(
  id: string,
  context: { role: string; userId: string },
  allowAdmin: boolean
) {
  const existing = await getRecipeById(id)
  if (!existing) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
  }

  if (context.role === "admin" && allowAdmin) return existing

  if (!isRecipeAudienceMatch(existing.audienceUserIds, context.userId)) {
    return NextResponse.json({ error: "You do not have access to this recipe" }, { status: 403 })
  }
  return existing
}

export const GET = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (_request, context) => {
  try {
    const params = await context.params
    const id = params?.id
    if (!id) return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })

    const recipe = await getRecipeById(id)
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })

    if (context.role !== "admin" && recipe.status !== "published") {
      return NextResponse.json({ error: "Recipe is not published" }, { status: 403 })
    }

    if (
      context.role !== "admin" &&
      !isRecipeAudienceMatch(recipe.audienceUserIds, context.userId)
    ) {
      return NextResponse.json({ error: "You do not have access to this recipe" }, { status: 403 })
    }

    return NextResponse.json({ recipe })
  } catch (error) {
    logger.error("Failed to get recipe", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to get recipe" }, { status: 500 })
  }
})

export const PATCH = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request, context) => {
  try {
    const params = await context.params
    const id = params?.id
    if (!id) return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })

    return await withRecipeMutationLock(id, async (lease) => {
      const existingByRole = await ensureEditableRecipe(id, context, true)
      if (existingByRole instanceof Response) return existingByRole
      const recipePayload = existingByRole as RecipeRecord

      const body = (await request.json()) as Partial<RecipeCreatePayload>
      if (body.status !== undefined && !ensureValidRecipeStatus(body.status)) {
        return NextResponse.json({ error: "Invalid recipe status" }, { status: 400 })
      }

      const merged = buildRecipePayload(recipePayload, body)
      const validation = validateRecipe(merged)
      if (validation) return NextResponse.json({ error: validation }, { status: 400 })

      await lease.assertOwned()
      const updated = await replaceRecipe(merged, { mutationFence: lease.fence })
      if (!updated) {
        throw new RecipeMutationConflictError("Recipe changed before the fenced update")
      }
      return NextResponse.json({ recipe: updated })
    })
  } catch (error) {
    if (error instanceof RecipeMutationConflictError) {
      return NextResponse.json(
        { error: "Recipe is being changed; refresh and retry" },
        { status: 409 }
      )
    }
    logger.error("Failed to update recipe", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to update recipe" }, { status: 500 })
  }
})
