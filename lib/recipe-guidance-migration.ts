import { guidanceMatchesRecipeSnapshot, type GuidancePack } from "@/lib/guidance"
import type { RecipeGuidanceDocument } from "@/lib/recipe-guidance"
import type { RecipeRecord } from "@/lib/recipes"

export const RECIPE_GUIDANCE_MIGRATION_REASONS = [
  "already_present",
  "duplicate_legacy_revision",
  "rebuild_from_recipe_required",
  "invalid_recipe_provenance",
  "recipe_not_found",
  "recipe_snapshot_mismatch",
] as const

export type RecipeGuidanceMigrationReason = (typeof RECIPE_GUIDANCE_MIGRATION_REASONS)[number]

export interface RecipeGuidanceMigrationCandidate {
  legacyGuidancePackId: string
  recipeId?: string
  recipeRevisionId?: string
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
  const existingRevisions = new Set(
    params.existingDocuments.map((document) => document.recipeRevisionId)
  )
  const selectedRevisions = new Set<string>()
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

      const recipeRevisionId = guidance.sourceRecipeRevisionId as string

      if (existingRevisions.has(recipeRevisionId)) {
        return {
          legacyGuidancePackId: guidance.id,
          recipeId,
          recipeRevisionId,
          reason: "already_present",
          migratable: false,
        }
      }

      if (selectedRevisions.has(recipeRevisionId)) {
        return {
          legacyGuidancePackId: guidance.id,
          recipeId,
          recipeRevisionId,
          reason: "duplicate_legacy_revision",
          migratable: false,
        }
      }
      selectedRevisions.add(recipeRevisionId)

      return {
        legacyGuidancePackId: guidance.id,
        recipeId,
        recipeRevisionId,
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
