import {
  RECIPE_GUIDANCE_SECTION_KINDS,
  createRecipeRevisionId,
  parseRecipeGuidanceDocument,
  recipeHeroToReviewRequiredMedia,
  type RecipeGuidanceBlock,
  type RecipeGuidanceDocument,
  type RecipeGuidanceSection,
  type RecipeGuidanceSectionKind,
} from "@/lib/recipe-guidance"
import type { RecipeRecord } from "@/lib/recipes"

export interface BuildRecipeGuidanceDraftOptions {
  version: number
  createdBy: string
  now: string
}

export class RecipeGuidanceBuildError extends Error {}

function sectionId(documentId: string, kind: RecipeGuidanceSectionKind): string {
  return `${documentId}:section:${kind}`
}

function buildSections(
  recipe: RecipeRecord,
  documentId: string,
  recipeRevisionId: string,
  heroAssetId: string
): RecipeGuidanceSection[] {
  const steps = recipe.steps.slice().sort((left, right) => left.order - right.order)

  return RECIPE_GUIDANCE_SECTION_KINDS.map((kind) => {
    const id = sectionId(documentId, kind)
    let applicability: RecipeGuidanceSection["applicability"] = "optional"
    let blocks: RecipeGuidanceBlock[] = []

    if (kind === "identity") {
      applicability = "required"
      blocks = [
        {
          id: `${id}:title`,
          type: "text",
          source: "recipe",
          text: { en: recipe.titleEn, af: recipe.titleAf },
        },
        {
          id: `${id}:summary`,
          type: "text",
          source: "recipe",
          text: {
            en: recipe.summaryEn ?? recipe.titleEn,
            af: recipe.summaryAf ?? recipe.titleAf,
          },
        },
      ]
      if (
        recipe.servings !== undefined ||
        recipe.prepMinutes !== undefined ||
        recipe.cookMinutes !== undefined
      ) {
        blocks.push({
          id: `${id}:metrics`,
          type: "metrics",
          servings: recipe.servings,
          prepMinutes: recipe.prepMinutes,
          cookMinutes: recipe.cookMinutes,
        })
      }
    } else if (kind === "hero") {
      blocks = [{ id: `${id}:media`, type: "media_reference", mediaAssetId: heroAssetId }]
    } else if (kind === "ingredients") {
      applicability = "required"
      blocks = [
        {
          id: `${id}:ingredients`,
          type: "ingredient_references",
          recipeRevisionId,
          ingredientIds: recipe.ingredients.map((ingredient) => ingredient.id),
        },
      ]
    } else if (kind === "cooking") {
      applicability = "required"
      blocks = steps.map((step, index) => ({
        id: `${id}:step:${index + 1}`,
        type: "step_reference",
        recipeRevisionId,
        recipeStepId: step.id,
        ...(step.timerMinutes === undefined
          ? {}
          : { timer: { minimumSeconds: step.timerMinutes * 60 } }),
      }))
    } else if (kind === "provenance_and_feedback") {
      applicability = "required"
      blocks = [
        {
          id: `${id}:attribution`,
          type: "text",
          source: "recipe",
          text: {
            en: recipe.image.attributionText,
            af: recipe.image.attributionText,
          },
        },
      ]
    }

    return { id, kind, applicability, blocks }
  })
}

export function buildRecipeGuidanceDraft(
  recipe: RecipeRecord,
  options: BuildRecipeGuidanceDraftOptions
): RecipeGuidanceDocument {
  if (!Number.isInteger(options.version) || options.version < 1) {
    throw new RecipeGuidanceBuildError("Recipe guidance version must be a positive integer")
  }
  if (recipe.ingredients.length === 0 || recipe.steps.length === 0) {
    throw new RecipeGuidanceBuildError("Recipe guidance requires canonical ingredients and steps")
  }

  const documentId = `${recipe.id}:guidance:${options.version}`
  const recipeRevisionId = createRecipeRevisionId(recipe.id, recipe.updatedAt)
  const heroSectionId = sectionId(documentId, "hero")
  const heroAsset = {
    ...recipeHeroToReviewRequiredMedia(recipe, heroSectionId),
    id: `${documentId}:hero`,
  }
  const audienceUserIds =
    recipe.audienceUserIds.length > 0 ? [...new Set(recipe.audienceUserIds)] : [recipe.ownerUserId]

  const draft = parseRecipeGuidanceDocument({
    id: documentId,
    recipeId: recipe.id,
    recipeRevisionId,
    recipeUpdatedAt: recipe.updatedAt,
    recipeIngredientIds: recipe.ingredients.map((ingredient) => ingredient.id),
    recipeStepIds: recipe.steps
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((step) => step.id),
    version: options.version,
    status: "draft",
    ownerUserId: recipe.ownerUserId,
    audienceUserIds,
    sections: buildSections(recipe, documentId, recipeRevisionId, heroAsset.id),
    mediaAssets: [heroAsset],
    imageBriefs: [],
    createdBy: options.createdBy,
    createdAt: options.now,
    updatedAt: options.now,
  })

  if (!draft) {
    throw new RecipeGuidanceBuildError("Canonical recipe guidance draft is invalid")
  }
  return draft
}
