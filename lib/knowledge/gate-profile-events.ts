import { z } from "zod"
import {
  getKnowledgeGate,
  KNOWLEDGE_GATE_IDS,
  KNOWLEDGE_GATE_PROFILES,
  NON_WAIVABLE_GATE_IDS,
  STRICT_GATE_PROFILE,
  type KnowledgeGateId,
  type KnowledgeGateProfile,
  type KnowledgeGateProfileSource,
} from "@/lib/knowledge/gates"

/**
 * House of Veritas — Knowledge gate profiles as durable, auditable records.
 *
 * The gate evaluator in `gates.ts` takes a profile as a value. This module is
 * what lets an administrator change that value at runtime instead of by code
 * change and deploy, following the same append-only event model as
 * `lib/governance/gate-definitions.ts`: every change carries an actor, a
 * rationale, a monotonic version and an idempotency key, and nothing is ever
 * updated in place.
 *
 * Switching a safety gate off is a decision, not a setting. It should be as
 * traceable as a Gate 0 decision, which is why this reuses that shape rather
 * than storing a mutable config blob.
 */

export const KNOWLEDGE_GATE_PROFILE_SCHEMA_VERSION = "knowledge-gate-profile-v1" as const

const profileIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "profileId must be kebab-case")

export const knowledgeGateProfileRequestSchema = z
  .object({
    schemaVersion: z.literal(KNOWLEDGE_GATE_PROFILE_SCHEMA_VERSION),
    profileId: profileIdSchema,
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    disabledGates: z.array(z.enum(KNOWLEDGE_GATE_IDS)).max(KNOWLEDGE_GATE_IDS.length).default([]),
    /**
     * Always required, even when nothing is disabled — re-enabling a gate is a
     * decision worth a reason too, and a blank-rationale path would become the
     * one everybody uses.
     */
    rationale: z.string().trim().min(3).max(1000),
    expectedVersion: z.number().int().min(0),
    idempotencyKey: z.string().uuid(),
  })
  .strict()
  .superRefine((request, context) => {
    const duplicates = request.disabledGates.length !== new Set(request.disabledGates).size
    if (duplicates) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disabledGates"],
        message: "disabledGates must not repeat a gate",
      })
    }

    // The waivability rule lives here, not only in the UI, so it cannot be
    // bypassed by posting to the API or writing to the collection directly.
    for (const id of request.disabledGates) {
      if (!getKnowledgeGate(id).waivable) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["disabledGates"],
          message: `${id} cannot be waived by any profile`,
        })
      }
    }
  })

export type KnowledgeGateProfileRequest = z.infer<typeof knowledgeGateProfileRequestSchema>

export interface KnowledgeGateProfileEvent extends KnowledgeGateProfileRequest {
  id: string
  version: number
  actorId: string
  actorRole: "admin"
  createdAt: string
  requestFingerprint: string
}

export interface KnowledgeGateProfileProjection {
  profileId: string
  /** The code-defined profile of the same id, when one exists. */
  builtin: KnowledgeGateProfile | null
  current: KnowledgeGateProfileEvent | null
  history: KnowledgeGateProfileEvent[]
  /** What the evaluator would actually use right now. */
  effective: KnowledgeGateProfile
  source: KnowledgeGateProfileSource
  /** Gates this profile switches off, expanded for display. */
  disabledGateLabels: string[]
  /** True when the effective profile deviates from the built-in of the same id. */
  deviatesFromBuiltin: boolean
}

export function parseKnowledgeGateProfileRequest(
  input: unknown
): KnowledgeGateProfileRequest | null {
  const parsed = knowledgeGateProfileRequestSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

const toProfile = (event: KnowledgeGateProfileEvent): KnowledgeGateProfile => ({
  id: event.profileId,
  label: event.label,
  description: event.description,
  disabledGates: event.disabledGates,
})

/** Latest event wins; events are append-only and version-ordered. */
export function latestEventFor(
  profileId: string,
  events: readonly KnowledgeGateProfileEvent[]
): KnowledgeGateProfileEvent | null {
  return (
    events
      .filter((event) => event.profileId === profileId)
      .slice()
      .sort((left, right) => left.version - right.version)
      .at(-1) ?? null
  )
}

/**
 * Resolve the profile the evaluator should use.
 *
 * A stored record wins over the built-in of the same id. An unknown id with no
 * stored record falls back to `strict` rather than erroring, because the caller
 * is about to gate content either way and the safe answer is "run every gate".
 */
export function resolveEffectiveProfile(
  profileId: string,
  events: readonly KnowledgeGateProfileEvent[]
): { profile: KnowledgeGateProfile; source: KnowledgeGateProfileSource } {
  const stored = latestEventFor(profileId, events)
  if (stored) return { profile: toProfile(stored), source: "stored" }

  const builtin = KNOWLEDGE_GATE_PROFILES.find((profile) => profile.id === profileId)
  if (builtin) return { profile: builtin, source: "builtin" }

  return { profile: STRICT_GATE_PROFILE, source: "builtin" }
}

const sameGateSet = (
  left: readonly KnowledgeGateId[],
  right: readonly KnowledgeGateId[]
): boolean => {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((id) => rightSet.has(id))
}

export function projectGateProfiles(
  events: readonly KnowledgeGateProfileEvent[]
): KnowledgeGateProfileProjection[] {
  const ids = [
    ...KNOWLEDGE_GATE_PROFILES.map((profile) => profile.id),
    ...events.map((event) => event.profileId),
  ]
  const uniqueIds = [...new Set(ids)].sort()

  return uniqueIds.map((profileId) => {
    const history = events
      .filter((event) => event.profileId === profileId)
      .slice()
      .sort((left, right) => left.version - right.version)
    const { profile, source } = resolveEffectiveProfile(profileId, events)
    const builtin = KNOWLEDGE_GATE_PROFILES.find((entry) => entry.id === profileId) ?? null

    return {
      profileId,
      builtin,
      current: history.at(-1) ?? null,
      history,
      effective: profile,
      source,
      disabledGateLabels: profile.disabledGates.map((id) => getKnowledgeGate(id).label),
      deviatesFromBuiltin:
        builtin !== null && !sameGateSet(profile.disabledGates, builtin.disabledGates),
    }
  })
}

/**
 * Gates a profile switches off that the built-in of the same id keeps on — the
 * set an administrator has actively relaxed. Surfaced separately from
 * `disabledGates` because a built-in waiver (a recipe not needing an electrical
 * licence) and an operator waiver are different things to review.
 */
export function relaxedBeyondBuiltin(
  projection: KnowledgeGateProfileProjection
): KnowledgeGateId[] {
  const builtinDisabled = new Set(projection.builtin?.disabledGates ?? [])
  return projection.effective.disabledGates.filter((id) => !builtinDisabled.has(id))
}

export { NON_WAIVABLE_GATE_IDS }
