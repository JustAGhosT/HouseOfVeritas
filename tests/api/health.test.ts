import { describe, it, expect } from "vitest"
import { GET } from "@/app/api/health/route"

describe("GET /api/health", () => {
  it("returns 200 with health status", async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty("status")
    expect(["healthy", "degraded"]).toContain(data.status)
    expect(data.build).toEqual({ commit: "development" })
    expect(data).toHaveProperty("dataMode")
    expect(data).toHaveProperty("services")
    expect(data).toHaveProperty("timestamp")
    expect(response.headers.get("cache-control")).toContain("no-store")
    expect(response.headers.get("pragma")).toBe("no-cache")
  })
})
