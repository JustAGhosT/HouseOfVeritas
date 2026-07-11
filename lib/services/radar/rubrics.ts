/**
 * House of Veritas - Property Deal Radar: scoring rubrics
 *
 * Rubric thresholds live here as DATA (not hardcoded inline in a UI, per §5).
 * Every threshold carries a "why" comment. All money thresholds are in integer
 * cents (ZAR); helper `rands()` keeps them readable.
 *
 * Band tables are consumed by the generic scorers in `scoring.ts`:
 *  - "lower-is-better" tables are ordered by ASCENDING threshold; the first band
 *    whose threshold is >= the value wins.
 *  - "higher-is-better" tables are ordered by DESCENDING threshold; the first band
 *    whose threshold is <= the value wins.
 */

import type {
  DistressKind,
  EffortLevel,
  SubScoreWeights,
  TransferFrictionKind,
} from "./types"

/** Rand → integer cents. */
export const rands = (rand: number): number => Math.round(rand * 100)

export interface ScoreBand {
  threshold: number
  score: number
}

// ── Core drivers ─────────────────────────────────────────────────────────────

/**
 * buyIn — lower entry = more flip headroom AND a wider buyer pool on resale.
 * Springs resale median sits ~R700k–R900k, so sub-R450k is exceptional entry.
 */
export const BUY_IN_BANDS: readonly ScoreBand[] = [
  { threshold: rands(450_000), score: 10 }, // rock-bottom entry, max margin
  { threshold: rands(650_000), score: 8 }, // below median, strong
  { threshold: rands(850_000), score: 6 }, // ~median
  { threshold: rands(1_100_000), score: 4 }, // above median / transfer-duty line
  { threshold: rands(1_500_000), score: 2 }, // pricey for a Springs flip
]

/**
 * flipPct — 20% is the conventional minimum viable flip margin; below ~12% the
 * transfer/holding/agent costs eat the profit. Stored as a ratio (0.20 = 20%).
 */
export const FLIP_PCT_BANDS: readonly ScoreBand[] = [
  { threshold: 0.4, score: 10 }, // exceptional
  { threshold: 0.3, score: 8 }, // very strong
  { threshold: 0.2, score: 6 }, // viable flip floor
  { threshold: 0.12, score: 4 }, // thin
  { threshold: 0.05, score: 2 }, // marginal
]

/**
 * effort — cosmetic TLC flips fastest with least capital; "severe" covers gutting
 * or regularising unpermitted work, which drags timeline, capital and risk.
 */
export const EFFORT_SUBSCORES: Record<EffortLevel, number> = {
  cosmetic: 10, // paint / floors / fittings
  moderate: 7, // kitchen + bath refit
  major: 4, // structural, roof, rewire
  severe: 2, // gut + regularise
}

// ── Added dimensions ─────────────────────────────────────────────────────────

/**
 * dealScore — percentage points under suburb median. >=15% under is the alert
 * threshold named in §8; 25%+ is a genuine outlier (the flip engine).
 */
export const DEAL_SCORE_BANDS: readonly ScoreBand[] = [
  { threshold: 25, score: 10 }, // deep discount
  { threshold: 15, score: 8 }, // alert-worthy under-median
  { threshold: 8, score: 6 }, // modest discount
  { threshold: 0, score: 4 }, // at median
  { threshold: -10, score: 2 }, // slightly over median
]

/** renoCost (cents) — lower spend = more of the margin survives. */
export const RENO_COST_BANDS: readonly ScoreBand[] = [
  { threshold: rands(80_000), score: 10 },
  { threshold: rands(150_000), score: 8 },
  { threshold: rands(300_000), score: 6 },
  { threshold: rands(500_000), score: 4 },
  { threshold: rands(800_000), score: 2 },
]

/**
 * renoCostEstimate is derived from effort × floor size. Rates are R/m² of floor,
 * stored in cents. Cosmetic ≈ finishes only; severe ≈ gut + regularise.
 */
export const RENO_RATE_CENTS_PER_M2: Record<EffortLevel, number> = {
  cosmetic: rands(2_500), // R2 500/m² — paint, floors, fittings
  moderate: rands(4_500), // R4 500/m² — kitchen/bath refit
  major: rands(7_500), // R7 500/m² — structural, roof, rewire
  severe: rands(11_000), // R11 000/m² — gut + regularise unpermitted work
}

/** rentalYieldGross (ratio) — SA gross residential yields run ~6–11%. */
export const RENTAL_YIELD_BANDS: readonly ScoreBand[] = [
  { threshold: 0.11, score: 10 },
  { threshold: 0.09, score: 8 },
  { threshold: 0.07, score: 6 },
  { threshold: 0.05, score: 4 },
  { threshold: 0.03, score: 2 },
]

/** areaQuality (0-100 desirability + safety index) — resale liquidity + risk. */
export const AREA_QUALITY_BANDS: readonly ScoreBand[] = [
  { threshold: 80, score: 10 },
  { threshold: 65, score: 8 },
  { threshold: 50, score: 6 },
  { threshold: 35, score: 4 },
  { threshold: 20, score: 2 },
]

/**
 * daysOnMarket — a HIGHER value is better for the BUYER: a stale listing signals
 * a motivated seller and negotiating leverage / likely price cut. A fresh listing
 * floors at 2 (not 1): a genuine deal can also be new to market.
 */
export const DAYS_ON_MARKET_BANDS: readonly ScoreBand[] = [
  { threshold: 120, score: 10 }, // very stale — strong leverage
  { threshold: 90, score: 8 },
  { threshold: 60, score: 6 },
  { threshold: 30, score: 4 },
  { threshold: 14, score: 3 },
]

/**
 * distress — each programme is a discount opportunity net of execution friction.
 * `none` is neutral (5): no distress discount, but no distress risk either.
 */
export const DISTRESS_SUBSCORES: Record<DistressKind, number> = {
  none: 5, // neutral
  "pre-hammer": 8, // pre-auction discount, less friction than a live auction
  easysell: 7, // bank discount but occupied / make-an-offer friction
  deceased: 7, // motivated estate, but executor/estate delays
  "sie-auction": 6, // deep discount but cash / voetstoots / occupied risk
  "cash-only": 5, // discount possible but a tiny buyer pool caps upside
}

/**
 * transferFriction — SA transfer-duty exemption sits under ~R1.1m; avoiding duty
 * saves a real once-off cost. Sectional avoids duty but carries complex friction.
 */
export const TRANSFER_FRICTION_SUBSCORES: Record<TransferFrictionKind, number> = {
  "no-transfer-duty": 10,
  sectional: 6,
  "transfer-duty": 4,
}

/**
 * landUpside — bigger stand + subdivide potential = non-cosmetic upside (the
 * Geduld "2-for-1"). Base on erf size; add a bonus for subdivide potential.
 */
export const LAND_ERF_BANDS: readonly ScoreBand[] = [
  { threshold: 1200, score: 8 }, // large stand, room for a 2nd dwelling
  { threshold: 900, score: 6 },
  { threshold: 600, score: 5 },
  { threshold: 300, score: 4 },
]
export const LAND_ERF_FLOOR = 3
/** Added to the erf base when the stand can be subdivided / carry a 2nd dwelling. */
export const SUBDIVIDE_BONUS = 2

/** holdingCost (monthly cents) — rates + levies are the carry cost during reno. */
export const HOLDING_COST_BANDS: readonly ScoreBand[] = [
  { threshold: rands(1_500), score: 10 },
  { threshold: rands(3_000), score: 8 },
  { threshold: rands(5_000), score: 6 },
  { threshold: rands(8_000), score: 4 },
]

/** affordability (monthly bond cents) — lower repayment = reachable by more buyers. */
export const AFFORDABILITY_BANDS: readonly ScoreBand[] = [
  { threshold: rands(5_000), score: 10 },
  { threshold: rands(8_000), score: 8 },
  { threshold: rands(12_000), score: 6 },
  { threshold: rands(18_000), score: 4 },
  { threshold: rands(25_000), score: 2 },
]

/** proximity (0-100 schools/transport/mall/hospital index) — desirability + rentability. */
export const PROXIMITY_BANDS: readonly ScoreBand[] = [
  { threshold: 80, score: 10 },
  { threshold: 65, score: 8 },
  { threshold: 50, score: 6 },
  { threshold: 35, score: 4 },
  { threshold: 20, score: 2 },
]

// ── Composite weights ────────────────────────────────────────────────────────

/**
 * Default weights. The three named drivers (effort / flipPct / buyIn) carry the
 * heaviest weight (§5); the rest are supporting signals. Users re-weight live in
 * the UI (Radar frontend), so these are only defaults.
 */
export const DEFAULT_WEIGHTS: SubScoreWeights = {
  effort: 3,
  flipPct: 3,
  buyIn: 3,
  dealScore: 2,
  areaQuality: 2,
  renoCost: 1,
  rentalYield: 1,
  daysOnMarket: 1,
  distress: 1,
  landUpside: 1,
  holdingCost: 1,
  affordability: 1,
  transferFriction: 1,
  physicalRisk: 1,
  proximity: 1,
}

/** Neutral fallback for a dimension whose raw fact is missing. */
export const NEUTRAL_SUBSCORE = 5

/**
 * flipPct fallback when ARV is unknown: mildly penalised (3, not neutral 5) — an
 * unknown flip margin should not read as an average one.
 */
export const FLIP_PCT_UNKNOWN_SUBSCORE = 3

/** Residential stands above this (m²) are almost always a capture error (§5.3). */
export const MAX_PLAUSIBLE_ERF_M2 = 4000
