/**
 * Unit coverage for the PostgreSQL radar listing repository.
 *
 * `mapRow` is the only thing standing between a raw row and the unauthenticated
 * /radar page, so the completeness guard gets the most attention. The publish
 * gate is deliberately *not* in the mapper here (unlike the Baserow mapper) —
 * the SQL query enforces it — so both halves of that arrangement are asserted.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const postgres = vi.hoisted(() => ({
  isPostgresConfigured: vi.fn(() => true),
  query: vi.fn(),
  withClient: vi.fn(),
  getPool: vi.fn(),
  ensureSchema: vi.fn(),
  closePool: vi.fn(),
}))

vi.mock("@/lib/db/postgres", () => postgres)
vi.mock("@/lib/db/radar-schema", () => ({
  ensureRadarSchema: vi.fn(async () => undefined),
}))

import {
  postgresRadarRepository,
  radarRepositoryPostgresTestInternals,
} from "@/lib/repositories/radar-repository-postgres"

const { mapRow } = radarRepositoryPostgresTestInternals

/** Minimum row that satisfies the completeness guard. */
function completeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    listing_id: "p24-1",
    source_portal: "property24",
    source_url: "https://example.com/listing/1",
    suburb: "Brakpan North",
    // BIGINT arrives from pg as a string.
    price_cents: "95000000",
    ...overrides,
  }
}

const missingFieldCases: Array<[string, Record<string, unknown>]> = [
  ["source_url (empty)", { source_url: "" }],
  ["source_url (null)", { source_url: null }],
  ["source_portal (empty)", { source_portal: "" }],
  ["source_portal (null)", { source_portal: null }],
  ["suburb (empty)", { suburb: "" }],
  ["suburb (null)", { suburb: null }],
]

const badPriceCases: Array<[string, unknown]> = [
  ["zero", "0"],
  ["negative", "-1"],
  ["null", null],
  ["undefined", undefined],
  ["non-numeric", "R950 000"],
]

describe("radar mapRow — completeness guard", () => {
  it.each(missingFieldCases)("rejects a row missing %s", (_label, overrides) => {
    expect(mapRow(completeRow(overrides))).toBeNull()
  })

  it("rejects a row with no usable listing identifier", () => {
    expect(mapRow(completeRow({ id: null, listing_id: null, source_key: null }))).toBeNull()
    expect(mapRow(completeRow({ id: "", listing_id: "", source_key: "" }))).toBeNull()
  })

  it("falls back from listing_id to source_key to the row id", () => {
    expect(mapRow(completeRow())?.id).toBe("p24-1")
    expect(mapRow(completeRow({ listing_id: null, source_key: "src-9" }))?.id).toBe("src-9")
    expect(mapRow(completeRow({ id: 42, listing_id: null, source_key: null }))?.id).toBe("42")
  })

  it.each(badPriceCases)("rejects a %s price", (_label, priceCents) => {
    expect(mapRow(completeRow({ price_cents: priceCents }))).toBeNull()
  })

  it("accepts the smallest positive price", () => {
    expect(mapRow(completeRow({ price_cents: "1" }))?.priceCents).toBe(1)
  })

  it("documents current behaviour: whitespace-only strings pass the guard", () => {
    // The Baserow mapper trims before testing emptiness; this one does not, so
    // a whitespace-only suburb is publishable here but not there. See report.
    expect(mapRow(completeRow({ suburb: "   " }))?.suburb).toBe("   ")
  })

  it("documents the intentional difference: publish status is not re-checked", () => {
    // Unlike the Baserow mapper, this one has no publish gate — the SQL in
    // listPublished filters on publish_status = 'published'. Asserted here so
    // the compensating control is visible if the query is ever changed.
    expect(mapRow(completeRow({ publish_status: "staged" }))).not.toBeNull()
    expect(mapRow(completeRow({ publish_status: "quarantined" }))).not.toBeNull()
  })
})

describe("radar mapRow — projection", () => {
  it("maps a fully populated row into the public shape", () => {
    expect(
      mapRow({
        id: 1,
        listing_id: "p24-1",
        source_portal: "property24",
        source_url: "https://example.com/listing/1",
        suburb: "Brakpan North",
        price_cents: "95000000",
        bedrooms: 3,
        bathrooms: 2,
        erf_size_m2: 812,
        floor_size_m2: 180,
        property_type: "freehold-house",
        confidence: "verified",
        status: "under-offer",
        distress_flag: "pre-hammer",
        effort: "moderate",
        buy_in_cents: "96000000",
        all_in_cents: "107000000",
        flip_pct: "0.21",
        deal_score: "18.4",
        rental_yield_gross: "0.085",
        arv_estimate_cents: "120000000",
        reno_cost_estimate_cents: "8000000",
        area_quality_index: "0.62",
        proximity_index: "0.71",
        days_on_market: 44,
        subdivide_potential: true,
        transfer_friction: "low",
        physical_risk_dolomite: false,
        physical_risk_flood: true,
        analyst_note: "Deceased estate; agent expects a quick close.",
        last_seen: new Date(Date.UTC(2026, 6, 17, 12, 0, 0)),
      })
    ).toEqual({
      id: "p24-1",
      sourcePortal: "property24",
      sourceUrl: "https://example.com/listing/1",
      suburb: "Brakpan North",
      priceCents: 95000000,
      bedrooms: 3,
      bathrooms: 2,
      erfSizeM2: 812,
      floorSizeM2: 180,
      propertyType: "freehold-house",
      confidence: "verified",
      status: "under-offer",
      distressFlag: "pre-hammer",
      effort: "moderate",
      buyInCents: 96000000,
      allInCents: 107000000,
      flipPct: 0.21,
      dealScore: 18.4,
      rentalYieldGross: 0.085,
      arvEstimateCents: 120000000,
      renoCostEstimateCents: 8000000,
      areaQualityIndex: 0.62,
      proximityIndex: 0.71,
      daysOnMarket: 44,
      subdividePotential: true,
      transferFriction: "low",
      physicalRiskDolomite: false,
      physicalRiskFlood: true,
      analystNote: "Deceased estate; agent expects a quick close.",
      lastSeen: "2026-07-17",
    })
  })

  it("nulls every optional measure that is absent", () => {
    const listing = mapRow(completeRow())
    expect(listing).toEqual(
      expect.objectContaining({
        bedrooms: null,
        bathrooms: null,
        erfSizeM2: null,
        floorSizeM2: null,
        flipPct: null,
        dealScore: null,
        rentalYieldGross: null,
        arvEstimateCents: null,
        renoCostEstimateCents: null,
        areaQualityIndex: null,
        proximityIndex: null,
        daysOnMarket: null,
        analystNote: null,
        lastSeen: null,
      })
    )
  })

  it("applies placeholder labels for missing descriptive fields", () => {
    expect(mapRow(completeRow())).toEqual(
      expect.objectContaining({
        propertyType: "unknown",
        effort: "unknown",
        transferFriction: "unknown",
        distressFlag: "none",
        confidence: "estimate",
        status: "active",
        subdividePotential: false,
        physicalRiskDolomite: false,
        physicalRiskFlood: false,
      })
    )
  })

  it("rounds fractional integer measures", () => {
    const listing = mapRow(completeRow({ bedrooms: "3.4", bathrooms: "2.5", price_cents: "12.6" }))
    expect(listing?.bedrooms).toBe(3)
    expect(listing?.bathrooms).toBe(3)
    expect(listing?.priceCents).toBe(13)
  })

  it("keeps float precision on ratio measures", () => {
    const listing = mapRow(completeRow({ flip_pct: "0.2149", deal_score: -3.5 }))
    expect(listing?.flipPct).toBe(0.2149)
    expect(listing?.dealScore).toBe(-3.5)
  })

  const confidenceCases: Array<[string, string]> = [
    ["verified", "verified"],
    ["feed", "feed"],
    ["estimate", "estimate"],
    ["VERIFIED", "estimate"],
    ["nonsense", "estimate"],
    ["", "estimate"],
  ]

  it.each(confidenceCases)("normalises confidence %s to %s", (input, expected) => {
    expect(mapRow(completeRow({ confidence: input }))?.confidence).toBe(expected)
  })

  const statusCases: Array<[string, string]> = [
    ["under-offer", "under-offer"],
    ["in-transaction", "in-transaction"],
    ["delisted", "delisted"],
    ["active", "active"],
    ["sold", "active"],
    ["", "active"],
  ]

  it.each(statusCases)("normalises status %s to %s", (input, expected) => {
    expect(mapRow(completeRow({ status: input }))?.status).toBe(expected)
  })

  describe("buy-in and all-in derivation", () => {
    it("falls back to the asking price when buy_in_cents is absent", () => {
      const listing = mapRow(completeRow({ buy_in_cents: null }))
      expect(listing?.buyInCents).toBe(95000000)
      expect(listing?.allInCents).toBe(95000000)
    })

    it("derives all-in from buy-in plus renovation cost when absent", () => {
      const listing = mapRow(
        completeRow({
          buy_in_cents: "96000000",
          reno_cost_estimate_cents: "8000000",
          all_in_cents: null,
        })
      )
      expect(listing?.allInCents).toBe(104000000)
    })

    it("treats an absent renovation cost as zero in the fallback", () => {
      const listing = mapRow(
        completeRow({ buy_in_cents: "96000000", reno_cost_estimate_cents: null })
      )
      expect(listing?.allInCents).toBe(96000000)
      expect(listing?.renoCostEstimateCents).toBeNull()
    })

    it("prefers a stored all-in over the derived value", () => {
      const listing = mapRow(
        completeRow({
          buy_in_cents: "96000000",
          reno_cost_estimate_cents: "8000000",
          all_in_cents: "111000000",
        })
      )
      expect(listing?.allInCents).toBe(111000000)
    })

    it("keeps a stored all-in of zero rather than falling back", () => {
      // `??` not `||`: zero is a stored value, not an absence.
      expect(mapRow(completeRow({ all_in_cents: 0 }))?.allInCents).toBe(0)
    })
  })

  describe("last_seen", () => {
    it("renders a pg DATE as YYYY-MM-DD", () => {
      expect(
        mapRow(completeRow({ last_seen: new Date(Date.UTC(2026, 6, 17, 12)) }))?.lastSeen
      ).toBe("2026-07-17")
    })

    it("truncates a string timestamp to the date portion", () => {
      expect(mapRow(completeRow({ last_seen: "2026-07-17T22:30:00.000Z" }))?.lastSeen).toBe(
        "2026-07-17"
      )
    })

    it("takes the calendar day in LOCAL time, not UTC (regression: off-by-one)", () => {
      // pg parses DATE to local midnight, so on a UTC+2 host this instant IS
      // DATE '2026-07-18'. Decoding via toISOString() re-projected to UTC and
      // reported the previous day. Now decoded from local components; see
      // lib/db/postgres, which also pins the DATE type parser to a raw string.
      expect(
        mapRow(completeRow({ last_seen: new Date(Date.UTC(2026, 6, 17, 22)) }))?.lastSeen
      ).toBe(process.env.TZ === "UTC" ? "2026-07-17" : "2026-07-18")
    })

    it("returns null for an absent or unparseable value", () => {
      expect(mapRow(completeRow({ last_seen: null }))?.lastSeen).toBeNull()
      expect(mapRow(completeRow({ last_seen: "" }))?.lastSeen).toBeNull()
      expect(mapRow(completeRow({ last_seen: 20260717 }))?.lastSeen).toBeNull()
    })
  })

  it("returns null for an empty analyst note", () => {
    expect(mapRow(completeRow({ analyst_note: "" }))?.analystNote).toBeNull()
    expect(mapRow(completeRow({ analyst_note: "  Watch this one." }))?.analystNote).toBe(
      "  Watch this one."
    )
  })
})

describe("postgresRadarRepository.listPublished", () => {
  beforeEach(() => {
    postgres.query.mockReset()
    postgres.isPostgresConfigured.mockReturnValue(true)
  })

  it("filters on publish status in SQL and caps the page size", async () => {
    postgres.query.mockResolvedValue({ rows: [], rowCount: 0 })

    await postgresRadarRepository.listPublished()

    const [sql, values] = postgres.query.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain("publish_status = 'published'")
    expect(sql).toContain("ORDER BY deal_score DESC NULLS LAST, id ASC")
    expect(sql).toContain("LIMIT $1")
    expect(values).toEqual([200])
  })

  it("drops rows the mapper rejects instead of emitting nulls", async () => {
    postgres.query.mockResolvedValue({
      rows: [completeRow(), completeRow({ suburb: null, listing_id: "p24-2" })],
      rowCount: 2,
    })

    const listings = await postgresRadarRepository.listPublished()

    expect(listings).toHaveLength(1)
    expect(listings[0].id).toBe("p24-1")
  })

  it("returns empty without querying when Postgres is unconfigured", async () => {
    postgres.isPostgresConfigured.mockReturnValue(false)

    await expect(postgresRadarRepository.listPublished()).resolves.toEqual([])
    expect(postgres.query).not.toHaveBeenCalled()
    expect(postgresRadarRepository.isConfigured()).toBe(false)
  })

  it("declares itself as the postgres backend", () => {
    expect(postgresRadarRepository.backend).toBe("postgres")
  })
})
