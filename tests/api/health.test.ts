import { afterEach, describe, it, expect } from "vitest"
import { GET } from "@/app/api/health/route"

describe("GET /api/health", () => {
  const originalBackend = process.env.ESTATE_BACKEND
  const originalBaserowUrl = process.env.BASEROW_API_URL

  afterEach(() => {
    if (originalBackend === undefined) delete process.env.ESTATE_BACKEND
    else process.env.ESTATE_BACKEND = originalBackend
    if (originalBaserowUrl === undefined) delete process.env.BASEROW_API_URL
    else process.env.BASEROW_API_URL = originalBaserowUrl
  })

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

  it("reports which store is backing estate data", async () => {
    const data = await (await GET()).json()
    expect(["baserow", "postgres"]).toContain(data.backend)
  })

  /**
   * Regression guard for the 2026-08-07 cutover.
   *
   * The Baserow probe used to be gated on `getEstateRepository().isConfigured()`,
   * which is true whenever *any* backend is configured. On switching to Postgres
   * that started pinging a Baserow instance which had never been configured; it
   * answered "down", and the endpoint reported the whole service degraded while
   * production was in fact healthy.
   *
   * Baserow is unconfigured in the test environment either way, so the assertion
   * is on the probe being skipped rather than on the request outcome — that is
   * the actual behaviour change, and it holds without any network access.
   */
  it("does not probe Baserow when it is not the active backend", async () => {
    process.env.ESTATE_BACKEND = "postgres"
    process.env.BASEROW_API_URL = "https://baserow.invalid/api"

    const data = await (await GET()).json()
    const baserow = data.services.find((s: { name: string }) => s.name === "baserow")

    expect(baserow.status).toBe("unconfigured")
    expect(baserow.latencyMs).toBeNull()
  })
})
