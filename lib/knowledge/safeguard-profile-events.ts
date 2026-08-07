import { z } from "zod"
import {
  getKnowledgeSafeguard,
  KNOWLEDGE_SAFEGUARD_IDS,
  KNOWLEDGE_SAFEGUARD_PROFILES,
  STRICT_SAFEGUARD_PROFILE,
  type KnowledgeSafeguardId,
  type KnowledgeSafeguardProfile,
  type KnowledgeSafeguardProfileSource,
} from "@/lib/knowledge/safeguards"

/**
 * House of Veritas — Knowledge safeguard profiles as durable, auditable records.
 *
 * The safeguard evaluator in `safeguards.ts` takes a profile as a value. This module is
 * what lets an administrator change that value at runtime instead of by code
 * change and deploy, following the same append-only event model as
 * `lib/governance/gate-definitions.ts`: every change carries an actor, a
 * rationale, a monotonic version and an idempotency key, and nothing is ever
 * updated in place.
 *
 * Switching a safety safeguard off is a decision, not a setting. It should be as
 * traceable as a Gate 0 decision, which is why this reuses that shape rather
 * than storing a mutable config blob.
 */

export const KNOWLEDGE_SAFEGUARD_PROFILE_SCHEMA_VERSION = "knowledge-safeguard-profile-v1" as const

const profileIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "profileId must be kebab-case")

export const knowledgeSafeguardProfileRequestSchema = z
  .object({
    schemaVersion: z.literal(KNOWLEDGE_SAFEGUARD_PROFILE_SCHEMA_VERSION),
    profileId: profileIdSchema,
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    disabledSafeguards: z
      .array(z.enum(KNOWLEDGE_SAFEGUARD_IDS))
      .max(KNOWLEDGE_SAFEGUARD_IDS.length)
      .default([]),
    /**
     * Always required, even when nothing is disabled — re-enabling a safeguard is a
     * decision worth a reason too, and a blank-rationale path would become the
     * one everybody uses.
     */
    rationale: z.string().trim().min(3).max(1000),
    expectedVersion: z.number().int().min(0),
    idempotencyKey: z.string().uuid(),
  })
  .strict()
  .superRefine((request, context) => {
    const duplicates =
      request.disabledSafeguards.length !== new Set(request.disabledSafeguards).size
    if (duplicates) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disabledSafeguards"],
        message: "disabledSafeguards must not repeat a safeguard",
      })
    }

    // The waivability rule lives here, not only in the UI, so posting straight
    // to the API cannot bypass it. This schema does NOT run over records already
    // in the datastore, so `toProfile()` re-applies the rule on read — the two
    // together are what make the invariant hold.
    for (const id of request.disabledSafeguards) {
      if (!getKnowledgeSafeguard(id).waivable) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["disabledSafeguards"],
          message: `${id} cannot be waived by any profile`,
        })
      }
    }
  })

export type KnowledgeSafeguardProfileRequest = z.infer<
  typeof knowledgeSafeguardProfileRequestSchema
>

export interface KnowledgeSafeguardProfileEvent extends KnowledgeSafeguardProfileRequest {
  id: string
  version: number
  actorId: string
  actorRole: "admin"
  createdAt: string
  requestFingerprint: string
}

export interface KnowledgeSafeguardProfileProjection {
  profileId: string
  /** The code-defined profile of the same id, when one exists. */
  builtin: KnowledgeSafeguardProfile | null
  current: KnowledgeSafeguardProfileEvent | null
  history: KnowledgeSafeguardProfileEvent[]
  /** What the evaluator would actually use right now. */
  effective: KnowledgeSafeguardProfile
  source: KnowledgeSafeguardProfileSource
  /** Safeguards this profile switches off, expanded for display. */
  disabledSafeguardLabels: string[]
  /** True when the effective profile deviates from the built-in of the same id. */
  deviatesFromBuiltin: boolean
}

export function parseKnowledgeSafeguardProfileRequest(
  input: unknown
): KnowledgeSafeguardProfileRequest | null {
  const parsed = knowledgeSafeguardProfileRequestSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

/**
 * Stored events are treated as untrusted on read.
 *
 * The request schema rejects a non-waivable safeguard, but it only runs over API
 * input — a record written straight to the collection, or corrupted in place,
 * never passes through it. Re-applying the rule here is what makes
 * "no profile may waive `data_boundary` or `verifiable_ground_truth`" an
 * invariant of the system rather than a property of one code path.
 *
 * Returns the safeguards it had to strip so the caller can log a datastore that is
 * carrying records it should not.
 */
function toProfile(event: KnowledgeSafeguardProfileEvent): {
  profile: KnowledgeSafeguardProfile
  sanitizedSafeguards: KnowledgeSafeguardId[]
} {
  const sanitizedSafeguards = event.disabledSafeguards.filter(
    (id) => !getKnowledgeSafeguard(id).waivable
  )
  const disabledSafeguards = event.disabledSafeguards.filter(
    (id) => getKnowledgeSafeguard(id).waivable
  )
  return {
    profile: {
      id: event.profileId,
      label: event.label,
      description: event.description,
      disabledSafeguards,
    },
    sanitizedSafeguards,
  }
}

/** Latest event wins; events are append-only and version-ordered. */
export function latestEventFor(
  profileId: string,
  events: readonly KnowledgeSafeguardProfileEvent[]
): KnowledgeSafeguardProfileEvent | null {
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
 * is about to gate content either way and the safe answer is "run every safeguard".
 *
 * `sanitizedSafeguards` is non-empty when a stored record tried to waive a
 * non-waivable safeguard. That cannot happen through the API, so it means the
 * datastore holds a record that never passed validation — worth logging loudly
 * at the call site.
 */
export function resolveEffectiveProfile(
  profileId: string,
  events: readonly KnowledgeSafeguardProfileEvent[]
): {
  profile: KnowledgeSafeguardProfile
  source: KnowledgeSafeguardProfileSource
  sanitizedSafeguards: KnowledgeSafeguardId[]
} {
  const stored = latestEventFor(profileId, events)
  if (stored) return { ...toProfile(stored), source: "stored" }

  const builtin = KNOWLEDGE_SAFEGUARD_PROFILES.find((profile) => profile.id === profileId)
  if (builtin) return { profile: builtin, source: "builtin", sanitizedSafeguards: [] }

  return { profile: STRICT_SAFEGUARD_PROFILE, source: "builtin", sanitizedSafeguards: [] }
}

const sameSafeguardSet = (
  left: readonly KnowledgeSafeguardId[],
  right: readonly KnowledgeSafeguardId[]
): boolean => {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((id) => rightSet.has(id))
}

export function projectSafeguardProfiles(
  events: readonly KnowledgeSafeguardProfileEvent[]
): KnowledgeSafeguardProfileProjection[] {
  const ids = [
    ...KNOWLEDGE_SAFEGUARD_PROFILES.map((profile) => profile.id),
    ...events.map((event) => event.profileId),
  ]
  const uniqueIds = [...new Set(ids)].sort()

  return uniqueIds.map((profileId) => {
    const history = events
      .filter((event) => event.profileId === profileId)
      .slice()
      .sort((left, right) => left.version - right.version)
    const { profile, source } = resolveEffectiveProfile(profileId, events)
    const builtin = KNOWLEDGE_SAFEGUARD_PROFILES.find((entry) => entry.id === profileId) ?? null

    return {
      profileId,
      builtin,
      current: history.at(-1) ?? null,
      history,
      effective: profile,
      source,
      disabledSafeguardLabels: profile.disabledSafeguards.map(
        (id) => getKnowledgeSafeguard(id).label
      ),
      deviatesFromBuiltin:
        builtin !== null &&
        !sameSafeguardSet(profile.disabledSafeguards, builtin.disabledSafeguards),
    }
  })
}

/**
 * Safeguards a profile switches off that the built-in of the same id keeps on — the
 * set an administrator has actively relaxed. Surfaced separately from
 * `disabledSafeguards` because a built-in waiver (a recipe not needing an electrical
 * licence) and an operator waiver are different things to review.
 */
export function relaxedBeyondBuiltin(
  projection: KnowledgeSafeguardProfileProjection
): KnowledgeSafeguardId[] {
  const builtinDisabled = new Set(projection.builtin?.disabledSafeguards ?? [])
  return projection.effective.disabledSafeguards.filter((id) => !builtinDisabled.has(id))
}
