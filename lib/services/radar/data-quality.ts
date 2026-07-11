/**
 * House of Veritas - Property Deal Radar: data-quality normalisation (§5.3)
 *
 * Pure functions that clean the "real dirt" seen in the research session:
 * nonsense erf values, auction price ranges, cash-only / no-plans risk, and
 * non-buyable ("Under Offer" / "In Transaction") status. No network, no LLM.
 */

import { MAX_PLAUSIBLE_ERF_M2 } from "./rubrics"
import type {
  DataQualityFlag,
  EffortLevel,
  ListingStatus,
  PriceInput,
} from "./types"

const EFFORT_ORDER: readonly EffortLevel[] = ["cosmetic", "moderate", "major", "severe"]

/**
 * Clamp/flag nonsense erf. Non-positive or implausibly large stands (e.g. the
 * 100 000 m² / 16 777 m² "flats" seen this session) are dropped to null and
 * flagged rather than scored.
 */
export function normaliseErf(
  erfSizeM2: number | null | undefined
): { value: number | null; flags: DataQualityFlag[] } {
  const flags: DataQualityFlag[] = []
  if (erfSizeM2 == null || Number.isNaN(erfSizeM2)) {
    return { value: null, flags }
  }
  if (erfSizeM2 <= 0) {
    flags.push({ kind: "erf-nonpositive", rawValue: erfSizeM2 })
    return { value: null, flags }
  }
  if (erfSizeM2 > MAX_PLAUSIBLE_ERF_M2) {
    flags.push({ kind: "erf-implausible", rawValue: erfSizeM2 })
    return { value: null, flags }
  }
  return { value: erfSizeM2, flags }
}

/**
 * Resolve the price used for scoring. Auctions expose a range (§5.3) — score on
 * the expected/reserve value, never the optimistic max. Reserve defaults to the
 * range minimum when no explicit expected is supplied.
 */
export function resolveBuyInCents(price: PriceInput): number {
  if (price.kind === "fixed") return price.cents
  return price.expectedCents ?? price.minCents
}

/** Flag a range price so the UI can caveat it. */
export function priceRangeFlags(price: PriceInput): DataQualityFlag[] {
  if (price.kind === "range") {
    return [{ kind: "price-range", minCents: price.minCents, maxCents: price.maxCents }]
  }
  return []
}

/**
 * `cash only` and `no approved building plans` both raise effort (more work /
 * regularisation), shrink the buyer pool and are tagged as risk (§5.3). Effort is
 * bumped one level per flag, capped at `severe`.
 */
export function applyEffortRisk(
  effort: EffortLevel,
  opts: { cashOnly?: boolean; noApprovedPlans?: boolean }
): { effort: EffortLevel; flags: DataQualityFlag[] } {
  const flags: DataQualityFlag[] = []
  let idx = EFFORT_ORDER.indexOf(effort)
  if (idx < 0) idx = 0
  if (opts.noApprovedPlans) {
    idx = Math.min(EFFORT_ORDER.length - 1, idx + 1)
    flags.push({ kind: "no-approved-plans" })
  }
  if (opts.cashOnly) {
    idx = Math.min(EFFORT_ORDER.length - 1, idx + 1)
    flags.push({ kind: "cash-only" })
  }
  return { effort: EFFORT_ORDER[idx], flags }
}

/** Only `active` rows may be presented as buyable (§5.3). */
export function isBuyable(status: ListingStatus): boolean {
  return status.kind === "active"
}

/** Flags for non-buyable statuses so the UI can down-rank / hide them. */
export function statusDataQualityFlags(status: ListingStatus): DataQualityFlag[] {
  switch (status.kind) {
    case "under-offer":
      return [{ kind: "status-under-offer" }]
    case "in-transaction":
      return [{ kind: "status-in-transaction" }]
    default:
      return []
  }
}
