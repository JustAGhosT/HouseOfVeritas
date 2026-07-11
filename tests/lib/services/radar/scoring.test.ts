import { describe, it, expect } from "vitest"
import {
  computeComposite,
  computeDealScore,
  computeFlipPct,
  computeRenoCostCents,
  computeRentalYieldGross,
  DEFAULT_WEIGHTS,
  rankListings,
  resolveArv,
  scoreAffordability,
  scoreAreaQuality,
  scoreBuyIn,
  scoreDaysOnMarket,
  scoreDealScore,
  scoreDistress,
  scoreEffort,
  scoreFlipPct,
  scoreHoldingCost,
  scoreLandUpside,
  scorePhysicalRisk,
  scoreProximity,
  scoreRentalYield,
  scoreRenoCost,
  scoreTransferFriction,
  type SubScoreWeights,
} from "@/lib/services/radar"
import { makeListing, uniformSubScores } from "./_fixtures"

const rands = (rand: number) => rand * 100

describe("radar scoring — per-dimension rubrics", () => {
  it("scoreBuyIn: lower price scores higher, floors at 1", () => {
    expect(scoreBuyIn(rands(450_000))).toBe(10) // boundary, inclusive
    expect(scoreBuyIn(rands(500_000))).toBe(8)
    expect(scoreBuyIn(rands(850_000))).toBe(6)
    expect(scoreBuyIn(rands(1_100_000))).toBe(4)
    expect(scoreBuyIn(rands(2_000_000))).toBe(1) // beyond the last band
  })

  it("scoreFlipPct: higher margin scores higher", () => {
    expect(scoreFlipPct(0.45)).toBe(10)
    expect(scoreFlipPct(0.2)).toBe(6) // viable-flip boundary
    expect(scoreFlipPct(0.12)).toBe(4)
    expect(scoreFlipPct(0.1)).toBe(2)
    expect(scoreFlipPct(-0.05)).toBe(1)
  })

  it("scoreEffort: cosmetic best, severe worst", () => {
    expect(scoreEffort("cosmetic")).toBe(10)
    expect(scoreEffort("moderate")).toBe(7)
    expect(scoreEffort("major")).toBe(4)
    expect(scoreEffort("severe")).toBe(2)
  })

  it("scoreDealScore: deeper under-median scores higher", () => {
    expect(scoreDealScore(25)).toBe(10)
    expect(scoreDealScore(15)).toBe(8)
    expect(scoreDealScore(0)).toBe(4) // at median
    expect(scoreDealScore(-15)).toBe(1) // over median
  })

  it("scoreRenoCost: cheaper reno scores higher", () => {
    expect(scoreRenoCost(rands(80_000))).toBe(10)
    expect(scoreRenoCost(rands(100_000))).toBe(8)
    expect(scoreRenoCost(rands(1_000_000))).toBe(1)
  })

  it("scoreRentalYield: higher yield scores higher", () => {
    expect(scoreRentalYield(0.11)).toBe(10)
    expect(scoreRentalYield(0.07)).toBe(6)
    expect(scoreRentalYield(0.01)).toBe(1)
  })

  it("scoreAreaQuality / scoreProximity: higher index scores higher", () => {
    expect(scoreAreaQuality(80)).toBe(10)
    expect(scoreAreaQuality(50)).toBe(6)
    expect(scoreProximity(10)).toBe(1)
  })

  it("scoreDaysOnMarket: stale listings score higher, floor is 2", () => {
    expect(scoreDaysOnMarket(120)).toBe(10)
    expect(scoreDaysOnMarket(40)).toBe(4)
    expect(scoreDaysOnMarket(3)).toBe(2) // fresh — floored at 2, not 1
  })

  it("scoreDistress: programmes reflect discount net of friction", () => {
    expect(scoreDistress({ kind: "pre-hammer" })).toBe(8)
    expect(scoreDistress({ kind: "easysell" })).toBe(7)
    expect(scoreDistress({ kind: "sie-auction" })).toBe(6)
    expect(scoreDistress({ kind: "none" })).toBe(5)
    expect(scoreDistress({ kind: "cash-only" })).toBe(5)
  })

  it("scoreHoldingCost / scoreAffordability: lower cost scores higher", () => {
    expect(scoreHoldingCost(rands(1_500))).toBe(10)
    expect(scoreHoldingCost(rands(20_000))).toBe(2) // floor
    expect(scoreAffordability(rands(5_000))).toBe(10)
    expect(scoreAffordability(rands(30_000))).toBe(1)
  })

  it("scoreTransferFriction: no-duty best", () => {
    expect(scoreTransferFriction({ kind: "no-transfer-duty" })).toBe(10)
    expect(scoreTransferFriction({ kind: "sectional" })).toBe(6)
    expect(scoreTransferFriction({ kind: "transfer-duty" })).toBe(4)
  })

  it("scorePhysicalRisk: dolomite penalised harder than flood", () => {
    expect(scorePhysicalRisk({ dolomite: false, flood: false })).toBe(10)
    expect(scorePhysicalRisk({ dolomite: false, flood: true })).toBe(6)
    expect(scorePhysicalRisk({ dolomite: true, flood: false })).toBe(4)
    expect(scorePhysicalRisk({ dolomite: true, flood: true })).toBe(2)
  })

  it("scoreLandUpside: bigger stand + subdivide potential scores higher", () => {
    expect(scoreLandUpside({ erfSizeM2: 1200, subdividePotential: false })).toBe(8)
    expect(scoreLandUpside({ erfSizeM2: 1200, subdividePotential: true })).toBe(10) // 8 + 2, capped
    expect(scoreLandUpside({ erfSizeM2: 800, subdividePotential: true })).toBe(7) // 5 + 2
    expect(scoreLandUpside({ erfSizeM2: null, subdividePotential: false })).toBe(3) // floor
  })
})

describe("radar scoring — derived money maths", () => {
  it("computeFlipPct: (ARV − buyIn − renoEst) / allIn", () => {
    const flip = computeFlipPct({
      arvCents: rands(1_050_000),
      buyInCents: rands(650_000),
      renoCents: rands(180_000),
    })
    // profit 220k / allIn 830k
    expect(flip).toBeCloseTo(220_000 / 830_000, 6)
  })

  it("computeFlipPct: extra acquisition costs enter the denominator", () => {
    const flip = computeFlipPct({
      arvCents: rands(1_000_000),
      buyInCents: rands(600_000),
      renoCents: rands(200_000),
      extraCostsCents: rands(50_000),
    })
    // numerator = 1_000_000 − 600_000 − 200_000 = 200_000; allIn = 850_000
    expect(flip).toBeCloseTo(200_000 / 850_000, 6)
  })

  it("computeFlipPct: null when there is no positive all-in basis", () => {
    expect(computeFlipPct({ arvCents: 0, buyInCents: 0, renoCents: 0 })).toBeNull()
  })

  it("computeDealScore: percentage points under median", () => {
    expect(computeDealScore(rands(650_000), rands(850_000))).toBeCloseTo((200 / 850) * 100, 6)
    expect(computeDealScore(rands(650_000), 0)).toBeNull()
  })

  it("computeRentalYieldGross: annualised rent over all-in", () => {
    expect(computeRentalYieldGross(rands(7_500), rands(900_000))).toBeCloseTo(
      (7_500 * 12) / 900_000,
      6
    )
    expect(computeRentalYieldGross(rands(7_500), 0)).toBeNull()
  })

  it("computeRenoCostCents: rate/m² by effort × floor size", () => {
    expect(computeRenoCostCents("cosmetic", 100)).toBe(rands(2_500) * 100)
    expect(computeRenoCostCents("severe", 100)).toBe(rands(11_000) * 100)
    expect(computeRenoCostCents("moderate", 0)).toBe(0)
  })
})

describe("radar scoring — ARV basis preference (sold > asking)", () => {
  it("prefers sold/transfer comps even when asking comps are more numerous", () => {
    const result = resolveArv([
      { kind: "asking", valueCents: rands(1_300_000) },
      { kind: "asking", valueCents: rands(1_250_000) },
      { kind: "sold-transfer", valueCents: rands(1_000_000) },
    ])
    expect(result.basis.kind).toBe("sold-transfer")
    expect(result.arvEstimateCents).toBe(rands(1_000_000)) // ignores the higher asking comps
  })

  it("sold comps reach high confidence only with a real sample", () => {
    const few = resolveArv([{ kind: "sold-transfer", valueCents: rands(1_000_000) }])
    expect(few.confidence).toBe("medium")
    const many = resolveArv([
      { kind: "sold-transfer", valueCents: rands(1_000_000) },
      { kind: "sold-transfer", valueCents: rands(1_100_000) },
      { kind: "sold-transfer", valueCents: rands(1_050_000) },
    ])
    expect(many.confidence).toBe("high")
    expect(many.basis).toEqual({ kind: "sold-transfer", sampleSize: 3 })
  })

  it("asking-only comps are capped below high confidence", () => {
    const asking = resolveArv([
      { kind: "asking", valueCents: rands(1_200_000) },
      { kind: "asking", valueCents: rands(1_300_000) },
      { kind: "asking", valueCents: rands(1_250_000) },
    ])
    expect(asking.basis.kind).toBe("asking-comps")
    expect(asking.confidence).toBe("medium") // never "high"
  })

  it("no comps → null estimate, none basis, low confidence", () => {
    const none = resolveArv([])
    expect(none.arvEstimateCents).toBeNull()
    expect(none.basis).toEqual({ kind: "none" })
    expect(none.confidence).toBe("low")
  })
})

describe("radar scoring — composite math", () => {
  it("weighted mean of uniform sub-scores equals that value", () => {
    expect(computeComposite(uniformSubScores(10))).toBe(10)
    expect(computeComposite(uniformSubScores(1))).toBe(1)
    expect(computeComposite(uniformSubScores(5))).toBeCloseTo(5, 6)
  })

  it("applies weights per Σ(wᵢ·sᵢ)/Σwᵢ", () => {
    // Only buyIn and flipPct carry weight → composite is their mean.
    const zero = Object.fromEntries(
      Object.keys(DEFAULT_WEIGHTS).map((k) => [k, 0])
    ) as SubScoreWeights
    const weights: SubScoreWeights = { ...zero, buyIn: 1, flipPct: 1 }
    const subScores = { ...uniformSubScores(1), buyIn: 10, flipPct: 6 }
    expect(computeComposite(subScores, weights)).toBe(8) // (10 + 6) / 2
  })

  it("default weights emphasise the three headline drivers", () => {
    expect(DEFAULT_WEIGHTS.effort).toBe(3)
    expect(DEFAULT_WEIGHTS.flipPct).toBe(3)
    expect(DEFAULT_WEIGHTS.buyIn).toBe(3)
    // headline drivers outweigh a supporting dimension
    expect(DEFAULT_WEIGHTS.buyIn).toBeGreaterThan(DEFAULT_WEIGHTS.proximity)
  })

  it("confidence is not a sub-score key and cannot feed the composite", () => {
    expect(Object.keys(DEFAULT_WEIGHTS)).not.toContain("confidence")
  })
})

describe("radar scoring — ranking guard (confidence can't hold #1)", () => {
  it("promotes the top verified row above a higher-composite feed row", () => {
    const feedTop = makeListing({
      listingId: "feed",
      subScores: uniformSubScores(9),
      confidence: { kind: "feed" },
    })
    const verified = makeListing({
      listingId: "verified",
      subScores: uniformSubScores(7),
      confidence: { kind: "verified" },
    })
    const ranked = rankListings([feedTop, verified])
    expect(ranked[0].listing.facts.listingId).toBe("verified")
    expect(ranked[0].guardApplied).toBe(true)
    expect(ranked[0].provisionalTop).toBe(false)
    // the feed row keeps its higher composite but is demoted out of #1
    expect(ranked[1].listing.facts.listingId).toBe("feed")
    expect(ranked[1].composite).toBeGreaterThan(ranked[0].composite)
  })

  it("leaves a verified leader untouched", () => {
    const verifiedTop = makeListing({
      listingId: "vtop",
      subScores: uniformSubScores(9),
      confidence: { kind: "verified" },
    })
    const feed = makeListing({
      listingId: "feed",
      subScores: uniformSubScores(6),
      confidence: { kind: "feed" },
    })
    const ranked = rankListings([feed, verifiedTop])
    expect(ranked[0].listing.facts.listingId).toBe("vtop")
    expect(ranked[0].guardApplied).toBe(false)
  })

  it("marks the #1 provisional when no verified row exists", () => {
    const feedA = makeListing({ listingId: "a", subScores: uniformSubScores(8), confidence: { kind: "feed" } })
    const feedB = makeListing({ listingId: "b", subScores: uniformSubScores(6), confidence: { kind: "estimate" } })
    const ranked = rankListings([feedA, feedB])
    expect(ranked[0].listing.facts.listingId).toBe("a")
    expect(ranked[0].provisionalTop).toBe(true)
    expect(ranked[0].guardApplied).toBe(false)
  })

  it("sorts non-buyable rows below buyable ones regardless of composite", () => {
    const underOffer = makeListing({
      listingId: "under-offer",
      subScores: uniformSubScores(10),
      confidence: { kind: "verified" },
      status: { kind: "under-offer" },
    })
    const active = makeListing({
      listingId: "active",
      subScores: uniformSubScores(6),
      confidence: { kind: "verified" },
      status: { kind: "active" },
    })
    const ranked = rankListings([underOffer, active])
    expect(ranked[0].listing.facts.listingId).toBe("active")
    expect(ranked[1].listing.facts.listingId).toBe("under-offer")
  })

  it("returns an empty ranking for no listings", () => {
    expect(rankListings([])).toEqual([])
  })
})
