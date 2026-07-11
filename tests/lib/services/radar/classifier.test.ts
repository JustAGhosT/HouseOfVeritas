import { describe, it, expect } from "vitest"
import { classifyPropertyType } from "@/lib/services/radar"

const rands = (rand: number) => rand * 100

/** A clean freehold-house baseline that fires no tells. */
const freehold = {
  titleType: "Freehold",
  erfSizeM2: 800,
  floorSizeM2: 140,
  description: "Family home needing cosmetic TLC, big stand",
  monthlyLevyCents: null,
  listedDate: "2026-07-01",
  siblingPricesCents: [],
  now: "2026-07-11",
}

describe("radar classifier — accepts genuine freehold houses", () => {
  it("classifies a clean resale house as flip-eligible", () => {
    const result = classifyPropertyType(freehold)
    expect(result.propertyType).toBe("freehold-house")
    expect(result.isFlipEligible).toBe(true)
    expect(result.reasons).toEqual([])
  })
})

describe("radar classifier — rejects non-flips via each §5.3 tell", () => {
  it("tell: sectional title deed", () => {
    const result = classifyPropertyType({ ...freehold, titleType: "Sectional" })
    expect(result.propertyType).toBe("sectional")
    expect(result.isFlipEligible).toBe(false)
    expect(result.reasons).toContain("title-sectional")

    // "Sec Title" variant also caught
    expect(classifyPropertyType({ ...freehold, titleType: "Sec Title" }).isFlipEligible).toBe(false)
  })

  it("tell: erf size equals floor size", () => {
    const result = classifyPropertyType({ ...freehold, erfSizeM2: 56, floorSizeM2: 56 })
    expect(result.propertyType).toBe("new-dev-unit")
    expect(result.isFlipEligible).toBe(false)
    expect(result.reasons).toContain("erf-equals-floor")
  })

  it("tell: new-development marketing tokens", () => {
    for (const token of ["estate", "new phase", "now selling", "units", "development"]) {
      const result = classifyPropertyType({
        ...freehold,
        description: `Cheap Selcourt — ${token} available`,
      })
      expect(result.isFlipEligible).toBe(false)
      expect(result.reasons).toContain(`token:${token}`)
    }
  })

  it("tell: levy + recent listing + identical-price siblings", () => {
    const result = classifyPropertyType({
      ...freehold,
      monthlyLevyCents: rands(1_200),
      listedDate: "2026-07-05",
      now: "2026-07-11",
      siblingPricesCents: [rands(899_000), rands(899_000)],
    })
    expect(result.propertyType).toBe("new-dev-unit")
    expect(result.isFlipEligible).toBe(false)
    expect(result.reasons).toContain("levy+recent+identical-siblings")
  })

  it("levy tell does NOT fire without all three parts", () => {
    // levy + recent but siblings not identical → no fire
    const distinctSiblings = classifyPropertyType({
      ...freehold,
      monthlyLevyCents: rands(1_200),
      listedDate: "2026-07-05",
      now: "2026-07-11",
      siblingPricesCents: [rands(899_000), rands(950_000)],
    })
    expect(distinctSiblings.reasons).not.toContain("levy+recent+identical-siblings")

    // levy + identical siblings but listing is stale (not recent) → no fire
    const stale = classifyPropertyType({
      ...freehold,
      monthlyLevyCents: rands(1_200),
      listedDate: "2026-01-01",
      now: "2026-07-11",
      siblingPricesCents: [rands(899_000), rands(899_000)],
    })
    expect(stale.reasons).not.toContain("levy+recent+identical-siblings")
    expect(stale.isFlipEligible).toBe(true)
  })

  it("collects multiple tells when several fire", () => {
    const result = classifyPropertyType({
      ...freehold,
      erfSizeM2: 56,
      floorSizeM2: 56,
      description: "New phase now selling — modern units",
    })
    expect(result.isFlipEligible).toBe(false)
    expect(result.reasons).toContain("erf-equals-floor")
    expect(result.reasons).toContain("token:new phase")
    expect(result.reasons).toContain("token:now selling")
    expect(result.reasons).toContain("token:units")
  })
})
