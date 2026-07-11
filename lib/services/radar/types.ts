/**
 * House of Veritas - Property Deal Radar: data model
 *
 * Radar 1 (data layer). Types for a `deal_radar_listings` record: raw facts +
 * 1-10 sub-scores + provenance + status + confidence + canonicalKey + analystNote.
 * See docs/specs/property-deal-radar.md §5.
 *
 * Money is ALWAYS stored as integer cents (ZAR). Never floating-point Rand.
 * Discriminated unions (with a `kind` tag) encode the states the spec implies.
 */

// ── Provenance ───────────────────────────────────────────────────────────────

export type SourcePortal =
  | "property24"
  | "private-property"
  | "myroof"
  | "gumtree"
  | "olx"
  | "licensed-feed"

export interface Provenance {
  sourceUrl: string
  sourcePortal: SourcePortal
  /** ISO date (YYYY-MM-DD) the row was last confirmed present at the source. */
  lastSeen: string
}

// ── Honesty markers ──────────────────────────────────────────────────────────

/**
 * Confidence in the row. Never feeds the composite score (§5) — it is a badge.
 * `verified` = detail page opened + parsed this run; `feed` = list/feed only;
 * `estimate` = fully derived.
 */
export type Confidence =
  | { kind: "verified" }
  | { kind: "feed" }
  | { kind: "estimate" }

/** Buyability status (§5.3). Only `active` is presented as buyable. */
export type ListingStatus =
  | { kind: "active" }
  | { kind: "under-offer" }
  | { kind: "in-transaction" }
  | { kind: "delisted"; lastSeen: string }

// ── Property type / classification (§5.3 guardrail) ──────────────────────────

export type PropertyType = "freehold-house" | "sectional" | "new-dev-unit" | "unknown"

export interface PropertyClassification {
  propertyType: PropertyType
  /** False for sectional / new-dev units — they must not rank as flips. */
  isFlipEligible: boolean
  /** The §5.3 tells that fired, for transparency/debugging. */
  reasons: string[]
}

// ── Raw fact primitives ──────────────────────────────────────────────────────

/**
 * Asking / expected entry price. Auctions expose a range (§5.3) — store min/max,
 * score on the expected (reserve) value, never the optimistic max.
 */
export type PriceInput =
  | { kind: "fixed"; cents: number }
  | { kind: "range"; minCents: number; maxCents: number; expectedCents?: number }

export type EffortLevel = "cosmetic" | "moderate" | "major" | "severe"

export type DistressKind =
  | "none"
  | "easysell"
  | "sie-auction"
  | "pre-hammer"
  | "deceased"
  | "cash-only"

export type DistressFlag = { kind: DistressKind }

export type TransferFrictionKind = "no-transfer-duty" | "transfer-duty" | "sectional"

export type TransferFriction = { kind: TransferFrictionKind }

export interface PhysicalRisk {
  /** Dolomite / sinkhole ground — an East Rand mortgage/insurance killer. */
  dolomite: boolean
  flood: boolean
}

// ── ARV basis (§5, §7.4): prefer sold/transfer over asking comps ─────────────

export type ArvCompKind = "sold-transfer" | "asking"

export interface ArvComp {
  kind: ArvCompKind
  valueCents: number
}

export type ArvBasis =
  | { kind: "sold-transfer"; sampleSize: number }
  | { kind: "asking-comps"; sampleSize: number }
  | { kind: "none" }

/** Asking comps bias high, so they can never earn `high`. */
export type ArvConfidence = "high" | "medium" | "low"

// ── Data-quality flags (§5.3) ────────────────────────────────────────────────

export type DataQualityFlag =
  | { kind: "erf-implausible"; rawValue: number }
  | { kind: "erf-nonpositive"; rawValue: number }
  | { kind: "price-range"; minCents: number; maxCents: number }
  | { kind: "cash-only" }
  | { kind: "no-approved-plans" }
  | { kind: "status-under-offer" }
  | { kind: "status-in-transaction" }

// ── Facts, derived, sub-scores ───────────────────────────────────────────────

/** Raw, normalised facts for one opportunity — the inputs to scoring. */
export interface DealRadarFacts {
  listingId: string
  suburb: string
  price: PriceInput
  bedrooms?: number
  bathrooms?: number
  erfSizeM2: number | null
  floorSizeM2: number | null
  zoning?: string
  subdividePotential: boolean
  effort: EffortLevel
  distressFlag: DistressFlag
  suburbMedianCents: number | null
  arvEstimateCents: number | null
  renoCostEstimateCents: number | null
  monthlyRentCents: number | null
  monthlyBondCents: number | null
  holdingCostMonthlyCents: number | null
  transferFriction: TransferFriction
  /** Suburb desirability + safety index, 0-100. */
  areaQualityIndex: number | null
  /** Schools / transport / mall / hospital index, 0-100. */
  proximityIndex: number | null
  daysOnMarket: number | null
  physicalRisk: PhysicalRisk
}

/** Numbers derived from facts (money in cents, ratios unitless). */
export interface DealRadarDerived {
  buyInCents: number
  allInCents: number
  /** (ARV − buyIn − renoEst) / allIn. Null when ARV/median unknown. */
  flipPct: number | null
  /** Percentage points under (positive) / over suburb median. */
  dealScore: number | null
  /** (monthlyRent × 12) / allIn. */
  rentalYieldGross: number | null
}

/**
 * 1-10 sub-scores, one per scored §5 dimension. `confidence` is deliberately
 * absent — it is a badge, never a scored dimension.
 */
export interface SubScores {
  buyIn: number
  flipPct: number
  effort: number
  dealScore: number
  renoCost: number
  rentalYield: number
  areaQuality: number
  daysOnMarket: number
  distress: number
  landUpside: number
  holdingCost: number
  affordability: number
  transferFriction: number
  physicalRisk: number
  proximity: number
}

export type SubScoreWeights = Record<keyof SubScores, number>

// ── The full record ──────────────────────────────────────────────────────────

export interface DealRadarListing {
  facts: DealRadarFacts
  derived: DealRadarDerived
  propertyType: PropertyType
  classification: PropertyClassification
  subScores: SubScores
  /** Weighted composite (1-10). Never includes `confidence`. */
  composite: number
  arvBasis: ArvBasis
  arvConfidence: ArvConfidence
  /** Normalised match key (field only — dedupe is Radar 2). */
  canonicalKey: string
  status: ListingStatus
  confidence: Confidence
  /** Non-scoring AI prose take (§5.1); only for verified rows. */
  analystNote: string | null
  dataQualityFlags: DataQualityFlag[]
  provenance: Provenance
}

export interface RankedListing {
  listing: DealRadarListing
  composite: number
  /** 1-based rank after the confidence/status guards. */
  rank: number
  /** True when the #1 slot was reassigned by the confidence/status guard. */
  guardApplied: boolean
  /** True when this #1 row is only feed-confidence because no verified row exists. */
  provisionalTop: boolean
}
