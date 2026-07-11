import { describe, it, expect } from "vitest"
import {
  BEDROOM_HARD_DIFF,
  computeFuzzyCandidateKey,
  decideFromConfidence,
  ERF_MATCH_TOL_M2,
  ERF_NEAR_TOL_M2,
  findCandidateMatches,
  matchCandidates,
  MERGE_THRESHOLD,
  priceBand,
  QUARANTINE_THRESHOLD,
  scoreAgent,
  scoreBedrooms,
  scoreErf,
  scorePrice,
  type MatchCandidate,
} from "@/lib/services/radar"
import { labelledPairs, seedListings } from "./_radar2-fixtures"

const rands = (rand: number): number => rand * 100

/** A minimal freehold candidate with sensible defaults for focused unit tests. */
function candidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    listingId: "a",
    sourcePortal: "property24",
    suburb: "Strubenvale",
    erfSizeM2: 800,
    bedrooms: 3,
    priceCents: rands(650_000),
    geohash: null,
    agency: "RE/MAX",
    propertyType: "freehold-house",
    ...overrides,
  }
}

// ── Threshold + banding constants ────────────────────────────────────────────

describe("radar canonicalKey match — chosen thresholds (from the spike)", () => {
  it("uses the spike-recommended thresholds", () => {
    expect(MERGE_THRESHOLD).toBe(0.85)
    expect(QUARANTINE_THRESHOLD).toBe(0.6)
  })

  it("decideFromConfidence maps confidence to a decision at the boundaries", () => {
    expect(decideFromConfidence(0.85)).toBe("merge") // inclusive
    expect(decideFromConfidence(0.849)).toBe("quarantine")
    expect(decideFromConfidence(0.6)).toBe("quarantine") // inclusive
    expect(decideFromConfidence(0.599)).toBe("separate")
    expect(decideFromConfidence(0)).toBe("separate")
  })
})

// ── Feature scorers ──────────────────────────────────────────────────────────

describe("radar canonicalKey match — erf tolerance boundaries", () => {
  it("full credit within tolerance, half within near-tolerance, none beyond", () => {
    expect(scoreErf(800, 800)).toBe(1)
    expect(scoreErf(800, 800 + ERF_MATCH_TOL_M2)).toBe(1) // 50 m² — boundary, inclusive
    expect(scoreErf(800, 800 + ERF_MATCH_TOL_M2 + 1)).toBe(0.5) // 51 m² — into near band
    expect(scoreErf(800, 800 + ERF_NEAR_TOL_M2)).toBe(0.5) // 100 m² — boundary, inclusive
    expect(scoreErf(800, 800 + ERF_NEAR_TOL_M2 + 1)).toBe(0) // 101 m² — beyond
  })

  it("gives no credit when either erf is missing or non-positive", () => {
    expect(scoreErf(null, 800)).toBe(0)
    expect(scoreErf(800, undefined)).toBe(0)
    expect(scoreErf(0, 800)).toBe(0)
    expect(scoreErf(-5, 800)).toBe(0)
  })
})

describe("radar canonicalKey match — bedroom scoring", () => {
  it("full for equal, weak for a 1-bed wobble, none for a wider gap", () => {
    expect(scoreBedrooms(3, 3)).toBe(1)
    expect(scoreBedrooms(3, 4)).toBe(0.25)
    expect(scoreBedrooms(3, 5)).toBe(0)
    expect(scoreBedrooms(null, 3)).toBe(0)
  })
})

describe("radar canonicalKey match — price closeness", () => {
  it("full within 2%, half within 8%, none beyond", () => {
    expect(scorePrice(rands(650_000), rands(650_000))).toBe(1)
    expect(scorePrice(rands(650_000), rands(637_000))).toBe(1) // 2.0% — boundary
    expect(scorePrice(rands(650_000), rands(620_000))).toBe(0.5) // ~4.6% — near
    expect(scorePrice(rands(650_000), rands(598_000))).toBe(0.5) // 8.0% — boundary
    expect(scorePrice(rands(650_000), rands(560_000))).toBe(0) // ~13.8% — beyond
  })
})

describe("radar canonicalKey match — agent identity", () => {
  it("matches on agency or agent name, ignores casing/punctuation", () => {
    expect(scoreAgent(candidate({ agency: "RE/MAX" }), candidate({ agency: "re-max" }))).toBe(1)
    expect(
      scoreAgent(
        candidate({ agency: null, agentName: "Jan Smit" }),
        candidate({ agency: null, agentName: "jan  smit" })
      )
    ).toBe(1)
  })

  it("returns 0 when either side hides the agent (no evidence, not a negative)", () => {
    expect(scoreAgent(candidate({ agency: null, agentName: null }), candidate())).toBe(0)
    expect(scoreAgent(candidate({ agency: "Seeff" }), candidate({ agency: "RE/MAX" }))).toBe(0)
  })
})

// ── Price banding ────────────────────────────────────────────────────────────

describe("radar canonicalKey match — price-band bucketing", () => {
  it("buckets by the Springs-calibrated edges, boundaries land in the upper band", () => {
    expect(priceBand(rands(399_000))).toBe(0)
    expect(priceBand(rands(400_000))).toBe(1) // edge → next band
    expect(priceBand(rands(549_000))).toBe(1)
    expect(priceBand(rands(550_000))).toBe(2)
    expect(priceBand(rands(700_000))).toBe(3)
    expect(priceBand(rands(900_000))).toBe(4)
    expect(priceBand(rands(1_200_000))).toBe(5)
    expect(priceBand(rands(3_000_000))).toBe(5)
  })
})

// ── Blocking key ─────────────────────────────────────────────────────────────

describe("radar canonicalKey match — fuzzy candidate (blocking) key", () => {
  it("extends the Radar 1 field key with the price band", () => {
    expect(
      computeFuzzyCandidateKey(candidate({ suburb: "Selection Park", erfSizeM2: 812, bedrooms: 3, priceCents: rands(720_000) }))
    ).toBe("sub:selection-park:erf800:bed3:band3")
  })

  it("collides for capture jitter inside the same erf + price band", () => {
    const a = computeFuzzyCandidateKey(candidate({ erfSizeM2: 798, priceCents: rands(650_000) }))
    const b = computeFuzzyCandidateKey(candidate({ erfSizeM2: 823, priceCents: rands(690_000) }))
    expect(a).toBe(b) // both → erf800, band3
  })
})

// ── Geohash-exact path ───────────────────────────────────────────────────────

describe("radar canonicalKey match — geohash-exact path", () => {
  it("merges two freehold rows that share a geohash + erf bucket", () => {
    const a = candidate({ geohash: "ke7f8xq", erfSizeM2: 1420 })
    const b = candidate({ listingId: "b", sourcePortal: "private-property", geohash: "ke7f8xq", erfSizeM2: 1405 })
    const r = matchCandidates(a, b)
    expect(r.strategy).toBe("geohash-exact")
    expect(r.decision).toBe("merge")
    expect(r.confidence).toBe(1)
  })

  it("quarantines (never merges) when a side is sectional — units share a footprint", () => {
    const a = candidate({ geohash: "ke7g10p", erfSizeM2: 62, propertyType: "sectional" })
    const b = candidate({ listingId: "b", sourcePortal: "private-property", geohash: "ke7g10p", erfSizeM2: 62, propertyType: "sectional" })
    const r = matchCandidates(a, b)
    expect(r.decision).toBe("quarantine")
    expect(r.reasons).toContain("sectional-shared-footprint")
  })

  it("separates when geohashes resolve to distinct keys", () => {
    const a = candidate({ geohash: "ke7f8xq" })
    const b = candidate({ listingId: "b", sourcePortal: "private-property", geohash: "ke7f8zz" })
    const r = matchCandidates(a, b)
    expect(r.decision).toBe("separate")
    expect(r.confidence).toBe(0)
  })
})

// ── Suburb gate ──────────────────────────────────────────────────────────────

describe("radar canonicalKey match — suburb gate", () => {
  it("never matches across different suburbs, whatever else aligns", () => {
    const a = candidate({ suburb: "Geduld" })
    const b = candidate({ listingId: "b", sourcePortal: "private-property", suburb: "Strubenvale" })
    const r = matchCandidates(a, b)
    expect(r.decision).toBe("separate")
    expect(r.reasons).toContain("suburb-mismatch")
  })
})

// ── Fuzzy composite + decisions ──────────────────────────────────────────────

describe("radar canonicalKey match — fuzzy composite decisions", () => {
  it("merges a genuine cross-portal dup when agent corroborates position", () => {
    const a = candidate()
    const b = candidate({ listingId: "b", sourcePortal: "private-property", erfSizeM2: 810 })
    const r = matchCandidates(a, b)
    expect(r.strategy).toBe("fuzzy-composite")
    expect(r.confidence).toBeCloseTo(1, 5)
    expect(r.decision).toBe("merge")
  })

  it("quarantines a positional-only match (address AND agent hidden) — never silently merges", () => {
    const a = candidate({ agency: null, agentName: null })
    const b = candidate({ listingId: "b", sourcePortal: "private-property", agency: null, agentName: null, erfSizeM2: 815 })
    const r = matchCandidates(a, b)
    expect(r.confidence).toBeCloseTo(0.75, 5) // erf + beds + price, no corroborator
    expect(r.decision).toBe("quarantine")
  })

  it("separates when only position weakly aligns", () => {
    const a = candidate({ agency: null, priceCents: rands(650_000), bedrooms: 2 })
    const b = candidate({ listingId: "b", sourcePortal: "myroof", agency: null, priceCents: rands(430_000), bedrooms: 3, erfSizeM2: 650 })
    const r = matchCandidates(a, b)
    expect(r.decision).toBe("separate")
  })
})

// ── False-merge guards ───────────────────────────────────────────────────────

describe("radar canonicalKey match — false-merge guards", () => {
  it("new-dev siblings NEVER merge, even at confidence 1.0 (§5.3)", () => {
    const a = candidate({ suburb: "Selcourt", erfSizeM2: 56, bedrooms: 2, priceCents: rands(899_000), agency: "Estate Dev", propertyType: "new-dev-unit" })
    const b = candidate({ listingId: "b", sourcePortal: "private-property", suburb: "Selcourt", erfSizeM2: 56, bedrooms: 2, priceCents: rands(899_000), agency: "Estate Dev", propertyType: "new-dev-unit" })
    const r = matchCandidates(a, b)
    expect(r.confidence).toBeCloseTo(1, 5) // fuzzy features scream "same"
    expect(r.decision).toBe("separate") // …but the sibling guard overrides
    expect(r.reasons).toContain("new-dev-siblings")
  })

  it("a single new-dev flag makes the pair ambiguous → quarantine, not merge", () => {
    const a = candidate({ propertyType: "freehold-house" })
    const b = candidate({ listingId: "b", sourcePortal: "private-property", propertyType: "new-dev-unit", erfSizeM2: 805 })
    const r = matchCandidates(a, b)
    expect(r.decision).toBe("quarantine")
    expect(r.reasons).toContain("mixed-new-dev-flag")
  })

  it("a bedroom gap of BEDROOM_HARD_DIFF+ can never merge", () => {
    const a = candidate({ bedrooms: 2 })
    const b = candidate({ listingId: "b", sourcePortal: "private-property", bedrooms: 2 + BEDROOM_HARD_DIFF, erfSizeM2: 805 })
    const r = matchCandidates(a, b)
    expect(r.decision).not.toBe("merge")
    expect(r.reasons).toContain("bedroom-hard-diff")
  })
})

// ── Group convenience ────────────────────────────────────────────────────────

describe("radar canonicalKey match — findCandidateMatches", () => {
  it("returns merge/quarantine candidates only, sorted by confidence desc", () => {
    const subject = candidate({ listingId: "subj", suburb: "Strubenvale", erfSizeM2: 800, bedrooms: 3, priceCents: rands(650_000), agency: "RE/MAX" })
    const strongDup = candidate({ listingId: "dup", sourcePortal: "private-property", erfSizeM2: 805, agency: "RE/MAX" })
    const weak = candidate({ listingId: "weak", sourcePortal: "myroof", agency: null, agentName: null, erfSizeM2: 815 })
    const unrelated = candidate({ listingId: "other", sourcePortal: "myroof", suburb: "Geduld" })

    const matches = findCandidateMatches(subject, [strongDup, weak, unrelated])
    expect(matches.map((m) => m.candidate.listingId)).toEqual(["dup", "weak"]) // unrelated dropped, sorted
    expect(matches[0].result.decision).toBe("merge")
    expect(matches[1].result.decision).toBe("quarantine")
  })

  it("skips the subject's own row (same portal + listingId)", () => {
    const subject = candidate({ listingId: "self", sourcePortal: "property24" })
    const matches = findCandidateMatches(subject, [subject])
    expect(matches).toEqual([])
  })
})

// ── Seed-set spike guarantees (Springs, Appendix A) ──────────────────────────

describe("radar canonicalKey match — Springs seed-set guarantees", () => {
  it("no two DISTINCT seed listings ever auto-merge", () => {
    for (let i = 0; i < seedListings.length; i++) {
      for (let j = i + 1; j < seedListings.length; j++) {
        const r = matchCandidates(seedListings[i], seedListings[j])
        expect(r.decision, `${seedListings[i].listingId} vs ${seedListings[j].listingId}`).not.toBe("merge")
      }
    }
  })

  it("at the recommended threshold, every labelled same-house pair merges or quarantines — never separates by mistake, and no different-house pair merges except the documented irreducible case", () => {
    for (const pair of labelledPairs) {
      const r = matchCandidates(pair.a, pair.b)
      if (pair.sameHouse) {
        // Same house must not be wrongly split apart.
        expect(["merge", "quarantine"], pair.id).toContain(r.decision)
      } else if (pair.id === "N6") {
        // The irreducible same-agency/identical-fields case — only geo (Radar 3) fixes it.
        expect(r.decision).toBe("merge")
      } else {
        expect(r.decision, pair.id).not.toBe("merge")
      }
    }
  })

  it("new-dev siblings in the seed pairs are held apart", () => {
    const n1 = labelledPairs.find((p) => p.id === "N1")!
    expect(matchCandidates(n1.a, n1.b).decision).toBe("separate")
  })
})
