import { z } from "zod"
import type { RecipeRecord } from "@/lib/recipes"
import {
  createRecipeRevisionId,
  guidanceTimerSchema,
  type GuidanceTimer,
} from "@/lib/recipe-guidance"

export const GUIDANCE_KINDS = [
  "procedure",
  "recipe",
  "checklist",
  "troubleshooting",
  "safety",
] as const

export const GUIDANCE_LOCALES = ["en", "af"] as const

export type GuidanceKind = (typeof GUIDANCE_KINDS)[number]
export type GuidanceLocale = (typeof GUIDANCE_LOCALES)[number]

export interface GuidanceStepDraft {
  order: number
  title: string
  instruction: string
  visualCue?: string
  check?: string
  warning?: string
  timerMinutes?: number
  timer?: GuidanceTimer
  sourceRecipeStepId?: string
  sourceRecipeRevisionId?: string
}

export interface GuidanceDraft {
  kind: GuidanceKind
  locale: GuidanceLocale
  title: string
  summary: string
  materials: string[]
  tools: string[]
  safety: string[]
  steps: GuidanceStepDraft[]
  sourceRecipeId?: string
  sourceRecipeUpdatedAt?: string
  sourceRecipeRevisionId?: string
  sourceRecipeIngredientIds?: string[]
}

export function hasGuidanceSafetyBoundaries(draft: GuidanceDraft): boolean {
  return draft.safety.length > 0 && draft.steps.some((step) => Boolean(step.warning?.trim()))
}

export interface GuidanceStep extends GuidanceStepDraft {
  id: string
}

export interface GuidanceSource {
  type: "photo" | "document" | "manual" | "recipe"
  imageUrl?: string
  mimeType?: string
  fileName?: string
  description?: string
  recipeId?: string
}

export interface GuidancePack extends Omit<GuidanceDraft, "steps"> {
  id: string
  version: number
  status: "draft" | "published" | "archived"
  steps: GuidanceStep[]
  source: GuidanceSource
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface TaskGuidanceBinding {
  taskId: string
  guidancePackId: string
  version: number
  active: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

const optionalShortText = z.string().trim().min(1).max(500).optional()

export const guidanceStepDraftSchema = z.object({
  order: z.number().int().positive(),
  title: z.string().trim().min(1).max(120),
  instruction: z.string().trim().min(1).max(1_500),
  visualCue: optionalShortText,
  check: optionalShortText,
  warning: optionalShortText,
  timerMinutes: z.number().int().positive().max(1_440).optional(),
  timer: guidanceTimerSchema.optional(),
  sourceRecipeStepId: z.string().trim().min(1).max(200).optional(),
  sourceRecipeRevisionId: z.string().trim().min(1).max(500).optional(),
})

export const guidanceDraftSchema = z
  .object({
    kind: z.enum(GUIDANCE_KINDS),
    locale: z.enum(GUIDANCE_LOCALES),
    title: z.string().trim().min(1).max(160),
    summary: z.string().trim().min(1).max(1_000),
    materials: z.array(z.string().trim().min(1).max(160)).max(40).default([]),
    tools: z.array(z.string().trim().min(1).max(160)).max(40).default([]),
    safety: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
    steps: z.array(guidanceStepDraftSchema).min(1).max(20),
    sourceRecipeId: z.string().trim().min(1).max(200).optional(),
    sourceRecipeUpdatedAt: z.string().datetime({ offset: true }).optional(),
    sourceRecipeRevisionId: z.string().trim().min(1).max(500).optional(),
    sourceRecipeIngredientIds: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  })
  .superRefine((draft, context) => {
    const hasRecipeProvenance =
      draft.sourceRecipeId !== undefined ||
      draft.sourceRecipeUpdatedAt !== undefined ||
      draft.sourceRecipeRevisionId !== undefined ||
      draft.sourceRecipeIngredientIds !== undefined ||
      draft.steps.some(
        (step) => step.sourceRecipeStepId !== undefined || step.sourceRecipeRevisionId !== undefined
      )
    if (!hasRecipeProvenance) return

    for (const field of [
      "sourceRecipeId",
      "sourceRecipeUpdatedAt",
      "sourceRecipeRevisionId",
    ] as const) {
      if (!draft[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} is required for recipe provenance`,
        })
      }
    }

    const expectedRevisionId =
      draft.sourceRecipeId && draft.sourceRecipeUpdatedAt
        ? createRecipeRevisionId(draft.sourceRecipeId, draft.sourceRecipeUpdatedAt)
        : undefined
    if (expectedRevisionId && draft.sourceRecipeRevisionId !== expectedRevisionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceRecipeRevisionId"],
        message: "sourceRecipeRevisionId must identify the declared recipe snapshot",
      })
    }

    draft.steps.forEach((step, index) => {
      const hasStepProvenance =
        step.sourceRecipeStepId !== undefined || step.sourceRecipeRevisionId !== undefined
      if (!hasStepProvenance) return

      if (!step.sourceRecipeStepId || step.sourceRecipeRevisionId !== expectedRevisionId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "sourceRecipeRevisionId"],
          message: "sourced steps must target the draft's immutable recipe revision",
        })
      }
    })
  })

export function parseGuidanceDraft(input: unknown): GuidanceDraft | null {
  const parsed = guidanceDraftSchema.safeParse(input)
  if (!parsed.success) return null

  return {
    ...parsed.data,
    steps: parsed.data.steps.map((step, index) => ({
      ...step,
      order: index + 1,
    })),
  }
}

export function guidanceMatchesRecipeSnapshot(draft: GuidanceDraft, recipe: RecipeRecord): boolean {
  const revisionId = createRecipeRevisionId(recipe.id, recipe.updatedAt)
  if (
    draft.sourceRecipeId !== recipe.id ||
    draft.sourceRecipeUpdatedAt !== recipe.updatedAt ||
    draft.sourceRecipeRevisionId !== revisionId
  ) {
    return false
  }

  const ingredientIds = new Set(recipe.ingredients.map((ingredient) => ingredient.id))
  if (draft.sourceRecipeIngredientIds?.some((id) => !ingredientIds.has(id))) return false

  const stepIds = new Set(recipe.steps.map((step) => step.id))
  return draft.steps.every(
    (step) =>
      step.sourceRecipeStepId === undefined ||
      (step.sourceRecipeRevisionId === revisionId && stepIds.has(step.sourceRecipeStepId))
  )
}

export function recipeToGuidanceDraft(recipe: RecipeRecord, locale: GuidanceLocale): GuidanceDraft {
  const isAfrikaans = locale === "af"
  const sourceRecipeRevisionId = createRecipeRevisionId(recipe.id, recipe.updatedAt)
  return {
    kind: "recipe",
    locale,
    title: isAfrikaans ? recipe.titleAf : recipe.titleEn,
    summary: isAfrikaans ? recipe.summaryAf || recipe.titleAf : recipe.summaryEn || recipe.titleEn,
    materials: recipe.ingredients.map((ingredient) =>
      [ingredient.quantity, ingredient.unit, ingredient.name, ingredient.preparationNote]
        .filter(Boolean)
        .join(" ")
    ),
    tools: [],
    safety: [],
    sourceRecipeId: recipe.id,
    sourceRecipeUpdatedAt: recipe.updatedAt,
    sourceRecipeRevisionId,
    sourceRecipeIngredientIds: recipe.ingredients.map((ingredient) => ingredient.id),
    steps: recipe.steps
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((step, index) => ({
        order: index + 1,
        title: step.section || `${isAfrikaans ? "Stap" : "Step"} ${index + 1}`,
        instruction: isAfrikaans ? step.instructionAf : step.instructionEn,
        timerMinutes: step.timerMinutes,
        timer:
          step.timerMinutes === undefined ? undefined : { minimumSeconds: step.timerMinutes * 60 },
        sourceRecipeStepId: step.id,
        sourceRecipeRevisionId,
      })),
  }
}
