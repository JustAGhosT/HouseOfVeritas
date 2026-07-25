import { GET } from "@/app/api/recipes/[id]/meals/route"
import {
  getRecipeById,
  listRecipeMealInstances,
  listRecipeRatings,
} from "@/lib/repositories/recipe-repository"
import type { RecipeMealInstance, RecipeRating, RecipeRecord } from "@/lib/recipes"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/repositories/recipe-repository", () => ({
  getRecipeById: vi.fn(),
  listRecipeMealInstances: vi.fn(),
  listRecipeRatings: vi.fn(),
}))

const routeContext = { params: Promise.resolve({ id: "recipe-1" }) }

const recipe: RecipeRecord = {
  id: "recipe-1",
  ownerUserId: "hans",
  status: "published",
  audienceUserIds: ["hans", "irma"],
  titleEn: "Household supper",
  titleAf: "Huishoudelike aandete",
  summaryEn: "A practical supper.",
  summaryAf: "'n Praktiese aandete.",
  ingredients: [],
  steps: [],
  image: {
    url: "https://images.example/recipe.jpg",
    source: "Example",
    license: "CC BY 4.0",
    attributionText: "Example Author, CC BY 4.0",
    retrievedAt: "2026-07-25",
  },
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
}

const meal: RecipeMealInstance = {
  id: "meal-1",
  recipeId: recipe.id,
  recipeTitleEn: recipe.titleEn,
  recipeTitleAf: recipe.titleAf,
  mealName: "Friday supper",
  residentUserIds: ["irma", "charl"],
  ratingTaskIds: [41, 42],
  ratingTaskAssignments: [
    { residentUserId: "irma", taskId: 41 },
    { residentUserId: "charl", taskId: 42 },
  ],
  servedAt: "2026-07-25T18:00:00.000Z",
  servedBy: "hans",
  createdBy: "hans",
  createdAt: "2026-07-25T18:00:00.000Z",
  updatedAt: "2026-07-25T18:00:00.000Z",
}

const ratings: RecipeRating[] = [
  {
    id: "rating-1",
    recipeId: recipe.id,
    mealInstanceId: meal.id,
    residentUserId: "irma",
    score: 5,
    comment: "Baie lekker.",
    submittedBy: "irma",
    submittedAt: "2026-07-25T19:00:00.000Z",
    taskId: 41,
  },
  {
    id: "rating-2",
    recipeId: recipe.id,
    mealInstanceId: meal.id,
    residentUserId: "charl",
    score: 3,
    comment: "Needed more seasoning.",
    submittedBy: "charl",
    submittedAt: "2026-07-25T19:05:00.000Z",
    taskId: 42,
  },
]

function requestFor(userId: string, role: string) {
  return new Request("http://localhost/api/recipes/recipe-1/meals", {
    headers: {
      "x-user-id": userId,
      "x-user-role": role,
      "x-user-email": `${userId}@example.com`,
    },
  })
}

describe("GET /api/recipes/[id]/meals", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRecipeById).mockResolvedValue(recipe)
    vi.mocked(listRecipeMealInstances).mockResolvedValue([meal])
    vi.mocked(listRecipeRatings).mockResolvedValue(ratings)
  })

  it("returns only the authenticated resident's assignment details and rating", async () => {
    const response = await GET(requestFor("irma", "resident"), routeContext)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.mealInstances).toEqual([
      expect.objectContaining({
        id: "meal-1",
        residentUserIds: ["irma"],
        ratingTaskId: 41,
        ratingTaskCount: 1,
        canRate: true,
        summary: {
          mealInstanceId: "meal-1",
          totalRatings: 2,
          averageScore: 4,
        },
        currentUserRating: expect.objectContaining({
          score: 5,
          comment: "Baie lekker.",
        }),
      }),
    ])
    expect(JSON.stringify(body)).not.toContain("Needed more seasoning.")
    expect(JSON.stringify(body)).not.toContain("charl")
  })

  it("rejects a user outside the recipe audience before reading meal history", async () => {
    const response = await GET(requestFor("lucky", "employee"), routeContext)

    expect(response.status).toBe(403)
    expect(listRecipeMealInstances).not.toHaveBeenCalled()
    expect(listRecipeRatings).not.toHaveBeenCalled()
  })

  it("rejects unpublished recipes for non-admin users", async () => {
    vi.mocked(getRecipeById).mockResolvedValue({ ...recipe, status: "draft" })

    const response = await GET(requestFor("irma", "resident"), routeContext)

    expect(response.status).toBe(403)
    expect(listRecipeMealInstances).not.toHaveBeenCalled()
  })

  it("lets an admin review all assignments without exposing rating comments", async () => {
    vi.mocked(getRecipeById).mockResolvedValue({ ...recipe, status: "draft" })

    const response = await GET(requestFor("hans", "admin"), routeContext)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.mealInstances[0]).toMatchObject({
      residentUserIds: ["irma", "charl"],
      ratingTaskCount: 2,
      canRate: true,
      currentUserRating: null,
    })
    expect(JSON.stringify(body)).not.toContain("Baie lekker.")
    expect(JSON.stringify(body)).not.toContain("Needed more seasoning.")
  })
})
