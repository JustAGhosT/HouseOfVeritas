/**
 * Property Deal Radar — public projection types.
 *
 * The published, link-out-safe shape served to the unauthenticated /radar page.
 * Backend-agnostic by design: nothing here may import a datastore module. The
 * full internal record (raw facts, sub-scores, provenance) lives in
 * `lib/services/radar/types.ts`; this is the narrowed public view.
 */

export type RadarMode = "disabled" | "empty" | "live" | "error"

export interface PublicRadarListing {
  id: string
  sourcePortal: string
  sourceUrl: string
  suburb: string
  priceCents: number
  bedrooms: number | null
  bathrooms: number | null
  erfSizeM2: number | null
  floorSizeM2: number | null
  propertyType: string
  confidence: "verified" | "feed" | "estimate"
  status: "active" | "under-offer" | "in-transaction" | "delisted"
  distressFlag: string
  effort: string
  buyInCents: number
  allInCents: number
  flipPct: number | null
  dealScore: number | null
  rentalYieldGross: number | null
  arvEstimateCents: number | null
  renoCostEstimateCents: number | null
  areaQualityIndex: number | null
  proximityIndex: number | null
  daysOnMarket: number | null
  subdividePotential: boolean
  transferFriction: string
  physicalRiskDolomite: boolean
  physicalRiskFlood: boolean
  analystNote: string | null
  lastSeen: string | null
}
