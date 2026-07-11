/**
 * House of Veritas - Property Deal Radar: property-type classifier (§5.3)
 *
 * The guardrail that stops new-dev / sectional units ranking as flips (the mistake
 * the research session must not repeat). Deterministic, pure — no LLM, no network.
 * Any tell firing marks the row ineligible for flip ranking; the fired tells are
 * returned in `reasons` for transparency.
 */

import type { PropertyClassification } from "./types"

export interface ClassifierInput {
  /** Title-deed type, e.g. "Freehold" | "Sectional" | "Sec Title". */
  titleType?: string | null
  erfSizeM2?: number | null
  floorSizeM2?: number | null
  description?: string | null
  monthlyLevyCents?: number | null
  /** ISO listing date, used with `now` for the recency tell. */
  listedDate?: string | null
  /** Prices of same-complex siblings; identical prices signal unit-by-unit sale. */
  siblingPricesCents?: number[]
  /** Injectable "current" ISO date for deterministic tests. Defaults to now. */
  now?: string
}

/** New-development marketing tokens (§5.3). */
export const NEW_DEV_TOKENS = [
  "estate",
  "new phase",
  "now selling",
  "units",
  "development",
] as const

/** A listing newer than this is "recent" for the levy+recent+siblings tell. */
export const RECENT_LISTING_DAYS = 45
/** Number of identical-price siblings that signals a sold-unit-by-unit complex. */
export const MIN_IDENTICAL_SIBLINGS = 2

const DAY_MS = 24 * 60 * 60 * 1000

function isRecent(listedDate: string | null | undefined, now: string | undefined, days: number): boolean {
  if (!listedDate) return false
  const listed = Date.parse(listedDate)
  const nowMs = now ? Date.parse(now) : Date.now()
  if (Number.isNaN(listed) || Number.isNaN(nowMs)) return false
  return nowMs >= listed && nowMs - listed <= days * DAY_MS
}

/** Size of the largest identical-price group among the siblings. */
function maxIdenticalSiblings(prices: number[] | undefined): number {
  if (!prices || prices.length === 0) return 0
  const counts = new Map<number, number>()
  let max = 0
  for (const price of prices) {
    const next = (counts.get(price) ?? 0) + 1
    counts.set(price, next)
    if (next > max) max = next
  }
  return max
}

export function classifyPropertyType(input: ClassifierInput): PropertyClassification {
  const reasons: string[] = []

  // Strongest signal: the title deed itself. Sectional title is never a flip house.
  if (input.titleType && /sectional|sec\s*title/i.test(input.titleType)) {
    reasons.push("title-sectional")
    return { propertyType: "sectional", isFlipEligible: false, reasons }
  }

  // erf == floor: a "house" whose stand equals its under-roof area is a unit,
  // not a freehold house on land (e.g. the 40 m² / 56 m² "houses").
  if (
    input.erfSizeM2 != null &&
    input.floorSizeM2 != null &&
    input.erfSizeM2 > 0 &&
    input.erfSizeM2 === input.floorSizeM2
  ) {
    reasons.push("erf-equals-floor")
  }

  // Off-plan / sold-unit-by-unit marketing language.
  const description = (input.description ?? "").toLowerCase()
  for (const token of NEW_DEV_TOKENS) {
    if (description.includes(token)) reasons.push(`token:${token}`)
  }

  // Monthly levy + recent listing + several identical-price siblings = a complex
  // being sold unit-by-unit, not a resale house.
  const hasLevy = input.monthlyLevyCents != null && input.monthlyLevyCents > 0
  const recent = isRecent(input.listedDate, input.now, RECENT_LISTING_DAYS)
  const identicalSiblings = maxIdenticalSiblings(input.siblingPricesCents)
  if (hasLevy && recent && identicalSiblings >= MIN_IDENTICAL_SIBLINGS) {
    reasons.push("levy+recent+identical-siblings")
  }

  if (reasons.length > 0) {
    return { propertyType: "new-dev-unit", isFlipEligible: false, reasons }
  }

  return { propertyType: "freehold-house", isFlipEligible: true, reasons }
}
