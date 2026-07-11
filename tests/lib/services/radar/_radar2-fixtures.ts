/**
 * Radar 2 spike + test fixtures: a representative Springs seed set derived from
 * docs/specs/property-deal-radar.md Appendix A (the 9 verified listings), plus
 * deliberately-constructed labelled PAIRS used to measure the false-merge rate.
 *
 * Where the spec does not pin a field, a reasonable value is assumed and marked
 * `// assumed`. The goal is to exercise the matcher, not to be a cadastral record.
 * Money is integer cents (ZAR), per the Radar 1 convention.
 */

import type { MatchCandidate } from "@/lib/services/radar"

const rands = (rand: number): number => rand * 100

// ── Appendix A — the 9 verified Springs seed listings ────────────────────────

/** 1. Geduld "2-for-1": big stand, main + income unit, subdivide upside. */
export const geduld2for1: MatchCandidate = {
  listingId: "p24-geduld-2for1",
  sourcePortal: "property24",
  suburb: "Geduld",
  erfSizeM2: 991, // assumed (spec: large 2-dwelling stand)
  bedrooms: 4, // assumed (3 + flat)
  priceCents: rands(750_000), // assumed
  geohash: null, // address hidden
  agency: "Seeff", // assumed
  propertyType: "freehold-house",
}

/** 2. Geduld EasySell bank-repossession. */
export const geduldEasySell: MatchCandidate = {
  listingId: "myroof-geduld-easysell",
  sourcePortal: "myroof",
  suburb: "Geduld",
  erfSizeM2: 600, // assumed
  bedrooms: 3, // assumed
  priceCents: rands(520_000), // assumed
  geohash: null,
  agency: "FNB Quick Sell", // bank programme = the "agency" identity
  propertyType: "freehold-house",
}

/** 3. Struisbult dated house on a big 1,420 m² stand (address shown → geohash). */
export const struisbultDated: MatchCandidate = {
  listingId: "p24-struisbult-1420",
  sourcePortal: "property24",
  suburb: "Struisbult",
  erfSizeM2: 1420,
  bedrooms: 3, // assumed
  priceCents: rands(680_000), // assumed
  geohash: "ke7f8xq", // assumed precomputed geohash (address present)
  agency: "Pam Golding", // assumed
  propertyType: "freehold-house",
}

/** 4. Springs SIE auction (price range → expected/reserve, cash-only). */
export const springsSie: MatchCandidate = {
  listingId: "myroof-springs-sie",
  sourcePortal: "myroof",
  suburb: "Springs",
  erfSizeM2: 500, // assumed
  bedrooms: 2, // assumed
  priceCents: rands(450_000), // expected/reserve (assumed)
  geohash: null,
  agency: "SIE Auctions", // assumed
  propertyType: "freehold-house",
}

/** 5. Strubenvale fixer-upper + granny flat. */
export const strubenvaleFixer: MatchCandidate = {
  listingId: "p24-strubenvale-fixer",
  sourcePortal: "property24",
  suburb: "Strubenvale",
  erfSizeM2: 800, // assumed
  bedrooms: 3, // assumed (3 + flat)
  priceCents: rands(650_000), // assumed
  geohash: null, // address hidden
  agency: "RE/MAX", // assumed
  propertyType: "freehold-house",
}

/** 6. Selection Park house + flatlet. */
export const selectionParkFlatlet: MatchCandidate = {
  listingId: "pp-selectionpark-flatlet",
  sourcePortal: "private-property",
  suburb: "Selection Park",
  erfSizeM2: 812, // assumed
  bedrooms: 3, // assumed
  priceCents: rands(720_000), // assumed
  geohash: null,
  agency: "Chas Everitt", // assumed
  propertyType: "freehold-house",
}

/** 7. Modder East cash-only. */
export const modderEastCashOnly: MatchCandidate = {
  listingId: "p24-moddereast-cash",
  sourcePortal: "property24",
  suburb: "Modder East",
  erfSizeM2: 600, // assumed
  bedrooms: 2, // assumed
  priceCents: rands(380_000), // assumed
  geohash: null,
  agency: "Private Seller", // assumed
  propertyType: "freehold-house",
}

/** 8. Modder East EasySell. */
export const modderEastEasySell: MatchCandidate = {
  listingId: "myroof-moddereast-easysell",
  sourcePortal: "myroof",
  suburb: "Modder East",
  erfSizeM2: 650, // assumed
  bedrooms: 3, // assumed
  priceCents: rands(430_000), // assumed
  geohash: null,
  agency: "FNB Quick Sell", // assumed
  propertyType: "freehold-house",
}

/** 9. Strubenvale 6-bed. */
export const strubenvale6bed: MatchCandidate = {
  listingId: "p24-strubenvale-6bed",
  sourcePortal: "property24",
  suburb: "Strubenvale",
  erfSizeM2: 900, // assumed
  bedrooms: 6,
  priceCents: rands(980_000), // assumed
  geohash: null,
  agency: "RE/MAX", // assumed
  propertyType: "freehold-house",
}

export const seedListings: readonly MatchCandidate[] = [
  geduld2for1,
  geduldEasySell,
  struisbultDated,
  springsSie,
  strubenvaleFixer,
  selectionParkFlatlet,
  modderEastCashOnly,
  modderEastEasySell,
  strubenvale6bed,
]

// ── Labelled pairs for the false-merge study ─────────────────────────────────

/**
 * A ground-truth-labelled candidate pair. `sameHouse` is the truth we measure the
 * matcher against. `note` explains why the pair is interesting.
 */
export interface LabelledPair {
  id: string
  a: MatchCandidate
  b: MatchCandidate
  sameHouse: boolean
  note: string
}

// P1 — same house, two portals, address hidden, agency corroborates. → merge.
const strubenvaleFixerOnPP: MatchCandidate = {
  ...strubenvaleFixer,
  listingId: "pp-strubenvale-fixer",
  sourcePortal: "private-property",
  erfSizeM2: 810, // capture jitter within the erf bucket
}

// P2 — same repossession, two portals, small price-drop lag, same bank programme.
const geduldEasySellOnP24: MatchCandidate = {
  ...geduldEasySell,
  listingId: "p24-geduld-easysell",
  sourcePortal: "property24",
  priceCents: rands(515_000), // portal price-drop lag
}

// P3 — same house, both sources exposed the address → geohash-exact merge.
const struisbultDatedOnPP: MatchCandidate = {
  ...struisbultDated,
  listingId: "pp-struisbult-1420",
  sourcePortal: "private-property",
  erfSizeM2: 1405, // jitter within the same erf bucket (1400)
}

// P4 — same house, cross-portal, price drop pulls price to a HALF match; agency
//      corroboration still clears the merge bar (demonstrates price-lag tolerance).
const selectionParkOnMyRoof: MatchCandidate = {
  ...selectionParkFlatlet,
  listingId: "myroof-selectionpark-flatlet",
  sourcePortal: "myroof",
  erfSizeM2: 825,
  priceCents: rands(699_000), // ~2.9% below → half price match
}

// P5 — same house, cross-portal, BOTH portals hid the agent. Positional signals
//      only (0.75). Correctly UNMERGEABLE without a corroborator → quarantine.
const dersleyNoAgentA: MatchCandidate = {
  listingId: "p24-dersley-noagent",
  sourcePortal: "property24",
  suburb: "Dersley",
  erfSizeM2: 750,
  bedrooms: 4,
  priceCents: rands(760_000),
  geohash: null,
  agency: null,
  agentName: null,
  propertyType: "freehold-house",
}
const dersleyNoAgentB: MatchCandidate = {
  ...dersleyNoAgentA,
  listingId: "myroof-dersley-noagent",
  sourcePortal: "myroof",
  erfSizeM2: 770,
  priceCents: rands(755_000),
}

// N1 — Selcourt new-build estate: two DIFFERENT units, identical price, erf==floor
//      sectional tell. §5.3 says NOT the same house. → separate (sibling guard).
const selcourtSiblingA: MatchCandidate = {
  listingId: "pp-selcourt-unit-a",
  sourcePortal: "private-property",
  suburb: "Selcourt",
  erfSizeM2: 56,
  bedrooms: 2,
  priceCents: rands(899_000),
  geohash: null,
  agency: "Estate Dev Sales",
  propertyType: "new-dev-unit",
}
const selcourtSiblingB: MatchCandidate = {
  ...selcourtSiblingA,
  listingId: "pp-selcourt-unit-b",
  erfSizeM2: 56,
  priceCents: rands(899_000),
}

// N2 — two DIFFERENT Strubenvale houses, near-identical position, DIFFERENT agency.
//      Positional-only 0.75 → quarantine (NOT merge). At a low threshold this is
//      the pair that starts false-merging — the reason not to drop below 0.80.
const strubenvaleOtherHouse: MatchCandidate = {
  listingId: "pp-strubenvale-other",
  sourcePortal: "private-property",
  suburb: "Strubenvale",
  erfSizeM2: 790,
  bedrooms: 3,
  priceCents: rands(649_000),
  geohash: null,
  agency: "Seeff", // different agency from the RE/MAX fixer
  propertyType: "freehold-house",
}

// N3 — Modder East cash-only vs EasySell: different beds + price. → separate.

// N4 — two Geduld houses, same price band but erf far apart. → separate.
const geduldSmallErf: MatchCandidate = {
  listingId: "p24-geduld-small",
  sourcePortal: "property24",
  suburb: "Geduld",
  erfSizeM2: 600,
  bedrooms: 3,
  priceCents: rands(760_000),
  geohash: null,
  agency: "Seeff",
  propertyType: "freehold-house",
}
const geduldBigErf: MatchCandidate = {
  ...geduldSmallErf,
  listingId: "pp-geduld-big",
  sourcePortal: "private-property",
  erfSizeM2: 1200,
  agency: "Chas Everitt",
}

// N5 — two DIFFERENT sectional units in one block: shared building footprint →
//      geohash matches but a side is sectional → quarantine, never merge.
const sectionalUnitA: MatchCandidate = {
  listingId: "p24-springs-sec-a",
  sourcePortal: "property24",
  suburb: "Springs",
  erfSizeM2: 62,
  bedrooms: 2,
  priceCents: rands(560_000),
  geohash: "ke7g10p",
  agency: "Rawson",
  propertyType: "sectional",
}
const sectionalUnitB: MatchCandidate = {
  ...sectionalUnitA,
  listingId: "pp-springs-sec-b",
  sourcePortal: "private-property",
  erfSizeM2: 62,
  propertyType: "sectional",
}

// N6 — the IRREDUCIBLE trap: two DIFFERENT freehold houses that happen to share
//      suburb + erf + beds + price AND agency, both address-hidden. Fuzzy features
//      cannot separate them (confidence 1.0) — only live geocoding (Radar 3) can.
//      Included to keep the false-merge rate honest.
const casseldaleHouse1: MatchCandidate = {
  listingId: "p24-casseldale-1",
  sourcePortal: "property24",
  suburb: "Casseldale",
  erfSizeM2: 700,
  bedrooms: 3,
  priceCents: rands(690_000),
  geohash: null,
  agency: "Just Property",
  propertyType: "freehold-house",
}
const casseldaleHouse2: MatchCandidate = {
  ...casseldaleHouse1,
  listingId: "pp-casseldale-2",
  sourcePortal: "private-property",
  // genuinely a different house one street over — but identical on every fuzzy field
}

export const labelledPairs: readonly LabelledPair[] = [
  { id: "P1", a: strubenvaleFixer, b: strubenvaleFixerOnPP, sameHouse: true, note: "cross-portal dup, agency corroborates" },
  { id: "P2", a: geduldEasySell, b: geduldEasySellOnP24, sameHouse: true, note: "repossession cross-portal, price-drop lag" },
  { id: "P3", a: struisbultDated, b: struisbultDatedOnPP, sameHouse: true, note: "geohash-exact (address shown both sides)" },
  { id: "P4", a: selectionParkFlatlet, b: selectionParkOnMyRoof, sameHouse: true, note: "price drop → half price match, agency saves it" },
  { id: "P5", a: dersleyNoAgentA, b: dersleyNoAgentB, sameHouse: true, note: "address AND agent hidden → positional-only, unmergeable" },
  { id: "N1", a: selcourtSiblingA, b: selcourtSiblingB, sameHouse: false, note: "new-dev siblings (§5.3) — must NOT merge" },
  { id: "N2", a: strubenvaleFixer, b: strubenvaleOtherHouse, sameHouse: false, note: "similar houses, different agency → quarantine" },
  { id: "N3", a: modderEastCashOnly, b: modderEastEasySell, sameHouse: false, note: "different beds + price → separate" },
  { id: "N4", a: geduldSmallErf, b: geduldBigErf, sameHouse: false, note: "erf far apart → separate" },
  { id: "N5", a: sectionalUnitA, b: sectionalUnitB, sameHouse: false, note: "sectional units share footprint → quarantine" },
  { id: "N6", a: casseldaleHouse1, b: casseldaleHouse2, sameHouse: false, note: "irreducible: identical fuzzy fields, needs geo (Radar 3)" },
]
