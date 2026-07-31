import { z } from "zod"
import {
  localizedTextSchema,
  RECIPE_MEDIA_ROLES,
  type RecipeGuidanceDocument,
  type RecipeImageBrief,
} from "@/lib/recipe-guidance"

export const RECIPE_GENERATION_REQUIRED_CAPABILITIES = [
  "model_alias",
  "request_response_contract",
  "request_id_propagation",
  "cost_reporting",
  "telemetry",
  "rights_enforcement",
  "hov_storage_copy",
] as const

const generationCapabilitySchema = z.enum(RECIPE_GENERATION_REQUIRED_CAPABILITIES)

export const recipeGuidanceGenerationRequestSchema = z
  .object({
    contractVersion: z.literal("recipe-image-generation.v1"),
    requestId: z.string().trim().min(1).max(1_000),
    requestedBy: z.string().trim().min(1).max(200),
    requestedAt: z.string().datetime({ offset: true }),
    recipe: z
      .object({
        id: z.string().trim().min(1).max(200),
        revisionId: z.string().trim().min(1).max(500),
      })
      .strict(),
    guidance: z
      .object({
        documentId: z.string().trim().min(1).max(200),
        version: z.number().int().positive(),
      })
      .strict(),
    target: z
      .object({
        mediaAssetId: z.string().trim().min(1).max(200),
        imageBriefId: z.string().trim().min(1).max(200),
        sectionId: z.string().trim().min(1).max(200),
        role: z.enum(RECIPE_MEDIA_ROLES),
      })
      .strict(),
    brief: z
      .object({
        description: localizedTextSchema,
        reviewedFacts: z.array(z.string().trim().min(1).max(500)).max(30),
        excludedContent: z.array(z.string().trim().min(1).max(500)).max(30),
        approvedBy: z.string().trim().min(1).max(200),
        approvedAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    output: z
      .object({
        kind: z.literal("image"),
        storage: z.literal("hov_managed_copy_required"),
        publicUrlAllowed: z.literal(false),
      })
      .strict(),
    execution: z
      .object({
        allowed: z.literal(false),
        provider: z.null(),
        modelAlias: z.null(),
        reason: z.literal("Provider execution is disabled until Sluice capabilities are proven"),
        missingCapabilities: z.array(generationCapabilitySchema).min(1),
      })
      .strict(),
  })
  .strict()

export type RecipeGuidanceGenerationRequest = z.infer<typeof recipeGuidanceGenerationRequestSchema>

function approvedBriefSnapshot(brief: RecipeImageBrief) {
  if (
    brief.status !== "approved" ||
    !brief.approvedBy ||
    !brief.approvedAt ||
    brief.reviewedFacts.length === 0 ||
    brief.excludedContent.length === 0
  ) {
    return null
  }
  return {
    description: brief.description,
    reviewedFacts: brief.reviewedFacts,
    excludedContent: brief.excludedContent,
    approvedBy: brief.approvedBy,
    approvedAt: brief.approvedAt,
  }
}

export function buildRecipeGuidanceGenerationRequest(
  document: RecipeGuidanceDocument,
  imageBriefId: string,
  requestedBy: string,
  requestedAt: string
): RecipeGuidanceGenerationRequest | null {
  if (!["draft", "in_review"].includes(document.status)) return null
  const brief = document.imageBriefs.find((candidate) => candidate.id === imageBriefId)
  if (!brief) return null
  const briefSnapshot = approvedBriefSnapshot(brief)
  if (!briefSnapshot) return null
  const asset = document.mediaAssets.find(
    (candidate) => candidate.imageBriefId === brief.id && candidate.status === "planned"
  )
  if (!asset) return null

  const candidate = {
    contractVersion: "recipe-image-generation.v1" as const,
    requestId: `${document.id}:v${document.version}:${brief.id}:${brief.approvedAt}`,
    requestedBy,
    requestedAt,
    recipe: { id: document.recipeId, revisionId: document.recipeRevisionId },
    guidance: { documentId: document.id, version: document.version },
    target: {
      mediaAssetId: asset.id,
      imageBriefId: brief.id,
      sectionId: brief.sectionId,
      role: brief.role,
    },
    brief: briefSnapshot,
    output: {
      kind: "image" as const,
      storage: "hov_managed_copy_required" as const,
      publicUrlAllowed: false as const,
    },
    execution: {
      allowed: false as const,
      provider: null,
      modelAlias: null,
      reason: "Provider execution is disabled until Sluice capabilities are proven" as const,
      missingCapabilities: [...RECIPE_GENERATION_REQUIRED_CAPABILITIES],
    },
  }
  const parsed = recipeGuidanceGenerationRequestSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}
