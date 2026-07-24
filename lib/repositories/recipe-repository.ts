import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"
import type { Filter } from "mongodb"
import { getCollection, isMongoConfigured, withoutMongoId } from "@/lib/db/mongodb"
import { randomUUID } from "crypto"
import {
  DEFAULT_RECIPE_AUDIENCE_IDS,
  normalizeRecipeAudienceUserIds,
  RecipeMealInstance,
  RecipeRating,
  RecipeRecord,
  RecipeRatingSummary,
  RecipeStatus,
  SAMPLE_RECIPES,
  type RecipeCreatePayload,
} from "@/lib/recipes"

const RECIPES_FILE = join(process.cwd(), "data", "recipes.json")
const RECIPE_MEAL_INSTANCES_FILE = join(process.cwd(), "data", "recipe-meal-instances.json")
const RECIPE_RATINGS_FILE = join(process.cwd(), "data", "recipe-ratings.json")

const RECIPES_COLLECTION = "recipes"
const RECIPE_MEAL_INSTANCES_COLLECTION = "recipe_meal_instances"
const RECIPE_RATINGS_COLLECTION = "recipe_ratings"

type RecipeDocument = RecipeRecord & { _id?: unknown }
type RecipeMealInstanceDocument = RecipeMealInstance & { _id?: unknown }
type RecipeRatingDocument = RecipeRating & { _id?: unknown }

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

export interface SeedSampleRecipesResult {
  inserted: number
  skipped: number
  existingCount: number
  recipeIds: string[]
  forced: boolean
}

function buildSeedRecipeRecord(payload: RecipeCreatePayload, ownerUserId: string, now: string): RecipeRecord {
  const recipeId = `recipe-${randomUUID()}`
  const audienceUserIds = normalizeRecipeAudienceUserIds(payload.audienceUserIds ?? [])
  const normalizedImage = payload.image

  const ingredients = (Array.isArray(payload.ingredients) ? payload.ingredients : [])
    .filter((ingredient) => asString((ingredient as { name?: unknown }).name))
    .map((ingredient, index) => ({
      id: asString((ingredient as { id?: unknown }).id) ?? `ing-${recipeId}-${index + 1}`,
      quantity: ingredient.quantity,
      unit: asString((ingredient as { unit?: unknown })),
      name: asString((ingredient as { name?: unknown }).name) as string,
      preparationNote: asString((ingredient as { preparationNote?: unknown })),
      section: asString((ingredient as { section?: unknown })),
    }))

  const steps = (Array.isArray(payload.steps) ? payload.steps : [])
    .map((step, index) => ({
      id: asString((step as { id?: unknown }).id) ?? `step-${recipeId}-${index + 1}`,
      order: asNonNegativeInt((step as { order?: unknown }).order) || index + 1,
      instructionEn: asString((step as { instructionEn?: unknown }).instructionEn) ?? "",
      instructionAf: asString((step as { instructionAf?: unknown }).instructionAf) ?? "",
      timerMinutes: asNonNegativeInt((step as { timerMinutes?: unknown })),
      section: asString((step as { section?: unknown })),
    }))

  return {
    id: recipeId,
    status: payload.status || "draft",
    ownerUserId,
    audienceUserIds,
    titleEn: asString(payload.titleEn) ?? "",
    summaryEn: asString(payload.summaryEn),
    titleAf: asString(payload.titleAf) ?? "",
    summaryAf: asString(payload.summaryAf),
    servings: asNonNegativeInt(payload.servings),
    prepMinutes: asNonNegativeInt(payload.prepMinutes),
    cookMinutes: asNonNegativeInt(payload.cookMinutes),
    cuisine: asString(payload.cuisine),
    category: asString(payload.category),
    image: {
      url: asString(normalizedImage?.url) ?? "",
      source: asString(normalizedImage?.source) ?? "Unknown",
      author: asString(normalizedImage?.author),
      license: asString(normalizedImage?.license) ?? "Unknown",
      attributionText: asString(normalizedImage?.attributionText) ?? "Unknown",
      retrievedAt: asString(normalizedImage?.retrievedAt) ?? now.slice(0, 10),
    },
    ingredients,
    steps,
    createdAt: now,
    updatedAt: now,
  }
}

function requireProductionStore(): void {
  if (process.env.NODE_ENV === "production" && process.env.CI !== "true" && !isMongoConfigured()) {
    throw new Error("Recipe datastore is not configured. Set MONGODB_URI for production.")
  }
}

function isUsingMemoryStore(): boolean {
  return process.env.E2E_TEST === "1" || process.env.CI === "true" || !isMongoConfigured()
}

async function readJsonList<T>(filePath: string): Promise<T[]> {
  try {
    const data = await readFile(filePath, "utf-8")
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeJsonList<T>(filePath: string, data: T[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
}

async function readRecipes(): Promise<RecipeRecord[]> {
  return readJsonList<RecipeRecord>(RECIPES_FILE)
}

async function writeRecipes(recipes: RecipeRecord[]): Promise<void> {
  await writeJsonList(RECIPES_FILE, recipes)
}

async function readMealInstances(): Promise<RecipeMealInstance[]> {
  return readJsonList<RecipeMealInstance>(RECIPE_MEAL_INSTANCES_FILE)
}

async function writeMealInstances(instances: RecipeMealInstance[]): Promise<void> {
  await writeJsonList(RECIPE_MEAL_INSTANCES_FILE, instances)
}

async function readRatings(): Promise<RecipeRating[]> {
  return readJsonList<RecipeRating>(RECIPE_RATINGS_FILE)
}

async function writeRatings(ratings: RecipeRating[]): Promise<void> {
  await writeJsonList(RECIPE_RATINGS_FILE, ratings)
}

function sortByCreatedAtDescending<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

function sortByServedAtDescending<T extends { servedAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    return new Date(right.servedAt).getTime() - new Date(left.servedAt).getTime()
  })
}

function sortBySubmittedAtDescending<T extends { submittedAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()
  })
}

export interface RecipeListFilter {
  status?: RecipeStatus | RecipeStatus[]
  ownerUserId?: string
  audienceUserIds?: string[]
}

function filterRecipesInMemory(recipes: RecipeRecord[], filters?: RecipeListFilter): RecipeRecord[] {
  let results = [...recipes]
  if (!filters) return results

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    results = results.filter((recipe) => statuses.includes(recipe.status))
  }

  if (filters.ownerUserId) {
    const requestedOwnerId = filters.ownerUserId.toLowerCase()
    results = results.filter((recipe) => recipe.ownerUserId.toLowerCase() === requestedOwnerId)
  }

  if (filters.audienceUserIds && filters.audienceUserIds.length > 0) {
    const audienceLookup = new Set(filters.audienceUserIds.map((value) => value.toLowerCase().trim()))
    results = results.filter((recipe) =>
      recipe.audienceUserIds.some((userId) => audienceLookup.has(userId.toLowerCase().trim()))
    )
  }

  return results
}

export async function listRecipes(filters?: RecipeListFilter): Promise<RecipeRecord[]> {
  requireProductionStore()
  if (isUsingMemoryStore()) {
    const items = await readRecipes()
    return sortByCreatedAtDescending(filterRecipesInMemory(items, filters))
  }

  const collection = await getCollection<RecipeDocument>(RECIPES_COLLECTION)
  const mongoFilter: Record<string, unknown> = {}

  if (filters?.status) {
    mongoFilter.status = Array.isArray(filters.status) ? { $in: filters.status } : filters.status
  }

  if (filters?.ownerUserId) {
    mongoFilter.ownerUserId = filters.ownerUserId.toLowerCase()
  }

  if (filters?.audienceUserIds?.length) {
    mongoFilter.audienceUserIds = {
      $in: filters.audienceUserIds.map((value) => value.toLowerCase().trim()),
    }
  }

  const recipes = await collection.find(mongoFilter).sort({ createdAt: -1 }).toArray()
  return recipes.map((recipe) => withoutMongoId(recipe))
}

export async function countRecipes(): Promise<number> {
  requireProductionStore()
  if (isUsingMemoryStore()) {
    const recipes = await readRecipes()
    return recipes.length
  }

  const collection = await getCollection<RecipeDocument>(RECIPES_COLLECTION)
  return collection.countDocuments({})
}

export async function getRecipeById(id: string): Promise<RecipeRecord | null> {
  requireProductionStore()
  if (isUsingMemoryStore()) {
    const recipes = await readRecipes()
    return recipes.find((item) => item.id === id) ?? null
  }

  const collection = await getCollection<RecipeDocument>(RECIPES_COLLECTION)
  const recipe = await collection.findOne({ id } as Filter<RecipeDocument>)
  if (!recipe) return null
  return withoutMongoId(recipe)
}

export async function seedSampleRecipes(
  ownerUserId: string,
  options?: { force?: boolean }
): Promise<SeedSampleRecipesResult> {
  requireProductionStore()
  const force = options?.force === true
  const seededBy = (ownerUserId || "system").toLowerCase()
  const effectiveOwner = seededBy || "system"

  const existingCount = await countRecipes()
  if (existingCount > 0 && !force) {
    return {
      inserted: 0,
      skipped: SAMPLE_RECIPES.length,
      existingCount,
      recipeIds: [],
      forced: false,
    }
  }

  const now = new Date().toISOString()
  const recipeIds: string[] = []

  for (const recipePayload of SAMPLE_RECIPES) {
    const record = buildSeedRecipeRecord(recipePayload, effectiveOwner, now)
    if (record.audienceUserIds.length === 0) {
      record.audienceUserIds = [...DEFAULT_RECIPE_AUDIENCE_IDS]
    }

    const created = await createRecipe(record)
    recipeIds.push(created.id)
  }

  return {
    inserted: recipeIds.length,
    skipped: 0,
    existingCount,
    recipeIds,
    forced: force,
  }
}

export async function createRecipe(data: RecipeRecord): Promise<RecipeRecord> {
  requireProductionStore()
  if (isUsingMemoryStore()) {
    const recipes = await readRecipes()
    const stored: RecipeRecord = {
      ...data,
      id: data.id || `recipe-${randomUUID()}`,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    }
    recipes.push(stored)
    await writeRecipes(recipes)
    return stored
  }

  const collection = await getCollection<RecipeDocument>(RECIPES_COLLECTION)
  await collection.insertOne(data)
  return data
}

export async function replaceRecipe(updated: RecipeRecord): Promise<RecipeRecord | null> {
  requireProductionStore()
  if (isUsingMemoryStore()) {
    const recipes = await readRecipes()
    const index = recipes.findIndex((recipe) => recipe.id === updated.id)
    if (index === -1) return null
    recipes[index] = { ...updated, updatedAt: new Date().toISOString() }
    await writeRecipes(recipes)
    return recipes[index]
  }

  const collection = await getCollection<RecipeDocument>(RECIPES_COLLECTION)
  const updatedRecord = { ...updated, updatedAt: new Date().toISOString() }
  const result = await collection.replaceOne(
    { id: updated.id } as Filter<RecipeDocument>,
    updatedRecord as RecipeDocument
  )
  if (result.matchedCount === 0) return null
  return updatedRecord
}

export async function listRecipeMealInstances(recipeId: string): Promise<RecipeMealInstance[]> {
  requireProductionStore()
  if (isUsingMemoryStore()) {
    const instances = await readMealInstances()
    return sortByServedAtDescending(instances.filter((instance) => instance.recipeId === recipeId))
  }

  const collection = await getCollection<RecipeMealInstanceDocument>(RECIPE_MEAL_INSTANCES_COLLECTION)
  const instances = await collection.find({ recipeId }).sort({ servedAt: -1 }).toArray()
  return instances.map((instance) => withoutMongoId(instance))
}

export async function getRecipeMealInstanceById(id: string): Promise<RecipeMealInstance | null> {
  requireProductionStore()
  if (isUsingMemoryStore()) {
    const instances = await readMealInstances()
    return instances.find((instance) => instance.id === id) ?? null
  }

  const collection = await getCollection<RecipeMealInstanceDocument>(RECIPE_MEAL_INSTANCES_COLLECTION)
  const instance = await collection.findOne({ id } as Filter<RecipeMealInstanceDocument>)
  if (!instance) return null
  return withoutMongoId(instance)
}

export async function createRecipeMealInstance(
  meal: RecipeMealInstance
): Promise<RecipeMealInstance> {
  requireProductionStore()
  if (isUsingMemoryStore()) {
    const instances = await readMealInstances()
    const now = new Date().toISOString()
    const stored: RecipeMealInstance = {
      ...meal,
      id: meal.id || `meal-${randomUUID()}`,
      servedAt: meal.servedAt || now,
      createdAt: meal.createdAt || now,
      updatedAt: meal.updatedAt || now,
    }
    instances.push(stored)
    await writeMealInstances(instances)
    return stored
  }

  const collection = await getCollection<RecipeMealInstanceDocument>(
    RECIPE_MEAL_INSTANCES_COLLECTION
  )
  await collection.insertOne(meal)
  return meal
}

export async function listRecipeRatings(recipeId: string): Promise<RecipeRating[]> {
  requireProductionStore()
  if (isUsingMemoryStore()) {
    return sortBySubmittedAtDescending(
      (await readRatings()).filter((rating) => rating.recipeId === recipeId)
    )
  }

  const collection = await getCollection<RecipeRatingDocument>(RECIPE_RATINGS_COLLECTION)
  const ratings = await collection.find({ recipeId }).sort({ submittedAt: -1 }).toArray()
  return ratings.map((rating) => withoutMongoId(rating))
}

export async function getRecipeRating(
  recipeId: string,
  mealInstanceId: string,
  residentUserId: string
): Promise<RecipeRating | null> {
  requireProductionStore()
  if (isUsingMemoryStore()) {
    return (
      (await readRatings()).find(
        (rating) =>
          rating.recipeId === recipeId &&
          rating.mealInstanceId === mealInstanceId &&
          rating.residentUserId.toLowerCase() === residentUserId.toLowerCase()
      ) ?? null
    )
  }

  const collection = await getCollection<RecipeRatingDocument>(RECIPE_RATINGS_COLLECTION)
  const record = await collection.findOne({
    recipeId,
    mealInstanceId,
    residentUserId,
  } as Filter<RecipeRatingDocument>)
  if (!record) return null
  return withoutMongoId(record)
}

export async function upsertRecipeRating(rating: RecipeRating): Promise<RecipeRating> {
  requireProductionStore()
  if (isUsingMemoryStore()) {
    const ratings = await readRatings()
    const now = new Date().toISOString()
    const normalized: RecipeRating = {
      ...rating,
      id: rating.id || `rating-${randomUUID()}`,
      submittedAt: now,
    }
    const index = ratings.findIndex(
      (record) =>
        record.recipeId === rating.recipeId &&
        record.mealInstanceId === rating.mealInstanceId &&
        record.residentUserId.toLowerCase() === rating.residentUserId.toLowerCase()
    )
    if (index >= 0) {
      ratings[index] = normalized
    } else {
      ratings.push(normalized)
    }
    await writeRatings(ratings)
    return normalized
  }

  const collection = await getCollection<RecipeRatingDocument>(RECIPE_RATINGS_COLLECTION)
  const now = new Date().toISOString()
  const document: RecipeRatingDocument = {
    ...rating,
    id: rating.id || `rating-${randomUUID()}`,
    submittedAt: now,
  }

  const filter = {
    recipeId: rating.recipeId,
    mealInstanceId: rating.mealInstanceId,
    residentUserId: rating.residentUserId,
  }

  const existing = await collection.findOne(filter as Filter<RecipeRatingDocument>)
  if (existing) {
    await collection.replaceOne(filter as Filter<RecipeRatingDocument>, document)
    return withoutMongoId(document as RecipeRatingDocument)
  }

  await collection.insertOne(document)
  return withoutMongoId(document)
}

export async function getRecipeRatingSummary(recipeId: string): Promise<RecipeRatingSummary> {
  const ratings = await listRecipeRatings(recipeId)
  const mealInstances = await listRecipeMealInstances(recipeId)
  if (ratings.length === 0) {
    return {
      recipeId,
      averageScore: 0,
      totalRatings: 0,
      totalMeals: mealInstances.length,
    }
  }

  const scoreTotal = ratings.reduce((sum, rating) => sum + rating.score, 0)
  return {
    recipeId,
    averageScore: Number((scoreTotal / ratings.length).toFixed(2)),
    totalRatings: ratings.length,
    totalMeals: mealInstances.length,
  }
}

export async function getRecipeRatingSummaries(
  recipeIds: string[]
): Promise<Record<string, RecipeRatingSummary>> {
  const uniqueRecipeIds = [...new Set(recipeIds)]
  const summary = await Promise.all(uniqueRecipeIds.map((recipeId) => getRecipeRatingSummary(recipeId)))
  return summary.reduce<Record<string, RecipeRatingSummary>>((acc, item) => {
    acc[item.recipeId] = item
    return acc
  }, {})
}
