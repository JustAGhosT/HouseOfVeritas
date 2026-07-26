import { describe, expect, it } from "vitest"
import {
  DOMAIN_SAFETY_CRITICAL_GATES,
  DOMAIN_SAFETY_QUALITY_DIMENSIONS,
  domainSafetyTrialSubmissionSchema,
  evaluateDomainSafetyTrial,
  findProhibitedDomainTrialKey,
  type DomainSafetyTrialSubmission,
} from "@/lib/reviewer-trials/domain-safety-trial"

function submission(): DomainSafetyTrialSubmission {
  return {
    schemaVersion: "domain-reviewer-lab-v1",
    mode: "synthetic_rehearsal",
    candidateId: "DSR-SIM-001",
    packVersion: "DSR-SYNTH-001-v1",
    profileVersion: "za-domestic-drainage-v1",
    variant: "A",
    dataClass: "synthetic",
    pirbVerification: { mode: "manual_preview_only", status: "not_performed" },
    externalEffects: {
      contacted: false,
      invited: false,
      recorded: false,
      paid: false,
      posted: false,
      productionAccess: false,
      registryCall: false,
    },
    criticalGates: Object.fromEntries(
      DOMAIN_SAFETY_CRITICAL_GATES.map(({ id }) => [id, "pass"])
    ) as DomainSafetyTrialSubmission["criticalGates"],
    qualityDimensions: Object.fromEntries(
      DOMAIN_SAFETY_QUALITY_DIMENSIONS.map(({ id }) => [id, "clear"])
    ) as DomainSafetyTrialSubmission["qualityDimensions"],
    finding: null,
  }
}

describe("domain safety reviewer trial contract", () => {
  it("returns only internal-replay readiness with no reliance or external effects", () => {
    const result = evaluateDomainSafetyTrial(submission())

    expect(result).toMatchObject({
      disposition: "ready_for_internal_replay",
      reliance: "none",
      pirbEligibility: "not_evaluated",
      o5Activation: false,
      persisted: false,
      externalEffects: false,
    })
  })

  it("requires revision after a critical-gate failure or high finding", () => {
    const run = submission()
    run.criticalGates.unsafe_assertion = "fail"
    run.finding = {
      scenarioStep: "claims",
      category: "unsupported_dimension",
      severity: "high",
      reproducibility: "variant_specific",
    }

    expect(evaluateDomainSafetyTrial(run)).toMatchObject({
      disposition: "revise_test_surface",
      criticalFailures: ["unsafe_assertion"],
      findingCounts: { critical: 0, high: 1, medium: 0, low: 0 },
    })
  })

  it("closes without reliance while any critical gate is not tested", () => {
    const run = submission()
    run.criticalGates.credential_process = "not_tested"

    expect(evaluateDomainSafetyTrial(run)).toMatchObject({
      disposition: "close_without_reliance",
      incompleteCriticalGates: ["credential_process"],
    })
  })

  it("rejects external effects and detects restricted keys before parsing", () => {
    const unsafe = {
      ...submission(),
      externalEffects: { ...submission().externalEffects, registryCall: true },
      nested: { candidateName: "Prohibited" },
    }

    expect(findProhibitedDomainTrialKey(unsafe)).toBe("$.nested.candidateName")
    expect(domainSafetyTrialSubmissionSchema.safeParse(unsafe).success).toBe(false)
  })
})
