/**
 * House of Veritas - Property Deal Radar: scoring engine (§5)
 *
 * Deterministic, pure functions. NO LLM, NO network. Each §5 dimension maps to a
 * 1-10 sub-score via a documented rubric (see rubrics.ts). Composite is the
 * weighted mean of the sub-scores; `confidence` NEVER feeds it.
 */

import { isBuyable, normaliseErf, resolveBuyInCents } from "./data-quality"
import {
  AFFORDABILITY_BANDS,
  AREA_QUALITY_BANDS,
  BUY_IN_BANDS,
  DAYS_ON_MARKET_BANDS,
  DEAL_SCORE_BANDS,
  DEFAULT_WEIGHTS,
  DISTRESS_SUBSCORES,
  EFFORT_SUBSCORES,
  FLIP_PCT_BANDS,
  FLIP_PCT_UNKNOWN_SUBSCORE,
  HOLDING_COST_BANDS,
  LAND_ERF_BANDS,
  LAND_ERF_FLOOR,
  NEUTRAL_SUBSCORE,
  PROXIMITY_BANDS,
  RENO_COST_BANDS,
  RENO_RATE_CENTS_PER_M2,
  RENTAL_YIELD_BANDS,
  SUBDIVIDE_BONUS,
  TRANSFER_FRICTION_SUBSCORES,
  type ScoreBand,
} from "./rubrics"
import type {
  ArvBasis,
  ArvComp,
  ArvConfidence,
  DealRadarDerived,
  DealRadarFacts,
  DealRadarListing,
  DistressFlag,
  EffortLevel,
  PhysicalRisk,
  RankedListing,
  SubScores,
  SubScoreWeights,
  TransferFriction,
} from "./types"

// ── Generic band scorers ─────────────────────────────────────────────────────

/** Lower raw value = better. Bands are ascending; first threshold >= value wins. */
export function scoreLowerIsBetter(value: number, bands: readonly ScoreBand[], floor = 1): number {
  for (const band of bands) {
    if (value <= band.threshold) return band.score
  }
  return floor
}

/** Higher raw value = better. Bands are descending; first threshold <= value wins. */
export function scoreHigherIsBetter(value: number, bands: readonly ScoreBand[], floor = 1): number {
  for (const band of bands) {
    if (value >= band.threshold) return band.score
  }
  return floor
}

// ── Per-dimension sub-scores ─────────────────────────────────────────────────

export const scoreBuyIn = (buyInCents: number): number => scoreLowerIsBetter(buyInCents, BUY_IN_BANDS)
export const scoreFlipPct = (flipPct: number): number => scoreHigherIsBetter(flipPct, FLIP_PCT_BANDS)
export const scoreEffort = (effort: EffortLevel): number => EFFORT_SUBSCORES[effort]
export const scoreDealScore = (dealScore: number): number => scoreHigherIsBetter(dealScore, DEAL_SCORE_BANDS)
export const scoreRenoCost = (renoCents: number): number => scoreLowerIsBetter(renoCents, RENO_COST_BANDS)
export const scoreRentalYield = (yieldGross: number): number => scoreHigherIsBetter(yieldGross, RENTAL_YIELD_BANDS)
export const scoreAreaQuality = (index: number): number => scoreHigherIsBetter(index, AREA_QUALITY_BANDS)
export const scoreDaysOnMarket = (days: number): number => scoreHigherIsBetter(days, DAYS_ON_MARKET_BANDS, 2)
export const scoreDistress = (flag: DistressFlag): number => DISTRESS_SUBSCORES[flag.kind]
export const scoreHoldingCost = (monthlyCents: number): number => scoreLowerIsBetter(monthlyCents, HOLDING_COST_BANDS, 2)
export const scoreAffordability = (monthlyBondCents: number): number => scoreLowerIsBetter(monthlyBondCents, AFFORDABILITY_BANDS)
export const scoreTransferFriction = (tf: TransferFriction): number => TRANSFER_FRICTION_SUBSCORES[tf.kind]
export const scoreProximity = (index: number): number => scoreHigherIsBetter(index, PROXIMITY_BANDS)

/** Dolomite is an East Rand mortgage/insurance killer; flood is serious but lesser. */
export function scorePhysicalRisk(risk: PhysicalRisk): number {
  if (risk.dolomite && risk.flood) return 2
  if (risk.dolomite) return 4
  if (risk.flood) return 6
  return 10
}

/** Bigger stand + subdivide potential = non-cosmetic upside (the "2-for-1"). */
export function scoreLandUpside(input: {
  erfSizeM2: number | null
  subdividePotential: boolean
}): number {
  const base = scoreHigherIsBetter(input.erfSizeM2 ?? 0, LAND_ERF_BANDS, LAND_ERF_FLOOR)
  const bonus = input.subdividePotential ? SUBDIVIDE_BONUS : 0
  return Math.min(10, base + bonus)
}

// ── Derived money/ratio maths ────────────────────────────────────────────────

/**
 * flipPct = (ARV − buyIn − renoEst) / allIn (§5). allIn includes optional extra
 * acquisition costs (transfer duty, holding) which default to 0 so the core
 * formula is exact. Returns null when there is no positive all-in basis.
 */
export function computeFlipPct(input: {
  arvCents: number
  buyInCents: number
  renoCents: number
  extraCostsCents?: number
}): number | null {
  const { arvCents, buyInCents, renoCents, extraCostsCents = 0 } = input
  const allIn = buyInCents + renoCents + extraCostsCents
  if (allIn <= 0) return null
  return (arvCents - buyInCents - renoCents) / allIn
}

/** Percentage points under (positive) / over suburb median. */
export function computeDealScore(buyInCents: number, suburbMedianCents: number): number | null {
  if (suburbMedianCents <= 0) return null
  return ((suburbMedianCents - buyInCents) / suburbMedianCents) * 100
}

/** Gross annual rental yield = (monthlyRent × 12) / allIn. */
export function computeRentalYieldGross(monthlyRentCents: number, allInCents: number): number | null {
  if (allInCents <= 0) return null
  return (monthlyRentCents * 12) / allInCents
}

/** renoCostEstimate = R/m² (by effort) × floor size. */
export function computeRenoCostCents(effort: EffortLevel, floorSizeM2: number): number {
  return Math.round(RENO_RATE_CENTS_PER_M2[effort] * Math.max(0, floorSizeM2))
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

/**
 * ARV basis (§5): PREFER sold/transfer comps over asking comps, because asking
 * comps bias high and inflate flip %. Sold comps can reach `high` confidence;
 * asking comps are capped at `medium`. Records the basis + sample size.
 */
export function resolveArv(comps: readonly ArvComp[]): {
  arvEstimateCents: number | null
  basis: ArvBasis
  confidence: ArvConfidence
} {
  const sold = comps.filter((c) => c.kind === "sold-transfer").map((c) => c.valueCents)
  if (sold.length > 0) {
    return {
      arvEstimateCents: median(sold),
      basis: { kind: "sold-transfer", sampleSize: sold.length },
      confidence: sold.length >= 3 ? "high" : "medium",
    }
  }
  const asking = comps.filter((c) => c.kind === "asking").map((c) => c.valueCents)
  if (asking.length > 0) {
    return {
      arvEstimateCents: median(asking),
      basis: { kind: "asking-comps", sampleSize: asking.length },
      confidence: asking.length >= 3 ? "medium" : "low",
    }
  }
  return { arvEstimateCents: null, basis: { kind: "none" }, confidence: "low" }
}

// ── Facts → derived → sub-scores ─────────────────────────────────────────────

export function computeDerived(facts: DealRadarFacts): DealRadarDerived {
  const buyInCents = resolveBuyInCents(facts.price)
  const renoCents = facts.renoCostEstimateCents ?? 0
  const allInCents = buyInCents + renoCents
  const flipPct =
    facts.arvEstimateCents != null
      ? computeFlipPct({ arvCents: facts.arvEstimateCents, buyInCents, renoCents })
      : null
  const dealScore =
    facts.suburbMedianCents != null ? computeDealScore(buyInCents, facts.suburbMedianCents) : null
  const rentalYieldGross =
    facts.monthlyRentCents != null ? computeRentalYieldGross(facts.monthlyRentCents, allInCents) : null
  return { buyInCents, allInCents, flipPct, dealScore, rentalYieldGross }
}

/**
 * Assemble all 1-10 sub-scores from facts. Missing raw facts fall back to a
 * documented neutral (5), except flipPct which is mildly penalised (3) when ARV
 * is unknown. `confidence` is never scored here.
 */
export function computeSubScores(
  facts: DealRadarFacts,
  derived: DealRadarDerived = computeDerived(facts)
): SubScores {
  const erf = normaliseErf(facts.erfSizeM2).value
  return {
    buyIn: scoreBuyIn(derived.buyInCents),
    flipPct: derived.flipPct == null ? FLIP_PCT_UNKNOWN_SUBSCORE : scoreFlipPct(derived.flipPct),
    effort: scoreEffort(facts.effort),
    dealScore: derived.dealScore == null ? NEUTRAL_SUBSCORE : scoreDealScore(derived.dealScore),
    renoCost: facts.renoCostEstimateCents == null ? NEUTRAL_SUBSCORE : scoreRenoCost(facts.renoCostEstimateCents),
    rentalYield: derived.rentalYieldGross == null ? NEUTRAL_SUBSCORE : scoreRentalYield(derived.rentalYieldGross),
    areaQuality: facts.areaQualityIndex == null ? NEUTRAL_SUBSCORE : scoreAreaQuality(facts.areaQualityIndex),
    daysOnMarket: facts.daysOnMarket == null ? NEUTRAL_SUBSCORE : scoreDaysOnMarket(facts.daysOnMarket),
    distress: scoreDistress(facts.distressFlag),
    landUpside: scoreLandUpside({ erfSizeM2: erf, subdividePotential: facts.subdividePotential }),
    holdingCost: facts.holdingCostMonthlyCents == null ? NEUTRAL_SUBSCORE : scoreHoldingCost(facts.holdingCostMonthlyCents),
    affordability: facts.monthlyBondCents == null ? NEUTRAL_SUBSCORE : scoreAffordability(facts.monthlyBondCents),
    transferFriction: scoreTransferFriction(facts.transferFriction),
    physicalRisk: scorePhysicalRisk(facts.physicalRisk),
    proximity: facts.proximityIndex == null ? NEUTRAL_SUBSCORE : scoreProximity(facts.proximityIndex),
  }
}

// ── Composite ────────────────────────────────────────────────────────────────

/** Composite = Σ(weightᵢ · subScoreᵢ) / Σweightᵢ. `confidence` is never included. */
export function computeComposite(
  subScores: SubScores,
  weights: SubScoreWeights = DEFAULT_WEIGHTS
): number {
  let weighted = 0
  let total = 0
  for (const key of Object.keys(weights) as (keyof SubScores)[]) {
    const w = weights[key]
    weighted += w * subScores[key]
    total += w
  }
  return total === 0 ? 0 : weighted / total
}

// ── Ranking with the confidence/status guards ────────────────────────────────

/** A row may hold the #1 slot only if it is buyable AND verified (§5). */
function eligibleForTop(listing: DealRadarListing): boolean {
  return isBuyable(listing.status) && listing.confidence.kind === "verified"
}

/**
 * Rank listings by composite, then enforce the trust guards from §5:
 *  - Non-buyable rows (Under Offer / In Transaction) sort below all buyable rows.
 *  - A feed-only (unverified) row cannot HOLD the #1 slot: if the natural leader
 *    is not verified+buyable, the highest-composite verified+buyable row is
 *    promoted to #1 (`guardApplied`). If no verified row exists at all, the #1
 *    row stays but is marked `provisionalTop`.
 */
export function rankListings(
  listings: readonly DealRadarListing[],
  weights: SubScoreWeights = DEFAULT_WEIGHTS
): RankedListing[] {
  const scored = listings.map((listing) => ({
    listing,
    composite: computeComposite(listing.subScores, weights),
  }))

  scored.sort((a, b) => {
    const aBuyable = isBuyable(a.listing.status) ? 0 : 1
    const bBuyable = isBuyable(b.listing.status) ? 0 : 1
    if (aBuyable !== bBuyable) return aBuyable - bBuyable
    return b.composite - a.composite
  })

  let guardApplied = false
  if (scored.length > 0 && !eligibleForTop(scored[0].listing)) {
    const promoteIdx = scored.findIndex((s) => eligibleForTop(s.listing))
    if (promoteIdx > 0) {
      const [top] = scored.splice(promoteIdx, 1)
      scored.unshift(top)
      guardApplied = true
    }
  }

  return scored.map((entry, index) => ({
    listing: entry.listing,
    composite: entry.composite,
    rank: index + 1,
    guardApplied: index === 0 ? guardApplied : false,
    provisionalTop: index === 0 ? !eligibleForTop(entry.listing) : false,
  }))
}
