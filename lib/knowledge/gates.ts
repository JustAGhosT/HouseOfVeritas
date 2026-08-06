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
 * House of Veritas — Knowledge base: Tier-0 publication gates.
 *
 * Hard pass/fail admission checks, structured to mirror
 * `evaluateDomainSafetyTrial()` so the knowledge base and the reviewer trial
 * speak one vocabulary. Spec: `docs/specs/knowledge-base-process-rubric.md` §4.
 *
 * Gates are configurable per profile, with three deliberate safety properties:
 *
 *  1. **Default-on, structurally.** A profile carries only `disabledGates`, so
 *     opting out is explicit and by name and there is no "enable" list to forget
 *     to update. A gate added to `KNOWLEDGE_PUBLICATION_GATES` later therefore
 *     applies to every existing profile immediately, which is the safe default.
 *  2. **Disabled ≠ passed.** A gate a profile switches off resolves to
 *     `not_applicable` and is listed in `skippedGates` on the evaluation. It is
 *     never folded into "pass", so an audit can always tell "we checked and it
 *     was fine" from "we never checked".
 *  3. **Missing ≠ passed.** A gate with no submitted result is `not_tested`,
 *     which holds the candidate at `draft`. Absence of evidence is not a pass.
 */

export const KNOWLEDGE_GATE_RESULTS = ["pass", "fail", "not_tested", "not_applicable"] as const
export type KnowledgeGateResult = (typeof KNOWLEDGE_GATE_RESULTS)[number]

/**
 * What a failure costs the candidate.
 *  - `rescope`  — the DIY procedure is refused, but a `safety` entry (recognise,
 *                 stop, escalate) can still be published. An estate that welds
 *                 badly is more dangerous than one told plainly not to.
 *  - `decline`  — nothing publishable survives. Reserved for the case where no
 *                 claim can be grounded at all: a safety entry also makes
 *                 claims, so an ungroundable topic cannot become one.
 */
export type KnowledgeGateFailureMode = "rescope" | "decline"

export interface KnowledgeGate {
  id: KnowledgeGateId
  label: string
  description: string
  failureMode: KnowledgeGateFailureMode
  /**
   * Whether a gate profile may switch this gate off at all.
   *
   * Two gates are not waivable by anyone, including an administrator, because
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

export const KNOWLEDGE_GATE_IDS = [
  "statutory_competence",
  "irreversible_harm",
  "verifiable_ground_truth",
  "commercial_neutrality",
  "data_boundary",
  "diagnosis_before_action",
] as const
export type KnowledgeGateId = (typeof KNOWLEDGE_GATE_IDS)[number]

export const KNOWLEDGE_PUBLICATION_GATES: readonly KnowledgeGate[] = [
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

export const getKnowledgeGate = (id: KnowledgeGateId): KnowledgeGate =>
  KNOWLEDGE_PUBLICATION_GATES.find((gate) => gate.id === id)!

/** Gates no profile may switch off. Enforced by the profile request schema. */
export const NON_WAIVABLE_GATE_IDS: readonly KnowledgeGateId[] = KNOWLEDGE_PUBLICATION_GATES.filter(
  (gate) => !gate.waivable
).map((gate) => gate.id)

export const isWaivableGate = (id: KnowledgeGateId): boolean => getKnowledgeGate(id).waivable

/**
 * Where the profile used for an evaluation came from.
 *  - `builtin`          — a code-defined profile, no stored override exists
 *  - `stored`           — an administrator's recorded configuration
 *  - `builtin-fallback` — the store was unreachable, so `strict` was used
 *
 * Recorded on every evaluation so a relaxed configuration silently reverting to
 * strict during an outage is visible rather than mysterious.
 */
export const KNOWLEDGE_GATE_PROFILE_SOURCES = ["builtin", "stored", "builtin-fallback"] as const
export type KnowledgeGateProfileSource = (typeof KNOWLEDGE_GATE_PROFILE_SOURCES)[number]

// ── Profiles: selectable, toggleable gate sets ───────────────────────────────

export interface KnowledgeGateProfile {
  id: string
  label: string
  description: string
  /** Gates switched OFF for this profile. Everything not listed runs. */
  disabledGates: readonly KnowledgeGateId[]
}

/** Every gate runs. The safe default for any `procedure` or `troubleshooting` entry. */
export const STRICT_GATE_PROFILE: KnowledgeGateProfile = {
  id: "strict",
  label: "Strict (default)",
  description: "Every gate runs. Use for any procedural or troubleshooting entry.",
  disabledGates: [],
}

/**
 * Household consumables. Cooking is not a statutorily reserved activity and a
 * recipe has no root cause to misdiagnose. Allergen content still has to clear
 * `irreversible_harm` and `verifiable_ground_truth`, which is the whole point of
 * keeping those on.
 */
export const RECIPE_GATE_PROFILE: KnowledgeGateProfile = {
  id: "household-recipe",
  label: "Household recipe",
  description:
    "Recipe entries. Statutory competence and diagnosis-before-action do not apply; allergen safety and sourcing still do.",
  disabledGates: ["statutory_competence", "diagnosis_before_action"],
}

/** Verification-only content that transforms nothing, so misdiagnosis is not a risk. */
export const CHECKLIST_GATE_PROFILE: KnowledgeGateProfile = {
  id: "checklist",
  label: "Checklist",
  description: "Inspect-and-record entries that change nothing on the asset.",
  disabledGates: ["diagnosis_before_action"],
}

export const KNOWLEDGE_GATE_PROFILES: readonly KnowledgeGateProfile[] = [
  STRICT_GATE_PROFILE,
  RECIPE_GATE_PROFILE,
  CHECKLIST_GATE_PROFILE,
]

export const getGateProfile = (id: string): KnowledgeGateProfile | null =>
  KNOWLEDGE_GATE_PROFILES.find((profile) => profile.id === id) ?? null

/**
 * A non-waivable gate is enabled no matter what a profile says.
 *
 * This is the innermost of three layers, and the only one every path goes
 * through. The request schema guards API writes and `resolveEffectiveProfile()`
 * guards reads from the store, but neither sees a profile constructed in code
 * or handed straight to the evaluator by a caller. Enforcing it here makes
 * "no profile may waive `data_boundary` or `verifiable_ground_truth`" true by
 * construction and demotes the outer two layers to defence in depth.
 */
export const isGateEnabled = (profile: KnowledgeGateProfile, id: KnowledgeGateId): boolean =>
  !getKnowledgeGate(id).waivable || !profile.disabledGates.includes(id)

export const enabledGates = (profile: KnowledgeGateProfile): readonly KnowledgeGate[] =>
  KNOWLEDGE_PUBLICATION_GATES.filter((gate) => isGateEnabled(profile, gate.id))

/**
 * Toggle helpers return a new profile — profiles are values, not mutable state.
 * Disabling a non-waivable gate is a no-op rather than an error: callers should
 * not have to special-case it, and `isGateEnabled()` would ignore it anyway.
 */
export function withGateDisabled(
  profile: KnowledgeGateProfile,
  id: KnowledgeGateId
): KnowledgeGateProfile {
  if (!getKnowledgeGate(id).waivable) return profile
  if (!isGateEnabled(profile, id)) return profile
  return { ...profile, disabledGates: [...profile.disabledGates, id] }
}

export function withGateEnabled(
  profile: KnowledgeGateProfile,
  id: KnowledgeGateId
): KnowledgeGateProfile {
  if (isGateEnabled(profile, id)) return profile
  return { ...profile, disabledGates: profile.disabledGates.filter((gate) => gate !== id) }
}

// ── Submission and evaluation ────────────────────────────────────────────────

const gateResultSchema = z.enum(KNOWLEDGE_GATE_RESULTS)

/**
 * Every gate key is optional: a candidate mid-review has only some gates
 * answered. `evaluateKnowledgeCandidate` reads an absent key as `not_tested`.
 */
export const knowledgeGateResultsSchema = z
  .object({
    statutory_competence: gateResultSchema,
    irreversible_harm: gateResultSchema,
    verifiable_ground_truth: gateResultSchema,
    commercial_neutrality: gateResultSchema,
    data_boundary: gateResultSchema,
    diagnosis_before_action: gateResultSchema,
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
    /** Omitted gates are treated as `not_tested`, never as passes. */
    gateResults: knowledgeGateResultsSchema.default({}),
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
  /** Gates clear, composite at or above the decline threshold. */
  | "author"
  /** A `rescope`-mode gate failed: publish a stop-and-escalate `safety` entry. */
  | "rescope_as_safety"
  /** A `decline`-mode gate failed: nothing publishable survives. */
  | "decline_unsafe"
  /** Gates clear, but the candidate is not worth authoring. Revisit on change. */
  | "decline_not_worthwhile"
  /** A gate was never tested, or Tier-1 facts are missing. Stays `draft`. */
  | "hold_as_draft"

export interface KnowledgeCandidateEvaluation {
  candidateId: string
  profileId: string
  /** Whether the profile was code-defined, administrator-stored, or an outage fallback. */
  profileSource: KnowledgeGateProfileSource
  disposition: KnowledgeDisposition
  failedGates: KnowledgeGateId[]
  untestedGates: KnowledgeGateId[]
  /** Disabled by the profile — recorded so a skip is never silent. */
  skippedGates: KnowledgeGateId[]
  subScores: KnowledgeSubScores | null
  composite: number | null
  priority: KnowledgePriority | null
}

export interface EvaluateKnowledgeOptions {
  profile?: KnowledgeGateProfile
  /** Defaults to `builtin`; callers loading from the store pass the real source. */
  profileSource?: KnowledgeGateProfileSource
  weights?: KnowledgeWeights
}

/** Tier-0 outcome on its own, for callers that gate publication rather than authoring. */
export type KnowledgeGateOutcome =
  | "cleared"
  /** A `rescope`-mode gate failed. */
  | "rescope_as_safety"
  /** A `decline`-mode gate failed — nothing publishable survives. */
  | "decline_unsafe"
  /** A gate was never tested. Absence of evidence is not a pass. */
  | "hold_as_draft"

export interface KnowledgeGateEvaluation {
  profileId: string
  profileSource: KnowledgeGateProfileSource
  outcome: KnowledgeGateOutcome
  failedGates: KnowledgeGateId[]
  untestedGates: KnowledgeGateId[]
  skippedGates: KnowledgeGateId[]
}

/**
 * Run recorded gate results against a profile. Shared by the authoring rubric
 * (`evaluateKnowledgeCandidate`) and by publication enforcement, so the two can
 * never drift into disagreeing about what "cleared" means.
 */
export function evaluateGateResults(
  gateResults: Partial<Record<KnowledgeGateId, KnowledgeGateResult>>,
  profile: KnowledgeGateProfile = STRICT_GATE_PROFILE,
  profileSource: KnowledgeGateProfileSource = "builtin"
): KnowledgeGateEvaluation {
  const skippedGates = KNOWLEDGE_PUBLICATION_GATES.filter(
    (gate) => !isGateEnabled(profile, gate.id)
  ).map((gate) => gate.id)

  const active = enabledGates(profile)
  const resultFor = (id: KnowledgeGateId): KnowledgeGateResult => gateResults[id] ?? "not_tested"

  const failed = active.filter((gate) => resultFor(gate.id) === "fail")
  const untestedGates = active
    .filter((gate) => {
      const result = resultFor(gate.id)
      return result === "not_tested" || result === "not_applicable"
    })
    .map((gate) => gate.id)

  const base = {
    profileId: profile.id,
    profileSource,
    failedGates: failed.map((gate) => gate.id),
    untestedGates,
    skippedGates,
  }

  // An ungroundable candidate cannot become a safety entry either.
  if (failed.some((gate) => gate.failureMode === "decline")) {
    return { ...base, outcome: "decline_unsafe" }
  }
  if (failed.length > 0) return { ...base, outcome: "rescope_as_safety" }
  if (untestedGates.length > 0) return { ...base, outcome: "hold_as_draft" }
  return { ...base, outcome: "cleared" }
}

/**
 * Tier 0 then Tier 1, in that order and never the reverse: a candidate that
 * fails a gate is not scored at all, because a high composite must never read
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
  const profile = options.profile ?? STRICT_GATE_PROFILE
  const weights = options.weights ?? DEFAULT_KNOWLEDGE_WEIGHTS
  const gates = evaluateGateResults(
    submission.gateResults,
    profile,
    options.profileSource ?? "builtin"
  )

  const base = {
    candidateId: submission.candidateId,
    profileId: gates.profileId,
    profileSource: gates.profileSource,
    failedGates: gates.failedGates,
    untestedGates: gates.untestedGates,
    skippedGates: gates.skippedGates,
    subScores: null,
    composite: null,
    priority: null,
  } as const

  if (gates.outcome !== "cleared") return { ...base, disposition: gates.outcome }
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
