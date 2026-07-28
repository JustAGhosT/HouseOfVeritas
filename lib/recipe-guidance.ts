import { z } from "zod"
import type { RecipeRecord } from "@/lib/recipes"

export const RECIPE_GUIDANCE_SECTION_KINDS = [
  "identity",
  "hero",
  "before_start",
  "ingredients",
  "preparation",
  "cooking",
  "finish_and_serve",
  "storage_and_reheating",
  "provenance_and_feedback",
] as const

export const RECIPE_GUIDANCE_STATUSES = ["draft", "in_review", "published", "archived"] as const

export const RECIPE_MEDIA_ROLES = [
  "hero",
  "ingredient_layout",
  "step",
  "serving",
  "storage",
] as const

export const RECIPE_MEDIA_STATUSES = [
  "planned",
  "requested",
  "generated",
  "review_required",
  "approved",
  "rejected",
  "unavailable",
] as const

export const RECIPE_IMAGE_BRIEF_STATUSES = ["draft", "approved", "retired"] as const

export type RecipeGuidanceSectionKind = (typeof RECIPE_GUIDANCE_SECTION_KINDS)[number]
export type RecipeGuidanceStatus = (typeof RECIPE_GUIDANCE_STATUSES)[number]
export type RecipeMediaRole = (typeof RECIPE_MEDIA_ROLES)[number]
export type RecipeMediaStatus = (typeof RECIPE_MEDIA_STATUSES)[number]
export type RecipeImageBriefStatus = (typeof RECIPE_IMAGE_BRIEF_STATUSES)[number]

const nonEmptyId = z.string().trim().min(1).max(200)
const immutableRecipeRevisionId = z.string().trim().min(1).max(500)
const isoDateTime = z.string().datetime({ offset: true })
const mediaPathOrigin = "https://hov.invalid"
const isInternalMediaPath = (value: string) => {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false

  try {
    return new URL(value, mediaPathOrigin).origin === mediaPathOrigin
  } catch {
    return false
  }
}
const isHttpMediaUrl = (value: string) => {
  try {
    const url = new URL(value)
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname)
  } catch {
    return false
  }
}
const normalizeLegacyMediaUrl = (value: string) => {
  const trimmed = value.trim()
  if (isInternalMediaPath(trimmed) || isHttpMediaUrl(trimmed)) return trimmed
  if (trimmed.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null

  const relativePath = trimmed.replace(/^\.\//, "")
  const normalizedPath = relativePath ? `/${relativePath}` : ""
  return isInternalMediaPath(normalizedPath) ? normalizedPath : null
}
const safeMediaUrl = z
  .string()
  .trim()
  .min(1)
  .max(2_000)
  .refine(
    (value) => isInternalMediaPath(value) || isHttpMediaUrl(value),
    "media URL must be an application path or an HTTP(S) URL"
  )
const hovMediaPath = z
  .string()
  .trim()
  .min(1)
  .max(2_000)
  .refine(isInternalMediaPath, "HOV-managed media must use an internal application path")
const localizedTextSchema = z.object({
  en: z.string().trim().min(1).max(2_000),
  af: z.string().trim().min(1).max(2_000),
})

export const guidanceTimerSchema = z
  .object({
    minimumSeconds: z.number().int().positive().max(86_400),
    maximumSeconds: z.number().int().positive().max(86_400).optional(),
  })
  .superRefine((timer, context) => {
    if (timer.maximumSeconds !== undefined && timer.maximumSeconds < timer.minimumSeconds) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maximumSeconds"],
        message: "maximumSeconds must be greater than or equal to minimumSeconds",
      })
    }
  })

export type GuidanceTimer = z.infer<typeof guidanceTimerSchema>

export function createRecipeRevisionId(recipeId: string, recipeUpdatedAt: string): string {
  return `${recipeId}@${recipeUpdatedAt}`
}

const licensedMediaSourceSchema = z.object({
  type: z.literal("licensed"),
  source: z.string().trim().min(1).max(500),
  author: z.string().trim().min(1).max(300).optional(),
  license: z.string().trim().min(1).max(300),
  attributionText: z.string().trim().min(1).max(1_000),
  retrievedAt: z.string().trim().min(1).max(100),
})

const uploadedMediaSourceSchema = z.object({
  type: z.literal("uploaded"),
  uploadId: nonEmptyId,
  uploadedBy: nonEmptyId,
  uploadedAt: isoDateTime,
  rightsBasis: z.string().trim().min(1).max(500),
})

const generatedMediaSourceSchema = z.object({
  type: z.literal("generated"),
  requestId: nonEmptyId,
  modelAlias: nonEmptyId,
  generatedAt: isoDateTime,
  rightsBasis: z.string().trim().min(1).max(500),
})

export const recipeMediaSourceSchema = z.discriminatedUnion("type", [
  licensedMediaSourceSchema,
  uploadedMediaSourceSchema,
  generatedMediaSourceSchema,
])

export const recipeMediaStorageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("external"),
    url: safeMediaUrl,
  }),
  z.object({
    type: z.literal("hov"),
    storageId: nonEmptyId,
    url: hovMediaPath,
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    thumbnailUrl: hovMediaPath.optional(),
  }),
])

export const recipeMediaAssetSchema = z
  .object({
    id: nonEmptyId,
    sectionId: nonEmptyId,
    imageBriefId: nonEmptyId.optional(),
    role: z.enum(RECIPE_MEDIA_ROLES),
    status: z.enum(RECIPE_MEDIA_STATUSES),
    source: recipeMediaSourceSchema.optional(),
    storage: recipeMediaStorageSchema.optional(),
    altText: localizedTextSchema.optional(),
    reviewedBy: nonEmptyId.optional(),
    reviewedAt: isoDateTime.optional(),
    rejectionReason: z.string().trim().min(1).max(1_000).optional(),
    unavailableReason: z.string().trim().min(1).max(1_000).optional(),
  })
  .superRefine((asset, context) => {
    if (asset.status === "approved") {
      for (const field of ["source", "storage", "altText", "reviewedBy", "reviewedAt"] as const) {
        if (asset[field] === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required for approved media`,
          })
        }
      }

      if (asset.source?.type === "generated" && asset.storage?.type !== "hov") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["storage"],
          message: "approved generated media must be copied into HOV-managed storage",
        })
      }
    }

    if (["planned", "requested"].includes(asset.status) && !asset.imageBriefId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageBriefId"],
        message: `imageBriefId is required for ${asset.status} media`,
      })
    }

    if (asset.status === "generated" && asset.source?.type !== "generated") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source"],
        message: "generated media requires generation provenance",
      })
    }

    if (asset.source?.type === "generated" && !asset.imageBriefId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageBriefId"],
        message: "generated media must retain its approved image brief",
      })
    }

    if (asset.status !== "approved" && asset.altText) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["altText"],
        message: "altText may only be recorded after media approval",
      })
    }

    if (["generated", "review_required"].includes(asset.status) && !asset.storage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storage"],
        message: `${asset.status} media requires a reviewable storage location`,
      })
    }

    if (asset.status === "rejected" && !asset.rejectionReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejectionReason"],
        message: "rejectionReason is required for rejected media",
      })
    }

    if (asset.status === "unavailable" && !asset.unavailableReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unavailableReason"],
        message: "unavailableReason is required for unavailable media",
      })
    }
  })

export type RecipeMediaAsset = z.infer<typeof recipeMediaAssetSchema>

export const recipeImageBriefSchema = z
  .object({
    id: nonEmptyId,
    sectionId: nonEmptyId,
    role: z.enum(RECIPE_MEDIA_ROLES),
    status: z.enum(RECIPE_IMAGE_BRIEF_STATUSES),
    description: localizedTextSchema,
    reviewedFacts: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    excludedContent: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    approvedBy: nonEmptyId.optional(),
    approvedAt: isoDateTime.optional(),
  })
  .superRefine((brief, context) => {
    if (brief.status === "approved") {
      for (const field of ["approvedBy", "approvedAt"] as const) {
        if (!brief[field]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required for an approved image brief`,
          })
        }
      }
    }
  })

export type RecipeImageBrief = z.infer<typeof recipeImageBriefSchema>

const recipeGuidanceBlockSchema = z
  .discriminatedUnion("type", [
    z.object({
      id: nonEmptyId,
      type: z.literal("text"),
      source: z.enum(["recipe", "reviewed"]),
      text: localizedTextSchema,
    }),
    z.object({
      id: nonEmptyId,
      type: z.literal("metrics"),
      servings: z.number().int().positive().optional(),
      prepMinutes: z.number().int().nonnegative().optional(),
      cookMinutes: z.number().int().nonnegative().optional(),
    }),
    z.object({
      id: nonEmptyId,
      type: z.literal("ingredient_references"),
      recipeRevisionId: immutableRecipeRevisionId,
      ingredientIds: z.array(nonEmptyId).min(1),
    }),
    z.object({
      id: nonEmptyId,
      type: z.literal("step_reference"),
      recipeRevisionId: immutableRecipeRevisionId,
      recipeStepId: nonEmptyId,
      timer: guidanceTimerSchema.optional(),
    }),
    z.object({
      id: nonEmptyId,
      type: z.literal("media_reference"),
      mediaAssetId: nonEmptyId,
    }),
    z.object({
      id: nonEmptyId,
      type: z.literal("notice"),
      noticeType: z.enum(["allergen", "safety", "preparation", "storage"]),
      text: localizedTextSchema,
    }),
  ])
  .superRefine((block, context) => {
    if (
      block.type === "metrics" &&
      block.servings === undefined &&
      block.prepMinutes === undefined &&
      block.cookMinutes === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "metrics blocks require at least one metric",
      })
    }
  })

export type RecipeGuidanceBlock = z.infer<typeof recipeGuidanceBlockSchema>

const FOUNDATIONAL_SECTION_KINDS = new Set<RecipeGuidanceSectionKind>([
  "identity",
  "ingredients",
  "cooking",
])

const PUBLISHABLE_SECTION_BLOCK_TYPES = {
  identity: ["text"],
  hero: ["media_reference"],
  before_start: ["text", "notice"],
  ingredients: ["ingredient_references"],
  preparation: ["text", "step_reference"],
  cooking: ["step_reference"],
  finish_and_serve: ["text", "step_reference", "media_reference"],
  storage_and_reheating: ["text", "notice"],
  provenance_and_feedback: ["text"],
} as const satisfies Record<RecipeGuidanceSectionKind, readonly RecipeGuidanceBlock["type"][]>

function isPublishableSectionBlock(
  sectionKind: RecipeGuidanceSectionKind,
  block: RecipeGuidanceBlock
): boolean {
  const allowedTypes = PUBLISHABLE_SECTION_BLOCK_TYPES[sectionKind] as readonly string[]
  return allowedTypes.includes(block.type) && (block.type !== "text" || block.source === "reviewed")
}

export const recipeGuidanceSectionSchema = z.object({
  id: nonEmptyId,
  kind: z.enum(RECIPE_GUIDANCE_SECTION_KINDS),
  applicability: z.enum(["required", "optional", "not_applicable"]),
  blocks: z.array(recipeGuidanceBlockSchema),
})

export type RecipeGuidanceSection = z.infer<typeof recipeGuidanceSectionSchema>

export const recipeGuidanceDocumentSchema = z
  .object({
    id: nonEmptyId,
    recipeId: nonEmptyId,
    recipeRevisionId: immutableRecipeRevisionId,
    recipeUpdatedAt: isoDateTime,
    version: z.number().int().positive(),
    status: z.enum(RECIPE_GUIDANCE_STATUSES),
    ownerUserId: nonEmptyId,
    audienceUserIds: z.array(nonEmptyId).min(1),
    sections: z.array(recipeGuidanceSectionSchema).length(RECIPE_GUIDANCE_SECTION_KINDS.length),
    mediaAssets: z.array(recipeMediaAssetSchema).default([]),
    imageBriefs: z.array(recipeImageBriefSchema).default([]),
    createdBy: nonEmptyId,
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
    reviewedBy: nonEmptyId.optional(),
    reviewedAt: isoDateTime.optional(),
    publishedBy: nonEmptyId.optional(),
    publishedAt: isoDateTime.optional(),
  })
  .superRefine((document, context) => {
    document.sections.forEach((section, index) => {
      if (section.kind !== RECIPE_GUIDANCE_SECTION_KINDS[index]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections", index, "kind"],
          message: `expected ${RECIPE_GUIDANCE_SECTION_KINDS[index]}`,
        })
      }
    })

    const identifiers = [
      ...document.sections.map((section) => section.id),
      ...document.sections.flatMap((section) => section.blocks.map((block) => block.id)),
      ...document.mediaAssets.map((asset) => asset.id),
      ...document.imageBriefs.map((brief) => brief.id),
    ]
    if (new Set(identifiers).size !== identifiers.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sections"],
        message: "section, block, media, and image brief IDs must be unique within a document",
      })
    }

    const sectionIds = new Set(document.sections.map((section) => section.id))
    const mediaAssetsById = new Map(document.mediaAssets.map((asset) => [asset.id, asset]))
    const imageBriefsById = new Map(document.imageBriefs.map((brief) => [brief.id, brief]))

    document.mediaAssets.forEach((asset, index) => {
      if (!sectionIds.has(asset.sectionId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mediaAssets", index, "sectionId"],
          message: "media asset must reference a section in this document",
        })
      }
      const imageBrief = asset.imageBriefId ? imageBriefsById.get(asset.imageBriefId) : undefined
      if (asset.imageBriefId && !imageBrief) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mediaAssets", index, "imageBriefId"],
          message: "media asset must reference an image brief in this document",
        })
      }
      const requiresApprovedBrief =
        asset.status === "requested" || asset.source?.type === "generated"
      if (
        requiresApprovedBrief &&
        imageBrief &&
        (imageBrief.status !== "approved" ||
          imageBrief.sectionId !== asset.sectionId ||
          imageBrief.role !== asset.role)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mediaAssets", index, "imageBriefId"],
          message: "media generation requires an approved brief with the same section and role",
        })
      }
    })

    document.imageBriefs.forEach((brief, index) => {
      if (!sectionIds.has(brief.sectionId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["imageBriefs", index, "sectionId"],
          message: "image brief must reference a section in this document",
        })
      }
    })

    document.sections.forEach((section, sectionIndex) => {
      section.blocks.forEach((block, blockIndex) => {
        if (
          (block.type === "ingredient_references" || block.type === "step_reference") &&
          block.recipeRevisionId !== document.recipeRevisionId
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["sections", sectionIndex, "blocks", blockIndex, "recipeRevisionId"],
            message: "recipe references must target this document's immutable recipe revision",
          })
        }
        if (block.type === "media_reference") {
          const mediaAsset = mediaAssetsById.get(block.mediaAssetId)
          if (!mediaAsset) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["sections", sectionIndex, "blocks", blockIndex, "mediaAssetId"],
              message: "media block must reference an asset in this document",
            })
          } else if (mediaAsset.sectionId !== section.id) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["sections", sectionIndex, "blocks", blockIndex, "mediaAssetId"],
              message: "media block must reference an asset owned by the same section",
            })
          } else if (document.status === "published" && mediaAsset.status !== "approved") {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["sections", sectionIndex, "blocks", blockIndex, "mediaAssetId"],
              message: "published media blocks must reference approved assets",
            })
          }
        }
      })
    })

    if (document.status === "published") {
      for (const field of ["reviewedBy", "reviewedAt", "publishedBy", "publishedAt"] as const) {
        if (!document[field]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required for a published guidance document`,
          })
        }
      }

      document.sections.forEach((section, index) => {
        if (
          (section.applicability === "required" || FOUNDATIONAL_SECTION_KINDS.has(section.kind)) &&
          !section.blocks.some((block) => isPublishableSectionBlock(section.kind, block))
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["sections", index, "blocks"],
            message: `${section.kind} requires section-appropriate reviewed content before publication`,
          })
        }
      })

      document.mediaAssets.forEach((asset, index) => {
        if (!["approved", "rejected", "unavailable"].includes(asset.status)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["mediaAssets", index, "status"],
            message: "published guidance cannot contain unfinished media",
          })
        }
      })
    }
  })

export type RecipeGuidanceDocument = z.infer<typeof recipeGuidanceDocumentSchema>

export function parseRecipeGuidanceDocument(input: unknown): RecipeGuidanceDocument | null {
  const parsed = recipeGuidanceDocumentSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function recipeHeroToReviewRequiredMedia(recipe: RecipeRecord): RecipeMediaAsset {
  const normalizedUrl = normalizeLegacyMediaUrl(recipe.image.url)

  return {
    id: `${recipe.id}:hero`,
    sectionId: `${recipe.id}:hero-section`,
    role: "hero",
    status: normalizedUrl ? "review_required" : "unavailable",
    source: {
      type: "licensed",
      source: recipe.image.source,
      author: recipe.image.author,
      license: recipe.image.license,
      attributionText: recipe.image.attributionText,
      retrievedAt: recipe.image.retrievedAt,
    },
    ...(normalizedUrl
      ? { storage: { type: "external" as const, url: normalizedUrl } }
      : { unavailableReason: "Legacy hero URL could not be represented safely" }),
  }
}
