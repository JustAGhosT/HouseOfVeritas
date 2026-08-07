import { z } from "zod"
import type { DomainSafetyCriticalGateId } from "@/lib/reviewer-trials/domain-safety-trial"
import {
  ASSET_COVERAGE_LEVELS,
  computeKnowledgeComposite,
  computeKnowledgeSubScores,
  CONSEQUENCE_LEVELS,
  DEFAULT_KNOWLEDGE_WEIGHTS,
  LOCALE_REACH_LEVELS,
  MAX_PLAUSIBLE_RECURRENCE,
  PERSONA_FIT_LEVELS,
  REPEATABILITY_LEVELS,
  resolvePriority,
  type KnowledgePriority,
  type KnowledgeSubScores,
  type KnowledgeWeights,
} from "@/lib/knowledge/rubrics"

/**
 * House of Veritas — Knowledge base: Tier-0 publication safeguards.
 *
 * Hard pass/fail admission checks, structured to mirror
 * `evaluateDomainSafetyTrial()` so the knowledge base and the reviewer trial
 * speak one vocabulary. Spec: `docs/specs/knowledge-base-process-rubric.md` §4.
 *
 * Safeguards are configurable per profile, with three deliberate safety properties:
 *
 *  1. **Default-on, structurally.** A profile carries only `disabledSafeguards`, so
 *     opting out is explicit and by name and there is no "enable" list to forget
 *     to update. A safeguard added to `KNOWLEDGE_PUBLICATION_SAFEGUARDS` later therefore
 *     applies to every existing profile immediately, which is the safe default.
 *  2. **Disabled ≠ passed.** A safeguard a profile switches off resolves to
 *     `not_applicable` and is listed in `skippedSafeguards` on the evaluation. It is
 *     never folded into "pass", so an audit can always tell "we checked and it
 *     was fine" from "we never checked".
 *  3. **Missing ≠ passed.** A safeguard with no submitted result is `not_tested`,
 *     which holds the candidate at `draft`. Absence of evidence is not a pass.
 */

export const KNOWLEDGE_SAFEGUARD_RESULTS = ["pass", "fail", "not_tested", "not_applicable"] as const
export type KnowledgeSafeguardResult = (typeof KNOWLEDGE_SAFEGUARD_RESULTS)[number]

/**
 * What a failure costs the candidate.
 *  - `rescope`  — the DIY procedure is refused, but a `safety` entry (recognise,
 *                 stop, escalate) can still be published. An estate that welds
 *                 badly is more dangerous than one told plainly not to.
 *  - `decline`  — nothing publishable survives. Reserved for the case where no
 *                 claim can be grounded at all: a safety entry also makes
 *                 claims, so an ungroundable topic cannot become one.
 */
export type KnowledgeSafeguardFailureMode = "rescope" | "decline"

export interface KnowledgeSafeguard {
  id: KnowledgeSafeguardId
  label: string
  description: string
  failureMode: KnowledgeSafeguardFailureMode
  /**
   * Whether a safeguard profile may switch this safeguard off at all.
   *
   * Two safeguards are not waivable by anyone, including an administrator, because
   * they encode obligations rather than editorial policy: `data_boundary` is
   * POPIA, and `verifiable_ground_truth` is what makes any entry — including a
   * `safety` entry — safe to publish. A profile naming either is rejected by
   * the request schema on write AND stripped by `resolveEffectiveProfile()` on
   * read, so a record that reached the store without passing validation still
   * cannot waive one.
   */
  waivable: boolean
  /** The reviewer-trial gate this mirrors. Type-checked so the mapping stays real. */
  trialGate: DomainSafetyCriticalGateId | null
}

export const KNOWLEDGE_SAFEGUARD_IDS = [
  "statutory_competence",
  "irreversible_harm",
  "verifiable_ground_truth",
  "commercial_neutrality",
  "data_boundary",
  "diagnosis_before_action",
] as const
export type KnowledgeSafeguardId = (typeof KNOWLEDGE_SAFEGUARD_IDS)[number]

export const KNOWLEDGE_PUBLICATION_SAFEGUARDS: readonly KnowledgeSafeguard[] = [
  {
    id: "statutory_competence",
    label: "Statutory competence",
    description:
      "South African law, municipal bylaw, or the estate's insurance reserves the work to a registered person — electrical CoC work under SANS 10142-1, gas installation (SAQCC), notifiable plumbing (PIRB). The register itself is unconfirmed; see spec §10.",
    failureMode: "rescope",
    waivable: true,
    trialGate: "credential_process",
  },
  {
    id: "irreversible_harm",
    label: "Irreversible harm",
    description:
      "One plausible mistake causes death, serious injury, or fire — live mains, arc flash, gas, work at height, tree felling, confined space, structural removal.",
    failureMode: "rescope",
    waivable: true,
    trialGate: "critical_defect_recall",
  },
  {
    id: "verifiable_ground_truth",
    label: "Verifiable ground truth",
    description:
      "Every dimension, torque, ratio, rating, dose, and timing traces to a citable source (manufacturer spec, SANS clause, supplier datasheet). Declines rather than re-scopes: a safety entry makes claims too.",
    failureMode: "decline",
    waivable: false,
    trialGate: "unsafe_assertion",
  },
  {
    id: "commercial_neutrality",
    label: "Commercial neutrality",
    description:
      "Suppliers are listed as availability with a scope note, never ranked or recommended.",
    failureMode: "rescope",
    waivable: true,
    trialGate: "independence",
  },
  {
    id: "data_boundary",
    label: "Data boundary",
    description:
      "No household PII, address, identifiable person, or photograph of the real estate is embedded in the entry.",
    failureMode: "rescope",
    waivable: false,
    trialGate: "data_boundary",
  },
  {
    id: "diagnosis_before_action",
    label: "Diagnosis before action",
    description:
      "The procedure cannot be applied to the wrong root cause and make it worse — a confirm-first step exists. No trial analogue; specific to procedural content.",
    failureMode: "rescope",
    waivable: true,
    trialGate: null,
  },
]

export const getKnowledgeSafeguard = (id: KnowledgeSafeguardId): KnowledgeSafeguard =>
  KNOWLEDGE_PUBLICATION_SAFEGUARDS.find((safeguard) => safeguard.id === id)!

/** Safeguards no profile may switch off. Enforced by the profile request schema. */
export const NON_WAIVABLE_SAFEGUARD_IDS: readonly KnowledgeSafeguardId[] =
  KNOWLEDGE_PUBLICATION_SAFEGUARDS.filter((safeguard) => !safeguard.waivable).map(
    (safeguard) => safeguard.id
  )

export const isWaivableSafeguard = (id: KnowledgeSafeguardId): boolean =>
  getKnowledgeSafeguard(id).waivable

/**
 * Where the profile used for an evaluation came from.
 *  - `builtin`          — a code-defined profile, no stored override exists
 *  - `stored`           — an administrator's recorded configuration
 *  - `builtin-fallback` — the store was unreachable, so `strict` was used
 *
 * Recorded on every evaluation so a relaxed configuration silently reverting to
 * strict during an outage is visible rather than mysterious.
 */
export const KNOWLEDGE_SAFEGUARD_PROFILE_SOURCES = [
  "builtin",
  "stored",
  "builtin-fallback",
] as const
export type KnowledgeSafeguardProfileSource = (typeof KNOWLEDGE_SAFEGUARD_PROFILE_SOURCES)[number]

// ── Profiles: selectable, toggleable safeguard sets ───────────────────────────────

export interface KnowledgeSafeguardProfile {
  id: string
  label: string
  description: string
  /** Safeguards switched OFF for this profile. Everything not listed runs. */
  disabledSafeguards: readonly KnowledgeSafeguardId[]
}

/** Every safeguard runs. The safe default for any `procedure` or `troubleshooting` entry. */
export const STRICT_SAFEGUARD_PROFILE: KnowledgeSafeguardProfile = {
  id: "strict",
  label: "Strict (default)",
  description: "Every safeguard runs. Use for any procedural or troubleshooting entry.",
  disabledSafeguards: [],
}

/**
 * Household consumables. Cooking is not a statutorily reserved activity and a
 * recipe has no root cause to misdiagnose. Allergen content still has to clear
 * `irreversible_harm` and `verifiable_ground_truth`, which is the whole point of
 * keeping those on.
 */
export const RECIPE_SAFEGUARD_PROFILE: KnowledgeSafeguardProfile = {
  id: "household-recipe",
  label: "Household recipe",
  description:
    "Recipe entries. Statutory competence and diagnosis-before-action do not apply; allergen safety and sourcing still do.",
  disabledSafeguards: ["statutory_competence", "diagnosis_before_action"],
}

/** Verification-only content that transforms nothing, so misdiagnosis is not a risk. */
export const CHECKLIST_SAFEGUARD_PROFILE: KnowledgeSafeguardProfile = {
  id: "checklist",
  label: "Checklist",
  description: "Inspect-and-record entries that change nothing on the asset.",
  disabledSafeguards: ["diagnosis_before_action"],
}

export const KNOWLEDGE_SAFEGUARD_PROFILES: readonly KnowledgeSafeguardProfile[] = [
  STRICT_SAFEGUARD_PROFILE,
  RECIPE_SAFEGUARD_PROFILE,
  CHECKLIST_SAFEGUARD_PROFILE,
]

export const getSafeguardProfile = (id: string): KnowledgeSafeguardProfile | null =>
  KNOWLEDGE_SAFEGUARD_PROFILES.find((profile) => profile.id === id) ?? null

/**
 * A non-waivable safeguard is enabled no matter what a profile says.
 *
 * This is the innermost of three layers, and the only one every path goes
 * through. The request schema guards API writes and `resolveEffectiveProfile()`
 * guards reads from the store, but neither sees a profile constructed in code
 * or handed straight to the evaluator by a caller. Enforcing it here makes
 * "no profile may waive `data_boundary` or `verifiable_ground_truth`" true by
 * construction and demotes the outer two layers to defence in depth.
 */
export const isSafeguardEnabled = (
  profile: KnowledgeSafeguardProfile,
  id: KnowledgeSafeguardId
): boolean => !getKnowledgeSafeguard(id).waivable || !profile.disabledSafeguards.includes(id)

export const enabledSafeguards = (
  profile: KnowledgeSafeguardProfile
): readonly KnowledgeSafeguard[] =>
  KNOWLEDGE_PUBLICATION_SAFEGUARDS.filter((safeguard) => isSafeguardEnabled(profile, safeguard.id))

/**
 * Toggle helpers return a new profile — profiles are values, not mutable state.
 * Disabling a non-waivable safeguard is a no-op rather than an error: callers should
 * not have to special-case it, and `isSafeguardEnabled()` would ignore it anyway.
 */
export function withSafeguardDisabled(
  profile: KnowledgeSafeguardProfile,
  id: KnowledgeSafeguardId
): KnowledgeSafeguardProfile {
  if (!getKnowledgeSafeguard(id).waivable) return profile
  if (!isSafeguardEnabled(profile, id)) return profile
  return { ...profile, disabledSafeguards: [...profile.disabledSafeguards, id] }
}

export function withSafeguardEnabled(
  profile: KnowledgeSafeguardProfile,
  id: KnowledgeSafeguardId
): KnowledgeSafeguardProfile {
  if (isSafeguardEnabled(profile, id)) return profile
  return {
    ...profile,
    disabledSafeguards: profile.disabledSafeguards.filter((safeguard) => safeguard !== id),
  }
}

// ── Submission and evaluation ────────────────────────────────────────────────

const safeguardResultSchema = z.enum(KNOWLEDGE_SAFEGUARD_RESULTS)

/**
 * Every safeguard key is optional: a candidate mid-review has only some safeguards
 * answered. `evaluateKnowledgeCandidate` reads an absent key as `not_tested`.
 */
export const knowledgeSafeguardResultsSchema = z
  .object({
    statutory_competence: safeguardResultSchema,
    irreversible_harm: safeguardResultSchema,
    verifiable_ground_truth: safeguardResultSchema,
    commercial_neutrality: safeguardResultSchema,
    data_boundary: safeguardResultSchema,
    diagnosis_before_action: safeguardResultSchema,
  })
  .partial()
  .strict()

export const knowledgeCandidateFactsSchema = z
  .object({
    recurrencePerYear: z.number().nonnegative().max(MAX_PLAUSIBLE_RECURRENCE),
    costAvoidedCents: z.number().int().nonnegative().nullable(),
    consequenceOfDelay: z.enum(CONSEQUENCE_LEVELS),
    personaFit: z.enum(PERSONA_FIT_LEVELS),
    assetCoverage: z.enum(ASSET_COVERAGE_LEVELS),
    repeatability: z.enum(REPEATABILITY_LEVELS),
    symptomCount: z.number().int().nonnegative(),
    keywordCount: z.number().int().nonnegative(),
    authoringEffortHours: z.number().nonnegative(),
    localeReach: z.enum(LOCALE_REACH_LEVELS),
  })
  .strict()

export const knowledgeCandidateSubmissionSchema = z
  .object({
    candidateId: z.string().trim().min(1).max(200),
    /** Omitted safeguards are treated as `not_tested`, never as passes. */
    safeguardResults: knowledgeSafeguardResultsSchema.default({}),
    facts: knowledgeCandidateFactsSchema.nullable().default(null),
  })
  .strict()

export type KnowledgeCandidateSubmission = z.infer<typeof knowledgeCandidateSubmissionSchema>

export function parseKnowledgeCandidateSubmission(
  input: unknown
): KnowledgeCandidateSubmission | null {
  const parsed = knowledgeCandidateSubmissionSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export type KnowledgeDisposition =
  /** Safeguards clear, composite at or above the decline threshold. */
  | "author"
  /** A `rescope`-mode safeguard failed: publish a stop-and-escalate `safety` entry. */
  | "rescope_as_safety"
  /** A `decline`-mode safeguard failed: nothing publishable survives. */
  | "decline_unsafe"
  /** Safeguards clear, but the candidate is not worth authoring. Revisit on change. */
  | "decline_not_worthwhile"
  /** A safeguard was never tested, or Tier-1 facts are missing. Stays `draft`. */
  | "hold_as_draft"

export interface KnowledgeCandidateEvaluation {
  candidateId: string
  profileId: string
  /** Whether the profile was code-defined, administrator-stored, or an outage fallback. */
  profileSource: KnowledgeSafeguardProfileSource
  disposition: KnowledgeDisposition
  failedSafeguards: KnowledgeSafeguardId[]
  untestedSafeguards: KnowledgeSafeguardId[]
  /** Disabled by the profile — recorded so a skip is never silent. */
  skippedSafeguards: KnowledgeSafeguardId[]
  subScores: KnowledgeSubScores | null
  composite: number | null
  priority: KnowledgePriority | null
}

export interface EvaluateKnowledgeOptions {
  profile?: KnowledgeSafeguardProfile
  /** Defaults to `builtin`; callers loading from the store pass the real source. */
  profileSource?: KnowledgeSafeguardProfileSource
  weights?: KnowledgeWeights
}

/** Tier-0 outcome on its own, for callers that safeguard publication rather than authoring. */
export type KnowledgeSafeguardOutcome =
  | "cleared"
  /** A `rescope`-mode safeguard failed. */
  | "rescope_as_safety"
  /** A `decline`-mode safeguard failed — nothing publishable survives. */
  | "decline_unsafe"
  /** A safeguard was never tested. Absence of evidence is not a pass. */
  | "hold_as_draft"

export interface KnowledgeSafeguardEvaluation {
  profileId: string
  profileSource: KnowledgeSafeguardProfileSource
  outcome: KnowledgeSafeguardOutcome
  failedSafeguards: KnowledgeSafeguardId[]
  untestedSafeguards: KnowledgeSafeguardId[]
  skippedSafeguards: KnowledgeSafeguardId[]
}

/**
 * Run recorded safeguard results against a profile. Shared by the authoring rubric
 * (`evaluateKnowledgeCandidate`) and by publication enforcement, so the two can
 * never drift into disagreeing about what "cleared" means.
 */
export function evaluateSafeguardResults(
  safeguardResults: Partial<Record<KnowledgeSafeguardId, KnowledgeSafeguardResult>>,
  profile: KnowledgeSafeguardProfile = STRICT_SAFEGUARD_PROFILE,
  profileSource: KnowledgeSafeguardProfileSource = "builtin"
): KnowledgeSafeguardEvaluation {
  const skippedSafeguards = KNOWLEDGE_PUBLICATION_SAFEGUARDS.filter(
    (safeguard) => !isSafeguardEnabled(profile, safeguard.id)
  ).map((safeguard) => safeguard.id)

  const active = enabledSafeguards(profile)
  const resultFor = (id: KnowledgeSafeguardId): KnowledgeSafeguardResult =>
    safeguardResults[id] ?? "not_tested"

  const failed = active.filter((safeguard) => resultFor(safeguard.id) === "fail")
  const untestedSafeguards = active
    .filter((safeguard) => {
      const result = resultFor(safeguard.id)
      return result === "not_tested" || result === "not_applicable"
    })
    .map((safeguard) => safeguard.id)

  const base = {
    profileId: profile.id,
    profileSource,
    failedSafeguards: failed.map((safeguard) => safeguard.id),
    untestedSafeguards,
    skippedSafeguards,
  }

  // An ungroundable candidate cannot become a safety entry either.
  if (failed.some((safeguard) => safeguard.failureMode === "decline")) {
    return { ...base, outcome: "decline_unsafe" }
  }
  if (failed.length > 0) return { ...base, outcome: "rescope_as_safety" }
  if (untestedSafeguards.length > 0) return { ...base, outcome: "hold_as_draft" }
  return { ...base, outcome: "cleared" }
}

/**
 * Tier 0 then Tier 1, in that order and never the reverse: a candidate that
 * fails a safeguard is not scored at all, because a high composite must never read
 * as mitigating an unsafe entry.
 *
 * The two decline dispositions are deliberately distinct. `decline_unsafe` is
 * permanent; `decline_not_worthwhile` is a snapshot of what the estate owns and
 * does today and should be revisited when that changes.
 */
export function evaluateKnowledgeCandidate(
  submission: KnowledgeCandidateSubmission,
  options: EvaluateKnowledgeOptions = {}
): KnowledgeCandidateEvaluation {
  const profile = options.profile ?? STRICT_SAFEGUARD_PROFILE
  const weights = options.weights ?? DEFAULT_KNOWLEDGE_WEIGHTS
  const safeguards = evaluateSafeguardResults(
    submission.safeguardResults,
    profile,
    options.profileSource ?? "builtin"
  )

  const base = {
    candidateId: submission.candidateId,
    profileId: safeguards.profileId,
    profileSource: safeguards.profileSource,
    failedSafeguards: safeguards.failedSafeguards,
    untestedSafeguards: safeguards.untestedSafeguards,
    skippedSafeguards: safeguards.skippedSafeguards,
    subScores: null,
    composite: null,
    priority: null,
  } as const

  if (safeguards.outcome !== "cleared") return { ...base, disposition: safeguards.outcome }
  if (submission.facts == null) return { ...base, disposition: "hold_as_draft" }

  const subScores = computeKnowledgeSubScores(submission.facts)
  const composite = computeKnowledgeComposite(subScores, weights)
  const priority = resolvePriority(composite)

  return {
    ...base,
    disposition: priority == null ? "decline_not_worthwhile" : "author",
    subScores,
    composite,
    priority,
  }
}
