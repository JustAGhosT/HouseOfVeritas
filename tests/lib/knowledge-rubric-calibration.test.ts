import { describe, expect, it } from "vitest"
import {
  computeKnowledgeComposite,
  computeKnowledgeSubScores,
  DEFAULT_KNOWLEDGE_WEIGHTS,
  rands,
  RECURRENCE_FLOOR,
  resolvePriority,
  scoreRecurrence,
  type KnowledgeCandidateFacts,
} from "@/lib/knowledge/rubrics"

/**
 * Calibration properties of the Tier-1 rubric, measured over a representative
 * slice of the §7 catalogue.
 *
 * These facts are considered estimates, not measurements — nobody has timed a
 * gutter clearing. The suite therefore asserts *bounds and shapes* that should
 * hold under any sensible re-tuning, not specific composites. It exists so that
 * changing a weight or a band has to confront its effect on the whole catalogue
 * rather than on one worked example.
 */

type Candidate = { domain: string; name: string; facts: KnowledgeCandidateFacts }

const CATALOGUE: Candidate[] = [
  { domain: "maintenance", name: "geyser TP valve check", facts: { recurrencePerYear: 2, costAvoidedCents: rands(1200), consequenceOfDelay: "compounding-structural", personaFit: "named-owner-occasional", assetCoverage: "owned-single", repeatability: "deterministic", symptomCount: 5, keywordCount: 8, authoringEffortHours: 4, localeReach: "both-locales-planned" } },
  { domain: "maintenance", name: "gutter clearing", facts: { recurrencePerYear: 2, costAvoidedCents: rands(900), consequenceOfDelay: "compounding-structural", personaFit: "named-owner-routine", assetCoverage: "owned-multiple", repeatability: "deterministic", symptomCount: 5, keywordCount: 8, authoringEffortHours: 2, localeReach: "both-locales-planned" } },
  { domain: "maintenance", name: "silicone reseal", facts: { recurrencePerYear: 2, costAvoidedCents: rands(700), consequenceOfDelay: "compounding-structural", personaFit: "named-owner-routine", assetCoverage: "owned-multiple", repeatability: "deterministic", symptomCount: 5, keywordCount: 8, authoringEffortHours: 4, localeReach: "both-locales-planned" } },
  { domain: "vehicle", name: "tyre pressure + tread", facts: { recurrencePerYear: 24, costAvoidedCents: rands(150), consequenceOfDelay: "compounding-asset", personaFit: "named-owner-routine", assetCoverage: "owned-multiple", repeatability: "deterministic", symptomCount: 3, keywordCount: 6, authoringEffortHours: 2, localeReach: "both-locales-planned" } },
  { domain: "vehicle", name: "pre-trip checklist", facts: { recurrencePerYear: 24, costAvoidedCents: null, consequenceOfDelay: "compounding-asset", personaFit: "named-owner-routine", assetCoverage: "owned-multiple", repeatability: "deterministic", symptomCount: 3, keywordCount: 5, authoringEffortHours: 2, localeReach: "both-locales-planned" } },
  { domain: "garden", name: "irrigation zone test", facts: { recurrencePerYear: 12, costAvoidedCents: rands(600), consequenceOfDelay: "degrading", personaFit: "named-owner-routine", assetCoverage: "owned-multiple", repeatability: "parameterised", symptomCount: 5, keywordCount: 8, authoringEffortHours: 4, localeReach: "both-locales-planned" } },
  { domain: "garden", name: "mower service", facts: { recurrencePerYear: 2, costAvoidedCents: rands(800), consequenceOfDelay: "compounding-asset", personaFit: "named-owner-routine", assetCoverage: "owned-single", repeatability: "deterministic", symptomCount: 5, keywordCount: 8, authoringEffortHours: 4, localeReach: "both-locales-planned" } },
  { domain: "garden", name: "compost heap", facts: { recurrencePerYear: 12, costAvoidedCents: null, consequenceOfDelay: "degrading", personaFit: "named-owner-routine", assetCoverage: "owned-single", repeatability: "deterministic", symptomCount: 3, keywordCount: 6, authoringEffortHours: 4, localeReach: "both-locales-planned" } },
  { domain: "household", name: "allergy substitution", facts: { recurrencePerYear: 24, costAvoidedCents: null, consequenceOfDelay: "compounding-asset", personaFit: "named-owner-routine", assetCoverage: "owned-multiple", repeatability: "parameterised", symptomCount: 5, keywordCount: 8, authoringEffortHours: 8, localeReach: "both-locales-planned" } },
  { domain: "household", name: "fire extinguisher check", facts: { recurrencePerYear: 12, costAvoidedCents: null, consequenceOfDelay: "compounding-structural", personaFit: "named-owner-occasional", assetCoverage: "owned-multiple", repeatability: "deterministic", symptomCount: 3, keywordCount: 6, authoringEffortHours: 2, localeReach: "both-locales-planned" } },
  { domain: "household", name: "first-aid kit inventory", facts: { recurrencePerYear: 4, costAvoidedCents: null, consequenceOfDelay: "compounding-structural", personaFit: "named-owner-occasional", assetCoverage: "owned-single", repeatability: "deterministic", symptomCount: 3, keywordCount: 5, authoringEffortHours: 2, localeReach: "both-locales-planned" } },
  { domain: "workshop", name: "tool checkout log", facts: { recurrencePerYear: 24, costAvoidedCents: null, consequenceOfDelay: "degrading", personaFit: "named-owner-routine", assetCoverage: "owned-multiple", repeatability: "deterministic", symptomCount: 3, keywordCount: 5, authoringEffortHours: 2, localeReach: "en-sufficient" } },
  { domain: "workshop", name: "timber cutting + PPE", facts: { recurrencePerYear: 12, costAvoidedCents: rands(400), consequenceOfDelay: "cosmetic", personaFit: "named-owner-routine", assetCoverage: "owned-multiple", repeatability: "deterministic", symptomCount: 3, keywordCount: 6, authoringEffortHours: 4, localeReach: "both-locales-planned" } },
]

const score = (facts: KnowledgeCandidateFacts) =>
  computeKnowledgeComposite(computeKnowledgeSubScores(facts))
const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length

describe("costAvoided does not systematically under-rank trade-less work", () => {
  it("scores candidates with and without a trade equivalent within 0.5 of each other", () => {
    const withTrade = CATALOGUE.filter((c) => c.facts.costAvoidedCents !== null).map((c) =>
      score(c.facts)
    )
    const withoutTrade = CATALOGUE.filter((c) => c.facts.costAvoidedCents === null).map((c) =>
      score(c.facts)
    )

    expect(withTrade.length).toBeGreaterThan(2)
    expect(withoutTrade.length).toBeGreaterThan(2)

    // Measured at 0.09 when this was written. The original worry was that
    // household and garden work would be pushed down because no plumber
    // call-out is being avoided; at weight 3 that effect is negligible, because
    // consequenceOfDelay and recurrence carry those candidates instead.
    expect(Math.abs(mean(withTrade) - mean(withoutTrade))).toBeLessThan(0.5)
  })

  it("keeps a trade-less safety check in the top band", () => {
    // The fire-extinguisher case from §8.2 — the canonical example of work with
    // no trade equivalent that must still rank highly.
    const extinguisher = CATALOGUE.find((c) => c.name === "fire extinguisher check")!
    expect(resolvePriority(score(extinguisher.facts))).toBe("P0")
  })
})

describe("the rubric still discriminates", () => {
  it("does not collapse the whole catalogue into one band", () => {
    // 9 P0 / 4 P1 when written. The composites span only ~1.0 across every
    // realistic candidate, so the bands are doing less work than §5.3 implies.
    // This guards the floor: a change that makes everything one priority has
    // removed the point of scoring at all.
    const bands = new Set(CATALOGUE.map((c) => resolvePriority(score(c.facts))))
    expect(bands.size).toBeGreaterThan(1)
  })

  it("keeps every realistic candidate above the decline threshold", () => {
    // Nothing in the curated catalogue should score as not-worth-authoring —
    // if it did, either the entry does not belong in §7 or the bands are wrong.
    for (const candidate of CATALOGUE) {
      expect(resolvePriority(score(candidate.facts))).not.toBeNull()
    }
  })
})

describe("band floors are bounded in effect", () => {
  it("bounds how much the recurrence floor value can matter", () => {
    expect(scoreRecurrence(0.1)).toBe(RECURRENCE_FLOOR)
    // Moving the floor from 1 to 3 shifts a composite by at most
    // (3-1) * weight(3) / 16 = 0.375 — and only for sub-annual candidates.
    const maxShift = ((3 - RECURRENCE_FLOOR) * DEFAULT_KNOWLEDGE_WEIGHTS.recurrence) / 16
    expect(maxShift).toBeLessThan(0.5)
  })

  it("exercises the floor rarely — no catalogue candidate is sub-annual", () => {
    expect(CATALOGUE.filter((c) => c.facts.recurrencePerYear < 1)).toHaveLength(0)
  })
})
