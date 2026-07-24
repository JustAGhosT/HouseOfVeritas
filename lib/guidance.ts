import { z } from "zod"
import type { RecipeRecord } from "@/lib/recipes"

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
})

export const guidanceDraftSchema = z.object({
  kind: z.enum(GUIDANCE_KINDS),
  locale: z.enum(GUIDANCE_LOCALES),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(1_000),
  materials: z.array(z.string().trim().min(1).max(160)).max(40).default([]),
  tools: z.array(z.string().trim().min(1).max(160)).max(40).default([]),
  safety: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  steps: z.array(guidanceStepDraftSchema).min(1).max(20),
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

export function recipeToGuidanceDraft(
  recipe: RecipeRecord,
  locale: GuidanceLocale
): GuidanceDraft {
  const isAfrikaans = locale === "af"
  return {
    kind: "recipe",
    locale,
    title: isAfrikaans ? recipe.titleAf : recipe.titleEn,
    summary: isAfrikaans
      ? recipe.summaryAf || recipe.titleAf
      : recipe.summaryEn || recipe.titleEn,
    materials: recipe.ingredients.map((ingredient) =>
      [ingredient.quantity, ingredient.unit, ingredient.name, ingredient.preparationNote]
        .filter(Boolean)
        .join(" ")
    ),
    tools: [],
    safety: [],
    steps: recipe.steps
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((step, index) => ({
        order: index + 1,
        title: step.section || `${isAfrikaans ? "Stap" : "Step"} ${index + 1}`,
        instruction: isAfrikaans ? step.instructionAf : step.instructionEn,
        timerMinutes: step.timerMinutes,
      })),
  }
}
