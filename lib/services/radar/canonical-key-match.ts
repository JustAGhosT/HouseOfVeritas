/**
 * House of Veritas - Property Deal Radar: canonicalKey candidate matching (§5.2)
 *
 * Radar 2. Collapses the SAME physical house listed across portals/days into one
 * record WITHOUT silent false-merges. Portals often hide the street address
 * ("contact agent for address"), so exact address match frequently fails — hence
 * two strategies (§5.2):
 *
 *   1. address/geo present → geohash + erf-bucket exact key (reuses the Radar 1
 *      deterministic normaliser `computeCanonicalKey`). Live geocoding is deferred
 *      to ingest (Radar 3) — callers pass a pre-computed geohash.
 *   2. address hidden (common) → fuzzy composite candidate score on
 *      suburb + erfSize(±tol) + bedrooms + price-band + agentName/agency, yielding
 *      a MATCH CONFIDENCE (0-1), never a boolean.
 *
 * The output is a decision enum — `merge` / `separate` / `quarantine` — NOT a
 * silent merge. Ambiguous (near-threshold) pairs are quarantined for QA review
 * (§3.1). New-development / sectional siblings (identical-price units in one
 * complex, §5.3) must NEVER auto-merge; the property-type gate enforces that.
 *
 * Pure, deterministic. NO network, NO geocoding, NO LLM, NO DB writes. Ingest
 * wiring is Radar 3. See docs/specs/property-deal-radar.md §5.2, §5.3, §3.1 and
 * docs/specs/property-deal-radar-canonicalkey-spike.md for the false-merge study.
 */

import { computeCanonicalKey, ERF_BUCKET_M2 } from "./canonical-key"
import type { PropertyType, SourcePortal } from "./types"

// ── Match input ──────────────────────────────────────────────────────────────

/**
 * The minimal identity fields the matcher needs, projected from a listing's
 * facts + provenance + classification. Intentionally NOT the full
 * `DealRadarListing` — matching only reads identity signals. `agentName` /
 * `agency` are not on `DealRadarFacts`; ingest (Radar 3) supplies them from the
 * source page. All money is integer cents (ZAR), per the Radar 1 convention.
 */
export interface MatchCandidate {
  listingId: string
  sourcePortal: SourcePortal
  suburb: string
  erfSizeM2?: number | null
  bedrooms?: number | null
  /** Buy-in used for banding — the resolved expected/fixed price in cents. */
  priceCents: number
  /** Present only when the source exposed an address / geocode. */
  geohash?: string | null
  agentName?: string | null
  agency?: string | null
  /** From the Radar 1 classifier — gates the new-dev sibling false-merge guard. */
  propertyType?: PropertyType
}

// ── Decision + result ────────────────────────────────────────────────────────

/**
 * What ingest (Radar 3) should do with a candidate pair:
 *  - `merge`      collapse into one record with many sources (high confidence).
 *  - `quarantine` ambiguous — hold for QA exception review (§3.1); NEVER merged.
 *  - `separate`   distinct houses — keep as separate records.
 */
export type MatchDecision = "merge" | "quarantine" | "separate"

export type MatchStrategy = "geohash-exact" | "fuzzy-composite" | "none"

export interface MatchResult {
  decision: MatchDecision
  /** 0-1 match confidence. Geohash-exact is 1; fuzzy is the weighted feature sum. */
  confidence: number
  strategy: MatchStrategy
  /** The signals that fired, for transparency / QA triage / debugging. */
  reasons: string[]
}

// ── Tunable constants (see the spike doc for the false-merge study) ──────────

/** confidence ≥ this → `merge`. Chosen from the seed-set false-merge table. */
export const MERGE_THRESHOLD = 0.85
/** confidence in [QUARANTINE_THRESHOLD, MERGE_THRESHOLD) → `quarantine`. */
export const QUARANTINE_THRESHOLD = 0.6

/** erf within this many m² counts as a full erf match (matches the bucket width). */
export const ERF_MATCH_TOL_M2 = ERF_BUCKET_M2
/** erf within 2× the tolerance earns a half match; beyond that, no erf credit. */
export const ERF_NEAR_TOL_M2 = ERF_BUCKET_M2 * 2

/** Price within this relative delta of the other counts as a full price match. */
export const PRICE_EXACT_TOL = 0.02
/** Price within this relative delta earns a half match (portal price-drop lag). */
export const PRICE_NEAR_TOL = 0.08

/**
 * Fuzzy feature weights (sum = 1). The three POSITIONAL features
 * (erf + bedrooms + price) sum to 0.75 — deliberately below MERGE_THRESHOLD — so
 * that two address-hidden houses can NEVER auto-merge on position alone: an
 * identity corroborator (matching agent, or a shared geohash) is required to
 * clear 0.85. This is the core anti-false-merge property.
 */
export const FUZZY_WEIGHTS = {
  erf: 0.3,
  bedrooms: 0.2,
  price: 0.25,
  agent: 0.25,
} as const

/** A bedroom gap this large means clearly different houses — blocks `merge`. */
export const BEDROOM_HARD_DIFF = 2

// ── Normalisers ──────────────────────────────────────────────────────────────

function normaliseText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function isNonFlipType(type: PropertyType | undefined): boolean {
  return type === "sectional" || type === "new-dev-unit"
}

// ── Price banding (§5.2 "price-band") ────────────────────────────────────────

/**
 * Springs-calibrated price bands (integer index). Used to bucket candidates for
 * cheap blocking (group before scoring). Boundaries mirror the buy-in rubric so
 * "below median / above median" cohorts line up. Scoring itself uses a relative
 * delta (see `scorePrice`) so a listing straddling a boundary is not unfairly
 * split; the band index is for blocking only.
 */
export const PRICE_BAND_EDGES_CENTS: readonly number[] = [
  400_000 * 100,
  550_000 * 100,
  700_000 * 100,
  900_000 * 100,
  1_200_000 * 100,
]

export function priceBand(priceCents: number): number {
  let band = 0
  for (const edge of PRICE_BAND_EDGES_CENTS) {
    if (priceCents < edge) return band
    band += 1
  }
  return band
}

// ── Blocking key (group cheaply, then score pairwise) ────────────────────────

/**
 * Cheap candidate-group key for the address-hidden path. Extends the Radar 1
 * field normaliser (`computeCanonicalKey`) with the price band so only plausibly
 * related listings are compared pairwise. This is a BLOCKING key — collision
 * means "worth scoring", NOT "same house". Never merge on this alone.
 */
export function computeFuzzyCandidateKey(candidate: MatchCandidate): string {
  const base = computeCanonicalKey({
    suburb: candidate.suburb,
    erfSizeM2: candidate.erfSizeM2,
    bedrooms: candidate.bedrooms,
  })
  return `${base}:band${priceBand(candidate.priceCents)}`
}

// ── Feature scorers (each returns 0-1 credit for its feature) ────────────────

/** erf closeness: full within tol, half within 2× tol, else nothing. */
export function scoreErf(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null || a <= 0 || b <= 0) return 0
  const diff = Math.abs(a - b)
  if (diff <= ERF_MATCH_TOL_M2) return 1
  if (diff <= ERF_NEAR_TOL_M2) return 0.5
  return 0
}

/** bedroom match: full when equal, weak credit for a 1-bed capture wobble, else 0. */
export function scoreBedrooms(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null || a <= 0 || b <= 0) return 0
  const diff = Math.abs(a - b)
  if (diff === 0) return 1
  if (diff === 1) return 0.25
  return 0
}

/** price closeness on a relative delta (portals lag on price drops). */
export function scorePrice(aCents: number, bCents: number): number {
  const larger = Math.max(aCents, bCents)
  if (larger <= 0) return 0
  const delta = Math.abs(aCents - bCents) / larger
  if (delta <= PRICE_EXACT_TOL) return 1
  if (delta <= PRICE_NEAR_TOL) return 0.5
  return 0
}

/**
 * agent identity — the corroborator that lets a genuine cross-portal dup clear
 * the merge bar. Matches on agency OR agent name (normalised). Returns 0 when
 * neither side exposes an agent (no evidence, not a negative).
 */
export function scoreAgent(a: MatchCandidate, b: MatchCandidate): number {
  const agencyA = normaliseText(a.agency)
  const agencyB = normaliseText(b.agency)
  if (agencyA && agencyB && agencyA === agencyB) return 1
  const nameA = normaliseText(a.agentName)
  const nameB = normaliseText(b.agentName)
  if (nameA && nameB && nameA === nameB) return 1
  return 0
}

// ── Core matcher ─────────────────────────────────────────────────────────────

/**
 * Score one candidate pair and decide merge / quarantine / separate.
 *
 * Order of operations:
 *  1. Suburb gate — different suburbs can never be the same house (hard 0).
 *  2. Geohash-exact path — when both expose a geohash and the geo+erf key
 *     matches, that is a positive identity (confidence 1) → `merge`, UNLESS a
 *     side is sectional/new-dev (units share a building footprint) → `quarantine`.
 *  3. Fuzzy composite — weighted feature sum over erf + bedrooms + price + agent.
 *  4. False-merge guards cap the decision:
 *       - new-dev/sectional sibling guard (§5.3): non-flip units never auto-merge.
 *       - bedroom hard-diff guard: a ≥2-bedroom gap can never merge.
 */
export function matchCandidates(a: MatchCandidate, b: MatchCandidate): MatchResult {
  const reasons: string[] = []

  // Never compare a listing to itself on the same portal (that is within-portal
  // dedupe on listingId, handled upstream in ingest, not here).
  if (a.sourcePortal === b.sourcePortal && a.listingId === b.listingId) {
    return { decision: "merge", confidence: 1, strategy: "none", reasons: ["same-listing"] }
  }

  // 1. Suburb gate.
  if (normaliseText(a.suburb) !== normaliseText(b.suburb)) {
    return { decision: "separate", confidence: 0, strategy: "none", reasons: ["suburb-mismatch"] }
  }

  const aNonFlip = isNonFlipType(a.propertyType)
  const bNonFlip = isNonFlipType(b.propertyType)

  // 2. Geohash-exact path.
  if (a.geohash && b.geohash) {
    const keyA = computeCanonicalKey({ suburb: a.suburb, erfSizeM2: a.erfSizeM2, geohash: a.geohash })
    const keyB = computeCanonicalKey({ suburb: b.suburb, erfSizeM2: b.erfSizeM2, geohash: b.geohash })
    if (keyA === keyB) {
      // Sectional / new-dev units share a building footprint — geo alone cannot
      // tell unit 4 from unit 7. Quarantine rather than false-merge.
      if (aNonFlip || bNonFlip) {
        reasons.push("geohash-exact", "sectional-shared-footprint")
        return { decision: "quarantine", confidence: 0.7, strategy: "geohash-exact", reasons }
      }
      reasons.push("geohash-exact")
      return { decision: "merge", confidence: 1, strategy: "geohash-exact", reasons }
    }
    reasons.push("geohash-distinct")
    return { decision: "separate", confidence: 0, strategy: "geohash-exact", reasons }
  }

  // 3. Fuzzy composite.
  const erf = scoreErf(a.erfSizeM2, b.erfSizeM2)
  const beds = scoreBedrooms(a.bedrooms, b.bedrooms)
  const price = scorePrice(a.priceCents, b.priceCents)
  const agent = scoreAgent(a, b)

  const confidence =
    erf * FUZZY_WEIGHTS.erf +
    beds * FUZZY_WEIGHTS.bedrooms +
    price * FUZZY_WEIGHTS.price +
    agent * FUZZY_WEIGHTS.agent

  if (erf > 0) reasons.push(erf === 1 ? "erf-match" : "erf-near")
  if (beds > 0) reasons.push(beds === 1 ? "bedrooms-match" : "bedrooms-near")
  if (price > 0) reasons.push(price === 1 ? "price-match" : "price-near")
  if (agent > 0) reasons.push("agent-match")

  // 4a. Sibling guard (§5.3): identical-looking new-dev/sectional units are NOT
  // the same house. Both-flagged → clearly different units (separate). Exactly
  // one flagged → ambiguous type signal (quarantine). Neither → no cap.
  if (aNonFlip && bNonFlip) {
    reasons.push("new-dev-siblings")
    return { decision: "separate", confidence, strategy: "fuzzy-composite", reasons }
  }
  if (aNonFlip || bNonFlip) {
    reasons.push("mixed-new-dev-flag")
    const capped: MatchDecision = confidence >= QUARANTINE_THRESHOLD ? "quarantine" : "separate"
    return { decision: capped, confidence, strategy: "fuzzy-composite", reasons }
  }

  // 4b. Bedroom hard-diff guard: a ≥2-bedroom gap is a different house.
  if (
    a.bedrooms != null &&
    b.bedrooms != null &&
    a.bedrooms > 0 &&
    b.bedrooms > 0 &&
    Math.abs(a.bedrooms - b.bedrooms) >= BEDROOM_HARD_DIFF
  ) {
    reasons.push("bedroom-hard-diff")
    const capped: MatchDecision = confidence >= QUARANTINE_THRESHOLD ? "quarantine" : "separate"
    return { decision: capped, confidence, strategy: "fuzzy-composite", reasons }
  }

  return { decision: decideFromConfidence(confidence), confidence, strategy: "fuzzy-composite", reasons }
}

/** Map a raw fuzzy confidence to a decision via the two thresholds. */
export function decideFromConfidence(confidence: number): MatchDecision {
  if (confidence >= MERGE_THRESHOLD) return "merge"
  if (confidence >= QUARANTINE_THRESHOLD) return "quarantine"
  return "separate"
}

// ── Group-level convenience (blocking → pairwise) ────────────────────────────

export interface CandidateMatch {
  candidate: MatchCandidate
  result: MatchResult
}

/**
 * Compare `subject` against every `others` row and return only the pairs the
 * matcher would `merge` or `quarantine` (candidates), sorted by confidence.
 * Radar 3 calls this per incoming row against the existing blocking group; it
 * decides nothing on its own — every returned decision is explicit.
 */
export function findCandidateMatches(
  subject: MatchCandidate,
  others: readonly MatchCandidate[]
): CandidateMatch[] {
  const matches: CandidateMatch[] = []
  for (const candidate of others) {
    if (candidate.listingId === subject.listingId && candidate.sourcePortal === subject.sourcePortal) {
      continue
    }
    const result = matchCandidates(subject, candidate)
    if (result.decision === "merge" || result.decision === "quarantine") {
      matches.push({ candidate, result })
    }
  }
  return matches.sort((x, y) => y.result.confidence - x.result.confidence)
}
