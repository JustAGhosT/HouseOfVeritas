import { z } from "zod"

export const GATE_ZERO_ID = "under-sink-leak-gate-0"
export const GATE_ZERO_PROTOCOL_VERSION = "v1-draft"

export const GATE_DECISION_STATUSES = [
  "approved_in_principle",
  "active",
  "rejected",
  "superseded",
] as const

export type GateDecisionStatus = (typeof GATE_DECISION_STATUSES)[number]
export type GateDecisionId = "O1" | "O2" | "O3" | "O4" | "O5" | "O6" | "O7"

export interface GateDecisionDefinition {
  id: GateDecisionId
  title: string
  description: string
  activationRequirements: string[]
}

export const GATE_ZERO_DECISIONS: GateDecisionDefinition[] = [
  {
    id: "O1",
    title: "Moat terminology",
    description: "Use moat rather than NOAT.",
    activationRequirements: [],
  },
  {
    id: "O2",
    title: "First test market",
    description: "Bound the first test market to South Africa.",
    activationRequirements: [],
  },
  {
    id: "O3",
    title: "Customer unit",
    description: "Use a private staffed household or small private estate.",
    activationRequirements: [],
  },
  {
    id: "O4",
    title: "First problem test",
    description: "Test photo-to-resolution coordination without diagnosis or purchasing.",
    activationRequirements: [],
  },
  {
    id: "O5",
    title: "Qualified plumbing reviewer",
    description: "Appoint an independent reviewer only after current eligibility is accepted.",
    activationRequirements: [
      "Pseudonymous reviewer candidate ID",
      "Current eligibility evidence reference",
    ],
  },
  {
    id: "O6",
    title: "Privacy and safety protocol",
    description: "Activate the protocol only after accountable owners and controls are recorded.",
    activationRequirements: [
      "Responsible party ID",
      "Privacy/legal reviewer ID",
      "Research owner ID",
      "Approved restricted store",
      "Authorized researcher IDs",
      "Retention/deletion deadline",
      "Correction/deletion owner ID",
      "Incident owner ID",
    ],
  },
  {
    id: "O7",
    title: "Neutral comparison model",
    description: "Use subscription-funded neutral comparison with commerce and steering excluded.",
    activationRequirements: [],
  },
]

const referenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, "Use a non-sensitive reference, not free-form data")

const pseudonymousIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9._-]*$/, "Use a pseudonymous ID without spaces or contact data")

export const gateDecisionRequestSchema = z
  .object({
    gateId: z.literal(GATE_ZERO_ID),
    protocolVersion: z.literal(GATE_ZERO_PROTOCOL_VERSION),
    decisionId: z.enum(["O1", "O2", "O3", "O4", "O5", "O6", "O7"]),
    status: z.enum(GATE_DECISION_STATUSES),
    rationale: z.string().trim().min(3).max(1000),
    evidenceRefs: z.array(referenceSchema).max(20).default([]),
    expectedVersion: z.number().int().min(0),
    idempotencyKey: z.string().uuid(),
    prerequisites: z
      .object({
        reviewerCandidateId: pseudonymousIdSchema.optional(),
        responsiblePartyId: pseudonymousIdSchema.optional(),
        privacyReviewerId: pseudonymousIdSchema.optional(),
        researchOwnerId: pseudonymousIdSchema.optional(),
        restrictedStoreApproved: z.boolean().optional(),
        authorizedResearcherIds: z.array(pseudonymousIdSchema).max(20).optional(),
        retentionDeletionDeadline: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
          .optional(),
        correctionDeletionOwnerId: pseudonymousIdSchema.optional(),
        incidentOwnerId: pseudonymousIdSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type GateDecisionRequest = z.infer<typeof gateDecisionRequestSchema>

export interface GateDecisionEvent extends GateDecisionRequest {
  id: string
  version: number
  actorId: string
  actorRole: "admin"
  createdAt: string
  requestFingerprint: string
}

export interface GateDecisionProjection {
  definition: GateDecisionDefinition
  current: GateDecisionEvent | null
  history: GateDecisionEvent[]
  missingPrerequisites: string[]
}

export function getMissingActivationPrerequisites(
  request: Pick<GateDecisionRequest, "decisionId" | "evidenceRefs" | "prerequisites">
): string[] {
  if (request.decisionId === "O5") {
    const missing: string[] = []
    if (!request.prerequisites?.reviewerCandidateId) missing.push("reviewerCandidateId")
    if (request.evidenceRefs.length === 0) missing.push("evidenceRefs")
    return missing
  }

  if (request.decisionId !== "O6") return []

  const prerequisites = request.prerequisites
  const missing: string[] = []
  if (!prerequisites?.responsiblePartyId) missing.push("responsiblePartyId")
  if (!prerequisites?.privacyReviewerId) missing.push("privacyReviewerId")
  if (!prerequisites?.researchOwnerId) missing.push("researchOwnerId")
  if (prerequisites?.restrictedStoreApproved !== true) missing.push("restrictedStoreApproved")
  if (!prerequisites?.authorizedResearcherIds?.length) missing.push("authorizedResearcherIds")
  if (!prerequisites?.retentionDeletionDeadline) missing.push("retentionDeletionDeadline")
  if (!prerequisites?.correctionDeletionOwnerId) missing.push("correctionDeletionOwnerId")
  if (!prerequisites?.incidentOwnerId) missing.push("incidentOwnerId")
  return missing
}

export function isAllowedTransition(
  previous: GateDecisionStatus | null,
  next: GateDecisionStatus
): boolean {
  if (previous === null) return next === "approved_in_principle" || next === "rejected"
  if (previous === "approved_in_principle") {
    return next === "active" || next === "rejected" || next === "superseded"
  }
  if (previous === "active") return next === "superseded"
  if (previous === "rejected" || previous === "superseded") {
    return next === "approved_in_principle"
  }
  return false
}

export function getAllowedTransitions(previous: GateDecisionStatus | null): GateDecisionStatus[] {
  return GATE_DECISION_STATUSES.filter((status) => isAllowedTransition(previous, status))
}
