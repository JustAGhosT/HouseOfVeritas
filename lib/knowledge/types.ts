import { z } from "zod"
import { guidanceDraftSchema, type GuidanceDraft, type GuidanceLocale } from "@/lib/guidance"
import {
  knowledgeSafeguardResultsSchema,
  type KnowledgeSafeguardId,
  type KnowledgeSafeguardResult,
} from "@/lib/knowledge/safeguards"

/**
 * Curated diagnostic knowledge base.
 *
 * A KnowledgeEntry is reusable, house-agnostic troubleshooting/procedure/safety
 * content — distinct from the per-task guidance packs in lib/guidance.ts, which
 * are bound to a single task and generated on demand. Entries here are the
 * curated ground truth that photo/symptom analysis is matched against so that
 * answers stay consistent, safe, and house-specific instead of being re-derived
 * freeform each session.
 */

export const KNOWLEDGE_DOMAINS = [
  "maintenance",
  "vehicle",
  "garden",
  "household",
  "workshop",
] as const

export type KnowledgeDomain = (typeof KNOWLEDGE_DOMAINS)[number]

export const KNOWLEDGE_STATUSES = ["draft", "published", "archived"] as const
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number]

/** A named place to buy the materials referenced by an entry (locale-specific). */
export interface KnowledgeSupplier {
  name: string
  note?: string
  url?: string
}

/**
 * The recorded Tier-0 review for an entry.
 *
 * Safeguard results are human judgements about content, not properties derivable
 * from it, so they have to be recorded rather than computed. A `published`
 * entry without one is rejected by the schema — that is what makes the safeguards
 * enforceable for a seed that is published by merging a PR rather than by an
 * API call.
 */
export interface KnowledgeReview {
  /** Safeguard profile the reviewer applied — see `KNOWLEDGE_SAFEGUARD_PROFILES`. */
  profileId: string
  safeguardResults: Partial<Record<KnowledgeSafeguardId, KnowledgeSafeguardResult>>
  /** Pseudonymous reviewer reference; never a name or contact detail. */
  reviewedBy: string
  reviewedAt: string
}

export interface KnowledgeEntry {
  /** Stable, human-readable identifier used for lookups and task provenance. */
  slug: string
  domain: KnowledgeDomain
  status: KnowledgeStatus
  /** Free-text symptom phrases a user might report ("wall damp", "sweating pipe"). */
  symptoms: string[]
  /** Single-word retrieval tokens ("condensation", "copper", "verdigris"). */
  keywords: string[]
  /** Asset/equipment types this applies to, for asset-anchored matching. */
  assetTypes: string[]
  /** Personas most likely to action this (hans/charl/lucky/irma). */
  personaHints: string[]
  suppliers: KnowledgeSupplier[]
  /**
   * The reviewable body, reusing the guidance draft shape so knowledge and
   * per-task guidance share one schema, one renderer, and one safety check.
   */
  guidance: GuidanceDraft
  /** Required once `status` is `published`; see `KnowledgeReview`. */
  review?: KnowledgeReview
}

const supplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  note: z.string().trim().min(1).max(300).optional(),
  url: z.string().trim().url().max(500).optional(),
})

const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case")

export const knowledgeReviewSchema = z
  .object({
    profileId: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "profileId must be kebab-case"),
    safeguardResults: knowledgeSafeguardResultsSchema.default({}),
    reviewedBy: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[A-Za-z][A-Za-z0-9._-]*$/, "Use a pseudonymous reviewer reference"),
    reviewedAt: z.string().datetime({ offset: true }),
  })
  .strict()

export const knowledgeEntrySchema = z
  .object({
    slug: slugSchema,
    domain: z.enum(KNOWLEDGE_DOMAINS),
    status: z.enum(KNOWLEDGE_STATUSES),
    symptoms: z.array(z.string().trim().min(1).max(160)).min(1).max(40),
    keywords: z.array(z.string().trim().min(1).max(60)).min(1).max(60),
    assetTypes: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
    personaHints: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    suppliers: z.array(supplierSchema).max(20).default([]),
    guidance: guidanceDraftSchema,
    review: knowledgeReviewSchema.optional(),
  })
  .superRefine((entry, context) => {
    // Publication is the act the safeguards exist to control, so an entry cannot
    // claim `published` without a recorded review to point at.
    if (entry.status === "published" && !entry.review) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["review"],
        message: "a published entry must carry a recorded safeguard review",
      })
    }
  })

export function parseKnowledgeEntry(input: unknown): KnowledgeEntry | null {
  const parsed = knowledgeEntrySchema.safeParse(input)
  return parsed.success ? (parsed.data as KnowledgeEntry) : null
}

export interface KnowledgeQuery {
  text: string
  domain?: KnowledgeDomain
  assetType?: string
  locale?: GuidanceLocale
}

export interface KnowledgeMatch {
  entry: KnowledgeEntry
  score: number
  matchedTerms: string[]
}
