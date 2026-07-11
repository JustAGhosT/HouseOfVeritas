import type {
  Confidence,
  DealRadarFacts,
  DealRadarListing,
  ListingStatus,
  SubScores,
} from "@/lib/services/radar"
import { computeDerived, computeSubScores } from "@/lib/services/radar"

/** Every sub-score set to the same value — handy for controlling composites. */
export function uniformSubScores(value: number): SubScores {
  return {
    buyIn: value,
    flipPct: value,
    effort: value,
    dealScore: value,
    renoCost: value,
    rentalYield: value,
    areaQuality: value,
    daysOnMarket: value,
    distress: value,
    landUpside: value,
    holdingCost: value,
    affordability: value,
    transferFriction: value,
    physicalRisk: value,
    proximity: value,
  }
}

/** A complete, well-formed set of facts for a plausible Springs fixer-upper. */
export function makeFacts(overrides: Partial<DealRadarFacts> = {}): DealRadarFacts {
  return {
    listingId: "p24-000",
    suburb: "Strubenvale",
    price: { kind: "fixed", cents: 650_000 * 100 },
    bedrooms: 3,
    bathrooms: 1,
    erfSizeM2: 800,
    floorSizeM2: 140,
    zoning: "Residential 1",
    subdividePotential: false,
    effort: "moderate",
    distressFlag: { kind: "none" },
    suburbMedianCents: 850_000 * 100,
    arvEstimateCents: 1_050_000 * 100,
    renoCostEstimateCents: 180_000 * 100,
    monthlyRentCents: 7_500 * 100,
    monthlyBondCents: 7_000 * 100,
    holdingCostMonthlyCents: 2_500 * 100,
    transferFriction: { kind: "no-transfer-duty" },
    areaQualityIndex: 60,
    proximityIndex: 55,
    daysOnMarket: 40,
    physicalRisk: { dolomite: false, flood: false },
    ...overrides,
  }
}

/** Build a full listing; sub-scores derive from facts unless overridden. */
export function makeListing(
  opts: {
    facts?: Partial<DealRadarFacts>
    subScores?: Partial<SubScores>
    status?: ListingStatus
    confidence?: Confidence
    listingId?: string
  } = {}
): DealRadarListing {
  const facts = makeFacts({ ...opts.facts, ...(opts.listingId ? { listingId: opts.listingId } : {}) })
  const derived = computeDerived(facts)
  const subScores = { ...computeSubScores(facts, derived), ...opts.subScores }
  return {
    facts,
    derived,
    propertyType: "freehold-house",
    classification: { propertyType: "freehold-house", isFlipEligible: true, reasons: [] },
    subScores,
    composite: 0,
    arvBasis: { kind: "sold-transfer", sampleSize: 3 },
    arvConfidence: "high",
    canonicalKey: "sub:strubenvale:erf800:bed3",
    status: opts.status ?? { kind: "active" },
    confidence: opts.confidence ?? { kind: "verified" },
    analystNote: null,
    dataQualityFlags: [],
    provenance: {
      sourceUrl: "https://www.property24.com/for-sale/strubenvale/000",
      sourcePortal: "property24",
      lastSeen: "2026-07-11",
    },
  }
}
