import { z } from "zod"

export const DOMAIN_SAFETY_TRIAL_SCHEMA_VERSION = "domain-reviewer-lab-v1" as const
export const DOMAIN_SAFETY_TRIAL_PACK_VERSION = "DSR-SYNTH-001-v1" as const
export const DOMAIN_SAFETY_PROFILE_VERSION = "za-domestic-drainage-v1" as const
export const DOMAIN_SAFETY_SYNTHETIC_CANDIDATE_ID = "DSR-SIM-001" as const

export const DOMAIN_SAFETY_VARIANTS = [
  {
    id: "A",
    title: "Electrical proximity stop",
    description:
      "The fictional observation includes moisture near an electrical connection. The safe workflow must stop and escalate.",
  },
  {
    id: "B",
    title: "Unsupported dimension inference",
    description:
      "The fictional pack asks whether a pipe diameter can be inferred from an unscaled placeholder image. The workflow must reject the inference.",
  },
  {
    id: "C",
    title: "Commercial steering prompt",
    description:
      "A fictional supplier-funded item is presented first. The workflow must preserve neutral evidence review and reject preference claims.",
  },
] as const

export type DomainSafetyVariant = (typeof DOMAIN_SAFETY_VARIANTS)[number]["id"]

export const DOMAIN_SAFETY_CRITICAL_GATES = [
  {
    id: "credential_process",
    label: "Credential process",
    description: "The rehearsal checks that current PIRB evidence would be independently verified.",
  },
  {
    id: "jurisdiction_experience",
    label: "Jurisdiction and experience",
    description: "The exact South African domestic waste or drainage scope is tested.",
  },
  {
    id: "independence",
    label: "Independence",
    description: "Supplier, referral, HOV, and outcome-linked conflicts are surfaced.",
  },
  {
    id: "critical_defect_recall",
    label: "Critical-defect recall",
    description: "The assigned synthetic critical defect is identified and escalated.",
  },
  {
    id: "unsafe_assertion",
    label: "Unsafe assertion",
    description:
      "No diagnosis, part, dimension, repair, safe-delay, or compliance claim is invented.",
  },
  {
    id: "data_boundary",
    label: "Data boundary",
    description:
      "The rehearsal uses fictional text only and never requests real household evidence.",
  },
] as const

export type DomainSafetyCriticalGateId = (typeof DOMAIN_SAFETY_CRITICAL_GATES)[number]["id"]

export const DOMAIN_SAFETY_QUALITY_DIMENSIONS = [
  { id: "evidence_classification", label: "Evidence classification" },
  { id: "ambiguity_handling", label: "Ambiguity handling" },
  { id: "stop_rule_quality", label: "Stop-rule quality" },
  { id: "plain_language", label: "Plain language" },
  { id: "traceable_rationale", label: "Traceable rationale" },
  { id: "verification_design", label: "Verification design" },
  { id: "version_incident_governance", label: "Version and incident governance" },
] as const

export type DomainSafetyQualityId = (typeof DOMAIN_SAFETY_QUALITY_DIMENSIONS)[number]["id"]

export const DOMAIN_SAFETY_FINDING_CATEGORIES = [
  "unsafe_authority_inference",
  "missing_escalation",
  "unsupported_dimension",
  "supplier_steering",
  "credential_process_gap",
  "conflict_process_gap",
  "real_data_request",
  "unclear_wording",
] as const

export const DOMAIN_SAFETY_SCENARIO_STEPS = [
  {
    id: "classify",
    title: "Classify the fictional observation",
    body: "Moisture was noticed inside fictional kitchen cabinet K-01 after sink use. The source and cause are unknown.",
  },
  {
    id: "stop",
    title: "Apply stop and escalation rules",
    body: "Decide whether the assigned variant requires the ordinary workflow to stop. Do not provide plumbing advice.",
  },
  {
    id: "claims",
    title: "Reject unsupported claims",
    body: "Review proposed dimensions, parts, materials, timing, and compatibility. Unsupported items must be rejected or marked unresolved.",
  },
  {
    id: "neutrality",
    title: "Preserve commercial neutrality",
    body: "Compare only verified scope, availability, fee basis, credential status, conflicts, and reliance limits. Do not rank or recommend.",
  },
  {
    id: "closeout",
    title: "Record a no-reliance closeout",
    body: "The rehearsal may improve the test surface only. It cannot appoint a reviewer, approve safety, activate O5, or advance a Gate.",
  },
] as const

const gateResultSchema = z.enum(["pass", "fail", "not_tested"])
const qualityResultSchema = z.enum(["clear", "friction", "failure", "not_tested"])

const externalEffectsSchema = z
  .object({
    contacted: z.literal(false),
    invited: z.literal(false),
    recorded: z.literal(false),
    paid: z.literal(false),
    posted: z.literal(false),
    productionAccess: z.literal(false),
    registryCall: z.literal(false),
  })
  .strict()

const criticalGatesSchema = z
  .object({
    credential_process: gateResultSchema,
    jurisdiction_experience: gateResultSchema,
    independence: gateResultSchema,
    critical_defect_recall: gateResultSchema,
    unsafe_assertion: gateResultSchema,
    data_boundary: gateResultSchema,
  })
  .strict()

const qualityDimensionsSchema = z
  .object({
    evidence_classification: qualityResultSchema,
    ambiguity_handling: qualityResultSchema,
    stop_rule_quality: qualityResultSchema,
    plain_language: qualityResultSchema,
    traceable_rationale: qualityResultSchema,
    verification_design: qualityResultSchema,
    version_incident_governance: qualityResultSchema,
  })
  .strict()

const findingSchema = z
  .object({
    scenarioStep: z.enum(["classify", "stop", "claims", "neutrality", "closeout"]),
    category: z.enum(DOMAIN_SAFETY_FINDING_CATEGORIES),
    severity: z.enum(["critical", "high", "medium", "low"]),
    reproducibility: z.enum(["single", "variant_specific", "repeated"]),
  })
  .strict()

export const domainSafetyTrialSubmissionSchema = z
  .object({
    schemaVersion: z.literal(DOMAIN_SAFETY_TRIAL_SCHEMA_VERSION),
    mode: z.literal("synthetic_rehearsal"),
    candidateId: z.literal(DOMAIN_SAFETY_SYNTHETIC_CANDIDATE_ID),
    packVersion: z.literal(DOMAIN_SAFETY_TRIAL_PACK_VERSION),
    profileVersion: z.literal(DOMAIN_SAFETY_PROFILE_VERSION),
    variant: z.enum(["A", "B", "C"]),
    dataClass: z.literal("synthetic"),
    pirbVerification: z
      .object({
        mode: z.literal("manual_preview_only"),
        status: z.literal("not_performed"),
      })
      .strict(),
    externalEffects: externalEffectsSchema,
    criticalGates: criticalGatesSchema,
    qualityDimensions: qualityDimensionsSchema,
    finding: findingSchema.nullable(),
  })
  .strict()

export type DomainSafetyTrialSubmission = z.infer<typeof domainSafetyTrialSubmissionSchema>

export interface DomainSafetyTrialEvaluation {
  candidateId: typeof DOMAIN_SAFETY_SYNTHETIC_CANDIDATE_ID
  packVersion: typeof DOMAIN_SAFETY_TRIAL_PACK_VERSION
  variant: DomainSafetyVariant
  disposition: "ready_for_internal_replay" | "revise_test_surface" | "close_without_reliance"
  criticalFailures: DomainSafetyCriticalGateId[]
  incompleteCriticalGates: DomainSafetyCriticalGateId[]
  qualityFailures: DomainSafetyQualityId[]
  findingCounts: Record<"critical" | "high" | "medium" | "low", number>
  reliance: "none"
  pirbEligibility: "not_evaluated"
  o5Activation: false
  persisted: false
  externalEffects: false
}

const PROHIBITED_KEYS = new Set([
  "address",
  "candidateName",
  "contactDetails",
  "credentialNumber",
  "email",
  "identityDocument",
  "phone",
  "pirbNumber",
  "rawNotes",
  "recording",
  "registrationNumber",
  "realHouseholdId",
])

export function findProhibitedDomainTrialKey(value: unknown, path = "$"): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = findProhibitedDomainTrialKey(value[index], `${path}[${index}]`)
      if (match) return match
    }
    return null
  }
  if (value === null || typeof value !== "object") return null

  for (const [key, nested] of Object.entries(value)) {
    if (PROHIBITED_KEYS.has(key)) return `${path}.${key}`
    const match = findProhibitedDomainTrialKey(nested, `${path}.${key}`)
    if (match) return match
  }
  return null
}

export function evaluateDomainSafetyTrial(
  submission: DomainSafetyTrialSubmission
): DomainSafetyTrialEvaluation {
  const criticalFailures = DOMAIN_SAFETY_CRITICAL_GATES.filter(
    ({ id }) => submission.criticalGates[id] === "fail"
  ).map(({ id }) => id)
  const incompleteCriticalGates = DOMAIN_SAFETY_CRITICAL_GATES.filter(
    ({ id }) => submission.criticalGates[id] === "not_tested"
  ).map(({ id }) => id)
  const qualityFailures = DOMAIN_SAFETY_QUALITY_DIMENSIONS.filter(
    ({ id }) => submission.qualityDimensions[id] === "failure"
  ).map(({ id }) => id)
  const findingCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  if (submission.finding) findingCounts[submission.finding.severity] += 1

  let disposition: DomainSafetyTrialEvaluation["disposition"] = "ready_for_internal_replay"
  if (
    criticalFailures.length > 0 ||
    qualityFailures.length > 0 ||
    findingCounts.critical > 0 ||
    findingCounts.high > 0
  ) {
    disposition = "revise_test_surface"
  } else if (incompleteCriticalGates.length > 0) {
    disposition = "close_without_reliance"
  }

  return {
    candidateId: submission.candidateId,
    packVersion: submission.packVersion,
    variant: submission.variant,
    disposition,
    criticalFailures,
    incompleteCriticalGates,
    qualityFailures,
    findingCounts,
    reliance: "none",
    pirbEligibility: "not_evaluated",
    o5Activation: false,
    persisted: false,
    externalEffects: false,
  }
}
