import {
  parseRecipeGuidanceDocument,
  type RecipeGuidanceDocument,
  type RecipeGuidanceSectionKind,
  type RecipeImageBrief,
  type RecipeMediaAsset,
  type RecipeMediaRole,
} from "@/lib/recipe-guidance"
import type { RecipeRecord } from "@/lib/recipes"

interface MediaPlanSlot {
  sectionKind: RecipeGuidanceSectionKind
  role: RecipeMediaRole
  description: { en: string; af: string }
}

export interface RecipeGuidanceMediaPlanResult {
  document: RecipeGuidanceDocument
  addedAssetIds: string[]
}

export interface AttachRecipeGuidanceUploadInput {
  mediaAssetId: string
  upload: {
    id: string
    uploadedBy: string
    uploadedAt: Date
  }
  contentHash: string
  rightsBasis: string
  attributionText: string
  now: string
}

function withoutReview(document: RecipeGuidanceDocument): RecipeGuidanceDocument {
  const mutable = { ...document }
  delete mutable.reviewedBy
  delete mutable.reviewedAt
  delete mutable.reviewEvidence
  return mutable
}

function mediaPlanSlots(recipe: RecipeRecord): MediaPlanSlot[] {
  return [
    {
      sectionKind: "ingredients",
      role: "ingredient_layout",
      description: {
        en: `Overhead ingredient layout for ${recipe.titleEn}, showing only canonical recipe ingredients.`,
        af: `Bogrondse bestanddeeluitleg vir ${recipe.titleAf}, met slegs kanonieke resepbestanddele.`,
      },
    },
    {
      sectionKind: "preparation",
      role: "step",
      description: {
        en: `Reviewed preparation reference for ${recipe.titleEn}, grounded in the canonical recipe steps.`,
        af: `Nagegane voorbereidingsverwysing vir ${recipe.titleAf}, gegrond op die kanonieke resepstappe.`,
      },
    },
    {
      sectionKind: "cooking",
      role: "step",
      description: {
        en: `Reviewed cooking-stage reference for ${recipe.titleEn}, without invented ingredients or actions.`,
        af: `Nagegane kookstadiumverwysing vir ${recipe.titleAf}, sonder versinde bestanddele of handelinge.`,
      },
    },
    {
      sectionKind: "finish_and_serve",
      role: "serving",
      description: {
        en: `Finished serving reference for ${recipe.titleEn}, consistent with the canonical recipe.`,
        af: `Voltooide opdienverwysing vir ${recipe.titleAf}, in ooreenstemming met die kanonieke resep.`,
      },
    },
    {
      sectionKind: "storage_and_reheating",
      role: "storage",
      description: {
        en: `Storage reference for ${recipe.titleEn}; do not imply unreviewed food-safety guidance.`,
        af: `Bergingsverwysing vir ${recipe.titleAf}; moenie onbestudeerde voedselveiligheidsleiding impliseer nie.`,
      },
    },
  ]
}

export function planRecipeGuidanceMedia(
  document: RecipeGuidanceDocument,
  recipe: RecipeRecord,
  now: string
): RecipeGuidanceMediaPlanResult | null {
  const imageBriefs = [...document.imageBriefs]
  const mediaAssets = [...document.mediaAssets]
  const sections = document.sections.map((section) => ({
    ...section,
    blocks: [...section.blocks],
  }))
  const addedAssetIds: string[] = []

  for (const slot of mediaPlanSlots(recipe)) {
    const section = sections.find((candidate) => candidate.kind === slot.sectionKind)
    if (!section) return null
    if (mediaAssets.some((asset) => asset.sectionId === section.id && asset.role === slot.role)) {
      continue
    }

    const existingBrief = imageBriefs.find(
      (brief) => brief.sectionId === section.id && brief.role === slot.role
    )
    const briefId = existingBrief?.id ?? `${section.id}:brief:${slot.role}`
    const assetId = `${section.id}:media:${slot.role}`
    const brief: RecipeImageBrief | null = existingBrief
      ? null
      : {
          id: briefId,
          sectionId: section.id,
          role: slot.role,
          status: "draft",
          description: slot.description,
          reviewedFacts: [
            `Recipe revision: ${document.recipeRevisionId}`,
            ...recipe.ingredients
              .slice(0, 29)
              .map((ingredient) => `Canonical ingredient: ${ingredient.name}`),
          ],
          excludedContent: [
            "Do not invent ingredients, equipment, safety claims, branding, labels, or text overlays.",
          ],
        }
    const asset: RecipeMediaAsset = {
      id: assetId,
      sectionId: section.id,
      imageBriefId: briefId,
      role: slot.role,
      status: "planned",
    }

    if (brief) imageBriefs.push(brief)
    mediaAssets.push(asset)
    section.blocks.push({
      id: `${assetId}:reference`,
      type: "media_reference",
      mediaAssetId: assetId,
    })
    addedAssetIds.push(assetId)
  }

  const candidate = parseRecipeGuidanceDocument({
    ...withoutReview(document),
    imageBriefs,
    mediaAssets,
    sections,
    updatedAt: now,
  })
  return candidate ? { document: candidate, addedAssetIds } : null
}

export function attachRecipeGuidanceUpload(
  document: RecipeGuidanceDocument,
  input: AttachRecipeGuidanceUploadInput
): RecipeGuidanceDocument | null {
  const assetIndex = document.mediaAssets.findIndex((asset) => asset.id === input.mediaAssetId)
  const target = document.mediaAssets[assetIndex]
  if (
    assetIndex === -1 ||
    !target ||
    !["planned", "review_required", "rejected", "unavailable"].includes(target.status)
  ) {
    return null
  }

  const mediaAssets = [...document.mediaAssets]
  mediaAssets[assetIndex] = {
    id: target.id,
    sectionId: target.sectionId,
    role: target.role,
    ...(target.imageBriefId ? { imageBriefId: target.imageBriefId } : {}),
    status: "review_required",
    source: {
      type: "uploaded",
      uploadId: input.upload.id,
      uploadedBy: input.upload.uploadedBy,
      uploadedAt: input.upload.uploadedAt.toISOString(),
      rightsBasis: input.rightsBasis,
      attributionText: input.attributionText,
    },
    storage: {
      type: "hov",
      storageId: input.upload.id,
      url: `/api/uploads/${input.upload.id}`,
      contentHash: input.contentHash,
    },
  }

  const sections = document.sections.map((section) => {
    if (section.id !== target.sectionId) return section
    if (
      section.blocks.some(
        (block) => block.type === "media_reference" && block.mediaAssetId === target.id
      )
    ) {
      return section
    }
    return {
      ...section,
      blocks: [
        ...section.blocks,
        { id: `${target.id}:reference`, type: "media_reference" as const, mediaAssetId: target.id },
      ],
    }
  })

  return parseRecipeGuidanceDocument({
    ...withoutReview(document),
    mediaAssets,
    sections,
    updatedAt: input.now,
  })
}
