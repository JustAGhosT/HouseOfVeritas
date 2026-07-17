import { describe, expect, it } from "vitest"
import { radarPublicTestInternals } from "@/lib/services/radar-public"

describe("radar public projection", () => {
  it("maps only publish-approved rows into the public shape", () => {
    const row = {
      id: 123,
      "Listing ID": "p24-1",
      "Source Portal": "property24",
      "Source URL": "https://example.com/listing",
      Suburb: "Brakpan North",
      "Price Cents": 95000000,
      Bedrooms: 3,
      Bathrooms: 2,
      "Erf Size M2": 812,
      "Property Type": "freehold-house",
      Confidence: "verified",
      Status: "active",
      "Publish Status": "published",
      "Buy In Cents": 95000000,
      "All In Cents": 107000000,
      "Flip Pct": 0.21,
      "Deal Score": 18.4,
      "Distress Flag": "pre-hammer",
      Effort: "moderate",
      "Subdivide Potential": true,
      "Last Seen": "2026-07-17",
    }

    expect(radarPublicTestInternals.mapRadarRow(row)).toEqual(
      expect.objectContaining({
        id: "p24-1",
        sourcePortal: "property24",
        suburb: "Brakpan North",
        priceCents: 95000000,
        propertyType: "freehold-house",
        confidence: "verified",
        status: "active",
        distressFlag: "pre-hammer",
        flipPct: 0.21,
        dealScore: 18.4,
        subdividePotential: true,
        lastSeen: "2026-07-17",
      })
    )
  })

  it("does not expose staged rows while legal publish gate is closed", () => {
    expect(
      radarPublicTestInternals.mapRadarRow({
        "Listing ID": "staged-1",
        "Source Portal": "property24",
        "Source URL": "https://example.com/staged",
        Suburb: "Springs",
        "Price Cents": 80000000,
        "Publish Status": "staged",
      })
    ).toBeNull()
  })
})
