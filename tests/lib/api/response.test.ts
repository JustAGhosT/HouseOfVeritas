import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/services/baserow", () => ({
  isBaserowConfigured: vi.fn(),
}))

describe("api/response", () => {
  beforeEach(async () => {
    const { isBaserowConfigured } = await import("@/lib/services/baserow")
    vi.mocked(isBaserowConfigured).mockReturnValue(true)
  })

  it("wraps data with configured status when Baserow is configured", async () => {
    const { withDataSource } = await import("@/lib/api/response")
    const res = withDataSource({ items: [] })
    const json = await res.json()
    expect(json.configured).toBe(true)
    expect(json.message).toBe("Connected to Baserow")
    expect(json.items).toEqual([])
  })

  it("uses empty-state message when Baserow not configured", async () => {
    const { isBaserowConfigured } = await import("@/lib/services/baserow")
    vi.mocked(isBaserowConfigured).mockReturnValue(false)
    const { withDataSource } = await import("@/lib/api/response")
    const res = withDataSource({ items: [] })
    const json = await res.json()
    expect(json.configured).toBe(false)
    expect(json.message).toBe("Baserow not configured")
  })

  it("preserves custom message when provided", async () => {
    const { withDataSource } = await import("@/lib/api/response")
    const res = withDataSource({ message: "Custom" })
    const json = await res.json()
    expect(json.message).toBe("Custom")
  })
})
