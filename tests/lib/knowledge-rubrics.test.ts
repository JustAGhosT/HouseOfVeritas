import { describe, it, expect } from "vitest"
import {
  AUTHORING_EFFORT_FLOOR,
  COST_AVOIDED_FLOOR,
  COST_AVOIDED_UNKNOWN_SUBSCORE,
  computeKnowledgeComposite,
  computeKnowledgeSubScores,
  DEFAULT_KNOWLEDGE_WEIGHTS,
  isPlausibleRecurrence,
  MAX_PLAUSIBLE_RECURRENCE,
  PRIORITY_DECLINE_THRESHOLD,
  rands,
  RECURRENCE_FLOOR,
  resolvePriority,
  RETRIEVABILITY_FLOOR,
  scoreAuthoringEffort,
  scoreCostAvoided,
  scoreRecurrence,
  scoreRetrievability,
  type KnowledgeCandidateFacts,
  type KnowledgeSubScores,
} from "@/lib/knowledge/rubrics"

const COPPER_PIPE_FACTS: KnowledgeCandidateFacts = {
  recurrencePerYear: 4,
  costAvoidedCents: 90_000,
  consequenceOfDelay: "compounding-structural",
  personaFit: "named-owner-routine",
  assetCoverage: "owned-multiple",
  repeatability: "diagnostic-branching",
  symptomCount: 11,
  keywordCount: 15,
  authoringEffortHours: 8,
  localeReach: "both-locales-planned",
}

describe("band floors", () => {
  it("gives a sub-annual candidate the recurrence floor instead of no band at all", () => {
    // The gap spec §8.4 found: once-per-decade matched nothing before the floor.
    expect(scoreRecurrence(0.1)).toBe(RECURRENCE_FLOOR)
    expect(scoreRecurrence(0)).toBe(RECURRENCE_FLOOR)
    expect(scoreRecurrence(1)).toBe(2) // the lowest real band
  })

  it("applies floors on the other tables too", () => {
    expect(scoreCostAvoided(rands(50))).toBe(COST_AVOIDED_FLOOR)
    expect(scoreRetrievability(0, 0)).toBe(RETRIEVABILITY_FLOOR)
    expect(scoreAuthoringEffort(200)).toBe(AUTHORING_EFFORT_FLOOR)
  })

  it("scores band boundaries inclusively", () => {
    expect(scoreRecurrence(24)).toBe(10)
    expect(scoreRecurrence(23.9)).toBe(8)
    expect(scoreCostAvoided(rands(600))).toBe(6)
    expect(scoreCostAvoided(rands(599))).toBe(4)
    expect(scoreAuthoringEffort(8)).toBe(6) // lower-is-better: <= wins
    expect(scoreAuthoringEffort(8.1)).toBe(4)
  })
})

describe("unknown and implausible values", () => {
  it("penalises an unquantified saving rather than treating it as average", () => {
    expect(scoreCostAvoided(null)).toBe(COST_AVOIDED_UNKNOWN_SUBSCORE)
    expect(COST_AVOIDED_UNKNOWN_SUBSCORE).toBeLessThan(5)
  })

  it("clamps an implausible cadence instead of letting it run away", () => {
    expect(isPlausibleRecurrence(MAX_PLAUSIBLE_RECURRENCE)).toBe(true)
    expect(isPlausibleRecurrence(MAX_PLAUSIBLE_RECURRENCE + 1)).toBe(false)
    expect(isPlausibleRecurrence(-1)).toBe(false)
    expect(scoreRecurrence(50_000)).toBe(scoreRecurrence(MAX_PLAUSIBLE_RECURRENCE))
  })
})

describe("retrievability needs both counts", () => {
  it("does not let a long keyword list rescue a single symptom phrase", () => {
    expect(scoreRetrievability(1, 40)).toBe(4)
    expect(scoreRetrievability(8, 10)).toBe(10)
    expect(scoreRetrievability(8, 9)).toBe(8) // keywords short of the top band
  })
})

describe("composite and priority", () => {
  it("reproduces the spec's worked copper-pipe score", () => {
    const composite = computeKnowledgeComposite(computeKnowledgeSubScores(COPPER_PIPE_FACTS))
    expect(composite).toBeCloseTo(8.0, 5)
    expect(resolvePriority(composite)).toBe("P0")
  })

  it("maps composites onto the documented priority bands", () => {
    expect(resolvePriority(7.5)).toBe("P0")
    expect(resolvePriority(7.49)).toBe("P1")
    expect(resolvePriority(6.0)).toBe("P1")
    expect(resolvePriority(5.99)).toBe("P2")
    expect(resolvePriority(PRIORITY_DECLINE_THRESHOLD)).toBe("P2")
    expect(resolvePriority(PRIORITY_DECLINE_THRESHOLD - 0.01)).toBeNull()
  })

  it("weights sum to 16, matching the spec's divisor", () => {
    const total = Object.values(DEFAULT_KNOWLEDGE_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(16)
  })

  it("honours caller-supplied weights", () => {
    const subScores = computeKnowledgeSubScores(COPPER_PIPE_FACTS)
    const onlyEffort = computeKnowledgeComposite(subScores, {
      ...(Object.fromEntries(
        Object.keys(DEFAULT_KNOWLEDGE_WEIGHTS).map((k) => [k, 0])
      ) as typeof DEFAULT_KNOWLEDGE_WEIGHTS),
      authoringEffort: 1,
    })
    expect(onlyEffort).toBe(subScores.authoringEffort)
  })

  it("returns 0 rather than dividing by zero when all weights are zero", () => {
    const zeroed = Object.fromEntries(
      Object.keys(DEFAULT_KNOWLEDGE_WEIGHTS).map((k) => [k, 0])
    ) as typeof DEFAULT_KNOWLEDGE_WEIGHTS
    expect(computeKnowledgeComposite(computeKnowledgeSubScores(COPPER_PIPE_FACTS), zeroed)).toBe(0)
  })

  it("keeps every sub-score inside the 1-10 scale", () => {
    const subScores: KnowledgeSubScores = computeKnowledgeSubScores(COPPER_PIPE_FACTS)
    for (const value of Object.values(subScores)) {
      expect(value).toBeGreaterThanOrEqual(1)
      expect(value).toBeLessThanOrEqual(10)
    }
  })
})
