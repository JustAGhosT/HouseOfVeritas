import { describe, expect, it } from "vitest"
import { recipeToGuidanceDraft, type GuidancePack } from "@/lib/guidance"
import {
  planRecipeGuidanceMigration,
  type RecipeGuidanceMigrationReason,
} from "@/lib/recipe-guidance-migration"
import { RECIPE_GUIDANCE_SECTION_KINDS, type RecipeGuidanceDocument } from "@/lib/recipe-guidance"
import type { RecipeRecord } from "@/lib/recipes"

const now = "2026-07-29T08:00:00.000Z"

function buildRecipe(): RecipeRecord {
  return {
    id: "recipe-1",
    status: "published",
    ownerUserId: "hans",
    audienceUserIds: ["irma"],
    titleEn: "Fried rice",
    titleAf: "Gebraaide rys",
    summaryEn: "A quick meal.",
    summaryAf: "'n Vinnige maaltyd.",
    image: {
      url: "/rice.jpg",
      source: "House",
      license: "Owned",
      attributionText: "House",
      retrievedAt: "2026-07-29",
    },
    ingredients: [{ id: "rice", quantity: "2", unit: "cups", name: "rice" }],
    steps: [
      {
        id: "cook",
        order: 1,
        instructionEn: "Cook the rice.",
        instructionAf: "Kook die rys.",
      },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

function buildLegacyGuidance(recipe: RecipeRecord): GuidancePack {
  const draft = recipeToGuidanceDraft(recipe, "en")
  return {
    ...draft,
    id: "legacy-guidance-1",
    version: 1,
    status: "published",
    steps: draft.steps.map((step) => ({ ...step, id: `legacy-step-${step.order}` })),
    source: { type: "recipe", recipeId: recipe.id },
    createdBy: "hans",
    createdAt: now,
    updatedAt: now,
  }
}

function buildExistingDocument(recipe: RecipeRecord): RecipeGuidanceDocument {
  return {
    id: "recipe-1:guidance:1",
    recipeId: recipe.id,
    recipeRevisionId: `${recipe.id}@${recipe.updatedAt}`,
    recipeUpdatedAt: recipe.updatedAt,
    recipeIngredientIds: recipe.ingredients.map((ingredient) => ingredient.id),
    recipeStepIds: recipe.steps.map((step) => step.id),
    version: 1,
    status: "draft",
    ownerUserId: recipe.ownerUserId,
    audienceUserIds: recipe.audienceUserIds,
    sections: RECIPE_GUIDANCE_SECTION_KINDS.map((kind) => ({
      id: `section:${kind}`,
      kind,
      applicability: "required",
      blocks: [],
    })),
    mediaAssets: [],
    imageBriefs: [],
    createdBy: "hans",
    createdAt: now,
    updatedAt: now,
  }
}

function reasonCounts(plan: ReturnType<typeof planRecipeGuidanceMigration>) {
  return Object.entries(plan.counts).filter(([, count]) => count > 0) as Array<
    [RecipeGuidanceMigrationReason, number]
  >
}

describe("recipe guidance migration planning", () => {
  it("requires a canonical rebuild and never authorizes writes", () => {
    const recipe = buildRecipe()
    const plan = planRecipeGuidanceMigration({
      legacyGuidance: [buildLegacyGuidance(recipe)],
      recipes: [recipe],
      existingDocuments: [],
    })

    expect(plan.writesAuthorized).toBe(false)
    expect(plan.candidates).toEqual([
      {
        legacyGuidancePackId: "legacy-guidance-1",
        recipeId: "recipe-1",
        reason: "rebuild_from_recipe_required",
        migratable: true,
      },
    ])
    expect(reasonCounts(plan)).toEqual([["rebuild_from_recipe_required", 1]])
  })

  it("does not duplicate a recipe revision already present in the new collection", () => {
    const recipe = buildRecipe()
    const plan = planRecipeGuidanceMigration({
      legacyGuidance: [buildLegacyGuidance(recipe)],
      recipes: [recipe],
      existingDocuments: [buildExistingDocument(recipe)],
    })

    expect(plan.candidates[0]).toMatchObject({ reason: "already_present", migratable: false })
  })

  it("blocks missing recipes, incoherent provenance, and stale snapshots", () => {
    const recipe = buildRecipe()
    const valid = buildLegacyGuidance(recipe)
    const incoherent = {
      ...valid,
      id: "legacy-invalid",
      source: { type: "manual" as const, recipeId: recipe.id },
    }
    const stale = {
      ...valid,
      id: "legacy-stale",
      sourceRecipeRevisionId: "recipe-1@2026-07-28T08:00:00.000Z",
    }

    const plan = planRecipeGuidanceMigration({
      legacyGuidance: [
        incoherent,
        {
          ...valid,
          id: "legacy-missing",
          sourceRecipeId: "missing",
          source: { type: "recipe", recipeId: "missing" },
        },
        stale,
      ],
      recipes: [recipe],
      existingDocuments: [],
    })

    expect(plan.candidates.map((candidate) => candidate.reason)).toEqual([
      "invalid_recipe_provenance",
      "recipe_not_found",
      "recipe_snapshot_mismatch",
    ])
  })
})
