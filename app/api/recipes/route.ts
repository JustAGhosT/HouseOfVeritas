import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import {
  getExpandedAudienceAliases,
  KNOWN_RECIPE_STATUSES,
  normalizeRecipeAudienceUserIds,
  type RecipeCreatePayload,
  type RecipeRecord,
  isRecipeAudienceMatch,
} from "@/lib/recipes"
import {
  getRecipeRatingSummaries,
  createRecipe,
  listRecipes,
} from "@/lib/repositories/recipe-repository"
import { logger } from "@/lib/logger"
import { withRole } from "@/lib/auth/rbac"

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  if (!Number.isInteger(value) || value < 0) return undefined
  return value
}

function buildRecipe(payload: RecipeCreatePayload, ownerUserId: string, id = `recipe-${randomUUID()}`): RecipeRecord {
  const now = new Date().toISOString()
  const audienceUserIds = normalizeRecipeAudienceUserIds(payload.audienceUserIds)
  const titleEn = asString(payload.titleEn)
  const titleAf = asString(payload.titleAf)
  if (!titleEn || !titleAf) throw new Error("titleEn/titleAf are required")

  const ingredients =
    (Array.isArray(payload.ingredients) ? payload.ingredients : [])
      .filter((ingredient) => asString(ingredient.name))
      .map((ingredient, index) => ({
        id: asString(ingredient.id) ?? `ing-${id}-${index + 1}`,
        quantity: ingredient.quantity,
        unit: asString(ingredient.unit),
        name: asString(ingredient.name) as string,
        preparationNote: asString(ingredient.preparationNote),
        section: asString(ingredient.section),
      }))

  const steps =
    (Array.isArray(payload.steps) ? payload.steps : []).map((step, index) => {
      const order = asNonNegativeInt(step.order as number) || index + 1
      return {
        id: asString(step.id) ?? `step-${id}-${index + 1}`,
        order,
        instructionEn: asString(step.instructionEn) ?? "",
        instructionAf: asString(step.instructionAf) ?? "",
        timerMinutes: asNonNegativeInt(step.timerMinutes as number),
        section: asString(step.section),
      }
    })

  return {
    id,
    status: payload.status || "draft",
    ownerUserId,
    audienceUserIds,
    titleEn,
    summaryEn: asString(payload.summaryEn),
    titleAf,
    summaryAf: asString(payload.summaryAf),
    servings: asNonNegativeInt(payload.servings),
    prepMinutes: asNonNegativeInt(payload.prepMinutes),
    cookMinutes: asNonNegativeInt(payload.cookMinutes),
    cuisine: asString(payload.cuisine),
    category: asString(payload.category),
    image: payload.image,
    ingredients,
    steps,
    createdAt: now,
    updatedAt: now,
  }
}

function ensureValidRecipeStatus(value: unknown): value is typeof KNOWN_RECIPE_STATUSES[number] {
  return typeof value === "string" && (KNOWN_RECIPE_STATUSES as string[]).includes(value)
}

function validatePayload(recipe: RecipeRecord): string | null {
  if (!recipe.titleEn || !recipe.titleAf) return "titleEn and titleAf are required"
  if (recipe.ingredients.length === 0) return "At least one ingredient is required"
  if (recipe.steps.length === 0) return "At least one step is required"
  if (!recipe.image.url) return "Image URL is required"
  if (!recipe.image.source) return "Image source is required"
  if (!recipe.image.license) return "Image license is required"
  if (!recipe.image.attributionText) return "Image attribution text is required"
  const badSteps = recipe.steps.some((step) => !step.instructionEn || !step.instructionAf)
  if (badSteps) return "All steps must include English and Afrikaans instructions"
  return null
}

async function buildFilteredRecipesWithSummary(role: string, userId: string, filters: URLSearchParams) {
  const requestedStatus = asString(filters.get("status"))
  const includeStats = filters.get("withStats") === "true"
  const includeDrafts = filters.get("includeDrafts") === "true"
  let requestedStatusFilter: RecipeRecord["status"] | undefined

  let filteredStatus: RecipeRecord["status"] | RecipeRecord["status"][] | undefined
  if (requestedStatus) {
    if (!ensureValidRecipeStatus(requestedStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    if (role !== "admin" && requestedStatus !== "published") {
      return NextResponse.json({ error: "Only published recipes can be listed by residents" }, { status: 403 })
    }
    requestedStatusFilter = requestedStatus
  }

  if (role === "admin") {
    if (requestedStatusFilter) {
      if (includeDrafts && (requestedStatusFilter === "published" || requestedStatusFilter === "draft")) {
        filteredStatus = ["draft", "published"]
      } else {
        filteredStatus = requestedStatusFilter
      }
    } else if (includeDrafts) {
      filteredStatus = ["published", "draft"]
    } else {
      filteredStatus = "published"
    }
  } else {
    filteredStatus = "published"
  }

  const recipes = await listRecipes({
    status: filteredStatus,
    ...(role === "admin" ? {} : { audienceUserIds: getExpandedAudienceAliases(userId) }),
  })

  const filteredByRequest = recipes.filter((recipe) => {
    if (role === "admin") return true
    return isRecipeAudienceMatch(recipe.audienceUserIds, userId)
  })

  if (!includeStats) return { recipes: filteredByRequest }

  const summaries = await getRecipeRatingSummaries(filteredByRequest.map((recipe) => recipe.id))
  return {
    recipes: filteredByRequest.map((recipe) => ({
      ...recipe,
      ratingSummary: summaries[recipe.id],
    })),
  }
}

export const GET = withRole("admin", "operator", "employee", "resident")(async (request, context) => {
  try {
    const response = await buildFilteredRecipesWithSummary(
      context.role,
      context.userId,
      new URL(request.url).searchParams
    )
    if (response && response instanceof NextResponse) return response
    return NextResponse.json(response)
  } catch (error) {
    logger.error("Failed to list recipes", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to list recipes" }, { status: 500 })
  }
})

export const POST = withRole("admin", "operator", "employee", "resident")(async (request, context) => {
  try {
    const body = (await request.json()) as RecipeCreatePayload
    if (!body?.titleEn || !body?.titleAf || !body?.image || !Array.isArray(body.steps)) {
      return NextResponse.json({ error: "titleEn, titleAf, image, ingredients and steps are required" }, { status: 400 })
    }

    const recipe = buildRecipe(body, context.userId)
    const validation = validatePayload(recipe)
    if (validation) return NextResponse.json({ error: validation }, { status: 400 })

    const created = await createRecipe(recipe)
    return NextResponse.json({ recipe: created })
  } catch (error) {
    logger.error("Failed to create recipe", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create recipe" }, { status: 500 })
  }
})
