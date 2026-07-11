import { describe, it, expect } from "vitest"
import {
  applyEffortRisk,
  isBuyable,
  normaliseErf,
  priceRangeFlags,
  resolveBuyInCents,
  statusDataQualityFlags,
} from "@/lib/services/radar"

const rands = (rand: number) => rand * 100

describe("radar data-quality — erf clamp", () => {
  it("passes plausible erf through unchanged", () => {
    expect(normaliseErf(800)).toEqual({ value: 800, flags: [] })
  })

  it("clamps nonsense large erf and flags it", () => {
    expect(normaliseErf(100_000)).toEqual({
      value: null,
      flags: [{ kind: "erf-implausible", rawValue: 100_000 }],
    })
    expect(normaliseErf(16_777).flags[0].kind).toBe("erf-implausible")
  })

  it("flags non-positive erf", () => {
    expect(normaliseErf(0)).toEqual({ value: null, flags: [{ kind: "erf-nonpositive", rawValue: 0 }] })
    expect(normaliseErf(-5).flags[0].kind).toBe("erf-nonpositive")
  })

  it("treats null / NaN as simply missing (no flag)", () => {
    expect(normaliseErf(null)).toEqual({ value: null, flags: [] })
    expect(normaliseErf(undefined)).toEqual({ value: null, flags: [] })
    expect(normaliseErf(NaN)).toEqual({ value: null, flags: [] })
  })
})

describe("radar data-quality — auction price ranges", () => {
  it("scores a fixed price on that price", () => {
    expect(resolveBuyInCents({ kind: "fixed", cents: rands(650_000) })).toBe(rands(650_000))
  })

  it("scores a range on the expected/reserve, not the optimistic max", () => {
    const withExpected = resolveBuyInCents({
      kind: "range",
      minCents: rands(400_000),
      maxCents: rands(800_000),
      expectedCents: rands(550_000),
    })
    expect(withExpected).toBe(rands(550_000))

    // reserve defaults to the range minimum when no expected is given
    const noExpected = resolveBuyInCents({
      kind: "range",
      minCents: rands(400_000),
      maxCents: rands(800_000),
    })
    expect(noExpected).toBe(rands(400_000))
  })

  it("flags a range price for UI caveating", () => {
    expect(
      priceRangeFlags({ kind: "range", minCents: rands(400_000), maxCents: rands(800_000) })
    ).toEqual([{ kind: "price-range", minCents: rands(400_000), maxCents: rands(800_000) }])
    expect(priceRangeFlags({ kind: "fixed", cents: rands(650_000) })).toEqual([])
  })
})

describe("radar data-quality — cash-only / no-plans risk", () => {
  it("cash-only raises effort one level and tags risk", () => {
    const result = applyEffortRisk("cosmetic", { cashOnly: true })
    expect(result.effort).toBe("moderate")
    expect(result.flags).toEqual([{ kind: "cash-only" }])
  })

  it("no-approved-plans raises effort and tags risk", () => {
    const result = applyEffortRisk("moderate", { noApprovedPlans: true })
    expect(result.effort).toBe("major")
    expect(result.flags).toEqual([{ kind: "no-approved-plans" }])
  })

  it("both flags stack but effort caps at severe", () => {
    const stacked = applyEffortRisk("major", { cashOnly: true, noApprovedPlans: true })
    expect(stacked.effort).toBe("severe") // major → +1 (severe) → capped
    expect(stacked.flags).toEqual([{ kind: "no-approved-plans" }, { kind: "cash-only" }])
  })

  it("no flags leave effort unchanged", () => {
    expect(applyEffortRisk("cosmetic", {})).toEqual({ effort: "cosmetic", flags: [] })
  })
})

describe("radar data-quality — status logic", () => {
  it("only active rows are buyable", () => {
    expect(isBuyable({ kind: "active" })).toBe(true)
    expect(isBuyable({ kind: "under-offer" })).toBe(false)
    expect(isBuyable({ kind: "in-transaction" })).toBe(false)
    expect(isBuyable({ kind: "delisted", lastSeen: "2026-07-01" })).toBe(false)
  })

  it("non-buyable statuses raise the matching flag", () => {
    expect(statusDataQualityFlags({ kind: "under-offer" })).toEqual([{ kind: "status-under-offer" }])
    expect(statusDataQualityFlags({ kind: "in-transaction" })).toEqual([
      { kind: "status-in-transaction" },
    ])
    expect(statusDataQualityFlags({ kind: "active" })).toEqual([])
  })
})
