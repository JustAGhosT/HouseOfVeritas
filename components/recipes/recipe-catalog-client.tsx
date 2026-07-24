"use client"

import { useAuth } from "@/lib/auth-context"
import { apiFetch } from "@/lib/api-client"
import { type RecipeIngredient, type RecipeRecord, type RecipeRatingSummary, type RecipeStep } from "@/lib/recipes"
import { Clock4, ChefHat, Loader2, RefreshCw, Save, Send, Star, Utensils } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

interface RecipeListItem extends RecipeRecord {
  ratingSummary?: RecipeRatingSummary
}

interface RecipeListResponse {
  recipes: RecipeListItem[]
}

interface SeedResponse {
  seed?: {
    inserted: number
    skipped: number
    existingCount: number
    recipeIds: string[]
    forced: boolean
  }
}

interface MealSummary {
  mealInstanceId: string
  totalRatings: number
  averageScore: number
}

interface MealRating {
  score: 1 | 2 | 3 | 4 | 5
  comment?: string
  submittedAt: string
}

interface MealInstance {
  id: string
  mealName?: string
  servedAt: string
  servedBy?: string
  residentUserIds: string[]
  ratingTaskId?: number
  ratingTaskCount: number
  canRate: boolean
  summary: MealSummary
  currentUserRating?: MealRating | null
}

interface MealListResponse {
  mealInstances: MealInstance[]
}

interface ServeResponse {
  mealInstance: {
    id: string
    mealName?: string
    servedAt: string
  }
  meal?: {
    mealInstanceId?: string
  }
}

type LanguageMode = "en" | "af" | "both"
type Persona = "hans" | "charl" | "lucky" | "irma"

const LANG_LABELS: Record<LanguageMode, string> = {
  en: "EN",
  af: "AF",
  both: "EN + AF",
}

function toListText(value: string | undefined, fallback: string) {
  return value?.trim().length ? value : fallback
}

function clampScore(value: number | null): value is 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function recipeTitle(recipe: RecipeListItem, mode: LanguageMode): string {
  if (mode === "af") return recipe.titleAf
  if (mode === "en") return recipe.titleEn
  return `${recipe.titleEn} / ${recipe.titleAf}`
}

function recipeSummary(recipe: RecipeListItem, mode: LanguageMode): string {
  if (mode === "af") return toListText(recipe.summaryAf, "No summary available.")
  if (mode === "en") return toListText(recipe.summaryEn, "No summary available.")
  return `${toListText(recipe.summaryEn, "No summary available.")}\n${toListText(recipe.summaryAf, "")}`
}

function recipeSectionText(entity: RecipeStep | RecipeIngredient, mode: LanguageMode): string {
  if (mode === "af") {
    return "preparationNote" in entity
      ? entity.preparationNote ?? ""
      : (entity as RecipeStep).instructionAf ?? ""
  }
  if (mode === "en") {
    return "preparationNote" in entity
      ? entity.preparationNote ?? ""
      : (entity as RecipeStep).instructionEn ?? ""
  }
  const enText =
    "preparationNote" in entity ? entity.preparationNote ?? "" : (entity as RecipeStep).instructionEn ?? ""
  const afText =
    "preparationNote" in entity ? entity.preparationNote ?? "" : (entity as RecipeStep).instructionAf ?? ""
  return `${enText}${enText ? " / " : ""}${afText}`
}

export default function RecipeCatalogClient({ persona }: { persona: Persona }) {
  const { user } = useAuth()

  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("")
  const [language, setLanguage] = useState<LanguageMode>("both")
  const [mealInstances, setMealInstances] = useState<MealInstance[]>([])
  const [mealsLoading, setMealsLoading] = useState(false)
  const [ratingInputs, setRatingInputs] = useState<
    Record<string, { score: number | null; comment: string; submitting: boolean; submittedMessage?: string }>
  >({})
  const [seedMessage, setSeedMessage] = useState<string>("")
  const [serveInProgress, setServeInProgress] = useState(false)
  const [serveMealName, setServeMealName] = useState("")
  const [serveResidents, setServeResidents] = useState("")
  const [serveMessage, setServeMessage] = useState("")

  const isAdmin = user?.role === "admin"
  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId]
  )

  const recipesApi = useMemo(
    () => `/api/recipes?withStats=true${isAdmin ? "&includeDrafts=true" : ""}`,
    [isAdmin]
  )

  const loadRecipes = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await apiFetch<RecipeListResponse>(recipesApi, {
        label: "Recipes",
      })
      const next = data?.recipes ?? []
      setRecipes(next)
      setSelectedRecipeId((current) => (current && next.some((recipe) => recipe.id === current) ? current : (next[0]?.id ?? "")))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipes")
    } finally {
      setLoading(false)
    }
  }, [recipesApi])

  const loadMeals = useCallback(async () => {
    if (!selectedRecipe) return
    setMealsLoading(true)
    try {
      const data = await apiFetch<MealListResponse>(`/api/recipes/${selectedRecipe.id}/meals`, {
        label: "RecipeMeals",
      })
      const nextMeals = data?.mealInstances ?? []
      setMealInstances(nextMeals)
      setRatingInputs((state) => {
        const next = { ...state }
        for (const meal of nextMeals) {
          const existing = next[meal.id]
          next[meal.id] = {
            score: existing?.score ?? meal.currentUserRating?.score ?? null,
            comment: existing?.comment ?? meal.currentUserRating?.comment ?? "",
            submitting: false,
          }
        }
        return next
      })
    } catch (error) {
      setMealInstances([])
    } finally {
      setMealsLoading(false)
    }
  }, [selectedRecipe])

  useEffect(() => {
    void loadRecipes()
  }, [loadRecipes])

  useEffect(() => {
    void loadMeals()
  }, [loadMeals])

  useEffect(() => {
    setServeMealName(selectedRecipe?.titleEn ?? "")
    setServeResidents(selectedRecipe?.audienceUserIds.join(", ") ?? "")
  }, [selectedRecipe])

  const selectedIngredientChecklist = useMemo(() => {
    const map: Record<string, boolean> = {}
    if (!selectedRecipe) return map
    for (const ingredient of selectedRecipe.ingredients) {
      map[ingredient.id] = false
    }
    return map
  }, [selectedRecipe])

  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setCheckedIngredients(selectedIngredientChecklist)
  }, [selectedIngredientChecklist])

  const handleSeed = async () => {
    if (!isAdmin) return
    setSeedMessage("Seeding recipes...")
    try {
      const result = await apiFetch<SeedResponse>("/api/recipes/seed", {
        method: "POST",
        label: "RecipeSeed",
        body: { force: false },
      })
      const inserted = result?.seed?.inserted ?? 0
      const skipped = result?.seed?.skipped ?? 0
      const existing = result?.seed?.existingCount ?? 0
      setSeedMessage(
        `Seed complete. inserted ${inserted}, skipped ${skipped}. Existing recipes in datastore: ${existing}.`
      )
      await loadRecipes()
    } catch (error) {
      setSeedMessage(error instanceof Error ? error.message : "Recipe seed failed")
    }
  }

  const submitRating = async (mealId: string) => {
    const draft = ratingInputs[mealId]
    if (!draft?.score || !selectedRecipe) return

    setRatingInputs((state) => ({
      ...state,
      [mealId]: {
        ...state[mealId],
        submitting: true,
        submittedMessage: undefined,
      },
    }))

    const rating = draft.score
    if (!clampScore(rating)) {
      setRatingInputs((state) => ({
        ...state,
        [mealId]: {
          ...state[mealId],
          submitting: false,
          submittedMessage: "Please select a score from 1 to 5.",
        },
      }))
      return
    }

    const taskId = mealInstances.find((meal) => meal.id === mealId)?.ratingTaskId
    try {
      const response = await apiFetch<{ summary: MealSummary }>("/api/recipes/" + selectedRecipe.id + "/ratings", {
        method: "POST",
        label: "RecipeRating",
        body: {
          mealInstanceId: mealId,
          score: rating,
          comment: draft.comment.trim() || undefined,
          ...(taskId ? { taskId } : {}),
        },
      })
      setRatingInputs((state) => ({
        ...state,
        [mealId]: {
          ...state[mealId],
          submitting: false,
          submittedMessage: `Saved. ${
            response.summary?.totalRatings ? `Meal average ${response.summary.averageScore.toFixed(2)}` : "Rating saved."
          }`,
        },
      }))
      await loadMeals()
      await loadRecipes()
    } catch (error) {
      setRatingInputs((state) => ({
        ...state,
        [mealId]: {
          ...state[mealId],
          submitting: false,
          submittedMessage: error instanceof Error ? error.message : "Failed to save rating",
        },
      }))
    }
  }

  const handleServe = async () => {
    if (!selectedRecipe || !isAdmin) return
    setServeInProgress(true)
    setServeMessage("Creating serving record...")

    const residentUserIds = serveResidents
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
    try {
      const response = await apiFetch<ServeResponse>(`/api/recipes/${selectedRecipe.id}/serve`, {
        method: "POST",
        label: "RecipeServe",
        body: {
          mealName: serveMealName.trim() || selectedRecipe.titleEn,
          residentUserIds,
          createRatingTasks: true,
        },
      })
      const mealName = response?.mealInstance?.mealName || serveMealName.trim() || selectedRecipe.titleEn
      setServeMessage(`Meal served: ${mealName}. Residents will receive rating tasks automatically.`)
      await loadMeals()
      await loadRecipes()
    } catch (error) {
      setServeMessage(error instanceof Error ? error.message : "Failed to serve recipe")
    } finally {
      setServeInProgress(false)
    }
  }

  const toggleIngredient = (ingredientId: string) => {
    setCheckedIngredients((state) => ({ ...state, [ingredientId]: !state[ingredientId] }))
  }

  if (loading && recipes.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
        Loading recipes…
      </div>
    )
  }

  if (error && recipes.length === 0) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Kitchen recipes</p>
          <h1 className="text-3xl font-semibold text-foreground">Meal planning & kitchen feedback</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setLanguage("en")
            }}
            disabled={language === "en"}
          >
            EN
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setLanguage("af")
            }}
            disabled={language === "af"}
          >
            AF
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setLanguage("both")
            }}
            disabled={language === "both"}
          >
            EN + AF
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={loadRecipes}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          {isAdmin && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-500/20"
              onClick={handleSeed}
            >
              <Save className="h-4 w-4" />
              Seed sample recipes
            </button>
          )}
        </div>
      </div>
      {seedMessage && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{seedMessage}</p>}
      <p className="text-sm text-muted-foreground">
        Viewing in <span className="font-semibold">{LANG_LABELS[language]}</span> mode.
      </p>

      {recipes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No recipes are available yet.
          {isAdmin ? ' Use "Seed sample recipes" to get started.' : ""}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <aside className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recipe list</h2>
            <div className="space-y-2">
              {recipes.map((recipe) => {
                const selected = recipe.id === selectedRecipeId
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => setSelectedRecipeId(recipe.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selected ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <p className="font-medium text-foreground">{recipeTitle(recipe, language)}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {recipeSummary(recipe, language)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock4 className="h-3.5 w-3.5" />
                        {recipe.prepMinutes !== undefined ? `${recipe.prepMinutes}m prep` : "prep time N/A"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Utensils className="h-3.5 w-3.5" />
                        {recipe.cookMinutes !== undefined ? `${recipe.cookMinutes}m cook` : "cook time N/A"}
                      </span>
                    </div>
                    {!!recipe.ratingSummary && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        <Star className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-amber-500" />
                        {recipe.ratingSummary.totalRatings > 0
                          ? `${recipe.ratingSummary.averageScore.toFixed(2)}/5`
                          : "No ratings yet"}
                      </p>
                    )}
                    {isAdmin && recipe.status === "draft" && (
                      <p className="mt-1 text-xs uppercase text-amber-500">Draft</p>
                    )}
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="space-y-6">
            {selectedRecipe ? (
              <article className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-semibold">{recipeTitle(selectedRecipe, language)}</h2>
                      <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                        {recipeSummary(selectedRecipe, language)}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {selectedRecipe.category ? selectedRecipe.category : "General"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <ChefHat className="mr-2 inline h-4 w-4" />
                    Served rating:{" "}
                    {selectedRecipe.ratingSummary?.totalRatings
                      ? `${selectedRecipe.ratingSummary.averageScore.toFixed(2)} (${selectedRecipe.ratingSummary.totalRatings})`
                      : "No ratings yet"}
                  </p>
                </div>
                <div className="grid gap-6 p-5 sm:grid-cols-2">
                  <img
                    src={selectedRecipe.image.url}
                    alt={selectedRecipe.titleEn}
                    className="h-56 w-full rounded-xl border border-border object-cover"
                  />
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Source:</span>{" "}
                      {selectedRecipe.image.source}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">License:</span>{" "}
                      {selectedRecipe.image.license}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Attribution:</span>{" "}
                      {selectedRecipe.image.attributionText}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Servings:</span>{" "}
                      {selectedRecipe.servings ?? "N/A"}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Prep / Cook:</span>{" "}
                      {selectedRecipe.prepMinutes ?? "N/A"} min / {selectedRecipe.cookMinutes ?? "N/A"} min
                    </p>
                    {selectedRecipe.image.author && (
                      <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground">Image credit:</span>{" "}
                        {selectedRecipe.image.author}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-4 border-t border-border p-5">
                  <h3 className="text-lg font-semibold">Ingredients</h3>
                  <ul className="space-y-2">
                    {selectedRecipe.ingredients.map((ingredient) => {
                      const label = recipeSectionText(ingredient, language, "instructions")
                      return (
                        <li key={ingredient.id} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(checkedIngredients[ingredient.id])}
                            onChange={() => toggleIngredient(ingredient.id)}
                            className="mt-1"
                          />
                          <span className="text-foreground">
                            <span className="font-medium">{ingredient.name}</span>{" "}
                            <span className="text-muted-foreground">
                              {ingredient.quantity ? `${ingredient.quantity} ` : ""}
                              {ingredient.unit ?? ""}
                              {label ? ` · ${label}` : ""}
                            </span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
                <div className="space-y-4 border-t border-border p-5">
                  <h3 className="text-lg font-semibold">Steps</h3>
                  <ol className="space-y-3">
                    {[...selectedRecipe.steps]
                      .sort((left, right) => left.order - right.order)
                      .map((step) => {
                        const text = modeText(step, language)
                        return (
                          <li key={step.id} className="rounded-lg border border-border p-3 text-sm">
                            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                              Step {step.order}
                            </p>
                            <p className="text-foreground whitespace-pre-line">{text}</p>
                            {step.timerMinutes !== undefined && (
                              <p className="mt-2 text-xs text-muted-foreground">Timer: {step.timerMinutes} min</p>
                            )}
                          </li>
                        )
                      })}
                  </ol>
                </div>
              </article>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border p-4">
                  <h3 className="font-semibold">Serve this recipe</h3>
                  <p className="text-sm text-muted-foreground">
                    Creates resident rating tasks so everyone assigned can submit feedback.
                  </p>
                </div>
                <div className="space-y-3 p-4">
                  {isAdmin ? (
                    <>
                      <label className="block text-sm text-muted-foreground">
                        Meal name
                        <input
                          value={serveMealName}
                          onChange={(event) => setServeMealName(event.target.value)}
                          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          placeholder="Optional meal title"
                        />
                      </label>
                      <label className="block text-sm text-muted-foreground">
                        Resident users (comma-separated)
                        <input
                          value={serveResidents}
                          onChange={(event) => setServeResidents(event.target.value)}
                          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          placeholder="irma, charl, lucky"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleServe}
                        disabled={serveInProgress || !selectedRecipe}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                        {serveInProgress ? "Sending..." : "Create meal & rating tasks"}
                      </button>
                      {serveMessage && <p className="text-sm text-muted-foreground">{serveMessage}</p>}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Only admins can create meal tasks from this screen.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border p-4">
                  <h3 className="font-semibold">Meal ratings</h3>
                  <p className="text-sm text-muted-foreground">
                    Submit 1-5 score for each assigned meal so repeats can use recent feedback.
                  </p>
                </div>
                <div className="space-y-4 p-4">
                  {mealsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading meal history…
                    </div>
                  ) : mealInstances.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No served meal instances for this recipe yet.
                    </p>
                  ) : (
                    mealInstances.map((meal) => {
                      const draft = ratingInputs[meal.id] ?? { score: null, comment: "", submitting: false }
                      return (
                        <div key={meal.id} className="rounded-lg border border-border p-3">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">
                                {meal.mealName || selectedRecipe?.titleEn || "Meal"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(meal.servedAt)} · {meal.residentUserIds.join(", ")}{" "}
                                {meal.servedBy ? `· served by ${meal.servedBy}` : ""}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Star className="h-3.5 w-3.5 text-amber-500" />
                                {meal.summary.totalRatings > 0
                                  ? `${meal.summary.averageScore.toFixed(2)} (${meal.summary.totalRatings})`
                                  : "No ratings"}
                              </span>
                            </p>
                          </div>
                          {meal.currentUserRating ? (
                            <p className="text-xs text-muted-foreground">
                              Your last rating: {meal.currentUserRating.score}/5
                              {meal.currentUserRating.submittedAt
                                ? ` · ${formatDateTime(meal.currentUserRating.submittedAt)}`
                                : ""}
                            </p>
                          ) : null}
                          {meal.canRate ? (
                            <div className="mt-3 space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5].map((score) => (
                                  <button
                                    key={score}
                                    type="button"
                                    onClick={() =>
                                      setRatingInputs((state) => ({
                                        ...state,
                                        [meal.id]: { ...state[meal.id], score },
                                      }))
                                    }
                                    className={`rounded-md px-3 py-1.5 text-sm ${
                                      draft.score === score
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                                    }`}
                                  >
                                    {score}
                                  </button>
                                ))}
                              </div>
                              <label className="block text-xs text-muted-foreground">
                                Comment
                                <textarea
                                  value={draft.comment}
                                  onChange={(event) =>
                                    setRatingInputs((state) => ({
                                      ...state,
                                      [meal.id]: { ...state[meal.id], comment: event.target.value },
                                    }))
                                  }
                                  className="mt-1 block h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                                  placeholder="Optional"
                                />
                              </label>
                              <div className="flex items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => void submitRating(meal.id)}
                                  disabled={draft.score === null || draft.submitting}
                                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                                >
                                  <Save className="h-4 w-4" />
                                  {draft.submitting ? "Saving..." : "Save rating"}
                                </button>
                                {draft.submittedMessage && (
                                  <span className="text-xs text-muted-foreground">{draft.submittedMessage}</span>
                                )}
                              </div>
                              {meal.ratingTaskCount > 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  {meal.ratingTaskCount} active rating task{meal.ratingTaskCount === 1 ? "" : "s"}
                                  {meal.ratingTaskId ? `; your task: ${meal.ratingTaskId}` : ""}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  No rating tasks were created for this serving.
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              You are not assigned to this meal instance.
                            </p>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function modeText(entity: RecipeIngredient | RecipeStep, language: LanguageMode): string {
  if (language === "af") {
    return "preparationNote" in entity
      ? entity.preparationNote ?? ""
      : entity.instructionAf
  }
  if (language === "en") {
    return "preparationNote" in entity
      ? entity.preparationNote ?? ""
      : entity.instructionEn
  }
  const enText = "preparationNote" in entity ? entity.preparationNote ?? "" : entity.instructionEn
  const afText = "preparationNote" in entity ? entity.preparationNote ?? "" : entity.instructionAf
  return `${toListText(enText, "")}${enText && afText ? " / " : ""}${afText}`
}
