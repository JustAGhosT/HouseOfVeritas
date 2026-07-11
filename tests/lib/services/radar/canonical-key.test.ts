import { describe, it, expect } from "vitest"
import { computeCanonicalKey } from "@/lib/services/radar"

describe("radar canonicalKey — deterministic field normaliser (Radar 1 only)", () => {
  it("anchors on the geohash when address/geo is present", () => {
    expect(computeCanonicalKey({ suburb: "Geduld", erfSizeM2: 991, geohash: "ke7dxk" })).toBe(
      "geo:ke7dxk:erf1000"
    )
  })

  it("falls back to a composite key when the address is hidden", () => {
    expect(
      computeCanonicalKey({ suburb: "Selection Park", erfSizeM2: 812, bedrooms: 3 })
    ).toBe("sub:selection-park:erf800:bed3")
  })

  it("is stable across erf capture jitter within a bucket", () => {
    const a = computeCanonicalKey({ suburb: "Strubenvale", erfSizeM2: 798, bedrooms: 3 })
    const b = computeCanonicalKey({ suburb: "Strubenvale", erfSizeM2: 823, bedrooms: 3 })
    expect(a).toBe(b) // both round to the 800 bucket
  })

  it("normalises suburb casing and punctuation", () => {
    expect(computeCanonicalKey({ suburb: "  MODDER East  ", erfSizeM2: 600, bedrooms: 2 })).toBe(
      "sub:modder-east:erf600:bed2"
    )
  })

  it("marks missing erf / bedrooms as 'na' rather than fabricating", () => {
    expect(computeCanonicalKey({ suburb: "Springs", erfSizeM2: null })).toBe("sub:springs:erfna:bedna")
  })

  it("is deterministic — same input, same key", () => {
    const fields = { suburb: "Dersley", erfSizeM2: 750, bedrooms: 4 }
    expect(computeCanonicalKey(fields)).toBe(computeCanonicalKey(fields))
  })
})
