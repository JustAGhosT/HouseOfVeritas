import { describe, expect, it } from "vitest"
import { GET } from "@/app/api/radar/route"

describe("GET /api/radar", () => {
  it("returns a public empty response when Radar is disabled by default", async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        data: [],
        summary: expect.objectContaining({
          mode: "disabled",
          enabled: false,
          count: 0,
        }),
      })
    )
  })
})
