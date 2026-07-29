import { guidanceMatchesRecipeSnapshot, type GuidancePack } from "@/lib/guidance"
import type { RecipeGuidanceDocument } from "@/lib/recipe-guidance"
import type { RecipeRecord } from "@/lib/recipes"

export const RECIPE_GUIDANCE_MIGRATION_REASONS = [
  "already_present",
  "rebuild_from_recipe_required",
  "invalid_recipe_provenance",
  "recipe_not_found",
  "recipe_snapshot_mismatch",
] as const

export type RecipeGuidanceMigrationReason = (typeof RECIPE_GUIDANCE_MIGRATION_REASONS)[number]

export interface RecipeGuidanceMigrationCandidate {
  legacyGuidancePackId: string
  recipeId?: string
  reason: RecipeGuidanceMigrationReason
  migratable: boolean
}

export interface RecipeGuidanceMigrationPlan {
  candidates: RecipeGuidanceMigrationCandidate[]
  counts: Record<RecipeGuidanceMigrationReason, number>
  writesAuthorized: false
}

export function planRecipeGuidanceMigration(params: {
  legacyGuidance: GuidancePack[]
  recipes: RecipeRecord[]
  existingDocuments: RecipeGuidanceDocument[]
}): RecipeGuidanceMigrationPlan {
  const recipesById = new Map(params.recipes.map((recipe) => [recipe.id, recipe]))
  const candidates = params.legacyGuidance
    .filter(
      (guidance) =>
        guidance.kind === "recipe" ||
        guidance.source.type === "recipe" ||
        guidance.source.recipeId !== undefined ||
        guidance.sourceRecipeId !== undefined
    )
    .map((guidance): RecipeGuidanceMigrationCandidate => {
      const recipeId = guidance.sourceRecipeId ?? guidance.source.recipeId
      if (
        !recipeId ||
        guidance.source.type !== "recipe" ||
        guidance.source.recipeId !== recipeId ||
        guidance.sourceRecipeId !== recipeId
      ) {
        return {
          legacyGuidancePackId: guidance.id,
          recipeId,
          reason: "invalid_recipe_provenance",
          migratable: false,
        }
      }

      const recipe = recipesById.get(recipeId)
      if (!recipe) {
        return {
          legacyGuidancePackId: guidance.id,
          recipeId,
          reason: "recipe_not_found",
          migratable: false,
        }
      }

      if (!guidanceMatchesRecipeSnapshot(guidance, recipe)) {
        return {
          legacyGuidancePackId: guidance.id,
          recipeId,
          reason: "recipe_snapshot_mismatch",
          migratable: false,
        }
      }

      if (
        params.existingDocuments.some(
          (document) =>
            document.recipeId === recipeId &&
            document.recipeRevisionId === guidance.sourceRecipeRevisionId
        )
      ) {
        return {
          legacyGuidancePackId: guidance.id,
          recipeId,
          reason: "already_present",
          migratable: false,
        }
      }

      return {
        legacyGuidancePackId: guidance.id,
        recipeId,
        reason: "rebuild_from_recipe_required",
        migratable: true,
      }
    })

  const counts = Object.fromEntries(
    RECIPE_GUIDANCE_MIGRATION_REASONS.map((reason) => [
      reason,
      candidates.filter((candidate) => candidate.reason === reason).length,
    ])
  ) as Record<RecipeGuidanceMigrationReason, number>

  return { candidates, counts, writesAuthorized: false }
}
